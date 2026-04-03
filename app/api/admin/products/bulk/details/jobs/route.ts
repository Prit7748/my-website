import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  createBulkUploadJob,
  toPlainBulkJob,
} from "@/lib/bulkUploadJob";
import {
  normalizeBulkDetailsConfig,
  prepareBulkDetailsRows,
  validateBulkDetailsConfig,
} from "@/lib/bulkProductDetailsJob";

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
      res: NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, user };
}

export async function POST(req: Request) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  try {
    let rawInput: any = {};
    let csvTextFromFile = "";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return badRequest("File required");
      }

      if (file.size > 6 * 1024 * 1024) {
        return badRequest("File exceeds 6MB limit");
      }

      const lowerName = safeStr(file.name).toLowerCase();
      const buffer = Buffer.from(await file.arrayBuffer());

      if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const firstSheetName = workbook.SheetNames?.[0];

        if (!firstSheetName) {
          return badRequest("Excel sheet not found");
        }

        const sheet = workbook.Sheets[firstSheetName];
        csvTextFromFile = XLSX.utils.sheet_to_csv(sheet);
      } else if (lowerName.endsWith(".csv")) {
        csvTextFromFile = buffer.toString("utf8");
      } else {
        return badRequest("Only CSV or Excel allowed");
      }

      rawInput = {
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
        batchSize: Number(formData.get("batchSize") || 500),
        csvText: csvTextFromFile,
      };
    } else {
      try {
        rawInput = await req.json();
      } catch {
        return badRequest("Invalid JSON body");
      }
    }

    let config: any;
    let rows: any[] = [];

    try {
      config = normalizeBulkDetailsConfig(rawInput);
      validateBulkDetailsConfig(config);

      const csvText = safeStr(rawInput?.csvText || csvTextFromFile);
      if (!csvText) {
        return badRequest("CSV text required");
      }

      rows = prepareBulkDetailsRows(csvText);
      if (!rows.length) {
        return badRequest("No valid rows found");
      }

      if (rows.length > 10000) {
        return badRequest("For safety, one job currently supports max 10000 rows");
      }
    } catch (error: any) {
      return badRequest(safeStr(error?.message || "Invalid bulk details input"));
    }

    const batchSize = clamp(
      Math.trunc(safeNum(rawInput?.batchSize, 500)),
      50,
      1000
    );

    const created = await createBulkUploadJob({
      jobType: "product_details",
      createdBy: safeStr(guard.user.email),
      jobLabel: config.dryRun
        ? "Bulk Product Details Validation"
        : "Bulk Product Details Upload",
      batchSize,
      totalItems: rows.length,
      meta: {
        dryRun: config.dryRun,
        category: config.category,
        duplicateStrategy: config.duplicateStrategy,
      },
      config,
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
        message: "Bulk details job created successfully.",
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