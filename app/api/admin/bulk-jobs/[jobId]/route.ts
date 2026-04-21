import { NextRequest, NextResponse } from "next/server";

import dbConnect from "@/lib/db";
import BulkUploadJob from "@/models/BulkUploadJob";
import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  cancelBulkUploadJob,
  getBulkUploadJob,
  isFinalBulkJobStatus,
  toPlainBulkJob,
} from "@/lib/bulkUploadJob";
import { getBulkDetailsPipelineStage } from "@/lib/bulkProductDetailsJob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function cloneRecord(input: any) {
  return input && typeof input === "object" && !Array.isArray(input)
    ? { ...input }
    : {};
}

function isProductDetailsJob(job: any) {
  return safeStr(job?.jobType) === "product_details";
}

function isRecoverablePrematureCompletedProductDetailsJob(job: any) {
  const status = safeStr(job?.status);
  const pipelineStage = getBulkDetailsPipelineStage(job);

  return (
    isProductDetailsJob(job) &&
    (status === "completed" || status === "completed_with_errors") &&
    pipelineStage !== "completed"
  );
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

type ParamsMaybePromise = {
  params: Promise<{ jobId: string }> | { jobId: string };
};

async function getJobId(ctx: ParamsMaybePromise) {
  const p: any = await (ctx as any).params;
  return safeStr(p?.jobId);
}

async function getOwnedJob(jobId: string, createdBy: string) {
  await dbConnect();

  const job: any = await BulkUploadJob.findOne({
    _id: safeStr(jobId),
    createdBy: safeStr(createdBy),
  });

  return job || null;
}

async function recoverPrematureCompletedProductDetailsJobIfNeeded(
  jobId: string,
  createdBy: string
) {
  const job: any = await getOwnedJob(jobId, createdBy);

  if (!job) {
    return null;
  }

  if (!isRecoverablePrematureCompletedProductDetailsJob(job)) {
    return job;
  }

  const now = new Date();
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
        completedAt: null,
        failedAt: null,
        cancelledAt: null,
        lockToken: "",
        lockExpiresAt: null,
        lastHeartbeatAt: now,
        summary,
        meta,
        resultMessage:
          "Premature completed state recover kar di gayi. Job resume/pause/cancel ke liye ready hai.",
      },
    },
    { new: true }
  );

  return updated || job;
}

async function requestPause(jobId: string, createdBy: string) {
  const job: any = await recoverPrematureCompletedProductDetailsJobIfNeeded(
    jobId,
    createdBy
  );

  if (!job) {
    return { ok: false as const, status: 404, error: "Job not found" };
  }

  if (isFinalBulkJobStatus(job.status)) {
    return {
      ok: true as const,
      message: "Job already finished. Pause ki need nahi hai.",
      job,
    };
  }

  const now = new Date();
  const summary = cloneRecord(job.summary);
  const meta = cloneRecord(job.meta);

  summary.needsManualResume = true;
  summary.lastPausedAt = now;
  meta.pauseRequested = true;
  meta.pauseRequestedAt = now;

  if (safeStr(job.status) === "processing_batch") {
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
            "Pause requested. Current row/step complete hone ke baad processing ruk jayegi.",
          lastHeartbeatAt: now,
        },
      },
      { new: true }
    );

    return {
      ok: true as const,
      message:
        "Pause request save ho gayi. Current row/step finish hone ke baad job ruk jayegi.",
      job: updated,
    };
  }

  const updated: any = await BulkUploadJob.findOneAndUpdate(
    {
      _id: String(job._id),
      createdBy: safeStr(createdBy),
    },
    {
      $set: {
        status: "queued",
        summary,
        meta,
        resultMessage:
          "Bulk job paused. Resume karke wahi se continue kar sakte ho.",
        lockToken: "",
        lockExpiresAt: null,
        lastHeartbeatAt: now,
      },
    },
    { new: true }
  );

  return {
    ok: true as const,
    message: "Bulk job paused successfully.",
    job: updated,
  };
}

