import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

import dbConnect from "@/lib/db";
import OfficialPaper from "@/models/OfficialPaper";
import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  safeStr,
  fileBaseName,
  fileExt,
  normalizeSkuLike,
  uploadPdfBufferToS3,
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

async function assertAdminWriteAccess() {
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

async function findActiveOfficialPaperBySku(skuNormalized: string) {
  const sku = safeStr(skuNormalized).toUpperCase();
  if (!sku) return null;

  const row: any = await OfficialPaper.findOne({
    skuNormalized: sku,
    deletedAt: null,
  }).sort({ uploadedAt: -1, _id: -1 });

  return row || null;
}

function getAvailabilityAfter(syncResult: any, fallback = "") {
  return safeStr(syncResult?.after?.availability || fallback);
}

export async function POST(req: NextRequest) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  await dbConnect();

  const form = await req.formData();
  const conflictMode = safeStr(form.get("conflictMode") || "ignore").toLowerCase();

  const allEntries = form.getAll("files");
  const files = allEntries.filter((x) => x instanceof File) as File[];

  if (!files.length) {
    return NextResponse.json(
      { error: "At least one PDF file is required" },
      { status: 400 }
    );
  }

  const results: any[] = [];

  for (const file of files) {
    const originalName = safeStr(file.name);

    try {
      if (!originalName) {
        results.push({
          ok: false,
          fileName: "",
          action: "skipped",
          reason: "Empty file name",
        });
        continue;
      }

      const ext = fileExt(originalName);
      if (ext !== ".pdf") {
        results.push({
          ok: false,
          fileName: originalName,
          action: "skipped",
          reason: "Only PDF files allowed",
        });
        continue;
      }

      const baseName = fileBaseName(originalName);
      const skuNormalized = normalizeSkuLike(baseName);

      if (!skuNormalized) {
        results.push({
          ok: false,
          fileName: originalName,
          action: "failed",
          reason: "SKU could not be parsed from filename",
        });
        continue;
      }

      const beforeSnapshot = await getDerivedAvailabilitySnapshotBySku(skuNormalized);

      if (beforeSnapshot.hasSolvedPdf) {
        results.push({
          ok: true,
          fileName: originalName,
          action: "ignored",
          reason: "Solved PDF already exists, official paper upload skipped",
          skuNormalized,
          availabilityAfter: beforeSnapshot.availability,
        });
        continue;
      }

      const existingLive: any = await findActiveOfficialPaperBySku(skuNormalized);

      if (existingLive && conflictMode === "ignore") {
        results.push({
          ok: true,
          fileName: originalName,
          action: "ignored",
          reason: "Official paper already exists for this SKU",
          skuNormalized,
          existingFileId: String(existingLive._id || ""),
          availabilityAfter: beforeSnapshot.availability,
        });
        continue;
      }

      const bytes = Buffer.from(await file.arrayBuffer());
      const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");

      const uploaded = await uploadPdfBufferToS3({
        folderPath: "official-papers",
        originalName,
        bytes,
        mimeType: "application/pdf",
      });

      const detectedPages = await detectPdfPagesFromS3Key(uploaded.key);
      const matchedProduct: any = await findProductByExactSku(skuNormalized);

      const created: any = await OfficialPaper.create({
        skuNormalized,
        productId: matchedProduct?._id || null,
        productSku: safeStr(matchedProduct?.sku),
        productSlug: safeStr(matchedProduct?.slug),
        productExists: Boolean(matchedProduct),
        titleColor: matchedProduct ? "green" : "red",

        originalName,
        fileName: safeStr(file.name),
        fileExt: ext,
        baseName: safeStr(baseName),

        mimeType: "application/pdf",
        sizeBytes: bytes.length,
        pageCount: Math.max(0, Math.trunc(Number(detectedPages || 0))),
        sha256,

        s3Bucket: safeStr(uploaded.bucket),
        s3Key: safeStr(uploaded.key),

        uploadedAt: new Date(),
        uploadedBy: getUserId(guard.user),
        updatedBy: getUserId(guard.user),

        deletedAt: null,
      });

      if (existingLive && conflictMode === "replace") {
        created.replaceSourceFileId = existingLive._id;
        created.updatedBy = getUserId(guard.user);
        await created.save();

        const staleKey = safeStr(existingLive.s3Key);
        await OfficialPaper.deleteOne({ _id: existingLive._id });

        try {
          await deleteS3ObjectIfExists(staleKey);
        } catch {
          // ignore stale cleanup failure
        }
      }

      const syncResult: any = await syncProductAvailabilityBySku(
        safeStr(matchedProduct?.sku || skuNormalized)
      );

      results.push({
        ok: true,
        fileName: originalName,
        action:
          existingLive && conflictMode === "replace" ? "replaced" : "uploaded",
        reason: existingLive && conflictMode === "replace" ? "Old official paper replaced" : "",
        fileId: String(created._id || ""),
        skuNormalized,
        productMatched: Boolean(matchedProduct),
        productSku: safeStr(matchedProduct?.sku),
        productSlug: safeStr(matchedProduct?.slug),
        detectedPages: Number(created.pageCount || 0),
        availabilityAfter: getAvailabilityAfter(syncResult, beforeSnapshot.availability),
      });
    } catch (err: any) {
      results.push({
        ok: false,
        fileName: originalName,
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
      conflictMode,
      summary,
      results,
    },
    { status: 200 }
  );
}