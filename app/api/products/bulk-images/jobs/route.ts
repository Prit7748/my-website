import { NextResponse } from "next/server";

import dbConnect from "@/lib/db";
import PdfVaultFolder from "@/models/PdfVaultFolder";
import { getAuthUser, hasPermission } from "@/lib/auth";
import { createBulkUploadJob, toPlainBulkJob } from "@/lib/bulkUploadJob";
import {
  normalizeBulkImagesConfig,
  prepareBulkImageRowsFromZipBuffer,
  validateBulkImagesConfig,
} from "@/lib/bulkProductImagesJob";

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
    const contentType = req.headers.get("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return badRequest("ZIP upload must use multipart/form-data");
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return badRequest("ZIP file required");
    }

    if (!safeStr(file.name).toLowerCase().endsWith(".zip")) {
      return badRequest("Only ZIP allowed");
    }

    const rawInput = {
      parentPath: String(formData.get("parentPath") || ""),
      mode: String(formData.get("mode") || "append"),
      originalFileName: safeStr(file.name),
    };

    let config: any;
    let preparedRows: any[] = [];
    let summaryRows: any[] = [];

    try {
      config = normalizeBulkImagesConfig(rawInput);
      validateBulkImagesConfig(config);

      await dbConnect();

      const parentFolder: any = await PdfVaultFolder.findOne({
        path: config.parentPath,
        deletedAt: null,
      })
        .select("_id path")
        .lean();

      if (!parentFolder) {
        return badRequest("Parent folder not found");
      }

      const zipBuffer = Buffer.from(await file.arrayBuffer());
      const prepared = prepareBulkImageRowsFromZipBuffer(zipBuffer);

      preparedRows = Array.isArray(prepared?.preparedRows) ? prepared.preparedRows : [];
      summaryRows = Array.isArray(prepared?.summaryRows) ? prepared.summaryRows : [];

      if (!preparedRows.length) {
        return badRequest("No valid SKU image folders found inside ZIP");
      }

      if (preparedRows.length > 10000) {
        return badRequest("For safety, one image job currently supports max 10000 SKU folders");
      }
    } catch (error: any) {
      return badRequest(safeStr(error?.message || "Invalid bulk images input"));
    }

    const batchSize = clamp(
      Math.trunc(safeNum(formData.get("batchSize") || 100, 100)),
      10,
      500
    );

    const created = await createBulkUploadJob({
      jobType: "product_images",
      createdBy: safeStr(guard.user.email),
      jobLabel: "Bulk Product Images Upload",
      batchSize,
      totalItems: preparedRows.length,
      meta: {
        parentPath: config.parentPath,
        mode: config.mode,
        originalFileName: config.originalFileName,
      },
      config,
      input: {
        skuRows: preparedRows,
        skuSummaryRows: summaryRows,
      },
      summary: {
        totalSkuFolders: preparedRows.length,
        processedSkuFolders: 0,
        updatedSkuFolders: 0,
        skippedSkuFolders: 0,
        failedSkuFolders: 0,
        validSkuFolders: 0,
        parentPath: config.parentPath,
        mode: config.mode,
        originalFileName: config.originalFileName,
      },
      downloadFileName: "bulk-product-images-upload-failures",
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Bulk product images job created successfully.",
        job: toPlainBulkJob(created),
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message || "Failed to create bulk product images job"),
      },
      { status: 500 }
    );
  }
}