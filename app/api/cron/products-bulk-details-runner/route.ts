import { NextRequest, NextResponse } from "next/server";

import dbConnect from "@/lib/db";
import BulkUploadJob from "@/models/BulkUploadJob";
import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  claimBulkUploadJobBatch,
  completeBulkUploadJobBatch,
  failBulkUploadJob,
  finalizeBulkUploadJob,
  isFinalBulkJobStatus,
  toPlainBulkJob,
} from "@/lib/bulkUploadJob";
import { processBulkDetailsJobBatch } from "@/lib/bulkProductDetailsJob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ROW_STEPS_PER_RUN = 500;
const SOFT_TIME_BUDGET_MS = 54_000;
const CLAIM_LOCK_MS = 120_000;
const STALE_LOCK_RECOVERY_MS = 180_000;
const MAX_ELIGIBLE_JOBS_SCAN = 25;

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

function getPreferredJobId(req: NextRequest) {
  const fromHeader = safeStr(req.headers.get("x-bulk-job-id"));
  if (fromHeader) return fromHeader;

  try {
    const url = new URL(req.url);
    return safeStr(url.searchParams.get("jobId"));
  } catch {
    return "";
  }
}

function canJobStillRun(job: any) {
  const status = safeStr(job?.status);
  if (isFinalBulkJobStatus(status)) return false;

  const totalItems = safeNum(job?.progress?.totalItems, 0);
  const processedItems = safeNum(job?.progress?.processedItems, 0);

  if (totalItems <= 0) return false;
  if (processedItems >= totalItems) return false;

  return true;
}

async function recoverStaleOrExpiredLocks() {
  await dbConnect();

  const now = new Date();
  const staleCutoff = new Date(now.getTime() - STALE_LOCK_RECOVERY_MS);

  const candidates: any[] = await BulkUploadJob.find({
    jobType: "product_details",
    status: { $in: ["queued", "running", "processing_batch"] },
    $or: [
      { lockExpiresAt: { $ne: null, $lte: now } },
      {
        status: "processing_batch",
        lockToken: { $ne: "" },
        $or: [
          { lastHeartbeatAt: null },
          { lastHeartbeatAt: { $lte: staleCutoff } },
        ],
      },
    ],
  })
    .sort({ createdAt: 1, _id: 1 })
    .limit(MAX_ELIGIBLE_JOBS_SCAN);

  let recoveredLocks = 0;
  let finalizedCompletedJobs = 0;

  for (const job of candidates) {
    const jobId = safeStr(job?._id);
    const createdBy = safeStr(job?.createdBy);
    const totalItems = safeNum(job?.progress?.totalItems, 0);
    const processedItems = safeNum(job?.progress?.processedItems, 0);

    if (!jobId || !createdBy) continue;

    if (totalItems > 0 && processedItems >= totalItems) {
      try {
        await finalizeBulkUploadJob({
          jobId,
          createdBy,
          message: "Bulk job completed successfully.",
        });
        finalizedCompletedJobs += 1;
        continue;
      } catch {
        // ignore
      }
    }

    await BulkUploadJob.updateOne(
      { _id: job._id },
      {
        $set: {
          status: safeStr(job?.status) === "queued" ? "queued" : "running",
          lockToken: "",
          lockExpiresAt: null,
          lastHeartbeatAt: now,
        },
      }
    );

    recoveredLocks += 1;
  }

  return {
    recoveredLocks,
    finalizedCompletedJobs,
  };
}

async function findEligibleJobs(args?: {
  preferredJobId?: string;
  limit?: number;
}) {
  await dbConnect();

  const preferredJobId = safeStr(args?.preferredJobId);
  const limit = Math.max(1, Math.trunc(safeNum(args?.limit, MAX_ELIGIBLE_JOBS_SCAN)));

  const out: any[] = [];
  const seen = new Set<string>();

  if (preferredJobId) {
    const preferred: any = await BulkUploadJob.findOne({
      _id: preferredJobId,
      jobType: "product_details",
      status: { $in: ["queued", "running", "processing_batch"] },
    });

    if (preferred && canJobStillRun(preferred)) {
      out.push(preferred);
      seen.add(String(preferred._id));
    }
  }

  const others: any[] = await BulkUploadJob.find({
    jobType: "product_details",
    status: { $in: ["queued", "running", "processing_batch"] },
    ...(seen.size ? { _id: { $nin: Array.from(seen) } } : {}),
  })
    .sort({ createdAt: 1, _id: 1 })
    .limit(limit);

  for (const job of others) {
    const id = String(job?._id || "");
    if (!id || seen.has(id)) continue;
    if (!canJobStillRun(job)) continue;

    out.push(job);
    seen.add(id);

    if (out.length >= limit) break;
  }

  return out;
}

async function processSingleRowForJob(jobDoc: any) {
  const jobId = safeStr(jobDoc?._id);
  const createdBy = safeStr(jobDoc?.createdBy);

  if (!jobId || !createdBy) {
    return {
      ok: false as const,
      metaSkipped: true,
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
      metaSkipped: true,
      reason: safeStr(claim.error || "Job could not be locked"),
      jobId,
      createdBy,
    };
  }

  const lockedJob = claim.job;
  const totalItems = safeNum(lockedJob?.progress?.totalItems, 0);
  const processedItems = safeNum(lockedJob?.progress?.processedItems, 0);

  if (totalItems <= 0 || processedItems >= totalItems) {
    const finalJob = await finalizeBulkUploadJob({
      jobId,
      createdBy,
      message: "Bulk job completed successfully.",
    });

    return {
      ok: true as const,
      metaSkipped: true,
      reason: "No pending rows left",
      jobId,
      createdBy,
      updatedJob: finalJob,
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
      metaSkipped: false,
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
      metaSkipped: false,
      jobId,
      createdBy,
      failedJob,
      reason: safeStr(error?.message || "Bulk details row processing failed"),
    };
  }
}

