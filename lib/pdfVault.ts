import crypto from "crypto";
import path from "path";
import { cookies } from "next/headers";
import {
  PutObjectCommand,
  S3Client,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import AdmZip from "adm-zip";

import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import PdfVaultFolder from "@/models/PdfVaultFolder";
import PdfVaultFile from "@/models/PdfVaultFile";
import { autoResolveWantToBuyForProduct } from "@/lib/wantToBuyAutoResolve";

const REGION = process.env.AWS_REGION || "ap-south-1";
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID || "";
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY || "";
const BUCKET_PRIVATE = process.env.AWS_S3_BUCKET_PRIVATE || "";
const PDF_VAULT_HIDDEN_PATH = process.env.PDF_VAULT_HIDDEN_PATH || "Lalita";
const PDF_VAULT_COOKIE_SECRET =
  process.env.PDF_VAULT_COOKIE_SECRET || process.env.JWT_SECRET || "change-me-fast";
const PDF_VAULT_PUZZLE_COOKIE = "isp_pdf_vault_puzzle";
const PDF_VAULT_ACCESS_COOKIE = "isp_pdf_vault_access";

export const PDF_VAULT_ROUTE_SEGMENT = PDF_VAULT_HIDDEN_PATH;
export const PDF_VAULT_PUZZLE_COOKIE_NAME = PDF_VAULT_PUZZLE_COOKIE;
export const PDF_VAULT_ACCESS_COOKIE_NAME = PDF_VAULT_ACCESS_COOKIE;

export const PDF_VAULT_DIRECT_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

function hmac(input: string) {
  return crypto.createHmac("sha256", PDF_VAULT_COOKIE_SECRET).update(input).digest("hex");
}

export function safeStr(x: any) {
  return String(x ?? "").trim();
}

export function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

export function slugify(input: string) {
  return safeStr(input)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizeSkuLike(input: string) {
  return safeStr(input).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function fileExt(name: string) {
  return (path.extname(name || "") || "").toLowerCase();
}

export function fileBaseName(name: string) {
  return path.basename(name || "", path.extname(name || "")).trim();
}

export function cleanFolderPath(input: string) {
  const p = safeStr(input).replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
  return p;
}

export function buildFolderPath(parentPath: string, name: string) {
  const parent = cleanFolderPath(parentPath);
  const child = slugify(name) || "folder";
  return parent ? `${parent}/${child}` : child;
}

export function puzzleExpectedAnswer(a: number, b: number) {
  return Number(a) + Number(b) + 2;
}

export function createPuzzleChallenge() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  const answer = puzzleExpectedAnswer(a, b);
  const expiresAt = Date.now() + 5 * 60 * 1000;

  const payload = `${a}:${b}:${answer}:${expiresAt}`;
  const sig = hmac(payload);

  return {
    a,
    b,
    expiresAt,
    cookieValue: `${payload}:${sig}`,
  };
}

export function verifyPuzzleCookie(cookieValue: string, userAnswer: number) {
  const raw = safeStr(cookieValue);
  if (!raw) return { ok: false, reason: "Puzzle cookie missing" };

  const parts = raw.split(":");
  if (parts.length !== 5) return { ok: false, reason: "Puzzle cookie invalid" };

  const [a, b, expected, expiresAt, sig] = parts;
  const payload = `${a}:${b}:${expected}:${expiresAt}`;
  const validSig = hmac(payload);

  if (sig !== validSig) return { ok: false, reason: "Puzzle signature invalid" };
  if (Date.now() > Number(expiresAt || 0)) return { ok: false, reason: "Puzzle expired" };
  if (Number(userAnswer) !== Number(expected)) return { ok: false, reason: "Wrong answer" };

  return { ok: true };
}

export function createVaultAccessToken(userId: string, minutes = 15) {
  const safeMinutes = Math.max(1, Math.min(Number(minutes || 15), 180));
  const expiresAt = Date.now() + safeMinutes * 60 * 1000;
  const payload = `${safeStr(userId)}:${expiresAt}`;
  const sig = hmac(payload);
  return `${payload}:${sig}`;
}

export function verifyVaultAccessToken(token: string, userId: string) {
  const raw = safeStr(token);
  if (!raw) return false;

  const parts = raw.split(":");
  if (parts.length !== 3) return false;

  const [tokenUserId, expiresAt, sig] = parts;
  const payload = `${tokenUserId}:${expiresAt}`;
  const validSig = hmac(payload);

  if (sig !== validSig) return false;
  if (tokenUserId !== safeStr(userId)) return false;
  if (Date.now() > Number(expiresAt || 0)) return false;

  return true;
}

export async function grantPdfVaultPageAccess(userId: string, minutes = 15) {
  const token = createVaultAccessToken(userId, minutes);
  const cookieStore = await cookies();

  cookieStore.set(PDF_VAULT_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: Math.max(60, Math.min(Number(minutes || 15), 180) * 60),
  });

  return {
    ok: true,
    token,
    expiresInMinutes: Math.max(1, Math.min(Number(minutes || 15), 180)),
  };
}

export async function revokePdfVaultPageAccess() {
  const cookieStore = await cookies();

  cookieStore.set(PDF_VAULT_ACCESS_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });

  return { ok: true };
}

