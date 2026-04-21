import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import BulkUploadJob from "@/models/BulkUploadJob";
import { getAuthUser, hasPermission } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PRODUCT_DETAILS_JOB_TYPE = "product_details";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type BulkAction =
  | "delete_selected"
  | "delete_all"
  | "cancel_selected"
  | "cancel_all_active";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function uniqueIds(arr: any[]) {
  return Array.from(
    new Set(
      (Array.isArray(arr) ? arr : [])
        .map((x) => safeStr(x))
        .filter(Boolean)
    )
  );
}

function isActiveJobStatus(status: any) {
  const s = safeStr(status);
  return s === "queued" || s === "running" || s === "processing_batch";
}

function isFinalJobStatus(status: any) {
  const s = safeStr(status);
  return (
    s === "completed" ||
    s === "completed_with_errors" ||
    s === "failed" ||
    s === "cancelled"
  );
}

async function assertAccess() {
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

  return {
    ok: true as const,
    actor: safeStr(user.email || "admin"),
  };
}

function buildJobDto(job: any) {
  return {
    _id: String(job?._id || ""),
    jobType: safeStr(job?.jobType),
    jobLabel: safeStr(job?.jobLabel),
    status: safeStr(job?.status),
    createdBy: safeStr(job?.createdBy),
    meta:
      job?.meta && typeof job.meta === "object" && !Array.isArray(job.meta)
        ? job.meta
        : {},
    config:
      job?.config && typeof job.config === "object" && !Array.isArray(job.config)
        ? job.config
        : {},
    summary:
      job?.summary && typeof job.summary === "object" && !Array.isArray(job.summary)
        ? job.summary
        : {},
    progress:
      job?.progress &&
      typeof job.progress === "object" &&
      !Array.isArray(job.progress)
        ? job.progress
        : {},
    lastBatch:
      job?.lastBatch &&
      typeof job.lastBatch === "object" &&
      !Array.isArray(job.lastBatch)
        ? job.lastBatch
        : null,
    failuresCount: safeNum(job?.failuresCount, 0),
    recentFailures: Array.isArray(job?.recentFailures) ? job.recentFailures : [],
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

async function listSavedJobs(limitRaw: any, includeActiveRaw: any) {
  await dbConnect();

  const limit = Math.max(
    1,
    Math.min(MAX_LIMIT, safeNum(limitRaw, DEFAULT_LIMIT))
  );
  const includeActive = safeStr(includeActiveRaw) === "1";

  const filter: Record<string, any> = {
    jobType: PRODUCT_DETAILS_JOB_TYPE,
  };

  if (!includeActive) {
    filter.status = {
      $in: ["completed", "completed_with_errors", "failed", "cancelled"],
    };
  }

  const docs: any[] = await BulkUploadJob.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .select({
      _id: 1,
      jobType: 1,
      jobLabel: 1,
      status: 1,
      createdBy: 1,
      meta: 1,
      config: 1,
      summary: 1,
      progress: 1,
      lastBatch: 1,
      failuresCount: 1,
      recentFailures: 1,
      resultMessage: 1,
      downloadFileName: 1,
      startedAt: 1,
      completedAt: 1,
      failedAt: 1,
      cancelledAt: 1,
      lastHeartbeatAt: 1,
      createdAt: 1,
      updatedAt: 1,
    })
    .lean();

  return (Array.isArray(docs) ? docs : []).map(buildJobDto);
}

async function cancelJobsByIds(jobIds: string[], actor: string) {
  await dbConnect();

  const ids = uniqueIds(jobIds);
  if (!ids.length) {
    return {
      matchedCount: 0,
      modifiedCount: 0,
    };
  }

  const now = new Date();

  const res = await BulkUploadJob.updateMany(
    {
      _id: { $in: ids },
      jobType: PRODUCT_DETAILS_JOB_TYPE,
      status: { $in: ["queued", "running", "processing_batch"] },
    },
    {
      $set: {
        status: "cancelled",
        cancelledAt: now,
        completedAt: now,
        updatedAt: now,
        lastHeartbeatAt: now,
        resultMessage: "Job force-cancelled from saved jobs panel.",
        "summary.needsManualResume": false,
        "summary.cancelRequested": true,
        "meta.forceCancelledBy": actor,
        "meta.forceCancelledAt": now.toISOString(),
      },
    }
  );

  return {
    matchedCount: safeNum((res as any)?.matchedCount, 0),
    modifiedCount: safeNum((res as any)?.modifiedCount, 0),
  };
}

async function cancelAllActiveJobs(actor: string) {
  await dbConnect();

  const activeDocs: Array<{ _id?: any }> = await BulkUploadJob.find({
    jobType: PRODUCT_DETAILS_JOB_TYPE,
    status: { $in: ["queued", "running", "processing_batch"] },
  })
    .select("_id")
    .lean();

  const ids = (Array.isArray(activeDocs) ? activeDocs : [])
    .map((x) => safeStr(x?._id))
    .filter(Boolean);

  return cancelJobsByIds(ids, actor);
}

async function deleteFinalJobsByIds(jobIds: string[]) {
  await dbConnect();

  const ids = uniqueIds(jobIds);
  if (!ids.length) {
    return {
      deletedCount: 0,
    };
  }

  const res = await BulkUploadJob.deleteMany({
    _id: { $in: ids },
    jobType: PRODUCT_DETAILS_JOB_TYPE,
    status: { $in: ["completed", "completed_with_errors", "failed", "cancelled"] },
  });

  return {
    deletedCount: safeNum((res as any)?.deletedCount, 0),
  };
}

async function deleteAllFinalJobs() {
  await dbConnect();

  const res = await BulkUploadJob.deleteMany({
    jobType: PRODUCT_DETAILS_JOB_TYPE,
    status: { $in: ["completed", "completed_with_errors", "failed", "cancelled"] },
  });

  return {
    deletedCount: safeNum((res as any)?.deletedCount, 0),
  };
}

export async function GET(req: NextRequest) {
  const access = await assertAccess();
  if (!access.ok) return access.res;

  try {
    const { searchParams } = new URL(req.url);
    const jobs = await listSavedJobs(
      searchParams.get("limit"),
      searchParams.get("includeActive")
    );

    const activeCount = jobs.filter((job) => isActiveJobStatus(job?.status)).length;
    const finalCount = jobs.filter((job) => isFinalJobStatus(job?.status)).length;

    return NextResponse.json(
      {
        ok: true,
        jobs,
        summary: {
          total: jobs.length,
          active: activeCount,
          final: finalCount,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message || "Failed to load saved jobs"),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const access = await assertAccess();
  if (!access.ok) return access.res;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = safeStr(body?.action) as BulkAction;
  const jobIds = uniqueIds(body?.jobIds || []);
  const actor = access.actor;

  if (!action) {
    return NextResponse.json(
      { ok: false, error: "Action required" },
      { status: 400 }
    );
  }

  try {
    if (action === "cancel_selected") {
      const result = await cancelJobsByIds(jobIds, actor);
      const jobs = await listSavedJobs(DEFAULT_LIMIT, "1");

      return NextResponse.json(
        {
          ok: true,
          message: `${result.modifiedCount} running job(s) cancelled.`,
          stats: result,
          jobs,
        },
        { status: 200 }
      );
    }

    if (action === "cancel_all_active") {
      const result = await cancelAllActiveJobs(actor);
      const jobs = await listSavedJobs(DEFAULT_LIMIT, "1");

      return NextResponse.json(
        {
          ok: true,
          message: `${result.modifiedCount} active job(s) cancelled.`,
          stats: result,
          jobs,
        },
        { status: 200 }
      );
    }

    if (action === "delete_selected") {
      const cancelResult = await cancelJobsByIds(jobIds, actor);
      const deleteResult = await deleteFinalJobsByIds(jobIds);
      const jobs = await listSavedJobs(DEFAULT_LIMIT, "1");

      return NextResponse.json(
        {
          ok: true,
          message: `${deleteResult.deletedCount} final job(s) deleted, ${cancelResult.modifiedCount} active job(s) cancelled.`,
          stats: {
            deletedCount: deleteResult.deletedCount,
            cancelledCount: cancelResult.modifiedCount,
          },
          jobs,
        },
        { status: 200 }
      );
    }

    if (action === "delete_all") {
      const cancelResult = await cancelAllActiveJobs(actor);
      const deleteResult = await deleteAllFinalJobs();
      const jobs = await listSavedJobs(DEFAULT_LIMIT, "1");

      return NextResponse.json(
        {
          ok: true,
          message: `${deleteResult.deletedCount} final job(s) deleted, ${cancelResult.modifiedCount} active job(s) cancelled.`,
          stats: {
            deletedCount: deleteResult.deletedCount,
            cancelledCount: cancelResult.modifiedCount,
          },
          jobs,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported action" },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message || "Saved jobs action failed"),
      },
      { status: 500 }
    );
  }
}