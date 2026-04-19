import { NextResponse } from "next/server";

import dbConnect from "@/lib/db";
import BulkUploadJob from "@/models/BulkUploadJob";
import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  getLatestActiveBulkUploadJob,
  toPlainBulkJob,
} from "@/lib/bulkUploadJob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeStr(x: any) {
  return String(x ?? "").trim();
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

export async function GET() {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  await dbConnect();

  const createdBy = safeStr(guard.user.email);

  const [activeJobRaw, latestJobRaw] = await Promise.all([
    getLatestActiveBulkUploadJob({
      createdBy,
      jobType: "product_details",
    }),
    BulkUploadJob.findOne({
      createdBy,
      jobType: "product_details",
    }).sort({ createdAt: -1, _id: -1 }),
  ]);

  const activeJob = toPlainBulkJob(activeJobRaw);
  const latestJob = toPlainBulkJob(latestJobRaw);

  return NextResponse.json(
    {
      ok: true,
      hasActiveJob: Boolean(activeJob),
      activeJob,
      latestJob,
      job: activeJob || latestJob || null,
      message: activeJob
        ? "Active bulk product details job found."
        : latestJob
        ? "No active job found. Returning latest product details job."
        : "No bulk product details job found.",
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}