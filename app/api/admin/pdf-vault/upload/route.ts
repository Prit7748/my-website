import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import dbConnect from "@/lib/db";
import PdfVaultFolder from "@/models/PdfVaultFolder";
import PdfVaultFile from "@/models/PdfVaultFile";
import OfficialPaper from "@/models/OfficialPaper";
import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  cleanFolderPath,
  createDirectPdfUploadUrl,
  detectPdfPagesFromS3Key,
  ensureRootFolder,
  fileBaseName,
  fileExt,
  findProductByExactSku,
  getPdfBufferFromS3,
  getPdfPageCountFromBuffer,
  hasPdfVaultPageAccess,
  PDF_VAULT_DIRECT_UPLOAD_MAX_BYTES,
  safeStr,
  uploadPdfBufferToS3,
} from "@/lib/pdfVault";
import { syncProductAvailabilityBySku } from "@/lib/productAvailability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const REGION = process.env.AWS_REGION || "ap-south-1";
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID || "";
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY || "";
const BUCKET_PRIVATE = process.env.AWS_S3_BUCKET_PRIVATE || "";
const DIRECT_UPLOAD_TOKEN_SECRET =
  process.env.PDF_VAULT_UPLOAD_TOKEN_SECRET ||
  process.env.PDF_VAULT_COOKIE_SECRET ||
  process.env.JWT_SECRET ||
  "change-me-fast";

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

type ConflictMode = "ignore" | "replace";
type PdfBinary = Uint8Array;

type DirectUploadTokenPayload = {
  folderPath: string;
  originalName: string;
  sizeBytes: number;
  s3Key: string;
  skuNormalized: string;
  conflictMode: ConflictMode;
  expiresAt: number;
};

type FinalizeSuccessResult = {
  kind: "success";
  savedFile: any;
  actionStatus: "uploaded" | "replaced";
  pageCount: number;
  officialPaperDeleted: boolean;
  availabilityAfter: string;
  warnings: string[];
};

type FinalizeSkippedResult = {
  kind: "skipped";
  existingLive: any;
  warnings: string[];
};

