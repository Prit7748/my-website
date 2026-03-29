import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import Order from "@/models/Order";
import PdfVaultFile from "@/models/PdfVaultFile";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";

const COMING_SOON = String(process.env.COMING_SOON || "").trim() === "1";

const REGION = process.env.AWS_REGION || "ap-south-1";
const BUCKET_PRIVATE =
  process.env.AWS_S3_BUCKET_PRIVATE || process.env.AWS_S3_BUCKET || "";

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

function asString(x: any) {
  return String(x ?? "").trim();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeAvailability(input: any) {
  const v = asString(input).toLowerCase();

  if (v === "available" || v === "in_stock" || v === "instock") return "available";

  if (
    v === "on_demand" ||
    v === "ondemand" ||
    v === "on-demand" ||
    v === "coming_soon" ||
    v === "comingsoon" ||
    v === "coming-soon"
  ) {
    return "on_demand";
  }

  if (
    v === "want_to_buy" ||
    v === "wanttobuy" ||
    v === "want-to-buy" ||
    v === "out_of_stock" ||
    v === "outofstock" ||
    v === "out-of-stock"
  ) {
    return "want_to_buy";
  }

  return "available";
}

function normalizeSkuLike(input: string) {
  return asString(input).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function findVaultPdfKeyForProduct(product: any) {
  const directPdfKey = asString(product?.pdfKey);
  if (directPdfKey) {
    return directPdfKey;
  }

  const skuLike = normalizeSkuLike(product?.sku || "");
  if (!skuLike) return "";

  const vaultFile: any = await PdfVaultFile.findOne({
    skuNormalized: skuLike,
    deletedAt: null,
  })
    .sort({ uploadedAt: -1, createdAt: -1 })
    .select("s3Key pageCount")
    .lean();

  return asString(vaultFile?.s3Key);
}

export async function GET(req: Request) {
  if (COMING_SOON) {
    return NextResponse.json(
      { ok: false, status: "coming_soon", message: "Downloads are coming soon." },
      { status: 202 }
    );
  }

  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const productId = asString(url.searchParams.get("productId"));
  const download = asString(url.searchParams.get("download")) === "1";

  if (!BUCKET_PRIVATE) {
    return NextResponse.json({ error: "Private bucket missing in env" }, { status: 500 });
  }

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return NextResponse.json({ error: "Invalid productId" }, { status: 400 });
  }

  await dbConnect();

  const now = new Date();

  const paid: any = await Order.findOne({
    userId: new mongoose.Types.ObjectId(user.id),
    status: "paid",
    expiresAt: { $gt: now },
    "items.productId": new mongoose.Types.ObjectId(productId),
  }).lean();

  if (!paid) {
    return NextResponse.json(
      { error: "No active access for this product" },
      { status: 403 }
    );
  }

  const item = Array.isArray(paid?.items)
    ? paid.items.find((it: any) => String(it?.productId) === String(productId))
    : null;

  const product: any = await Product.findById(productId)
    .select("pdfKey availability deliverWithinMinutes onDemandNote comingSoonNote sku isActive pages")
    .lean();

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  let key = asString(item?.pdfKey);

  if (!key) {
    key = await findVaultPdfKeyForProduct(product);

    if (key) {
      await Product.updateOne(
        { _id: product._id },
        {
          $set: {
            pdfKey: key,
            availability: "available",
            lastModifiedAt: new Date(),
          },
        }
      );

      await Order.updateOne(
        {
          _id: paid._id,
          "items.productId": new mongoose.Types.ObjectId(productId),
        },
        {
          $set: {
            "items.$.pdfKey": key,
          },
        }
      );
    }
  }

  if (key) {
    const signed = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: BUCKET_PRIVATE,
        Key: key,
        ResponseContentDisposition: download ? "attachment" : "inline",
      }),
      { expiresIn: 60 }
    );

    return NextResponse.json({ ok: true, url: signed, expiresIn: 60 }, { status: 200 });
  }

  const availability = normalizeAvailability(product?.availability);
  const minsRaw = Number(product?.deliverWithinMinutes ?? 20);
  const deliverWithinMinutes = clamp(Number.isFinite(minsRaw) ? minsRaw : 20, 1, 1440);
  const note = asString(product?.onDemandNote || product?.comingSoonNote);
  const paidAt = paid?.paidAt ? new Date(paid.paidAt) : now;

  if (availability === "on_demand") {
    const etaAt = new Date(paidAt.getTime() + deliverWithinMinutes * 60 * 1000);
    const remainingMs = etaAt.getTime() - now.getTime();
    const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));

    return NextResponse.json(
      {
        ok: false,
        status: "processing",
        availability: "on_demand",
        message:
          note ||
          "Your material is being prepared. It will be available in your dashboard shortly after upload.",
        paidAt: paidAt.toISOString(),
        etaAt: etaAt.toISOString(),
        remainingSeconds: remainingSec,
      },
      { status: 202 }
    );
  }

  if (availability === "want_to_buy") {
    return NextResponse.json(
      {
        ok: false,
        status: "not_ready",
        availability: "want_to_buy",
        message:
          "This material is currently not ready. Your purchase is safe—please try again later.",
        paidAt: paidAt.toISOString(),
      },
      { status: 202 }
    );
  }

  return NextResponse.json(
    {
      ok: false,
      status: "not_ready",
      availability: "available",
      message:
        "Your purchase is confirmed, but the PDF is not linked yet. Please try again shortly.",
      paidAt: paidAt.toISOString(),
    },
    { status: 202 }
  );
}