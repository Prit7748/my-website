import { NextRequest, NextResponse } from "next/server";

import dbConnect from "@/lib/db";
import PdfVaultFolder from "@/models/PdfVaultFolder";
import { getAuthUser, hasPermission } from "@/lib/auth";
import { createBulkUploadJob, toPlainBulkJob } from "@/lib/bulkUploadJob";
import {
  normalizeBulkSolvedPdfsConfig,
  prepareSolvedPdfRowsFromClientFiles,
  validateBulkSolvedPdfsConfig,
} from "@/lib/bulkSolvedPdfsJob";
import { ensureRootFolder, safeStr } from "@/lib/pdfVault";

export const runtime = "nodejs";

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

    const rawFiles = Array.isArray(body?.files) ? body.files : [];
    if (!rawFiles.length) {
      return badRequest("At least one file metadata row is required");
    }

    if (rawFiles.length > 10000) {
      return badRequest("For safety, one job currently supports max 10000 PDF files");
    }

    const rawInput = {
      conflictMode: safeStr(body?.conflictMode || "ignore"),
      parentPath: safeStr(body?.parentPath || "root"),
      originalSelectionCount: Math.max(
        rawFiles.length,
        Math.trunc(safeNum(body?.originalSelectionCount || rawFiles.length, rawFiles.length))
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

    const rows = prepareSolvedPdfRowsFromClientFiles(rawFiles);

    if (!rows.length) {
      return badRequest("No valid file rows found");
    }

    const pdfRows = rows.filter((row) => safeStr(row.fileName).toLowerCase().endsWith(".pdf"));
    if (!pdfRows.length) {
      return badRequest("Only PDF files are supported");
    }

    const batchSize = clamp(
      Math.trunc(safeNum(body?.batchSize || 100, 100)),
      25,
      500
    );

    const created = await createBulkUploadJob({
      jobType: "solved_pdfs",
      createdBy: safeStr(guard.user.email),
      jobLabel: "Bulk Solved PDFs Upload",
      batchSize,
      totalItems: pdfRows.length,
      meta: {
        conflictMode: config.conflictMode,
        parentPath: config.parentPath,
        folderId: String(folder._id),
        folderName: safeStr(folder.name),
        sourceType: "browser-batch",
      },
      config,
      input: {
        rows: pdfRows,
      },
      summary: {
        totalFiles: pdfRows.length,
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
      },
      downloadFileName: "bulk-solved-pdfs-upload-failures",
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Bulk solved PDFs job created successfully.",
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