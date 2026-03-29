import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

import dbConnect from "@/lib/db";
import PdfVaultFolder from "@/models/PdfVaultFolder";
import PdfVaultFile from "@/models/PdfVaultFile";
import OfficialPaper from "@/models/OfficialPaper";
import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  cleanFolderPath,
  ensureRootFolder,
  getSecurePdfDownloadUrl,
  getSecurePdfOpenUrl,
  hasPdfVaultPageAccess,
  movePdfVaultFile,
  safeStr,
  detectPdfPagesFromS3Key,
} from "@/lib/pdfVault";
import { syncProductAvailabilityBySku } from "@/lib/productAvailability";

export const runtime = "nodejs";

const REGION = process.env.AWS_REGION || "ap-south-1";
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID || "";
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY || "";
const BUCKET_PRIVATE = process.env.AWS_S3_BUCKET_PRIVATE || "";

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

async function assertVaultAccess() {
  const user = await getAuthUser();

  if (!user) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  if (!hasPermission(user, "products:write")) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const allowed = await hasPdfVaultPageAccess(user.id);
  if (!allowed) {
    return {
      ok: false as const,
      res: NextResponse.json(
        { error: "Vault access expired", needsPuzzle: true },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, user };
}

function getUserId(user: any) {
  return safeStr(user?.id || user?._id || user?.email || "");
}

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePositiveInt(input: string, fallback: number) {
  const n = Number(input);
  if (!Number.isFinite(n)) return fallback;
  if (n <= 0) return fallback;
  return Math.floor(n);
}

function normalizePageSize(input: string) {
  const allowed = new Set([25, 50, 100, 200]);
  const n = parsePositiveInt(input, 25);
  return allowed.has(n) ? n : 25;
}

function buildSort(sortByRaw: string, sortDirRaw: string) {
  const sortBy = safeStr(sortByRaw || "uploadedAt");
  const sortDir = safeStr(sortDirRaw || "desc").toLowerCase() === "asc" ? 1 : -1;

  let sort: any = { uploadedAt: -1, _id: -1 };

  if (sortBy === "name") {
    sort = { fileName: sortDir, _id: sortDir };
  } else if (sortBy === "uploadedAt") {
    sort = { uploadedAt: sortDir, _id: sortDir };
  } else if (sortBy === "productExists") {
    sort = { productExists: sortDir, fileName: 1, _id: 1 };
  } else if (sortBy === "updatedAt") {
    sort = { updatedAt: sortDir, _id: sortDir };
  } else if (sortBy === "pageCount") {
    sort = { pageCount: sortDir, fileName: 1, _id: 1 };
  }

  return sort;
}

async function getFolderMap(rows: any[]) {
  const folderIds = Array.from(
    new Set(
      rows
        .map((row: any) => safeStr(row.folderId))
        .filter(Boolean)
    )
  );

  const folderDocs: any[] = folderIds.length
    ? await PdfVaultFolder.find({
        _id: { $in: folderIds },
      })
        .select({ _id: 1, name: 1, path: 1 })
        .lean()
    : [];

  const folderMap = new Map<string, { name: string; path: string }>();
  for (const f of folderDocs) {
    folderMap.set(String(f._id), {
      name: safeStr(f.name),
      path: safeStr(f.path),
    });
  }

  return folderMap;
}

function mapFileRow(row: any, folderMap: Map<string, { name: string; path: string }>) {
  const folderInfo = folderMap.get(String(row.folderId)) || {
    name: "",
    path: "",
  };

  return {
    _id: String(row._id),
    folderId: String(row.folderId || ""),
    folderName: safeStr(folderInfo.name),
    folderPath: safeStr(folderInfo.path),

    originalName: safeStr(row.originalName),
    fileName: safeStr(row.fileName),
    fileExt: safeStr(row.fileExt || ".pdf"),
    baseName: safeStr(row.baseName),
    skuNormalized: safeStr(row.skuNormalized),

    titleColor: safeStr(row.titleColor || "red"),
    productExists: Boolean(row.productExists),
    productId: row.productId ? String(row.productId) : "",
    productSku: safeStr(row.productSku),
    productSlug: safeStr(row.productSlug),

    mimeType: safeStr(row.mimeType || "application/pdf"),
    sizeBytes: Number(row.sizeBytes || 0),
    pageCount: Number(row.pageCount || 0),

    uploadedAt: row.uploadedAt || null,
    updatedAt: row.updatedAt || null,
    deletedAt: row.deletedAt || null,
  };
}

async function deleteS3ObjectIfExists(s3Key: string) {
  const key = safeStr(s3Key);
  if (!key || !BUCKET_PRIVATE) return;

  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET_PRIVATE,
      Key: key,
    })
  );
}

