import { NextRequest, NextResponse } from "next/server";

import dbConnect from "@/lib/db";
import BulkUploadJob from "@/models/BulkUploadJob";
import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  cancelBulkUploadJob,
  claimBulkUploadJobBatch,
  completeBulkUploadJobBatch,
  failBulkUploadJob,
  finalizeBulkUploadJob,
  getBulkUploadJob,
  isFinalBulkJobStatus,
  toPlainBulkJob,
} from "@/lib/bulkUploadJob";
import {
  getBulkDetailsDetailedStage,
  processBulkDetailsJobBatch,
} from "@/lib/bulkProductDetailsJob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_MAX_STEPS = 20;
const MAX_STEPS_LIMIT = 50;
const SOFT_TIME_BUDGET_MS = 20_000;
const CLAIM_LOCK_MS = 90_000;
const STALE_LOCK_RECOVERY_MS = 180_000;
const EXECUTION_BATCH_SIZE = 10;

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function cloneRecord(input: any) {
  return input && typeof input === "object" && !Array.isArray(input)
    ? { ...input }
    : {};
}

async function assertAdminWriteAccess() {
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

  return { ok: true as const, user };
}

function getRequestedJobId(req: NextRequest, body?: any) {
  const fromBody = safeStr(body?.jobId);
  if (fromBody) return fromBody;

  try {
    const url = new URL(req.url);
    return safeStr(url.searchParams.get("jobId"));
  } catch {
    return "";
  }
}

function getRequestedMaxSteps(body?: any) {
  return clamp(
    Math.trunc(safeNum(body?.maxSteps, DEFAULT_MAX_STEPS)),
    1,
    MAX_STEPS_LIMIT
  );
}

function getExecutionRows(job: any) {
  return Array.isArray(job?.input?.executionRows) ? job.input.executionRows : [];
}

function getExecutionTotalRows(job: any) {
  const summaryTotal = safeNum(job?.summary?.execution?.totalRows, -1);
  if (summaryTotal >= 0) return summaryTotal;
  return getExecutionRows(job).length;
}

function getExecutionProcessedRows(job: any) {
  const summaryProcessed = safeNum(job?.summary?.execution?.processedRows, -1);
  if (summaryProcessed >= 0) return summaryProcessed;
  return safeNum(job?.progress?.processedItems, 0);
}

function hasPendingRows(job: any) {
  if (!job || isFinalBulkJobStatus(job?.status)) return false;

  const stage = getBulkDetailsDetailedStage(job);

  if (stage === "completed") {
    return false;
  }

  if (stage === "execution") {
    const totalRows = getExecutionTotalRows(job);
    const processedRows = getExecutionProcessedRows(job);
    return processedRows < totalRows;
  }

  return true;
}

function isPauseRequested(job: any) {
  return Boolean(
    job?.summary?.needsManualResume === true || job?.meta?.pauseRequested === true
  );
}

function isCancelRequested(job: any) {
  return Boolean(job?.meta?.cancelRequested === true);
}

async function getOwnedJob(jobId: string, createdBy: string) {
  const job = await getBulkUploadJob(jobId, createdBy);
  return job || null;
}

async function recoverStaleLockIfNeeded(jobId: string, createdBy: string) {
  await dbConnect();

  const job: any = await BulkUploadJob.findOne({
    _id: safeStr(jobId),
    createdBy: safeStr(createdBy),
  });

  if (!job) return null;

  const now = new Date();
  const staleCutoff = new Date(now.getTime() - STALE_LOCK_RECOVERY_MS);
  const lockToken = safeStr(job?.lockToken);
  const lockExpiresAt = job?.lockExpiresAt ? new Date(job.lockExpiresAt) : null;
  const lastHeartbeatAt = job?.lastHeartbeatAt ? new Date(job.lastHeartbeatAt) : null;

  const lockExpired = Boolean(lockToken && lockExpiresAt && lockExpiresAt <= now);
  const staleProcessing =
    safeStr(job?.status) === "processing_batch" &&
    Boolean(lockToken) &&
    (!lastHeartbeatAt || lastHeartbeatAt <= staleCutoff);

  if (!lockExpired && !staleProcessing) {
    return job;
  }

  const summary = cloneRecord(job.summary);
  const meta = cloneRecord(job.meta);

  const updated: any = await BulkUploadJob.findOneAndUpdate(
    {
      _id: String(job._id),
      createdBy: safeStr(createdBy),
    },
    {
      $set: {
        status: summary.needsManualResume ? "queued" : "running",
        lockToken: "",
        lockExpiresAt: null,
        lastHeartbeatAt: now,
        resultMessage:
          "Previous processing lock recover kar diya gaya. Job resume ke liye ready hai.",
        summary,
        meta,
      },
    },
    { new: true }
  );

  return updated || job;
}

