import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

import dbConnect from "@/lib/db";
import PdfVaultFolder from "@/models/PdfVaultFolder";
import PdfVaultFile from "@/models/PdfVaultFile";
import Order from "@/models/Order";
import Product from "@/models/Product";
import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  cleanFolderPath,
  createDirectPdfUploadUrl,
  createPdfVaultFileRecord,
  ensureRootFolder,
  fileExt,
  normalizeSkuLike,
  safeStr,
  uploadPdfBufferToS3,
} from "@/lib/pdfVault";
import { sendOnDemandReadyEmail } from "@/lib/orderNotifications";

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

type UploadResult = {
  ok: boolean;
  fileName: string;
  action: "uploaded" | "replaced" | "ignored" | "failed" | "skipped";
  reason?: string;
  skuNormalized?: string;
  fileId?: string;
  productMatched?: boolean;
  productId?: string;
  productSku?: string;
  productSlug?: string;
  existingFileId?: string;
  existingFolderId?: string;
  existingDuplicatesCount?: number;
  replacedDuplicatesCount?: number;
  detectedPages?: number;
};

function getUserId(user: any) {
  return safeStr(user?.id || user?._id || user?.email || "");
}

function isJsonRequest(req: NextRequest) {
  const contentType = safeStr(req.headers.get("content-type")).toLowerCase();
  return contentType.includes("application/json");
}

function uniqueNonEmptyStrings(values: any[]) {
  return Array.from(new Set(values.map((x) => safeStr(x)).filter(Boolean)));
}

async function deleteS3ObjectIfExists(s3Key: string) {
  const key = safeStr(s3Key);
  if (!key) return;

  if (!BUCKET_PRIVATE) {
    throw new Error("AWS_S3_BUCKET_PRIVATE missing");
  }

  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET_PRIVATE,
      Key: key,
    })
  );
}

async function findFolderByPath(parentPathInput: string) {
  const parentPath = cleanFolderPath(parentPathInput) || "root";

  const folder: any = await PdfVaultFolder.findOne({
    path: parentPath,
    deletedAt: null,
  });

  return {
    folder,
    parentPath,
  };
}

async function findActiveDuplicatesBySku(skuNormalized: string) {
  const sku = safeStr(skuNormalized);
  if (!sku) return [];

  const rows: any[] = await PdfVaultFile.find({
    skuNormalized: sku,
    deletedAt: null,
  })
    .select({
      _id: 1,
      folderId: 1,
      s3Key: 1,
      skuNormalized: 1,
      fileName: 1,
      originalName: 1,
      uploadedAt: 1,
      updatedAt: 1,
      deletedAt: 1,
    })
    .sort({ uploadedAt: -1, _id: -1 })
    .lean();

  return rows;
}

