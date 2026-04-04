import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

import dbConnect from "@/lib/db";
import OfficialPaper from "@/models/OfficialPaper";
import Product from "@/models/Product";
import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  safeStr,
  getSecurePdfDownloadUrl,
  getSecurePdfOpenUrl,
  detectPdfPagesFromS3Key,
  findProductByExactSku,
} from "@/lib/pdfVault";
import {
  getDerivedAvailabilitySnapshotBySku,
  syncProductAvailabilityBySku,
} from "@/lib/productAvailability";

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

function getUserId(user: any) {
  return safeStr(user?.id || user?._id || user?.email || "");
}

function normalizeSkuLike(input: string) {
  return safeStr(input).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function escapeRegex(input: string) {
  return safeStr(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePositiveInt(input: string, fallback: number) {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function normalizePageSize(input: string) {
  const allowed = new Set([25, 50, 100, 200]);
  const n = parsePositiveInt(input, 25);
  return allowed.has(n) ? n : 25;
}

function buildSort(
  sortByRaw: string,
  sortDirRaw: string
): Record<string, 1 | -1> {
  const sortBy = safeStr(sortByRaw || "uploadedAt");
  const sortDir: 1 | -1 =
    safeStr(sortDirRaw || "desc").toLowerCase() === "asc" ? 1 : -1;

  if (sortBy === "name") return { fileName: sortDir, _id: sortDir };
  if (sortBy === "uploadedAt") return { uploadedAt: sortDir, _id: sortDir };
  if (sortBy === "productExists") return { productExists: sortDir, fileName: 1, _id: 1 };
  if (sortBy === "updatedAt") return { updatedAt: sortDir, _id: sortDir };
  if (sortBy === "pageCount") return { pageCount: sortDir, fileName: 1, _id: 1 };

  return { uploadedAt: -1, _id: -1 };
}

function toArrayParam(input: string) {
  return Array.from(
    new Set(
      safeStr(input)
        .split(",")
        .map((x) => safeStr(x))
        .filter(Boolean)
    )
  );
}

function getAvailabilityAfter(syncResult: any) {
  return safeStr(syncResult?.after?.availability || "");
}

async function assertAdminWriteAccess() {
  const user = await getAuthUser();

  if (!user) {
    return {
      ok: false as const,
      res: NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 }),
    };
  }

  if (!hasPermission(user, "products:write")) {
    return {
      ok: false as const,
      res: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, user };
}

function mapProductMeta(product: any) {
  return {
    productCategory: safeStr(product?.category),
    productSubjectCode: safeStr(product?.subjectCode),
    productLanguage: safeStr(product?.language),
    productSession: safeStr(product?.session),
    productCourseCodes: Array.isArray(product?.courseCodes)
      ? product.courseCodes.map((x: any) => safeStr(x)).filter(Boolean)
      : [],
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

export async function GET(req: NextRequest) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  await dbConnect();

  const url = new URL(req.url);

  const q = safeStr(url.searchParams.get("q"));
  const trashRaw = safeStr(url.searchParams.get("trash"));
  const trashMode = trashRaw === "1" || trashRaw.toLowerCase() === "true";

  const categoryFilter = toArrayParam(safeStr(url.searchParams.get("category")));
  const courseCodeFilter = toArrayParam(safeStr(url.searchParams.get("courseCode"))).map((x) =>
    x.toUpperCase()
  );
  const subjectCodeFilter = toArrayParam(safeStr(url.searchParams.get("subjectCode"))).map((x) =>
    x.toUpperCase()
  );
  const languageFilter = toArrayParam(safeStr(url.searchParams.get("language")));

  const page = parsePositiveInt(safeStr(url.searchParams.get("page") || "1"), 1);
  const pageSize = normalizePageSize(safeStr(url.searchParams.get("pageSize") || "25"));

  const sort = buildSort(
    safeStr(url.searchParams.get("sortBy") || "uploadedAt"),
    safeStr(url.searchParams.get("sortDir") || "desc")
  );

  const query: any = {};
  query.deletedAt = trashMode ? { $ne: null } : null;

  if (q) {
    const safeRegex = new RegExp(escapeRegex(q), "i");
    query.$or = [
      { originalName: safeRegex },
      { fileName: safeRegex },
      { baseName: safeRegex },
      { skuNormalized: safeRegex },
      { productSku: safeRegex },
      { productSlug: safeRegex },
    ];
  }

  const hasProductFilters =
    categoryFilter.length > 0 ||
    courseCodeFilter.length > 0 ||
    subjectCodeFilter.length > 0 ||
    languageFilter.length > 0;

  if (hasProductFilters) {
    const productQuery: any = { deletedAt: null };

    if (categoryFilter.length) {
      productQuery.category = { $in: categoryFilter };
    }

    if (courseCodeFilter.length) {
      productQuery.courseCodes = { $in: courseCodeFilter };
    }

    if (subjectCodeFilter.length) {
      productQuery.subjectCode = { $in: subjectCodeFilter };
    }

    if (languageFilter.length) {
      productQuery.language = { $in: languageFilter };
    }

    const matchingProducts: any[] = await Product.find(productQuery)
      .select("_id")
      .lean();

    const productIds = matchingProducts.map((x: any) => x._id);

    if (!productIds.length) {
      return NextResponse.json(
        {
          ok: true,
          files: [],
          total: 0,
          page: 1,
          pageSize,
          totalPages: 1,
          trash: trashMode,
          q,
        },
        { status: 200 }
      );
    }

    query.productId = { $in: productIds };
  }

  const total = await OfficialPaper.countDocuments(query);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * pageSize;

  const rows: any[] = await OfficialPaper.find(query)
    .sort(sort)
    .skip(skip)
    .limit(pageSize)
    .lean();

  const productIds = Array.from(
    new Set(
      rows
        .map((row: any) => safeStr(row?.productId))
        .filter(Boolean)
    )
  );

  const productDocs: any[] = productIds.length
    ? await Product.find({ _id: { $in: productIds } })
        .select("_id category subjectCode language courseCodes session")
        .lean()
    : [];

  const productMap = new Map<string, any>();
  for (const p of productDocs) {
    productMap.set(String(p._id), p);
  }

  return NextResponse.json(
    {
      ok: true,
      files: rows.map((row: any) => {
        const productMeta = mapProductMeta(productMap.get(String(row.productId)));
        return {
          _id: String(row._id),
          skuNormalized: safeStr(row.skuNormalized),

          productExists: Boolean(row.productExists),
          productId: row.productId ? String(row.productId) : "",
          productSku: safeStr(row.productSku),
          productSlug: safeStr(row.productSlug),
          titleColor: safeStr(row.titleColor || "red"),

          originalName: safeStr(row.originalName),
          fileName: safeStr(row.fileName),
          fileExt: safeStr(row.fileExt || ".pdf"),
          baseName: safeStr(row.baseName),

          mimeType: safeStr(row.mimeType || "application/pdf"),
          sizeBytes: Number(row.sizeBytes || 0),
          pageCount: Number(row.pageCount || 0),

          uploadedAt: row.uploadedAt || null,
          updatedAt: row.updatedAt || null,
          deletedAt: row.deletedAt || null,

          ...productMeta,
        };
      }),
      total,
      page: safePage,
      pageSize,
      totalPages,
      trash: trashMode,
      q,
    },
    { status: 200 }
  );
}

export async function POST(req: NextRequest) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  await dbConnect();

  const action = safeStr(body?.action).toLowerCase();
  const fileId = safeStr(body?.fileId);

  if (!action) {
    return NextResponse.json({ ok: false, error: "action required" }, { status: 400 });
  }

  if (!fileId) {
    return NextResponse.json({ ok: false, error: "fileId required" }, { status: 400 });
  }

  const file: any = await OfficialPaper.findById(fileId);
  if (!file) {
    return NextResponse.json({ ok: false, error: "File not found" }, { status: 404 });
  }

  if (action === "restore") {
    if (!file.deletedAt) {
      return NextResponse.json(
        { ok: true, action: "restore", message: "File already active", fileId },
        { status: 200 }
      );
    }

    const existingLive = await OfficialPaper.findOne({
      _id: { $ne: file._id },
      skuNormalized: safeStr(file.skuNormalized),
      deletedAt: null,
    })
      .select("_id")
      .lean();

    if (existingLive) {
      return NextResponse.json(
        { ok: false, error: "Another active official paper already exists for this SKU" },
        { status: 409 }
      );
    }

    const snapshot = await getDerivedAvailabilitySnapshotBySku(
      safeStr(file.skuNormalized)
    );

    if (snapshot?.hasSolvedPdf) {
      return NextResponse.json(
        { ok: false, error: "Solved PDF exists, official paper cannot be restored" },
        { status: 400 }
      );
    }

    file.deletedAt = null;
    file.updatedBy = getUserId(guard.user);
    file.updatedAt = new Date();
    await file.save();

    const syncResult: any = await syncProductAvailabilityBySku(
      safeStr(file.productSku || file.skuNormalized)
    );

    return NextResponse.json(
      {
        ok: true,
        action: "restore",
        message: "Official paper restored",
        fileId: String(file._id),
        availabilityAfter: getAvailabilityAfter(syncResult),
      },
      { status: 200 }
    );
  }

  if (action === "purge") {
    if (!file.deletedAt) {
      return NextResponse.json(
        { ok: false, error: "Only trashed files can be permanently deleted" },
        { status: 400 }
      );
    }

    const skuToSync = safeStr(file.productSku || file.skuNormalized);
    const s3Key = safeStr(file.s3Key);

    await OfficialPaper.deleteOne({ _id: file._id });

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
        message: "Official paper permanently deleted",
        fileId,
        availabilityAfter: getAvailabilityAfter(syncResult),
      },
      { status: 200 }
    );
  }

  if (file.deletedAt) {
    return NextResponse.json({ ok: false, error: "File not found" }, { status: 404 });
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
        { ok: false, error: "ADMIN_FILE_DOWNLOAD_PASSWORD missing in env" },
        { status: 500 }
      );
    }

    if (!password || password !== expected) {
      return NextResponse.json(
        { ok: false, error: "Invalid download password" },
        { status: 403 }
      );
    }

    const url = await getSecurePdfDownloadUrl(
      safeStr(file.s3Key),
      safeStr(file.fileName || "official-paper.pdf"),
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
        action: "syncpages",
        message: "Page count synced successfully",
        fileId: String(file._id),
        detectedPages: Number(file.pageCount || 0),
        availabilityAfter: getAvailabilityAfter(syncResult),
      },
      { status: 200 }
    );
  }

  if (action === "update-meta") {
    const nextSkuNormalized = normalizeSkuLike(body?.skuNormalized);

    if (!nextSkuNormalized) {
      return NextResponse.json(
        { ok: false, error: "Valid SKU required for metadata update" },
        { status: 400 }
      );
    }

    if (nextSkuNormalized !== safeStr(file.skuNormalized)) {
      const existingLive = await OfficialPaper.findOne({
        _id: { $ne: file._id },
        skuNormalized: nextSkuNormalized,
        deletedAt: null,
      })
        .select("_id")
        .lean();

      if (existingLive) {
        return NextResponse.json(
          { ok: false, error: "Another active official paper already exists for this SKU" },
          { status: 409 }
        );
      }
    }

    const oldSku = safeStr(file.skuNormalized);
    const matchedProduct: any = await findProductByExactSku(nextSkuNormalized);

    file.skuNormalized = nextSkuNormalized;
    file.productId = matchedProduct?._id || null;
    file.productSku = safeStr(matchedProduct?.sku);
    file.productSlug = safeStr(matchedProduct?.slug);
    file.productExists = Boolean(matchedProduct);
    file.titleColor = matchedProduct ? "green" : "red";
    file.updatedBy = getUserId(guard.user);
    file.updatedAt = new Date();

    await file.save();

    const oldSync: any = oldSku ? await syncProductAvailabilityBySku(oldSku) : null;
    const newSync: any = await syncProductAvailabilityBySku(nextSkuNormalized);

    return NextResponse.json(
      {
        ok: true,
        action: "update-meta",
        message: "Official paper metadata updated",
        fileId: String(file._id),
        oldSku,
        newSku: safeStr(file.skuNormalized),
        oldAvailabilityAfter: getAvailabilityAfter(oldSync),
        newAvailabilityAfter: getAvailabilityAfter(newSync),
      },
      { status: 200 }
    );
  }

  return NextResponse.json({ ok: false, error: "Unsupported action" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  await dbConnect();

  const url = new URL(req.url);
  const fileId = safeStr(url.searchParams.get("fileId"));

  if (!fileId) {
    return NextResponse.json({ ok: false, error: "fileId required" }, { status: 400 });
  }

  const file: any = await OfficialPaper.findById(fileId);
  if (!file || file.deletedAt) {
    return NextResponse.json({ ok: false, error: "File not found" }, { status: 404 });
  }

  file.deletedAt = new Date();
  file.updatedBy = getUserId(guard.user);
  file.updatedAt = new Date();
  await file.save();

  const syncResult: any = await syncProductAvailabilityBySku(
    safeStr(file.productSku || file.skuNormalized)
  );

  return NextResponse.json(
    {
      ok: true,
      action: "trash",
      message: "Official paper moved to trash",
      fileId: String(file._id),
      availabilityAfter: getAvailabilityAfter(syncResult),
    },
    { status: 200 }
  );
}
