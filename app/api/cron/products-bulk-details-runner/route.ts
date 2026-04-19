import { NextRequest, NextResponse } from "next/server";

import dbConnect from "@/lib/db";
import BulkUploadJob from "@/models/BulkUploadJob";
import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  claimBulkUploadJobBatch,
  completeBulkUploadJobBatch,
  failBulkUploadJob,
  getBulkUploadJob,
  isFinalBulkJobStatus,
  toPlainBulkJob,
} from "@/lib/bulkUploadJob";
import { processBulkDetailsJobBatch } from "@/lib/bulkProductDetailsJob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Goal:
 * - keep row-by-row processing
 * - improve throughput by processing many rows in one runner hit
 * - auto-recover stale processing locks
 * - reduce chances of job stopping midway
 */
const MAX_ROW_STEPS_PER_RUN = 1000;
const SOFT_TIME_BUDGET_MS = 210000; // keep safely below common 5 min scheduler overlap
const CLAIM_LOCK_MS = 120000;
const STALE_HEARTBEAT_MS = 10 * 60 * 1000;

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function isCronAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return false;

  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

async function isAdminAuthorized() {
  const user = await getAuthUser();
  if (!user) return { ok: false as const };

  if (!hasPermission(user, "products:write")) {
    return { ok: false as const };
  }

  return { ok: true as const, user };
}

async function assertRunnerAccess(req: NextRequest) {
  if (isCronAuthorized(req)) {
    return {
      ok: true as const,
      mode: "cron" as const,
      actor: "system-cron",
    };
  }

  const admin = await isAdminAuthorized();
  if (admin.ok) {
    return {
      ok: true as const,
      mode: "admin" as const,
      actor: safeStr(admin.user.email || "admin"),
    };
  }

  return {
    ok: false as const,
    res: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }),
  };
}

async function recoverStaleProductDetailLocks() {
  await dbConnect();

  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_HEARTBEAT_MS);

  const result = await BulkUploadJob.updateMany(
    {
      jobType: "product_details",
      status: "processing_batch",
      $or: [
        { lockToken: "" },
        { lockToken: null },
        { lockExpiresAt: null },
        { lockExpiresAt: { $lte: now } },
        { lastHeartbeatAt: { $lte: staleBefore } },
      ],
    },
    {
      $set: {
        status: "running",
        lockToken: "",
        lockExpiresAt: null,
      },
    }
  );

  return safeNum((result as any)?.modifiedCount || 0, 0);
}

async function findEligibleJobs(limit = 25) {
  await dbConnect();

  const docs: any[] = await BulkUploadJob.find({
    jobType: "product_details",
    status: { $in: ["queued", "running", "processing_batch"] },
  })
    .sort({ createdAt: 1, _id: 1 })
    .limit(limit);

  return docs.filter((job: any) => {
    const status = safeStr(job?.status);
    if (isFinalBulkJobStatus(status)) return false;

    const totalItems = safeNum(job?.progress?.totalItems, 0);
    const processedItems = safeNum(job?.progress?.processedItems, 0);

    if (totalItems <= 0) return false;
    if (processedItems >= totalItems) return false;

    return true;
  });
}

async function processSingleRowForJob(jobDoc: any) {
  const jobId = safeStr(jobDoc?._id);
  const createdBy = safeStr(jobDoc?.createdBy);

  if (!jobId || !createdBy) {
    return {
      ok: false as const,
      skipped: true,
      reason: "Invalid job identity",
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
      skipped: true,
      reason: safeStr(claim.error || "Job could not be locked"),
      jobId,
      createdBy,
    };
  }

  const lockedJob = claim.job;
  const totalItems = safeNum(lockedJob?.progress?.totalItems, 0);
  const processedItems = safeNum(lockedJob?.progress?.processedItems, 0);

  if (totalItems <= 0 || processedItems >= totalItems) {
    return {
      ok: false as const,
      skipped: true,
      reason: "No pending rows left",
      jobId,
      createdBy,
    };
  }

  const fromIndex = processedItems;
  const toIndex = processedItems;
  const batchNumber = processedItems + 1;

  try {
    const batchResult = await processBulkDetailsJobBatch({
      job: lockedJob,
      batchNumber,
      fromIndex,
      toIndex,
    });

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

    return {
      ok: true as const,
      skipped: false,
      jobId,
      createdBy,
      updatedJob,
      batchResult,
    };
  } catch (error: any) {
    const failedJob = await failBulkUploadJob({
      jobId,
      createdBy,
      lockToken: claim.lockToken,
      message: safeStr(error?.message || "Bulk details row processing failed"),
    });

    return {
      ok: false as const,
      skipped: false,
      jobId,
      createdBy,
      failedJob,
      reason: safeStr(error?.message || "Bulk details row processing failed"),
    };
  }
}

function isRunnerTimeAvailable(startedAtMs: number) {
  return Date.now() - startedAtMs < SOFT_TIME_BUDGET_MS;
}

