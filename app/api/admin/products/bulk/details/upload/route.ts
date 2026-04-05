import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  normalizeBulkDetailsConfig,
  prepareBulkDetailsRows,
  validateBulkDetailsConfig,
  processBulkDetailsJobBatch,
  type PreparedBulkDetailsRow,
} from "@/lib/bulkProductDetailsJob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_UPLOAD_FILE_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_ROWS_PER_REQUEST = 10000;

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function safeBool(x: any, def = false) {
  if (typeof x === "boolean") return x;
  if (typeof x === "string") {
    const v = x.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(v)) return true;
    if (["false", "0", "no", "off"].includes(v)) return false;
  }
  return def;
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

function csvCell(input: any) {
  const raw = safeStr(input).replace(/\r?\n/g, " ");
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

function buildFailureCsv(failures: any[]) {
  const rows = Array.isArray(failures) ? failures : [];

  const header = [
    "Row Number",
    "Unique Id",
    "Subject Code",
    "Session",
    "Language",
    "Course Code",
    "Status",
    "Reason",
  ];

  const body = rows.map((row: any) => {
    const raw = row?.raw || {};
    return [
      csvCell(row?.rowNumber),
      csvCell(raw?.unique_id || raw?.A || ""),
      csvCell(raw?.subject_code || raw?.B || ""),
      csvCell(raw?.session || raw?.C || ""),
      csvCell(raw?.language || raw?.D || ""),
      csvCell(raw?.course_code || raw?.E || ""),
      csvCell(row?.status || ""),
      csvCell(row?.reason || ""),
    ].join(",");
  });

  return [header.map(csvCell).join(","), ...body].join("\n");
}

function normalizeExplicitRows(inputRows: any[]) {
  const rows = Array.isArray(inputRows) ? inputRows : [];

  return rows
    .map((row: any, index: number) => {
      const rowNumber = Math.max(
        1,
        Math.trunc(Number(row?.rowNumber || row?.row_number || index + 1))
      );

      return {
        rowNumber,
        A: safeStr(row?.A || row?.unique_id || row?.sku || ""),
        B: safeStr(row?.B || row?.subject_code || row?.subjectCode || ""),
        C: safeStr(row?.C || row?.session || ""),
        D: safeStr(row?.D || row?.language || ""),
        E: safeStr(row?.E || row?.course_code || row?.courseCode || ""),
      } satisfies PreparedBulkDetailsRow;
    })
    .filter((row) => row.A || row.B || row.C || row.D || row.E);
}

async function parseInputFromMultipart(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  const rawInput = {
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
    rows: [] as any[],
  };

  if (file) {
    if (file.size > MAX_UPLOAD_FILE_BYTES) {
      throw new Error("File exceeds 20MB limit");
    }

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
  } else {
    const rawRows = safeStr(formData.get("rows"));
    const rawCsvText = safeStr(formData.get("csvText"));

    if (rawRows) {
      try {
        rawInput.rows = JSON.parse(rawRows);
      } catch {
        throw new Error("Invalid rows JSON");
      }
    }

    rawInput.csvText = rawCsvText;
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
    dryRun: safeBool(body?.dryRun, false),
    category: safeStr(body?.category),
    titleTemplate: safeStr(body?.titleTemplate),
    importantNoteTemplate: safeStr(body?.importantNoteTemplate),
    shortDescTemplate: safeStr(body?.shortDescTemplate),
    longDescTemplate: safeStr(body?.longDescTemplate),
    slugTemplate: safeStr(body?.slugTemplate),
    metaTitleTemplate: safeStr(body?.metaTitleTemplate),
    metaDescriptionTemplate: safeStr(body?.metaDescriptionTemplate),
    publishNow: safeBool(body?.publishNow, false),
    duplicateStrategy: safeStr(body?.duplicateStrategy || "ignore"),
    csvText: safeStr(body?.csvText),
    rows: Array.isArray(body?.rows) ? body.rows : [],
  };
}

export async function POST(req: Request) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  try {
    const contentType = safeStr(req.headers.get("content-type")).toLowerCase();

    const rawInput = contentType.includes("multipart/form-data")
      ? await parseInputFromMultipart(req)
      : await parseInputFromJson(req);

    const config = normalizeBulkDetailsConfig(rawInput);
    validateBulkDetailsConfig(config);

    let rows: PreparedBulkDetailsRow[] = [];

    if (Array.isArray(rawInput.rows) && rawInput.rows.length) {
      rows = normalizeExplicitRows(rawInput.rows);
    } else {
      const csvText = safeStr(rawInput.csvText);
      if (!csvText) {
        return badRequest("CSV text, rows array, ya file required hai");
      }
      rows = prepareBulkDetailsRows(csvText);
    }

    if (!rows.length) {
      return badRequest("No valid rows found");
    }

    if (rows.length > MAX_ROWS_PER_REQUEST) {
      return badRequest(`One request currently supports max ${MAX_ROWS_PER_REQUEST} rows`);
    }

    const initialSummary = {
      totalRows: rows.length,
      validRows: 0,
      createdRows: 0,
      updatedRows: 0,
      skippedRows: 0,
      failedRows: 0,
      duplicateStrategy: config.duplicateStrategy,
      dryRun: config.dryRun,
      category: config.category,
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
    };

    const fakeJob = {
      config,
      input: { rows },
      summary: initialSummary,
    };

    const batchResult = await processBulkDetailsJobBatch({
      job: fakeJob,
      batchNumber: 1,
      fromIndex: 0,
      toIndex: rows.length - 1,
    });

    const summary = batchResult.summaryPatch || initialSummary;
    const failures = Array.isArray(batchResult.failures) ? batchResult.failures : [];
    const failureCsv = failures.length ? buildFailureCsv(failures) : "";

    return NextResponse.json(
      {
        ok: true,
        message: batchResult.note,
        mode: "direct_final_upload",
        summary: {
          ...summary,
          totalRows: rows.length,
          processedRows: Number(batchResult.processedDelta || 0),
          doneRows: config.dryRun
            ? 0
            : Number(summary?.createdRows || 0) + Number(summary?.updatedRows || 0),
        },
        failuresCount: failures.length,
        failures,
        failureCsv,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message || "Failed to process direct bulk details upload"),
      },
      { status: 500 }
    );
  }
}
