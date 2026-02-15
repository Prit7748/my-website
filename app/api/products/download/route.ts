// app/api/products/download/route.ts
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import Order from "@/models/Order";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";

// ✅ Added global COMING_SOON flag
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

export async function GET(req: Request) {
  // ✅ Intercept early if global COMING_SOON is true
  if (COMING_SOON) {
    return NextResponse.json(
      { ok: false, status: "coming_soon", message: "Downloads are coming soon." },
      { status: 202 }
    );
  }

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

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

  const item = (paid.items || []).find((it: any) => String(it.productId) === String(productId));
  let key = asString(item?.pdfKey);

  // If snapshot key empty, try latest product key
  let p: any = null;
  if (!key) {
    p = await Product.findById(productId)
      .select("pdfKey availability deliverWithinMinutes comingSoonNote isActive")
      .lean();
    key = asString(p?.pdfKey);
  }

  // If still missing/unavailable: return "WAITING/NOT_READY" (not 404) for better UX
  if (!key || !key.startsWith("uploads/pdfs/")) {
    // ensure we have product meta
    if (!p) {
      p = await Product.findById(productId)
        .select("availability deliverWithinMinutes comingSoonNote isActive")
        .lean();
    }

    const availability = asString(p?.availability) || "available";
    const minsRaw = Number(p?.deliverWithinMinutes ?? 20);
    const deliverWithinMinutes = clamp(Number.isFinite(minsRaw) ? minsRaw : 20, 1, 1440);
    const note = asString(p?.comingSoonNote);

    // If product deleted/inactive but user paid earlier: still show status (don’t leak PDF)
    const paidAt = paid?.paidAt ? new Date(paid.paidAt) : now;

    if (availability === "coming_soon") {
      const etaAt = new Date(paidAt.getTime() + deliverWithinMinutes * 60 * 1000);
      const remainingMs = etaAt.getTime() - now.getTime();
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));

      return NextResponse.json(
        {
          ok: false,
          status: "processing",
          availability: "coming_soon",
          message:
            note ||
            "Your material is being prepared. It will appear in your dashboard automatically as soon as it is uploaded.",
          paidAt: paidAt.toISOString(),
          etaAt: etaAt.toISOString(),
          remainingSeconds: remainingSec,
        },
        { status: 202 }
      );
    }

    if (availability === "out_of_stock") {
      return NextResponse.json(
        {
          ok: false,
          status: "not_ready",
          availability: "out_of_stock",
          message:
            "This material is currently unavailable. Your access is محفوظ है—please check again later. We upload requested materials as soon as possible.",
          paidAt: paidAt.toISOString(),
        },
        { status: 202 }
      );
    }

    // available but key missing => treat as temporarily not ready
    return NextResponse.json(
      {
        ok: false,
        status: "not_ready",
        availability: "available",
        message:
          "Your purchase is confirmed, but the PDF is not available right now. Please try again shortly.",
        paidAt: paidAt.toISOString(),
      },
      { status: 202 }
    );
  }

  // Normal available flow
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