async function markJobPaused(jobId: string, createdBy: string, message?: string) {
  await dbConnect();

  const job: any = await BulkUploadJob.findOne({
    _id: safeStr(jobId),
    createdBy: safeStr(createdBy),
  });

  if (!job) return null;

  const now = new Date();
  const summary = cloneRecord(job.summary);
  const meta = cloneRecord(job.meta);

  summary.needsManualResume = true;
  summary.lastPausedAt = now;

  meta.pauseRequested = false;
  meta.pauseRequestedAt = null;

  const updated: any = await BulkUploadJob.findOneAndUpdate(
    {
      _id: String(job._id),
      createdBy: safeStr(createdBy),
    },
    {
      $set: {
        status: "queued",
        lockToken: "",
        lockExpiresAt: null,
        lastHeartbeatAt: now,
        summary,
        meta,
        resultMessage:
          safeStr(message) ||
          "Bulk job paused. Resume button se wahi se continue kar sakte ho.",
      },
    },
    { new: true }
  );

  return updated;
}

async function applyCancelIfRequested(jobId: string, createdBy: string) {
  const cancelled = await cancelBulkUploadJob({
    jobId,
    createdBy,
  });

  if (!cancelled.ok) return null;

  await dbConnect();

  const job: any = await BulkUploadJob.findOne({
    _id: safeStr(jobId),
    createdBy: safeStr(createdBy),
  });

  if (!job) return cancelled.job || null;

  const summary = cloneRecord(job.summary);
  const meta = cloneRecord(job.meta);

  meta.cancelRequested = false;
  meta.cancelRequestedAt = null;

  const updated: any = await BulkUploadJob.findOneAndUpdate(
    {
      _id: String(job._id),
      createdBy: safeStr(createdBy),
    },
    {
      $set: {
        summary,
        meta,
        resultMessage:
          "Bulk job cancelled. Jitni rows process ho chuki thi unka progress saved hai.",
      },
    },
    { new: true }
  );

  return updated || cancelled.job || null;
}

async function prepareExecutionProgressWindow(jobId: string, createdBy: string) {
  await dbConnect();

  const job: any = await BulkUploadJob.findOne({
    _id: safeStr(jobId),
    createdBy: safeStr(createdBy),
  });

  if (!job) return null;

  const executionTotalRows = getExecutionTotalRows(job);
  const executionProcessedRows = Math.min(
    getExecutionProcessedRows(job),
    executionTotalRows
  );

  const batchCount =
    executionTotalRows > 0
      ? Math.ceil(executionTotalRows / EXECUTION_BATCH_SIZE)
      : 0;

  const currentBatchNumber =
    executionProcessedRows > 0
      ? Math.ceil(executionProcessedRows / EXECUTION_BATCH_SIZE)
      : 0;

  const updated: any = await BulkUploadJob.findOneAndUpdate(
    {
      _id: String(job._id),
      createdBy: safeStr(createdBy),
    },
    {
      $set: {
        "progress.totalItems": executionTotalRows,
        "progress.processedItems": executionProcessedRows,
        "progress.batchSize": EXECUTION_BATCH_SIZE,
        "progress.batchCount": batchCount,
        "progress.currentBatchNumber": currentBatchNumber,
        "progress.lastProcessedIndex": executionProcessedRows - 1,
        lastHeartbeatAt: new Date(),
      },
    },
    { new: true }
  );

  return updated || job;
}

