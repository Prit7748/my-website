import crypto from "crypto";
import path from "path";
import AdmZip from "adm-zip";
import {
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

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
export type OfficialPaperJobSourceType = "zip" | "direct_pdf_blocks";

export type PreparedOfficialPaperZipRow = {
  rowNumber: number;
  entryName: string;
  originalName: string;
  fileName: string;
  baseName: string;
  skuNormalized: string;
  sizeBytes: number;
};

export type PreparedOfficialPaperDirectRow = {
  rowNumber: number;
  originalName: string;
  fileName: string;
  baseName: string;
  skuNormalized: string;
  sizeBytes: number;
  stagedPdfKey: string;
  stagedBucket?: string;
  blockId?: string;
  clientFileId?: string;
};

export type PreparedOfficialPaperAnyRow =
  | PreparedOfficialPaperZipRow
  | PreparedOfficialPaperDirectRow;

export type BulkOfficialPapersJobConfig = {
  conflictMode: OfficialPaperConflictMode;
  originalFileName: string;
  sourceType?: OfficialPaperJobSourceType;
  parentPath?: string;
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

const STAGING_ZIP_PREFIX = "bulk-staging/official-papers/zips";
const STAGING_DIRECT_PREFIX = "bulk-staging/official-papers/direct-blocks";

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

function isPdfEntryName(name: string) {
  return fileExt(name).toLowerCase() === ".pdf";
}

function cleanZipEntryName(name: string) {
  return safeStr(name).replace(/\\/g, "/");
}

function cleanBaseFileName(name: string) {
  return safeStr(path.basename(name || ""));
}

function buildSafeFileStem(input: string, fallback = "official-papers") {
  return (
    cleanBaseFileName(input)
      .replace(/\.[a-z0-9]+$/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100) || fallback
  );
}

function buildStagingZipKey(originalName: string) {
  const rand = crypto.randomBytes(8).toString("hex");
  const safeBase = buildSafeFileStem(originalName, "official-papers");
  return `${STAGING_ZIP_PREFIX}/${Date.now()}-${rand}-${safeBase}.zip`;
}

function buildStagedDirectPdfKey(args: {
  originalName: string;
  blockId?: string;
  rowNumber?: number;
}) {
  const rand = crypto.randomBytes(8).toString("hex");
  const blockPart =
    safeStr(args.blockId)
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "block";
  const safeBase = buildSafeFileStem(args.originalName, "file");
  const rowPart = Math.max(1, Math.trunc(Number(args.rowNumber || 1)));
  return `${STAGING_DIRECT_PREFIX}/${blockPart}/${Date.now()}-${rowPart}-${rand}-${safeBase}.pdf`;
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

function getSourceTypeFromJob(job: any): OfficialPaperJobSourceType {
  const raw = safeStr(
    job?.config?.sourceType ||
      job?.meta?.sourceType ||
      job?.summary?.sourceType ||
      "zip"
  ).toLowerCase();

  if (raw === "direct_pdf_blocks") return "direct_pdf_blocks";
  return "zip";
}

function getPreparedRowsFromJob(job: any): PreparedOfficialPaperAnyRow[] {
  return Array.isArray(job?.input?.rows) ? job.input.rows : [];
}

function buildFirstIndexBySku(rows: PreparedOfficialPaperAnyRow[]) {
  const firstIndexBySku = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const sku = safeStr((rows[i] as any)?.skuNormalized).toUpperCase();
    if (!sku) continue;
    if (!firstIndexBySku.has(sku)) {
      firstIndexBySku.set(sku, i);
    }
  }

  return firstIndexBySku;
}

async function getPdfBytesForRow(args: {
  sourceType: OfficialPaperJobSourceType;
  row: PreparedOfficialPaperAnyRow;
  zip?: any | null;
}) {
  if (args.sourceType === "zip") {
    const entryName = safeStr((args.row as PreparedOfficialPaperZipRow)?.entryName);
    if (!entryName) {
      throw new Error("ZIP entry name missing");
    }

    const zip = args.zip;
    if (!zip) {
      throw new Error("ZIP reader not available");
    }

    const zipEntry = zip.getEntry(entryName);
    if (!zipEntry || zipEntry.isDirectory) {
      throw new Error("ZIP entry not found while processing batch");
    }

    const bytes = zipEntry.getData();
    if (!bytes || !bytes.length) {
      throw new Error("PDF bytes empty or unreadable");
    }

    return bytes;
  }

  const stagedPdfKey = safeStr((args.row as PreparedOfficialPaperDirectRow)?.stagedPdfKey);
  if (!stagedPdfKey) {
    throw new Error("stagedPdfKey missing for direct PDF block row");
  }

  const bytes = await getPdfBufferFromS3(stagedPdfKey);
  if (!bytes || !bytes.length) {
    throw new Error("Staged PDF bytes empty or unreadable");
  }

  return bytes;
}

async function createOrReplaceOfficialPaperFromBytes(args: {
  job: any;
  row: PreparedOfficialPaperAnyRow;
  bytes: Buffer;
  config: BulkOfficialPapersJobConfig;
  existingLive: any;
}) {
  const originalName = safeStr((args.row as any)?.originalName);
  const fileName = safeStr((args.row as any)?.fileName);
  const baseName = safeStr((args.row as any)?.baseName);
  const skuNormalized = safeStr((args.row as any)?.skuNormalized).toUpperCase();

  const sha256 = crypto.createHash("sha256").update(args.bytes).digest("hex");

  const uploaded = await uploadPdfBufferToS3({
    folderPath: safeStr(args.config.parentPath || "official-papers"),
    originalName,
    bytes: args.bytes,
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
    baseName,

    mimeType: "application/pdf",
    sizeBytes: args.bytes.length,
    pageCount: Math.max(0, Math.trunc(Number(detectedPages || 0))),
    sha256,

    s3Bucket: safeStr(uploaded.bucket),
    s3Key: safeStr(uploaded.key),

    uploadedAt: new Date(),
    uploadedBy: safeStr(args.job?.createdBy),
    updatedBy: safeStr(args.job?.createdBy),

    deletedAt: null,
  });

  let replaced = false;

  if (args.existingLive && args.config.conflictMode === "replace") {
    replaced = true;
    created.replaceSourceFileId = args.existingLive._id;
    created.updatedBy = safeStr(args.job?.createdBy);
    await created.save();

    const staleKey = safeStr(args.existingLive.s3Key);
    await OfficialPaper.deleteOne({ _id: args.existingLive._id });

    try {
      await deleteS3ObjectIfExists(staleKey);
    } catch {
      // ignore stale cleanup failure
    }
  }

  const syncResult: any = await syncProductAvailabilityBySku(
    safeStr(matchedProduct?.sku || skuNormalized)
  );

  return {
    matchedProduct,
    replaced,
    uploaded,
    created,
    detectedPages: Math.max(0, Math.trunc(Number(detectedPages || 0))),
    availabilityAfter: getAvailabilityAfter(syncResult),
  };
}

export function normalizeBulkOfficialPapersConfig(
  input: any
): BulkOfficialPapersJobConfig {
  const sourceTypeRaw = safeStr(input?.sourceType).toLowerCase();

  return {
    conflictMode:
      safeStr(input?.conflictMode).toLowerCase() === "replace"
        ? "replace"
        : "ignore",
    originalFileName: safeStr(input?.originalFileName),
    sourceType:
      sourceTypeRaw === "direct_pdf_blocks" ? "direct_pdf_blocks" : "zip",
    parentPath: safeStr(input?.parentPath || "official-papers"),
  };
}

export function validateBulkOfficialPapersConfig(
  config: BulkOfficialPapersJobConfig
) {
  if (!config.originalFileName) {
    throw new Error("Source file name or upload label required");
  }

  if (config.conflictMode !== "ignore" && config.conflictMode !== "replace") {
    throw new Error("Invalid conflict mode");
  }

  if (
    config.sourceType &&
    config.sourceType !== "zip" &&
    config.sourceType !== "direct_pdf_blocks"
  ) {
    throw new Error("Invalid source type");
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

export function prepareOfficialPaperRowsFromDirectBlock(args: {
  items: Array<{
    originalName?: string;
    fileName?: string;
    sizeBytes?: number;
    stagedPdfKey?: string;
    stagedBucket?: string;
    blockId?: string;
    clientFileId?: string;
  }>;
  startingRowNumber?: number;
}) {
  const rows: PreparedOfficialPaperDirectRow[] = [];
  const baseRow = Math.max(1, Math.trunc(Number(args.startingRowNumber || 1)));

  let offset = 0;

  for (const item of Array.isArray(args.items) ? args.items : []) {
    const originalName = cleanBaseFileName(item.originalName || item.fileName || "");
    if (!originalName) continue;
    if (!isPdfEntryName(originalName)) continue;

    const stagedPdfKey = safeStr(item.stagedPdfKey);
    if (!stagedPdfKey) continue;

    const baseName = safeStr(fileBaseName(originalName));
    const skuNormalized = normalizeSkuLike(baseName);

    rows.push({
      rowNumber: baseRow + offset,
      originalName,
      fileName: originalName,
      baseName,
      skuNormalized,
      sizeBytes: Math.max(0, safeNum(item.sizeBytes, 0)),
      stagedPdfKey,
      stagedBucket: safeStr(item.stagedBucket || BUCKET_PRIVATE),
      blockId: safeStr(item.blockId),
      clientFileId: safeStr(item.clientFileId),
    });

    offset += 1;
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

export async function uploadOfficialPaperBlockPdfToS3(args: {
  originalName: string;
  pdfBuffer: Buffer;
  blockId?: string;
  rowNumber?: number;
}) {
  if (!ACCESS_KEY || !SECRET_KEY) {
    throw new Error("AWS credentials missing");
  }

  if (!BUCKET_PRIVATE) {
    throw new Error("AWS_S3_BUCKET_PRIVATE missing");
  }

  const originalName = cleanBaseFileName(args.originalName);
  if (!originalName || !isPdfEntryName(originalName)) {
    throw new Error("Only PDF files allowed in direct block staging");
  }

  const key = buildStagedDirectPdfKey({
    originalName,
    blockId: safeStr(args.blockId),
    rowNumber: Math.max(1, Math.trunc(Number(args.rowNumber || 1))),
  });

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_PRIVATE,
      Key: key,
      Body: args.pdfBuffer,
      ContentType: "application/pdf",
    })
  );

  return {
    bucket: BUCKET_PRIVATE,
    key,
    originalName,
    fileName: originalName,
    sizeBytes: args.pdfBuffer.length,
  };
}

export async function deleteOfficialPaperStageObject(s3Key: string) {
  await deleteS3ObjectIfExists(s3Key);
  return { ok: true, key: safeStr(s3Key) };
}

export async function deleteOfficialPaperStageObjects(s3Keys: string[]) {
  const uniqueKeys = Array.from(
    new Set(
      (Array.isArray(s3Keys) ? s3Keys : [])
        .map((x) => safeStr(x))
        .filter(Boolean)
    )
  );

  for (const key of uniqueKeys) {
    try {
      await deleteS3ObjectIfExists(key);
    } catch {
      // ignore individual cleanup failures
    }
  }

  return {
    ok: true,
    deletedCount: uniqueKeys.length,
    keys: uniqueKeys,
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

  const rows = getPreparedRowsFromJob(job);
  const batchRows = rows.slice(args.fromIndex, args.toIndex + 1);
  const sourceType = getSourceTypeFromJob(job);

  let zip: any | null = null;
  let stagingZipKey = "";

  if (sourceType === "zip") {
    stagingZipKey = safeStr(job?.input?.stagingZipKey);
    if (!stagingZipKey) {
      throw new Error("stagingZipKey missing in job input");
    }

    const zipBuffer = await getPdfBufferFromS3(stagingZipKey);
    zip = new AdmZip(zipBuffer);
  }

  const currentSummary = job?.summary || {};
  const firstIndexBySku = buildFirstIndexBySku(rows);

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
    const rowNumber = Number((row as any)?.rowNumber || itemIndex + 1);

    const fileName = safeStr((row as any)?.fileName);
    const skuNormalized = safeStr((row as any)?.skuNormalized).toUpperCase();

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

    if (!fileName) {
      batchFailedFiles++;
      pushFailure("failed", "Invalid row: file name missing");
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
      pushFailure(
        "skipped",
        "Duplicate SKU repeated inside same job. Only first occurrence processed."
      );
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

    let bytes: Buffer;

    try {
      bytes = await getPdfBytesForRow({
        sourceType,
        row,
        zip,
      });
    } catch (err: any) {
      batchFailedFiles++;
      pushFailure("failed", safeStr(err?.message || "PDF bytes could not be prepared"));
      continue;
    }

    batchValidFiles++;

    try {
      const result = await createOrReplaceOfficialPaperFromBytes({
        job,
        row,
        bytes,
        config,
        existingLive,
      });

      if (result.matchedProduct) {
        batchMatchedProducts++;
      }

      if (result.replaced) {
        batchReplacedFiles++;
      } else {
        batchUploadedFiles++;
      }

      const _availabilityAfter = safeStr(
        result.availabilityAfter || beforeSnapshot.availability
      );
      void _availabilityAfter;
    } catch (err: any) {
      batchFailedFiles++;
      pushFailure("failed", safeStr(err?.message || "Upload failed"));
    }
  }

  const nextSummary = {
    totalFiles: safeNum(currentSummary?.totalFiles, rows.length),
    validFiles: batchValidFiles,
    uploadedFiles: batchUploadedFiles,
    replacedFiles: batchReplacedFiles,
    ignoredFiles: batchIgnoredFiles,
    skippedFiles: batchSkippedFiles,
    failedFiles: batchFailedFiles,
    matchedProducts: batchMatchedProducts,
    conflictMode: config.conflictMode,
    originalFileName: safeStr(config.originalFileName),
    parentPath: safeStr(config.parentPath || "official-papers"),
    sourceType,
    ...(sourceType === "zip" && stagingZipKey ? { stagingZipKey } : {}),
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