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
import {
  ensureRootFolder,
  PDF_VAULT_DIRECT_UPLOAD_MAX_BYTES,
  safeStr,
} from "@/lib/pdfVault";

export const runtime = "nodejs";

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
      return conflictResponse(
        "Ek solved PDFs bulk job already running hai. Pehle usko finish ya cancel karo.",
        {
          job: toPlainBulkJob(activeJob),
        }
      );
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
          safeNum(
            body?.originalSelectionCount || normalizedFiles.length,
            normalizedFiles.length
          )
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
      Math.trunc(safeNum(body?.batchSize || 50, 50)),
      1,
      500
    );

    const oversizedCount = normalizedFiles.filter(
      (file: ClientFileMeta) => Number(file.size || 0) > PDF_VAULT_DIRECT_UPLOAD_MAX_BYTES
    ).length;

    const created = await createBulkUploadJob({
      jobType: "solved_pdfs",
      createdBy: safeStr(guard.user.email),
      jobLabel: "Bulk Solved PDFs Upload",
      batchSize: requestedBatchSize,
      totalItems: rows.length,
      meta: {
        conflictMode: config.conflictMode,
        parentPath: config.parentPath,
        folderId: String(folder._id),
        folderName: safeStr(folder.name),
        sourceType: "direct-to-s3",
        requestedBatchSize,
        effectiveBatchSize: requestedBatchSize,
        maxDirectUploadBytes: PDF_VAULT_DIRECT_UPLOAD_MAX_BYTES,
        oversizedSelectionCount: oversizedCount,
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
        sourceType: "direct-to-s3",
        originalSelectionCount: config.originalSelectionCount,
        requestedBatchSize,
        effectiveBatchSize: requestedBatchSize,
        maxDirectUploadBytes: PDF_VAULT_DIRECT_UPLOAD_MAX_BYTES,
        oversizedSelectionCount: oversizedCount,
      },
      downloadFileName: "bulk-solved-pdfs-upload-failures",
    });

    const message =
      oversizedCount > 0
        ? `Bulk solved PDFs job created. ${oversizedCount} file 20MB limit se upar hain; upload time par woh skipped ho jayengi, baaki files continue hongi.`
        : "Bulk solved PDFs job created successfully.";

    return NextResponse.json(
      {
        ok: true,
        message,
        requestedBatchSize,
        effectiveBatchSize: requestedBatchSize,
        maxDirectUploadBytes: PDF_VAULT_DIRECT_UPLOAD_MAX_BYTES,
        oversizedSelectionCount: oversizedCount,
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