type FinalizeResult = FinalizeSuccessResult | FinalizeSkippedResult;

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSkuLike(input: string) {
  return safeStr(input).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function cleanBaseFileName(name: string) {
  return safeStr(name).split(/[\\/]/).pop() || "";
}

function isPdfFileName(name: string) {
  return cleanBaseFileName(name).toLowerCase().endsWith(".pdf");
}

function toPdfBinary(input: ArrayBufferLike | Uint8Array) {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

function isProbablyPdfBuffer(buf: PdfBinary | null | undefined) {
  if (!buf || !buf.length) return false;
  const header = Buffer.from(buf.subarray(0, Math.min(buf.length, 16))).toString("latin1");
  return header.includes("%PDF");
}

function getUserId(user: any) {
  return safeStr(user?.id || user?._id || user?.email || "");
}

function getConflictMode(input: any): ConflictMode {
  return safeStr(input).toLowerCase() === "replace" ? "replace" : "ignore";
}

function signDirectUploadPayload(encodedPayload: string) {
  return crypto
    .createHmac("sha256", DIRECT_UPLOAD_TOKEN_SECRET)
    .update(encodedPayload)
    .digest("hex");
}

function createDirectUploadToken(payload: DirectUploadTokenPayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = signDirectUploadPayload(encodedPayload);
  return `${encodedPayload}.${sig}`;
}

function verifyDirectUploadToken(token: string) {
  const raw = safeStr(token);
  if (!raw) return { ok: false as const, reason: "Upload token missing" };

  const dotIndex = raw.lastIndexOf(".");
  if (dotIndex <= 0) {
    return { ok: false as const, reason: "Upload token invalid" };
  }

  const encodedPayload = raw.slice(0, dotIndex);
  const sig = raw.slice(dotIndex + 1);
  const validSig = signDirectUploadPayload(encodedPayload);

  if (sig !== validSig) {
    return { ok: false as const, reason: "Upload token signature invalid" };
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as DirectUploadTokenPayload;

    if (!payload || typeof payload !== "object") {
      return { ok: false as const, reason: "Upload token payload missing" };
    }

    if (Date.now() > Number(payload.expiresAt || 0)) {
      return { ok: false as const, reason: "Upload token expired" };
    }

    return { ok: true as const, payload };
  } catch {
    return { ok: false as const, reason: "Upload token payload invalid" };
  }
}

async function assertVaultWriteAccess() {
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

  const allowed = await hasPdfVaultPageAccess(user.id);
  if (!allowed) {
    return {
      ok: false as const,
      res: NextResponse.json(
        { ok: false, error: "Vault access expired", needsPuzzle: true },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, user };
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

async function headS3Object(s3Key: string) {
  const key = safeStr(s3Key);
  if (!key || !BUCKET_PRIVATE) {
    throw new Error("S3 object lookup failed");
  }

  return s3.send(
    new HeadObjectCommand({
      Bucket: BUCKET_PRIVATE,
      Key: key,
    })
  );
}

async function removeActiveOfficialPaperForSku(skuNormalized: string) {
  const sku = normalizeSkuLike(skuNormalized);
  if (!sku) {
    return { deleted: false, fileId: "", s3Key: "" };
  }

  const official: any = await OfficialPaper.findOne({
    skuNormalized: sku,
    deletedAt: null,
  });

  if (!official) {
    return { deleted: false, fileId: "", s3Key: "" };
  }

  const fileId = String(official._id);
  const s3Key = safeStr(official.s3Key);

  await OfficialPaper.deleteOne({ _id: official._id });

  try {
    if (s3Key) {
      await deleteS3ObjectIfExists(s3Key);
    }
  } catch {
    // ignore official cleanup failure
  }

  return {
    deleted: true,
    fileId,
    s3Key,
  };
}

async function detectPageCountStrong(pdfBuffer: PdfBinary, s3Key: string) {
  let pageCount = 0;

  try {
    pageCount = Math.max(
      0,
      Math.trunc(Number((await getPdfPageCountFromBuffer(Buffer.from(pdfBuffer))) || 0))
    );
  } catch {
    pageCount = 0;
  }

  if (pageCount > 0) {
    return pageCount;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      pageCount = Math.max(
        0,
        Math.trunc(Number((await detectPdfPagesFromS3Key(safeStr(s3Key))) || 0))
      );
    } catch {
      pageCount = 0;
    }

    if (pageCount > 0) {
      return pageCount;
    }

    if (attempt < 2) {
      await sleep(250 * (attempt + 1));
    }
  }

  return 0;
}

async function analyzeS3UploadedPdf(s3Key: string) {
  let lastBuffer: PdfBinary = new Uint8Array(0);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const pdfBuffer = toPdfBinary(await getPdfBufferFromS3(safeStr(s3Key)));
      lastBuffer = pdfBuffer;

      if (!pdfBuffer?.length) {
        throw new Error("Uploaded S3 object is empty");
      }

      if (!isProbablyPdfBuffer(pdfBuffer)) {
        throw new Error("Uploaded object is not a valid PDF binary");
      }

      const pageCount = await detectPageCountStrong(pdfBuffer, s3Key);
      const sha256 = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

      return {
        pdfBuffer,
        pageCount,
        sha256,
      };
    } catch (error: any) {
      if (attempt >= 2) {
        const reason = safeStr(
          error?.message ||
            (lastBuffer?.length
              ? "Uploaded object is not a valid PDF binary"
              : "Failed to read uploaded PDF from S3")
        );

        throw new Error(reason || "Failed to validate uploaded PDF");
      }

      await sleep(300 * (attempt + 1));
    }
  }

  throw new Error("Failed to validate uploaded PDF");
}

async function findExistingLiveSolvedPdfBySku(skuNormalized: string) {
  const sku = normalizeSkuLike(skuNormalized);
  if (!sku) return null;

  const row: any = await PdfVaultFile.findOne({
    skuNormalized: sku,
    deletedAt: null,
  });

  return row || null;
}

async function finalizeSolvedPdfRecord(args: {
  targetFolder: any;
  originalName: string;
  baseName: string;
  skuNormalized: string;
  sizeBytes: number;
  s3Bucket: string;
  s3Key: string;
  sha256: string;
  conflictMode: ConflictMode;
  user: any;
  pageCount: number;
}): Promise<FinalizeResult> {
  const warnings: string[] = [];
  const userId = getUserId(args.user);
  const now = new Date();
  const matchedProduct: any = await findProductByExactSku(args.skuNormalized);

  let existingLive: any = await findExistingLiveSolvedPdfBySku(args.skuNormalized);

  if (existingLive && args.conflictMode === "ignore") {
    return {
      kind: "skipped",
      existingLive,
      warnings,
    };
  }

  let savedFile: any = null;
  let actionStatus: "uploaded" | "replaced" = "uploaded";
  let oldS3Key = "";

  if (existingLive && args.conflictMode === "replace") {
    oldS3Key = safeStr(existingLive.s3Key);

    existingLive.folderId = args.targetFolder._id;
    existingLive.originalName = args.originalName;
    existingLive.fileName = args.originalName;
    existingLive.fileExt = fileExt(args.originalName) || ".pdf";
    existingLive.baseName = args.baseName;
    existingLive.skuNormalized = args.skuNormalized;

    existingLive.titleColor = matchedProduct ? "green" : "red";
    existingLive.productExists = Boolean(matchedProduct);
    existingLive.productId = matchedProduct?._id || null;
    existingLive.productSku = safeStr(matchedProduct?.sku);
    existingLive.productSlug = safeStr(matchedProduct?.slug);

    existingLive.s3Bucket = args.s3Bucket;
    existingLive.s3Key = args.s3Key;
    existingLive.mimeType = "application/pdf";
    existingLive.sizeBytes = args.sizeBytes;
    existingLive.pageCount = Math.max(0, Math.trunc(Number(args.pageCount || 0)));
    existingLive.sha256 = safeStr(args.sha256);

    existingLive.uploadedAt = now;
    existingLive.uploadedBy = userId;
    existingLive.updatedAt = now;
    existingLive.updatedBy = userId;
    existingLive.deletedAt = null;

    await existingLive.save();
    savedFile = existingLive;
    actionStatus = "replaced";
  } else {
    try {
      savedFile = await PdfVaultFile.create({
        folderId: args.targetFolder._id,
        originalName: args.originalName,
        fileName: args.originalName,
        fileExt: fileExt(args.originalName) || ".pdf",
        baseName: args.baseName,
        skuNormalized: args.skuNormalized,

        titleColor: matchedProduct ? "green" : "red",
        productExists: Boolean(matchedProduct),
        productId: matchedProduct?._id || null,
        productSku: safeStr(matchedProduct?.sku),
        productSlug: safeStr(matchedProduct?.slug),

        s3Bucket: args.s3Bucket,
        s3Key: args.s3Key,
        mimeType: "application/pdf",
        sizeBytes: args.sizeBytes,
        pageCount: Math.max(0, Math.trunc(Number(args.pageCount || 0))),
        sha256: safeStr(args.sha256),

        uploadedAt: now,
        uploadedBy: userId,
        updatedBy: userId,
        deletedAt: null,
      });

      actionStatus = "uploaded";
    } catch (error: any) {
      if (Number(error?.code || 0) !== 11000) {
        throw error;
      }

      existingLive = await findExistingLiveSolvedPdfBySku(args.skuNormalized);

      if (!existingLive) {
        throw error;
      }

      if (args.conflictMode === "ignore") {
        return {
          kind: "skipped",
          existingLive,
          warnings,
        };
      }

      oldS3Key = safeStr(existingLive.s3Key);

      existingLive.folderId = args.targetFolder._id;
      existingLive.originalName = args.originalName;
      existingLive.fileName = args.originalName;
      existingLive.fileExt = fileExt(args.originalName) || ".pdf";
      existingLive.baseName = args.baseName;
      existingLive.skuNormalized = args.skuNormalized;

      existingLive.titleColor = matchedProduct ? "green" : "red";
      existingLive.productExists = Boolean(matchedProduct);
      existingLive.productId = matchedProduct?._id || null;
      existingLive.productSku = safeStr(matchedProduct?.sku);
      existingLive.productSlug = safeStr(matchedProduct?.slug);

      existingLive.s3Bucket = args.s3Bucket;
      existingLive.s3Key = args.s3Key;
      existingLive.mimeType = "application/pdf";
      existingLive.sizeBytes = args.sizeBytes;
      existingLive.pageCount = Math.max(0, Math.trunc(Number(args.pageCount || 0)));
      existingLive.sha256 = safeStr(args.sha256);

      existingLive.uploadedAt = now;
      existingLive.uploadedBy = userId;
      existingLive.updatedAt = now;
      existingLive.updatedBy = userId;
      existingLive.deletedAt = null;

      await existingLive.save();
      savedFile = existingLive;
      actionStatus = "replaced";
    }
  }

  if (oldS3Key && oldS3Key !== args.s3Key) {
    try {
      await deleteS3ObjectIfExists(oldS3Key);
    } catch {
      warnings.push("Old replaced S3 object cleanup failed");
    }
  }

  let officialPaperDeleted = false;
  try {
    const officialPaperCleanup = await removeActiveOfficialPaperForSku(args.skuNormalized);
    officialPaperDeleted = Boolean(officialPaperCleanup.deleted);
  } catch {
    warnings.push("Official paper cleanup failed");
  }

  let availabilityAfter = "";
  try {
    const syncResult: any = await syncProductAvailabilityBySku(
      safeStr(matchedProduct?.sku || args.skuNormalized)
    );
    availabilityAfter = safeStr(syncResult?.after?.availability || "");
  } catch {
    warnings.push("Product availability sync failed");
  }

  return {
    kind: "success",
    savedFile,
    actionStatus,
    pageCount: Math.max(0, Math.trunc(Number(savedFile?.pageCount || args.pageCount || 0))),
    officialPaperDeleted,
    availabilityAfter,
    warnings,
  };
}

async function handlePrepareDirectUpload(req: NextRequest, user: any) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  await dbConnect();
  await ensureRootFolder();

  const originalName = cleanBaseFileName(body?.fileName || body?.originalName);
  const parentPath = cleanFolderPath(safeStr(body?.parentPath || "root")) || "root";
  const conflictMode = getConflictMode(body?.conflictMode);
  const sizeBytes = Math.max(0, Math.trunc(Number(body?.sizeBytes || 0)));

  if (!originalName) {
    return NextResponse.json(
      { ok: false, error: "File name missing" },
      { status: 400 }
    );
  }

  if (!isPdfFileName(originalName)) {
    return NextResponse.json(
      { ok: false, error: "Only PDF files allowed" },
      { status: 400 }
    );
  }

  if (!sizeBytes) {
    return NextResponse.json(
      { ok: false, error: "File size missing" },
      { status: 400 }
    );
  }

  if (sizeBytes > PDF_VAULT_DIRECT_UPLOAD_MAX_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: `File exceeds max allowed size of ${PDF_VAULT_DIRECT_UPLOAD_MAX_BYTES} bytes`,
        maxFileBytes: PDF_VAULT_DIRECT_UPLOAD_MAX_BYTES,
      },
      { status: 400 }
    );
  }

  const targetFolder: any = await PdfVaultFolder.findOne({
    path: parentPath,
    deletedAt: null,
  })
    .select("_id path name")
    .lean();

  if (!targetFolder) {
    return NextResponse.json(
      { ok: false, error: "Target folder not found" },
      { status: 404 }
    );
  }

  const baseName = safeStr(fileBaseName(originalName));
  const skuNormalized = normalizeSkuLike(baseName);

  if (!skuNormalized) {
    return NextResponse.json(
      { ok: false, error: "SKU could not be parsed from filename" },
      { status: 400 }
    );
  }

  const existingLive: any = await findExistingLiveSolvedPdfBySku(skuNormalized);

  if (existingLive && conflictMode === "ignore") {
    return NextResponse.json(
      {
        ok: true,
        action: "prepare",
        status: "skipped",
        message: "Solved PDF already exists for this SKU",
        fileName: originalName,
        skuNormalized,
        fileId: String(existingLive._id),
        counts: {
          total: 1,
          uploaded: 0,
          replaced: 0,
          skipped: 1,
          failed: 0,
          done: 1,
        },
      },
      { status: 200 }
    );
  }

  const prepared = await createDirectPdfUploadUrl({
    folderPath: parentPath,
    originalName,
    mimeType: "application/pdf",
    sizeBytes,
    expiresInSeconds: 900,
  });

  const tokenPayload: DirectUploadTokenPayload = {
    folderPath: parentPath,
    originalName,
    sizeBytes,
    s3Key: safeStr(prepared.key),
    skuNormalized,
    conflictMode,
    expiresAt: Date.now() + 15 * 60 * 1000,
  };

  const uploadToken = createDirectUploadToken(tokenPayload);

  return NextResponse.json(
    {
      ok: true,
      action: "prepare",
      status: "ready",
      fileName: originalName,
      skuNormalized,
      conflictMode,
      maxFileBytes: PDF_VAULT_DIRECT_UPLOAD_MAX_BYTES,
      bucket: safeStr(prepared.bucket),
      s3Key: safeStr(prepared.key),
      uploadUrl: safeStr(prepared.uploadUrl),
      contentType: safeStr(prepared.contentType || "application/pdf"),
      expiresInSeconds: Number(prepared.expiresIn || 900),
      uploadToken,
    },
    { status: 200 }
  );
}