async function removeActiveOfficialPaperForSku(skuNormalized: string) {
  const sku = safeStr(skuNormalized).toUpperCase();
  if (!sku) {
    return { deleted: false, fileId: "", s3Key: "" };
  }

  const official: any = await OfficialPaper.findOne({
    skuNormalized: sku,
    deletedAt: null,
  });

  if (!official) {
    return { deleted: false, fileId: "", s3Key: "" };
  }

  const fileId = String(official._id);
  const s3Key = safeStr(official.s3Key);

  await OfficialPaper.deleteOne({ _id: official._id });

  try {
    if (s3Key) {
      await deleteS3ObjectIfExists(s3Key);
    }
  } catch {
    // ignore official paper cleanup failure
  }

  return {
    deleted: true,
    fileId,
    s3Key,
  };
}

export async function GET(req: NextRequest) {
  const guard = await assertVaultAccess();
  if (!guard.ok) return guard.res;

  await dbConnect();
  await ensureRootFolder();

  const url = new URL(req.url);

  const parentPathInput = safeStr(url.searchParams.get("parentPath") || "root");
  const q = safeStr(url.searchParams.get("q"));
  const globalRaw = safeStr(url.searchParams.get("global"));
  const globalSearch = globalRaw === "1" || globalRaw.toLowerCase() === "true";
  const trashRaw = safeStr(url.searchParams.get("trash"));
  const trashMode = trashRaw === "1" || trashRaw.toLowerCase() === "true";

  const page = parsePositiveInt(safeStr(url.searchParams.get("page") || "1"), 1);
  const pageSize = normalizePageSize(safeStr(url.searchParams.get("pageSize") || "25"));

  const sort = buildSort(
    safeStr(url.searchParams.get("sortBy") || "uploadedAt"),
    safeStr(url.searchParams.get("sortDir") || "desc")
  );

  const parentPath = cleanFolderPath(parentPathInput) || "root";

  let currentFolder: any = null;

  if (!globalSearch) {
    currentFolder = await PdfVaultFolder.findOne({
      path: parentPath,
      deletedAt: null,
    }).lean();

    if (!currentFolder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
  }

  const safeRegex = q ? new RegExp(escapeRegex(q), "i") : null;

  const query: any = {};

  if (trashMode) {
    query.deletedAt = { $ne: null };
  } else {
    query.deletedAt = null;
  }

  if (!globalSearch) {
    query.folderId = currentFolder._id;
  }

  if (safeRegex) {
    query.$or = [
      { originalName: safeRegex },
      { fileName: safeRegex },
      { baseName: safeRegex },
      { skuNormalized: safeRegex },
      { productSku: safeRegex },
      { productSlug: safeRegex },
    ];
  }

  const total = await PdfVaultFile.countDocuments(query);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * pageSize;

  const rows: any[] = await PdfVaultFile.find(query)
    .sort(sort)
    .skip(skip)
    .limit(pageSize)
    .lean();

  const folderMap = await getFolderMap(rows);

  return NextResponse.json(
    {
      ok: true,
      parent: globalSearch
        ? null
        : {
            _id: String(currentFolder._id),
            name: safeStr(currentFolder.name),
            path: safeStr(currentFolder.path),
            level: Number(currentFolder.level || 0),
          },
      files: rows.map((row: any) => mapFileRow(row, folderMap)),
      total,
      page: safePage,
      pageSize,
      totalPages,
      global: globalSearch,
      trash: trashMode,
      q,
    },
    { status: 200 }
  );
}

export async function POST(req: NextRequest) {
  const guard = await assertVaultAccess();
  if (!guard.ok) return guard.res;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  await dbConnect();
  await ensureRootFolder();

  const action = safeStr(body?.action).toLowerCase();
  const fileId = safeStr(body?.fileId);

  if (!action) {
    return NextResponse.json({ error: "action required" }, { status: 400 });
  }

  if (!fileId) {
    return NextResponse.json({ error: "fileId required" }, { status: 400 });
  }

  if (action === "restore") {
    const file: any = await PdfVaultFile.findById(fileId);

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (!file.deletedAt) {
      return NextResponse.json(
        { error: "File is not in trash" },
        { status: 400 }
      );
    }

    const existingLive = await PdfVaultFile.findOne({
      _id: { $ne: file._id },
      skuNormalized: safeStr(file.skuNormalized),
      deletedAt: null,
    })
      .select("_id")
      .lean();

    if (existingLive) {
      return NextResponse.json(
        { error: "Another active solved PDF already exists for this SKU" },
        { status: 409 }
      );
    }

    file.deletedAt = null;
    file.updatedAt = new Date();
    file.updatedBy = getUserId(guard.user);

    await file.save();

    const officialPaperCleanup = await removeActiveOfficialPaperForSku(safeStr(file.skuNormalized));
    const syncResult: any = await syncProductAvailabilityBySku(
      safeStr(file.productSku || file.skuNormalized)
    );

    return NextResponse.json(
      {
        ok: true,
        action: "restore",
        message: "File restored successfully",
        fileId: String(file._id),
        officialPaperDeleted: Boolean(officialPaperCleanup.deleted),
        officialPaperDeletedFileId: safeStr(officialPaperCleanup.fileId),
        availabilityAfter: safeStr(syncResult?.after?.availability || ""),
      },
      { status: 200 }
    );
  }

  if (action === "purge") {
    const file: any = await PdfVaultFile.findById(fileId);

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (!file.deletedAt) {
      return NextResponse.json(
        { error: "Only trashed files can be permanently deleted" },
        { status: 400 }
      );
    }

    const skuToSync = safeStr(file.productSku || file.skuNormalized);
    const s3Key = safeStr(file.s3Key);

    await PdfVaultFile.deleteOne({ _id: file._id });

    try {
      await deleteS3ObjectIfExists(s3Key);
    } catch {
      // ignore s3 cleanup failure
    }

    const syncResult: any = await syncProductAvailabilityBySku(skuToSync);

    return NextResponse.json(
      {
        ok: true,
        action: "purge",
        message: "File permanently deleted",
        fileId,
        availabilityAfter: safeStr(syncResult?.after?.availability || ""),
      },
      { status: 200 }
    );
  }

  const file: any = await PdfVaultFile.findById(fileId);
  if (!file || file.deletedAt) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  if (action === "open") {
    const url = await getSecurePdfOpenUrl(safeStr(file.s3Key), 20);
    return NextResponse.json(
      {
        ok: true,
        action: "open",
        url,
        expiresInSeconds: 20,
      },
      { status: 200 }
    );
  }

  if (action === "download") {
    const password = safeStr(body?.password);
    const expected = safeStr(process.env.ADMIN_FILE_DOWNLOAD_PASSWORD);

    if (!expected) {
      return NextResponse.json(
        { error: "ADMIN_FILE_DOWNLOAD_PASSWORD missing in env" },
        { status: 500 }
      );
    }

    if (!password || password !== expected) {
      return NextResponse.json(
        { error: "Invalid download password" },
        { status: 403 }
      );
    }

    const url = await getSecurePdfDownloadUrl(
      safeStr(file.s3Key),
      safeStr(file.fileName || "document.pdf"),
      60
    );

    return NextResponse.json(
      {
        ok: true,
        action: "download",
        url,
        expiresInSeconds: 60,
      },
      { status: 200 }
    );
  }

  if (action === "move") {
    const targetPathInput = safeStr(body?.targetPath);
    const targetPath = cleanFolderPath(targetPathInput);

    if (!targetPath) {
      return NextResponse.json({ error: "targetPath required" }, { status: 400 });
    }

    const targetFolder: any = await PdfVaultFolder.findOne({
      path: targetPath,
      deletedAt: null,
    }).lean();

    if (!targetFolder) {
      return NextResponse.json(
        { error: "Target folder not found" },
        { status: 404 }
      );
    }

    await movePdfVaultFile({
      fileId,
      targetFolderId: String(targetFolder._id),
      movedBy: getUserId(guard.user),
    });

    return NextResponse.json(
      {
        ok: true,
        action: "move",
        message: "File moved successfully",
        fileId,
        targetFolderId: String(targetFolder._id),
        targetPath: safeStr(targetFolder.path),
      },
      { status: 200 }
    );
  }

  if (action === "syncpages") {
    const detectedPages = await detectPdfPagesFromS3Key(safeStr(file.s3Key));

    file.pageCount = Math.max(0, Math.trunc(Number(detectedPages || 0)));
    file.updatedAt = new Date();
    file.updatedBy = getUserId(guard.user);
    await file.save();

    const syncResult: any = await syncProductAvailabilityBySku(
      safeStr(file.productSku || file.skuNormalized)
    );

    return NextResponse.json(
      {
        ok: true,
        action: "syncPages",
        message: "Page count synced successfully",
        fileId: String(file._id),
        skuNormalized: safeStr(file.skuNormalized),
        detectedPages: Number(file.pageCount || 0),
        availabilityAfter: safeStr(syncResult?.after?.availability || ""),
      },
      { status: 200 }
    );
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const guard = await assertVaultAccess();
  if (!guard.ok) return guard.res;

  await dbConnect();
  await ensureRootFolder();

  const url = new URL(req.url);
  const fileId = safeStr(url.searchParams.get("fileId"));

  if (!fileId) {
    return NextResponse.json({ error: "fileId required" }, { status: 400 });
  }

  const file: any = await PdfVaultFile.findById(fileId);

  if (!file || file.deletedAt) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  file.deletedAt = new Date();
  file.updatedAt = new Date();
  file.updatedBy = getUserId(guard.user);

  await file.save();

  const syncResult: any = await syncProductAvailabilityBySku(
    safeStr(file.productSku || file.skuNormalized)
  );

  return NextResponse.json(
    {
      ok: true,
      action: "trash",
      message: "File moved to trash",
      fileId: String(file._id),
      availabilityAfter: safeStr(syncResult?.after?.availability || ""),
    },
    { status: 200 }
  );
}