async function runRunner(req: NextRequest) {
  const access = await assertRunnerAccess(req);
  if (!access.ok) return access.res;

  const preferredJobId = getPreferredJobId(req);
  const startedAtMs = Date.now();

  const recovery = await recoverStaleOrExpiredLocks();

  let rowStepsProcessed = 0;
  let rowStepsCompleted = 0;
  let rowStepsFailed = 0;
  let rowStepsCreated = 0;
  let rowStepsUpdated = 0;
  let rowStepsSkipped = 0;
  let metaSkips = 0;

  const touchedJobIds = new Set<string>();
  const finishedJobs: any[] = [];
  const failureNotes: string[] = [];

  let activeJob: any = null;

  const firstEligible = await findEligibleJobs({
    preferredJobId,
    limit: MAX_ELIGIBLE_JOBS_SCAN,
  });

  if (firstEligible.length) {
    activeJob = firstEligible[0];
  }

  while (rowStepsProcessed < MAX_ROW_STEPS_PER_RUN) {
    const elapsed = Date.now() - startedAtMs;
    if (elapsed >= SOFT_TIME_BUDGET_MS) {
      break;
    }

    if (!activeJob || !canJobStillRun(activeJob)) {
      const eligible = await findEligibleJobs({
        preferredJobId: "",
        limit: MAX_ELIGIBLE_JOBS_SCAN,
      });

      if (!eligible.length) {
        break;
      }

      activeJob = eligible[0];
    }

    const result = await processSingleRowForJob(activeJob);

    const maybeJobId = safeStr((result as any).jobId);
    if (maybeJobId) touchedJobIds.add(maybeJobId);

    if (result.metaSkipped) {
      metaSkips += 1;

      const maybeUpdatedJob: any = (result as any).updatedJob;
      const maybeStatus = safeStr(maybeUpdatedJob?.status);

      if (maybeUpdatedJob && isFinalBulkJobStatus(maybeStatus)) {
        finishedJobs.push(toPlainBulkJob(maybeUpdatedJob));
      }

      if (safeStr((result as any).reason).toLowerCase().includes("locked")) {
        activeJob = null;
      } else if (maybeUpdatedJob) {
        activeJob = maybeUpdatedJob;
      } else {
        activeJob = null;
      }

      continue;
    }

    rowStepsProcessed += 1;

    if (result.ok) {
      const batchResult: any = (result as any).batchResult || {};
      rowStepsCompleted += Number(batchResult.successDelta || 0);
      rowStepsCreated += Number(batchResult.summaryPatch?.createdRows ?? 0) >= 0
        ? Number(batchResult.successDelta || 0) - Number(batchResult.summaryPatch?.updatedRows ? 0 : 0)
        : 0;

      rowStepsUpdated += 0;
      rowStepsSkipped += Number(batchResult.skippedDelta || 0);
      rowStepsFailed += Number(batchResult.failedDelta || 0);

      const updatedJob = (result as any).updatedJob;
      const updatedStatus = safeStr(updatedJob?.status);

      if (updatedJob && isFinalBulkJobStatus(updatedStatus)) {
        finishedJobs.push(toPlainBulkJob(updatedJob));
        activeJob = null;
      } else if (updatedJob) {
        activeJob = updatedJob;
      } else {
        activeJob = null;
      }
    } else {
      rowStepsFailed += 1;

      const reason = safeStr((result as any).reason);
      if (reason) failureNotes.push(reason);

      const failedJob = (result as any).failedJob;
      const failedStatus = safeStr(failedJob?.status);

      if (failedJob && isFinalBulkJobStatus(failedStatus)) {
        finishedJobs.push(toPlainBulkJob(failedJob));
      }

      activeJob = null;
    }
  }

  const remainingJobs = await findEligibleJobs({
    preferredJobId: activeJob ? safeStr(activeJob?._id) : "",
    limit: 10,
  });

  const res = NextResponse.json(
    {
      ok: true,
      mode: access.mode,
      actor: access.actor,
      message:
        rowStepsProcessed > 0
          ? "Product details runner executed successfully."
          : "No eligible product details job found for processing.",
      stats: {
        rowStepsProcessed,
        rowStepsCompleted,
        rowStepsFailed,
        rowStepsCreated,
        rowStepsUpdated,
        rowStepsSkipped,
        metaSkips,
        touchedJobs: touchedJobIds.size,
        remainingActiveJobs: remainingJobs.length,
        elapsedMs: Date.now() - startedAtMs,
        maxRowStepsPerRun: MAX_ROW_STEPS_PER_RUN,
        softTimeBudgetMs: SOFT_TIME_BUDGET_MS,
        processingMode: "row_by_row_scheduler_only",
        recoveredLocks: recovery.recoveredLocks,
        finalizedCompletedJobs: recovery.finalizedCompletedJobs,
      },
      preferredJobId: preferredJobId || "",
      activeJobId: activeJob ? safeStr(activeJob?._id) : "",
      touchedJobIds: Array.from(touchedJobIds),
      finishedJobs,
      failureNotes: failureNotes.slice(0, 20),
      nextSuggestedAt:
        remainingJobs.length > 0
          ? new Date(Date.now() + 60_000).toISOString()
          : null,
    },
    { status: 200 }
  );

  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  return res;
}

export async function GET(req: NextRequest) {
  return runRunner(req);
}

export async function POST(req: NextRequest) {
  return runRunner(req);
}