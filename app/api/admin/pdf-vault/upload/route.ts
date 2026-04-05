import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

import dbConnect from "@/lib/db";
import PdfVaultFolder from "@/models/PdfVaultFolder";
import PdfVaultFile from "@/models/PdfVaultFile";
import OfficialPaper from "@/models/OfficialPaper";
import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  cleanFolderPath,
  detectPdfPagesFromS3Key,
  ensureRootFolder,
  fileBaseName,
  fileExt,
  findProductByExactSku,
  getPdfPageCountFromBuffer,
  hasPdfVaultPageAccess,
  PDF_VAULT_DIRECT_UPLOAD_MAX_BYTES,
  safeStr,
  uploadPdfBufferToS3,
} from "@/lib/pdfVault";
import { syncProductAvailabilityBySku } from "@/lib/productAvailability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

type ConflictMode = "ignore" | "replace";

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function normalizeSkuLike(input: string) {
  return safeStr(input).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function cleanBaseFileName(name: string) {
  return safeStr(name).split(/[\\/]/).pop() || "";
}

function isPdfFileName(name: string) {
  return cleanBaseFileName(name).toLowerCase().endsWith(".pdf");
}

function isProbablyPdfBuffer(buf: Buffer) {
  if (!buf || !buf.length) return false;
  const header = buf.subarray(0, Math.min(buf.length, 16)).toString("latin1");
  return header.includes("%PDF");
}

function getUserId(user: any) {
  return safeStr(user?.id || user?._id || user?.email || "");
}

async function assertVaultWriteAccess() {
  const user = await getAuthUser();

  if (!user) {
    return {
      ok: false as const,
      res: NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      ),
    };
  }

  if (!hasPermission(user, "products:write")) {
    return {
      ok: false as const,
      res: NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
      ),
    };
  }

  const allowed = await hasPdfVaultPageAccess(user.id);
  if (!allowed) {
    return {
      ok: false as const,
      res: NextResponse.json(
        { ok: false, error: "Vault access expired", needsPuzzle: true },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, user };
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
  const sku = normalizeSkuLike(skuNormalized);
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
    // ignore official cleanup failure
  }

  return {
    deleted: true,
    fileId,
    s3Key,
  };
}

async function detectPageCountStrong(pdfBuffer: Buffer, s3Key: string) {
  let pageCount = 0;

  try {
    pageCount = Math.max(
      0,
      Math.trunc(Number((await getPdfPageCountFromBuffer(pdfBuffer)) || 0))
    );
  } catch {
    pageCount = 0;
  }

  if (pageCount > 0) {
    return pageCount;
  }

  try {
    pageCount = Math.max(
      0,
      Math.trunc(Number((await detectPdfPagesFromS3Key(safeStr(s3Key))) || 0))
    );
  } catch {
    pageCount = 0;
  }

  return pageCount;
}

async function findExistingLiveSolvedPdfBySku(skuNormalized: string) {
  const sku = normalizeSkuLike(skuNormalized);
  if (!sku) return null;

  const row: any = await PdfVaultFile.findOne({
    skuNormalized: sku,
    deletedAt: null,
  });

  return row || null;
}

