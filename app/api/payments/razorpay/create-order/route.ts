// app/api/payments/razorpay/create-order/route.ts  (NEW FILE)
import { NextResponse } from "next/server";
import crypto from "crypto";
import dbConnect from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import Product from "@/models/Product";
import Order from "@/models/Order";

export const runtime = "nodejs";

function asString(x: any) {
  return String(x ?? "").trim();
}

function rndReceipt() {
  return `rcpt_${crypto.randomBytes(8).toString("hex")}`;
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const keyId = asString(process.env.RAZORPAY_KEY_ID);
  const keySecret = asString(process.env.RAZORPAY_KEY_SECRET);
  if (!keyId || !keySecret) {
    return NextResponse.json({ error: "Razorpay env missing" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const productId = asString(body?.productId);
  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

  await dbConnect();

  const p: any = await Product.findById(productId)
    .select("title category price isActive pdfKey")
    .lean();

  if (!p || !p.isActive) {
    return NextResponse.json({ error: "Product not found / inactive" }, { status: 404 });
  }

  const price = Number(p.price || 0);
  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: "Invalid product price" }, { status: 400 });
  }

  // ✅ amount in paise
  const amount = Math.round(price * 100);
  const currency = "INR";
  const receipt = rndReceipt();

  // ✅ Create Razorpay Order via REST (no extra npm needed)
  const basic = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const rz = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency,
      receipt,
      payment_capture: 1,
      notes: {
        productId,
        userId: user.id,
        email: user.email,
      },
    }),
  });

  const rzData: any = await rz.json().catch(() => ({}));
  if (!rz.ok) {
    return NextResponse.json(
      { error: "Razorpay order create failed", details: rzData },
      { status: 500 }
    );
  }

  // ✅ Store our internal order (pending)
  const orderDoc = await Order.create({
    userId: user.id,
    userEmail: user.email,
    status: "pending",
    items: [
      {
        productId,
        title: String(p.title || ""),
        category: String(p.category || ""),
        price: price,
        pdfKey: String(p.pdfKey || ""), // snapshot for 1-year access
      },
    ],
    totalAmount: price,
    currency,
    paymentGateway: "razorpay",
    orderRef: String(rzData.id || ""), // razorpay_order_id
    paymentId: "",
    paidAt: null,
    expiresAt: null,
  });

  return NextResponse.json(
    {
      ok: true,
      razorpayKeyId: keyId,
      razorpayOrderId: rzData.id,
      amount,
      currency,
      receipt,
      orderId: orderDoc._id.toString(),
    },
    { status: 200 }
  );
}
