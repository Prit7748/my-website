import crypto from "crypto";
import dbConnect from "@/lib/db";
import BulkUploadJob from "@/models/BulkUploadJob";

export type BulkJobType =
  | "product_details"
  | "product_images"
  | "official_papers"
  | "solved_pdfs";

export type BulkJobStatus =
  | "queued"
  | "running"
  | "processing_batch"
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "cancelled";

export type BulkJobFailureInput = {
  itemIndex?: number;
  rowNumber?: number;
  batchNumber?: number;
  identifier?: string;
  sku?: string;
  fileName?: string;
  status?: string;
  reason?: string;
  raw?: any;
};

export type BulkJobInputAppendPatch = {
  prevalidationSeenSkus?: string[];
  prevalidatedRows?: any[];
};

export type BulkJobAppendProgressArgs = {
  jobId: string;
  createdBy: string;
  processedDelta?: number;
  successDelta?: number;
  failedDelta?: number;
  skippedDelta?: number;
  validDelta?: number;
  failures?: BulkJobFailureInput[];
  summaryPatch?: Record<string, any>;
  note?: string;
  batchNumber?: number;
  fromIndex?: number;
  toIndex?: number;
  attempted?: number;
  startedAt?: Date | string | null;
  heartbeatAt?: Date | string | null;
  inputPatch?: Record<string, any>;
  inputAppendPatch?: BulkJobInputAppendPatch;
};

const FINAL_STATUSES = new Set<BulkJobStatus>([
  "completed",
  "completed_with_errors",
  "failed",
  "cancelled",
]);

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : def;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function asDateOrNull(input: any) {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sanitizeRawRow(raw: any) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(raw)) {
    const cleanKey = safeStr(key).slice(0, 80);
    if (!cleanKey) continue;
    out[cleanKey] = safeStr(value).slice(0, 5000);
  }

  return Object.keys(out).length ? out : null;
}

function sanitizeFailure(row: BulkJobFailureInput) {
  return {
    itemIndex: safeNum(row?.itemIndex, 0),
    rowNumber: safeNum(row?.rowNumber, 0),
    batchNumber: safeNum(row?.batchNumber, 0),
    identifier: safeStr(row?.identifier),
    sku: safeStr(row?.sku).toUpperCase(),
    fileName: safeStr(row?.fileName),
    status: safeStr(row?.status || "failed"),
    reason: safeStr(row?.reason).slice(0, 3000),
    raw: sanitizeRawRow(row?.raw),
    createdAt: new Date(),
  };
}

function sanitizeFailures(rows: BulkJobFailureInput[] = []) {
  return rows.map(sanitizeFailure);
}

function mergeSummary(current: any, patch: any) {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? { ...current }
      : {};
  const next =
    patch && typeof patch === "object" && !Array.isArray(patch) ? patch : {};

  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) continue;

    const existing = (base as any)[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      const existingNum = Number(existing);
      if (Number.isFinite(existingNum)) {
        (base as any)[key] = existingNum + value;
      } else {
        (base as any)[key] = value;
      }
      continue;
    }

    (base as any)[key] = value;
  }

  return base;
}

function overwriteSummary(current: any, patch: any) {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? { ...current }
      : {};
  const next =
    patch && typeof patch === "object" && !Array.isArray(patch) ? patch : {};
  return { ...base, ...next };
}

function overwriteObject(current: any, patch: any) {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? { ...current }
      : {};
  const next =
    patch && typeof patch === "object" && !Array.isArray(patch) ? patch : {};
  return { ...base, ...next };
}

function uniqueStrings(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of arr) {
    const clean = safeStr(item);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }

  return out;
}

function stableRowKey(row: any, indexFallback = -1) {
  const itemIndex = Number(row?.itemIndex);
  if (Number.isFinite(itemIndex) && itemIndex >= 0) {
    return `item:${Math.trunc(itemIndex)}`;
  }

  const rowNumber = Number(row?.rowNumber);
  const sku = safeStr(row?.sku).toUpperCase();
  if (Number.isFinite(rowNumber) && rowNumber >= 0 && sku) {
    return `row:${Math.trunc(rowNumber)}::sku:${sku}`;
  }

  if (Number.isFinite(rowNumber) && rowNumber >= 0) {
    return `row:${Math.trunc(rowNumber)}`;
  }

  if (sku) {
    return `sku:${sku}`;
  }

  return `fallback:${indexFallback}`;
}

