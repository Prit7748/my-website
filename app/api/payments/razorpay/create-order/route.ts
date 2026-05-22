import { NextResponse } from "next/server";
import crypto from "crypto";
import dbConnect from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { evaluatePromoCode } from "@/lib/promoEngine";
import Product from "@/models/Product";
import Combo from "@/models/Combo";
import Order from "@/models/Order";
import GlobalToggle from "@/models/GlobalToggle";
import User from "@/models/User";
import WalletLedger from "@/models/WalletLedger";
import ResellerConfig from "@/models/ResellerConfig";
import ComboCategorySetting from "@/models/ComboCategorySetting";
import PromoCode from "@/models/PromoCode";
import PromoCodeUsage from "@/models/PromoCodeUsage";
import HardcopyTemplateConfig, {
  HARDCOPY_TEMPLATE_CONFIG_KEY,
} from "@/models/HardcopyTemplateConfig";
import { applySellerLowBalanceRule, isSellerBenefitsActive } from "@/lib/reseller";
import {
  sendHardcopyPaidAdminPushover,
  sendOnDemandAdminPushover,
} from "@/lib/orderNotifications";
import { syncShiprocketForOrder } from "@/lib/shiprocket";

export const runtime = "nodejs";

function asString(x: any) {
  return String(x ?? "").trim();
}

function asNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function safeBool(x: any, def = false) {
  if (typeof x === "boolean") return x;
  if (typeof x === "number") return x === 1;

  const v = asString(x).toLowerCase();

  if (["true", "1", "yes", "on"].includes(v)) return true;
  if (["false", "0", "no", "off"].includes(v)) return false;

  return def;
}

function roundMoney(x: any) {
  const n = asNum(x, 0);
  return Math.round(n * 100) / 100;
}

function safeArr(x: any) {
  return Array.isArray(x) ? x : [];
}

function uniqueStrings(arr: any[]) {
  return Array.from(
    new Set(
      safeArr(arr)
        .map((x: any) => asString(x))
        .filter(Boolean)
    )
  );
}

function normalizeComboItems(items: any[]) {
  return safeArr(items)
    .map((item: any) => ({
      title: asString(item?.title),
      subtitle: asString(item?.subtitle),
    }))
    .filter((x: any) => x.title);
}

function rndReceipt() {
  return `rcpt_${crypto.randomBytes(8).toString("hex")}`;
}

function rndWalletRef() {
  return `wallet_${crypto.randomBytes(8).toString("hex")}`;
}

function normAvail(v?: string) {
  return asString(v).toLowerCase();
}

async function getComingSoonSalesEnabled() {
  try {
    const doc: any = await GlobalToggle.findOne({ key: "coming_soon_sales" }).lean();
    if (!doc) return true;
    return Boolean(doc.enabled);
  } catch {
    return true;
  }
}

function resolveAvailability(rawAvailability: string, comingSoonSalesEnabled: boolean) {
  const a = normAvail(rawAvailability);

  if (
    a === "outofstock" ||
    a === "out-of-stock" ||
    a === "want_to_buy" ||
    a === "wanttobuy"
  ) {
    return "out_of_stock";
  }

  if (a === "available" || a === "in_stock" || a === "instock") return "available";

  if (
    a === "coming_soon" ||
    a === "comingsoon" ||
    a === "coming-soon" ||
    a === "on_demand" ||
    a === "ondemand" ||
    a === "on-demand"
  ) {
    return comingSoonSalesEnabled ? "coming_soon" : "out_of_stock";
  }

  return a || "available";
}

function isBlockedForPurchase(effectiveAvailability: string) {
  const a = normAvail(effectiveAvailability);
  return a === "out_of_stock" || a === "outofstock" || a === "out-of-stock";
}

function normalizeCategoryKey(input: any) {
  const raw = asString(input)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[()]/g, " ")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (raw.includes("solved") && raw.includes("assignment")) return "solved assignments";
  if (raw.includes("question") || raw.includes("pyq")) return "question papers pyq";
  if (raw.includes("guess")) return "guess papers";
  if (raw.includes("ebook") || raw.includes("e book") || raw.includes("notes")) return "ebooks";
  if (raw.includes("hardcopy")) return "handwritten hardcopy";
  if (raw.includes("handwritten") && raw.includes("pdf")) return "handwritten pdfs";
  if (raw.includes("project")) return "projects synopsis";
  if (raw.includes("combo")) return "combo";

  return raw;
}

function normalizeCategoryLabelFromSlug(slug: string) {
  const s = asString(slug).toLowerCase();

  if (s === "solved-assignments") return "Solved Assignments";
  if (s === "question-papers") return "Question Papers (PYQ)";
  if (s === "guess-papers") return "Guess Papers";
  if (s === "ebooks-notes") return "eBooks/Notes";
  if (s === "handwritten-pdfs") return "Handwritten PDFs";
  if (s === "handwritten-hardcopy") return "Handwritten Hardcopy (Delivery)";
  if (s === "projects-synopsis") return "Projects & Synopsis";

  return "";
}

function computeDiscountedPrice(total: number, discountType: string, discountValue: number) {
  const t = Math.max(0, Number(total || 0));
  const d = Math.max(0, Number(discountValue || 0));
  const type = asString(discountType).toLowerCase();

  if (type === "flat") {
    return Math.max(0, Math.round(t - d));
  }

  return Math.max(0, Math.round(t * (1 - d / 100)));
}

function sessionSortValue(session6: string, session: string) {
  const s6 = asString(session6);
  if (/^\d{6}$/.test(s6)) return Number(s6);

  const raw = asString(session).toUpperCase();
  const m = raw.match(/(JUN|JUNE|DEC|DECEMBER)[\s\-]*(\d{2,4})/i);

  if (m) {
    const monRaw = m[1].toUpperCase();
    const yyRaw = m[2];
    const year = yyRaw.length === 2 ? Number(`20${yyRaw}`) : Number(yyRaw);
    const mm = monRaw.startsWith("JUN") ? 6 : 12;
    return year * 100 + mm;
  }

  const nums = raw.replace(/\D/g, "");
  if (nums.length >= 6) return Number(nums.slice(0, 6));
  if (nums.length === 4) return Number(`${nums}00`);

  return 0;
}

function buildGeneratedComboTitle(categoryLabel: string, selectedProducts: any[], medium: string) {
  const subjectCodes = uniqueStrings(
    selectedProducts.map((x: any) => asString(x.subjectCode).toUpperCase())
  );

  const courseCodes = uniqueStrings(
    selectedProducts.flatMap((x: any) =>
      safeArr(x.courseCodes).map((c: any) => asString(c).toUpperCase())
    )
  );

  if (subjectCodes.length === 1 && medium) {
    return `${subjectCodes[0]} ${medium} Custom Combo`.replace(/\s+/g, " ").trim();
  }

  if (subjectCodes.length === 1) {
    return `${subjectCodes[0]} ${categoryLabel} Custom Combo`.replace(/\s+/g, " ").trim();
  }

  if (courseCodes.length === 1) {
    return `${courseCodes[0]} ${categoryLabel} Custom Combo`.replace(/\s+/g, " ").trim();
  }

  return `${categoryLabel} Custom Combo (${selectedProducts.length} Items)`;
}

function buildBuilderBadge(discountType: string, discountValue: number, selectedCount: number) {
  if (asString(discountType).toLowerCase() === "flat") {
    return `Save ₹${Number(discountValue || 0)}`;
  }

  if (Number(discountValue || 0) > 0) {
    return `Save ${Number(discountValue || 0)}%`;
  }

  return `${selectedCount} Items`;
}

