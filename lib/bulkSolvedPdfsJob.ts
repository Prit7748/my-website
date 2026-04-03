import crypto from "crypto";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

import dbConnect from "@/lib/db";
import PdfVaultFolder from "@/models/PdfVaultFolder";
import PdfVaultFile from "@/models/PdfVaultFile";
import OfficialPaper from "@/models/OfficialPaper";
import Order from "@/models/Order";
import Product from "@/models/Product";
import {
  cleanFolderPath,
  createPdfVaultFileRecord,
  ensureRootFolder,
  fileBaseName,
  fileExt,
  normalizeSkuLike,
  safeStr,
  uploadPdfBufferToS3,
} from "@/lib/pdfVault";
import { sendOnDemandReadyEmail } from "@/lib/orderNotifications";
import { syncProductAvailabilityBySku } from "@/lib/productAvailability";

export type SolvedPdfConflictMode = "ignore" | "replace";

export type PreparedSolvedPdfClientRow = {
  rowNumber: number;
  originalName: string;
  fileName: string;
  baseName: string;
  skuNormalized: string;
  sizeBytes: number;
  lastModified: number;
};

export type BulkSolvedPdfsJobConfig = {
  conflictMode: SolvedPdfConflictMode;
  parentPath: string;
  originalSelectionCount: number;
};