export async function POST(req: NextRequest) {
  const guard = await assertVaultWriteAccess();
  if (!guard.ok) return guard.res;

  const contentType = safeStr(req.headers.get("content-type")).toLowerCase();
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { ok: false, error: "Only multipart/form-data is supported" },
      { status: 400 }
    );
  }

  try {
    await dbConnect();
    await ensureRootFolder();

    const formData = await req.formData();

    const fileEntry =
      formData.get("file") ||
      formData.get("pdf") ||
      formData.getAll("files")[0] ||
      null;

    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "PDF file required" },
        { status: 400 }
      );
    }

    const conflictModeRaw = safeStr(formData.get("conflictMode")).toLowerCase();
    const conflictMode: ConflictMode =
      conflictModeRaw === "replace" ? "replace" : "ignore";

    const parentPathInput = safeStr(formData.get("parentPath") || "root");
    const parentPath = cleanFolderPath(parentPathInput) || "root";

    const targetFolder: any = await PdfVaultFolder.findOne({
      path: parentPath,
      deletedAt: null,
    })
      .select("_id path name")
      .lean();

    if (!targetFolder) {
      return NextResponse.json(
        { ok: false, error: "Target folder not found" },
        { status: 404 }
      );
    }

    const originalName = cleanBaseFileName(fileEntry.name);
    if (!originalName) {
      return NextResponse.json(
        { ok: false, error: "File name missing" },
        { status: 400 }
      );
    }

    if (!isPdfFileName(originalName)) {
      return NextResponse.json(
        { ok: false, error: "Only PDF files allowed" },
        { status: 400 }
      );
    }

    const sizeBytes = Math.max(0, Math.trunc(Number(fileEntry.size || 0)));
    if (!sizeBytes) {
      return NextResponse.json(
        { ok: false, error: "Empty PDF file" },
        { status: 400 }
      );
    }

    if (sizeBytes > PDF_VAULT_DIRECT_UPLOAD_MAX_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: `File exceeds max allowed size of ${PDF_VAULT_DIRECT_UPLOAD_MAX_BYTES} bytes`,
          maxFileBytes: PDF_VAULT_DIRECT_UPLOAD_MAX_BYTES,
        },
        { status: 400 }
      );
    }

    const baseName = safeStr(fileBaseName(originalName));
    const skuNormalized = normalizeSkuLike(baseName);

    if (!skuNormalized) {
      return NextResponse.json(
        { ok: false, error: "SKU could not be parsed from filename" },
        { status: 400 }
      );
    }

    const existingLive: any = await findExistingLiveSolvedPdfBySku(skuNormalized);

    if (existingLive && conflictMode === "ignore") {
      return NextResponse.json(
        {
          ok: true,
          status: "skipped",
          message: "Solved PDF already exists for this SKU",
          fileName: originalName,
          skuNormalized,
          fileId: String(existingLive._id),
          counts: {
            total: 1,
            uploaded: 0,
            replaced: 0,
            skipped: 1,
            failed: 0,
            done: 1,
          },
        },
        { status: 200 }
      );
    }

    const pdfBuffer = Buffer.from(await fileEntry.arrayBuffer());

    if (!pdfBuffer?.length) {
      return NextResponse.json(
        { ok: false, error: "Empty PDF buffer" },
        { status: 400 }
      );
    }

    if (!isProbablyPdfBuffer(pdfBuffer)) {
      return NextResponse.json(
        { ok: false, error: "Uploaded file is not a valid PDF binary" },
        { status: 400 }
      );
    }

    const sha256 = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

    const uploaded = await uploadPdfBufferToS3({
      folderPath: parentPath,
      originalName,
      bytes: pdfBuffer,
      mimeType: "application/pdf",
    });

    const newBucket = safeStr(uploaded.bucket);
    const newKey = safeStr(uploaded.key);

    if (!newKey) {
      return NextResponse.json(
        { ok: false, error: "S3 upload failed: key missing" },
        { status: 500 }
      );
    }

    try {
      const matchedProduct: any = await findProductByExactSku(skuNormalized);
      const detectedPages = await detectPageCountStrong(pdfBuffer, newKey);
      const now = new Date();
      const userId = getUserId(guard.user);

      let savedFile: any = null;
      let actionStatus: "uploaded" | "replaced" = "uploaded";
      let oldS3Key = "";

      if (existingLive && conflictMode === "replace") {
        oldS3Key = safeStr(existingLive.s3Key);

        existingLive.folderId = targetFolder._id;
        existingLive.originalName = originalName;
        existingLive.fileName = originalName;
        existingLive.fileExt = fileExt(originalName) || ".pdf";
        existingLive.baseName = baseName;
        existingLive.skuNormalized = skuNormalized;

        existingLive.titleColor = matchedProduct ? "green" : "red";
        existingLive.productExists = Boolean(matchedProduct);
        existingLive.productId = matchedProduct?._id || null;
        existingLive.productSku = safeStr(matchedProduct?.sku);
        existingLive.productSlug = safeStr(matchedProduct?.slug);

        existingLive.s3Bucket = newBucket;
        existingLive.s3Key = newKey;
        existingLive.mimeType = "application/pdf";
        existingLive.sizeBytes = sizeBytes;
        existingLive.pageCount = Math.max(0, Math.trunc(Number(detectedPages || 0)));
        existingLive.sha256 = sha256;

        existingLive.uploadedAt = now;
        existingLive.uploadedBy = userId;
        existingLive.updatedAt = now;
        existingLive.updatedBy = userId;
        existingLive.deletedAt = null;

        await existingLive.save();
        savedFile = existingLive;
        actionStatus = "replaced";
      } else {
        savedFile = await PdfVaultFile.create({
          folderId: targetFolder._id,
          originalName,
          fileName: originalName,
          fileExt: fileExt(originalName) || ".pdf",
          baseName,
          skuNormalized,

          titleColor: matchedProduct ? "green" : "red",
          productExists: Boolean(matchedProduct),
          productId: matchedProduct?._id || null,
          productSku: safeStr(matchedProduct?.sku),
          productSlug: safeStr(matchedProduct?.slug),

          s3Bucket: newBucket,
          s3Key: newKey,
          mimeType: "application/pdf",
          sizeBytes,
          pageCount: Math.max(0, Math.trunc(Number(detectedPages || 0))),
          sha256,

          uploadedAt: now,
          uploadedBy: userId,
          updatedBy: userId,
          deletedAt: null,
        });

        actionStatus = "uploaded";
      }

      if (oldS3Key && oldS3Key !== newKey) {
        try {
          await deleteS3ObjectIfExists(oldS3Key);
        } catch {
          // ignore old solved pdf cleanup failure
        }
      }

      const officialPaperCleanup = await removeActiveOfficialPaperForSku(skuNormalized);
      const syncResult: any = await syncProductAvailabilityBySku(
        safeStr(matchedProduct?.sku || skuNormalized)
      );

      return NextResponse.json(
        {
          ok: true,
          status: actionStatus,
          message:
            actionStatus === "replaced"
              ? "Solved PDF replaced successfully"
              : "Solved PDF uploaded successfully",
          fileName: originalName,
          skuNormalized,
          fileId: String(savedFile._id),
          pageCount: Math.max(0, Math.trunc(Number(savedFile.pageCount || 0))),
          officialPaperDeleted: Boolean(officialPaperCleanup.deleted),
          availabilityAfter: safeStr(syncResult?.after?.availability || ""),
          counts: {
            total: 1,
            uploaded: actionStatus === "uploaded" ? 1 : 0,
            replaced: actionStatus === "replaced" ? 1 : 0,
            skipped: 0,
            failed: 0,
            done: 1,
          },
        },
        { status: 200 }
      );
    } catch (error: any) {
      try {
        await deleteS3ObjectIfExists(newKey);
      } catch {
        // ignore cleanup failure
      }

      return NextResponse.json(
        {
          ok: false,
          error: safeStr(error?.message || "Failed to finalize solved PDF upload"),
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message || "Failed to upload solved PDF"),
      },
      { status: 500 }
    );
  }
}