function appendUniqueObjectRows(existingRows: any[], incomingRows: any[]) {
  const map = new Map<string, any>();

  for (let i = 0; i < existingRows.length; i++) {
    const row = existingRows[i];
    map.set(stableRowKey(row, i), row);
  }

  for (let i = 0; i < incomingRows.length; i++) {
    const row = incomingRows[i];
    map.set(stableRowKey(row, existingRows.length + i), row);
  }

  return Array.from(map.values());
}

function applyInputAppendPatch(currentInput: any, appendPatch?: BulkJobInputAppendPatch) {
  const nextInput =
    currentInput && typeof currentInput === "object" && !Array.isArray(currentInput)
      ? { ...currentInput }
      : {};

  if (!appendPatch || typeof appendPatch !== "object" || Array.isArray(appendPatch)) {
    return nextInput;
  }

  if (Array.isArray(appendPatch.prevalidationSeenSkus) && appendPatch.prevalidationSeenSkus.length) {
    const existing = Array.isArray(nextInput.prevalidationSeenSkus)
      ? nextInput.prevalidationSeenSkus.map((x: any) => safeStr(x).toUpperCase())
      : [];
    const incoming = appendPatch.prevalidationSeenSkus.map((x) =>
      safeStr(x).toUpperCase()
    );
    nextInput.prevalidationSeenSkus = uniqueStrings([...existing, ...incoming]);
  }

  if (Array.isArray(appendPatch.prevalidatedRows) && appendPatch.prevalidatedRows.length) {
    const existing = Array.isArray(nextInput.prevalidatedRows)
      ? nextInput.prevalidatedRows
      : [];
    nextInput.prevalidatedRows = appendUniqueObjectRows(
      existing,
      appendPatch.prevalidatedRows
    );
  }

  return nextInput;
}

function computeFinalStatus(args: {
  totalItems: number;
  processedItems: number;
  failedItems: number;
}) {
  if (args.totalItems <= 0) return "completed" as BulkJobStatus;
  if (args.processedItems < args.totalItems) return "running" as BulkJobStatus;
  return args.failedItems > 0 ? "completed_with_errors" : "completed";
}

function buildRunningMessage(args: {
  note?: string;
  existingMessage?: string;
  finalStatus: BulkJobStatus;
}) {
  if (args.finalStatus === "completed") {
    return "Bulk job completed successfully.";
  }

  if (args.finalStatus === "completed_with_errors") {
    return "Bulk job completed with some failed items.";
  }

  return safeStr(args.note || args.existingMessage || "");
}

export function isFinalBulkJobStatus(status: string) {
  return FINAL_STATUSES.has((safeStr(status) || "") as BulkJobStatus);
}

