import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/db";
import BulkUploadJob from "@/models/BulkUploadJob";
import { getAuthUser, hasPermission } from "@/lib/auth";
import { buildBulkJobFailuresCsv } from "@/lib/bulkUploadJob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PRODUCT_DETAILS_JOB_TYPE = "product_details";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeFileName(input: any) {
  const raw = safeStr(input) || "bulk-product-details-failures.csv";
  const withoutExt = raw.toLowerCase().endsWith(".csv") ? raw.slice(0, -4) : raw;

  const clean = withoutExt
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180);

  return `${clean || "bulk-product-details-failures"}.csv`;
}

function withCsvBom(csv: string) {
  return `\uFEFF${csv}`;
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

  return {
    ok: true as const,
    user,
    createdBy: safeStr(user.email),
  };
}

function filterFailuresByScope(job: any, scope: string) {
  const rows = Array.isArray(job?.failures) ? job.failures : [];

  if (scope !== "failed") {
    return rows;
  }

  return rows.filter((row: any) => {
    const status = safeStr(row?.status).toLowerCase();
    return !status || status === "failed" || status === "error";
  });
}

export async function GET(req: NextRequest, context: any) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  try {
    await dbConnect();

    const params = await context?.params;
    const jobId = safeStr(params?.jobId);

    if (!jobId) {
      return NextResponse.json(
        { ok: false, error: "jobId required" },
        { status: 400 }
      );
    }

    if (!isValidObjectId(jobId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid jobId" },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const scope = safeStr(url.searchParams.get("scope")).toLowerCase();

    const job: any = await BulkUploadJob.findOne({
      _id: jobId,
      createdBy: guard.createdBy,
      jobType: PRODUCT_DETAILS_JOB_TYPE,
    })
      .select({
        _id: 1,
        jobType: 1,
        createdBy: 1,
        failures: 1,
        downloadFileName: 1,
        createdAt: 1,
      })
      .lean();

    if (!job) {
      return NextResponse.json(
        { ok: false, error: "Job not found" },
        { status: 404 }
      );
    }

    const exportJob = {
      ...job,
      failures: filterFailuresByScope(job, scope),
    };

    const csv = buildBulkJobFailuresCsv(exportJob);
    const fileName = safeFileName(job?.downloadFileName);

    return new Response(withCsvBom(csv), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message || "Failed to download failures CSV"),
      },
      { status: 500 }
    );
  }
}