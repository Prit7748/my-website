// app/api/wallet/recharge/create-order/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import dbConnect from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import WalletRecharge from "@/models/WalletRecharge";
import ResellerConfig from "@/models/ResellerConfig";

export const runtime = "nodejs";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function roundMoney(x: any) {
  const n = safeNum(x, 0);
  return Math.round(n * 100) / 100;
}

function rndReceipt() {
  return `seller_${crypto.randomBytes(8).toString("hex")}`;
}

function getDefaultPlans() {
  return [
    {
      code: "basic",
      name: "Basic",
      price: 999,
      isActive: true,
    },
    {
      code: "standard",
      name: "Standard",
      price: 1499,
      isActive: true,
    },
    {
      code: "premium",
      name: "Premium",
      price: 1999,
      isActive: true,
    },
  ];
}

export async function POST(req: Request) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const keyId = safeStr(process.env.RAZORPAY_KEY_ID);
  const keySecret = safeStr(process.env.RAZORPAY_KEY_SECRET);

  if (!keyId || !keySecret) {
    return NextResponse.json({ error: "Razorpay env missing" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const requestedPlanCode = safeStr(body?.planCode).toLowerCase();

  if (!["basic", "standard", "premium"].includes(requestedPlanCode)) {
    return NextResponse.json({ error: "Invalid reseller plan selected" }, { status: 400 });
  }

  await dbConnect();

  const configDoc: any = await ResellerConfig.findOne({
    key: "default",
    isActive: true,
  }).lean();

  const plans = Array.isArray(configDoc?.plans) && configDoc.plans.length
    ? configDoc.plans
    : getDefaultPlans();

  const plan = plans.find(
    (p: any) =>
      safeStr(p?.code).toLowerCase() === requestedPlanCode &&
      Boolean(p?.isActive ?? true)
  );

  if (!plan) {
    return NextResponse.json({ error: "Selected plan is not active right now" }, { status: 400 });
  }

  const amountRupees = roundMoney(plan.price || 0);
  if (amountRupees <= 0) {
    return NextResponse.json({ error: "Invalid plan amount" }, { status: 400 });
  }

  const amount = Math.round(amountRupees * 100);
  const currency = "INR";
  const receipt = rndReceipt();

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
        userId: safeStr(authUser.id),
        email: safeStr(authUser.email),
        purpose: "reseller_wallet_recharge",
        planCode: safeStr(plan.code),
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

  const rechargeDoc = await WalletRecharge.create({
    userId: authUser.id,
    userEmail: safeStr(authUser.email),
    planCode: safeStr(plan.code).toLowerCase(),
    planName: safeStr(plan.name),
    amount: amountRupees,
    currency,
    status: "pending",
    paymentGateway: "razorpay",
    orderRef: safeStr(rzData.id),
    paymentId: "",
    paidAt: null,
    meta: {
      receipt,
      planPrice: amountRupees,
      planBadge: safeStr(plan.badge || ""),
      planAccentColor: safeStr(plan.accentColor || ""),
      createdBy: "wallet_page",
    },
  });

  return NextResponse.json(
    {
      ok: true,
      keyId,
      razorpayOrderId: safeStr(rzData.id),
      orderRef: safeStr(rzData.id),
      amount,
      currency,
      rechargeId: String(rechargeDoc._id),
      plan: {
        code: safeStr(plan.code).toLowerCase(),
        name: safeStr(plan.name),
        price: amountRupees,
      },
    },
    { status: 200 }
  );
}