async function maybePrepareExecutionProgressWindow(jobId: string, createdBy: string) {
  const job = await getOwnedJob(jobId, createdBy);
  if (!job) return null;

  if (getBulkDetailsDetailedStage(job) !== "execution") {
    return job;
  }

  const executionTotalRows = getExecutionTotalRows(job);
  const currentTotalItems = safeNum(job?.progress?.totalItems, 0);
  const currentBatchSize = safeNum(job?.progress?.batchSize, 0);

  if (
    currentTotalItems !== executionTotalRows ||
    currentBatchSize !== EXECUTION_BATCH_SIZE
  ) {
    return prepareExecutionProgressWindow(jobId, createdBy);
  }

  return job;
}

async function processSingleStep(jobDoc: any) {
  const jobId = safeStr(jobDoc?._id);
  const createdBy = safeStr(jobDoc?.createdBy);

  if (!jobId || !createdBy) {
    return {
      ok: false as const,
      reason: "Invalid job identity",
      blocked: true,
    };
  }

  const claim = await claimBulkUploadJobBatch({
    jobId,
    createdBy,
    lockMs: CLAIM_LOCK_MS,
  });

  if (!claim.ok) {
    return {
      ok: false as const,
      reason: safeStr(claim.error || "Job could not be locked"),
      blocked: true,
      jobId,
      createdBy,
    };
  }

  let lockedJob: any = claim.job;

  if (isCancelRequested(lockedJob)) {
    const cancelledJob = await applyCancelIfRequested(jobId, createdBy);

    return {
      ok: true as const,
      blocked: true,
      cancelled: true,
      jobId,
      createdBy,
      updatedJob: cancelledJob,
      reason: "Cancel request applied",
    };
  }

  if (isPauseRequested(lockedJob)) {
    const pausedJob = await markJobPaused(
      jobId,
      createdBy,
      "Bulk job paused. Resume button se wahi se continue kar sakte ho."
    );

    return {
      ok: true as const,
      blocked: true,
      paused: true,
      jobId,
      createdBy,
      updatedJob: pausedJob,
      reason: "Pause request applied",
    };
  }

  const currentStage = getBulkDetailsDetailedStage(lockedJob);

  if (currentStage === "completed") {
    const finalJob = await finalizeBulkUploadJob({
      jobId,
      createdBy,
      message: "Bulk job completed successfully.",
    });

    return {
      ok: true as const,
      blocked: true,
      finished: true,
      jobId,
      createdBy,
      updatedJob: finalJob,
      reason: "Job already completed",
    };
  }

  if (currentStage === "execution") {
    lockedJob = await maybePrepareExecutionProgressWindow(jobId, createdBy);

    const executionTotalRows = getExecutionTotalRows(lockedJob);
    const executionProcessedRows = getExecutionProcessedRows(lockedJob);

    if (executionTotalRows <= 0 || executionProcessedRows >= executionTotalRows) {
      const finalJob = await finalizeBulkUploadJob({
        jobId,
        createdBy,
        message:
          executionTotalRows <= 0
            ? "Prevalidation ke baad koi valid row final upload/create ke liye nahi bachi."
            : "Bulk job completed successfully.",
      });

      return {
        ok: true as const,
        blocked: true,
        finished: true,
        jobId,
        createdBy,
        updatedJob: finalJob,
        reason: "No pending execution rows left",
      };
    }
  }

  let fromIndex = 0;
  let toIndex = 0;

  if (currentStage === "execution") {
    const processedRows = getExecutionProcessedRows(lockedJob);
    const totalRows = getExecutionTotalRows(lockedJob);

    fromIndex = processedRows;
    toIndex = Math.min(totalRows - 1, fromIndex + EXECUTION_BATCH_SIZE - 1);
  }

  try {
    const batchResult = await processBulkDetailsJobBatch({
      job: lockedJob,
      batchNumber: safeNum(lockedJob?.progress?.currentBatchNumber, 0) + 1,
      fromIndex,
      toIndex,
    });

    const nextPipelineStage = safeStr(batchResult?.summaryPatch?.pipelineStage).toLowerCase();
    const isExecutionStage = nextPipelineStage === "execution";
    const isCompletedStage = nextPipelineStage === "completed";

    const updatedJob = await completeBulkUploadJobBatch({
      jobId,
      createdBy,
      lockToken: claim.lockToken,
      processedDelta: currentStage === "execution" ? batchResult.processedDelta : 0,
      successDelta: currentStage === "execution" ? batchResult.successDelta : 0,
      failedDelta: batchResult.failedDelta,
      skippedDelta: batchResult.skippedDelta,
      validDelta: batchResult.validDelta,
      nextLastProcessedIndex:
        currentStage === "execution"
          ? batchResult.nextLastProcessedIndex
          : Math.max(-1, safeNum(lockedJob?.progress?.lastProcessedIndex, -1)),
      batchNumber: batchResult.batchNumber,
      fromIndex: batchResult.fromIndex,
      toIndex: batchResult.toIndex,
      attempted: batchResult.attempted,
      failures: batchResult.failures,
      note: batchResult.note,
      summaryPatch: batchResult.summaryPatch,
    });

    let finalUpdatedJob = updatedJob;

    if (isExecutionStage) {
      finalUpdatedJob = await maybePrepareExecutionProgressWindow(jobId, createdBy);
    }

    if (isCompletedStage) {
      finalUpdatedJob = await finalizeBulkUploadJob({
        jobId,
        createdBy,
        message: safeStr(batchResult.note || "Bulk job completed successfully."),
        summaryPatch: batchResult.summaryPatch,
      });
    }

    return {
      ok: true as const,
      blocked: false,
      jobId,
      createdBy,
      updatedJob: finalUpdatedJob,
      batchResult,
    };
  } catch (error: any) {
    const failedJob = await failBulkUploadJob({
      jobId,
      createdBy,
      lockToken: claim.lockToken,
      message: safeStr(error?.message || "Bulk details processing failed"),
    });

    return {
      ok: false as const,
      blocked: false,
      jobId,
      createdBy,
      failedJob,
      reason: safeStr(error?.message || "Bulk details processing failed"),
    };
  }
}

