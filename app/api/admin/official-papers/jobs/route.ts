import { NextResponse } from "next/server";

import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  createBulkUploadJob,
  getLatestActiveBulkUploadJob,
  toPlainBulkJob,
} from "@/lib/bulkUploadJob";
import {
  normalizeBulkOfficialPapersConfig,
  prepareOfficialPaperRowsFromDirectBlock,
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

async function getExistingActiveOfficialPaperJob(createdBy: string) {
  const active = await getLatestActiveBulkUploadJob({
    createdBy,
    jobType: "official_papers",
  });

  return active || null;
}

async function createZipJob(args: {
  userEmail: string;
  formData: FormData;
}) {
  const file = args.formData.get("file") as File | null;

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
    conflictMode: safeStr(args.formData.get("conflictMode") || "ignore"),
    originalFileName: safeStr(file.name),
    sourceType: "zip",
    parentPath: "official-papers",
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
    Math.trunc(safeNum(args.formData.get("batchSize") || 100, 100)),
    25,
    500
  );

  const staged = await uploadOfficialPapersJobZipToS3({
    originalName: safeStr(file.name),
    zipBuffer,
  });

  const created = await createBulkUploadJob({
    jobType: "official_papers",
    createdBy: safeStr(args.userEmail),
    jobLabel: "Bulk Official Papers Upload",
    batchSize,
    totalItems: rows.length,
    meta: {
      conflictMode: config.conflictMode,
      originalFileName: config.originalFileName,
      sourceType: "zip",
      parentPath: "official-papers",
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
      message: "Bulk official papers ZIP job created successfully.",
      job: toPlainBulkJob(created),
    },
    { status: 201 }
  );
}

async function createDirectPdfJob(args: {
  userEmail: string;
  body: any;
}) {
  const items = Array.isArray(args.body?.items) ? args.body.items : [];

  const uploadLabel =
    safeStr(args.body?.uploadLabel) ||
    safeStr(args.body?.originalFileName) ||
    "Direct PDF Upload";

  const conflictMode = safeStr(args.body?.conflictMode || "ignore");
  const batchSize = clamp(
    Math.trunc(safeNum(args.body?.batchSize || 100, 100)),
    25,
    500
  );

  const rows = prepareOfficialPaperRowsFromDirectBlock({
    items,
    startingRowNumber: 1,
  });

  if (!rows.length) {
    return badRequest("Direct PDF job ke liye staged PDF items required hain");
  }

  if (rows.length > 10000) {
    return badRequest("For safety, one job currently supports max 10000 PDF files");
  }

  const blockIds = Array.from(
    new Set(
      rows
        .map((row) => safeStr(row.blockId))
        .filter(Boolean)
    )
  );

  const stagedKeys = rows
    .map((row) => safeStr(row.stagedPdfKey))
    .filter(Boolean);

  const config = normalizeBulkOfficialPapersConfig({
    conflictMode,
    originalFileName: uploadLabel,
    sourceType: "direct_pdf_blocks",
    parentPath: "official-papers",
  });

  validateBulkOfficialPapersConfig(config);

  const created = await createBulkUploadJob({
    jobType: "official_papers",
    createdBy: safeStr(args.userEmail),
    jobLabel: "Direct Official Papers Upload",
    batchSize,
    totalItems: rows.length,
    meta: {
      conflictMode: config.conflictMode,
      originalFileName: config.originalFileName,
      sourceType: "direct_pdf_blocks",
      parentPath: "official-papers",
      blockCount: blockIds.length,
    },
    config,
    input: {
      rows,
      stagedKeys,
      stagedKeyCount: stagedKeys.length,
      blockIds,
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
      sourceType: "direct_pdf_blocks",
      blockCount: blockIds.length,
      stagedKeyCount: stagedKeys.length,
    },
    downloadFileName: "direct-official-papers-upload-failures",
  });

  return NextResponse.json(
    {
      ok: true,
      message: "Direct official papers job created successfully.",
      job: toPlainBulkJob(created),
    },
    { status: 201 }
  );
}

export async function POST(req: Request) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  try {
    const createdBy = safeStr(guard.user.email);

    const activeJob = await getExistingActiveOfficialPaperJob(createdBy);
    if (activeJob) {
      return NextResponse.json(
        {
          ok: true,
          message:
            "An active official papers job already exists. Continuing with the same job.",
          job: toPlainBulkJob(activeJob),
        },
        { status: 200 }
      );
    }

    const contentType = safeStr(req.headers.get("content-type")).toLowerCase();

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      return await createZipJob({
        userEmail: createdBy,
        formData,
      });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const action = safeStr(body?.action).toLowerCase();
    const sourceType = safeStr(body?.sourceType).toLowerCase();

    if (
      action === "create_direct_job" ||
      action === "create-direct-job" ||
      action === "create_direct_pdf_job" ||
      action === "create-direct-pdf-job" ||
      sourceType === "direct_pdf_blocks"
    ) {
      return await createDirectPdfJob({
        userEmail: createdBy,
        body,
      });
    }

    return badRequest("Unsupported upload mode");
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