export function toPlainBulkJob(job: any) {
  if (!job) return null;

  const totalItems = safeNum(job?.progress?.totalItems, 0);
  const processedItems = safeNum(job?.progress?.processedItems, 0);

  const progressPercent =
    totalItems > 0 ? Math.min(100, Math.round((processedItems / totalItems) * 100)) : 0;

  return {
    _id: String(job._id),
    jobType: safeStr(job.jobType),
    jobLabel: safeStr(job.jobLabel),
    status: safeStr(job.status),
    createdBy: safeStr(job.createdBy),

    meta: job.meta ?? {},
    config: job.config ?? {},
    input: job.input ?? {},
    summary: job.summary ?? {},

    progress: {
      totalItems,
      processedItems,
      successItems: safeNum(job?.progress?.successItems, 0),
      failedItems: safeNum(job?.progress?.failedItems, 0),
      skippedItems: safeNum(job?.progress?.skippedItems, 0),
      validItems: safeNum(job?.progress?.validItems, 0),
      batchSize: safeNum(job?.progress?.batchSize, 0),
      batchCount: safeNum(job?.progress?.batchCount, 0),
      currentBatchNumber: safeNum(job?.progress?.currentBatchNumber, 0),
      lastProcessedIndex: Math.max(
        -1,
        Math.trunc(Number(job?.progress?.lastProcessedIndex ?? -1))
      ),
      progressPercent,
    },

    lastBatch: job.lastBatch
      ? {
          batchNumber: safeNum(job?.lastBatch?.batchNumber, 0),
          fromIndex: Math.max(-1, Math.trunc(Number(job?.lastBatch?.fromIndex ?? -1))),
          toIndex: Math.max(-1, Math.trunc(Number(job?.lastBatch?.toIndex ?? -1))),
          attempted: safeNum(job?.lastBatch?.attempted, 0),
          success: safeNum(job?.lastBatch?.success, 0),
          failed: safeNum(job?.lastBatch?.failed, 0),
          skipped: safeNum(job?.lastBatch?.skipped, 0),
          startedAt: job?.lastBatch?.startedAt || null,
          endedAt: job?.lastBatch?.endedAt || null,
          note: safeStr(job?.lastBatch?.note),
        }
      : null,

    failuresCount: Array.isArray(job?.failures) ? job.failures.length : 0,
    recentFailures: Array.isArray(job?.failures)
      ? job.failures.slice(-100).map((row: any) => ({
          itemIndex: safeNum(row?.itemIndex, 0),
          rowNumber: safeNum(row?.rowNumber, 0),
          batchNumber: safeNum(row?.batchNumber, 0),
          identifier: safeStr(row?.identifier),
          sku: safeStr(row?.sku),
          fileName: safeStr(row?.fileName),
          status: safeStr(row?.status),
          reason: safeStr(row?.reason),
          createdAt: row?.createdAt || null,
        }))
      : [],

    resultMessage: safeStr(job?.resultMessage),
    downloadFileName: safeStr(job?.downloadFileName),

    startedAt: job?.startedAt || null,
    completedAt: job?.completedAt || null,
    failedAt: job?.failedAt || null,
    cancelledAt: job?.cancelledAt || null,
    lastHeartbeatAt: job?.lastHeartbeatAt || null,
    createdAt: job?.createdAt || null,
    updatedAt: job?.updatedAt || null,
  };
}

export async function createBulkUploadJob(args: {
  jobType: BulkJobType;
  createdBy: string;
  jobLabel?: string;
  batchSize?: number;
  totalItems?: number;
  meta?: any;
  config?: any;
  input?: any;
  summary?: any;
  downloadFileName?: string;
}) {
  await dbConnect();

  const totalItems = safeNum(args.totalItems, 0);
  const batchSize = clamp(safeNum(args.batchSize, 100), 1, 1000);

  const created: any = await BulkUploadJob.create({
    jobType: safeStr(args.jobType),
    jobLabel: safeStr(args.jobLabel),
    status: "queued",
    createdBy: safeStr(args.createdBy),

    meta: args.meta ?? {},
    config: args.config ?? {},
    input: args.input ?? {},
    summary: args.summary ?? {},

    progress: {
      totalItems,
      processedItems: 0,
      successItems: 0,
      failedItems: 0,
      skippedItems: 0,
      validItems: 0,
      batchSize,
      batchCount: totalItems > 0 ? Math.ceil(totalItems / batchSize) : 0,
      currentBatchNumber: 0,
      lastProcessedIndex: -1,
    },

    lastBatch: {
      batchNumber: 0,
      fromIndex: -1,
      toIndex: -1,
      attempted: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      startedAt: null,
      endedAt: null,
      note: "",
    },

    failures: [],
    resultMessage: "",
    downloadFileName: safeStr(args.downloadFileName || ""),
    lockToken: "",
    lockExpiresAt: null,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
    lastHeartbeatAt: null,
  });

  return created;
}

export async function getBulkUploadJob(jobId: string, createdBy?: string) {
  await dbConnect();

  const query: any = { _id: safeStr(jobId) };
  if (safeStr(createdBy)) query.createdBy = safeStr(createdBy);

  const job: any = await BulkUploadJob.findOne(query);
  return job || null;
}