async function processJobRepeatedlyUntilBlocked(params: {
  job: any;
  startedAtMs: number;
  stats: {
    rowStepsCompleted: number;
    rowStepsFailed: number;
    rowStepsSkipped: number;
  };
  touchedJobIds: Set<string>;
  finishedJobs: any[];
  failureNotes: string[];
}) {
  const { job, startedAtMs, stats, touchedJobIds, finishedJobs, failureNotes } = params;

  let noProgressInRow = 0;

  while (
    isRunnerTimeAvailable(startedAtMs) &&
    stats.rowStepsCompleted + stats.rowStepsFailed + stats.rowStepsSkipped < MAX_ROW_STEPS_PER_RUN
  ) {
    const latestJob = await getBulkUploadJob(safeStr(job?._id), safeStr(job?.createdBy));
    if (!latestJob) break;

    const latestStatus = safeStr((latestJob as any)?.status);
    const latestTotal = safeNum((latestJob as any)?.progress?.totalItems, 0);
    const latestProcessed = safeNum((latestJob as any)?.progress?.processedItems, 0);

    if (isFinalBulkJobStatus(latestStatus)) {
      finishedJobs.push(toPlainBulkJob(latestJob));
      break;
    }

    if (latestTotal <= 0 || latestProcessed >= latestTotal) {
      break;
    }

    const result = await processSingleRowForJob(latestJob);

    if (result.skipped) {
      stats.rowStepsSkipped += 1;

      const reason = safeStr(result.reason);
      if (reason && !failureNotes.includes(reason)) {
        failureNotes.push(reason);
      }

      noProgressInRow += 1;

      // if repeatedly locked or no-progress, leave this job for next scheduler hit
      if (noProgressInRow >= 2) {
        break;
      }

      continue;
    }

    noProgressInRow = 0;

    if (result.ok) {
      stats.rowStepsCompleted += 1;
      if (result.jobId) touchedJobIds.add(result.jobId);

      const updated = result.updatedJob;
      const status = safeStr(updated?.status);
      if (isFinalBulkJobStatus(status)) {
        finishedJobs.push(toPlainBulkJob(updated));
        break;
      }

      continue;
    }

    stats.rowStepsFailed += 1;
    if (result.jobId) touchedJobIds.add(result.jobId);

    const reason = safeStr(result.reason);
    if (reason && !failureNotes.includes(reason)) {
      failureNotes.push(reason);
    }

    const failedStatus = safeStr(result.failedJob?.status);
    if (isFinalBulkJobStatus(failedStatus)) {
      finishedJobs.push(toPlainBulkJob(result.failedJob));
    }

    break;
  }
}

async function runRunner(req: NextRequest) {
  const access = await assertRunnerAccess(req);
  if (!access.ok) return access.res;

  const startedAtMs = Date.now();

  const staleRecoveredCount = await recoverStaleProductDetailLocks();

  const stats = {
    rowStepsCompleted: 0,
    rowStepsFailed: 0,
    rowStepsSkipped: 0,
  };

  const touchedJobIds = new Set<string>();
  const finishedJobs: any[] = [];
  const failureNotes: string[] = [];

  let sweepCount = 0;

  while (
    isRunnerTimeAvailable(startedAtMs) &&
    stats.rowStepsCompleted + stats.rowStepsFailed + stats.rowStepsSkipped < MAX_ROW_STEPS_PER_RUN
  ) {
    sweepCount += 1;

    const jobs = await findEligibleJobs(25);
    if (!jobs.length) {
      break;
    }

    let anyJobProgressedThisSweep = false;

    for (const job of jobs) {
      const beforeCount =
        stats.rowStepsCompleted + stats.rowStepsFailed + stats.rowStepsSkipped;

      await processJobRepeatedlyUntilBlocked({
        job,
        startedAtMs,
        stats,
        touchedJobIds,
        finishedJobs,
        failureNotes,
      });

      const afterCount =
        stats.rowStepsCompleted + stats.rowStepsFailed + stats.rowStepsSkipped;

      if (afterCount > beforeCount) {
        anyJobProgressedThisSweep = true;
      }

      if (
        !isRunnerTimeAvailable(startedAtMs) ||
        afterCount >= MAX_ROW_STEPS_PER_RUN
      ) {
        break;
      }
    }

    if (!anyJobProgressedThisSweep) {
      break;
    }
  }

  const remainingJobs = await findEligibleJobs(10);

  return NextResponse.json(
    {
      ok: true,
      mode: access.mode,
      actor: access.actor,
      message:
        stats.rowStepsCompleted || stats.rowStepsFailed
          ? "Product details background runner executed."
          : "No eligible product details job found for processing.",
      stats: {
        ...stats,
        touchedJobs: touchedJobIds.size,
        remainingActiveJobs: remainingJobs.length,
        elapsedMs: Date.now() - startedAtMs,
        maxRowStepsPerRun: MAX_ROW_STEPS_PER_RUN,
        softTimeBudgetMs: SOFT_TIME_BUDGET_MS,
        processingMode: "row_by_row",
        staleRecoveredCount,
        sweepCount,
      },
      touchedJobIds: Array.from(touchedJobIds),
      finishedJobs,
      failureNotes: failureNotes.slice(0, 20),
    },
    { status: 200 }
  );
}

export async function GET(req: NextRequest) {
  return runRunner(req);
}

export async function POST(req: NextRequest) {
  return runRunner(req);
}