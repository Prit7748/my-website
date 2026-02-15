// app/api/products/want-to-buy/route.ts  (NEW FILE)
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import WantToBuy from "@/models/WantToBuy";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";

function asString(x: any) {
  return String(x ?? "").trim();
}

export async function POST(req: Request) {
  const user = await getAuthUser(); // optional - if not logged in we still allow via email/phone
  const body = await req.json().catch(() => ({}));

  const productId = asString(body?.productId);
  const message = asString(body?.message);
  const phone = asString(body?.phone);
  const email = asString(body?.email) || asString(user?.email);

  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    return NextResponse.json({ error: "Invalid productId" }, { status: 400 });
  }
  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  await dbConnect();

  const p: any = await Product.findById(productId)
    .select("title slug category price isActive availability")
    .lean();

  if (!p || p?.isActive === false) {
    return NextResponse.json({ error: "Product not found / inactive" }, { status: 404 });
  }

  // ✅ save request (dedupe for same user+product in last 24h)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await WantToBuy.findOne({
    productId: new mongoose.Types.ObjectId(productId),
    userEmail: email,
    createdAt: { $gte: since },
  }).lean();

  if (existing) {
    return NextResponse.json(
      { ok: true, message: "Request already received. We will contact you soon ✅" },
      { status: 200 }
    );
  }

  await WantToBuy.create({
    userId: user?.id ? new mongoose.Types.ObjectId(user.id) : null,
    userEmail: email,
    productId: new mongoose.Types.ObjectId(productId),
    productSlug: asString(p.slug),
    productTitle: asString(p.title),
    category: asString(p.category),
    price: Number(p.price || 0),
    message,
    phone,
    status: "new",
  });

  return NextResponse.json(
    { ok: true, message: "Request submitted ✅ Our team will contact you soon." },
    { status: 200 }
  );
}