export async function getLatestActiveBulkUploadJob(args: {
  createdBy: string;
  jobType?: BulkJobType | string;
}) {
  await dbConnect();

  const query: any = {
    createdBy: safeStr(args.createdBy),
    status: { $nin: Array.from(FINAL_STATUSES) },
  };

  if (safeStr(args.jobType)) {
    query.jobType = safeStr(args.jobType);
  }

  const job: any = await BulkUploadJob.findOne(query).sort({ createdAt: -1, _id: -1 });
  return job || null;
}

export async function updateBulkUploadJobInput(args: {
  jobId: string;
  createdBy: string;
  inputPatch?: Record<string, any>;
  inputAppendPatch?: BulkJobInputAppendPatch;
  metaPatch?: Record<string, any>;
  configPatch?: Record<string, any>;
  summaryPatch?: Record<string, any>;
}) {
  await dbConnect();

  const job: any = await BulkUploadJob.findOne({
    _id: safeStr(args.jobId),
    createdBy: safeStr(args.createdBy),
  });

  if (!job) {
    throw new Error("Job not found");
  }

  if (isFinalBulkJobStatus(job.status)) {
    return job;
  }

  const nextInput = applyInputAppendPatch(
    overwriteObject(job.input || {}, args.inputPatch || {}),
    args.inputAppendPatch
  );

  const nextMeta = overwriteObject(job.meta || {}, args.metaPatch || {});
  const nextConfig = overwriteObject(job.config || {}, args.configPatch || {});
  const nextSummary = mergeSummary(job.summary || {}, args.summaryPatch || {});

  const updated: any = await BulkUploadJob.findOneAndUpdate(
    {
      _id: String(job._id),
      createdBy: safeStr(args.createdBy),
    },
    {
      $set: {
        input: nextInput,
        meta: nextMeta,
        config: nextConfig,
        summary: nextSummary,
        lastHeartbeatAt: new Date(),
      },
    },
    { new: true }
  );

  return updated;
}

export async function startBulkUploadJob(args: {
  jobId: string;
  createdBy: string;
  message?: string;
  summaryPatch?: Record<string, any>;
}) {
  await dbConnect();

  const job: any = await BulkUploadJob.findOne({
    _id: safeStr(args.jobId),
    createdBy: safeStr(args.createdBy),
  });

  if (!job) {
    throw new Error("Job not found");
  }

  if (isFinalBulkJobStatus(job.status)) {
    return job;
  }

  const now = new Date();
  const nextSummary = mergeSummary(job.summary || {}, args.summaryPatch || {});

  const updated: any = await BulkUploadJob.findOneAndUpdate(
    {
      _id: String(job._id),
      createdBy: safeStr(args.createdBy),
    },
    {
      $set: {
        status: "running",
        startedAt: job?.startedAt || now,
        lastHeartbeatAt: now,
        resultMessage: safeStr(args.message || job?.resultMessage || ""),
        summary: nextSummary,
      },
    },
    { new: true }
  );

  return updated;
}

export async function touchBulkUploadJobHeartbeat(args: {
  jobId: string;
  createdBy: string;
  note?: string;
}) {
  await dbConnect();

  const job: any = await BulkUploadJob.findOne({
    _id: safeStr(args.jobId),
    createdBy: safeStr(args.createdBy),
  });

  if (!job) {
    throw new Error("Job not found");
  }

  if (isFinalBulkJobStatus(job.status)) {
    return job;
  }

  const updated: any = await BulkUploadJob.findOneAndUpdate(
    {
      _id: String(job._id),
      createdBy: safeStr(args.createdBy),
    },
    {
      $set: {
        status: "running",
        startedAt: job?.startedAt || new Date(),
        lastHeartbeatAt: new Date(),
        ...(safeStr(args.note) ? { resultMessage: safeStr(args.note) } : {}),
      },
    },
    { new: true }
  );

  return updated;
}

