import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  cancelBulkUploadJob,
  getBulkUploadJob,
  toPlainBulkJob,
} from "@/lib/bulkUploadJob";

export const runtime = "nodejs";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

async function assertAdminWriteAccess() {
  const user = await getAuthUser();

  if (!user) {
    return {
      ok: false as const,
      res: NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 }),
    };
  }

  if (!hasPermission(user, "products:write")) {
    return {
      ok: false as const,
      res: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, user };
}

type ParamsMaybePromise = { params: Promise<{ jobId: string }> | { jobId: string } };

async function getJobId(ctx: ParamsMaybePromise) {
  const p: any = await (ctx as any).params;
  return safeStr(p?.jobId);
}

export async function GET(_req: NextRequest, ctx: ParamsMaybePromise) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  const jobId = await getJobId(ctx);
  if (!jobId) {
    return NextResponse.json({ ok: false, error: "jobId required" }, { status: 400 });
  }

  const job = await getBulkUploadJob(jobId, safeStr(guard.user.email));
  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
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
    return NextResponse.json({ ok: false, error: "jobId required" }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = safeStr(body?.action).toLowerCase();
  if (action !== "cancel") {
    return NextResponse.json({ ok: false, error: "Unsupported action" }, { status: 400 });
  }

  const cancelled = await cancelBulkUploadJob({
    jobId,
    createdBy: safeStr(guard.user.email),
  });

  if (!cancelled.ok) {
    return NextResponse.json({ ok: false, error: cancelled.error || "Cancel failed" }, { status: 404 });
  }

  return NextResponse.json(
    {
      ok: true,
      message: "Bulk job cancelled.",
      job: toPlainBulkJob(cancelled.job),
    },
    { status: 200 }
  );
}