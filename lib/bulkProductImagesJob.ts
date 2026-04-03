import crypto from "crypto";
import path from "path";
import AdmZip from "adm-zip";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import PdfVaultFolder from "@/models/PdfVaultFolder";
import ProductImageVaultFile from "@/models/ProductImageVaultFile";
import {
  safeStr,
  slugify,
  cleanFolderPath,
  buildFolderPath,
  normalizeSkuLike,
  fileExt,
  fileBaseName,
} from "@/lib/pdfVault";

export type BulkImageUploadMode = "append" | "replace";

export type PreparedBulkImageSkuRow = {
  itemIndex: number;
  sku: string;
  imageNames: string[];
};

export type BulkImageJobConfig = {
  parentPath: string;
  mode: BulkImageUploadMode;
  originalFileName: string;
};

export type BulkImagesBatchProcessResult = {
  processedDelta: number;
  successDelta: number;
  failedDelta: number;
  skippedDelta: number;
  validDelta: number;
  nextLastProcessedIndex: number;
  batchNumber: number;
  fromIndex: number;
  toIndex: number;
  attempted: number;
  failures: Array<{
    itemIndex: number;
    rowNumber: number;
    batchNumber: number;
    identifier?: string;
    sku?: string;
    status?: string;
    reason?: string;
    raw?: any;
  }>;
  summaryPatch: Record<string, any>;
  note: string;
};

type ParsedZipImageRow = {
  originalName: string;
  entryName: string;
  dataBase64: string;
};

type PreparedSkuInputRow = {
  sku: string;
  images: ParsedZipImageRow[];
};

const REGION = process.env.AWS_REGION || "ap-south-1";
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID || "";
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY || "";
const BUCKET_IMAGES =
  process.env.AWS_S3_BUCKET_PUBLIC ||
  process.env.AWS_S3_BUCKET_IMAGES ||
  "";

const PUBLIC_BASE_URL =
  process.env.AWS_PUBLIC_BASE_URL ||
  (BUCKET_IMAGES ? `https://${BUCKET_IMAGES}.s3.${REGION}.amazonaws.com` : "");

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MAX_IMAGES_PER_PRODUCT = 8;
const MAX_ZIP_SIZE = 100 * 1024 * 1024;

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function uniqueStrings(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of arr) {
    const v = safeStr(item);
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }

  return out;
}

function sanitizeErrorMessage(error: any) {
  return safeStr(error?.message || error) || "Unexpected image batch error";
}

function isAllowedImageName(name: string) {
  return ALLOWED_EXT.has(fileExt(name));
}

function mimeFromExt(ext: string) {
  const e = safeStr(ext).toLowerCase();
  if (e === ".jpg" || e === ".jpeg") return "image/jpeg";
  if (e === ".png") return "image/png";
  if (e === ".webp") return "image/webp";
  return "application/octet-stream";
}

function buildImageS3Key(folderPath: string, originalName: string) {
  const ext = fileExt(originalName) || ".jpg";
  const base = slugify(fileBaseName(originalName)) || "image";
  const rand = crypto.randomBytes(8).toString("hex");
  const folder = cleanFolderPath(folderPath);
  return `uploads/products/${folder ? `${folder}/` : ""}${base}-${rand}${ext}`;
}

function normalizeLegacyAvailability(value: string) {
  const av = safeStr(value).toLowerCase();
  if (av === "coming_soon" || av === "comingsoon" || av === "coming-soon") return "on_demand";
  if (av === "out_of_stock" || av === "outofstock" || av === "out-of-stock") return "want_to_buy";
  if (!av || av === "in_stock" || av === "instock") return "available";
  if (av === "available" || av === "on_demand" || av === "want_to_buy") return av;
  return "";
}

function buildFailureRawRow(row: PreparedBulkImageSkuRow) {
  return {
    sku: safeStr(row?.sku),
    image_count: Array.isArray(row?.imageNames) ? row.imageNames.length : 0,
    image_names: Array.isArray(row?.imageNames) ? row.imageNames.join(" | ") : "",
  };
}

async function getFolderByPath(folderPath: string) {
  await dbConnect();
  return PdfVaultFolder.findOne({ path: folderPath, deletedAt: null });
}