export async function appendBulkUploadJobProgress(args: BulkJobAppendProgressArgs) {
  await dbConnect();

  const job: any = await BulkUploadJob.findOne({
    _id: safeStr(args.jobId),
    createdBy: safeStr(args.createdBy),
  });

  if (!job) {
    throw new Error("Job not found");
  }

  if (isFinalBulkJobStatus(job.status)) {
    return job;
  }

  const totalItems = safeNum(job?.progress?.totalItems, 0);
  const currentProcessed = safeNum(job?.progress?.processedItems, 0);
  const currentFailed = safeNum(job?.progress?.failedItems, 0);

  const processedDelta = safeNum(args.processedDelta, 0);
  const successDelta = safeNum(args.successDelta, 0);
  const failedDelta = safeNum(args.failedDelta, 0);
  const skippedDelta = safeNum(args.skippedDelta, 0);
  const validDelta = safeNum(args.validDelta, 0);

  const nextProcessed = Math.min(totalItems, currentProcessed + processedDelta);
  const nextFailed = currentFailed + failedDelta;
  const nextStatus = computeFinalStatus({
    totalItems,
    processedItems: nextProcessed,
    failedItems: nextFailed,
  });

  const cleanFailures = sanitizeFailures(args.failures || []);
  const nextSummary = mergeSummary(job.summary || {}, args.summaryPatch || {});
  const nextInput = applyInputAppendPatch(
    overwriteObject(job.input || {}, args.inputPatch || {}),
    args.inputAppendPatch
  );

  const startedAt =
    asDateOrNull(args.startedAt) || asDateOrNull(job?.startedAt) || new Date();

  const heartbeatAt = asDateOrNull(args.heartbeatAt) || new Date();

  const safeFromIndex =
    typeof args.fromIndex === "number"
      ? Math.max(-1, Math.trunc(Number(args.fromIndex)))
      : Math.max(-1, Math.trunc(Number(job?.lastBatch?.fromIndex ?? -1)));

  const safeToIndex =
    typeof args.toIndex === "number"
      ? Math.max(-1, Math.trunc(Number(args.toIndex)))
      : Math.max(-1, Math.trunc(Number(job?.progress?.lastProcessedIndex ?? -1)));

  const safeBatchNumber =
    typeof args.batchNumber === "number"
      ? safeNum(args.batchNumber, 0)
      : safeNum(job?.progress?.currentBatchNumber, 0);

  const safeAttempted =
    typeof args.attempted === "number"
      ? safeNum(args.attempted, 0)
      : processedDelta;

  const updated: any = await BulkUploadJob.findOneAndUpdate(
    {
      _id: String(job._id),
      createdBy: safeStr(args.createdBy),
    },
    {
      $inc: {
        "progress.processedItems": processedDelta,
        "progress.successItems": successDelta,
        "progress.failedItems": failedDelta,
        "progress.skippedItems": skippedDelta,
        "progress.validItems": validDelta,
      },
      $set: {
        status: nextStatus,
        input: nextInput,
        summary: nextSummary,
        startedAt,
        lastHeartbeatAt: heartbeatAt,
        completedAt:
          nextStatus === "completed" || nextStatus === "completed_with_errors"
            ? new Date()
            : null,
        resultMessage: buildRunningMessage({
          note: args.note,
          existingMessage: job?.resultMessage,
          finalStatus: nextStatus,
        }),
        "progress.currentBatchNumber": safeBatchNumber,
        "progress.lastProcessedIndex": safeToIndex,
        lastBatch: {
          batchNumber: safeBatchNumber,
          fromIndex: safeFromIndex,
          toIndex: safeToIndex,
          attempted: safeAttempted,
          success: successDelta,
          failed: failedDelta,
          skipped: skippedDelta,
          startedAt:
            asDateOrNull(args.startedAt) ||
            asDateOrNull(job?.lastBatch?.startedAt) ||
            heartbeatAt,
          endedAt: heartbeatAt,
          note: safeStr(args.note),
        },
        lockToken: "",
        lockExpiresAt: null,
      },
      ...(cleanFailures.length
        ? {
            $push: {
              failures: {
                $each: cleanFailures,
              },
            },
          }
        : {}),
    },
    { new: true }
  );

  return updated;
}

