import { NextRequest, NextResponse } from "next/server";

import dbConnect from "@/lib/db";
import PdfVaultFolder from "@/models/PdfVaultFolder";
import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  createBulkUploadJob,
  getLatestActiveBulkUploadJob,
  toPlainBulkJob,
} from "@/lib/bulkUploadJob";
import {
  normalizeBulkSolvedPdfsConfig,
  prepareSolvedPdfRowsFromClientFiles,
  validateBulkSolvedPdfsConfig,
} from "@/lib/bulkSolvedPdfsJob";
import { ensureRootFolder, safeStr } from "@/lib/pdfVault";

export const runtime = "nodejs";

const SAFE_REQUEST_PAYLOAD_BYTES = Math.trunc(3.5 * 1024 * 1024);
const FORM_DATA_BASE_OVERHEAD_BYTES = 32 * 1024;
const FORM_DATA_PER_FILE_OVERHEAD_BYTES = 4 * 1024;

type ClientFileMeta = {
  name: string;
  size: number;
  lastModified: number;
};

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function conflictResponse(message: string, extra?: Record<string, any>) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      ...extra,
    },
    { status: 409 }
  );
}

function formatBytes(bytes: number) {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function estimateBatchPayloadBytes(files: ClientFileMeta[] = []) {
  return files.reduce((sum: number, file: ClientFileMeta) => {
    return (
      sum +
      Math.max(0, Math.trunc(Number(file?.size || 0))) +
      FORM_DATA_PER_FILE_OVERHEAD_BYTES
    );
  }, FORM_DATA_BASE_OVERHEAD_BYTES);
}

function normalizeClientFileMeta(raw: any): ClientFileMeta {
  const name = safeStr(raw?.name);
  const size = Math.max(0, Math.trunc(Number(raw?.size || 0)));
  const lastModified = Math.max(0, Math.trunc(Number(raw?.lastModified || 0)));

  return {
    name,
    size,
    lastModified,
  };
}

function isPdfFileName(name: string) {
  return safeStr(name).toLowerCase().endsWith(".pdf");
}

function findOversizedSingleFile(
  files: ClientFileMeta[],
  maxBytes = SAFE_REQUEST_PAYLOAD_BYTES
) {
  return (
    files.find((file: ClientFileMeta) => estimateBatchPayloadBytes([file]) > maxBytes) || null
  );
}

function computeSafeFixedBatchSize(
  files: ClientFileMeta[],
  requestedBatchSize: number,
  maxBytes = SAFE_REQUEST_PAYLOAD_BYTES
) {
  const list = Array.isArray(files) ? files : [];
  if (!list.length) return 0;

  const desired = clamp(
    Math.trunc(Number(requestedBatchSize || 0)) || 1,
    1,
    500
  );

  let best = desired;

  for (let start = 0; start < list.length; start++) {
    let count = 0;
    let usedBytes = FORM_DATA_BASE_OVERHEAD_BYTES;

    for (let i = start; i < list.length && count < desired; i++) {
      const nextFileBytes =
        Math.max(0, Math.trunc(Number(list[i]?.size || 0))) +
        FORM_DATA_PER_FILE_OVERHEAD_BYTES;

      if (count === 0 && usedBytes + nextFileBytes > maxBytes) {
        return 0;
      }

      if (count > 0 && usedBytes + nextFileBytes > maxBytes) {
        break;
      }

      usedBytes += nextFileBytes;
      count += 1;
    }

    best = Math.min(best, count);

    if (best <= 1) {
      return 1;
    }
  }

  return Math.max(1, best);
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

export async function POST(req: NextRequest) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return badRequest("Invalid JSON body");
    }

    const rawFilesInput: any[] = Array.isArray(body?.files) ? body.files : [];
    if (!rawFilesInput.length) {
      return badRequest("At least one file metadata row is required");
    }

    if (rawFilesInput.length > 10000) {
      return badRequest("For safety, one job currently supports max 10000 PDF files");
    }

    const activeJob = await getLatestActiveBulkUploadJob({
      createdBy: safeStr(guard.user.email),
      jobType: "solved_pdfs",
    });

    if (activeJob) {
      return conflictResponse("Ek solved PDFs bulk job already running hai. Pehle usko finish ya cancel karo.", {
        job: toPlainBulkJob(activeJob),
      });
    }

    const normalizedFiles: ClientFileMeta[] = rawFilesInput
      .map((raw: any) => normalizeClientFileMeta(raw))
      .filter((file: ClientFileMeta) => Boolean(file.name));

    if (!normalizedFiles.length) {
      return badRequest("No valid file metadata rows found");
    }

    const nonPdf = normalizedFiles.find(
      (file: ClientFileMeta) => !isPdfFileName(file.name)
    );
    if (nonPdf) {
      return badRequest(`Only PDF files are supported. Invalid file: ${nonPdf.name}`);
    }

    const rawInput = {
      conflictMode: safeStr(body?.conflictMode || "ignore"),
      parentPath: safeStr(body?.parentPath || "root"),
      originalSelectionCount: Math.max(
        normalizedFiles.length,
        Math.trunc(
          safeNum(body?.originalSelectionCount || normalizedFiles.length, normalizedFiles.length)
        )
      ),
    };

    const config = normalizeBulkSolvedPdfsConfig(rawInput);
    validateBulkSolvedPdfsConfig(config);

    await dbConnect();
    await ensureRootFolder();

    const folder: any = await PdfVaultFolder.findOne({
      path: config.parentPath,
      deletedAt: null,
    })
      .select({ _id: 1, path: 1, name: 1 })
      .lean();

    if (!folder) {
      return badRequest("Target solved PDFs folder not found");
    }

    const rows = prepareSolvedPdfRowsFromClientFiles(normalizedFiles);

    if (!rows.length) {
      return badRequest("No valid PDF rows found");
    }

    const requestedBatchSize = clamp(
      Math.trunc(safeNum(body?.batchSize || 100, 100)),
      1,
      500
    );

    const oversizedSingle = findOversizedSingleFile(normalizedFiles);
    if (oversizedSingle) {
      return badRequest(
        `"${oversizedSingle.name}" current server-upload flow ke liye bahut bada hai. ` +
          `Estimated single-request payload ${formatBytes(
            estimateBatchPayloadBytes([oversizedSingle])
          )} hai, jabki safe limit ${formatBytes(
            SAFE_REQUEST_PAYLOAD_BYTES
          )} rakhi gayi hai.`
      );
    }

    const effectiveBatchSize = computeSafeFixedBatchSize(
      normalizedFiles,
      requestedBatchSize
    );

    if (!effectiveBatchSize) {
      return badRequest(
        "Current selection ke liye safe batch size compute nahi ho paayi."
      );
    }

    const created = await createBulkUploadJob({
      jobType: "solved_pdfs",
      createdBy: safeStr(guard.user.email),
      jobLabel: "Bulk Solved PDFs Upload",
      batchSize: effectiveBatchSize,
      totalItems: rows.length,
      meta: {
        conflictMode: config.conflictMode,
        parentPath: config.parentPath,
        folderId: String(folder._id),
        folderName: safeStr(folder.name),
        sourceType: "browser-batch",
        requestedBatchSize,
        effectiveBatchSize,
        safeRequestPayloadBytes: SAFE_REQUEST_PAYLOAD_BYTES,
      },
      config,
      input: {
        rows,
      },
      summary: {
        totalFiles: rows.length,
        validFiles: 0,
        uploadedFiles: 0,
        replacedFiles: 0,
        ignoredFiles: 0,
        skippedFiles: 0,
        failedFiles: 0,
        matchedProducts: 0,
        officialPapersDeleted: 0,
        conflictMode: config.conflictMode,
        parentPath: config.parentPath,
        folderId: String(folder._id),
        folderName: safeStr(folder.name),
        sourceType: "browser-batch",
        originalSelectionCount: config.originalSelectionCount,
        requestedBatchSize,
        effectiveBatchSize,
        safeRequestPayloadBytes: SAFE_REQUEST_PAYLOAD_BYTES,
      },
      downloadFileName: "bulk-solved-pdfs-upload-failures",
    });

    const message =
      effectiveBatchSize < requestedBatchSize
        ? `Bulk solved PDFs job created. Requested ${requestedBatchSize} files/batch tha, lekin safe upload ke liye auto-adjust karke ${effectiveBatchSize} files/batch set kiya gaya hai.`
        : "Bulk solved PDFs job created successfully.";

    return NextResponse.json(
      {
        ok: true,
        message,
        requestedBatchSize,
        effectiveBatchSize,
        safeRequestPayloadBytes: SAFE_REQUEST_PAYLOAD_BYTES,
        job: toPlainBulkJob(created),
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message || "Failed to create solved PDFs job"),
      },
      { status: 500 }
    );
  }
}