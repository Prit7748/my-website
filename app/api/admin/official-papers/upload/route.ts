import crypto from "crypto";
import { NextResponse } from "next/server";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

import dbConnect from "@/lib/db";
import OfficialPaper from "@/models/OfficialPaper";
import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  uploadPdfBufferToS3,
  findProductByExactSku,
  normalizeSkuLike,
} from "@/lib/pdfVault";
import {
  getDerivedAvailabilitySnapshotBySku,
  syncProductAvailabilityBySku,
} from "@/lib/productAvailability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const REGION = process.env.AWS_REGION || "ap-south-1";
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID || "";
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY || "";
const BUCKET_PRIVATE = process.env.AWS_S3_BUCKET_PRIVATE || "";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const UPLOAD_TIMEOUT_MS = 120000;

// Page detection ko upload blocker nahi banaya gaya hai.
// Agar page detection fail bhi hota hai, PDF upload successful rahegi.
const PAGE_DETECT_TIMEOUT_MS = 15000;

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

type ConflictMode = "ignore" | "replace";

type FileLike = {
  name: string;
  size?: number;
  type?: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

type PdfPageCountFn = (buffer: Buffer) => Promise<number>;

let cachedPdfPageCountFn: PdfPageCountFn | null = null;

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function truncateReason(input: any, max = 300) {
  const text = safeStr(input);
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function cleanBaseFileName(name: string) {
  return safeStr(name).split(/[\\/]/).pop() || "";
}

function fileBaseName(name: string) {
  const base = cleanBaseFileName(name);
  return base.replace(/\.[^.]+$/, "");
}

function isPdfFileName(name: string) {
  return cleanBaseFileName(name).toLowerCase().endsWith(".pdf");
}

function isProbablyPdfBuffer(buf: Buffer) {
  if (!buf || !buf.length) return false;
  const header = buf.subarray(0, Math.min(buf.length, 16)).toString("latin1");
  return header.includes("%PDF");
}

function isFileLike(value: any): value is FileLike {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof value.name === "string" &&
      typeof value.arrayBuffer === "function"
  );
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function normalizeDetectedPageCount(value: any) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

async function getPdfPageCountFn(): Promise<PdfPageCountFn> {
  if (cachedPdfPageCountFn) return cachedPdfPageCountFn;

  try {
    /*
      IMPORTANT FIX:
      Purana code `require("pdf-parse/lib/pdf-parse.js")` use kar raha tha.
      Ye internal package path Vercel/Next build me resolve nahi ho raha tha.
      pdf-parse v2+ ka supported API `PDFParse` class ke through hai.
    */
    const pdfParseModule: any = await import("pdf-parse");

    if (typeof pdfParseModule?.PDFParse === "function") {
      cachedPdfPageCountFn = async (buffer: Buffer) => {
        let parser: any = null;

        try {
          parser = new pdfParseModule.PDFParse({
            data: buffer,
          });

          const info = await parser.getInfo({
            parsePageInfo: false,
          });

          const pages = normalizeDetectedPageCount(
            info?.total || info?.numpages || info?.numPages || info?.pages
          );

          return pages;
        } finally {
          if (parser && typeof parser.destroy === "function") {
            await parser.destroy().catch(() => undefined);
          }
        }
      };

      return cachedPdfPageCountFn;
    }

    /*
      Legacy fallback:
      Agar kisi environment me pdf-parse old function export kare,
      to usko bhi support kar lenge.
    */
    const legacyFn = pdfParseModule?.default || pdfParseModule;

    if (typeof legacyFn === "function") {
      cachedPdfPageCountFn = async (buffer: Buffer) => {
        const data = await legacyFn(buffer);

        return normalizeDetectedPageCount(
          data?.numpages || data?.numPages || data?.pages || data?.total
        );
      };

      return cachedPdfPageCountFn;
    }

    throw new Error("pdf-parse did not export PDFParse class or legacy parser function");
  } catch (error: any) {
    throw new Error(
      `PDF parser load failed: ${truncateReason(
        error?.message || "pdf-parse could not be loaded"
      )}`
    );
  }
}

async function detectPdfPagesFromBuffer(pdfBuffer: Buffer) {
  const getPageCount = await getPdfPageCountFn();
  return await getPageCount(pdfBuffer);
}

async function detectPdfPagesFromBufferSafely(pdfBuffer: Buffer) {
  try {
    const pages = await withTimeout(
      detectPdfPagesFromBuffer(pdfBuffer),
      PAGE_DETECT_TIMEOUT_MS,
      "PDF page detection"
    );

    return {
      pageCount: Math.max(0, Math.trunc(Number(pages || 0))),
      warning: "",
    };
  } catch (error: any) {
    return {
      pageCount: 0,
      warning: truncateReason(error?.message || "PDF page count could not be detected"),
    };
  }
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

function getUserId(user: any) {
  return safeStr(user?.id || user?._id || user?.email || "");
}

async function deleteS3ObjectIfExists(s3Key: string) {
  const key = safeStr(s3Key);
  if (!key || !BUCKET_PRIVATE) return;

  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET_PRIVATE,
      Key: key,
    })
  );
}

