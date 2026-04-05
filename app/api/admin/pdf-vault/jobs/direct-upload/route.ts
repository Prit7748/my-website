import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  claimBulkUploadJobBatch,
  getBulkUploadJob,
  isFinalBulkJobStatus,
  toPlainBulkJob,
} from "@/lib/bulkUploadJob";
import {
  createDirectPdfUploadUrl,
  hasPdfVaultPageAccess,
  PDF_VAULT_DIRECT_UPLOAD_MAX_BYTES,
  safeStr,
} from "@/lib/pdfVault";

export const runtime = "nodejs";

type BatchRow = {
  rowNumber?: number;
  originalName?: string;
  fileName?: string;
  baseName?: string;
  skuNormalized?: string;
  sizeBytes?: number;
  lastModified?: number;
};

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function badRequest(message: string, extra?: Record<string, any>) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      ...extra,
    },
    { status: 400 }
  );
}

function normalizeName(name: string) {
  return safeStr(name).replace(/\\/g, "/").split("/").pop() || "";
}

function isPdfName(name: string) {
  return normalizeName(name).toLowerCase().endsWith(".pdf");
}

function formatBytes(bytes: number) {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getExpectedBatchWindow(job: any) {
  const totalItems = safeNum(job?.progress?.totalItems, 0);
  const processedItems = safeNum(job?.progress?.processedItems, 0);
  const batchSize = Math.max(1, safeNum(job?.progress?.batchSize, 100));

  const fromIndex = processedItems;
  const toIndex = Math.min(totalItems - 1, fromIndex + batchSize - 1);
  const batchNumber = Math.floor(fromIndex / batchSize) + 1;
  const expectedBatchCount = Math.max(0, toIndex - fromIndex + 1);

  return {
    totalItems,
    processedItems,
    batchSize,
    fromIndex,
    toIndex,
    batchNumber,
    expectedBatchCount,
  };
}

function getExpectedBatchRows(job: any, fromIndex: number, toIndex: number): BatchRow[] {
  const rows = Array.isArray(job?.input?.rows) ? job.input.rows : [];
  return rows.slice(fromIndex, toIndex + 1);
}

function computeDynamicLockMsFromRows(rows: BatchRow[]) {
  const totalBytes = rows.reduce(
    (sum, row) => sum + Math.max(0, Math.trunc(Number(row?.sizeBytes || 0))),
    0
  );
  const totalMB = totalBytes / (1024 * 1024);

  const estimatedMinutes = 5 + Math.ceil(totalMB / 150);
  return clamp(estimatedMinutes * 60 * 1000, 2 * 60 * 1000, 20 * 60 * 1000);
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

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const jobId = safeStr(body?.jobId);
  if (!jobId) {
    return badRequest("jobId required");
  }

  const createdBy = safeStr(guard.user.email);
  const currentJob = await getBulkUploadJob(jobId, createdBy);

  if (!currentJob) {
    return NextResponse.json(
      { ok: false, error: "Job not found" },
      { status: 404 }
    );
  }

  if (safeStr(currentJob?.jobType) !== "solved_pdfs") {
    return badRequest("Invalid job type for direct upload");
  }

  if (isFinalBulkJobStatus(safeStr(currentJob?.status))) {
    return NextResponse.json(
      {
        ok: true,
        message: "Job already finished.",
        job: toPlainBulkJob(currentJob),
      },
      { status: 200 }
    );
  }

  const preWindow = getExpectedBatchWindow(currentJob);

  if (preWindow.expectedBatchCount <= 0) {
    return NextResponse.json(
      {
        ok: true,
        message: "No pending items left for processing.",
        job: toPlainBulkJob(currentJob),
      },
      { status: 200 }
    );
  }

  const preRows = getExpectedBatchRows(
    currentJob,
    preWindow.fromIndex,
    preWindow.toIndex
  );

  const claim = await claimBulkUploadJobBatch({
    jobId,
    createdBy,
    lockMs: computeDynamicLockMsFromRows(preRows),
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
  const lockedWindow = getExpectedBatchWindow(lockedJob);

  if (lockedWindow.expectedBatchCount <= 0) {
    return NextResponse.json(
      {
        ok: true,
        message: "No pending items left for processing.",
        job: toPlainBulkJob(lockedJob),
      },
      { status: 200 }
    );
  }

  const expectedRows = getExpectedBatchRows(
    lockedJob,
    lockedWindow.fromIndex,
    lockedWindow.toIndex
  );

  const parentPath = safeStr(
    lockedJob?.config?.parentPath || lockedJob?.meta?.parentPath || "root"
  );

  const items = [];
  let readyCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < expectedRows.length; i++) {
    const row = expectedRows[i];
    const itemIndex = lockedWindow.fromIndex + i;
    const rowNumber = Math.max(1, Math.trunc(Number(row?.rowNumber || itemIndex + 1)));
    const fileName = safeStr(row?.fileName || row?.originalName);
    const skuNormalized = safeStr(row?.skuNormalized).toUpperCase();
    const sizeBytes = Math.max(0, Math.trunc(Number(row?.sizeBytes || 0)));

    if (!fileName) {
      skippedCount += 1;
      items.push({
        itemIndex,
        rowNumber,
        batchNumber: lockedWindow.batchNumber,
        fileName: "",
        skuNormalized,
        sizeBytes,
        status: "skipped",
        reason: "Empty file name",
      });
      continue;
    }

    if (!isPdfName(fileName)) {
      skippedCount += 1;
      items.push({
        itemIndex,
        rowNumber,
        batchNumber: lockedWindow.batchNumber,
        fileName,
        skuNormalized,
        sizeBytes,
        status: "skipped",
        reason: "Only PDF files are supported",
      });
      continue;
    }

    if (!sizeBytes) {
      skippedCount += 1;
      items.push({
        itemIndex,
        rowNumber,
        batchNumber: lockedWindow.batchNumber,
        fileName,
        skuNormalized,
        sizeBytes,
        status: "skipped",
        reason: "File size missing",
      });
      continue;
    }

    if (sizeBytes > PDF_VAULT_DIRECT_UPLOAD_MAX_BYTES) {
      skippedCount += 1;
      items.push({
        itemIndex,
        rowNumber,
        batchNumber: lockedWindow.batchNumber,
        fileName,
        skuNormalized,
        sizeBytes,
        status: "skipped",
        reason:
          `File size ${formatBytes(sizeBytes)} exceeds max allowed size ${formatBytes(
            PDF_VAULT_DIRECT_UPLOAD_MAX_BYTES
          )}`,
      });
      continue;
    }

    const presigned = await createDirectPdfUploadUrl({
      folderPath: parentPath,
      originalName: fileName,
      mimeType: "application/pdf",
      sizeBytes,
      expiresInSeconds: 20 * 60,
    });

    readyCount += 1;
    items.push({
      itemIndex,
      rowNumber,
      batchNumber: lockedWindow.batchNumber,
      fileName,
      skuNormalized,
      sizeBytes,
      status: "ready",
      upload: {
        bucket: presigned.bucket,
        key: presigned.key,
        uploadUrl: presigned.uploadUrl,
        contentType: presigned.contentType,
        headers: {
          "Content-Type": presigned.contentType,
        },
      },
    });
  }

  return NextResponse.json(
    {
      ok: true,
      mode: "direct_to_s3",
      message:
        skippedCount > 0
          ? `Direct upload batch prepared. ${readyCount} file ready, ${skippedCount} file skipped before upload.`
          : `Direct upload batch prepared. ${readyCount} file ready.`,
      maxFileBytes: PDF_VAULT_DIRECT_UPLOAD_MAX_BYTES,
      lockToken: claim.lockToken,
      batch: {
        batchNumber: lockedWindow.batchNumber,
        fromIndex: lockedWindow.fromIndex,
        toIndex: lockedWindow.toIndex,
        expectedCount: lockedWindow.expectedBatchCount,
      },
      items,
      job: toPlainBulkJob(lockedJob),
    },
    { status: 200 }
  );
}