function buildPromoLineKey(item: any) {
  return JSON.stringify({
    itemType: asString(item?.itemType || "product").toLowerCase() === "combo" ? "combo" : "product",
    productId: asString(item?.productId),
    category: normalizeCategoryKey(item?.category),
    price: roundMoney(item?.payableUnitPrice ?? item?.price ?? 0),
    quantity: Math.max(1, asNum(item?.quantity, 1)),
    comboSlug: asString(item?.comboSlug),
    comboCategorySlug: asString(item?.comboCategorySlug),
  });
}

function isHardcopyOrderItem(item: any) {
  const category = asString(item?.category).toLowerCase();
  const comboCategorySlug = asString(item?.comboCategorySlug).toLowerCase();
  const title = asString(item?.title).toLowerCase();

  return (
    category.includes("handwritten hardcopy") ||
    category.includes("hardcopy") ||
    comboCategorySlug.includes("handwritten-hardcopy") ||
    title.includes("hardcopy") ||
    title.includes("delivery")
  );
}

async function getHardcopyDeliverySettings() {
  const DEFAULTS = {
    deliveryChargeEnabled: false,
    deliveryChargeThresholdAmount: 1000,
    deliveryChargeAmount: 100,
    deliveryChargeLabel: "Delivery Charge",
    freeDeliveryLabel: "Free Delivery",
  };

  try {
    const doc: any = await HardcopyTemplateConfig.findOne({
      key: HARDCOPY_TEMPLATE_CONFIG_KEY,
    })
      .select(
        "deliveryChargeEnabled deliveryChargeThresholdAmount deliveryChargeAmount deliveryChargeLabel freeDeliveryLabel"
      )
      .lean();

    return {
      deliveryChargeEnabled: safeBool(
        doc?.deliveryChargeEnabled,
        DEFAULTS.deliveryChargeEnabled
      ),
      deliveryChargeThresholdAmount: Math.max(
        0,
        roundMoney(doc?.deliveryChargeThresholdAmount ?? DEFAULTS.deliveryChargeThresholdAmount)
      ),
      deliveryChargeAmount: Math.max(
        0,
        roundMoney(doc?.deliveryChargeAmount ?? DEFAULTS.deliveryChargeAmount)
      ),
      deliveryChargeLabel: asString(doc?.deliveryChargeLabel || DEFAULTS.deliveryChargeLabel),
      freeDeliveryLabel: asString(doc?.freeDeliveryLabel || DEFAULTS.freeDeliveryLabel),
    };
  } catch {
    return DEFAULTS;
  }
}

function getDefaultResellerConfig() {
  return {
    isActive: true,
    plans: [
      { code: "basic", name: "Basic" },
      { code: "standard", name: "Standard" },
      { code: "premium", name: "Premium" },
    ],
    categoryRules: [
      {
        categoryKey: "Solved Assignments",
        benefitMode: "wallet_deduction",
        isActive: true,
        planBenefits: [
          {
            planCode: "basic",
            discountPercent: 10,
            discountProductLimit: 0,
            walletDeductionEnabled: true,
          },
          {
            planCode: "standard",
            discountPercent: 15,
            discountProductLimit: 0,
            walletDeductionEnabled: true,
          },
          {
            planCode: "premium",
            discountPercent: 20,
            discountProductLimit: 0,
            walletDeductionEnabled: true,
          },
        ],
      },
      {
        categoryKey: "Question Papers (PYQ)",
        benefitMode: "wallet_deduction",
        isActive: true,
        planBenefits: [
          {
            planCode: "basic",
            discountPercent: 10,
            discountProductLimit: 0,
            walletDeductionEnabled: true,
          },
          {
            planCode: "standard",
            discountPercent: 15,
            discountProductLimit: 0,
            walletDeductionEnabled: true,
          },
          {
            planCode: "premium",
            discountPercent: 20,
            discountProductLimit: 0,
            walletDeductionEnabled: true,
          },
        ],
      },
      {
        categoryKey: "Ebooks",
        benefitMode: "discount_only",
        isActive: true,
        planBenefits: [
          {
            planCode: "basic",
            discountPercent: 10,
            discountProductLimit: 10,
            walletDeductionEnabled: false,
          },
          {
            planCode: "standard",
            discountPercent: 15,
            discountProductLimit: 15,
            walletDeductionEnabled: false,
          },
          {
            planCode: "premium",
            discountPercent: 20,
            discountProductLimit: 20,
            walletDeductionEnabled: false,
          },
        ],
      },
      {
        categoryKey: "Guess Papers",
        benefitMode: "discount_only",
        isActive: true,
        planBenefits: [
          {
            planCode: "basic",
            discountPercent: 10,
            discountProductLimit: 10,
            walletDeductionEnabled: false,
          },
          {
            planCode: "standard",
            discountPercent: 15,
            discountProductLimit: 15,
            walletDeductionEnabled: false,
          },
          {
            planCode: "premium",
            discountPercent: 20,
            discountProductLimit: 20,
            walletDeductionEnabled: false,
          },
        ],
      },
    ],
  };
}

function mapFromUsage(raw: any) {
  const out = new Map<string, number>();
  const obj =
    raw && typeof raw?.toObject === "function"
      ? raw.toObject()
      : raw && typeof raw === "object"
      ? raw
      : {};

  for (const [k, v] of Object.entries(obj || {})) {
    const key = normalizeCategoryKey(k);
    out.set(key, Math.max(0, asNum(v, 0)));
  }

  return out;
}

function mapToObject(map: Map<string, number>) {
  const obj: Record<string, number> = {};

  for (const [k, v] of map.entries()) {
    obj[k] = Math.max(0, asNum(v, 0));
  }

  return obj;
}

function buildRuleMap(config: any) {
  const map = new Map<string, any>();
  const rules = Array.isArray(config?.categoryRules) ? config.categoryRules : [];

  for (const rule of rules) {
    const key = normalizeCategoryKey(rule?.categoryKey || rule?.categoryLabel);
    if (!key) continue;
    map.set(key, rule);
  }

  return map;
}

function getPlanMeta(config: any, planCode: string) {
  const plans = Array.isArray(config?.plans) ? config.plans : [];

  const found = plans.find(
    (x: any) => asString(x?.code).toLowerCase() === asString(planCode).toLowerCase()
  );

  return {
    planCode: asString(found?.code || planCode).toLowerCase(),
    planName: asString(found?.name || planCode),
  };
}

function getPlanBenefit(rule: any, planCode: string) {
  const list = Array.isArray(rule?.planBenefits) ? rule.planBenefits : [];

  return (
    list.find(
      (x: any) => asString(x?.planCode).toLowerCase() === asString(planCode).toLowerCase()
    ) || null
  );
}

function buildGroupKey(item: any) {
  return JSON.stringify({
    itemType: item.itemType,
    productId: item.productId,
    title: item.title,
    category: item.category,
    price: item.price,
    originalPrice: item.originalPrice,
    payableUnitPrice: item.payableUnitPrice,
    discountPercent: item.discountPercent,
    pricingMode: item.pricingMode,
    comboSlug: item.comboSlug,
    comboCategorySlug: item.comboCategorySlug,
    comboBuilderProductIds: uniqueStrings(item?.comboBuilderProductIds || []).sort(),
    resellerPlanCode: item.resellerPlanCode,
  });
}

