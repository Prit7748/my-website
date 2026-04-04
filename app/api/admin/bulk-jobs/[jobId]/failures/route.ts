import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  buildBulkJobFailuresCsv,
  getBulkUploadJob,
} from "@/lib/bulkUploadJob";

export const runtime = "nodejs";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeFileName(input: string) {
  return (
    safeStr(input)
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "bulk-job-failures"
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
      res: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }),
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

  const csv = buildBulkJobFailuresCsv(job);
  const fileNameBase =
    safeFileName(safeStr((job as any)?.downloadFileName)) ||
    safeFileName(`${safeStr((job as any)?.jobType)}-failures`);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileNameBase}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}