export async function hasPdfVaultPageAccess(userId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(PDF_VAULT_ACCESS_COOKIE)?.value || "";
  return verifyVaultAccessToken(token, userId);
}

export function buildPdfVaultS3Key(folderPath: string, originalName: string) {
  const ext = fileExt(originalName) || ".pdf";
  const base = slugify(fileBaseName(originalName)) || "file";
  const rand = crypto.randomBytes(8).toString("hex");
  const folder = cleanFolderPath(folderPath);
  return `vault/pdfs/${folder ? `${folder}/` : ""}${base}-${rand}${ext}`;
}

export function assertPdfVaultDirectUploadSize(sizeBytes: number, maxBytes = PDF_VAULT_DIRECT_UPLOAD_MAX_BYTES) {
  const safeSize = Math.max(0, Math.trunc(Number(sizeBytes || 0)));
  if (!safeSize) {
    throw new Error("File size missing");
  }
  if (safeSize > maxBytes) {
    throw new Error(`File exceeds max allowed size of ${maxBytes} bytes`);
  }
  return safeSize;
}

export async function createDirectPdfUploadUrl(args: {
  folderPath: string;
  originalName: string;
  mimeType?: string;
  sizeBytes: number;
  expiresInSeconds?: number;
}) {
  if (!ACCESS_KEY || !SECRET_KEY) {
    throw new Error("AWS credentials missing");
  }
  if (!BUCKET_PRIVATE) {
    throw new Error("AWS_S3_BUCKET_PRIVATE missing");
  }

  const originalName = safeStr(args.originalName);
  if (!originalName) {
    throw new Error("originalName required");
  }

  const ext = fileExt(originalName);
  if (ext !== ".pdf") {
    throw new Error("Only PDF files are supported");
  }

  const sizeBytes = assertPdfVaultDirectUploadSize(args.sizeBytes);
  const folderPath = cleanFolderPath(args.folderPath) || "root";
  const key = buildPdfVaultS3Key(folderPath, originalName);
  const contentType = safeStr(args.mimeType || "application/pdf") || "application/pdf";
  const expiresIn = Math.max(60, Math.min(Number(args.expiresInSeconds || 900), 3600));

  const command = new PutObjectCommand({
    Bucket: BUCKET_PRIVATE,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn });

  return {
    bucket: BUCKET_PRIVATE,
    key,
    uploadUrl,
    contentType,
    sizeBytes,
    expiresIn,
  };
}

export async function ensureRootFolder() {
  await dbConnect();

  const existing: any = await PdfVaultFolder.findOne({
    parentId: null,
    path: "root",
    deletedAt: null,
  });

  if (existing) return existing;

  const created = await PdfVaultFolder.create({
    name: "root",
    slug: "root",
    parentId: null,
    path: "root",
    level: 0,
    sortOrder: 0,
    isLocked: true,
    notes: "System root folder",
    createdBy: "system",
    updatedBy: "system",
    deletedAt: null,
  });

  return created;
}