async function ensureFolder(parentPath: string, name: string, updatedBy: string) {
  await dbConnect();

  const parent: any = await PdfVaultFolder.findOne({
    path: cleanFolderPath(parentPath),
    deletedAt: null,
  });

  if (!parent) {
    throw new Error("Parent folder not found");
  }

  const nextPath = buildFolderPath(parentPath, name);

  let folder: any = await PdfVaultFolder.findOne({
    path: nextPath,
    deletedAt: null,
  });

  if (folder) return folder;

  folder = await PdfVaultFolder.create({
    name: safeStr(name),
    slug: slugify(name),
    parentId: parent._id,
    path: nextPath,
    level: Number(parent.level || 0) + 1,
    sortOrder: 0,
    isLocked: false,
    notes: "AUTO_IMAGE_PRODUCT_FOLDER",
    createdBy: safeStr(updatedBy),
    updatedBy: safeStr(updatedBy),
    deletedAt: null,
  });

  return folder;
}

async function uploadBufferToS3(buffer: Buffer, key: string, contentType: string) {
  if (!ACCESS_KEY || !SECRET_KEY) {
    throw new Error("AWS credentials missing");
  }

  if (!BUCKET_IMAGES) {
    throw new Error("AWS_S3_BUCKET_PUBLIC or AWS_S3_BUCKET_IMAGES missing for product images");
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_IMAGES,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return {
    bucket: BUCKET_IMAGES,
    key,
    publicUrl: `${PUBLIC_BASE_URL}/${key}`,
  };
}

async function softDeleteFolderImages(folderId: string, productId?: string) {
  await dbConnect();

  const rows: any[] = await ProductImageVaultFile.find({
    folderId,
    deletedAt: null,
  });

  const urlsToRemove = rows.map((x) => safeStr(x.publicUrl)).filter(Boolean);

  if (rows.length) {
    await ProductImageVaultFile.updateMany(
      { folderId, deletedAt: null },
      {
        $set: {
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );
  }

  if (productId && urlsToRemove.length) {
    const product: any = await Product.findById(productId).lean();
    if (product) {
      const nextImages = Array.isArray(product.images)
        ? product.images.filter((x: any) => !urlsToRemove.includes(safeStr(x)))
        : [];

      const updateData: any = {
        images: nextImages,
        lastModifiedAt: new Date(),
      };

      if (urlsToRemove.includes(safeStr(product.thumbnailUrl))) {
        updateData.thumbnailUrl = nextImages[0] || "";
      }

      if (urlsToRemove.includes(safeStr(product.quickUrl))) {
        updateData.quickUrl = nextImages[1] || nextImages[0] || "";
      }

      const normalizedAvailability = normalizeLegacyAvailability(product.availability);
      if (normalizedAvailability) {
        updateData.availability = normalizedAvailability;
      }

      await Product.updateOne({ _id: product._id }, { $set: updateData });
    }
  }
}

async function findExistingLiveImageFolderForProduct(productId: string) {
  await dbConnect();

  const oneLiveFile: any = await ProductImageVaultFile.findOne({
    productId,
    deletedAt: null,
  })
    .select("folderId")
    .lean();

  if (!oneLiveFile?.folderId) return null;

  const folder: any = await PdfVaultFolder.findById(oneLiveFile.folderId)
    .select("_id name path deletedAt")
    .lean();

  if (!folder || folder.deletedAt) return null;

  return folder;
}

export function normalizeBulkImagesConfig(input: any): BulkImageJobConfig {
  return {
    parentPath: cleanFolderPath(input?.parentPath || "img-root") || "img-root",
    mode: safeStr(input?.mode).toLowerCase() === "replace" ? "replace" : "append",
    originalFileName: safeStr(input?.originalFileName || ""),
  };
}

export function validateBulkImagesConfig(config: BulkImageJobConfig) {
  if (!config.parentPath) {
    throw new Error("parentPath required");
  }

  if (config.parentPath === "img-root") {
    throw new Error(
      "Please first open a website-created folder. ZIP upload is not allowed directly in img-root."
    );
  }

  if (!["append", "replace"].includes(config.mode)) {
    throw new Error("Invalid upload mode");
  }
}

export function prepareBulkImageRowsFromZipBuffer(zipBuffer: Buffer) {
  if (!Buffer.isBuffer(zipBuffer) || zipBuffer.length <= 0) {
    throw new Error("ZIP file empty hai");
  }

  if (zipBuffer.length > MAX_ZIP_SIZE) {
    throw new Error("ZIP exceeds 100MB limit");
  }

  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  const skuMap = new Map<string, ParsedZipImageRow[]>();

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const entryName = safeStr(entry.entryName).replace(/\\/g, "/");
    if (!entryName || entryName.startsWith("__MACOSX/")) continue;

    const parts = entryName.split("/").filter(Boolean);
    if (parts.length < 2) continue;

    const skuFolder = normalizeSkuLike(parts[0]);
    const originalName = path.basename(parts[parts.length - 1]);

    if (!skuFolder) continue;
    if (!isAllowedImageName(originalName)) continue;

    if (!skuMap.has(skuFolder)) skuMap.set(skuFolder, []);

    skuMap.get(skuFolder)!.push({
      originalName,
      entryName,
      dataBase64: entry.getData().toString("base64"),
    });
  }

  const preparedRows: PreparedSkuInputRow[] = [];
  const summaryRows: PreparedBulkImageSkuRow[] = [];

  let itemIndex = 0;
  for (const [sku, images] of skuMap.entries()) {
    preparedRows.push({
      sku,
      images,
    });

    summaryRows.push({
      itemIndex,
      sku,
      imageNames: images.map((x) => x.originalName),
    });

    itemIndex += 1;
  }

  return {
    preparedRows,
    summaryRows,
  };
}

export async function processBulkImagesJobBatch(args: {
  job: any;
  batchNumber: number;
  fromIndex: number;
  toIndex: number;
}) {
  await dbConnect();

  const job = args.job;
  const config = normalizeBulkImagesConfig(job?.config || {});
  validateBulkImagesConfig(config);

  const rows: PreparedSkuInputRow[] = Array.isArray(job?.input?.skuRows) ? job.input.skuRows : [];
  const batchRows = rows.slice(args.fromIndex, args.toIndex + 1);
  const currentSummary = job?.summary || {};

  let batchValidRows = 0;
  let batchUpdatedRows = 0;
  let batchSkippedRows = 0;
  let batchFailedRows = 0;

  const failures: BulkImagesBatchProcessResult["failures"] = [];

  for (let idx = 0; idx < batchRows.length; idx++) {
    const row = batchRows[idx];
    const itemIndex = args.fromIndex + idx;
    const rowNumber = itemIndex + 1;
    const sku = normalizeSkuLike(row?.sku);

    const pushFailure = (status: string, reason: string) => {
      failures.push({
        itemIndex,
        rowNumber,
        batchNumber: args.batchNumber,
        identifier: sku || `row-${rowNumber}`,
        sku,
        status,
        reason,
        raw: buildFailureRawRow({
          itemIndex,
          sku,
          imageNames: Array.isArray(row?.images) ? row.images.map((x) => x.originalName) : [],
        }),
      });
    };

    try {
      if (!sku) {
        batchFailedRows++;
        pushFailure("failed", "SKU folder invalid");
        continue;
      }

      const rawImages = Array.isArray(row?.images) ? row.images : [];
      if (!rawImages.length) {
        batchFailedRows++;
        pushFailure("failed", "No valid images found for this SKU folder");
        continue;
      }

      const product: any = await Product.findOne({
        sku,
        deletedAt: null,
      })
        .select("_id sku slug images thumbnailUrl quickUrl availability")
        .lean();

      if (!product) {
        batchFailedRows++;
        pushFailure("failed", "SKU not found");
        continue;
      }

      const targetFolderPath = buildFolderPath(config.parentPath, sku);
      const existingLiveFolder = await findExistingLiveImageFolderForProduct(String(product._id));

      if (existingLiveFolder && safeStr(existingLiveFolder.path) !== safeStr(targetFolderPath)) {
        batchFailedRows++;
        pushFailure(
          "failed",
          `This SKU already exists in another folder: ${safeStr(existingLiveFolder.path)}`
        );
        continue;
      }

      const folder = await ensureFolder(config.parentPath, sku, safeStr(job?.createdBy || "system"));

      const existingActiveCount = await ProductImageVaultFile.countDocuments({
        folderId: folder._id,
        deletedAt: null,
      });

      if (config.mode === "append" && existingActiveCount >= MAX_IMAGES_PER_PRODUCT) {
        batchFailedRows++;
        pushFailure("failed", `Max ${MAX_IMAGES_PER_PRODUCT} images already reached`);
        continue;
      }

      if (config.mode === "replace") {
        await softDeleteFolderImages(String(folder._id), String(product._id));
      }

      const activeCountAfterReplace =
        config.mode === "replace"
          ? 0
          : await ProductImageVaultFile.countDocuments({
              folderId: folder._id,
              deletedAt: null,
            });

      const remainingSlots = Math.max(0, MAX_IMAGES_PER_PRODUCT - activeCountAfterReplace);
      const imagesToUpload = rawImages.slice(0, remainingSlots);
      const skipped = Math.max(0, rawImages.length - imagesToUpload.length);

      if (!imagesToUpload.length) {
        batchFailedRows++;
        pushFailure("failed", `Max ${MAX_IMAGES_PER_PRODUCT} images allowed`);
        continue;
      }

      batchValidRows++;

      const newUrls: string[] = [];

      for (let i = 0; i < imagesToUpload.length; i++) {
        const imageRow = imagesToUpload[i];
        const ext = fileExt(imageRow.originalName) || ".jpg";
        const contentType = mimeFromExt(ext);
        const imageBuffer = Buffer.from(imageRow.dataBase64, "base64");

        const s3Key = buildImageS3Key(folder.path, imageRow.originalName);
        const s3Out = await uploadBufferToS3(imageBuffer, s3Key, contentType);

        const currentCount = activeCountAfterReplace + i;

        await ProductImageVaultFile.create({
          folderId: folder._id,
          originalName: safeStr(imageRow.originalName),
          fileName: safeStr(path.basename(imageRow.originalName)),
          fileExt: ext,
          baseName: safeStr(fileBaseName(imageRow.originalName)),
          skuNormalized: sku,
          productExists: true,
          productId: product._id,
          productSku: safeStr(product.sku),
          productSlug: safeStr(product.slug),
          s3Bucket: s3Out.bucket,
          s3Key: s3Out.key,
          publicUrl: s3Out.publicUrl,
          mimeType: contentType,
          sizeBytes: Number(imageBuffer.length || 0),
          width: 0,
          height: 0,
          isPrimary: currentCount === 0,
          sortOrder: currentCount,
          uploadedAt: new Date(),
          uploadedBy: safeStr(job?.createdBy || "system"),
          deletedAt: null,
        });

        newUrls.push(safeStr(s3Out.publicUrl));
      }

      const activeVaultFiles: any[] = await ProductImageVaultFile.find({
        folderId: folder._id,
        deletedAt: null,
      })
        .sort({ sortOrder: 1, uploadedAt: 1 })
        .lean();

      const activeUrls = activeVaultFiles
        .map((x) => safeStr(x.publicUrl))
        .filter(Boolean)
        .slice(0, MAX_IMAGES_PER_PRODUCT);

      const updateData: any = {
        images: activeUrls,
        quickUrl: activeUrls[1] || activeUrls[0] || "",
        lastModifiedAt: new Date(),
      };

      if (!safeStr(product.thumbnailUrl) && activeUrls.length > 0) {
        updateData.thumbnailUrl = activeUrls[0];
      }

      if (config.mode === "replace") {
        updateData.thumbnailUrl = activeUrls[0] || "";
      }

      const normalizedAvailability = normalizeLegacyAvailability(product.availability);
      if (normalizedAvailability) {
        updateData.availability = normalizedAvailability;
      }

      await Product.updateOne({ _id: product._id }, { $set: updateData });

      await PdfVaultFolder.updateOne(
        { _id: folder._id },
        {
          $set: {
            updatedAt: new Date(),
            updatedBy: safeStr(job?.createdBy || "system"),
            notes: "AUTO_IMAGE_PRODUCT_FOLDER",
          },
        }
      );

      if (skipped > 0) {
        batchSkippedRows += 1;
        pushFailure(
          "skipped",
          `${skipped} image(s) skipped because max ${MAX_IMAGES_PER_PRODUCT} images allowed`
        );
      }

      batchUpdatedRows += 1;
    } catch (error: any) {
      batchFailedRows++;
      pushFailure("failed", sanitizeErrorMessage(error));
      continue;
    }
  }

  const nextSummary = {
    totalSkuFolders: safeNum(currentSummary?.totalSkuFolders, rows.length),
    processedSkuFolders: safeNum(currentSummary?.processedSkuFolders, 0) + batchRows.length,
    updatedSkuFolders: safeNum(currentSummary?.updatedSkuFolders, 0) + batchUpdatedRows,
    skippedSkuFolders: safeNum(currentSummary?.skippedSkuFolders, 0) + batchSkippedRows,
    failedSkuFolders: safeNum(currentSummary?.failedSkuFolders, 0) + batchFailedRows,
    validSkuFolders: safeNum(currentSummary?.validSkuFolders, 0) + batchValidRows,
    parentPath: config.parentPath,
    mode: config.mode,
    originalFileName: config.originalFileName,
  };

  return {
    processedDelta: batchRows.length,
    successDelta: batchUpdatedRows,
    failedDelta: batchFailedRows,
    skippedDelta: batchSkippedRows,
    validDelta: batchValidRows,
    nextLastProcessedIndex: args.toIndex,
    batchNumber: args.batchNumber,
    fromIndex: args.fromIndex,
    toIndex: args.toIndex,
    attempted: batchRows.length,
    failures,
    summaryPatch: nextSummary,
    note: `Batch ${args.batchNumber} processed. Updated ${batchUpdatedRows}, Skipped ${batchSkippedRows}, Failed ${batchFailedRows}.`,
  } as BulkImagesBatchProcessResult;
}