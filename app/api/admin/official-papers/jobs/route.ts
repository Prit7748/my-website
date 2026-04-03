import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { getAuthUser, hasPermission } from "@/lib/auth";
import { createBulkUploadJob, toPlainBulkJob } from "@/lib/bulkUploadJob";
import {
  normalizeBulkOfficialPapersConfig,
  prepareOfficialPaperRowsFromZipBuffer,
  uploadOfficialPapersJobZipToS3,
  validateBulkOfficialPapersConfig,
} from "@/lib/bulkOfficialPapersJob";

export const runtime = "nodejs";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

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

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return badRequest("ZIP file required");
    }

    const lowerName = safeStr(file.name).toLowerCase();
    if (!lowerName.endsWith(".zip")) {
      return badRequest("Only ZIP allowed");
    }

    if (file.size > 500 * 1024 * 1024) {
      return badRequest("ZIP exceeds 500MB limit");
    }

    const zipBuffer = Buffer.from(await file.arrayBuffer());

    const rawInput = {
      conflictMode: safeStr(formData.get("conflictMode") || "ignore"),
      originalFileName: safeStr(file.name),
    };

    const config = normalizeBulkOfficialPapersConfig(rawInput);
    validateBulkOfficialPapersConfig(config);

    const rows = prepareOfficialPaperRowsFromZipBuffer(zipBuffer);

    if (!rows.length) {
      return badRequest("ZIP me koi valid PDF file nahi mili");
    }

    if (rows.length > 10000) {
      return badRequest("For safety, one job currently supports max 10000 PDF files");
    }

    const batchSize = clamp(
      Math.trunc(safeNum(formData.get("batchSize") || 100, 100)),
      25,
      500
    );

    const staged = await uploadOfficialPapersJobZipToS3({
      originalName: safeStr(file.name),
      zipBuffer,
    });

    const created = await createBulkUploadJob({
      jobType: "official_papers",
      createdBy: safeStr(guard.user.email),
      jobLabel: "Bulk Official Papers Upload",
      batchSize,
      totalItems: rows.length,
      meta: {
        conflictMode: config.conflictMode,
        originalFileName: config.originalFileName,
        sourceType: "zip",
      },
      config,
      input: {
        rows,
        stagingZipKey: staged.key,
        stagingBucket: staged.bucket,
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
        conflictMode: config.conflictMode,
        originalFileName: config.originalFileName,
        parentPath: "official-papers",
        sourceType: "zip",
        stagingZipKey: staged.key,
      },
      downloadFileName: "bulk-official-papers-upload-failures",
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Bulk official papers job created successfully.",
        job: toPlainBulkJob(created),
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message || "Failed to create official papers job"),
      },
      { status: 500 }
    );
  }
}