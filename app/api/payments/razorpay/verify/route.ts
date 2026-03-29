import { NextResponse } from "next/server";
import crypto from "crypto";
import dbConnect from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import Order from "@/models/Order";
import User from "@/models/User";
import WalletLedger from "@/models/WalletLedger";
import PromoCode from "@/models/PromoCode";
import PromoCodeUsage from "@/models/PromoCodeUsage";
import {
  sendHardcopyPaidAdminPushover,
  sendOnDemandAdminPushover,
} from "@/lib/orderNotifications";
import { applySellerLowBalanceRule } from "@/lib/reseller";
import { syncShiprocketForOrder } from "@/lib/shiprocket";

export const runtime = "nodejs";

function asString(x: any) {
  return String(x ?? "").trim();
}

function asNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function roundMoney(x: any) {
  const n = asNum(x, 0);
  return Math.round(n * 100) / 100;
}

function safeArr(x: any) {
  return Array.isArray(x) ? x : [];
}

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function parseCookieHeader(raw: string) {
  const out: Record<string, string> = {};
  const parts = String(raw || "").split(";");

  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = val;
  }

  return out;
}

function readAttributionFromRequest(req: Request, body: any) {
  const analyticsFromBody =
    body?.analytics && typeof body.analytics === "object" ? body.analytics : null;

  const cookieMap = parseCookieHeader(req.headers.get("cookie") || "");
  const rawAttrCookie = cookieMap["isp_attr_v1"] || "";
  const decoded = rawAttrCookie ? decodeURIComponent(rawAttrCookie) : "";
  const analyticsFromCookie = decoded
    ? safeJsonParse<any>(decoded, { firstTouch: null, lastTouch: null })
    : { firstTouch: null, lastTouch: null };

  const chosenLastTouch =
    analyticsFromBody?.lastTouch && typeof analyticsFromBody.lastTouch === "object"
      ? analyticsFromBody.lastTouch
      : analyticsFromCookie?.lastTouch || null;

  const chosenFirstTouch =
    analyticsFromBody?.firstTouch && typeof analyticsFromBody.firstTouch === "object"
      ? analyticsFromBody.firstTouch
      : analyticsFromCookie?.firstTouch || null;

  return {
    firstTouch: chosenFirstTouch,
    lastTouch: chosenLastTouch,
    savedAt: new Date().toISOString(),
    sourceBucket: asString(
      chosenLastTouch?.source_bucket || chosenFirstTouch?.source_bucket || "direct"
    ),
    detectedSource: asString(
      chosenLastTouch?.detected_source || chosenFirstTouch?.detected_source || "direct"
    ),
    utmSource: asString(chosenLastTouch?.utm_source || chosenFirstTouch?.utm_source),
    utmMedium: asString(chosenLastTouch?.utm_medium || chosenFirstTouch?.utm_medium),
    utmCampaign: asString(chosenLastTouch?.utm_campaign || chosenFirstTouch?.utm_campaign),
    referrerHost: asString(
      chosenLastTouch?.referrer_host || chosenFirstTouch?.referrer_host
    ),
  };
}

function buildPromoItemsSnapshot(orderItems: any[]) {
  return safeArr(orderItems).map((item: any) => ({
    itemType: asString(item?.itemType || "product"),
    productId: asString(item?.productId),
    title: asString(item?.title),
    category: asString(item?.category),
    quantity: Math.max(1, asNum(item?.quantity, 1)),
    price: roundMoney(item?.price || 0),
    originalPrice: roundMoney(item?.originalPrice || 0),
    payableUnitPrice: roundMoney(item?.payableUnitPrice || 0),
    payableAmount: roundMoney(item?.payableAmount || 0),
    comboSlug: asString(item?.comboSlug),
    comboCategorySlug: asString(item?.comboCategorySlug),
    isBuilderCombo: Boolean(item?.isBuilderCombo),
  }));
}

