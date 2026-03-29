import crypto from "crypto";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import dbConnect from "@/lib/db";
import PdfVaultFolder from "@/models/PdfVaultFolder";
import ProductImageVaultFile from "@/models/ProductImageVaultFile";
import Product from "@/models/Product";
import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  safeStr,
  cleanFolderPath,
  normalizeSkuLike,
  fileExt,
  fileBaseName,
  slugify,
} from "@/lib/pdfVault";

export const runtime = "nodejs";

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

function mimeFromExt(ext: string) {
  const e = safeStr(ext).toLowerCase();
  if (e === ".jpg" || e === ".jpeg") return "image/jpeg";
  if (e === ".png") return "image/png";
  if (e === ".webp") return "image/webp";
  return "application/octet-stream";
}

function isAllowedImageName(name: string) {
  return ALLOWED_EXT.has(fileExt(name));
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

async function getFolderByPathOrThrow(folderPath: string) {
  await dbConnect();
  const row: any = await PdfVaultFolder.findOne({ path: folderPath, deletedAt: null }).lean();
  if (!row) throw new Error("Folder not found");
  return row;
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

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const parentPath = cleanFolderPath(searchParams.get("parentPath") || "img-root") || "img-root";

  const sortBy = safeStr(searchParams.get("sortBy") || "uploadedAt");
  const sortDir = safeStr(searchParams.get("sortDir") || "desc") === "asc" ? 1 : -1;

  const folder = await getFolderByPathOrThrow(parentPath);

  const sort: any =
    sortBy === "name"
      ? { fileName: sortDir }
      : sortBy === "productExists"
      ? { productExists: -1, uploadedAt: -1 }
      : { uploadedAt: sortDir };

  await dbConnect();

  const files: any[] = await ProductImageVaultFile.find({
    folderId: folder._id,
    deletedAt: null,
  })
    .sort(sort)
    .lean();

  return NextResponse.json({
    ok: true,
    files: files.map((f) => ({
      _id: String(f._id),
      folderId: String(f.folderId),
      fileName: safeStr(f.fileName),
      originalName: safeStr(f.originalName),
      fileExt: safeStr(f.fileExt),
      baseName: safeStr(f.baseName),
      skuNormalized: safeStr(f.skuNormalized),
      productExists: Boolean(f.productExists),
      productId: f.productId ? String(f.productId) : "",
      productSku: safeStr(f.productSku),
      productSlug: safeStr(f.productSlug),
      publicUrl: safeStr(f.publicUrl),
      sizeBytes: Number(f.sizeBytes || 0),
      width: Number(f.width || 0),
      height: Number(f.height || 0),
      isPrimary: Boolean(f.isPrimary),
      uploadedAt: f.uploadedAt ? String(f.uploadedAt) : null,
      updatedAt: f.updatedAt ? String(f.updatedAt) : null,
    })),
    total: files.length,
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body: any = await req.json().catch(() => ({}));
  const action = safeStr(body?.action);
  const fileId = safeStr(body?.fileId);

  if (!fileId) return NextResponse.json({ ok: false, error: "fileId required" }, { status: 400 });

  await dbConnect();

  const file: any = await ProductImageVaultFile.findById(fileId);
  if (!file || file.deletedAt) return NextResponse.json({ ok: false, error: "File not found" }, { status: 404 });

  if (action === "delete") {
    file.deletedAt = new Date();
    file.updatedBy = safeStr(user.email);
    await file.save();

    if (file.productId) {
      const p: any = await Product.findById(file.productId);
      if (p) {
        const url = safeStr(file.publicUrl);
        p.images = Array.isArray(p.images) ? p.images.filter((x: any) => safeStr(x) !== url) : [];
        if (safeStr(p.thumbnailUrl) === url) {
          p.thumbnailUrl = p.images?.[0] || "";
        }
        p.lastModifiedAt = new Date();
        await p.save();
      }
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Unsupported action" }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const folderPath = cleanFolderPath(String(formData.get("folderPath") || ""));
    const file = formData.get("file") as File | null;

    if (!folderPath) {
      return NextResponse.json({ ok: false, error: "folderPath required" }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ ok: false, error: "Image file required" }, { status: 400 });
    }

    if (!isAllowedImageName(file.name)) {
      return NextResponse.json({ ok: false, error: "Only jpg, jpeg, png, webp allowed" }, { status: 400 });
    }

    await dbConnect();

    const folder: any = await PdfVaultFolder.findOne({
      path: folderPath,
      deletedAt: null,
    });

    if (!folder) {
      return NextResponse.json({ ok: false, error: "Folder not found" }, { status: 404 });
    }

    const sku = normalizeSkuLike(folder.name);
    if (!sku) {
      return NextResponse.json(
        { ok: false, error: "Single image upload only allowed inside product SKU folder" },
        { status: 400 }
      );
    }

    const product: any = await Product.findOne({
      sku,
      deletedAt: null,
    });

    if (!product) {
      return NextResponse.json(
        { ok: false, error: "This folder is not linked to a valid product SKU" },
        { status: 400 }
      );
    }

    const activeCount = await ProductImageVaultFile.countDocuments({
      folderId: folder._id,
      deletedAt: null,
    });

    if (activeCount >= MAX_IMAGES_PER_PRODUCT) {
      return NextResponse.json(
        { ok: false, error: `Max ${MAX_IMAGES_PER_PRODUCT} images allowed in one product folder` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = fileExt(file.name) || ".jpg";
    const contentType = mimeFromExt(ext);
    const s3Key = buildImageS3Key(folder.path, file.name);
    const s3Out = await uploadBufferToS3(buffer, s3Key, contentType);

    await ProductImageVaultFile.create({
      folderId: folder._id,
      originalName: safeStr(file.name),
      fileName: safeStr(path.basename(file.name)),
      fileExt: ext,
      baseName: safeStr(fileBaseName(file.name)),
      skuNormalized: sku,
      productExists: true,
      productId: product._id,
      productSku: safeStr(product.sku),
      productSlug: safeStr(product.slug),
      s3Bucket: s3Out.bucket,
      s3Key: s3Out.key,
      publicUrl: s3Out.publicUrl,
      mimeType: contentType,
      sizeBytes: Number(buffer.length || 0),
      width: 0,
      height: 0,
      isPrimary: activeCount === 0,
      sortOrder: activeCount,
      uploadedAt: new Date(),
      uploadedBy: safeStr(user.email),
      deletedAt: null,
    });

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
        },
      }
    );

    return NextResponse.json({
      ok: true,
      uploaded: 1,
      totalNow: activeUrls.length,
      publicUrl: s3Out.publicUrl,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: safeStr(err?.message || "Single image upload failed"),
      },
      { status: 500 }
    );
  }
}