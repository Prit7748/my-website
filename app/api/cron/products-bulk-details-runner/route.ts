//app/api/cron/products-bulk-details-runner/route.ts//
import { NextRequest, NextResponse } from "next/server";

import dbConnect from "@/lib/db";
import BulkUploadJob from "@/models/BulkUploadJob";
import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  claimBulkUploadJobBatch,
  completeBulkUploadJobBatch,
  failBulkUploadJob,
  isFinalBulkJobStatus,
  toPlainBulkJob,
} from "@/lib/bulkUploadJob";
import { processBulkDetailsJobBatch } from "@/lib/bulkProductDetailsJob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_ROW_STEPS_PER_RUN = 200;
const SOFT_TIME_BUDGET_MS = 240000;
const CLAIM_LOCK_MS = 120000;

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

async function runRunner(req: NextRequest) {
  const access = await assertRunnerAccess(req);
  if (!access.ok) return access.res;

  const startedAtMs = Date.now();

  let rowStepsCompleted = 0;
  let rowStepsFailed = 0;
  let rowStepsSkipped = 0;

  const touchedJobIds = new Set<string>();
  const finishedJobs: any[] = [];
  const failureNotes: string[] = [];

  while (rowStepsCompleted + rowStepsFailed + rowStepsSkipped < MAX_ROW_STEPS_PER_RUN) {
    const elapsed = Date.now() - startedAtMs;
    if (elapsed >= SOFT_TIME_BUDGET_MS) {
      break;
    }

    const jobs = await findEligibleJobs(25);
    if (!jobs.length) {
      break;
    }

    let processedOneStep = false;

    for (const job of jobs) {
      const elapsedInner = Date.now() - startedAtMs;
      if (elapsedInner >= SOFT_TIME_BUDGET_MS) {
        break;
      }

      const result = await processSingleRowForJob(job);

      if (result.skipped) {
        rowStepsSkipped += 1;
        continue;
      }

      processedOneStep = true;

      if (result.ok) {
        rowStepsCompleted += 1;
        if (result.jobId) touchedJobIds.add(result.jobId);

        const updated = result.updatedJob;
        const status = safeStr(updated?.status);
        if (isFinalBulkJobStatus(status)) {
          finishedJobs.push(toPlainBulkJob(updated));
        }
      } else {
        rowStepsFailed += 1;
        if (result.jobId) touchedJobIds.add(result.jobId);

        const reason = safeStr(result.reason);
        if (reason) {
          failureNotes.push(reason);
        }

        const failedStatus = safeStr(result.failedJob?.status);
        if (isFinalBulkJobStatus(failedStatus)) {
          finishedJobs.push(toPlainBulkJob(result.failedJob));
        }
      }

      if (rowStepsCompleted + rowStepsFailed + rowStepsSkipped >= MAX_ROW_STEPS_PER_RUN) {
        break;
      }
    }

    if (!processedOneStep) {
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
        rowStepsCompleted || rowStepsFailed
          ? "Product details background runner executed."
          : "No eligible product details job found for processing.",
      stats: {
        rowStepsCompleted,
        rowStepsFailed,
        rowStepsSkipped,
        touchedJobs: touchedJobIds.size,
        remainingActiveJobs: remainingJobs.length,
        elapsedMs: Date.now() - startedAtMs,
        maxRowStepsPerRun: MAX_ROW_STEPS_PER_RUN,
        softTimeBudgetMs: SOFT_TIME_BUDGET_MS,
        processingMode: "row_by_row",
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