export async function uploadPdfBufferToS3(args: {
  folderPath: string;
  originalName: string;
  bytes: Buffer;
  mimeType?: string;
}) {
  if (!ACCESS_KEY || !SECRET_KEY) {
    throw new Error("AWS credentials missing");
  }
  if (!BUCKET_PRIVATE) {
    throw new Error("AWS_S3_BUCKET_PRIVATE missing");
  }

  const key = buildPdfVaultS3Key(args.folderPath, args.originalName);

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_PRIVATE,
      Key: key,
      Body: args.bytes,
      ContentType: args.mimeType || "application/pdf",
    })
  );

  return {
    bucket: BUCKET_PRIVATE,
    key,
  };
}

export async function findProductByExactSku(skuNormalized: string) {
  const sku = normalizeSkuLike(skuNormalized);
  if (!sku) return null;

  await dbConnect();

  const product: any = await Product.findOne({
    sku,
    deletedAt: null,
  })
    .select("_id sku slug availability pdfKey isActive pages")
    .lean();

  return product || null;
}

export async function findVaultPdfBySku(skuNormalized: string) {
  const sku = normalizeSkuLike(skuNormalized);
  if (!sku) return null;

  await dbConnect();

  const row: any = await PdfVaultFile.findOne({
    skuNormalized: sku,
    deletedAt: null,
  })
    .select("_id skuNormalized s3Bucket s3Key pageCount productExists productId productSku productSlug")
    .lean();

  return row || null;
}

async function streamToBuffer(body: any): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);

  if (Buffer.isBuffer(body)) return body;

  if (typeof body?.transformToByteArray === "function") {
    const arr = await body.transformToByteArray();
    return Buffer.from(arr);
  }

  if (typeof body?.transformToWebStream === "function") {
    const reader = body.transformToWebStream().getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }

    return Buffer.concat(chunks.map((x) => Buffer.from(x)));
  }

  if (body && Symbol.asyncIterator in Object(body)) {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<any>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  throw new Error("Unsupported S3 body stream");
}

export async function getPdfBufferFromS3(s3Key: string) {
  if (!BUCKET_PRIVATE) throw new Error("AWS_S3_BUCKET_PRIVATE missing");
  if (!safeStr(s3Key)) throw new Error("s3Key missing");

  const out: any = await s3.send(
    new GetObjectCommand({
      Bucket: BUCKET_PRIVATE,
      Key: s3Key,
    })
  );

  return streamToBuffer(out?.Body);
}

export async function getPdfPageCountFromBuffer(pdfBuffer: Buffer) {
  try {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(pdfBuffer);
      const pages = Number(data?.numpages || 0);

      if (Number.isFinite(pages) && pages > 0) {
        return pages;
      }
    } catch (err) {
      console.error("pdf-parse primary detection failed:", err);
    }

    const raw = pdfBuffer.toString("latin1");

    const countMatches = [...raw.matchAll(/\/Count\s+(\d+)/g)];
    const countValues = countMatches
      .map((m) => Number(m[1] || 0))
      .filter((n) => Number.isFinite(n) && n > 0);

    const maxCount = countValues.length ? Math.max(...countValues) : 0;

    const pageTypeMatches = raw.match(/\/Type\s*\/Page\b/g) || [];
    const pageTypeCount = pageTypeMatches.length;

    const detected = Math.max(maxCount, pageTypeCount, 0);

    return detected > 0 ? detected : 0;
  } catch (err) {
    console.error("PDF page count failed completely:", err);
    return 0;
  }
}

export async function detectPdfPagesFromS3Key(s3Key: string) {
  try {
    const pdfBuffer = await getPdfBufferFromS3(safeStr(s3Key));
    return await getPdfPageCountFromBuffer(pdfBuffer);
  } catch (err) {
    console.error("detectPdfPagesFromS3Key failed:", err);
    return 0;
  }
}

export async function syncVaultFilePageCountByS3Key(s3Key: string, pageCountInput?: number) {
  await dbConnect();

  const s3KeySafe = safeStr(s3Key);
  if (!s3KeySafe) return { ok: false, pageCount: 0 };

  let pageCount = Math.max(0, Math.trunc(Number(pageCountInput || 0)));
  if (!pageCount) {
    pageCount = await detectPdfPagesFromS3Key(s3KeySafe);
  }

  await PdfVaultFile.updateOne(
    { s3Key: s3KeySafe, deletedAt: null },
    {
      $set: {
        pageCount,
        updatedAt: new Date(),
      },
    }
  );

  return { ok: true, pageCount };
}

