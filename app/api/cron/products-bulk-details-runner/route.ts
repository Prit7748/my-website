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
const MAX_RECENT_EVENTS = 20;

type TaskStatus =
  | "idle"
  | "pending"
  | "needs_attention"
  | "running"
  | "completed"
  | "disabled";

type AutoMode = "auto" | "manual" | "hybrid";

type RecentEvent = {
  id: string;
  level: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  createdAt: string;
};

type PostSyncTaskState = {
  status?: TaskStatus;
  desiredMode?: AutoMode;
  requestedAt?: string | null;
  requestedBy?: string;
  lastStartedAt?: string | null;
  lastCompletedAt?: string | null;
  lastMessage?: string;
  nextCursor?: number;
  nextSkip?: number;
  sourceJobCompletedAt?: string | null;
  stats?: Record<string, any>;
};

type PostUploadSyncState = {
  availability?: PostSyncTaskState;
  combo?: PostSyncTaskState;
  hardcopy?: PostSyncTaskState;
  fullSync?: PostSyncTaskState;
  recentEvents?: RecentEvent[];
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function createEvent(
  level: RecentEvent["level"],
  title: string,
  message: string
): RecentEvent {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    level,
    title: safeStr(title),
    message: safeStr(message),
    createdAt: new Date().toISOString(),
  };
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

function normalizeCategory(input: any) {
  return safeStr(input).toLowerCase().replace(/\s+/g, " ").trim();
}

function isSolvedAssignmentsCategory(input: any) {
  const c = normalizeCategory(input);
  return c === "solved assignments" || c === "solved-assignments";
}

function getJobCategory(job: any) {
  return (
    safeStr(job?.summary?.category) ||
    safeStr(job?.config?.category) ||
    safeStr(job?.meta?.category)
  );
}

function getJobCompletionTimestamp(job: any) {
  return safeStr(job?.completedAt || job?.updatedAt || "");
}

function getPostUploadSyncState(job: any): PostUploadSyncState {
  const state = job?.summary?.postUploadSync;
  if (state && typeof state === "object" && !Array.isArray(state)) {
    return state as PostUploadSyncState;
  }
  return {};
}

function buildTaskState(params: {
  prev?: PostSyncTaskState;
  desiredMode: AutoMode;
  status: TaskStatus;
  message: string;
  sourceJobCompletedAt: string;
  nextCursor?: number;
  nextSkip?: number;
}) {
  const prev = params.prev || {};
  return {
    desiredMode: prev.desiredMode || params.desiredMode,
    requestedAt: prev.requestedAt || null,
    requestedBy: safeStr(prev.requestedBy || ""),
    lastStartedAt: prev.lastStartedAt || null,
    lastCompletedAt: prev.lastCompletedAt || null,
    lastMessage: params.message,
    status: params.status,
    nextCursor:
      typeof params.nextCursor === "number"
        ? params.nextCursor
        : typeof prev.nextCursor === "number"
        ? prev.nextCursor
        : 0,
    nextSkip:
      typeof params.nextSkip === "number"
        ? params.nextSkip
        : typeof prev.nextSkip === "number"
        ? prev.nextSkip
        : 0,
    sourceJobCompletedAt: params.sourceJobCompletedAt,
    stats:
      prev.stats && typeof prev.stats === "object" && !Array.isArray(prev.stats)
        ? prev.stats
        : {},
  } satisfies PostSyncTaskState;
}

async function stampPostUploadSyncState(jobDoc: any) {
  const status = safeStr(jobDoc?.status);
  if (status !== "completed" && status !== "completed_with_errors") {
    return jobDoc;
  }

  await dbConnect();

  const freshJob: any = await BulkUploadJob.findById(jobDoc?._id);
  if (!freshJob) return jobDoc;

  const completedAt = getJobCompletionTimestamp(freshJob);
  if (!completedAt) return freshJob;

  const latestCategory = getJobCategory(freshJob);
  const hardcopyRelevant = isSolvedAssignmentsCategory(latestCategory);

  const summary =
    freshJob.summary &&
    typeof freshJob.summary === "object" &&
    !Array.isArray(freshJob.summary)
      ? { ...freshJob.summary }
      : {};

  const currentState = getPostUploadSyncState(freshJob);
  const availabilityPrev = currentState.availability || {};
  const comboPrev = currentState.combo || {};
  const hardcopyPrev = currentState.hardcopy || {};
  const fullSyncPrev = currentState.fullSync || {};

  const alreadyStamped =
    safeStr(availabilityPrev.sourceJobCompletedAt) === completedAt &&
    safeStr(comboPrev.sourceJobCompletedAt) === completedAt &&
    safeStr(fullSyncPrev.sourceJobCompletedAt) === completedAt &&
    (hardcopyRelevant
      ? safeStr(hardcopyPrev.sourceJobCompletedAt) === completedAt
      : true);

  if (alreadyStamped) {
    return freshJob;
  }

  const recentEvents = Array.isArray(currentState.recentEvents)
    ? [...currentState.recentEvents]
    : [];

  recentEvents.unshift(
    createEvent(
      "success",
      "Bulk upload completed",
      "Latest bulk product details upload complete ho gayi. Post-upload sync tasks refresh kar di gayi hain."
    )
  );

  const nextState: PostUploadSyncState = {
    availability: buildTaskState({
      prev: availabilityPrev,
      desiredMode: "hybrid",
      status: "pending",
      message:
        "Latest bulk upload completed. Availability sync ab pending hai.",
      sourceJobCompletedAt: completedAt,
      nextCursor: 0,
    }),
    combo: buildTaskState({
      prev: comboPrev,
      desiredMode: "hybrid",
      status: "pending",
      message: "Latest bulk upload completed. Combo sync ab pending hai.",
      sourceJobCompletedAt: completedAt,
    }),
    hardcopy: buildTaskState({
      prev: hardcopyPrev,
      desiredMode: "hybrid",
      status: hardcopyRelevant ? "pending" : "disabled",
      message: hardcopyRelevant
        ? "Latest bulk upload completed. Hardcopy sync ab pending hai."
        : "Latest bulk upload hardcopy-relevant category ki nahi hai.",
      sourceJobCompletedAt: completedAt,
      nextSkip: 0,
    }),
    fullSync: buildTaskState({
      prev: fullSyncPrev,
      desiredMode: "manual",
      status: "pending",
      message:
        "Latest bulk upload completed. Run Full Sync action available hai.",
      sourceJobCompletedAt: completedAt,
    }),
    recentEvents: recentEvents.slice(0, MAX_RECENT_EVENTS),
  };

  summary.postUploadSync = nextState;
  freshJob.summary = summary;
  freshJob.markModified("summary");

  await freshJob.save();
  return freshJob;
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

    const stampedJob = await stampPostUploadSyncState(updatedJob);

    return {
      ok: true as const,
      skipped: false,
      jobId,
      createdBy,
      updatedJob: stampedJob,
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