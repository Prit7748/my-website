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

const MAX_ROW_STEPS_PER_RUN = 75;
const SOFT_TIME_BUDGET_MS = 45_000;
const CLAIM_LOCK_MS = 90_000;
const STALE_LOCK_RECOVERY_MS = 150_000;
const MAX_ELIGIBLE_JOBS_SCAN = 25;

const MAX_AUTO_CHAIN_DEPTH = 3;
const AUTO_CHAIN_TIMEOUT_MS = 8_000;
const AUTO_CHAIN_ALLOWED_UPTO_ELAPSED_MS = 52_000;

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

function getRunnerDepth(req: NextRequest) {
  return clamp(safeNum(req.headers.get("x-runner-depth"), 0), 0, MAX_AUTO_CHAIN_DEPTH);
}

function getBaseUrlFromRequest(req: NextRequest) {
  const configured =
    safeStr(process.env.APP_BASE_URL) ||
    safeStr(process.env.NEXT_PUBLIC_APP_URL) ||
    safeStr(process.env.NEXTAUTH_URL);

  if (configured) return configured.replace(/\/+$/, "");

  try {
    const url = new URL(req.url);
    return `${url.protocol}//${url.host}`;
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

async function findBestNextJob(args?: {
  preferredJobId?: string;
  lastTouchedJobId?: string;
}) {
  const preferredJobId = safeStr(args?.preferredJobId);
  const lastTouchedJobId = safeStr(args?.lastTouchedJobId);

  if (lastTouchedJobId) {
    const jobs = await findEligibleJobs({
      preferredJobId: lastTouchedJobId,
      limit: 1,
    });
    if (jobs.length) return jobs[0];
  }

  if (preferredJobId) {
    const jobs = await findEligibleJobs({
      preferredJobId,
      limit: 1,
    });
    if (jobs.length) return jobs[0];
  }

  const jobs = await findEligibleJobs({ limit: 1 });
  return jobs[0] || null;
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
    const finalJob = await finalizeBulkUploadJob({
      jobId,
      createdBy,
      message: "Bulk job completed successfully.",
    });

    return {
      ok: true as const,
      skipped: true,
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

async function kickNextRunner(args: {
  req: NextRequest;
  preferredJobId?: string;
  depth: number;
}) {
  const cronSecret = safeStr(process.env.CRON_SECRET);
  const baseUrl = getBaseUrlFromRequest(args.req);
  const preferredJobId = safeStr(args.preferredJobId);

  if (!cronSecret) {
    return {
      ok: false as const,
      skipped: true,
      reason: "CRON_SECRET missing",
    };
  }

  if (!baseUrl) {
    return {
      ok: false as const,
      skipped: true,
      reason: "Base URL missing",
    };
  }

  if (args.depth >= MAX_AUTO_CHAIN_DEPTH) {
    return {
      ok: false as const,
      skipped: true,
      reason: "Auto-chain depth limit reached",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTO_CHAIN_TIMEOUT_MS);

  try {
    const url = new URL(`${baseUrl}/api/cron/products-bulk-details-runner`);
    if (preferredJobId) {
      url.searchParams.set("jobId", preferredJobId);
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        "x-runner-depth": String(args.depth + 1),
        ...(preferredJobId ? { "x-bulk-job-id": preferredJobId } : {}),
      },
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await res.text();
    let data: any = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      return {
        ok: false as const,
        skipped: false,
        reason:
          safeStr(data?.error) ||
          safeStr(text) ||
          `Auto-chain failed with status ${res.status}`,
      };
    }

    return {
      ok: true as const,
      skipped: false,
      response: data,
    };
  } catch (error: any) {
    return {
      ok: false as const,
      skipped: false,
      reason: safeStr(error?.message || "Auto-chain failed"),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runRunner(req: NextRequest) {
  const access = await assertRunnerAccess(req);
  if (!access.ok) return access.res;

  const preferredJobId = getPreferredJobId(req);
  const runnerDepth = getRunnerDepth(req);
  const startedAtMs = Date.now();

  const recovery = await recoverStaleOrExpiredLocks();

  let rowStepsCompleted = 0;
  let rowStepsFailed = 0;
  let metaSkips = 0;

  const touchedJobIds = new Set<string>();
  const finishedJobs: any[] = [];
  const failureNotes: string[] = [];

  let currentJobId = preferredJobId;

  while (rowStepsCompleted + rowStepsFailed < MAX_ROW_STEPS_PER_RUN) {
    const elapsed = Date.now() - startedAtMs;
    if (elapsed >= SOFT_TIME_BUDGET_MS) {
      break;
    }

    const nextJob = await findBestNextJob({
      preferredJobId,
      lastTouchedJobId: currentJobId,
    });

    if (!nextJob) {
      break;
    }

    const result = await processSingleRowForJob(nextJob);

    if (result.skipped) {
      metaSkips += 1;

      const maybeJobId = safeStr((result as any).jobId);
      const maybeUpdatedJob: any = (result as any).updatedJob;
      const maybeStatus = safeStr(maybeUpdatedJob?.status);

      if (maybeJobId) {
        touchedJobIds.add(maybeJobId);
        currentJobId = maybeJobId;
      }

      if (maybeUpdatedJob && isFinalBulkJobStatus(maybeStatus)) {
        finishedJobs.push(toPlainBulkJob(maybeUpdatedJob));
      }

      if (safeStr((result as any).reason).toLowerCase().includes("locked")) {
        currentJobId = "";
      }

      continue;
    }

    if ((result as any).jobId) {
      touchedJobIds.add((result as any).jobId);
      currentJobId = safeStr((result as any).jobId);
    }

    if (result.ok) {
      rowStepsCompleted += 1;

      const updated = (result as any).updatedJob;
      const status = safeStr(updated?.status);

      if (isFinalBulkJobStatus(status)) {
        finishedJobs.push(toPlainBulkJob(updated));
      }
    } else {
      rowStepsFailed += 1;

      const reason = safeStr((result as any).reason);
      if (reason) failureNotes.push(reason);

      const failedJob = (result as any).failedJob;
      const failedStatus = safeStr(failedJob?.status);

      if (isFinalBulkJobStatus(failedStatus)) {
        finishedJobs.push(toPlainBulkJob(failedJob));
      }
    }
  }

  const remainingJobs = await findEligibleJobs({ limit: 10 });

  let autoChain: any = {
    ok: false,
    skipped: true,
    reason: "Not attempted",
  };

  const elapsedMs = Date.now() - startedAtMs;

  if (
    remainingJobs.length > 0 &&
    elapsedMs <= AUTO_CHAIN_ALLOWED_UPTO_ELAPSED_MS
  ) {
    autoChain = await kickNextRunner({
      req,
      preferredJobId: currentJobId || preferredJobId || safeStr(remainingJobs[0]?._id),
      depth: runnerDepth,
    });
  }

  const res = NextResponse.json(
    {
      ok: true,
      mode: access.mode,
      actor: access.actor,
      message:
        rowStepsCompleted || rowStepsFailed
          ? "Product details runner executed successfully."
          : "No eligible product details job found for processing.",
      stats: {
        rowStepsCompleted,
        rowStepsFailed,
        metaSkips,
        touchedJobs: touchedJobIds.size,
        remainingActiveJobs: remainingJobs.length,
        elapsedMs,
        maxRowStepsPerRun: MAX_ROW_STEPS_PER_RUN,
        softTimeBudgetMs: SOFT_TIME_BUDGET_MS,
        processingMode: "row_by_row_stable_autochain",
        recoveredLocks: recovery.recoveredLocks,
        finalizedCompletedJobs: recovery.finalizedCompletedJobs,
        runnerDepth,
      },
      preferredJobId: preferredJobId || "",
      currentJobId: currentJobId || "",
      touchedJobIds: Array.from(touchedJobIds),
      finishedJobs,
      failureNotes: failureNotes.slice(0, 20),
      nextSuggestedAt:
        remainingJobs.length > 0
          ? new Date(Date.now() + 60_000).toISOString()
          : null,
      autoChain: autoChain.ok
        ? {
            ok: true,
            message: safeStr(autoChain.response?.message || ""),
            stats: autoChain.response?.stats || null,
          }
        : {
            ok: false,
            skipped: Boolean(autoChain.skipped),
            reason: safeStr(autoChain.reason || ""),
          },
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