async function findActiveOfficialPaperBySku(skuNormalized: string) {
  const sku = safeStr(skuNormalized).toUpperCase();
  if (!sku) return null;

  const row: any = await OfficialPaper.findOne({
    skuNormalized: sku,
    deletedAt: null,
  });

  return row || null;
}

function sha256OfBuffer(buf: Buffer) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function processSinglePdf(args: {
  file: FileLike;
  conflictMode: ConflictMode;
  user: any;
}) {
  const originalName = cleanBaseFileName(args.file.name);
  const fileName = originalName;
  const sizeBytes = safeNum(args.file.size, 0);

  if (!originalName || !fileName) {
    return {
      status: "failed" as const,
      fileName,
      reason: "File name missing",
    };
  }

  if (!isPdfFileName(fileName)) {
    return {
      status: "failed" as const,
      fileName,
      reason: "Only PDF files allowed",
    };
  }

  if (sizeBytes <= 0) {
    return {
      status: "failed" as const,
      fileName,
      reason: "Empty PDF file",
    };
  }

  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      status: "failed" as const,
      fileName,
      reason: `File exceeds 20MB limit. Current size: ${Math.round(
        sizeBytes / (1024 * 1024)
      )}MB`,
    };
  }

  const baseName = fileBaseName(fileName);
  const skuNormalized = safeStr(normalizeSkuLike(baseName)).toUpperCase();

  if (!skuNormalized) {
    return {
      status: "failed" as const,
      fileName,
      reason: "SKU could not be parsed from filename",
    };
  }

  const availabilitySnapshot = await getDerivedAvailabilitySnapshotBySku(
    skuNormalized
  );

  if (availabilitySnapshot?.hasSolvedPdf) {
    return {
      status: "skipped" as const,
      fileName,
      skuNormalized,
      reason: "Solved PDF already exists, official paper upload skipped",
    };
  }

  const existingLive: any = await findActiveOfficialPaperBySku(skuNormalized);

  if (existingLive && args.conflictMode === "ignore") {
    return {
      status: "skipped" as const,
      fileName,
      skuNormalized,
      reason: "Official paper already exists for this SKU",
    };
  }

  const pdfBuffer = Buffer.from(await args.file.arrayBuffer());

  if (!pdfBuffer?.length) {
    return {
      status: "failed" as const,
      fileName,
      skuNormalized,
      reason: "Empty PDF file buffer",
    };
  }

  if (!isProbablyPdfBuffer(pdfBuffer)) {
    return {
      status: "failed" as const,
      fileName,
      skuNormalized,
      reason: "Uploaded file is not a valid PDF binary",
    };
  }

  const pageDetectResult = await detectPdfPagesFromBufferSafely(pdfBuffer);
  const pageCount = Number(pageDetectResult.pageCount || 0);
  const pageWarning = safeStr(pageDetectResult.warning);

  let newS3Key = "";
  let newS3Bucket = "";

  try {
    const uploaded = await withTimeout(
      uploadPdfBufferToS3({
        folderPath: "official-papers",
        originalName,
        bytes: pdfBuffer,
        mimeType: "application/pdf",
      }),
      UPLOAD_TIMEOUT_MS,
      "S3 upload"
    );

    newS3Key = safeStr((uploaded as any)?.key);
    newS3Bucket = safeStr((uploaded as any)?.bucket);

    if (!newS3Key) {
      throw new Error("S3 upload completed but file key was empty");
    }

    const matchedProduct: any = await findProductByExactSku(skuNormalized);
    const now = new Date();
    const userId = getUserId(args.user);
    const sha256 = sha256OfBuffer(pdfBuffer);

    if (existingLive && args.conflictMode === "replace") {
      const oldKey = safeStr(existingLive.s3Key);

      existingLive.productId = matchedProduct?._id || null;
      existingLive.productSku = safeStr(matchedProduct?.sku);
      existingLive.productSlug = safeStr(matchedProduct?.slug);
      existingLive.productExists = Boolean(matchedProduct);
      existingLive.titleColor = matchedProduct ? "green" : "red";

      existingLive.originalName = originalName;
      existingLive.fileName = fileName;
      existingLive.fileExt = ".pdf";
      existingLive.baseName = baseName;

      existingLive.mimeType = "application/pdf";
      existingLive.sizeBytes = pdfBuffer.length;
      existingLive.pageCount = pageCount;
      existingLive.sha256 = sha256;

      existingLive.s3Bucket = newS3Bucket;
      existingLive.s3Key = newS3Key;

      existingLive.uploadedAt = now;
      existingLive.uploadedBy = userId;
      existingLive.updatedBy = userId;
      existingLive.updatedAt = now;
      existingLive.deletedAt = null;

      await existingLive.save();

      if (oldKey && oldKey !== newS3Key) {
        try {
          await deleteS3ObjectIfExists(oldKey);
        } catch {
          // old S3 cleanup failure should not fail the upload
        }
      }

      await syncProductAvailabilityBySku(skuNormalized);

      return {
        status: "replaced" as const,
        fileName,
        skuNormalized,
        fileId: String(existingLive._id),
        reason: pageWarning
          ? `Uploaded successfully, but page count not detected: ${pageWarning}`
          : "",
      };
    }

    const created: any = await OfficialPaper.create({
      skuNormalized,
      productId: matchedProduct?._id || null,
      productSku: safeStr(matchedProduct?.sku),
      productSlug: safeStr(matchedProduct?.slug),
      productExists: Boolean(matchedProduct),
      titleColor: matchedProduct ? "green" : "red",

      originalName,
      fileName,
      fileExt: ".pdf",
      baseName,

      mimeType: "application/pdf",
      sizeBytes: pdfBuffer.length,
      pageCount,
      sha256,

      s3Bucket: newS3Bucket,
      s3Key: newS3Key,

      uploadedAt: now,
      uploadedBy: userId,
      updatedBy: userId,
      updatedAt: now,
      deletedAt: null,
    });

    await syncProductAvailabilityBySku(skuNormalized);

    return {
      status: "uploaded" as const,
      fileName,
      skuNormalized,
      fileId: String(created._id),
      reason: pageWarning
        ? `Uploaded successfully, but page count not detected: ${pageWarning}`
        : "",
    };
  } catch (error) {
    if (newS3Key) {
      try {
        await deleteS3ObjectIfExists(newS3Key);
      } catch {
        // cleanup failure ignored
      }
    }

    throw error;
  }
}