export async function attachVaultPdfToProductBySku(skuNormalized: string, s3Key: string) {
  const sku = normalizeSkuLike(skuNormalized);
  if (!sku) {
    return { matched: false, reason: "No SKU parsed" };
  }

  await dbConnect();

  const product: any = await Product.findOne({
    sku,
    deletedAt: null,
  });

  if (!product) {
    return { matched: false, reason: "Product not found" };
  }

  let detectedPages = 0;

  const vaultFile: any = await PdfVaultFile.findOne({
    skuNormalized: sku,
    deletedAt: null,
  }).select("_id pageCount s3Key");

  if (vaultFile && Number(vaultFile.pageCount || 0) > 0) {
    detectedPages = Math.max(0, Math.trunc(Number(vaultFile.pageCount || 0)));
  } else {
    detectedPages = await detectPdfPagesFromS3Key(safeStr(s3Key));
    if (vaultFile) {
      vaultFile.pageCount = detectedPages;
      await vaultFile.save();
    }
  }

  product.pdfKey = safeStr(s3Key);
  product.pdfUrl = "";
  product.availability = "available";

  if (detectedPages > 0) {
    product.pages = detectedPages;
  }

  product.lastModifiedAt = new Date();

  await product.save();

  await PdfVaultFile.updateOne(
    { skuNormalized: sku, deletedAt: null },
    {
      $set: {
        titleColor: "green",
        productExists: true,
        productId: product._id,
        productSku: safeStr(product.sku),
        productSlug: safeStr(product.slug),
        s3Key: safeStr(s3Key),
        pageCount: detectedPages > 0 ? detectedPages : 0,
        updatedAt: new Date(),
      },
    }
  );

  return {
    matched: true,
    productId: String(product._id),
    productSku: safeStr(product.sku),
    productSlug: safeStr(product.slug),
    detectedPages,
    autoResolvedWantToBuy: await autoResolveWantToBuyForProduct({
      productId: product._id,
      availability: product.availability,
      pdfKey: product.pdfKey,
      isActive: product.isActive,
    }),
  };
}

export async function createPdfVaultFileRecord(args: {
  folderId: string;
  originalName: string;
  s3Bucket: string;
  s3Key: string;
  mimeType?: string;
  sizeBytes?: number;
  sha256?: string;
  uploadedBy?: string;
}) {
  await dbConnect();

  const baseName = fileBaseName(args.originalName);
  const skuNormalized = normalizeSkuLike(baseName);

  const matchedProduct = await findProductByExactSku(skuNormalized);
  const detectedPages = await detectPdfPagesFromS3Key(args.s3Key);

  const created: any = await PdfVaultFile.create({
    folderId: args.folderId,
    originalName: safeStr(args.originalName),
    fileName: safeStr(path.basename(args.originalName)),
    fileExt: fileExt(args.originalName) || ".pdf",
    baseName: safeStr(baseName),
    skuNormalized,
    titleColor: matchedProduct ? "green" : "red",
    productExists: Boolean(matchedProduct),
    productId: matchedProduct?._id || null,
    productSku: safeStr(matchedProduct?.sku),
    productSlug: safeStr(matchedProduct?.slug),
    s3Bucket: safeStr(args.s3Bucket),
    s3Key: safeStr(args.s3Key),
    mimeType: safeStr(args.mimeType || "application/pdf"),
    sizeBytes: Number(args.sizeBytes || 0),
    pageCount: detectedPages > 0 ? detectedPages : 0,
    sha256: safeStr(args.sha256),
    uploadedAt: new Date(),
    uploadedBy: safeStr(args.uploadedBy),
    deletedAt: null,
  });

  let attachResult: any = { matched: false };

  if (matchedProduct && skuNormalized) {
    attachResult = await attachVaultPdfToProductBySku(skuNormalized, args.s3Key);

    if (attachResult?.matched) {
      created.productExists = true;
      created.titleColor = "green";
      created.productId = matchedProduct._id;
      created.productSku = safeStr(matchedProduct.sku);
      created.productSlug = safeStr(matchedProduct.slug);
      created.pageCount = attachResult?.detectedPages || created.pageCount || 0;
      await created.save();
    }
  }

  return {
    file: created,
    productMatched: Boolean(matchedProduct),
    attachResult,
    detectedPages,
  };
}

