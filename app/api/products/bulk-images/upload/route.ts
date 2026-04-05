import crypto from "crypto";
import path from "path";
import { NextResponse } from "next/server";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

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
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const S3_TIMEOUT_MS = 120000;

type UploadMode = "append" | "replace";

type FileLike = {
  name: string;
  size?: number;
  type?: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

type StagedUploadedImage = {
  originalName: string;
  fileName: string;
  fileExt: string;
  baseName: string;
  mimeType: string;
  sizeBytes: number;
  s3Bucket: string;
  s3Key: string;
  publicUrl: string;
};

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function isFileLike(value: any): value is FileLike {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof value.name === "string" &&
      typeof value.arrayBuffer === "function"
  );
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

function normalizeLegacyAvailability(value: string) {
  const av = safeStr(value).toLowerCase();
  if (av === "coming_soon" || av === "comingsoon" || av === "coming-soon") return "on_demand";
  if (av === "out_of_stock" || av === "outofstock" || av === "out-of-stock") return "want_to_buy";
  if (!av || av === "in_stock" || av === "instock") return "available";
  if (av === "available" || av === "on_demand" || av === "want_to_buy") return av;
  return "";
}

function buildImageS3Key(folderPath: string, originalName: string) {
  const ext = fileExt(originalName) || ".jpg";
  const base = slugify(fileBaseName(originalName)) || "image";
  const rand = crypto.randomBytes(8).toString("hex");
  const folder = cleanFolderPath(folderPath);
  return `uploads/products/${folder ? `${folder}/` : ""}${base}-${rand}${ext}`;
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null;

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

async function uploadBufferToS3(buffer: Buffer, key: string, contentType: string) {
  if (!ACCESS_KEY || !SECRET_KEY) {
    throw new Error("AWS credentials missing");
  }

  if (!BUCKET_IMAGES) {
    throw new Error("AWS_S3_BUCKET_PUBLIC or AWS_S3_BUCKET_IMAGES missing for product images");
  }

  await withTimeout(
    s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_IMAGES,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    ),
    S3_TIMEOUT_MS,
    "S3 image upload"
  );

  return {
    bucket: BUCKET_IMAGES,
    key,
    publicUrl: `${PUBLIC_BASE_URL}/${key}`,
  };
}

async function deleteS3ObjectIfExists(s3Key: string) {
  const key = safeStr(s3Key);
  if (!key || !BUCKET_IMAGES) return;

  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_IMAGES,
        Key: key,
      })
    );
  } catch {
    // ignore cleanup failure
  }
}