async function handleFinalizeDirectUpload(req: NextRequest, user: any) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  await dbConnect();
  await ensureRootFolder();

  const originalName = cleanBaseFileName(body?.fileName || body?.originalName);
  const parentPath = cleanFolderPath(safeStr(body?.parentPath || "root")) || "root";
  const conflictMode = getConflictMode(body?.conflictMode);
  const uploadToken = safeStr(body?.uploadToken);
  const s3Key = safeStr(body?.s3Key);

  if (!originalName) {
    return NextResponse.json(
      { ok: false, error: "File name missing" },
      { status: 400 }
    );
  }

  if (!isPdfFileName(originalName)) {
    return NextResponse.json(
      { ok: false, error: "Only PDF files allowed" },
      { status: 400 }
    );
  }

  if (!s3Key) {
    return NextResponse.json(
      { ok: false, error: "s3Key required" },
      { status: 400 }
    );
  }

  const verifiedToken = verifyDirectUploadToken(uploadToken);
  if (!verifiedToken.ok) {
    return NextResponse.json(
      { ok: false, error: verifiedToken.reason },
      { status: 400 }
    );
  }

  const payload = verifiedToken.payload;

  if (
    safeStr(payload.folderPath) !== parentPath ||
    safeStr(payload.originalName) !== originalName ||
    safeStr(payload.s3Key) !== s3Key ||
    normalizeSkuLike(payload.skuNormalized) !== normalizeSkuLike(fileBaseName(originalName)) ||
    getConflictMode(payload.conflictMode) !== conflictMode
  ) {
    return NextResponse.json(
      { ok: false, error: "Upload token does not match finalize request" },
      { status: 400 }
    );
  }

  const targetFolder: any = await PdfVaultFolder.findOne({
    path: parentPath,
    deletedAt: null,
  })
    .select("_id path name")
    .lean();

  if (!targetFolder) {
    return NextResponse.json(
      { ok: false, error: "Target folder not found" },
      { status: 404 }
    );
  }

  let s3Head: any = null;
  try {
    s3Head = await headS3Object(s3Key);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Uploaded S3 object not found" },
      { status: 400 }
    );
  }

  const contentLength = Math.max(
    0,
    Math.trunc(Number(s3Head?.ContentLength || 0))
  );

  if (!contentLength) {
    try {
      await deleteS3ObjectIfExists(s3Key);
    } catch {
      // ignore cleanup failure
    }

    return NextResponse.json(
      { ok: false, error: "Uploaded S3 object is empty" },
      { status: 400 }
    );
  }

  if (contentLength !== Math.max(0, Math.trunc(Number(payload.sizeBytes || 0)))) {
    try {
      await deleteS3ObjectIfExists(s3Key);
    } catch {
      // ignore cleanup failure
    }

    return NextResponse.json(
      { ok: false, error: "Uploaded S3 object size mismatch" },
      { status: 400 }
    );
  }

  const baseName = safeStr(fileBaseName(originalName));
  const skuNormalized = normalizeSkuLike(baseName);

  if (!skuNormalized) {
    try {
      await deleteS3ObjectIfExists(s3Key);
    } catch {
      // ignore cleanup failure
    }

    return NextResponse.json(
      { ok: false, error: "SKU could not be parsed from filename" },
      { status: 400 }
    );
  }

  const existingLiveBeforeFinalize: any = await findExistingLiveSolvedPdfBySku(skuNormalized);

  if (existingLiveBeforeFinalize && conflictMode === "ignore") {
    try {
      await deleteS3ObjectIfExists(s3Key);
    } catch {
      // ignore cleanup failure
    }

    return NextResponse.json(
      {
        ok: true,
        action: "finalize",
        status: "skipped",
        message: "Solved PDF already exists for this SKU",
        fileName: originalName,
        skuNormalized,
        fileId: String(existingLiveBeforeFinalize._id),
        counts: {
          total: 1,
          uploaded: 0,
          replaced: 0,
          skipped: 1,
          failed: 0,
          done: 1,
        },
      },
      { status: 200 }
    );
  }

  let analyzed: { pdfBuffer: PdfBinary; pageCount: number; sha256: string } | null = null;

  try {
    analyzed = await analyzeS3UploadedPdf(s3Key);
  } catch (error: any) {
    try {
      await deleteS3ObjectIfExists(s3Key);
    } catch {
      // ignore cleanup failure
    }

    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message || "Failed to validate uploaded PDF"),
      },
      { status: 400 }
    );
  }

  let finalized: FinalizeResult;
  try {
    finalized = await finalizeSolvedPdfRecord({
      targetFolder,
      originalName,
      baseName,
      skuNormalized,
      sizeBytes: contentLength,
      s3Bucket: BUCKET_PRIVATE,
      s3Key,
      sha256: safeStr(analyzed.sha256),
      conflictMode,
      user,
      pageCount: Math.max(0, Math.trunc(Number(analyzed.pageCount || 0))),
    });
  } catch (error: any) {
    try {
      await deleteS3ObjectIfExists(s3Key);
    } catch {
      // ignore cleanup failure
    }

    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message || "Failed to finalize solved PDF upload"),
      },
      { status: 500 }
    );
  }

  if (finalized.kind === "skipped") {
    try {
      await deleteS3ObjectIfExists(s3Key);
    } catch {
      // ignore cleanup failure
    }

    return NextResponse.json(
      {
        ok: true,
        action: "finalize",
        status: "skipped",
        message: "Solved PDF already exists for this SKU",
        fileName: originalName,
        skuNormalized,
        fileId: String(finalized.existingLive._id),
        warnings: finalized.warnings,
        counts: {
          total: 1,
          uploaded: 0,
          replaced: 0,
          skipped: 1,
          failed: 0,
          done: 1,
        },
      },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      action: "finalize",
      status: finalized.actionStatus,
      message:
        finalized.actionStatus === "replaced"
          ? "Solved PDF replaced successfully"
          : "Solved PDF uploaded successfully",
      fileName: originalName,
      skuNormalized,
      fileId: String(finalized.savedFile._id),
      pageCount: Math.max(0, Math.trunc(Number(finalized.pageCount || 0))),
      officialPaperDeleted: Boolean(finalized.officialPaperDeleted),
      availabilityAfter: safeStr(finalized.availabilityAfter || ""),
      warnings: finalized.warnings,
      counts: {
        total: 1,
        uploaded: finalized.actionStatus === "uploaded" ? 1 : 0,
        replaced: finalized.actionStatus === "replaced" ? 1 : 0,
        skipped: 0,
        failed: 0,
        done: 1,
      },
    },
    { status: 200 }
  );
}