export async function POST(req: Request) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  await dbConnect();

  const contentType = safeStr(req.headers.get("content-type")).toLowerCase();

  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      {
        ok: false,
        error: "Only multipart/form-data is supported",
      },
      { status: 400 }
    );
  }

  try {
    const formData = await req.formData();
    const conflictModeRaw = safeStr(formData.get("conflictMode")).toLowerCase();
    const conflictMode: ConflictMode =
      conflictModeRaw === "replace" ? "replace" : "ignore";

    const rawEntries = [
      ...formData.getAll("files"),
      ...formData.getAll("file"),
      ...formData.getAll("pdfs"),
    ];

    const seen = new Set<any>();
    const files: FileLike[] = [];

    for (const entry of rawEntries) {
      if (!entry || seen.has(entry)) continue;
      seen.add(entry);

      if (isFileLike(entry)) {
        files.push(entry);
      }
    }

    if (!files.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "At least one PDF file is required",
          receivedFields: Array.from(formData.keys()),
        },
        { status: 400 }
      );
    }

    const results: Array<{
      fileName: string;
      skuNormalized?: string;
      fileId?: string;
      status: "uploaded" | "replaced" | "skipped" | "failed";
      reason?: string;
    }> = [];

    let uploadedFiles = 0;
    let replacedFiles = 0;
    let skippedFiles = 0;
    let failedFiles = 0;

    for (const file of files) {
      try {
        const result = await processSinglePdf({
          file,
          conflictMode,
          user: guard.user,
        });

        results.push(result);

        if (result.status === "uploaded") uploadedFiles += 1;
        else if (result.status === "replaced") replacedFiles += 1;
        else if (result.status === "skipped") skippedFiles += 1;
        else failedFiles += 1;
      } catch (error: any) {
        failedFiles += 1;

        results.push({
          fileName: cleanBaseFileName(file.name),
          status: "failed",
          reason: truncateReason(error?.message || "Upload failed"),
        });
      }
    }

    const doneFiles = uploadedFiles + replacedFiles;

    return NextResponse.json(
      {
        ok: true,
        message: `Processed ${files.length} PDFs. Done ${doneFiles}, Skipped ${skippedFiles}, Failed ${failedFiles}.`,
        summary: {
          totalFiles: files.length,
          uploadedFiles,
          replacedFiles,
          doneFiles,
          skippedFiles,
          failedFiles,
          conflictMode,
          mode: "direct_final_upload_page_detection_non_blocking",
        },
        results,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: truncateReason(error?.message || "Failed to upload PDFs"),
      },
      { status: 500 }
    );
  }
}