export async function finalizeBulkUploadJob(args: {
  jobId: string;
  createdBy: string;
  message?: string;
  summaryPatch?: Record<string, any>;
  inputPatch?: Record<string, any>;
  inputAppendPatch?: BulkJobInputAppendPatch;
}) {
  await dbConnect();

  const job: any = await BulkUploadJob.findOne({
    _id: safeStr(args.jobId),
    createdBy: safeStr(args.createdBy),
  });

  if (!job) {
    throw new Error("Job not found");
  }

  if (isFinalBulkJobStatus(job.status)) {
    return job;
  }

  const totalItems = safeNum(job?.progress?.totalItems, 0);
  const processedItems = safeNum(job?.progress?.processedItems, 0);
  const failedItems = safeNum(job?.progress?.failedItems, 0);
  const nextSummary = overwriteSummary(job.summary || {}, args.summaryPatch || {});
  const nextInput = applyInputAppendPatch(
    overwriteObject(job.input || {}, args.inputPatch || {}),
    args.inputAppendPatch
  );

  const finalStatus: BulkJobStatus =
    processedItems >= totalItems
      ? failedItems > 0
        ? "completed_with_errors"
        : "completed"
      : failedItems > 0
      ? "completed_with_errors"
      : "completed";

  const updated: any = await BulkUploadJob.findOneAndUpdate(
    {
      _id: String(job._id),
      createdBy: safeStr(args.createdBy),
    },
    {
      $set: {
        status: finalStatus,
        input: nextInput,
        summary: nextSummary,
        completedAt: new Date(),
        lastHeartbeatAt: new Date(),
        lockToken: "",
        lockExpiresAt: null,
        resultMessage:
          safeStr(args.message) ||
          (finalStatus === "completed"
            ? "Bulk job completed successfully."
            : "Bulk job completed with some failed items."),
      },
    },
    { new: true }
  );

  return updated;
}

export async function claimBulkUploadJobBatch(args: {
  jobId: string;
  createdBy: string;
  lockMs?: number;
}) {
  await dbConnect();

  const jobId = safeStr(args.jobId);
  const createdBy = safeStr(args.createdBy);
  const now = new Date();
  const lockMs = clamp(safeNum(args.lockMs, 120000), 10000, 15 * 60 * 1000);

  const current: any = await BulkUploadJob.findOne({
    _id: jobId,
    createdBy,
  });

  if (!current) {
    return { ok: false as const, error: "Job not found" };
  }

  if (isFinalBulkJobStatus(current.status)) {
    return { ok: false as const, error: "Job already finished" };
  }

  const totalItems = safeNum(current?.progress?.totalItems, 0);
  const processedItems = safeNum(current?.progress?.processedItems, 0);

  if (totalItems > 0 && processedItems >= totalItems) {
    return { ok: false as const, error: "All items already processed" };
  }

  const lockExpiresAt = current?.lockExpiresAt ? new Date(current.lockExpiresAt) : null;
  if (
    safeStr(current?.lockToken) &&
    lockExpiresAt &&
    lockExpiresAt.getTime() > now.getTime()
  ) {
    return { ok: false as const, error: "Job is already processing another batch" };
  }

  const lockToken = crypto.randomBytes(12).toString("hex");
  const nextLockExpiresAt = new Date(now.getTime() + lockMs);

  const claimed: any = await BulkUploadJob.findOneAndUpdate(
    {
      _id: jobId,
      createdBy,
      $or: [
        { lockToken: "" },
        { lockToken: null },
        { lockExpiresAt: null },
        { lockExpiresAt: { $lte: now } },
      ],
      status: { $in: ["queued", "running", "processing_batch"] },
    },
    {
      $set: {
        status: "processing_batch",
        lockToken,
        lockExpiresAt: nextLockExpiresAt,
        lastHeartbeatAt: now,
        startedAt: current?.startedAt || now,
      },
    },
    { new: true }
  );

  if (!claimed) {
    return { ok: false as const, error: "Job could not be locked right now" };
  }

  return {
    ok: true as const,
    lockToken,
    job: claimed,
  };
}

