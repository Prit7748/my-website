// app/api/payments/razorpay/verify/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import dbConnect from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import Order from "@/models/Order";

export const runtime = "nodejs";

function asString(x: any) {
  return String(x ?? "").trim();
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
  const razorpay_order_id = asString(body?.razorpay_order_id);
  const razorpay_payment_id = asString(body?.razorpay_payment_id);
  const razorpay_signature = asString(body?.razorpay_signature);

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing razorpay fields" }, { status: 400 });
  }

  // ✅ 1) Verify signature first
  const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected = crypto.createHmac("sha256", keySecret).update(payload).digest("hex");
  if (expected !== razorpay_signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  await dbConnect();

  // ✅ 2) Find our order
  const ord: any = await Order.findOne({
    userId: user.id,
    paymentGateway: "razorpay",
    orderRef: razorpay_order_id,
  });

  if (!ord) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // ✅ idempotent
  if (ord.status === "paid") {
    return NextResponse.json(
      { ok: true, status: "paid", paidAt: ord.paidAt, expiresAt: ord.expiresAt },
      { status: 200 }
    );
  }

  // ✅ 3) Confirm from Razorpay API (server-side truth)
  const basic = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const rz = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
    method: "GET",
    headers: { Authorization: `Basic ${basic}` },
  });

  const rzData: any = await rz.json().catch(() => ({}));
  if (!rz.ok) {
    return NextResponse.json({ error: "Razorpay fetch failed", details: rzData }, { status: 500 });
  }

  // ✅ payment must belong to same orderRef
  const apiOrderId = asString(rzData?.order_id);
  const apiStatus = asString(rzData?.status); // captured/authorized/failed/created
  if (apiOrderId !== razorpay_order_id) {
    return NextResponse.json({ error: "Payment does not match order" }, { status: 400 });
  }

  if (apiStatus !== "captured" && apiStatus !== "authorized") {
    // not successful yet
    ord.status = apiStatus === "failed" ? "failed" : "pending";
    ord.paymentId = razorpay_payment_id;
    await ord.save();

    return NextResponse.json(
      { ok: false, status: ord.status, message: "Payment not captured yet" },
      { status: 200 }
    );
  }

  // ✅ 4) Mark paid + 1 year expiry
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  ord.status = "paid";
  ord.paymentId = razorpay_payment_id;
  ord.paidAt = now;
  ord.expiresAt = expiresAt;

  await ord.save();

  return NextResponse.json(
    { ok: true, status: "paid", paidAt: now.toISOString(), expiresAt: expiresAt.toISOString() },
    { status: 200 }
  );
}