async function softDeleteDuplicateRows(rows: any[]) {
  const duplicateIds = rows
    .map((x: any) => x?._id)
    .filter(Boolean);

  if (!duplicateIds.length) return;

  await PdfVaultFile.updateMany(
    { _id: { $in: duplicateIds } },
    {
      $set: {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    }
  );
}

async function restoreSoftDeletedDuplicateRows(rows: any[]) {
  const duplicateIds = rows
    .map((x: any) => x?._id)
    .filter(Boolean);

  if (!duplicateIds.length) return;

  await PdfVaultFile.updateMany(
    { _id: { $in: duplicateIds } },
    {
      $set: {
        deletedAt: null,
        updatedAt: new Date(),
      },
    }
  );
}

async function notifyReadyForPaidOnDemandOrders(productId: string) {
  const pid = safeStr(productId);
  if (!pid) return;

  await dbConnect();

  const product: any = await Product.findById(pid)
    .select("availability title")
    .lean();

  if (!product) return;

  const now = new Date();

  const paidOrders: any[] = await Order.find({
    status: "paid",
    expiresAt: { $gt: now },
    "items.productId": pid,
  })
    .select("_id userId userEmail items paidAt expiresAt")
    .lean();

  if (!paidOrders.length) return;

  await Promise.allSettled(
    paidOrders.map(async (order: any) => {
      await sendOnDemandReadyEmail({
        orderId: String(order._id),
        userId: String(order.userId || ""),
        productId: pid,
      });
    })
  );
}

function buildSummary(results: UploadResult[]) {
  return {
    total: results.length,
    uploaded: results.filter((x) => x.action === "uploaded").length,
    replaced: results.filter((x) => x.action === "replaced").length,
    ignored: results.filter((x) => x.action === "ignored").length,
    failed: results.filter((x) => x.action === "failed").length,
    skipped: results.filter((x) => x.action === "skipped").length,
    matchedProducts: results.filter((x) => x.productMatched).length,
  };
}

function firstFailureReason(results: UploadResult[]) {
  return (
    results.find((x) => !x.ok)?.reason ||
    results.find((x) => x.action === "failed" || x.action === "skipped")?.reason ||
    "Upload failed"
  );
}

function buildUploadResponse(args: {
  parentPath: string;
  conflictMode: string;
  results: UploadResult[];
}) {
  const summary = buildSummary(args.results);
  const ok = summary.failed === 0 && summary.skipped === 0;
  const status = ok ? 200 : 400;

  return NextResponse.json(
    {
      ok,
      parentPath: args.parentPath,
      conflictMode: args.conflictMode,
      summary,
      results: args.results,
      error: ok ? "" : firstFailureReason(args.results),
    },
    { status }
  );
}

async function finalizeUploadedPdf(args: {
  folderId: string;
  parentPath: string;
  conflictMode: "ignore" | "replace";
  productSku: string;
  uploadedBucket: string;
  uploadedKey: string;
  sizeBytes: number;
  sha256?: string;
  uploadedBy: string;
}) {
  const productSku = normalizeSkuLike(args.productSku);
  const finalOriginalName = `${productSku}.pdf`;

  const activeDuplicates: any[] = await findActiveDuplicatesBySku(productSku);
  const primaryDuplicate = activeDuplicates.length ? activeDuplicates[0] : null;

  if (activeDuplicates.length && args.conflictMode === "ignore") {
    try {
      await deleteS3ObjectIfExists(args.uploadedKey);
    } catch {
      // ignore cleanup failure
    }

    return {
      ok: true,
      fileName: finalOriginalName,
      action: "ignored" as const,
      reason: "Duplicate SKU already exists",
      skuNormalized: productSku,
      existingFileId: String(primaryDuplicate?._id || ""),
      existingFolderId: String(primaryDuplicate?.folderId || ""),
      existingDuplicatesCount: activeDuplicates.length,
    };
  }

  let duplicatesSoftDeleted = false;

  try {
    if (activeDuplicates.length && args.conflictMode === "replace") {
      await softDeleteDuplicateRows(activeDuplicates);
      duplicatesSoftDeleted = true;
    }

    const created = await createPdfVaultFileRecord({
      folderId: args.folderId,
      originalName: finalOriginalName,
      s3Bucket: args.uploadedBucket,
      s3Key: args.uploadedKey,
      mimeType: "application/pdf",
      sizeBytes: args.sizeBytes,
      sha256: safeStr(args.sha256),
      uploadedBy: safeStr(args.uploadedBy),
    });

    if (
      activeDuplicates.length &&
      args.conflictMode === "replace" &&
      created?.file?._id &&
      primaryDuplicate?._id
    ) {
      await PdfVaultFile.updateOne(
        { _id: created.file._id },
        {
          $set: {
            replaceSourceFileId: primaryDuplicate._id,
          },
        }
      );
    }

    if (activeDuplicates.length && args.conflictMode === "replace") {
      const staleKeys = uniqueNonEmptyStrings(
        activeDuplicates.map((x: any) => x?.s3Key)
      ).filter((key) => key !== safeStr(args.uploadedKey));

      for (const staleKey of staleKeys) {
        try {
          await deleteS3ObjectIfExists(staleKey);
        } catch {
          // ignore cleanup failure
        }
      }
    }

    if (created?.attachResult?.matched && created?.attachResult?.productId) {
      try {
        await notifyReadyForPaidOnDemandOrders(String(created.attachResult.productId));
      } catch (err) {
        console.error("ON_DEMAND_READY_EMAIL_NOTIFY_FAILED:", err);
      }
    }

    return {
      ok: true,
      fileName: finalOriginalName,
      action:
        activeDuplicates.length && args.conflictMode === "replace"
          ? ("replaced" as const)
          : ("uploaded" as const),
      skuNormalized: productSku,
      fileId: String(created.file?._id || ""),
      productMatched: Boolean(created.productMatched),
      productId: safeStr(created.attachResult?.productId || ""),
      productSku: safeStr(created.attachResult?.productSku || ""),
      productSlug: safeStr(created.attachResult?.productSlug || ""),
      replacedDuplicatesCount:
        activeDuplicates.length && args.conflictMode === "replace"
          ? activeDuplicates.length
          : 0,
      detectedPages: Number(
        created.detectedPages || created.attachResult?.detectedPages || 0
      ),
    };
  } catch (err) {
    if (duplicatesSoftDeleted) {
      try {
        await restoreSoftDeletedDuplicateRows(activeDuplicates);
      } catch (restoreErr) {
        console.error("ON_DEMAND_DUPLICATE_RESTORE_FAILED:", restoreErr);
      }
    }

    try {
      await deleteS3ObjectIfExists(args.uploadedKey);
    } catch {
      // ignore cleanup failure
    }

    throw err;
  }
}

async function handleDirectUploadPrepare(req: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();
  await ensureRootFolder();

  const body = await req.json().catch(() => ({}));
  const action = safeStr(body?.action).toLowerCase();

  if (action !== "create-presigned-upload") {
    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
  }

  const conflictMode = safeStr(body?.conflictMode || "replace").toLowerCase() === "ignore"
    ? "ignore"
    : "replace";

  const productSku = normalizeSkuLike(body?.productSku || "");
  const originalClientFileName = safeStr(body?.fileName || "");
  const mimeType = safeStr(body?.fileType || "application/pdf") || "application/pdf";
  const sizeBytes = Math.max(0, Number(body?.sizeBytes || 0));

  if (!productSku) {
    return NextResponse.json({ ok: false, error: "productSku required" }, { status: 400 });
  }

  if (!originalClientFileName) {
    return NextResponse.json({ ok: false, error: "fileName required" }, { status: 400 });
  }

  if (fileExt(originalClientFileName) !== ".pdf") {
    return NextResponse.json({ ok: false, error: "Only PDF files allowed" }, { status: 400 });
  }

  if (!sizeBytes) {
    return NextResponse.json({ ok: false, error: "sizeBytes required" }, { status: 400 });
  }

  const { folder, parentPath } = await findFolderByPath(body?.parentPath || "root");

  if (!folder) {
    return NextResponse.json({ ok: false, error: "Folder not found" }, { status: 404 });
  }

  const activeDuplicates = await findActiveDuplicatesBySku(productSku);
  const primaryDuplicate = activeDuplicates.length ? activeDuplicates[0] : null;

  if (activeDuplicates.length && conflictMode === "ignore") {
    return NextResponse.json(
      {
        ok: true,
        mode: "direct-upload-skipped",
        parentPath,
        conflictMode,
        summary: {
          total: 1,
          uploaded: 0,
          replaced: 0,
          ignored: 1,
          failed: 0,
          skipped: 0,
          matchedProducts: 0,
        },
        results: [
          {
            ok: true,
            fileName: `${productSku}.pdf`,
            action: "ignored",
            reason: "Duplicate SKU already exists",
            skuNormalized: productSku,
            existingFileId: String(primaryDuplicate?._id || ""),
            existingFolderId: String(primaryDuplicate?.folderId || ""),
            existingDuplicatesCount: activeDuplicates.length,
          },
        ],
      },
      { status: 200 }
    );
  }

  const presigned = await createDirectPdfUploadUrl({
    folderPath: parentPath,
    originalName: `${productSku}.pdf`,
    mimeType,
    sizeBytes,
  });

  return NextResponse.json(
    {
      ok: true,
      mode: "direct-upload-ready",
      parentPath,
      conflictMode,
      productSku,
      fileName: `${productSku}.pdf`,
      upload: {
        method: "PUT",
        url: presigned.uploadUrl,
        contentType: presigned.contentType,
        bucket: presigned.bucket,
        key: presigned.key,
        sizeBytes: presigned.sizeBytes,
        expiresIn: presigned.expiresIn,
      },
    },
    { status: 200 }
  );
}

async function handleDirectUploadFinalize(req: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();
  await ensureRootFolder();

  const body = await req.json().catch(() => ({}));
  const action = safeStr(body?.action).toLowerCase();

  if (action !== "finalize-direct-upload") {
    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
  }

  const conflictMode = safeStr(body?.conflictMode || "replace").toLowerCase() === "ignore"
    ? "ignore"
    : "replace";

  const productSku = normalizeSkuLike(body?.productSku || "");
  const uploadedBucket = safeStr(body?.s3Bucket || "");
  const uploadedKey = safeStr(body?.s3Key || "");
  const sizeBytes = Math.max(0, Number(body?.sizeBytes || 0));
  const sha256 = safeStr(body?.sha256 || "");

  if (!productSku) {
    return NextResponse.json({ ok: false, error: "productSku required" }, { status: 400 });
  }

  if (!uploadedBucket || uploadedBucket !== BUCKET_PRIVATE) {
    return NextResponse.json(
      { ok: false, error: "Invalid upload bucket" },
      { status: 400 }
    );
  }

  if (!uploadedKey || !uploadedKey.startsWith("vault/pdfs/")) {
    return NextResponse.json(
      { ok: false, error: "Invalid uploaded file key" },
      { status: 400 }
    );
  }

  if (!sizeBytes) {
    return NextResponse.json({ ok: false, error: "sizeBytes required" }, { status: 400 });
  }

  const { folder, parentPath } = await findFolderByPath(body?.parentPath || "root");

  if (!folder) {
    return NextResponse.json({ ok: false, error: "Folder not found" }, { status: 404 });
  }

  try {
    const result = await finalizeUploadedPdf({
      folderId: String(folder._id),
      parentPath,
      conflictMode,
      productSku,
      uploadedBucket,
      uploadedKey,
      sizeBytes,
      sha256,
      uploadedBy: getUserId(user),
    });

    return buildUploadResponse({
      parentPath,
      conflictMode,
      results: [result],
    });
  } catch (err: any) {
    return buildUploadResponse({
      parentPath,
      conflictMode,
      results: [
        {
          ok: false,
          fileName: `${productSku}.pdf`,
          action: "failed",
          reason: safeStr(err?.message || "Upload finalization failed"),
        },
      ],
    });
  }
}

async function handleMultipartUpload(req: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();
  await ensureRootFolder();

  const form = await req.formData();

  const parentPathInput = safeStr(form.get("parentPath") || "root");
  const conflictMode = safeStr(form.get("conflictMode") || "replace").toLowerCase() === "ignore"
    ? "ignore"
    : "replace";
  const productSkuInput = safeStr(form.get("productSku") || "");
  const productSku = normalizeSkuLike(productSkuInput);

  if (!productSku) {
    return NextResponse.json({ ok: false, error: "productSku required" }, { status: 400 });
  }

  const { folder, parentPath } = await findFolderByPath(parentPathInput);

  if (!folder) {
    return NextResponse.json({ ok: false, error: "Folder not found" }, { status: 404 });
  }

  const allEntries = form.getAll("files");
  const files = allEntries.filter((x) => x instanceof File) as File[];

  if (!files.length) {
    return NextResponse.json(
      { ok: false, error: "At least one PDF file is required" },
      { status: 400 }
    );
  }

  const results: UploadResult[] = [];

  for (const file of files.slice(0, 1)) {
    const originalUploadName = safeStr(file.name);
    const finalOriginalName = `${productSku}.pdf`;

    try {
      if (!originalUploadName) {
        results.push({
          ok: false,
          fileName: "",
          action: "skipped",
          reason: "Empty file name",
        });
        continue;
      }

      const ext = fileExt(originalUploadName);
      if (ext !== ".pdf") {
        results.push({
          ok: false,
          fileName: originalUploadName,
          action: "skipped",
          reason: "Only PDF files allowed",
        });
        continue;
      }

      const activeDuplicates: any[] = await findActiveDuplicatesBySku(productSku);
      const primaryDuplicate = activeDuplicates.length ? activeDuplicates[0] : null;

      if (activeDuplicates.length && conflictMode === "ignore") {
        results.push({
          ok: true,
          fileName: finalOriginalName,
          action: "ignored",
          reason: "Duplicate SKU already exists",
          skuNormalized: productSku,
          existingFileId: String(primaryDuplicate?._id || ""),
          existingFolderId: String(primaryDuplicate?.folderId || ""),
          existingDuplicatesCount: activeDuplicates.length,
        });
        continue;
      }

      const bytes = Buffer.from(await file.arrayBuffer());
      const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");

      const uploaded = await uploadPdfBufferToS3({
        folderPath: parentPath,
        originalName: finalOriginalName,
        bytes,
        mimeType: "application/pdf",
      });

      const result = await finalizeUploadedPdf({
        folderId: String(folder._id),
        parentPath,
        conflictMode,
        productSku,
        uploadedBucket: uploaded.bucket,
        uploadedKey: uploaded.key,
        sizeBytes: bytes.length,
        sha256,
        uploadedBy: getUserId(user),
      });

      results.push(result);
    } catch (err: any) {
      results.push({
        ok: false,
        fileName: finalOriginalName,
        action: "failed",
        reason: safeStr(err?.message || "Upload failed"),
      });
    }
  }

  return buildUploadResponse({
    parentPath,
    conflictMode,
    results,
  });
}

export async function POST(req: NextRequest) {
  try {
    if (isJsonRequest(req)) {
      const cloned = req.clone();
      const body = await cloned.json().catch(() => ({}));
      const action = safeStr(body?.action).toLowerCase();

      if (action === "create-presigned-upload") {
        return handleDirectUploadPrepare(req);
      }

      if (action === "finalize-direct-upload") {
        return handleDirectUploadFinalize(req);
      }

      return NextResponse.json(
        { ok: false, error: "Invalid JSON action" },
        { status: 400 }
      );
    }

    return handleMultipartUpload(req);
  } catch (err: any) {
    console.error("ON_DEMAND_UPLOAD_ROUTE_FAILED:", err);

    return NextResponse.json(
      {
        ok: false,
        error: safeStr(err?.message || "Upload failed"),
      },
      { status: 500 }
    );
  }
}