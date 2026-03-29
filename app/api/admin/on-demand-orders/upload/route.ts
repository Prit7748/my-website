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
  ensureRootFolder,
  fileExt,
  normalizeSkuLike,
  safeStr,
  uploadPdfBufferToS3,
  createPdfVaultFileRecord,
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

function getUserId(user: any) {
  return safeStr(user?.id || user?._id || user?.email || "");
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

function uniqueNonEmptyStrings(values: any[]) {
  return Array.from(new Set(values.map((x) => safeStr(x)).filter(Boolean)));
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
    })
    .sort({ uploadedAt: -1, _id: -1 })
    .lean();

  return rows;
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

export async function POST(req: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();
  await ensureRootFolder();

  const form = await req.formData();

  const parentPathInput = safeStr(form.get("parentPath") || "root");
  const conflictMode = safeStr(form.get("conflictMode") || "replace").toLowerCase();
  const productSkuInput = safeStr(form.get("productSku") || "");
  const parentPath = cleanFolderPath(parentPathInput) || "root";
  const productSku = normalizeSkuLike(productSkuInput);

  if (!productSku) {
    return NextResponse.json({ error: "productSku required" }, { status: 400 });
  }

  const folder: any = await PdfVaultFolder.findOne({
    path: parentPath,
    deletedAt: null,
  });

  if (!folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const allEntries = form.getAll("files");
  const files = allEntries.filter((x) => x instanceof File) as File[];

  if (!files.length) {
    return NextResponse.json({ error: "At least one PDF file is required" }, { status: 400 });
  }

  const results: any[] = [];

  for (const file of files.slice(0, 1)) {
    const originalUploadName = safeStr(file.name);

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

      const finalOriginalName = `${productSku}.pdf`;
      const bytes = Buffer.from(await file.arrayBuffer());
      const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");

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

      const uploaded = await uploadPdfBufferToS3({
        folderPath: parentPath,
        originalName: finalOriginalName,
        bytes,
        mimeType: "application/pdf",
      });

      if (activeDuplicates.length && conflictMode === "replace") {
        const duplicateIds = activeDuplicates.map((x: any) => x._id);

        await PdfVaultFile.deleteMany({
          _id: { $in: duplicateIds },
        });
      }

      const created = await createPdfVaultFileRecord({
        folderId: String(folder._id),
        originalName: finalOriginalName,
        s3Bucket: uploaded.bucket,
        s3Key: uploaded.key,
        mimeType: "application/pdf",
        sizeBytes: bytes.length,
        sha256,
        uploadedBy: getUserId(user),
      });

      if (
        activeDuplicates.length &&
        conflictMode === "replace" &&
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

      if (activeDuplicates.length && conflictMode === "replace") {
        const staleKeys = uniqueNonEmptyStrings(
          activeDuplicates.map((x: any) => x?.s3Key)
        ).filter((key) => key !== safeStr(uploaded.key));

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

      results.push({
        ok: true,
        fileName: finalOriginalName,
        action: activeDuplicates.length && conflictMode === "replace" ? "replaced" : "uploaded",
        skuNormalized: productSku,
        fileId: String(created.file?._id || ""),
        productMatched: Boolean(created.productMatched),
        productId: safeStr(created.attachResult?.productId || ""),
        productSku: safeStr(created.attachResult?.productSku || ""),
        productSlug: safeStr(created.attachResult?.productSlug || ""),
        replacedDuplicatesCount:
          activeDuplicates.length && conflictMode === "replace" ? activeDuplicates.length : 0,
        detectedPages: Number(
          created.detectedPages || created.attachResult?.detectedPages || 0
        ),
      });
    } catch (err: any) {
      results.push({
        ok: false,
        fileName: `${productSku}.pdf`,
        action: "failed",
        reason: safeStr(err?.message || "Upload failed"),
      });
    }
  }

  const summary = {
    total: results.length,
    uploaded: results.filter((x) => x.action === "uploaded").length,
    replaced: results.filter((x) => x.action === "replaced").length,
    ignored: results.filter((x) => x.action === "ignored").length,
    failed: results.filter((x) => x.action === "failed").length,
    skipped: results.filter((x) => x.action === "skipped").length,
    matchedProducts: results.filter((x) => x.productMatched).length,
  };

  return NextResponse.json(
    {
      ok: true,
      parentPath,
      conflictMode,
      summary,
      results,
    },
    { status: 200 }
  );
}