async function handleLegacyMultipartUpload(req: NextRequest, user: any) {
  await dbConnect();
  await ensureRootFolder();

  const formData = await req.formData();

  const fileEntry =
    formData.get("file") ||
    formData.get("pdf") ||
    formData.getAll("files")[0] ||
    null;

  if (!(fileEntry instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "PDF file required" },
      { status: 400 }
    );
  }

  const conflictMode = getConflictMode(formData.get("conflictMode"));
  const parentPathInput = safeStr(formData.get("parentPath") || "root");
  const parentPath = cleanFolderPath(parentPathInput) || "root";

  const targetFolder: any = await PdfVaultFolder.findOne({
    path: parentPath,
    deletedAt: null,
  })
    .select("_id path name")
    .lean();

  if (!targetFolder) {
    return NextResponse.json(
      { ok: false, error: "Target folder not found" },
      { status: 404 }
    );
  }

  const originalName = cleanBaseFileName(fileEntry.name);
  if (!originalName) {
    return NextResponse.json(
      { ok: false, error: "File name missing" },
      { status: 400 }
    );
  }

  if (!isPdfFileName(originalName)) {
    return NextResponse.json(
      { ok: false, error: "Only PDF files allowed" },
      { status: 400 }
    );
  }

  const sizeBytes = Math.max(0, Math.trunc(Number(fileEntry.size || 0)));
  if (!sizeBytes) {
    return NextResponse.json(
      { ok: false, error: "Empty PDF file" },
      { status: 400 }
    );
  }

  if (sizeBytes > PDF_VAULT_DIRECT_UPLOAD_MAX_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: `File exceeds max allowed size of ${PDF_VAULT_DIRECT_UPLOAD_MAX_BYTES} bytes`,
        maxFileBytes: PDF_VAULT_DIRECT_UPLOAD_MAX_BYTES,
      },
      { status: 400 }
    );
  }

  const baseName = safeStr(fileBaseName(originalName));
  const skuNormalized = normalizeSkuLike(baseName);

  if (!skuNormalized) {
    return NextResponse.json(
      { ok: false, error: "SKU could not be parsed from filename" },
      { status: 400 }
    );
  }

  const existingLive: any = await findExistingLiveSolvedPdfBySku(skuNormalized);

  if (existingLive && conflictMode === "ignore") {
    return NextResponse.json(
      {
        ok: true,
        status: "skipped",
        message: "Solved PDF already exists for this SKU",
        fileName: originalName,
        skuNormalized,
        fileId: String(existingLive._id),
        counts: {
          total: 1,
          uploaded: 0,
          replaced: 0,
          skipped: 1,
          failed: 0,
          done: 1,
        },
      },
      { status: 200 }
    );
  }

  const pdfBuffer = toPdfBinary(await fileEntry.arrayBuffer());

  if (!pdfBuffer?.length) {
    return NextResponse.json(
      { ok: false, error: "Empty PDF buffer" },
      { status: 400 }
    );
  }

  if (!isProbablyPdfBuffer(pdfBuffer)) {
    return NextResponse.json(
      { ok: false, error: "Uploaded file is not a valid PDF binary" },
      { status: 400 }
    );
  }

  const sha256 = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

  const uploaded = await uploadPdfBufferToS3({
    folderPath: parentPath,
    originalName,
    bytes: Buffer.from(pdfBuffer),
    mimeType: "application/pdf",
  });

  const newBucket = safeStr(uploaded.bucket);
  const newKey = safeStr(uploaded.key);

  if (!newKey) {
    return NextResponse.json(
      { ok: false, error: "S3 upload failed: key missing" },
      { status: 500 }
    );
  }

  try {
    const pageCount = await detectPageCountStrong(pdfBuffer, newKey);

    const finalized = await finalizeSolvedPdfRecord({
      targetFolder,
      originalName,
      baseName,
      skuNormalized,
      sizeBytes,
      s3Bucket: newBucket,
      s3Key: newKey,
      sha256,
      conflictMode,
      user,
      pageCount,
    });

    if (finalized.kind === "skipped") {
      try {
        await deleteS3ObjectIfExists(newKey);
      } catch {
        // ignore cleanup failure
      }

      return NextResponse.json(
        {
          ok: true,
          status: "skipped",
          message: "Solved PDF already exists for this SKU",
          fileName: originalName,
          skuNormalized,
          fileId: String(finalized.existingLive._id),
          warnings: finalized.warnings,
          counts: {
            total: 1,
            uploaded: 0,
            replaced: 0,
            skipped: 1,
            failed: 0,
            done: 1,
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        status: finalized.actionStatus,
        message:
          finalized.actionStatus === "replaced"
            ? "Solved PDF replaced successfully"
            : "Solved PDF uploaded successfully",
        fileName: originalName,
        skuNormalized,
        fileId: String(finalized.savedFile._id),
        pageCount: Math.max(0, Math.trunc(Number(finalized.pageCount || 0))),
        officialPaperDeleted: Boolean(finalized.officialPaperDeleted),
        availabilityAfter: safeStr(finalized.availabilityAfter || ""),
        warnings: finalized.warnings,
        counts: {
          total: 1,
          uploaded: finalized.actionStatus === "uploaded" ? 1 : 0,
          replaced: finalized.actionStatus === "replaced" ? 1 : 0,
          skipped: 0,
          failed: 0,
          done: 1,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    try {
      await deleteS3ObjectIfExists(newKey);
    } catch {
      // ignore cleanup failure
    }

    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message || "Failed to finalize solved PDF upload"),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const guard = await assertVaultWriteAccess();
  if (!guard.ok) return guard.res;

  const contentType = safeStr(req.headers.get("content-type")).toLowerCase();

  try {
    if (contentType.includes("multipart/form-data")) {
      return await handleLegacyMultipartUpload(req, guard.user);
    }

    const clonedReq = req.clone();
    let body: any = {};
    try {
      body = await clonedReq.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Unsupported request body" },
        { status: 400 }
      );
    }

    const action = safeStr(body?.action).toLowerCase();

    if (action === "prepare") {
      return await handlePrepareDirectUpload(req, guard.user);
    }

    if (action === "finalize") {
      return await handleFinalizeDirectUpload(req, guard.user);
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported action" },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message || "Failed to upload solved PDF"),
      },
      { status: 500 }
    );
  }
}