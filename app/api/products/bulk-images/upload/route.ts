import crypto from "crypto";
import path from "path";
import { NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import AdmZip from "adm-zip";

import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import PdfVaultFolder from "@/models/PdfVaultFolder";
import ProductImageVaultFile from "@/models/ProductImageVaultFile";
import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  safeStr,
  slugify,
  cleanFolderPath,
  buildFolderPath,
  normalizeSkuLike,
  fileExt,
  fileBaseName,
} from "@/lib/pdfVault";

export const runtime = "nodejs";

const REGION = process.env.AWS_REGION || "ap-south-1";
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID || "";
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY || "";

// ✅ product images public hi rahengi
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

type ZipImageRow = {
  entry: any;
  originalName: string;
};

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

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mode = safeStr(formData.get("mode") || "append").toLowerCase() === "replace" ? "replace" : "append";
    const parentPath = cleanFolderPath(formData.get("parentPath") as string) || "img-root";

    if (!file) {
      return NextResponse.json({ ok: false, error: "ZIP file required" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".zip")) {
      return NextResponse.json({ ok: false, error: "Only ZIP allowed" }, { status: 400 });
    }

    if (file.size > MAX_ZIP_SIZE) {
      return NextResponse.json({ ok: false, error: "ZIP exceeds 100MB limit" }, { status: 400 });
    }

    const parentFolder = await getFolderByPath(parentPath);
    if (!parentFolder) {
      return NextResponse.json({ ok: false, error: "Parent folder not found" }, { status: 404 });
    }

    if (safeStr(parentFolder.path) === "img-root") {
      return NextResponse.json(
        {
          ok: false,
          error: "Please first open a website-created folder. ZIP upload is not allowed directly in img-root.",
        },
        { status: 400 }
      );
    }

    const zipBuffer = Buffer.from(await file.arrayBuffer());
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    const skuMap = new Map<string, ZipImageRow[]>();

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
      skuMap.get(skuFolder)!.push({ entry, originalName });
    }

    const items: Array<{
      sku?: string;
      status?: string;
      uploaded?: number;
      totalNow?: number;
      skipped?: number;
      reason?: string;
    }> = [];

    let updated = 0;
    let skuNotFound = 0;
    let failed = 0;

    for (const [sku, rawImages] of skuMap.entries()) {
      try {
        const product: any = await Product.findOne({
          sku,
          deletedAt: null,
        })
          .select("_id sku slug images thumbnailUrl availability")
          .lean();

        if (!product) {
          items.push({
            sku,
            status: "failed",
            reason: "SKU not found",
            uploaded: 0,
            totalNow: 0,
            skipped: rawImages.length,
          });
          skuNotFound++;
          continue;
        }

        const targetFolderPath = buildFolderPath(parentPath, sku);
        const existingLiveFolder = await findExistingLiveImageFolderForProduct(String(product._id));

        if (existingLiveFolder && safeStr(existingLiveFolder.path) !== safeStr(targetFolderPath)) {
          items.push({
            sku,
            status: "failed",
            uploaded: 0,
            skipped: rawImages.length,
            reason: `This SKU already exists in another folder: ${safeStr(existingLiveFolder.path)}`,
          });
          failed++;
          continue;
        }

        const folder = await ensureFolder(parentPath, sku, safeStr(user.email));

        const existingActiveCount = await ProductImageVaultFile.countDocuments({
          folderId: folder._id,
          deletedAt: null,
        });

        if (mode === "append" && existingActiveCount >= MAX_IMAGES_PER_PRODUCT) {
          items.push({
            sku,
            status: "failed",
            reason: `Max ${MAX_IMAGES_PER_PRODUCT} images already reached`,
            uploaded: 0,
            totalNow: existingActiveCount,
            skipped: rawImages.length,
          });
          failed++;
          continue;
        }

        if (mode === "replace") {
          await softDeleteFolderImages(String(folder._id), String(product._id));
        }

        const activeCountAfterReplace =
          mode === "replace"
            ? 0
            : await ProductImageVaultFile.countDocuments({
              folderId: folder._id,
              deletedAt: null,
            });

        const remainingSlots = Math.max(0, MAX_IMAGES_PER_PRODUCT - activeCountAfterReplace);
        const imagesToUpload = rawImages.slice(0, remainingSlots);
        const skipped = Math.max(0, rawImages.length - imagesToUpload.length);

        if (!imagesToUpload.length) {
          items.push({
            sku,
            status: "failed",
            reason: `Max ${MAX_IMAGES_PER_PRODUCT} images allowed`,
            uploaded: 0,
            totalNow: activeCountAfterReplace,
            skipped: rawImages.length,
          });
          failed++;
          continue;
        }

        const newUrls: string[] = [];

        for (let i = 0; i < imagesToUpload.length; i++) {
          const row = imagesToUpload[i];
          const ext = fileExt(row.originalName) || ".jpg";
          const contentType = mimeFromExt(ext);
          const imageBuffer = row.entry.getData();

          const s3Key = buildImageS3Key(folder.path, row.originalName);
          const s3Out = await uploadBufferToS3(imageBuffer, s3Key, contentType);

          const currentCount = activeCountAfterReplace + i;

          await ProductImageVaultFile.create({
            folderId: folder._id,
            originalName: safeStr(row.originalName),
            fileName: safeStr(path.basename(row.originalName)),
            fileExt: ext,
            baseName: safeStr(fileBaseName(row.originalName)),
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
            uploadedBy: safeStr(user.email),
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
          lastModifiedAt: new Date(),
        };

        if (!safeStr(product.thumbnailUrl) && activeUrls.length > 0) {
          updateData.thumbnailUrl = activeUrls[0];
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
              updatedBy: safeStr(user.email),
              notes: "AUTO_IMAGE_PRODUCT_FOLDER",
            },
          }
        );

        items.push({
          sku,
          status: "updated",
          uploaded: newUrls.length,
          totalNow: activeUrls.length,
          skipped,
        });

        updated++;
      } catch (err: any) {
        items.push({
          sku,
          status: "failed",
          uploaded: 0,
          reason: safeStr(err?.message || "Upload error"),
        });
        failed++;
      }
    }

    return NextResponse.json({
      ok: true,
      summary: {
        totalSkuFoldersInZip: skuMap.size,
        updated,
        skuNotFound,
        failed,
      },
      items,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: safeStr(err?.message || "Upload failed"),
      },
      { status: 500 }
    );
  }
}