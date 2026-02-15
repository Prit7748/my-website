// app/api/payments/razorpay/webhook/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";

export const runtime = "nodejs";

function asString(x: any) {
  return String(x ?? "").trim();
}

function timingSafeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export async function POST(req: Request) {
  const secret = asString(process.env.Webhook_ITSMYWEBSITE_IGNOU);
  if (!secret) return NextResponse.json({ error: "Webhook secret missing" }, { status: 500 });

  // Razorpay sends raw body signature
  const raw = await req.text();
  const sig = asString(req.headers.get("x-razorpay-signature"));

  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  if (!sig || !timingSafeEqual(expected, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(raw);

  // We care mostly about payment captured / authorized
  const type = asString(event?.event);

  // payment entity is usually here:
  const payment = event?.payload?.payment?.entity;
  const orderId = asString(payment?.order_id); // razorpay_order_id
  const paymentId = asString(payment?.id);
  const status = asString(payment?.status); // captured/authorized/failed

  if (!orderId) return NextResponse.json({ ok: true }, { status: 200 });

  await dbConnect();

  const ord: any = await Order.findOne({
    paymentGateway: "razorpay",
    orderRef: orderId,
  });

  // If order not found, still return ok (no retries storm)
  if (!ord) return NextResponse.json({ ok: true }, { status: 200 });

  // ✅ Idempotent
  if (ord.status === "paid") return NextResponse.json({ ok: true }, { status: 200 });

  if (type === "payment.captured" || status === "captured" || status === "authorized") {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    ord.status = "paid";
    ord.paymentId = paymentId || ord.paymentId;
    ord.paidAt = ord.paidAt || now;
    ord.expiresAt = ord.expiresAt || expiresAt;
    await ord.save();
  }

  if (type === "payment.failed" || status === "failed") {
    ord.status = "failed";
    ord.paymentId = paymentId || ord.paymentId;
    await ord.save();
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