async function runManualProcessor(req: NextRequest) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const createdBy = safeStr(guard.user.email);
  const jobId = getRequestedJobId(req, body);
  const maxSteps = getRequestedMaxSteps(body);

  if (!jobId) {
    return NextResponse.json(
      { ok: false, error: "jobId required" },
      { status: 400 }
    );
  }

  let job: any = await recoverStaleLockIfNeeded(jobId, createdBy);

  if (!job) {
    return NextResponse.json(
      { ok: false, error: "Job not found" },
      { status: 404 }
    );
  }

  job = await maybePrepareExecutionProgressWindow(jobId, createdBy);

  if (isFinalBulkJobStatus(job.status)) {
    return NextResponse.json(
      {
        ok: true,
        message: "Job already finished.",
        processingState: "finished",
        stats: {
          processedSteps: 0,
          failedSteps: 0,
          elapsedMs: 0,
          maxSteps,
        },
        job: toPlainBulkJob(job),
      },
      { status: 200 }
    );
  }

  if (isCancelRequested(job)) {
    const cancelledJob = await applyCancelIfRequested(jobId, createdBy);

    return NextResponse.json(
      {
        ok: true,
        message: "Pending cancel request apply kar di gayi.",
        processingState: "cancelled",
        stats: {
          processedSteps: 0,
          failedSteps: 0,
          elapsedMs: 0,
          maxSteps,
        },
        job: toPlainBulkJob(cancelledJob),
      },
      { status: 200 }
    );
  }

  if (isPauseRequested(job)) {
    const pausedJob = await markJobPaused(
      jobId,
      createdBy,
      "Bulk job paused hai. Resume karke wahi se continue karo."
    );

    return NextResponse.json(
      {
        ok: true,
        message: "Job paused state me hai. Resume karne ke baad hi process hogi.",
        processingState: "paused",
        stats: {
          processedSteps: 0,
          failedSteps: 0,
          elapsedMs: 0,
          maxSteps,
        },
        job: toPlainBulkJob(pausedJob),
      },
      { status: 200 }
    );
  }

  if (!hasPendingRows(job)) {
    const finalJob = await finalizeBulkUploadJob({
      jobId,
      createdBy,
      message: "Bulk job completed successfully.",
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Job completed.",
        processingState: "finished",
        stats: {
          processedSteps: 0,
          failedSteps: 0,
          elapsedMs: 0,
          maxSteps,
        },
        job: toPlainBulkJob(finalJob),
      },
      { status: 200 }
    );
  }

  const startedAtMs = Date.now();
  let processedSteps = 0;
  let failedSteps = 0;
  let lastMessage = "";

  while (processedSteps < maxSteps) {
    const elapsed = Date.now() - startedAtMs;
    if (elapsed >= SOFT_TIME_BUDGET_MS) {
      break;
    }

    const currentJob = await getOwnedJob(jobId, createdBy);
    if (!currentJob) {
      return NextResponse.json(
        { ok: false, error: "Job not found during processing" },
        { status: 404 }
      );
    }

    job = await maybePrepareExecutionProgressWindow(jobId, createdBy);

    if (isFinalBulkJobStatus(job.status)) {
      break;
    }

    if (isCancelRequested(job)) {
      job = await applyCancelIfRequested(jobId, createdBy);
      lastMessage = "Cancel request apply kar di gayi.";
      break;
    }

    if (isPauseRequested(job)) {
      job = await markJobPaused(
        jobId,
        createdBy,
        "Bulk job paused. Resume button se wahi se continue kar sakte ho."
      );
      lastMessage = "Pause request apply kar di gayi.";
      break;
    }

    if (!hasPendingRows(job)) {
      job = await finalizeBulkUploadJob({
        jobId,
        createdBy,
        message: "Bulk job completed successfully.",
      });
      lastMessage = "Bulk job completed successfully.";
      break;
    }

    const result = await processSingleStep(job);

    if (result.ok && !result.blocked) {
      processedSteps += 1;
      job = result.updatedJob || job;
      lastMessage = safeStr(result.batchResult?.note || "One processing step completed.");
      continue;
    }

    if (result.ok && result.blocked) {
      job = result.updatedJob || job;
      lastMessage = safeStr(result.reason || "Processing stopped.");
      break;
    }

    failedSteps += 1;
    job = result.failedJob || job;
    lastMessage = safeStr(result.reason || "Processing failed.");
    break;
  }

  const latestJob = await getOwnedJob(jobId, createdBy);
  const finalJob = latestJob || job;
  const finalStatus = safeStr(finalJob?.status);
  const finalStage = getBulkDetailsDetailedStage(finalJob);

  let processingState = "idle";

  if (finalStatus === "completed" || finalStatus === "completed_with_errors") {
    processingState = "finished";
  } else if (finalStatus === "failed") {
    processingState = "failed";
  } else if (finalStatus === "cancelled") {
    processingState = "cancelled";
  } else if (isPauseRequested(finalJob)) {
    processingState = "paused";
  } else if (finalStage === "execution") {
    processingState = processedSteps > 0 ? "processed" : "ready";
  } else {
    processingState = processedSteps > 0 ? "processed" : "ready";
  }

  return NextResponse.json(
    {
      ok: true,
      message:
        lastMessage ||
        (processedSteps > 0
          ? `${processedSteps} processing step(s) completed successfully.`
          : "No steps processed in this request."),
      processingState,
      stats: {
        processedSteps,
        failedSteps,
        elapsedMs: Date.now() - startedAtMs,
        maxSteps,
      },
      job: toPlainBulkJob(finalJob),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}

export async function POST(req: NextRequest) {
  return runManualProcessor(req);
}