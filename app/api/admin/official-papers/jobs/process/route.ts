import { NextResponse } from "next/server";

import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  claimBulkUploadJobBatch,
  completeBulkUploadJobBatch,
  failBulkUploadJob,
  getBulkUploadJob,
  isFinalBulkJobStatus,
  toPlainBulkJob,
} from "@/lib/bulkUploadJob";
import { processBulkOfficialPapersJobBatch } from "@/lib/bulkOfficialPapersJob";

export const runtime = "nodejs";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
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

export async function POST(req: Request) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const jobId = safeStr(body?.jobId);
  if (!jobId) {
    return NextResponse.json({ ok: false, error: "jobId required" }, { status: 400 });
  }

  const createdBy = safeStr(guard.user.email);
  const currentJob = await getBulkUploadJob(jobId, createdBy);

  if (!currentJob) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  if (isFinalBulkJobStatus(safeStr((currentJob as any)?.status))) {
    return NextResponse.json(
      {
        ok: true,
        message: "Job already finished.",
        job: toPlainBulkJob(currentJob),
      },
      { status: 200 }
    );
  }

  const claim = await claimBulkUploadJobBatch({
    jobId,
    createdBy,
    lockMs: 180000,
  });

  if (!claim.ok) {
    const latest = await getBulkUploadJob(jobId, createdBy);

    return NextResponse.json(
      {
        ok: true,
        message: claim.error || "Job already in progress.",
        job: toPlainBulkJob(latest),
      },
      { status: 200 }
    );
  }

  const lockedJob = claim.job;
  const totalItems = safeNum(lockedJob?.progress?.totalItems, 0);
  const processedItems = safeNum(lockedJob?.progress?.processedItems, 0);
  const batchSize = Math.max(1, safeNum(lockedJob?.progress?.batchSize, 100));

  const fromIndex = processedItems;
  const toIndex = Math.min(totalItems - 1, fromIndex + batchSize - 1);
  const batchNumber = Math.floor(fromIndex / batchSize) + 1;

  try {
    const batchResult = await processBulkOfficialPapersJobBatch({
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

    return NextResponse.json(
      {
        ok: true,
        message: batchResult.note,
        job: toPlainBulkJob(updatedJob),
      },
      { status: 200 }
    );
  } catch (error: any) {
    const failedJob = await failBulkUploadJob({
      jobId,
      createdBy,
      lockToken: claim.lockToken,
      message: safeStr(error?.message || "Official papers batch processing failed"),
    });

    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message || "Official papers batch processing failed"),
        job: toPlainBulkJob(failedJob),
      },
      { status: 500 }
    );
  }
}