import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  claimBulkUploadJobBatch,
  completeBulkUploadJobBatch,
  failBulkUploadJob,
  getBulkUploadJob,
  isFinalBulkJobStatus,
  toPlainBulkJob,
} from "@/lib/bulkUploadJob";
import { processBulkSolvedPdfsJobBatch } from "@/lib/bulkSolvedPdfsJob";
import { hasPdfVaultPageAccess, safeStr } from "@/lib/pdfVault";

export const runtime = "nodejs";

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

async function assertVaultWriteAccess() {
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

  const allowed = await hasPdfVaultPageAccess(user.id);
  if (!allowed) {
    return {
      ok: false as const,
      res: NextResponse.json(
        { ok: false, error: "Vault access expired", needsPuzzle: true },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, user };
}

export async function POST(req: NextRequest) {
  const guard = await assertVaultWriteAccess();
  if (!guard.ok) return guard.res;

  const formData = await req.formData();
  const jobId = safeStr(formData.get("jobId"));

  if (!jobId) {
    return NextResponse.json(
      { ok: false, error: "jobId required" },
      { status: 400 }
    );
  }

  const batchFiles = formData
    .getAll("files")
    .filter((x) => x instanceof File) as File[];

  const createdBy = safeStr(guard.user.email);
  const currentJob = await getBulkUploadJob(jobId, createdBy);

  if (!currentJob) {
    return NextResponse.json(
      { ok: false, error: "Job not found" },
      { status: 404 }
    );
  }

  if (safeStr((currentJob as any)?.jobType) !== "solved_pdfs") {
    return NextResponse.json(
      { ok: false, error: "Invalid job type for this processor" },
      { status: 400 }
    );
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
    lockMs: 5 * 60 * 1000,
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
  const expectedBatchCount = Math.max(0, toIndex - fromIndex + 1);

  if (!expectedBatchCount) {
    const latest = await getBulkUploadJob(jobId, createdBy);

    return NextResponse.json(
      {
        ok: true,
        message: "No pending items left for processing.",
        job: toPlainBulkJob(latest),
      },
      { status: 200 }
    );
  }

  if (batchFiles.length !== expectedBatchCount) {
    const failedJob = await failBulkUploadJob({
      jobId,
      createdBy,
      lockToken: claim.lockToken,
      message: `Batch file count mismatch. Expected ${expectedBatchCount}, received ${batchFiles.length}.`,
    });

    return NextResponse.json(
      {
        ok: false,
        error: `Batch file count mismatch. Expected ${expectedBatchCount}, received ${batchFiles.length}.`,
        job: toPlainBulkJob(failedJob),
      },
      { status: 400 }
    );
  }

  try {
    const batchResult = await processBulkSolvedPdfsJobBatch({
      job: lockedJob,
      batchNumber,
      fromIndex,
      toIndex,
      batchFiles,
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
      message: safeStr(error?.message || "Solved PDFs batch processing failed"),
    });

    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message || "Solved PDFs batch processing failed"),
        job: toPlainBulkJob(failedJob),
      },
      { status: 500 }
    );
  }
}