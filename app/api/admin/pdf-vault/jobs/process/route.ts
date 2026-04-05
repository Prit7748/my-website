import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  claimBulkUploadJobBatch,
  completeBulkUploadJobBatch,
  failBulkUploadJob,
  getBulkUploadJob,
  isFinalBulkJobStatus,
  toPlainBulkJob,
} from "@/lib/bulkUploadJob";
import {
  finalizeBulkSolvedPdfsDirectUploadBatch,
  processBulkSolvedPdfsJobBatch,
} from "@/lib/bulkSolvedPdfsJob";
import {
  hasPdfVaultPageAccess,
  PDF_VAULT_DIRECT_UPLOAD_MAX_BYTES,
  safeStr,
} from "@/lib/pdfVault";

export const runtime = "nodejs";

const SAFE_REQUEST_PAYLOAD_BYTES = Math.trunc(3.5 * 1024 * 1024);
const FORM_DATA_BASE_OVERHEAD_BYTES = 32 * 1024;
const FORM_DATA_PER_FILE_OVERHEAD_BYTES = 4 * 1024;

type DirectFinalizeItem = {
  itemIndex: number;
  rowNumber: number;
  batchNumber: number;
  fileName: string;
  skuNormalized?: string;
  sizeBytes?: number;
  status: "ready" | "uploaded" | "skipped" | "failed";
  reason?: string;
  upload?: {
    bucket?: string;
    key?: string;
    contentType?: string;
  };
};

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function normalizeName(name: string) {
  return safeStr(name).replace(/\\/g, "/").split("/").pop() || "";
}

function isPdfName(name: string) {
  return normalizeName(name).toLowerCase().endsWith(".pdf");
}

