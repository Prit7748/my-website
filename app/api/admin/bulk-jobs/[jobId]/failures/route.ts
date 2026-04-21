import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  buildBulkJobFailuresCsv,
  getBulkUploadJob,
} from "@/lib/bulkUploadJob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

type ParamsMaybePromise = {
  params: Promise<{ jobId: string }> | { jobId: string };
};

async function getJobId(ctx: ParamsMaybePromise) {
  const p: any = await (ctx as any).params;
  return safeStr(p?.jobId);
}

async function assertAdminReadAccess() {
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

  if (!hasPermission(user, "products:read") && !hasPermission(user, "products:write")) {
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

function buildDownloadName(job: any) {
  const base =
    safeStr(job?.downloadFileName) ||
    safeStr(job?.jobType) ||
    "bulk-job-failures";

  const cleanBase = base
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const suffix = safeStr(job?._id).slice(-8).toLowerCase() || "report";
  return `${cleanBase}-${suffix}.csv`;
}

export async function GET(_req: NextRequest, ctx: ParamsMaybePromise) {
  const guard = await assertAdminReadAccess();
  if (!guard.ok) return guard.res;

  const jobId = await getJobId(ctx);
  if (!jobId) {
    return NextResponse.json(
      { ok: false, error: "jobId required" },
      { status: 400 }
    );
  }

  const createdBy = safeStr(guard.user.email);
  const job = await getBulkUploadJob(jobId, createdBy);

  if (!job) {
    return NextResponse.json(
      { ok: false, error: "Job not found" },
      { status: 404 }
    );
  }

  const csv = buildBulkJobFailuresCsv(job);
  const fileName = buildDownloadName(job);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}