export type BulkSolvedPdfsBatchProcessResult = {
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

async function findActiveDuplicatesBySku(skuNormalized: string) {
  const sku = safeStr(skuNormalized).toUpperCase();
  if (!sku) return [];

  await dbConnect();

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

async function removeActiveOfficialPaperForSku(skuNormalized: string) {
  const sku = safeStr(skuNormalized).toUpperCase();
  if (!sku) {
    return { deleted: false, fileId: "", s3Key: "" };
  }

  await dbConnect();

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

export function normalizeBulkSolvedPdfsConfig(input: any): BulkSolvedPdfsJobConfig {
  const parentPath = cleanFolderPath(safeStr(input?.parentPath || "root")) || "root";

  return {
    conflictMode: safeStr(input?.conflictMode).toLowerCase() === "replace" ? "replace" : "ignore",
    parentPath,
    originalSelectionCount: Math.max(0, Math.trunc(Number(input?.originalSelectionCount || 0))),
  };
}

export function validateBulkSolvedPdfsConfig(config: BulkSolvedPdfsJobConfig) {
  if (!config.parentPath) {
    throw new Error("parentPath required");
  }

  if (!["ignore", "replace"].includes(config.conflictMode)) {
    throw new Error("Invalid conflictMode");
  }
}

export function prepareSolvedPdfRowsFromClientFiles(inputRows: any[]) {
  const rows: PreparedSolvedPdfClientRow[] = [];
  let rowNumber = 0;

  for (const raw of Array.isArray(inputRows) ? inputRows : []) {
    const originalName = safeStr(raw?.name);
    if (!originalName) continue;

    rowNumber += 1;

    const baseName = safeStr(fileBaseName(originalName));
    const skuNormalized = normalizeSkuLike(baseName);

    rows.push({
      rowNumber,
      originalName,
      fileName: originalName,
      baseName,
      skuNormalized,
      sizeBytes: Math.max(0, Math.trunc(Number(raw?.size || 0))),
      lastModified: Math.max(0, Math.trunc(Number(raw?.lastModified || 0))),
    });
  }

  return rows;
}

export async function processBulkSolvedPdfsJobBatch(args: {
  job: any;
  batchNumber: number;
  fromIndex: number;
  toIndex: number;
  batchFiles: File[];
}) {
  await dbConnect();
  await ensureRootFolder();

  const job = args.job;
  const config = normalizeBulkSolvedPdfsConfig(job?.config || {});
  validateBulkSolvedPdfsConfig(config);

  const rows: PreparedSolvedPdfClientRow[] = Array.isArray(job?.input?.rows) ? job.input.rows : [];
  const batchRows = rows.slice(args.fromIndex, args.toIndex + 1);

  const folder: any = await PdfVaultFolder.findOne({
    path: config.parentPath,
    deletedAt: null,
  });

  if (!folder) {
    throw new Error("Target solved PDFs folder not found");
  }

  const batchFiles = Array.isArray(args.batchFiles) ? args.batchFiles : [];
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
  let batchOfficialPapersDeleted = 0;

  const failures: BulkSolvedPdfsBatchProcessResult["failures"] = [];

  for (let idx = 0; idx < batchRows.length; idx++) {
    const row = batchRows[idx];
    const file = batchFiles[idx] || null;

    const itemIndex = args.fromIndex + idx;
    const rowNumber = Number(row?.rowNumber || itemIndex + 1);

    const originalName = safeStr(row?.originalName);
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

    if (!file) {
      batchFailedFiles++;
      pushFailure("failed", "Batch file payload missing or order mismatch");
      continue;
    }

    if (!originalName || !fileName) {
      batchFailedFiles++;
      pushFailure("failed", "Empty file name");
      continue;
    }

    if (safeStr(file.name) !== fileName) {
      batchFailedFiles++;
      pushFailure("failed", "Batch file order mismatch");
      continue;
    }

    const ext = fileExt(fileName).toLowerCase();
    if (ext !== ".pdf") {
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
      pushFailure("skipped", "Duplicate SKU repeated in same selection. Only first occurrence processed.");
      continue;
    }

    const activeDuplicates: any[] = await findActiveDuplicatesBySku(skuNormalized);
    const primaryDuplicate = activeDuplicates.length ? activeDuplicates[0] : null;

    if (activeDuplicates.length && config.conflictMode === "ignore") {
      batchSkippedFiles++;
      batchIgnoredFiles++;
      pushFailure("skipped", "Duplicate solved PDF already exists for this SKU");
      continue;
    }

    let bytes: Buffer;
    try {
      bytes = Buffer.from(await file.arrayBuffer());
    } catch {
      batchFailedFiles++;
      pushFailure("failed", "Unable to read PDF bytes");
      continue;
    }

    if (!bytes.length) {
      batchFailedFiles++;
      pushFailure("failed", "PDF bytes empty");
      continue;
    }

    batchValidFiles++;

    try {
      const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");

      const uploaded = await uploadPdfBufferToS3({
        folderPath: config.parentPath,
        originalName,
        bytes,
        mimeType: "application/pdf",
      });

      if (activeDuplicates.length && config.conflictMode === "replace") {
        const duplicateIds = activeDuplicates.map((x: any) => x._id);

        await PdfVaultFile.deleteMany({
          _id: { $in: duplicateIds },
        });
      }

      const created = await createPdfVaultFileRecord({
        folderId: String(folder._id),
        originalName,
        s3Bucket: uploaded.bucket,
        s3Key: uploaded.key,
        mimeType: "application/pdf",
        sizeBytes: bytes.length,
        sha256,
        uploadedBy: safeStr(job?.createdBy),
      });

      if (
        activeDuplicates.length &&
        config.conflictMode === "replace" &&
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

      if (activeDuplicates.length && config.conflictMode === "replace") {
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

      const officialPaperCleanup = await removeActiveOfficialPaperForSku(skuNormalized);
      const availabilitySync: any = await syncProductAvailabilityBySku(skuNormalized);

      if (officialPaperCleanup.deleted) {
        batchOfficialPapersDeleted++;
      }

      if (created?.attachResult?.matched && created?.attachResult?.productId) {
        batchMatchedProducts++;

        try {
          await notifyReadyForPaidOnDemandOrders(String(created.attachResult.productId));
        } catch (err) {
          console.error("READY_EMAIL_NOTIFY_FAILED:", err);
        }
      }

      if (activeDuplicates.length && config.conflictMode === "replace") {
        batchReplacedFiles++;
      } else {
        batchUploadedFiles++;
      }

      void availabilitySync;
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
    officialPapersDeleted:
      safeNum(currentSummary?.officialPapersDeleted, 0) + batchOfficialPapersDeleted,
    conflictMode: config.conflictMode,
    parentPath: config.parentPath,
    sourceType: "browser-batch",
    originalSelectionCount: safeNum(
      currentSummary?.originalSelectionCount,
      config.originalSelectionCount
    ),
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
  } as BulkSolvedPdfsBatchProcessResult;
}