async function finalizeResellerBenefitsForPaidOrder(ord: any, userId: string) {
  const pricing = ord?.meta?.pricing || {};
  const plannedWalletDebit = roundMoney(pricing?.plannedWalletDebit || 0);
  const discountTotal = roundMoney(pricing?.discountAmount || 0);
  const planCode = asString(pricing?.resellerPlanCode || "");
  const planName = asString(pricing?.resellerPlanName || "");
  const usageObj =
    pricing?.discountUsageToApply && typeof pricing.discountUsageToApply === "object"
      ? pricing.discountUsageToApply
      : {};

  const userDoc: any = await User.findById(userId);
  if (!userDoc) {
    return {
      actualWalletDebit: 0,
      walletShortfall: plannedWalletDebit,
      balanceBefore: 0,
      balanceAfter: 0,
    };
  }

  if (!userDoc.reseller || typeof userDoc.reseller !== "object") {
    userDoc.reseller = {};
  }

  const balanceBefore = roundMoney(userDoc.reseller.walletBalance || 0);
  const actualWalletDebit = roundMoney(Math.min(balanceBefore, plannedWalletDebit));
  const balanceAfter = roundMoney(balanceBefore - actualWalletDebit);

  userDoc.reseller.walletBalance = balanceAfter;
  userDoc.reseller.walletTotalUsed = roundMoney(
    (userDoc.reseller.walletTotalUsed || 0) + actualWalletDebit
  );
  userDoc.reseller.walletTotalDiscountSaved = roundMoney(
    (userDoc.reseller.walletTotalDiscountSaved || 0) + discountTotal
  );

  const usageStore =
    userDoc.reseller.discountUsageByCategory &&
    typeof userDoc.reseller.discountUsageByCategory === "object"
      ? userDoc.reseller.discountUsageByCategory
      : {};

  for (const [catKey, qty] of Object.entries(usageObj)) {
    const prev = asNum(
      typeof usageStore?.get === "function" ? usageStore.get(catKey) : usageStore?.[catKey],
      0
    );
    const next = Math.max(0, prev + asNum(qty, 0));

    if (typeof usageStore?.set === "function") {
      usageStore.set(catKey, next);
    } else {
      usageStore[catKey] = next;
    }
  }

  userDoc.reseller.discountUsageByCategory = usageStore;
  applySellerLowBalanceRule(userDoc);
  await userDoc.save();

  if (actualWalletDebit > 0) {
    await WalletLedger.create({
      userId,
      userEmail: asString(userDoc.email || ""),
      entryType: "wallet_debit",
      source: "order",
      status: "success",
      direction: "debit",
      amount: actualWalletDebit,
      balanceBefore,
      balanceAfter,
      planCode,
      planName,
      orderId: String(ord?._id || ""),
      orderRef: asString(ord?.orderRef || ""),
      paymentId: asString(ord?.paymentId || ""),
      note: "Wallet debit applied after successful Razorpay payment",
      meta: {
        pricingMode: "mixed_or_gateway",
      },
    });
  }

  return {
    actualWalletDebit,
    walletShortfall: roundMoney(plannedWalletDebit - actualWalletDebit),
    balanceBefore,
    balanceAfter,
  };
}

