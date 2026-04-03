import crypto from "crypto";
import path from "path";
import AdmZip from "adm-zip";
import { PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

import dbConnect from "@/lib/db";
import OfficialPaper from "@/models/OfficialPaper";
import {
  safeStr,
  fileBaseName,
  fileExt,
  normalizeSkuLike,
  uploadPdfBufferToS3,
  detectPdfPagesFromS3Key,
  findProductByExactSku,
  getPdfBufferFromS3,
} from "@/lib/pdfVault";
import {
  getDerivedAvailabilitySnapshotBySku,
  syncProductAvailabilityBySku,
} from "@/lib/productAvailability";

export type OfficialPaperConflictMode = "ignore" | "replace";

export type PreparedOfficialPaperZipRow = {
  rowNumber: number;
  entryName: string;
  originalName: string;
  fileName: string;
  baseName: string;
  skuNormalized: string;
  sizeBytes: number;
};

export type BulkOfficialPapersJobConfig = {
  conflictMode: OfficialPaperConflictMode;
  originalFileName: string;
};

export type BulkOfficialPapersBatchProcessResult = {
  processedDelta: number;
  successDelta: number;
  failedDelta: number;
  skippedDelta: number;
  validDelta: number;
  nextLastProcessedIndex: number;
  batchNumber: number;
  fromIndex: number;
  toIndex: number;
  attempted: number;
  failures: Array<{
    itemIndex: number;
    rowNumber: number;
    batchNumber: number;
    identifier?: string;
    sku?: string;
    fileName?: string;
    status?: string;
    reason?: string;
    raw?: any;
  }>;
  summaryPatch: Record<string, any>;
  note: string;
};

const REGION = process.env.AWS_REGION || "ap-south-1";
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID || "";
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY || "";
const BUCKET_PRIVATE = process.env.AWS_S3_BUCKET_PRIVATE || "";
const STAGING_PREFIX = "bulk-staging/official-papers";

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function uniqueStrings(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const v of arr) {
    const k = safeStr(v);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }

  return out;
}

function isPdfEntryName(name: string) {
  return fileExt(name).toLowerCase() === ".pdf";
}

function cleanZipEntryName(name: string) {
  return safeStr(name).replace(/\\/g, "/");
}

function cleanBaseFileName(name: string) {
  return safeStr(path.basename(name || ""));
}

function buildStagingZipKey(originalName: string) {
  const ext = ".zip";
  const base = cleanBaseFileName(originalName).replace(/\.zip$/i, "") || "official-papers";
  const safeBase =
    base
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "official-papers";

  const rand = crypto.randomBytes(8).toString("hex");
  return `${STAGING_PREFIX}/${Date.now()}-${rand}-${safeBase}${ext}`;
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

  await dbConnect();

  const row: any = await OfficialPaper.findOne({
    skuNormalized: sku,
    deletedAt: null,
  }).sort({ uploadedAt: -1, _id: -1 });

  return row || null;
}

function getAvailabilityAfter(syncResult: any, fallback = "") {
  return safeStr(syncResult?.after?.availability || fallback);
}

export function normalizeBulkOfficialPapersConfig(input: any): BulkOfficialPapersJobConfig {
  return {
    conflictMode: safeStr(input?.conflictMode).toLowerCase() === "replace" ? "replace" : "ignore",
    originalFileName: safeStr(input?.originalFileName),
  };
}

export function validateBulkOfficialPapersConfig(config: BulkOfficialPapersJobConfig) {
  if (!config.originalFileName) {
    throw new Error("ZIP file name required");
  }
}

export function prepareOfficialPaperRowsFromZipBuffer(zipBuffer: Buffer) {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  const rows: PreparedOfficialPaperZipRow[] = [];
  let rowNumber = 0;

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const entryName = cleanZipEntryName(entry.entryName);
    if (!entryName || entryName.startsWith("__MACOSX/")) continue;
    if (!isPdfEntryName(entryName)) continue;

    const originalName = cleanBaseFileName(entryName);
    const baseName = safeStr(fileBaseName(originalName));
    const skuNormalized = normalizeSkuLike(baseName);

    rowNumber += 1;

    rows.push({
      rowNumber,
      entryName,
      originalName,
      fileName: originalName,
      baseName,
      skuNormalized,
      sizeBytes: Math.max(0, safeNum((entry as any)?.header?.size, 0)),
    });
  }

  return rows;
}