export async function completeBulkUploadJobBatch(args: {
  jobId: string;
  createdBy: string;
  lockToken: string;
  processedDelta: number;
  successDelta?: number;
  failedDelta?: number;
  skippedDelta?: number;
  validDelta?: number;
  nextLastProcessedIndex: number;
  batchNumber: number;
  fromIndex: number;
  toIndex: number;
  attempted: number;
  failures?: BulkJobFailureInput[];
  note?: string;
  summaryPatch?: Record<string, any>;
  inputPatch?: Record<string, any>;
  inputAppendPatch?: BulkJobInputAppendPatch;
}) {
  await dbConnect();

  const job: any = await BulkUploadJob.findOne({
    _id: safeStr(args.jobId),
    createdBy: safeStr(args.createdBy),
    lockToken: safeStr(args.lockToken),
  });

  if (!job) {
    throw new Error("Locked job not found");
  }

  const totalItems = safeNum(job?.progress?.totalItems, 0);
  const currentProcessed = safeNum(job?.progress?.processedItems, 0);
  const currentFailed = safeNum(job?.progress?.failedItems, 0);

  const processedDelta = safeNum(args.processedDelta, 0);
  const successDelta = safeNum(args.successDelta, 0);
  const failedDelta = safeNum(args.failedDelta, 0);
  const skippedDelta = safeNum(args.skippedDelta, 0);
  const validDelta = safeNum(args.validDelta, 0);

  const nextProcessed = Math.min(totalItems, currentProcessed + processedDelta);
  const nextFailed = currentFailed + failedDelta;

  const finalStatus: BulkJobStatus =
    nextProcessed >= totalItems
      ? nextFailed > 0
        ? "completed_with_errors"
        : "completed"
      : "running";

  const cleanFailures = sanitizeFailures(args.failures || []);
  const nextSummary = overwriteSummary(job.summary || {}, args.summaryPatch || {});
  const nextInput = applyInputAppendPatch(
    overwriteObject(job.input || {}, args.inputPatch || {}),
    args.inputAppendPatch
  );

  const now = new Date();

  const updated: any = await BulkUploadJob.findOneAndUpdate(
    {
      _id: String(job._id),
      createdBy: safeStr(args.createdBy),
      lockToken: safeStr(args.lockToken),
    },
    {
      $inc: {
        "progress.processedItems": processedDelta,
        "progress.successItems": successDelta,
        "progress.failedItems": failedDelta,
        "progress.skippedItems": skippedDelta,
        "progress.validItems": validDelta,
      },
      $set: {
        status: finalStatus,
        input: nextInput,
        summary: nextSummary,
        "progress.currentBatchNumber": safeNum(args.batchNumber, 0),
        "progress.lastProcessedIndex": Math.max(
          -1,
          Math.trunc(Number(args.nextLastProcessedIndex ?? -1))
        ),
        lastBatch: {
          batchNumber: safeNum(args.batchNumber, 0),
          fromIndex: Math.max(-1, Math.trunc(Number(args.fromIndex ?? -1))),
          toIndex: Math.max(-1, Math.trunc(Number(args.toIndex ?? -1))),
          attempted: safeNum(args.attempted, 0),
          success: successDelta,
          failed: failedDelta,
          skipped: skippedDelta,
          startedAt: asDateOrNull(job?.lastBatch?.startedAt) || job?.lastHeartbeatAt || now,
          endedAt: now,
          note: safeStr(args.note),
        },
        resultMessage: buildRunningMessage({
          note: args.note,
          existingMessage: job?.resultMessage,
          finalStatus,
        }),
        lockToken: "",
        lockExpiresAt: null,
        lastHeartbeatAt: now,
        completedAt:
          finalStatus === "completed" || finalStatus === "completed_with_errors"
            ? now
            : null,
      },
      ...(cleanFailures.length
        ? {
            $push: {
              failures: {
                $each: cleanFailures,
              },
            },
          }
        : {}),
    },
    { new: true }
  );

  return updated;
}