export async function getPdfVaultDuplicateBySku(skuNormalized: string) {
  await dbConnect();

  const sku = normalizeSkuLike(skuNormalized);
  if (!sku) return null;

  const row: any = await PdfVaultFile.findOne({
    skuNormalized: sku,
    deletedAt: null,
  }).lean();

  return row || null;
}

export async function movePdfVaultFile(args: {
  fileId: string;
  targetFolderId: string;
  movedBy?: string;
}) {
  await dbConnect();

  const file: any = await PdfVaultFile.findById(args.fileId);
  if (!file || file.deletedAt) {
    throw new Error("File not found");
  }

  const folder: any = await PdfVaultFolder.findById(args.targetFolderId);
  if (!folder || folder.deletedAt) {
    throw new Error("Target folder not found");
  }

  file.folderId = folder._id;
  file.movedAt = new Date();
  file.movedBy = safeStr(args.movedBy);

  await file.save();
  return file;
}

export async function getSecurePdfOpenUrl(s3Key: string, expiresInSeconds = 20) {
  if (!BUCKET_PRIVATE) throw new Error("AWS_S3_BUCKET_PRIVATE missing");
  if (!safeStr(s3Key)) throw new Error("s3Key missing");

  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: BUCKET_PRIVATE,
      Key: s3Key,
      ResponseContentType: "application/pdf",
      ResponseContentDisposition: 'inline; filename="document.pdf"',
    }),
    { expiresIn: expiresInSeconds }
  );

  return url;
}

export async function getSecurePdfDownloadUrl(
  s3Key: string,
  downloadName = "document.pdf",
  expiresInSeconds = 60
) {
  if (!BUCKET_PRIVATE) throw new Error("AWS_S3_BUCKET_PRIVATE missing");
  if (!safeStr(s3Key)) throw new Error("s3Key missing");

  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: BUCKET_PRIVATE,
      Key: s3Key,
      ResponseContentType: "application/pdf",
      ResponseContentDisposition: `attachment; filename="${downloadName.replace(/"/g, "")}"`,
    }),
    { expiresIn: expiresInSeconds }
  );

  return url;
}

export async function createFolderZipBufferByPath(folderPathInput: string) {
  await dbConnect();

  const folderPath = cleanFolderPath(folderPathInput) || "root";

  const rootFolder: any = await PdfVaultFolder.findOne({
    path: folderPath,
    deletedAt: null,
  }).lean();

  if (!rootFolder) {
    throw new Error("Folder not found");
  }

  const pathPrefix = `${safeStr(rootFolder.path)}/`;

  const allFolders: any[] = await PdfVaultFolder.find({
    $or: [
      { path: safeStr(rootFolder.path) },
      { path: { $regex: `^${pathPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` } },
    ],
    deletedAt: null,
  })
    .select("_id path name")
    .lean();

  const folderIds = allFolders.map((f) => f._id);

  const files: any[] = await PdfVaultFile.find({
    folderId: { $in: folderIds },
    deletedAt: null,
  })
    .select("folderId fileName s3Key")
    .lean();

  const folderPathMap = new Map<string, string>();
  for (const f of allFolders) {
    folderPathMap.set(String(f._id), safeStr(f.path));
  }

  const zip = new AdmZip();

  for (const file of files) {
    const folderPathOfFile = folderPathMap.get(String(file.folderId)) || safeStr(rootFolder.path);
    let relativeFolder = folderPathOfFile.startsWith(safeStr(rootFolder.path))
      ? folderPathOfFile.slice(safeStr(rootFolder.path).length)
      : "";

    relativeFolder = relativeFolder.replace(/^\/+/, "");
    const zipEntryName = relativeFolder
      ? `${relativeFolder}/${safeStr(file.fileName)}`
      : safeStr(file.fileName);

    const pdfBuffer = await getPdfBufferFromS3(safeStr(file.s3Key));
    zip.addFile(zipEntryName, pdfBuffer);
  }

  return {
    folder: rootFolder,
    filesCount: files.length,
    buffer: zip.toBuffer(),
  };
}