function mergeGroupedItem(store: Map<string, any>, item: any) {
  const key = buildGroupKey(item);
  const existing = store.get(key);

  if (!existing) {
    store.set(key, {
      ...item,
      quantity: Math.max(1, asNum(item.quantity, 1)),
      discountAmount: roundMoney(item.discountAmount || 0),
      walletDebitAmount: roundMoney(item.walletDebitAmount || 0),
      payableAmount: roundMoney(item.payableAmount || 0),
      comboBuilderProductIds: uniqueStrings(item?.comboBuilderProductIds || []),
    });
    return;
  }

  existing.quantity += Math.max(1, asNum(item.quantity, 1));
  existing.discountAmount = roundMoney(
    existing.discountAmount + roundMoney(item.discountAmount || 0)
  );
  existing.walletDebitAmount = roundMoney(
    existing.walletDebitAmount + roundMoney(item.walletDebitAmount || 0)
  );
  existing.payableAmount = roundMoney(
    existing.payableAmount + roundMoney(item.payableAmount || 0)
  );
  existing.comboBuilderProductIds = uniqueStrings([
    ...(existing.comboBuilderProductIds || []),
    ...(item?.comboBuilderProductIds || []),
  ]);

  store.set(key, existing);
}

function applyPromoDiscountToOrderItems(
  orderItems: any[],
  promoDiscountAmount: number,
  matchedLineKeys: string[]
) {
  const promoDiscount = roundMoney(Math.max(0, promoDiscountAmount || 0));
  const keySet = new Set(
    (Array.isArray(matchedLineKeys) ? matchedLineKeys : []).map((x) => asString(x))
  );

  if (promoDiscount <= 0) {
    return {
      items: orderItems,
      appliedPromoDiscount: 0,
    };
  }

  const eligibleIndexes = orderItems
    .map((item: any, idx: number) => ({
      idx,
      payableAmount: roundMoney(item?.payableAmount || 0),
      lineKey: buildPromoLineKey(item),
    }))
    .filter((x: any) => {
      if (x.payableAmount <= 0) return false;
      if (keySet.size === 0) return true;
      return keySet.has(x.lineKey);
    });

  const eligiblePayableBase = roundMoney(
    eligibleIndexes.reduce((acc: number, x: any) => acc + roundMoney(x.payableAmount || 0), 0)
  );

  if (eligiblePayableBase <= 0) {
    return {
      items: orderItems,
      appliedPromoDiscount: 0,
    };
  }

  let remaining = Math.min(promoDiscount, eligiblePayableBase);
  const updatedItems = orderItems.map((item: any) => ({ ...item }));

  eligibleIndexes.forEach((entry: any, pos: number) => {
    const oldItem = updatedItems[entry.idx];
    const lineBase = roundMoney(oldItem?.payableAmount || 0);

    if (lineBase <= 0 || remaining <= 0) return;

    let linePromo =
      pos === eligibleIndexes.length - 1
        ? remaining
        : roundMoney((promoDiscount * lineBase) / eligiblePayableBase);

    linePromo = Math.min(linePromo, lineBase, remaining);
    remaining = roundMoney(remaining - linePromo);

    const qty = Math.max(1, asNum(oldItem?.quantity, 1));
    const newPayableAmount = roundMoney(Math.max(0, lineBase - linePromo));
    const newPayableUnitPrice = roundMoney(newPayableAmount / qty);

    updatedItems[entry.idx] = {
      ...oldItem,
      payableAmount: newPayableAmount,
      payableUnitPrice: newPayableUnitPrice,
    };
  });

  const finalApplied = roundMoney(
    eligiblePayableBase -
      eligibleIndexes.reduce((acc: number, entry: any) => {
        return acc + roundMoney(updatedItems[entry.idx]?.payableAmount || 0);
      }, 0)
  );

  return {
    items: updatedItems,
    appliedPromoDiscount: finalApplied,
  };
}

function applyWalletCreditToOrderItems(orderItems: any[], walletAvailable: number) {
  const usableWallet = roundMoney(Math.max(0, walletAvailable || 0));

  if (usableWallet <= 0) {
    return {
      items: orderItems,
      appliedWalletDebit: 0,
    };
  }

  const eligibleIndexes = orderItems
    .map((item: any, idx: number) => ({
      idx,
      payableAmount: roundMoney(item?.payableAmount || 0),
    }))
    .filter((x: any) => x.payableAmount > 0);

  const eligiblePayableBase = roundMoney(
    eligibleIndexes.reduce((acc: number, x: any) => acc + roundMoney(x.payableAmount || 0), 0)
  );

  if (eligiblePayableBase <= 0) {
    return {
      items: orderItems,
      appliedWalletDebit: 0,
    };
  }

  const walletToApply = Math.min(usableWallet, eligiblePayableBase);
  let remaining = roundMoney(walletToApply);
  const updatedItems = orderItems.map((item: any) => ({ ...item }));

  eligibleIndexes.forEach((entry: any, pos: number) => {
    const oldItem = updatedItems[entry.idx];
    const lineBase = roundMoney(oldItem?.payableAmount || 0);

    if (lineBase <= 0 || remaining <= 0) return;

    let lineWallet =
      pos === eligibleIndexes.length - 1
        ? remaining
        : roundMoney((walletToApply * lineBase) / eligiblePayableBase);

    lineWallet = Math.min(lineWallet, lineBase, remaining);
    remaining = roundMoney(remaining - lineWallet);

    const qty = Math.max(1, asNum(oldItem?.quantity, 1));
    const prevWalletDebit = roundMoney(oldItem?.walletDebitAmount || 0);
    const newPayableAmount = roundMoney(Math.max(0, lineBase - lineWallet));
    const newPayableUnitPrice = roundMoney(newPayableAmount / qty);

    updatedItems[entry.idx] = {
      ...oldItem,
      walletDebitAmount: roundMoney(prevWalletDebit + lineWallet),
      payableAmount: newPayableAmount,
      payableUnitPrice: newPayableUnitPrice,
    };
  });

  const appliedWalletDebit = roundMoney(
    eligiblePayableBase -
      eligibleIndexes.reduce((acc: number, entry: any) => {
        return acc + roundMoney(updatedItems[entry.idx]?.payableAmount || 0);
      }, 0)
  );

  return {
    items: updatedItems,
    appliedWalletDebit,
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
    comboBuilderProductIds: uniqueStrings(item?.comboBuilderProductIds || []),
  }));
}