async function softDeleteFolderImages(folderId: string) {
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

async function readIncomingFiles(formData: FormData) {
  const rawEntries = [
    ...formData.getAll("files"),
    ...formData.getAll("file"),
    ...formData.getAll("images"),
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

  return files;
}

async function uploadNewFolderImagesAtomic(args: {
  files: FileLike[];
  targetFolderPath: string;
}) {
  const uploaded: StagedUploadedImage[] = [];

  try {
    for (const file of args.files) {
      const originalName = safeStr(path.basename(file.name));
      const ext = fileExt(originalName) || ".jpg";
      const contentType = mimeFromExt(ext);

      const buffer = Buffer.from(await file.arrayBuffer());

      const s3Key = buildImageS3Key(args.targetFolderPath, originalName);
      const s3Out = await uploadBufferToS3(buffer, s3Key, contentType);

      uploaded.push({
        originalName,
        fileName: safeStr(path.basename(originalName)),
        fileExt: ext,
        baseName: safeStr(fileBaseName(originalName)),
        mimeType: contentType,
        sizeBytes: Number(buffer.length || 0),
        s3Bucket: s3Out.bucket,
        s3Key: s3Out.key,
        publicUrl: s3Out.publicUrl,
      });
    }

    return uploaded;
  } catch (error) {
    for (const item of uploaded) {
      await deleteS3ObjectIfExists(item.s3Key);
    }
    throw error;
  }
}

export async function POST(req: Request) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  const contentType = safeStr(req.headers.get("content-type")).toLowerCase();
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { ok: false, error: "Only multipart/form-data is supported" },
      { status: 400 }
    );
  }

  try {
    const formData = await req.formData();

    const parentPath = cleanFolderPath(String(formData.get("parentPath") || "")) || "";
    const modeRaw = safeStr(formData.get("mode")).toLowerCase();
    const mode: UploadMode = modeRaw === "replace" ? "replace" : "append";
    const skuFolderName = safeStr(
      formData.get("skuFolderName") ||
        formData.get("folderName") ||
        formData.get("sku")
    );

    if (!parentPath) {
      return NextResponse.json(
        { ok: false, error: "parentPath required" },
        { status: 400 }
      );
    }

    if (parentPath === "img-root") {
      return NextResponse.json(
        {
          ok: false,
          error: "Please first open a website-created folder. Direct upload in img-root is not allowed.",
        },
        { status: 400 }
      );
    }

    const files = await readIncomingFiles(formData);
    if (!files.length) {
      return NextResponse.json(
        { ok: false, error: "At least one image file is required" },
        { status: 400 }
      );
    }

    const sku = normalizeSkuLike(skuFolderName);
    if (!sku) {
      return NextResponse.json(
        { ok: false, error: "Valid SKU folder name required" },
        { status: 400 }
      );
    }

    const invalidFile = files.find((file) => !isAllowedImageName(file.name));
    if (invalidFile) {
      return NextResponse.json(
        {
          ok: false,
          error: `Only jpg, jpeg, png, webp allowed. Invalid file: ${safeStr(invalidFile.name)}`,
        },
        { status: 400 }
      );
    }

    const oversizeFile = files.find((file) => safeNum(file.size, 0) > MAX_IMAGE_SIZE_BYTES);
    if (oversizeFile) {
      return NextResponse.json(
        {
          ok: false,
          error: `Image too large: ${safeStr(oversizeFile.name)}. Max size is 15MB per image.`,
        },
        { status: 400 }
      );
    }

    await dbConnect();

    const product: any = await Product.findOne({
      sku,
      deletedAt: null,
    })
      .select("_id sku slug images thumbnailUrl quickUrl availability")
      .lean();

    if (!product) {
      return NextResponse.json(
        { ok: false, error: "SKU not found" },
        { status: 404 }
      );
    }

    const targetFolderPath = buildFolderPath(parentPath, sku);
    const existingLiveFolder = await findExistingLiveImageFolderForProduct(String(product._id));

    if (existingLiveFolder && safeStr(existingLiveFolder.path) !== safeStr(targetFolderPath)) {
      return NextResponse.json(
        {
          ok: false,
          error: `This SKU already exists in another folder: ${safeStr(existingLiveFolder.path)}`,
        },
        { status: 409 }
      );
    }

    const folder = await ensureFolder(parentPath, sku, safeStr(guard.user.email));

    const existingActiveVaultFiles: any[] = await ProductImageVaultFile.find({
      folderId: folder._id,
      deletedAt: null,
    })
      .sort({ sortOrder: 1, uploadedAt: 1 })
      .lean();

    const existingActiveCount = existingActiveVaultFiles.length;

    if (mode === "append" && existingActiveCount >= MAX_IMAGES_PER_PRODUCT) {
      return NextResponse.json(
        {
          ok: false,
          error: `Max ${MAX_IMAGES_PER_PRODUCT} images already reached for this product folder`,
        },
        { status: 400 }
      );
    }

    const uniqueByName = new Map<string, FileLike>();
    for (const file of files) {
      const key = safeStr(path.basename(file.name)).toLowerCase();
      if (!uniqueByName.has(key)) {
        uniqueByName.set(key, file);
      }
    }

    const incomingUniqueFiles = Array.from(uniqueByName.values());
    const remainingSlots =
      mode === "replace"
        ? MAX_IMAGES_PER_PRODUCT
        : Math.max(0, MAX_IMAGES_PER_PRODUCT - existingActiveCount);

    const filesToUpload = incomingUniqueFiles.slice(0, remainingSlots);
    const skippedImages = Math.max(0, incomingUniqueFiles.length - filesToUpload.length);

    if (!filesToUpload.length) {
      return NextResponse.json(
        {
          ok: false,
          error: `Max ${MAX_IMAGES_PER_PRODUCT} images allowed in one product folder`,
        },
        { status: 400 }
      );
    }

    const uploadedImages = await uploadNewFolderImagesAtomic({
      files: filesToUpload,
      targetFolderPath: folder.path,
    });

    try {
      const baseSortOrder = mode === "replace" ? 0 : existingActiveCount;

      if (mode === "replace") {
        await softDeleteFolderImages(String(folder._id));
      }

      for (let i = 0; i < uploadedImages.length; i++) {
        const item = uploadedImages[i];

        await ProductImageVaultFile.create({
          folderId: folder._id,
          originalName: item.originalName,
          fileName: item.fileName,
          fileExt: item.fileExt,
          baseName: item.baseName,
          skuNormalized: sku,
          productExists: true,
          productId: product._id,
          productSku: safeStr(product.sku),
          productSlug: safeStr(product.slug),
          s3Bucket: item.s3Bucket,
          s3Key: item.s3Key,
          publicUrl: item.publicUrl,
          mimeType: item.mimeType,
          sizeBytes: Number(item.sizeBytes || 0),
          width: 0,
          height: 0,
          isPrimary: baseSortOrder + i === 0,
          sortOrder: baseSortOrder + i,
          uploadedAt: new Date(),
          uploadedBy: safeStr(guard.user.email),
          deletedAt: null,
        });
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

      if (mode === "replace") {
        updateData.thumbnailUrl = activeUrls[0] || "";
      } else if (!safeStr(product.thumbnailUrl) && activeUrls.length > 0) {
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
            updatedBy: safeStr(guard.user.email),
            notes: "AUTO_IMAGE_PRODUCT_FOLDER",
          },
        }
      );

      return NextResponse.json(
        {
          ok: true,
          mode: "direct_folder_upload",
          folder: {
            _id: String(folder._id),
            name: safeStr(folder.name),
            path: safeStr(folder.path),
          },
          summary: {
            sku,
            uploadedImages: uploadedImages.length,
            skippedImages,
            totalImagesNow: activeUrls.length,
            status: "completed",
          },
        },
        { status: 200 }
      );
    } catch (error) {
      for (const item of uploadedImages) {
        await deleteS3ObjectIfExists(item.s3Key);
      }
      throw error;
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message || "Direct folder upload failed"),
      },
      { status: 500 }
    );
  }
}