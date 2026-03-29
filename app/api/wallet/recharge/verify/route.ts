// app/api/wallet/recharge/verify/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import dbConnect from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import User from "@/models/User";
import WalletRecharge from "@/models/WalletRecharge";
import WalletLedger from "@/models/WalletLedger";
import { getPublicResellerSnapshot } from "@/lib/reseller";

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
  const razorpay_order_id = safeStr(body?.razorpay_order_id);
  const razorpay_payment_id = safeStr(body?.razorpay_payment_id);
  const razorpay_signature = safeStr(body?.razorpay_signature);

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing razorpay fields" }, { status: 400 });
  }

  const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected = crypto.createHmac("sha256", keySecret).update(payload).digest("hex");

  if (expected !== razorpay_signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  await dbConnect();

  const rechargeDoc: any = await WalletRecharge.findOne({
    userId: authUser.id,
    paymentGateway: "razorpay",
    orderRef: razorpay_order_id,
  });

  if (!rechargeDoc) {
    return NextResponse.json({ error: "Recharge order not found" }, { status: 404 });
  }

  if (rechargeDoc.status === "paid") {
    const userDoc: any = await User.findById(authUser.id).select("reseller");
    return NextResponse.json(
      {
        ok: true,
        status: "paid",
        reseller: getPublicResellerSnapshot(userDoc),
      },
      { status: 200 }
    );
  }

  const basic = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const rz = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
    method: "GET",
    headers: {
      Authorization: `Basic ${basic}`,
    },
  });

  const rzData: any = await rz.json().catch(() => ({}));
  if (!rz.ok) {
    return NextResponse.json(
      { error: "Razorpay fetch failed", details: rzData },
      { status: 500 }
    );
  }

  const apiOrderId = safeStr(rzData?.order_id);
  const apiStatus = safeStr(rzData?.status);

  if (apiOrderId !== razorpay_order_id) {
    return NextResponse.json({ error: "Payment does not match recharge order" }, { status: 400 });
  }

  if (apiStatus !== "captured" && apiStatus !== "authorized") {
    rechargeDoc.status = apiStatus === "failed" ? "failed" : "pending";
    rechargeDoc.paymentId = razorpay_payment_id;
    await rechargeDoc.save();

    return NextResponse.json(
      {
        ok: false,
        status: rechargeDoc.status,
        message: "Payment not captured yet",
      },
      { status: 200 }
    );
  }

  const userDoc: any = await User.findById(authUser.id);
  if (!userDoc) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!userDoc.reseller || typeof userDoc.reseller !== "object") {
    userDoc.reseller = {};
  }

  const now = new Date();
  const rechargeAmount = roundMoney(rechargeDoc.amount || 0);
  const balanceBefore = roundMoney(userDoc.reseller.walletBalance || 0);
  const balanceAfter = roundMoney(balanceBefore + rechargeAmount);

  userDoc.reseller.isReseller = true;
  userDoc.reseller.status = "active";
  userDoc.reseller.planCode = safeStr(rechargeDoc.planCode).toLowerCase();
  userDoc.reseller.planName = safeStr(rechargeDoc.planName);
  userDoc.reseller.planActivatedAt = now;
  userDoc.reseller.lastRechargeAt = now;
  userDoc.reseller.walletBalance = balanceAfter;
  userDoc.reseller.walletTotalRecharged = roundMoney(
    (userDoc.reseller.walletTotalRecharged || 0) + rechargeAmount
  );

  await userDoc.save();

  await WalletLedger.create({
    userId: userDoc._id,
    userEmail: safeStr(userDoc.email),
    entryType: "recharge_credit",
    source: "razorpay",
    status: "success",
    direction: "credit",
    amount: rechargeAmount,
    balanceBefore,
    balanceAfter,
    planCode: safeStr(rechargeDoc.planCode).toLowerCase(),
    planName: safeStr(rechargeDoc.planName),
    orderRef: safeStr(rechargeDoc.orderRef),
    paymentId: razorpay_payment_id,
    note: "Reseller wallet recharge via Razorpay",
    meta: {
      rechargeId: String(rechargeDoc._id),
      purpose: "seller_wallet_recharge",
    },
  });

  rechargeDoc.status = "paid";
  rechargeDoc.paymentId = razorpay_payment_id;
  rechargeDoc.paidAt = now;
  rechargeDoc.meta = {
    ...(rechargeDoc.meta || {}),
    verifiedAt: now,
    walletBalanceBefore: balanceBefore,
    walletBalanceAfter: balanceAfter,
  };
  await rechargeDoc.save();

  return NextResponse.json(
    {
      ok: true,
      status: "paid",
      reseller: getPublicResellerSnapshot(userDoc),
    },
    { status: 200 }
  );
}