async function requestResume(jobId: string, createdBy: string) {
  const job: any = await recoverPrematureCompletedProductDetailsJobIfNeeded(
    jobId,
    createdBy
  );

  if (!job) {
    return { ok: false as const, status: 404, error: "Job not found" };
  }

  const status = safeStr(job.status);

  if (status === "failed") {
    return {
      ok: false as const,
      status: 409,
      error:
        "Ye failed job hai. Isko resume nahi kar sakte. Zarurat ho to nayi job create karo.",
    };
  }

  if (status === "completed" || status === "completed_with_errors") {
    return {
      ok: false as const,
      status: 409,
      error:
        "Ye finished job hai. Isko resume nahi kar sakte. Zarurat ho to nayi job create karo.",
    };
  }

  if (status === "cancelled") {
    return {
      ok: false as const,
      status: 409,
      error:
        "Cancelled job ko resume nahi kar sakte. Pause use karo, cancel nahi, agar later continue karna ho.",
    };
  }

  const now = new Date();
  const summary = cloneRecord(job.summary);
  const meta = cloneRecord(job.meta);

  summary.needsManualResume = false;
  summary.resumeCount = safeNum(summary.resumeCount, 0) + 1;
  summary.lastResumeRequestedAt = now;

  meta.pauseRequested = false;
  meta.pauseRequestedAt = null;
  meta.resumeRequestedAt = now;

  if (status === "processing_batch") {
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
            "Resume request save ho gayi. Current row/step ke baad processing continue rahegi.",
          lastHeartbeatAt: now,
        },
      },
      { new: true }
    );

    return {
      ok: true as const,
      message:
        "Resume request save ho gayi. Active processing ke baad job continue rahegi.",
      job: updated,
    };
  }

  const updated: any = await BulkUploadJob.findOneAndUpdate(
    {
      _id: String(job._id),
      createdBy: safeStr(createdBy),
    },
    {
      $set: {
        status: "queued",
        summary,
        meta,
        resultMessage:
          "Resume requested. Start/Resume button se processing wahi se continue hogi.",
        lockToken: "",
        lockExpiresAt: null,
        lastHeartbeatAt: now,
      },
    },
    { new: true }
  );

  return {
    ok: true as const,
    message: "Bulk job resume-ready state me set ho gayi.",
    job: updated,
  };
}

async function requestCancel(jobId: string, createdBy: string) {
  const job: any = await recoverPrematureCompletedProductDetailsJobIfNeeded(
    jobId,
    createdBy
  );

  if (!job) {
    return { ok: false as const, status: 404, error: "Job not found" };
  }

  if (isFinalBulkJobStatus(job.status)) {
    return {
      ok: true as const,
      message: "Job already finished.",
      job,
    };
  }

  const status = safeStr(job.status);

  if (status === "processing_batch") {
    const now = new Date();
    const summary = cloneRecord(job.summary);
    const meta = cloneRecord(job.meta);

    summary.cancelRequestedAt = now;
    meta.cancelRequested = true;
    meta.cancelRequestedAt = now;

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
            "Cancel requested. Current row/step complete hone ke baad job cancel hogi.",
          lastHeartbeatAt: now,
        },
      },
      { new: true }
    );

    return {
      ok: true as const,
      message:
        "Cancel request save ho gayi. Current row/step finish hone ke baad job cancel hogi.",
      job: updated,
    };
  }

  const cancelled = await cancelBulkUploadJob({
    jobId,
    createdBy,
  });

  if (!cancelled.ok) {
    return {
      ok: false as const,
      status: 404,
      error: cancelled.error || "Cancel failed",
    };
  }

  return {
    ok: true as const,
    message: "Bulk job cancelled.",
    job: cancelled.job,
  };
}

export async function GET(_req: NextRequest, ctx: ParamsMaybePromise) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  const jobId = await getJobId(ctx);
  if (!jobId) {
    return NextResponse.json(
      { ok: false, error: "jobId required" },
      { status: 400 }
    );
  }

  const job = await getBulkUploadJob(jobId, safeStr(guard.user.email));
  if (!job) {
    return NextResponse.json(
      { ok: false, error: "Job not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      job: toPlainBulkJob(job),
    },
    { status: 200 }
  );
}

export async function POST(req: NextRequest, ctx: ParamsMaybePromise) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  const jobId = await getJobId(ctx);
  if (!jobId) {
    return NextResponse.json(
      { ok: false, error: "jobId required" },
      { status: 400 }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = safeStr(body?.action).toLowerCase();
  const createdBy = safeStr(guard.user.email);

  if (!["cancel", "pause", "resume"].includes(action)) {
    return NextResponse.json(
      { ok: false, error: "Unsupported action" },
      { status: 400 }
    );
  }

  let result:
    | {
        ok: true;
        message: string;
        job: any;
      }
    | {
        ok: false;
        status: number;
        error: string;
      };

  if (action === "pause") {
    result = await requestPause(jobId, createdBy);
  } else if (action === "resume") {
    result = await requestResume(jobId, createdBy);
  } else {
    result = await requestCancel(jobId, createdBy);
  }

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: result.message,
      action,
      job: toPlainBulkJob(result.job),
    },
    { status: 200 }
  );
}