async function upsertPromoUsageRecord(params: {
  promoCode: string;
  promoMeta?: any;
  promoCodeId?: any;
  orderDoc: any;
  status: "pending" | "success" | "failed" | "cancelled";
  paymentGateway?: string;
  paymentId?: string;
}) {
  const promoCode = asString(params?.promoCode).toUpperCase();

  if (!promoCode) {
    return { ok: false, transitionedToSuccess: false };
  }

  const orderDoc = params.orderDoc;

  if (!orderDoc?._id) {
    return { ok: false, transitionedToSuccess: false };
  }

  const promoMeta =
    params?.promoMeta && typeof params?.promoMeta === "object" ? params.promoMeta : {};

  let usage: any = await PromoCodeUsage.findOne({
    orderId: orderDoc._id,
    code: promoCode,
  });

  const wasSuccess = usage?.status === "success";

  if (!usage) {
    usage = new PromoCodeUsage();
  }

  usage.promoCodeId = params?.promoCodeId || usage.promoCodeId || null;
  usage.promoCode = promoCode;
  usage.code = promoCode;
  usage.title = asString(promoMeta?.title || usage?.title || "");
  usage.userId = orderDoc.userId || null;
  usage.userEmail = asString(orderDoc.userEmail || "");
  usage.orderId = orderDoc._id;
  usage.orderRef = asString(orderDoc.orderRef || "");
  usage.orderStatus = asString(orderDoc.status || "");
  usage.paymentGateway = asString(params?.paymentGateway || orderDoc.paymentGateway || "");
  usage.paymentId = asString(params?.paymentId || orderDoc.paymentId || "");
  usage.status = params.status;
  usage.discountAmount = roundMoney(
    orderDoc?.meta?.pricing?.promoDiscountAmount || promoMeta?.discountAmount || 0
  );
  usage.appliedOnAmount = roundMoney(
    promoMeta?.eligibleSubtotal ||
      orderDoc?.meta?.pricing?.payableAmountBeforePromo ||
      orderDoc?.originalAmount ||
      0
  );
  usage.originalAmount = roundMoney(orderDoc?.originalAmount || 0);
  usage.payableAmount = roundMoney(orderDoc?.payableAmount || orderDoc?.totalAmount || 0);
  usage.totalAmount = roundMoney(orderDoc?.totalAmount || orderDoc?.payableAmount || 0);
  usage.currency = asString(orderDoc?.currency || "INR");
  usage.itemsSnapshot = buildPromoItemsSnapshot(orderDoc?.items || []);
  usage.meta = {
    ...(usage?.meta && typeof usage.meta === "object" ? usage.meta : {}),
    promo: promoMeta || null,
    orderStatus: asString(orderDoc?.status || ""),
    hasPhysicalItem: Boolean(orderDoc?.meta?.hasPhysicalItem),
    hasBuilderCombo: Boolean(orderDoc?.meta?.hasBuilderCombo),
    lastSyncedAt: new Date().toISOString(),
  };

  await usage.save();

  const isSuccessNow = usage.status === "success";
  const transitionedToSuccess = !wasSuccess && isSuccessNow;

  return {
    ok: true,
    transitionedToSuccess,
  };
}

async function incrementPromoSuccessCounter(
  promoCodeId: any,
  promoCode: string,
  usedAt = new Date()
) {
  try {
    if (promoCodeId) {
      await PromoCode.updateOne(
        { _id: promoCodeId },
        {
          $inc: { totalUsedCount: 1 },
          $set: { lastUsedAt: usedAt },
        }
      );
      return;
    }

    await PromoCode.updateOne(
      { code: asString(promoCode).toUpperCase() },
      {
        $inc: { totalUsedCount: 1 },
        $set: { lastUsedAt: usedAt },
      }
    );
  } catch (err) {
    console.error("PROMO_COUNTER_INCREMENT_FAILED:", err);
  }
}