function formatBytes(bytes: number) {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getBatchPayloadStats(files: File[]) {
  const count = Array.isArray(files) ? files.length : 0;
  const totalBytes = (Array.isArray(files) ? files : []).reduce(
    (sum: number, file: File) => sum + Number(file?.size || 0),
    0
  );

  return {
    count,
    totalBytes,
    totalMB: totalBytes / (1024 * 1024),
  };
}

function estimateMultipartPayloadBytes(files: File[]) {
  return (Array.isArray(files) ? files : []).reduce(
    (sum: number, file: File) =>
      sum +
      Number(file?.size || 0) +
      FORM_DATA_PER_FILE_OVERHEAD_BYTES,
    FORM_DATA_BASE_OVERHEAD_BYTES
  );
}

function computeDynamicLockMs(files: File[]) {
  const { totalMB } = getBatchPayloadStats(files);
  const estimatedMinutes = 4 + Math.ceil(totalMB / 75);
  return clamp(estimatedMinutes * 60 * 1000, 2 * 60 * 1000, 15 * 60 * 1000);
}

function computeDynamicLockMsFromRows(rows: any[]) {
  const totalBytes = (Array.isArray(rows) ? rows : []).reduce(
    (sum: number, row: any) => sum + Math.max(0, Math.trunc(Number(row?.sizeBytes || 0))),
    0
  );
  const totalMB = totalBytes / (1024 * 1024);
  const estimatedMinutes = 5 + Math.ceil(totalMB / 150);
  return clamp(estimatedMinutes * 60 * 1000, 2 * 60 * 1000, 20 * 60 * 1000);
}

function getExpectedBatchWindow(job: any) {
  const totalItems = safeNum(job?.progress?.totalItems, 0);
  const processedItems = safeNum(job?.progress?.processedItems, 0);
  const batchSize = Math.max(1, safeNum(job?.progress?.batchSize, 100));

  const fromIndex = processedItems;
  const toIndex = Math.min(totalItems - 1, fromIndex + batchSize - 1);
  const batchNumber = Math.floor(fromIndex / batchSize) + 1;
  const expectedBatchCount = Math.max(0, toIndex - fromIndex + 1);

  return {
    totalItems,
    processedItems,
    batchSize,
    fromIndex,
    toIndex,
    batchNumber,
    expectedBatchCount,
  };
}

function getExpectedBatchRows(job: any, fromIndex: number, toIndex: number) {
  const rows = Array.isArray(job?.input?.rows) ? job.input.rows : [];
  return rows.slice(fromIndex, toIndex + 1);
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

async function unlockBatchWithoutProgress(args: {
  jobId: string;
  createdBy: string;
  lockToken: string;
  note: string;
  batchNumber: number;
  fromIndex: number;
  toIndex: number;
}) {
  try {
    return await completeBulkUploadJobBatch({
      jobId: args.jobId,
      createdBy: args.createdBy,
      lockToken: args.lockToken,
      processedDelta: 0,
      successDelta: 0,
      failedDelta: 0,
      skippedDelta: 0,
      validDelta: 0,
      nextLastProcessedIndex: Math.max(-1, args.fromIndex - 1),
      batchNumber: args.batchNumber,
      fromIndex: args.fromIndex,
      toIndex: args.toIndex,
      attempted: 0,
      failures: [],
      note: args.note,
      summaryPatch: {},
    });
  } catch {
    return null;
  }
}

async function parseIncomingFormData(req: NextRequest) {
  try {
    const formData = await req.formData();
    return { ok: true as const, formData };
  } catch (error: any) {
    const raw = safeStr(error?.message || "Unable to parse multipart form data");
    const lower = raw.toLowerCase();

    const isTooLarge =
      lower.includes("payload too large") ||
      lower.includes("entity too large") ||
      lower.includes("body exceeded") ||
      lower.includes("request size") ||
      lower.includes("too large") ||
      lower.includes("413");

    return {
      ok: false as const,
      res: NextResponse.json(
        {
          ok: false,
          error: isTooLarge
            ? "Batch request payload too large. Smaller batch size ke saath retry karo."
            : raw || "Unable to parse multipart form data",
          retryable: true,
          code: isTooLarge ? "PAYLOAD_TOO_LARGE" : "INVALID_MULTIPART_BODY",
        },
        { status: isTooLarge ? 413 : 400 }
      ),
    };
  }
}

function validateDirectItemsAgainstExpected(args: {
  expectedRows: any[];
  uploadedItems: DirectFinalizeItem[];
  fromIndex: number;
  batchNumber: number;
}) {
  const { expectedRows, uploadedItems, fromIndex, batchNumber } = args;

  if (uploadedItems.length !== expectedRows.length) {
    return {
      ok: false as const,
      error: `Direct finalize item count mismatch. Expected ${expectedRows.length}, received ${uploadedItems.length}.`,
    };
  }

  const allowedStatuses = new Set(["ready", "uploaded", "skipped", "failed"]);

  for (let i = 0; i < expectedRows.length; i++) {
    const expectedRow = expectedRows[i];
    const item = uploadedItems[i];

    const expectedIndex = fromIndex + i;
    const expectedName = normalizeName(safeStr(expectedRow?.fileName));
    const receivedName = normalizeName(safeStr(item?.fileName));
    const receivedStatus = safeStr(item?.status).toLowerCase();

    if (Number(item?.itemIndex) !== expectedIndex) {
      return {
        ok: false as const,
        error: `Direct finalize itemIndex mismatch at position ${i + 1}. Expected ${expectedIndex}, received ${item?.itemIndex}.`,
      };
    }

    if (Number(item?.batchNumber) !== batchNumber) {
      return {
        ok: false as const,
        error: `Direct finalize batchNumber mismatch at position ${i + 1}. Expected ${batchNumber}, received ${item?.batchNumber}.`,
      };
    }

    if (!expectedName || !receivedName || expectedName !== receivedName) {
      return {
        ok: false as const,
        error:
          `Direct finalize filename mismatch at position ${i + 1}. ` +
          `Expected "${expectedName || "-"}", received "${receivedName || "-"}".`,
      };
    }

    if (!allowedStatuses.has(receivedStatus)) {
      return {
        ok: false as const,
        error: `Invalid direct finalize status "${receivedStatus || "-"}" at position ${i + 1}.`,
      };
    }

    if (receivedStatus === "uploaded") {
      const key = safeStr(item?.upload?.key);
      if (!key) {
        return {
          ok: false as const,
          error: `Uploaded item missing S3 key at position ${i + 1}.`,
        };
      }
    }

    const sizeBytes = Math.max(
      0,
      Math.trunc(Number(item?.sizeBytes || expectedRow?.sizeBytes || 0))
    );

    if (receivedStatus === "uploaded" && sizeBytes > PDF_VAULT_DIRECT_UPLOAD_MAX_BYTES) {
      return {
        ok: false as const,
        error:
          `Uploaded item too large at position ${i + 1}. ` +
          `Size ${formatBytes(sizeBytes)} exceeds max allowed ${formatBytes(
            PDF_VAULT_DIRECT_UPLOAD_MAX_BYTES
          )}.`,
      };
    }
  }

  return { ok: true as const };
}

async function handleDirectFinalize(req: NextRequest, createdBy: string) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const jobId = safeStr(body?.jobId);
  const lockToken = safeStr(body?.lockToken);
  const uploadedItems: DirectFinalizeItem[] = Array.isArray(body?.uploadedItems)
    ? body.uploadedItems
    : [];

  if (!jobId) {
    return NextResponse.json(
      { ok: false, error: "jobId required" },
      { status: 400 }
    );
  }

  if (!lockToken) {
    return NextResponse.json(
      { ok: false, error: "lockToken required" },
      { status: 400 }
    );
  }

  const currentJob = await getBulkUploadJob(jobId, createdBy);

  if (!currentJob) {
    return NextResponse.json(
      { ok: false, error: "Job not found" },
      { status: 404 }
    );
  }

  if (safeStr(currentJob?.jobType) !== "solved_pdfs") {
    return NextResponse.json(
      { ok: false, error: "Invalid job type for this processor" },
      { status: 400 }
    );
  }

  if (isFinalBulkJobStatus(safeStr(currentJob?.status))) {
    return NextResponse.json(
      {
        ok: true,
        message: "Job already finished.",
        job: toPlainBulkJob(currentJob),
      },
      { status: 200 }
    );
  }

  const currentLockToken = safeStr(currentJob?.lockToken);
  if (!currentLockToken) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No active locked direct-upload batch found. Batch ko dubara prepare karke retry karo.",
        retryable: true,
        code: "DIRECT_BATCH_NOT_LOCKED",
        job: toPlainBulkJob(currentJob),
      },
      { status: 409 }
    );
  }

  if (currentLockToken !== lockToken) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Direct-upload batch lock mismatch. Batch ko dubara prepare karke retry karo.",
        retryable: true,
        code: "DIRECT_BATCH_LOCK_MISMATCH",
        job: toPlainBulkJob(currentJob),
      },
      { status: 409 }
    );
  }

  const lockedWindow = getExpectedBatchWindow(currentJob);

  if (lockedWindow.expectedBatchCount <= 0) {
    const released = await unlockBatchWithoutProgress({
      jobId,
      createdBy,
      lockToken,
      note: "No pending items left for processing.",
      batchNumber: lockedWindow.batchNumber,
      fromIndex: lockedWindow.fromIndex,
      toIndex: lockedWindow.toIndex,
    });

    return NextResponse.json(
      {
        ok: true,
        message: "No pending items left for processing.",
        job: toPlainBulkJob(released || currentJob),
      },
      { status: 200 }
    );
  }

  const expectedRows = getExpectedBatchRows(
    currentJob,
    lockedWindow.fromIndex,
    lockedWindow.toIndex
  );

  const validation = validateDirectItemsAgainstExpected({
    expectedRows,
    uploadedItems,
    fromIndex: lockedWindow.fromIndex,
    batchNumber: lockedWindow.batchNumber,
  });

  if (!validation.ok) {
    const released = await unlockBatchWithoutProgress({
      jobId,
      createdBy,
      lockToken,
      note: validation.error,
      batchNumber: lockedWindow.batchNumber,
      fromIndex: lockedWindow.fromIndex,
      toIndex: lockedWindow.toIndex,
    });

    return NextResponse.json(
      {
        ok: false,
        error: validation.error,
        retryable: true,
        code: "DIRECT_FINALIZE_VALIDATION_FAILED",
        job: toPlainBulkJob(released || currentJob),
      },
      { status: 409 }
    );
  }

  let batchResult: Awaited<ReturnType<typeof finalizeBulkSolvedPdfsDirectUploadBatch>>;

  try {
    batchResult = await finalizeBulkSolvedPdfsDirectUploadBatch({
      job: currentJob,
      lockToken,
      batchNumber: lockedWindow.batchNumber,
      fromIndex: lockedWindow.fromIndex,
      toIndex: lockedWindow.toIndex,
      uploadedItems,
    });
  } catch (error: any) {
    const failedJob = await failBulkUploadJob({
      jobId,
      createdBy,
      lockToken,
      message: safeStr(error?.message || "Direct finalize failed"),
    });

    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message || "Direct finalize failed"),
        code: "DIRECT_FINALIZE_FAILED",
        job: toPlainBulkJob(failedJob),
      },
      { status: 500 }
    );
  }

  try {
    const updatedJob = await completeBulkUploadJobBatch({
      jobId,
      createdBy,
      lockToken,
      processedDelta: batchResult.processedDelta,
      successDelta: batchResult.successDelta,
      failedDelta: batchResult.failedDelta,
      skippedDelta: batchResult.skippedDelta,
      validDelta: batchResult.validDelta,
      nextLastProcessedIndex: batchResult.nextLastProcessedIndex,
      batchNumber: batchResult.batchNumber,
      fromIndex: batchResult.fromIndex,
      toIndex: batchResult.toIndex,
      attempted: batchResult.attempted,
      failures: batchResult.failures,
      note: batchResult.note,
      summaryPatch: batchResult.summaryPatch,
    });

    return NextResponse.json(
      {
        ok: true,
        mode: "direct_to_s3",
        message: batchResult.note,
        job: toPlainBulkJob(updatedJob),
      },
      { status: 200 }
    );
  } catch (error: any) {
    const failedJob = await failBulkUploadJob({
      jobId,
      createdBy,
      lockToken,
      message:
        safeStr(error?.message) ||
        "Direct finalize completed but job state update failed",
    });

    return NextResponse.json(
      {
        ok: false,
        error:
          safeStr(error?.message) ||
          "Direct finalize completed but job state update failed",
        code: "DIRECT_FINALIZE_STATE_UPDATE_FAILED",
        job: toPlainBulkJob(failedJob),
      },
      { status: 500 }
    );
  }
}