export async function failBulkUploadJob(args: {
  jobId: string;
  createdBy: string;
  lockToken?: string;
  message: string;
  failures?: BulkJobFailureInput[];
  summaryPatch?: Record<string, any>;
  inputPatch?: Record<string, any>;
  inputAppendPatch?: BulkJobInputAppendPatch;
}) {
  await dbConnect();

  const query: any = {
    _id: safeStr(args.jobId),
    createdBy: safeStr(args.createdBy),
  };

  if (safeStr(args.lockToken)) {
    query.lockToken = safeStr(args.lockToken);
  }

  const existing: any = await BulkUploadJob.findOne(query);
  if (!existing) {
    throw new Error("Job not found while failing");
  }

  const cleanFailures = sanitizeFailures(args.failures || []);
  const nextSummary = overwriteSummary(existing.summary || {}, args.summaryPatch || {});
  const nextInput = applyInputAppendPatch(
    overwriteObject(existing.input || {}, args.inputPatch || {}),
    args.inputAppendPatch
  );

  const updated: any = await BulkUploadJob.findOneAndUpdate(
    query,
    {
      $set: {
        status: "failed",
        input: nextInput,
        summary: nextSummary,
        resultMessage: safeStr(args.message || "Bulk job failed"),
        failedAt: new Date(),
        completedAt: new Date(),
        lockToken: "",
        lockExpiresAt: null,
        lastHeartbeatAt: new Date(),
      },
      ...(cleanFailures.length
        ? {
            $push: {
              failures: {
                $each: cleanFailures,
              },
            },
          }
        : {}),
    },
    { new: true }
  );

  if (!updated) {
    throw new Error("Job not found while failing");
  }

  return updated;
}

export async function cancelBulkUploadJob(args: {
  jobId: string;
  createdBy: string;
}) {
  await dbConnect();

  const job: any = await BulkUploadJob.findOne({
    _id: safeStr(args.jobId),
    createdBy: safeStr(args.createdBy),
  });

  if (!job) {
    return { ok: false as const, error: "Job not found" };
  }

  if (isFinalBulkJobStatus(job.status)) {
    return { ok: true as const, job };
  }

  const updated: any = await BulkUploadJob.findOneAndUpdate(
    {
      _id: String(job._id),
      createdBy: safeStr(args.createdBy),
    },
    {
      $set: {
        status: "cancelled",
        resultMessage: "Bulk job cancelled by user.",
        cancelledAt: new Date(),
        completedAt: new Date(),
        lockToken: "",
        lockExpiresAt: null,
        lastHeartbeatAt: new Date(),
      },
    },
    { new: true }
  );

  return { ok: true as const, job: updated };
}

function csvCell(input: any) {
  const raw = safeStr(input).replace(/\r?\n/g, " ");
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

function collectFailureRawColumns(rows: any[]) {
  const preferredOrder = [
    "unique_id",
    "subject_code",
    "session",
    "language",
    "course_code",
    "A",
    "B",
    "C",
    "D",
    "E",
  ];

  const found = new Set<string>();

  for (const key of preferredOrder) {
    if (
      rows.some(
        (row: any) =>
          row?.raw &&
          typeof row.raw === "object" &&
          !Array.isArray(row.raw) &&
          safeStr(row.raw[key]) !== ""
      )
    ) {
      found.add(key);
    }
  }

  for (const row of rows) {
    const raw = row?.raw;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;

    for (const key of Object.keys(raw)) {
      const cleanKey = safeStr(key);
      if (!cleanKey) continue;
      found.add(cleanKey);
    }
  }

  return Array.from(found);
}

export function buildBulkJobFailuresCsv(job: any) {
  const rows = Array.isArray(job?.failures) ? job.failures : [];
  const rawColumns = collectFailureRawColumns(rows);

  const header = [
    "Item Index",
    "Row Number",
    "Batch Number",
    "Identifier",
    "SKU",
    "File Name",
    "Status",
    "Reason",
    ...rawColumns,
    "Created At",
  ];

  const body = rows.map((row: any) => {
    const baseCells = [
      csvCell(row?.itemIndex),
      csvCell(row?.rowNumber),
      csvCell(row?.batchNumber),
      csvCell(row?.identifier),
      csvCell(row?.sku),
      csvCell(row?.fileName),
      csvCell(row?.status),
      csvCell(row?.reason),
    ];

    const rawCells = rawColumns.map((col) => csvCell(row?.raw?.[col] ?? ""));

    return [
      ...baseCells,
      ...rawCells,
      csvCell(row?.createdAt ? new Date(row.createdAt).toISOString() : ""),
    ].join(",");
  });

  return [header.map(csvCell).join(","), ...body].join("\n");
}