async function syncPromoUsageForOrder(ord: any, userId: string) {
  const promoMeta =
    ord?.meta?.promo && typeof ord.meta.promo === "object" ? ord.meta.promo : {};

  const promoCode = asString(ord?.coupon || promoMeta?.code).toUpperCase();
  if (!promoCode) {
    return {
      skipped: true,
      reason: "no_promo_code",
    };
  }

  const orderId = asString(ord?._id || "");
  if (!orderId) {
    return {
      skipped: true,
      reason: "missing_order_id",
    };
  }

  const promoDoc: any = await PromoCode.findOne({ code: promoCode })
    .select("_id code title")
    .lean()
    .catch(() => null);

  let usage: any =
    (await PromoCodeUsage.findOne({
      orderId,
      code: promoCode,
    }).catch(() => null)) ||
    (await PromoCodeUsage.findOne({
      orderRef: asString(ord?.orderRef || ""),
      code: promoCode,
    }).catch(() => null)) ||
    null;

  const wasSuccess = usage?.status === "success";

  if (!usage) {
    usage = new PromoCodeUsage();
  }

  usage.promoCodeId = promoDoc?._id || usage?.promoCodeId || null;
  usage.promoCode = promoCode;
  usage.code = promoCode;
  usage.title = asString(promoMeta?.title || promoDoc?.title || usage?.title || "");
  usage.userId = userId || null;
  usage.userEmail = asString(ord?.userEmail || "");
  usage.orderId = ord?._id || null;
  usage.orderRef = asString(ord?.orderRef || "");
  usage.orderStatus = asString(ord?.status || "");
  usage.paymentGateway = asString(ord?.paymentGateway || "");
  usage.paymentId = asString(ord?.paymentId || "");
  usage.status = ord?.status === "paid" ? "success" : "pending";
  usage.discountAmount = roundMoney(
    ord?.meta?.pricing?.promoDiscountAmount || promoMeta?.discountAmount || 0
  );
  usage.appliedOnAmount = roundMoney(
    promoMeta?.eligibleSubtotal ||
      ord?.meta?.pricing?.payableAmountBeforePromo ||
      ord?.originalAmount ||
      0
  );
  usage.originalAmount = roundMoney(ord?.originalAmount || 0);
  usage.payableAmount = roundMoney(ord?.payableAmount || ord?.totalAmount || 0);
  usage.totalAmount = roundMoney(ord?.totalAmount || ord?.payableAmount || 0);
  usage.currency = asString(ord?.currency || "INR");
  usage.itemsSnapshot = buildPromoItemsSnapshot(ord?.items || []);
  usage.meta = {
    ...(usage?.meta && typeof usage.meta === "object" ? usage.meta : {}),
    promo: promoMeta || null,
    orderStatus: asString(ord?.status || ""),
    hasPhysicalItem: Boolean(ord?.meta?.hasPhysicalItem),
    hasBuilderCombo: Boolean(ord?.meta?.hasBuilderCombo),
    syncedFrom: "verify_route",
    lastSyncedAt: new Date().toISOString(),
  };

  await usage.save();

  const isSuccessNow = usage.status === "success";

  if (!wasSuccess && isSuccessNow) {
    try {
      if (promoDoc?._id) {
        await PromoCode.updateOne(
          { _id: promoDoc._id },
          {
            $inc: { totalUsedCount: 1 },
            $set: { lastUsedAt: ord?.paidAt ? new Date(ord.paidAt) : new Date() },
          }
        );
      } else {
        await PromoCode.updateOne(
          { code: promoCode },
          {
            $inc: { totalUsedCount: 1 },
            $set: { lastUsedAt: ord?.paidAt ? new Date(ord.paidAt) : new Date() },
          }
        );
      }
    } catch (err) {
      console.error("PROMO_CODE_COUNT_UPDATE_FAILED:", err);
    }
  }

  return {
    skipped: false,
    code: promoCode,
    transitionedToSuccess: !wasSuccess && isSuccessNow,
  };
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
  const analyticsSnapshot = readAttributionFromRequest(req, body);

  const razorpay_order_id = asString(body?.razorpay_order_id);
  const razorpay_payment_id = asString(body?.razorpay_payment_id);
  const razorpay_signature = asString(body?.razorpay_signature);

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing razorpay fields" }, { status: 400 });
  }

  const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected = crypto.createHmac("sha256", keySecret).update(payload).digest("hex");

  if (expected !== razorpay_signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  await dbConnect();

  const ord: any = await Order.findOne({
    userId: user.id,
    paymentGateway: "razorpay",
    orderRef: razorpay_order_id,
  });

  if (!ord) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  ord.meta = ord.meta || {};
  ord.meta.analytics = {
    ...(ord.meta.analytics && typeof ord.meta.analytics === "object" ? ord.meta.analytics : {}),
    ...analyticsSnapshot,
    lastSeenAtVerify: new Date().toISOString(),
  };

  if (typeof ord.markModified === "function") {
    ord.markModified("meta");
  }

  if (ord.status === "paid") {
    await ord.save();

    try {
      await syncPromoUsageForOrder(ord, user.id);
    } catch (err) {
      console.error("PROMO_USAGE_SYNC_RETRY_FAILED:", err);
    }

    const shiprocketSync = await syncShiprocketForOrder(String(ord._id));

    return NextResponse.json(
      {
        ok: true,
        status: "paid",
        paidAt: ord.paidAt,
        expiresAt: ord.expiresAt,
        shiprocket: shiprocketSync,
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
    cache: "no-store",
  });

  const rzData: any = await rz.json().catch(() => ({}));
  if (!rz.ok) {
    return NextResponse.json(
      { error: "Razorpay fetch failed", details: rzData },
      { status: 500 }
    );
  }

  const apiOrderId = asString(rzData?.order_id);
  const apiStatus = asString(rzData?.status);

  if (apiOrderId !== razorpay_order_id) {
    return NextResponse.json({ error: "Payment does not match order" }, { status: 400 });
  }

  if (apiStatus !== "captured" && apiStatus !== "authorized") {
    ord.status = apiStatus === "failed" ? "failed" : "pending";
    ord.paymentId = razorpay_payment_id;

    if (typeof ord.markModified === "function") {
      ord.markModified("meta");
    }

    await ord.save();

    try {
      await syncPromoUsageForOrder(ord, user.id);
    } catch (err) {
      console.error("PROMO_USAGE_PENDING_SYNC_FAILED:", err);
    }

    return NextResponse.json(
      {
        ok: false,
        status: ord.status,
        message: "Payment not captured yet",
      },
      { status: 200 }
    );
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  ord.status = "paid";
  ord.paymentId = razorpay_payment_id;
  ord.paidAt = now;
  ord.expiresAt = expiresAt;

  const walletFinalization = await finalizeResellerBenefitsForPaidOrder(ord, user.id);

  ord.meta = ord.meta || {};
  ord.meta.pricing = ord.meta.pricing || {};
  ord.meta.pricing.finalizedAt = now;
  ord.meta.pricing.actualWalletDebit = roundMoney(walletFinalization.actualWalletDebit || 0);
  ord.meta.pricing.walletShortfall = roundMoney(walletFinalization.walletShortfall || 0);
  ord.meta.pricing.walletBalanceBefore = roundMoney(walletFinalization.balanceBefore || 0);
  ord.meta.pricing.walletBalanceAfter = roundMoney(walletFinalization.balanceAfter || 0);

  ord.meta.analytics = {
    ...(ord.meta.analytics && typeof ord.meta.analytics === "object" ? ord.meta.analytics : {}),
    ...analyticsSnapshot,
    paymentVerifiedAt: now.toISOString(),
    savedFrom: "razorpay_verify",
  };

  if (ord.meta?.promo && typeof ord.meta.promo === "object") {
    ord.meta.promo.paymentVerifiedAt = now.toISOString();
    ord.meta.promo.paymentVerified = true;
    ord.meta.promo.paymentId = razorpay_payment_id;
    ord.meta.promo.razorpayOrderId = razorpay_order_id;
  }

  if (typeof ord.markModified === "function") {
    ord.markModified("meta");
  }

  await ord.save();

  try {
    await syncPromoUsageForOrder(ord, user.id);
  } catch (err) {
    console.error("PROMO_USAGE_SYNC_FAILED:", err);
  }

  const shiprocketSync = await syncShiprocketForOrder(String(ord._id));

  try {
    await sendHardcopyPaidAdminPushover(String(ord._id));
  } catch (err) {
    console.error("HARDCOPY_PUSHOVER_FAILED:", err);
  }

  try {
    await sendOnDemandAdminPushover(String(ord._id));
  } catch (err) {
    console.error("ON_DEMAND_PUSHOVER_FAILED:", err);
  }

  return NextResponse.json(
    {
      ok: true,
      status: "paid",
      paidAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      shiprocket: shiprocketSync,
    },
    { status: 200 }
  );
}