async function applyWalletAndUsageForWalletOnlyOrder({
  userId,
  orderId,
  orderRef,
  plannedWalletDebit,
  plannedDiscountUsage,
  discountTotal,
  planCode,
  planName,
}: {
  userId: string;
  orderId: string;
  orderRef: string;
  plannedWalletDebit: number;
  plannedDiscountUsage: Record<string, number>;
  discountTotal: number;
  planCode: string;
  planName: string;
}) {
  const userDoc: any = await User.findById(userId);
  if (!userDoc) return { actualWalletDebit: 0, walletShortfall: plannedWalletDebit };

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
    (userDoc.reseller.walletTotalDiscountSaved || 0) + roundMoney(discountTotal || 0)
  );

  const currentUsage =
    userDoc.reseller.discountUsageByCategory &&
    typeof userDoc.reseller.discountUsageByCategory === "object"
      ? userDoc.reseller.discountUsageByCategory
      : {};

  for (const [catKey, qty] of Object.entries(plannedDiscountUsage || {})) {
    const prev = asNum(
      typeof currentUsage?.get === "function" ? currentUsage.get(catKey) : currentUsage?.[catKey],
      0
    );
    const next = Math.max(0, prev + asNum(qty, 0));

    if (typeof currentUsage?.set === "function") {
      currentUsage.set(catKey, next);
    } else {
      currentUsage[catKey] = next;
    }
  }

  userDoc.reseller.discountUsageByCategory = currentUsage;
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
      planCode: asString(planCode).toLowerCase(),
      planName: asString(planName),
      orderId,
      orderRef,
      note: "Wallet debit for wallet-only order",
      meta: {
        pricingMode: "wallet_only",
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

export async function POST(req: Request) {
  const authUser = await getAuthUser();

  if (!authUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const keyId = asString(process.env.RAZORPAY_KEY_ID);
  const keySecret = asString(process.env.RAZORPAY_KEY_SECRET);

  const body = await req.json().catch(() => ({}));

  const singleProductId = asString(body?.productId);
  const bodyItems = Array.isArray(body?.items) ? body.items : [];
  const requestedCoupon = asString(body?.coupon).toUpperCase();

  const requestedItems =
    bodyItems.length > 0
      ? bodyItems
          .map((it: any) => ({
            productId: asString(it?.productId || it?.id),
            quantity: Math.max(1, asNum(it?.quantity, 1)),
            itemType: asString(it?.itemType || "product").toLowerCase(),

            comboSlug: asString(it?.comboSlug),
            comboCategorySlug: asString(it?.comboCategorySlug).toLowerCase(),
            comboBadge: asString(it?.comboBadge),
            comboSaveLabel: asString(it?.comboSaveLabel),
            comboMediumLabel: asString(it?.comboMediumLabel),
            comboSessionLabel: asString(it?.comboSessionLabel),
            comboBuilderProductIds: uniqueStrings(it?.comboBuilderProductIds),
            comboItems: normalizeComboItems(it?.comboItems),

            title: asString(it?.title),
            price: Math.max(0, asNum(it?.price, 0)),
            category: asString(it?.category),
          }))
          .filter((it: any) => it.productId)
      : singleProductId
      ? [{ productId: singleProductId, quantity: 1, itemType: "product" }]
      : [];

  if (requestedItems.length === 0) {
    return NextResponse.json({ error: "No valid items/productId provided" }, { status: 400 });
  }

  await dbConnect();

  const comingSoonSalesEnabled = await getComingSoonSalesEnabled();

  const productRequests = requestedItems.filter((x: any) => x.itemType !== "combo");
  const comboRequests = requestedItems.filter((x: any) => x.itemType === "combo");
  const builderComboRequests = comboRequests.filter((x: any) => !x.comboSlug);

  const productIds = uniqueStrings([
    ...productRequests.map((x: any) => x.productId),
    ...builderComboRequests.flatMap((x: any) => x.comboBuilderProductIds || []),
  ]);

  const comboSlugs = uniqueStrings(comboRequests.map((x: any) => x.comboSlug).filter(Boolean));

  const builderCategorySlugs = uniqueStrings(
    builderComboRequests.map((x: any) => x.comboCategorySlug).filter(Boolean)
  );

  const [
    resellerConfigDoc,
    currentUserDoc,
    productDocs,
    comboDocs,
    builderSettingDocs,
    hardcopyDeliverySettings,
  ] = await Promise.all([
    ResellerConfig.findOne({ key: "default", isActive: true }).lean().catch(() => null),
    User.findById(authUser.id).select("email reseller").lean(),
    productIds.length
      ? Product.find({
          _id: { $in: productIds },
          $or: [{ isActive: true }, { isActive: { $exists: false } }],
        })
          .select(
            "title category price isActive pdfKey availability subjectCode courseCodes session session6 language"
          )
          .lean()
      : Promise.resolve([]),
    comboSlugs.length
      ? Combo.find({
          slug: { $in: comboSlugs },
          isActive: true,
          status: "active",
          $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
        })
          .select(
            "title slug categorySlug badge saveLabel mediumLabel sessionLabel offerPrice itemsSnapshot"
          )
          .lean()
      : Promise.resolve([]),
    builderCategorySlugs.length
      ? ComboCategorySetting.find({
          categorySlug: { $in: builderCategorySlugs },
          isActive: true,
          comboEnabled: true,
          makeOwnComboEnabled: true,
        }).lean()
      : Promise.resolve([]),
    getHardcopyDeliverySettings(),
  ]);

  const resellerConfig = resellerConfigDoc || getDefaultResellerConfig();
  const ruleMap = buildRuleMap(resellerConfig);

  const userReseller: any = currentUserDoc?.reseller || {};
  const sellerBenefitsActive = isSellerBenefitsActive(currentUserDoc);
  const resellerPlanCode = sellerBenefitsActive
    ? asString(userReseller?.planCode).toLowerCase()
    : "";
  const planMeta = getPlanMeta(resellerConfig, resellerPlanCode);
  const runningUsage = mapFromUsage(userReseller?.discountUsageByCategory);
  const plannedDiscountUsage = new Map<string, number>();
  const walletBalanceBefore = roundMoney(userReseller?.walletBalance || 0);
  let availableWallet = walletBalanceBefore;

  const byProductId = new Map<string, any>();
  for (const p of productDocs as any[]) byProductId.set(String(p._id), p);

  const byComboSlug = new Map<string, any>();
  for (const c of comboDocs as any[]) byComboSlug.set(String(c.slug), c);

  const byBuilderCategorySlug = new Map<string, any>();
  for (const s of builderSettingDocs as any[]) {
    byBuilderCategorySlug.set(asString(s?.categorySlug).toLowerCase(), s);
  }

  const missingIds: string[] = [];

  const blockedItems: Array<{
    productId: string;
    title: string;
    rawAvailability: string;
    effectiveAvailability: string;
    reason: string;
  }> = [];

  const groupedItems = new Map<string, any>();

  for (const reqItem of requestedItems) {
    const qty = Math.max(1, asNum(reqItem.quantity, 1));

    if (reqItem.itemType === "combo") {
      const comboSlug = asString(reqItem.comboSlug);
      const isBuilderCombo = !comboSlug;

      if (!isBuilderCombo) {
        const comboDoc: any = comboSlug ? byComboSlug.get(comboSlug) : null;

        if (!comboDoc) {
          missingIds.push(comboSlug || reqItem.productId);
          continue;
        }

        const comboTitle = asString(comboDoc?.title || "Combo");
        const comboPrice = roundMoney(comboDoc?.offerPrice || 0);

        if (!Number.isFinite(comboPrice) || comboPrice <= 0) {
          return NextResponse.json(
            { error: `Invalid combo price for ${comboTitle || "combo"}` },
            { status: 400 }
          );
        }

        const comboCategorySlug = asString(comboDoc?.categorySlug);

        const comboItems = Array.isArray(comboDoc?.itemsSnapshot)
          ? comboDoc.itemsSnapshot.map((x: any) => ({
              title: asString(x?.title),
              subtitle:
                [asString(x?.medium), asString(x?.session), asString(x?.subjectCode)]
                  .filter(Boolean)
                  .join(" • ") || "",
            }))
          : [];

        if (!comboCategorySlug) {
          return NextResponse.json({ error: "Combo category missing" }, { status: 400 });
        }

        if (!Array.isArray(comboItems) || comboItems.length === 0) {
          return NextResponse.json({ error: "Combo items snapshot missing" }, { status: 400 });
        }

        mergeGroupedItem(groupedItems, {
          itemType: "combo",
          productId: asString(reqItem.productId || (comboSlug ? `combo:${comboSlug}` : "")),
          title: comboTitle,
          category: "Combo",

          price: comboPrice,
          quantity: qty,

          originalPrice: comboPrice,
          payableUnitPrice: comboPrice,
          discountPercent: 0,
          discountAmount: 0,
          walletDebitAmount: 0,
          payableAmount: roundMoney(comboPrice * qty),
          pricingMode: "combo",
          resellerPlanCode: "",
          resellerPlanName: "",

          pdfKey: "",
          comboSlug,
          comboCategorySlug,
          comboBadge: asString(comboDoc?.badge || reqItem.comboBadge),
          comboSaveLabel: asString(comboDoc?.saveLabel || reqItem.comboSaveLabel),
          comboMediumLabel: asString(comboDoc?.mediumLabel || reqItem.comboMediumLabel),
          comboSessionLabel: asString(comboDoc?.sessionLabel || reqItem.comboSessionLabel),
          isBuilderCombo: false,
          comboBuilderProductIds: [],
          comboItems,
        });

        continue;
      }

      const comboCategorySlug = asString(reqItem.comboCategorySlug).toLowerCase();
      const builderSetting: any = byBuilderCategorySlug.get(comboCategorySlug);

      if (!comboCategorySlug || !builderSetting) {
        return NextResponse.json(
          { error: "Builder combo is not enabled for selected category" },
          { status: 400 }
        );
      }

      const expectedCategoryLabel =
        asString(builderSetting?.categoryLabel) ||
        normalizeCategoryLabelFromSlug(comboCategorySlug);

      if (!expectedCategoryLabel) {
        return NextResponse.json({ error: "Invalid builder combo category" }, { status: 400 });
      }

      const builderRules =
        builderSetting?.builderRules && typeof builderSetting.builderRules === "object"
          ? builderSetting.builderRules
          : {};

      const minProductsRequired = Math.max(
        0,
        Math.trunc(asNum(builderRules?.minProductsRequired, 0))
      );
      const maxProductsAllowed = Math.max(
        0,
        Math.trunc(asNum(builderRules?.maxProductsAllowed, 0))
      );
      const sameSubjectOnly = Boolean(builderRules?.sameSubjectOnly);
      const sameMediumOnly = Boolean(builderRules?.sameMediumOnly);

      const builderProductIds = uniqueStrings(reqItem.comboBuilderProductIds);

      if (builderProductIds.length === 0) {
        return NextResponse.json(
          { error: "Builder combo product selection missing" },
          { status: 400 }
        );
      }

      if (minProductsRequired > 0 && builderProductIds.length < minProductsRequired) {
        return NextResponse.json(
          { error: `Minimum ${minProductsRequired} products required for this builder combo` },
          { status: 400 }
        );
      }

      if (maxProductsAllowed > 0 && builderProductIds.length > maxProductsAllowed) {
        return NextResponse.json(
          { error: `Maximum ${maxProductsAllowed} products allowed for this builder combo` },
          { status: 400 }
        );
      }

      const builderProducts: any[] = [];

      for (const id of builderProductIds) {
        const p: any = byProductId.get(id);

        if (!p) {
          missingIds.push(id);
          continue;
        }

        builderProducts.push(p);
      }

      if (builderProducts.length !== builderProductIds.length) {
        continue;
      }

      for (const p of builderProducts) {
        const rawAvailability = asString(p?.availability || "");
        const effectiveAvailability = resolveAvailability(rawAvailability, comingSoonSalesEnabled);

        if (isBlockedForPurchase(effectiveAvailability)) {
          blockedItems.push({
            productId: String(p._id),
            title: asString(p.title || "Product"),
            rawAvailability,
            effectiveAvailability,
            reason: normAvail(rawAvailability).includes("coming")
              ? "coming_soon_sales_toggle_off"
              : "out_of_stock",
          });
          continue;
        }

        if (asString(p.category) !== expectedCategoryLabel) {
          return NextResponse.json(
            { error: "Builder combo contains product from invalid category" },
            { status: 400 }
          );
        }

        const basePrice = roundMoney(p.price || 0);

        if (!Number.isFinite(basePrice) || basePrice <= 0) {
          return NextResponse.json(
            { error: `Invalid product price for ${asString(p.title || "product")}` },
            { status: 400 }
          );
        }
      }

      if (blockedItems.length > 0) {
        continue;
      }

      if (sameSubjectOnly) {
        const subjectCodes = uniqueStrings(
          builderProducts.map((p: any) => asString(p.subjectCode).toUpperCase())
        );

        if (subjectCodes.length > 1) {
          return NextResponse.json(
            { error: "Builder combo same subject rule failed" },
            { status: 400 }
          );
        }
      }

      if (sameMediumOnly) {
        const mediums = uniqueStrings(builderProducts.map((p: any) => asString(p.language)));

        if (mediums.length > 1) {
          return NextResponse.json(
            { error: "Builder combo same medium rule failed" },
            { status: 400 }
          );
        }
      }

      const totalMrp = roundMoney(
        builderProducts.reduce((acc: number, p: any) => acc + roundMoney(p.price || 0), 0)
      );

      const offerPrice = roundMoney(
        computeDiscountedPrice(
          totalMrp,
          asString(builderSetting?.discountType || "percent"),
          asNum(builderSetting?.discountValue, 0)
        )
      );

      if (!Number.isFinite(offerPrice) || offerPrice <= 0) {
        return NextResponse.json(
          { error: "Invalid builder combo price generated" },
          { status: 400 }
        );
      }

      const mediums = uniqueStrings(builderProducts.map((p: any) => asString(p.language)));
      const detectedMedium = mediums.length === 1 ? mediums[0] : "";

      const sortedBySession = [...builderProducts].sort(
        (a: any, b: any) =>
          sessionSortValue(asString(b.session6), asString(b.session)) -
          sessionSortValue(asString(a.session6), asString(a.session))
      );

      const firstSession = asString(sortedBySession[0]?.session);
      const lastSession = asString(sortedBySession[sortedBySession.length - 1]?.session);

      const detectedSessionLabel =
        firstSession && lastSession && firstSession !== lastSession
          ? `${firstSession} to ${lastSession}`
          : firstSession || "";

      const generatedTitle = buildGeneratedComboTitle(
        expectedCategoryLabel,
        builderProducts,
        detectedMedium
      );

      const comboItems = builderProducts.map((p: any) => ({
        title: asString(p.title),
        subtitle: [asString(p.subjectCode).toUpperCase(), asString(p.language), asString(p.session)]
          .filter(Boolean)
          .join(" • "),
      }));

      const saveAmount = Math.max(0, roundMoney(totalMrp - offerPrice));

      mergeGroupedItem(groupedItems, {
        itemType: "combo",
        productId:
          asString(reqItem.productId) ||
          `builder-combo:${comboCategorySlug}:${builderProductIds.join("-")}`,
        title: generatedTitle,
        category: "Combo",

        price: offerPrice,
        quantity: qty,

        originalPrice: offerPrice,
        payableUnitPrice: offerPrice,
        discountPercent: 0,
        discountAmount: 0,
        walletDebitAmount: 0,
        payableAmount: roundMoney(offerPrice * qty),
        pricingMode: "combo",
        resellerPlanCode: "",
        resellerPlanName: "",

        pdfKey: "",
        comboSlug: "",
        comboCategorySlug,
        comboBadge: buildBuilderBadge(
          asString(builderSetting?.discountType || "percent"),
          asNum(builderSetting?.discountValue, 0),
          builderProducts.length
        ),
        comboSaveLabel:
          saveAmount > 0
            ? asString(builderSetting?.discountType).toLowerCase() === "flat"
              ? `Save ₹${Number(builderSetting?.discountValue || 0)}`
              : `Save ${Number(builderSetting?.discountValue || 0)}%`
            : "",
        comboMediumLabel: detectedMedium,
        comboSessionLabel: detectedSessionLabel,
        isBuilderCombo: true,
        comboBuilderProductIds: builderProductIds,
        comboItems,
      });

      continue;
    }

    const p: any = byProductId.get(reqItem.productId);

    if (!p) {
      missingIds.push(reqItem.productId);
      continue;
    }

    const rawAvailability = asString(p.availability || "");
    const effectiveAvailability = resolveAvailability(rawAvailability, comingSoonSalesEnabled);

    if (isBlockedForPurchase(effectiveAvailability)) {
      blockedItems.push({
        productId: String(p._id),
        title: asString(p.title || "Product"),
        rawAvailability,
        effectiveAvailability,
        reason: normAvail(rawAvailability).includes("coming")
          ? "coming_soon_sales_toggle_off"
          : "out_of_stock",
      });
      continue;
    }

    const basePrice = roundMoney(p.price || 0);

    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      return NextResponse.json(
        { error: `Invalid product price for ${asString(p.title || "product")}` },
        { status: 400 }
      );
    }

    const normalizedCategory = normalizeCategoryKey(p.category);
    const rule = sellerBenefitsActive ? ruleMap.get(normalizedCategory) : null;
    const planBenefit =
      sellerBenefitsActive && rule ? getPlanBenefit(rule, resellerPlanCode) : null;

    for (let i = 0; i < qty; i += 1) {
      let discountPercent = 0;
      let unitDiscountAmount = 0;
      let finalUnitPrice = basePrice;
      let unitWalletDebit = 0;
      let payableUnitPrice = basePrice;
      let pricingMode: "regular" | "discount_only" | "wallet_deduction" = "regular";

      if (sellerBenefitsActive && rule?.isActive && planBenefit) {
        const mode = asString(rule?.benefitMode).toLowerCase();

        if (mode === "wallet_deduction" && Boolean(planBenefit?.walletDeductionEnabled)) {
          discountPercent = Math.max(0, Math.min(100, asNum(planBenefit?.discountPercent, 0)));
          unitDiscountAmount = roundMoney((basePrice * discountPercent) / 100);
          finalUnitPrice = roundMoney(basePrice - unitDiscountAmount);
          unitWalletDebit = roundMoney(Math.min(availableWallet, finalUnitPrice));
          availableWallet = roundMoney(availableWallet - unitWalletDebit);
          payableUnitPrice = roundMoney(finalUnitPrice - unitWalletDebit);
          pricingMode = "wallet_deduction";
        } else if (mode === "discount_only") {
          const currentUsed = Math.max(0, asNum(runningUsage.get(normalizedCategory), 0));
          const limit = Math.max(0, asNum(planBenefit?.discountProductLimit, 0));

          if (currentUsed < limit) {
            discountPercent = Math.max(0, Math.min(100, asNum(planBenefit?.discountPercent, 0)));
            unitDiscountAmount = roundMoney((basePrice * discountPercent) / 100);
            finalUnitPrice = roundMoney(basePrice - unitDiscountAmount);
            payableUnitPrice = finalUnitPrice;
            pricingMode = "discount_only";

            runningUsage.set(normalizedCategory, currentUsed + 1);
            plannedDiscountUsage.set(
              normalizedCategory,
              Math.max(0, asNum(plannedDiscountUsage.get(normalizedCategory), 0) + 1)
            );
          }
        }
      }

      mergeGroupedItem(groupedItems, {
        itemType: "product",
        productId: String(p._id),
        title: asString(p.title || ""),
        category: asString(p.category || ""),

        price: finalUnitPrice,
        quantity: 1,

        originalPrice: basePrice,
        payableUnitPrice,
        discountPercent,
        discountAmount: unitDiscountAmount,
        walletDebitAmount: unitWalletDebit,
        payableAmount: payableUnitPrice,
        pricingMode,
        resellerPlanCode: sellerBenefitsActive ? planMeta.planCode : "",
        resellerPlanName: sellerBenefitsActive ? planMeta.planName : "",

        pdfKey: asString(p.pdfKey || ""),

        comboSlug: "",
        comboCategorySlug: "",
        comboBadge: "",
        comboSaveLabel: "",
        comboMediumLabel: "",
        comboSessionLabel: "",
        isBuilderCombo: false,
        comboBuilderProductIds: [],
        comboItems: [],
      });
    }
  }

  if (missingIds.length > 0) {
    return NextResponse.json(
      { error: "Some products/combos not found or inactive", missingIds },
      { status: 404 }
    );
  }

  if (blockedItems.length > 0) {
    return NextResponse.json(
      {
        error: "Some products are not available for purchase right now",
        code: "PRODUCTS_BLOCKED",
        comingSoonSalesEnabled,
        blockedItems,
      },
      { status: 409 }
    );
  }

  let orderItems = Array.from(groupedItems.values());

  if (orderItems.length === 0) {
    return NextResponse.json({ error: "No purchasable items found" }, { status: 400 });
  }

  const actualHasPhysicalItem = orderItems.some((item: any) => isHardcopyOrderItem(item));

  if (actualHasPhysicalItem) {
    const shipping = body?.shipping && typeof body.shipping === "object" ? body.shipping : null;

    if (!asString(shipping?.address) || !asString(shipping?.pincode) || !asString(shipping?.city)) {
      return NextResponse.json(
        { error: "Shipping address is required for physical items" },
        { status: 400 }
      );
    }
  }

  const originalAmount = roundMoney(
    orderItems.reduce((acc: number, item: any) => {
      return acc + roundMoney(item.originalPrice || 0) * Math.max(1, asNum(item.quantity, 1));
    }, 0)
  );

  const discountAmount = roundMoney(
    orderItems.reduce((acc: number, item: any) => acc + roundMoney(item.discountAmount || 0), 0)
  );

  const sellerWalletDebitPlanned = roundMoney(
    orderItems.reduce((acc: number, item: any) => acc + roundMoney(item.walletDebitAmount || 0), 0)
  );

  const payableAmountBeforePromo = roundMoney(
    orderItems.reduce((acc: number, item: any) => acc + roundMoney(item.payableAmount || 0), 0)
  );

  let appliedCoupon = "";
  let promoDiscountAmount = 0;
  let promoMeta: any = null;
  let promoDocLite: any = null;

  if (requestedCoupon) {
    const promoEval = await evaluatePromoCode({
      coupon: requestedCoupon,
      items: orderItems.map((item: any) => ({
        productId: asString(item.productId),
        title: asString(item.title),
        category: asString(item.category),
        price: roundMoney(item.payableUnitPrice || item.payableAmount || 0),
        quantity: Math.max(1, asNum(item.quantity, 1)),
        itemType: asString(item.itemType).toLowerCase() === "combo" ? "combo" : "product",
        comboSlug: asString(item.comboSlug),
        comboCategorySlug: asString(item.comboCategorySlug),
        comboBuilderProductIds: uniqueStrings(item?.comboBuilderProductIds || []),
      })),
      userId: asString(authUser.id),
      isReseller: Boolean(userReseller?.isReseller),
    });

    if (!promoEval.valid) {
      return NextResponse.json(
        {
          error: promoEval.reason || "Invalid promo code",
          code: "INVALID_PROMO_CODE",
          promo: promoEval.promo,
        },
        { status: 400 }
      );
    }

    promoDocLite = await PromoCode.findOne({ code: requestedCoupon })
      .select("_id code title")
      .lean()
      .catch(() => null);

    const promoApplied = applyPromoDiscountToOrderItems(
      orderItems,
      promoEval.discountAmount,
      Array.isArray(promoEval.matchedLineKeys) ? promoEval.matchedLineKeys : []
    );

    orderItems = promoApplied.items;
    promoDiscountAmount = roundMoney(promoApplied.appliedPromoDiscount);
    appliedCoupon = requestedCoupon;
    promoMeta = {
      code: asString(promoEval?.promo?.code || requestedCoupon).toUpperCase(),
      title: asString(promoEval?.promo?.title || promoDocLite?.title),
      description: asString(promoEval?.promo?.description),
      badgeText: asString(promoEval?.promo?.badgeText),
      publicNote: asString(promoEval?.promo?.publicNote),
      discountType:
        asString(promoEval?.promo?.discountType).toLowerCase() === "fixed" ? "fixed" : "percent",
      discountValue: roundMoney(promoEval?.promo?.discountValue || 0),
      maxDiscountAmount: roundMoney(promoEval?.promo?.maxDiscountAmount || 0),
      eligibleSubtotal: roundMoney(promoEval?.eligibleSubtotal || 0),
      matchedProductIds: Array.isArray(promoEval?.matchedProductIds)
        ? promoEval.matchedProductIds
        : [],
      matchedCategories: Array.isArray(promoEval?.matchedCategories)
        ? promoEval.matchedCategories
        : [],
      matchedLineKeys: Array.isArray(promoEval?.matchedLineKeys)
        ? promoEval.matchedLineKeys
        : [],
      discountAmount: promoDiscountAmount,
    };
  }

  let genericWalletDebitPlanned = 0;

  if (availableWallet > 0) {
    const genericWalletApply = applyWalletCreditToOrderItems(orderItems, availableWallet);
    orderItems = genericWalletApply.items;
    genericWalletDebitPlanned = roundMoney(genericWalletApply.appliedWalletDebit);
    availableWallet = roundMoney(availableWallet - genericWalletDebitPlanned);
  }

  const hardcopySubtotalAmount = roundMoney(
    orderItems.reduce((acc: number, item: any) => {
      if (!isHardcopyOrderItem(item)) return acc;

      const lineAmount =
        roundMoney(item?.payableAmount || 0) + roundMoney(item?.walletDebitAmount || 0);

      return acc + roundMoney(lineAmount);
    }, 0)
  );

  const deliveryChargeConfiguredAmount = roundMoney(
    hardcopyDeliverySettings?.deliveryChargeAmount || 0
  );
  const deliveryChargeThresholdAmount = roundMoney(
    hardcopyDeliverySettings?.deliveryChargeThresholdAmount || 0
  );
  const deliveryChargeEnabled = Boolean(hardcopyDeliverySettings?.deliveryChargeEnabled);

  const deliveryChargeBaseAmount =
    actualHasPhysicalItem &&
    deliveryChargeEnabled &&
    hardcopySubtotalAmount > 0 &&
    hardcopySubtotalAmount < deliveryChargeThresholdAmount
      ? deliveryChargeConfiguredAmount
      : 0;

  const deliveryChargeWalletDebitPlanned = roundMoney(
    Math.min(availableWallet, deliveryChargeBaseAmount)
  );

  availableWallet = roundMoney(availableWallet - deliveryChargeWalletDebitPlanned);

  const deliveryChargePayableAmount = roundMoney(
    deliveryChargeBaseAmount - deliveryChargeWalletDebitPlanned
  );

  const plannedWalletDebit = roundMoney(
    orderItems.reduce((acc: number, item: any) => acc + roundMoney(item.walletDebitAmount || 0), 0) +
      deliveryChargeWalletDebitPlanned
  );

  const itemsPayableAmount = roundMoney(
    orderItems.reduce((acc: number, item: any) => acc + roundMoney(item.payableAmount || 0), 0)
  );

  const payableAmount = roundMoney(itemsPayableAmount + deliveryChargePayableAmount);

  const pricingSummary = {
    resellerApplied: sellerBenefitsActive && (discountAmount > 0 || sellerWalletDebitPlanned > 0),
    sellerBenefitsActive,
    resellerPlanCode: sellerBenefitsActive ? planMeta.planCode : "",
    resellerPlanName: sellerBenefitsActive ? planMeta.planName : "",
    originalAmount,
    discountAmount,
    sellerWalletDebitPlanned,
    genericWalletDebitPlanned,
    hardcopySubtotalAmount,
    deliveryChargeEnabled,
    deliveryChargeThresholdAmount,
    deliveryChargeConfiguredAmount,
    deliveryChargeAppliedAmount: roundMoney(deliveryChargeBaseAmount),
    deliveryChargeWalletDebitPlanned,
    deliveryChargePayableAmount,
    plannedWalletDebit,
    payableAmountBeforePromo,
    promoApplied: promoDiscountAmount > 0,
    promoCode: appliedCoupon,
    promoDiscountAmount,
    payableAmount,
    walletUsageMode:
      plannedWalletDebit > 0
        ? payableAmount <= 0
          ? "wallet_only"
          : "combined"
        : "gateway_only",
    walletBalanceBefore,
    walletBalanceAfterEstimate: roundMoney(Math.max(0, walletBalanceBefore - plannedWalletDebit)),
    discountUsageToApply: mapToObject(plannedDiscountUsage),
  };

  const commonOrderPayload: any = {
    userId: authUser.id,
    userEmail: asString(currentUserDoc?.email || authUser.email || ""),
    items: orderItems,
    originalAmount,
    discountAmount,
    walletDebitAmount: plannedWalletDebit,
    hardcopySubtotalAmount,
    deliveryChargeAmount: deliveryChargePayableAmount,
    payableAmount,
    totalAmount: payableAmount,
    currency: "INR",
    coupon: appliedCoupon,
    customer: body?.customer || null,
    shipping: actualHasPhysicalItem ? body?.shipping || null : null,
    meta: {
      hasPhysicalItem: actualHasPhysicalItem,
      comingSoonSalesEnabled,
      hasComboItem: orderItems.some((x: any) => x.itemType === "combo"),
      hasBuilderCombo: orderItems.some((x: any) => x.isBuilderCombo === true),
      pricing: {
        ...pricingSummary,
        finalizedAt: null,
        actualWalletDebit: 0,
        walletShortfall: 0,
      },
      promo: promoMeta,
    },
  };

  if (payableAmount <= 0) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    const walletOrderRef = rndWalletRef();

    const orderDoc: any = await Order.create({
      ...commonOrderPayload,
      status: "paid",
      paymentGateway: "wallet",
      paymentId: "wallet_internal",
      orderRef: walletOrderRef,
      paidAt: now,
      expiresAt,
    });

    const walletApply = await applyWalletAndUsageForWalletOnlyOrder({
      userId: authUser.id,
      orderId: String(orderDoc._id),
      orderRef: walletOrderRef,
      plannedWalletDebit,
      plannedDiscountUsage: pricingSummary.discountUsageToApply,
      discountTotal: discountAmount,
      planCode: planMeta.planCode,
      planName: planMeta.planName,
    });

    await Order.updateOne(
      { _id: orderDoc._id },
      {
        $set: {
          "meta.pricing.finalizedAt": new Date(),
          "meta.pricing.actualWalletDebit": roundMoney(walletApply.actualWalletDebit || 0),
          "meta.pricing.walletShortfall": roundMoney(walletApply.walletShortfall || 0),
          "meta.pricing.walletBalanceBefore": roundMoney(walletApply.balanceBefore || 0),
          "meta.pricing.walletBalanceAfter": roundMoney(walletApply.balanceAfter || 0),
        },
      }
    );

    if (appliedCoupon) {
      const usageSync = await upsertPromoUsageRecord({
        promoCode: appliedCoupon,
        promoMeta,
        promoCodeId: promoDocLite?._id || null,
        orderDoc: {
          ...(orderDoc.toObject?.() || orderDoc),
          status: "paid",
          paymentGateway: "wallet",
          paymentId: "wallet_internal",
        },
        status: "success",
        paymentGateway: "wallet",
        paymentId: "wallet_internal",
      });

      if (usageSync.transitionedToSuccess) {
        await incrementPromoSuccessCounter(promoDocLite?._id || null, appliedCoupon, now);
      }
    }

    const shiprocketSync = await syncShiprocketForOrder(String(orderDoc._id));

    try {
      await sendHardcopyPaidAdminPushover(String(orderDoc._id));
    } catch (err) {
      console.error("HARDCOPY_PUSHOVER_WALLET_FAILED:", err);
    }

    try {
      await sendOnDemandAdminPushover(String(orderDoc._id));
    } catch (err) {
      console.error("ON_DEMAND_PUSHOVER_WALLET_FAILED:", err);
    }

    return NextResponse.json(
      {
        ok: true,
        paymentMode: "wallet_only",
        amount: 0,
        currency: "INR",
        orderId: String(orderDoc._id),
        orderRef: walletOrderRef,
        pricingSummary,
        promo: promoMeta,
        shiprocket: shiprocketSync,
      },
      { status: 200 }
    );
  }

  if (!keyId || !keySecret) {
    return NextResponse.json({ error: "Razorpay env missing" }, { status: 500 });
  }

  const amount = Math.round(payableAmount * 100);
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
        userId: asString(authUser.id),
        email: asString(authUser.email || ""),
        itemCount: String(orderItems.length),
        resellerPlan: asString(planMeta.planCode || ""),
        promoCode: appliedCoupon,
        walletDebit: String(plannedWalletDebit),
        hardcopySubtotalAmount: String(hardcopySubtotalAmount),
        deliveryChargeAmount: String(deliveryChargePayableAmount),
      },
    }),
    cache: "no-store",
  });

  const rzData: any = await rz.json().catch(() => ({}));

  if (!rz.ok) {
    return NextResponse.json(
      { error: "Razorpay order create failed", details: rzData },
      { status: 500 }
    );
  }

  const orderDoc: any = await Order.create({
    ...commonOrderPayload,
    status: "pending",
    paymentGateway: "razorpay",
    orderRef: asString(rzData.id || ""),
    paymentId: "",
    paidAt: null,
    expiresAt: null,
  });

  if (appliedCoupon) {
    await upsertPromoUsageRecord({
      promoCode: appliedCoupon,
      promoMeta,
      promoCodeId: promoDocLite?._id || null,
      orderDoc,
      status: "pending",
      paymentGateway: "razorpay",
      paymentId: "",
    });
  }

  return NextResponse.json(
    {
      ok: true,
      paymentMode: "razorpay",
      keyId,
      razorpayKeyId: keyId,
      razorpayOrderId: rzData.id,
      amount,
      currency,
      receipt,
      orderId: orderDoc._id.toString(),
      orderRef: asString(rzData.id || ""),
      pricingSummary,
      promo: promoMeta,
    },
    { status: 200 }
  );
}