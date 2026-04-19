import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  createBulkUploadJob,
  getLatestActiveBulkUploadJob,
  toPlainBulkJob,
} from "@/lib/bulkUploadJob";
import {
  normalizeBulkDetailsConfig,
  prepareBulkDetailsRows,
  validateBulkDetailsConfig,
} from "@/lib/bulkProductDetailsJob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_FILE_BYTES = 6 * 1024 * 1024;
const MAX_ROWS_PER_JOB = 10000;
const ROW_BY_ROW_BATCH_SIZE = 1;

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function badRequest(message: string, extra?: Record<string, any>) {
  return NextResponse.json(
    { ok: false, error: message, ...(extra || {}) },
    { status: 400 }
  );
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

async function parseInputFromMultipart(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    throw new Error("File required");
  }

  if (file.size > MAX_UPLOAD_FILE_BYTES) {
    throw new Error("File exceeds 6MB limit");
  }

  const rawInput: any = {
    dryRun: formData.get("dryRun") === "true",
    category: String(formData.get("category") || ""),
    titleTemplate: String(formData.get("titleTemplate") || ""),
    importantNoteTemplate: String(formData.get("importantNoteTemplate") || ""),
    shortDescTemplate: String(formData.get("shortDescTemplate") || ""),
    longDescTemplate: String(formData.get("longDescTemplate") || ""),
    slugTemplate: String(formData.get("slugTemplate") || ""),
    metaTitleTemplate: String(formData.get("metaTitleTemplate") || ""),
    metaDescriptionTemplate: String(formData.get("metaDescriptionTemplate") || ""),
    publishNow: formData.get("publishNow") === "true",
    duplicateStrategy: String(formData.get("duplicateStrategy") || "ignore"),
    csvText: "",
  };

  const lowerName = safeStr(file.name).toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames?.[0];

    if (!firstSheetName) {
      throw new Error("Excel sheet not found");
    }

    const sheet = workbook.Sheets[firstSheetName];
    rawInput.csvText = XLSX.utils.sheet_to_csv(sheet);
  } else if (lowerName.endsWith(".csv")) {
    rawInput.csvText = buffer.toString("utf8");
  } else {
    throw new Error("Only CSV or Excel allowed");
  }

  return rawInput;
}

async function parseInputFromJson(req: Request) {
  let body: any = {};

  try {
    body = await req.json();
  } catch {
    throw new Error("Invalid JSON body");
  }

  return {
    dryRun: body?.dryRun === true,
    category: safeStr(body?.category),
    titleTemplate: safeStr(body?.titleTemplate),
    importantNoteTemplate: safeStr(body?.importantNoteTemplate),
    shortDescTemplate: safeStr(body?.shortDescTemplate),
    longDescTemplate: safeStr(body?.longDescTemplate),
    slugTemplate: safeStr(body?.slugTemplate),
    metaTitleTemplate: safeStr(body?.metaTitleTemplate),
    metaDescriptionTemplate: safeStr(body?.metaDescriptionTemplate),
    publishNow: body?.publishNow === true,
    duplicateStrategy: safeStr(body?.duplicateStrategy || "ignore"),
    csvText: safeStr(body?.csvText),
  };
}

export async function POST(req: Request) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  try {
    const createdBy = safeStr(guard.user.email);

    const existingActiveJob = await getLatestActiveBulkUploadJob({
      createdBy,
      jobType: "product_details",
    });

    if (existingActiveJob) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Ek bulk product details job already chal rahi hai. Nayi job start karne se pehle current job complete ya cancel karo.",
          activeJob: toPlainBulkJob(existingActiveJob),
        },
        { status: 409 }
      );
    }

    const contentType = safeStr(req.headers.get("content-type")).toLowerCase();

    const rawInput = contentType.includes("multipart/form-data")
      ? await parseInputFromMultipart(req)
      : await parseInputFromJson(req);

    let config: any;
    let rows: any[] = [];

    try {
      config = normalizeBulkDetailsConfig(rawInput);
      validateBulkDetailsConfig(config);

      const csvText = safeStr(rawInput?.csvText);
      if (!csvText) {
        return badRequest("CSV text required");
      }

      rows = prepareBulkDetailsRows(csvText);

      if (!rows.length) {
        return badRequest("No valid rows found");
      }

      if (rows.length > MAX_ROWS_PER_JOB) {
        return badRequest(
          `For safety, one job currently supports max ${MAX_ROWS_PER_JOB} rows`
        );
      }
    } catch (error: any) {
      return badRequest(safeStr(error?.message || "Invalid bulk details input"));
    }

    const created = await createBulkUploadJob({
      jobType: "product_details",
      createdBy,
      jobLabel: config.dryRun
        ? "Bulk Product Details Validation (Row-by-Row)"
        : "Bulk Product Details Upload (Row-by-Row)",
      batchSize: ROW_BY_ROW_BATCH_SIZE,
      totalItems: rows.length,
      meta: {
        dryRun: config.dryRun,
        category: config.category,
        duplicateStrategy: config.duplicateStrategy,
        processingMode: "row_by_row",
      },
      config: {
        ...config,
        processingMode: "row_by_row",
      },
      input: {
        rows,
      },
      summary: {
        totalRows: rows.length,
        validRows: 0,
        createdRows: 0,
        updatedRows: 0,
        skippedRows: 0,
        failedRows: 0,
        duplicateStrategy: config.duplicateStrategy,
        dryRun: config.dryRun,
        category: config.category,
        processingMode: "row_by_row",
        comboSync: {
          attempted: 0,
          succeeded: 0,
          failed: 0,
          errors: [],
          mode: "none",
        },
        hardcopySync: {
          attempted: 0,
          succeeded: 0,
          failed: 0,
          errors: [],
          mode: "none",
        },
      },
      downloadFileName: config.dryRun
        ? "bulk-product-details-validation-failures"
        : "bulk-product-details-upload-failures",
    });

    return NextResponse.json(
      {
        ok: true,
        message:
          "Bulk details job created successfully. Processing backend me row-by-row continue hogi.",
        job: toPlainBulkJob(created),
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message || "Failed to create bulk details job"),
      },
      { status: 500 }
    );
  }
}