async function handleMultipartUpload(req: NextRequest, createdBy: string) {
  const parsed = await parseIncomingFormData(req);
  if (!parsed.ok) return parsed.res;

  const formData = parsed.formData;
  const jobId = safeStr(formData.get("jobId"));

  if (!jobId) {
    return NextResponse.json(
      { ok: false, error: "jobId required" },
      { status: 400 }
    );
  }

  const batchFiles = formData
    .getAll("files")
    .filter((x): x is File => x instanceof File);

  const currentJob = await getBulkUploadJob(jobId, createdBy);

  if (!currentJob) {
    return NextResponse.json(
      { ok: false, error: "Job not found" },
      { status: 404 }
    );
  }

  if (safeStr(currentJob?.jobType) !== "solved_pdfs") {
    return NextResponse.json(
      { ok: false, error: "Invalid job type for this processor" },
      { status: 400 }
    );
  }

  if (isFinalBulkJobStatus(safeStr(currentJob?.status))) {
    return NextResponse.json(
      {
        ok: true,
        message: "Job already finished.",
        job: toPlainBulkJob(currentJob),
      },
      { status: 200 }
    );
  }

  const preWindow = getExpectedBatchWindow(currentJob);

  if (preWindow.expectedBatchCount <= 0) {
    return NextResponse.json(
      {
        ok: true,
        message: "No pending items left for processing.",
        job: toPlainBulkJob(currentJob),
      },
      { status: 200 }
    );
  }

  if (!batchFiles.length) {
    return NextResponse.json(
      {
        ok: false,
        error: "No PDF files received for current batch.",
        retryable: true,
      },
      { status: 400 }
    );
  }

  const estimatedPayloadBytes = estimateMultipartPayloadBytes(batchFiles);
  if (estimatedPayloadBytes > SAFE_REQUEST_PAYLOAD_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error:
          `Batch request safe limit cross kar rahi hai. Estimated payload ${formatBytes(
            estimatedPayloadBytes
          )} hai, jabki safe limit ${formatBytes(
            SAFE_REQUEST_PAYLOAD_BYTES
          )} rakhi gayi hai. Smaller batch size ke saath retry karo.`,
        retryable: true,
        code: "PAYLOAD_TOO_LARGE",
        estimatedPayloadBytes,
        safeRequestPayloadBytes: SAFE_REQUEST_PAYLOAD_BYTES,
        job: toPlainBulkJob(currentJob),
      },
      { status: 413 }
    );
  }

  const nonPdf = batchFiles.find((file: File) => !isPdfName(file.name));
  if (nonPdf) {
    return NextResponse.json(
      {
        ok: false,
        error: `Only PDF files allowed. Invalid file: ${normalizeName(nonPdf.name)}`,
      },
      { status: 400 }
    );
  }

  const claim = await claimBulkUploadJobBatch({
    jobId,
    createdBy,
    lockMs: computeDynamicLockMs(batchFiles),
  });

  if (!claim.ok) {
    const latest = await getBulkUploadJob(jobId, createdBy);

    return NextResponse.json(
      {
        ok: true,
        message: claim.error || "Job already in progress.",
        job: toPlainBulkJob(latest),
      },
      { status: 200 }
    );
  }

  const lockedJob = claim.job;
  const lockedWindow = getExpectedBatchWindow(lockedJob);

  if (lockedWindow.expectedBatchCount <= 0) {
    const released = await unlockBatchWithoutProgress({
      jobId,
      createdBy,
      lockToken: claim.lockToken,
      note: "No pending items left for processing.",
      batchNumber: lockedWindow.batchNumber,
      fromIndex: lockedWindow.fromIndex,
      toIndex: lockedWindow.toIndex,
    });

    return NextResponse.json(
      {
        ok: true,
        message: "No pending items left for processing.",
        job: toPlainBulkJob(released || lockedJob),
      },
      { status: 200 }
    );
  }

  if (batchFiles.length !== lockedWindow.expectedBatchCount) {
    const message = `Batch file count mismatch. Expected ${lockedWindow.expectedBatchCount}, received ${batchFiles.length}. Same selected PDF list dubara choose karke retry karo.`;

    const released = await unlockBatchWithoutProgress({
      jobId,
      createdBy,
      lockToken: claim.lockToken,
      note: message,
      batchNumber: lockedWindow.batchNumber,
      fromIndex: lockedWindow.fromIndex,
      toIndex: lockedWindow.toIndex,
    });

    return NextResponse.json(
      {
        ok: false,
        error: message,
        retryable: true,
        code: "BATCH_COUNT_MISMATCH",
        job: toPlainBulkJob(released || lockedJob),
      },
      { status: 409 }
    );
  }

  const expectedRows = getExpectedBatchRows(
    lockedJob,
    lockedWindow.fromIndex,
    lockedWindow.toIndex
  );

  for (let i = 0; i < expectedRows.length; i++) {
    const expectedName = normalizeName(safeStr(expectedRows[i]?.fileName));
    const receivedName = normalizeName(batchFiles[i]?.name);

    if (!expectedName || !receivedName || expectedName !== receivedName) {
      const message =
        `Batch file order mismatch at position ${i + 1}. ` +
        `Expected "${expectedName || "-"}", received "${receivedName || "-"}". ` +
        `Agar page refresh hua tha to same original PDF list dubara select karke retry karo.`;

      const released = await unlockBatchWithoutProgress({
        jobId,
        createdBy,
        lockToken: claim.lockToken,
        note: message,
        batchNumber: lockedWindow.batchNumber,
        fromIndex: lockedWindow.fromIndex,
        toIndex: lockedWindow.toIndex,
      });

      return NextResponse.json(
        {
          ok: false,
          error: message,
          retryable: true,
          code: "BATCH_ORDER_MISMATCH",
          job: toPlainBulkJob(released || lockedJob),
        },
        { status: 409 }
      );
    }
  }

  let batchResult: Awaited<ReturnType<typeof processBulkSolvedPdfsJobBatch>>;

  try {
    batchResult = await processBulkSolvedPdfsJobBatch({
      job: lockedJob,
      batchNumber: lockedWindow.batchNumber,
      fromIndex: lockedWindow.fromIndex,
      toIndex: lockedWindow.toIndex,
      batchFiles,
    });
  } catch (error: any) {
    const failedJob = await failBulkUploadJob({
      jobId,
      createdBy,
      lockToken: claim.lockToken,
      message: safeStr(error?.message || "Solved PDFs batch processing failed"),
    });

    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message || "Solved PDFs batch processing failed"),
        code: "MULTIPART_BATCH_PROCESSING_FAILED",
        job: toPlainBulkJob(failedJob),
      },
      { status: 500 }
    );
  }

  try {
    const updatedJob = await completeBulkUploadJobBatch({
      jobId,
      createdBy,
      lockToken: claim.lockToken,
      processedDelta: batchResult.processedDelta,
      successDelta: batchResult.successDelta,
      failedDelta: batchResult.failedDelta,
      skippedDelta: batchResult.skippedDelta,
      validDelta: batchResult.validDelta,
      nextLastProcessedIndex: batchResult.nextLastProcessedIndex,
      batchNumber: batchResult.batchNumber,
      fromIndex: batchResult.fromIndex,
      toIndex: batchResult.toIndex,
      attempted: batchResult.attempted,
      failures: batchResult.failures,
      note: batchResult.note,
      summaryPatch: batchResult.summaryPatch,
    });

    return NextResponse.json(
      {
        ok: true,
        message: batchResult.note,
        job: toPlainBulkJob(updatedJob),
      },
      { status: 200 }
    );
  } catch (error: any) {
    const failedJob = await failBulkUploadJob({
      jobId,
      createdBy,
      lockToken: claim.lockToken,
      message:
        safeStr(error?.message) ||
        "Multipart batch completed but job state update failed",
    });

    return NextResponse.json(
      {
        ok: false,
        error:
          safeStr(error?.message) ||
          "Multipart batch completed but job state update failed",
        code: "MULTIPART_STATE_UPDATE_FAILED",
        job: toPlainBulkJob(failedJob),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const guard = await assertVaultWriteAccess();
  if (!guard.ok) return guard.res;

  const createdBy = safeStr(guard.user.email);
  const contentType = safeStr(req.headers.get("content-type")).toLowerCase();

  if (contentType.includes("application/json")) {
    return handleDirectFinalize(req, createdBy);
  }

  return handleMultipartUpload(req, createdBy);
}