export async function uploadOfficialPapersJobZipToS3(args: {
  originalName: string;
  zipBuffer: Buffer;
}) {
  if (!ACCESS_KEY || !SECRET_KEY) {
    throw new Error("AWS credentials missing");
  }

  if (!BUCKET_PRIVATE) {
    throw new Error("AWS_S3_BUCKET_PRIVATE missing");
  }

  const key = buildStagingZipKey(args.originalName);

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_PRIVATE,
      Key: key,
      Body: args.zipBuffer,
      ContentType: "application/zip",
    })
  );

  return {
    bucket: BUCKET_PRIVATE,
    key,
  };
}

export async function processBulkOfficialPapersJobBatch(args: {
  job: any;
  batchNumber: number;
  fromIndex: number;
  toIndex: number;
}) {
  await dbConnect();

  const job = args.job;
  const config = normalizeBulkOfficialPapersConfig(job?.config || {});
  validateBulkOfficialPapersConfig(config);

  const rows: PreparedOfficialPaperZipRow[] = Array.isArray(job?.input?.rows) ? job.input.rows : [];
  const batchRows = rows.slice(args.fromIndex, args.toIndex + 1);
  const stagingZipKey = safeStr(job?.input?.stagingZipKey);

  if (!stagingZipKey) {
    throw new Error("stagingZipKey missing in job input");
  }

  const zipBuffer = await getPdfBufferFromS3(stagingZipKey);
  const zip = new AdmZip(zipBuffer);

  const currentSummary = job?.summary || {};

  const firstIndexBySku = new Map<string, number>();
  for (let i = 0; i < rows.length; i++) {
    const sku = safeStr(rows[i]?.skuNormalized).toUpperCase();
    if (!sku) continue;
    if (!firstIndexBySku.has(sku)) {
      firstIndexBySku.set(sku, i);
    }
  }

  let batchValidFiles = 0;
  let batchUploadedFiles = 0;
  let batchReplacedFiles = 0;
  let batchIgnoredFiles = 0;
  let batchSkippedFiles = 0;
  let batchFailedFiles = 0;
  let batchMatchedProducts = 0;

  const failures: BulkOfficialPapersBatchProcessResult["failures"] = [];

  for (let idx = 0; idx < batchRows.length; idx++) {
    const row = batchRows[idx];
    const itemIndex = args.fromIndex + idx;
    const rowNumber = Number(row?.rowNumber || itemIndex + 1);

    const originalName = safeStr(row?.originalName);
    const entryName = safeStr(row?.entryName);
    const fileName = safeStr(row?.fileName);
    const skuNormalized = safeStr(row?.skuNormalized).toUpperCase();

    const pushFailure = (status: string, reason: string) => {
      failures.push({
        itemIndex,
        rowNumber,
        batchNumber: args.batchNumber,
        identifier: fileName || skuNormalized || `row-${rowNumber}`,
        sku: skuNormalized,
        fileName,
        status,
        reason,
        raw: row,
      });
    };

    if (!fileName || !entryName) {
      batchFailedFiles++;
      pushFailure("failed", "Invalid ZIP row: file entry missing");
      continue;
    }

    if (fileExt(fileName).toLowerCase() !== ".pdf") {
      batchSkippedFiles++;
      batchIgnoredFiles++;
      pushFailure("skipped", "Only PDF files allowed");
      continue;
    }

    if (!skuNormalized) {
      batchFailedFiles++;
      pushFailure("failed", "SKU could not be parsed from filename");
      continue;
    }

    const firstIndex = firstIndexBySku.get(skuNormalized);
    if (typeof firstIndex === "number" && firstIndex !== itemIndex) {
      batchSkippedFiles++;
      batchIgnoredFiles++;
      pushFailure("skipped", "Duplicate SKU repeated inside same ZIP. Only first occurrence processed.");
      continue;
    }

    const beforeSnapshot = await getDerivedAvailabilitySnapshotBySku(skuNormalized);

    if (beforeSnapshot.hasSolvedPdf) {
      batchSkippedFiles++;
      batchIgnoredFiles++;
      pushFailure("skipped", "Solved PDF already exists, official paper upload skipped");
      continue;
    }

    const existingLive: any = await findActiveOfficialPaperBySku(skuNormalized);

    if (existingLive && config.conflictMode === "ignore") {
      batchSkippedFiles++;
      batchIgnoredFiles++;
      pushFailure("skipped", "Official paper already exists for this SKU");
      continue;
    }

    const zipEntry = zip.getEntry(entryName);
    if (!zipEntry || zipEntry.isDirectory) {
      batchFailedFiles++;
      pushFailure("failed", "ZIP entry not found while processing batch");
      continue;
    }

    const bytes = zipEntry.getData();
    if (!bytes || !bytes.length) {
      batchFailedFiles++;
      pushFailure("failed", "PDF bytes empty or unreadable");
      continue;
    }

    batchValidFiles++;

    try {
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
        fileName,
        fileExt: ".pdf",
        baseName: safeStr(row?.baseName),

        mimeType: "application/pdf",
        sizeBytes: bytes.length,
        pageCount: Math.max(0, Math.trunc(Number(detectedPages || 0))),
        sha256,

        s3Bucket: safeStr(uploaded.bucket),
        s3Key: safeStr(uploaded.key),

        uploadedAt: new Date(),
        uploadedBy: safeStr(job?.createdBy),
        updatedBy: safeStr(job?.createdBy),

        deletedAt: null,
      });

      if (existingLive && config.conflictMode === "replace") {
        created.replaceSourceFileId = existingLive._id;
        created.updatedBy = safeStr(job?.createdBy);
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

      if (matchedProduct) {
        batchMatchedProducts++;
      }

      if (existingLive && config.conflictMode === "replace") {
        batchReplacedFiles++;
      } else {
        batchUploadedFiles++;
      }

      const _availabilityAfter = getAvailabilityAfter(syncResult, beforeSnapshot.availability);
      void _availabilityAfter;
    } catch (err: any) {
      batchFailedFiles++;
      pushFailure("failed", safeStr(err?.message || "Upload failed"));
    }
  }

  const nextSummary = {
    totalFiles: safeNum(currentSummary?.totalFiles, rows.length),
    validFiles: safeNum(currentSummary?.validFiles, 0) + batchValidFiles,
    uploadedFiles: safeNum(currentSummary?.uploadedFiles, 0) + batchUploadedFiles,
    replacedFiles: safeNum(currentSummary?.replacedFiles, 0) + batchReplacedFiles,
    ignoredFiles: safeNum(currentSummary?.ignoredFiles, 0) + batchIgnoredFiles,
    skippedFiles: safeNum(currentSummary?.skippedFiles, 0) + batchSkippedFiles,
    failedFiles: safeNum(currentSummary?.failedFiles, 0) + batchFailedFiles,
    matchedProducts: safeNum(currentSummary?.matchedProducts, 0) + batchMatchedProducts,
    conflictMode: config.conflictMode,
    originalFileName: safeStr(config.originalFileName),
    parentPath: "official-papers",
    sourceType: "zip",
    stagingZipKey,
  };

  const successDelta = batchUploadedFiles + batchReplacedFiles;

  return {
    processedDelta: batchRows.length,
    successDelta,
    failedDelta: batchFailedFiles,
    skippedDelta: batchSkippedFiles,
    validDelta: batchValidFiles,
    nextLastProcessedIndex: args.toIndex,
    batchNumber: args.batchNumber,
    fromIndex: args.fromIndex,
    toIndex: args.toIndex,
    attempted: batchRows.length,
    failures,
    summaryPatch: nextSummary,
    note: `Batch ${args.batchNumber} processed. Uploaded ${batchUploadedFiles}, Replaced ${batchReplacedFiles}, Skipped ${batchSkippedFiles}, Failed ${batchFailedFiles}.`,
  } as BulkOfficialPapersBatchProcessResult;
}