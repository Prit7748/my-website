import Order from "@/models/Order";
import PromoCode from "@/models/PromoCode";

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

function uniqueStrings(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean)));
}

export type PromoCartItem = {
  productId: string;
  title: string;
  category: string;
  price: number;
  quantity: number;
  itemType?: "product" | "combo";
  comboSlug?: string;
  comboCategorySlug?: string;
};

export type PromoEvaluationResult = {
  ok: boolean;
  valid: boolean;
  code: string;
  reason: string;
  discountAmount: number;
  eligibleSubtotal: number;
  cartSubtotal: number;
  finalTotal: number;
  matchedProductIds: string[];
  matchedCategories: string[];
  matchedLineKeys: string[];
  promo: {
    code: string;
    title: string;
    description: string;
    badgeText: string;
    publicNote: string;
    discountType: "percent" | "fixed";
    discountValue: number;
    maxDiscountAmount: number;
  } | null;
};

function normalizeCategoryKey(input: any) {
  const raw = safeStr(input)
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

function buildPromoLineKey(item: PromoCartItem) {
  return JSON.stringify({
    itemType: safeStr(item?.itemType || "product").toLowerCase() === "combo" ? "combo" : "product",
    productId: safeStr(item?.productId),
    category: normalizeCategoryKey(item?.category),
    price: roundMoney(item?.price || 0),
    quantity: Math.max(1, Math.trunc(safeNum(item?.quantity, 1))),
    comboSlug: safeStr(item?.comboSlug),
    comboCategorySlug: safeStr(item?.comboCategorySlug),
  });
}

function normalizeItems(items: any[]): PromoCartItem[] {
  return (Array.isArray(items) ? items : [])
    .map((it: any): PromoCartItem => {
      const itemType: "product" | "combo" =
        safeStr(it?.itemType).toLowerCase() === "combo" ? "combo" : "product";

      return {
        productId: safeStr(it?.productId || it?.id),
        title: safeStr(it?.title),
        category: safeStr(it?.category),
        price: Math.max(0, roundMoney(it?.price || 0)),
        quantity: Math.max(1, Math.trunc(safeNum(it?.quantity, 1))),
        itemType,
        comboSlug: safeStr(it?.comboSlug),
        comboCategorySlug: safeStr(it?.comboCategorySlug),
      };
    })
    .filter((it: PromoCartItem) => it.productId && it.price >= 0 && it.quantity > 0);
}

function buildResult(input: Partial<PromoEvaluationResult>): PromoEvaluationResult {
  return {
    ok: true,
    valid: Boolean(input?.valid),
    code: safeStr(input?.code).toUpperCase(),
    reason: safeStr(input?.reason),
    discountAmount: roundMoney(input?.discountAmount || 0),
    eligibleSubtotal: roundMoney(input?.eligibleSubtotal || 0),
    cartSubtotal: roundMoney(input?.cartSubtotal || 0),
    finalTotal: roundMoney(input?.finalTotal || 0),
    matchedProductIds: Array.isArray(input?.matchedProductIds) ? input.matchedProductIds : [],
    matchedCategories: Array.isArray(input?.matchedCategories) ? input.matchedCategories : [],
    matchedLineKeys: Array.isArray(input?.matchedLineKeys) ? input.matchedLineKeys : [],
    promo: input?.promo || null,
  };
}

export async function evaluatePromoCode(params: {
  coupon: string;
  items: any[];
  userId?: string;
  isReseller?: boolean;
  now?: Date;
}): Promise<PromoEvaluationResult> {
  const coupon = safeStr(params?.coupon).toUpperCase();
  const items = normalizeItems(params?.items || []);
  const userId = safeStr(params?.userId);
  const isReseller = Boolean(params?.isReseller);
  const now = params?.now instanceof Date ? params?.now : new Date();

  const cartSubtotal = roundMoney(
    items.reduce((acc, item) => acc + roundMoney(item.price * item.quantity), 0)
  );

  if (!coupon) {
    return buildResult({
      code: "",
      reason: "Promo code required",
      cartSubtotal,
      finalTotal: cartSubtotal,
    });
  }

  if (!items.length) {
    return buildResult({
      code: coupon,
      reason: "No valid cart items found",
      cartSubtotal,
      finalTotal: cartSubtotal,
    });
  }

  const promo: any = await PromoCode.findOne({ code: coupon }).lean();

  if (!promo) {
    return buildResult({
      code: coupon,
      reason: "Invalid promo code",
      cartSubtotal,
      finalTotal: cartSubtotal,
    });
  }

  const promoLite = {
    code: safeStr(promo.code).toUpperCase(),
    title: safeStr(promo.title),
    description: safeStr(promo.description),
    badgeText: safeStr(promo.badgeText),
    publicNote: safeStr(promo.publicNote),
    discountType: safeStr(promo.discountType).toLowerCase() === "fixed" ? "fixed" : "percent",
    discountValue: roundMoney(promo.discountValue || 0),
    maxDiscountAmount: roundMoney(promo.maxDiscountAmount || 0),
  } as const;

  if (!promo.isActive) {
    return buildResult({
      code: coupon,
      reason: "This promo code is inactive",
      cartSubtotal,
      finalTotal: cartSubtotal,
      promo: promoLite,
    });
  }

  if (promo.startsAt && new Date(promo.startsAt).getTime() > now.getTime()) {
    return buildResult({
      code: coupon,
      reason: "This promo code is not active yet",
      cartSubtotal,
      finalTotal: cartSubtotal,
      promo: promoLite,
    });
  }

  if (promo.endsAt && new Date(promo.endsAt).getTime() < now.getTime()) {
    return buildResult({
      code: coupon,
      reason: "This promo code has expired",
      cartSubtotal,
      finalTotal: cartSubtotal,
      promo: promoLite,
    });
  }

  if (!promo.allowResellers && isReseller) {
    return buildResult({
      code: coupon,
      reason: "This promo code is not allowed for reseller accounts",
      cartSubtotal,
      finalTotal: cartSubtotal,
      promo: promoLite,
    });
  }

  if (!promo.allowCombos && items.some((x: PromoCartItem) => x.itemType === "combo")) {
    return buildResult({
      code: coupon,
      reason: "This promo code is not applicable on combo items",
      cartSubtotal,
      finalTotal: cartSubtotal,
      promo: promoLite,
    });
  }

  const totalUsageLimit = Math.max(0, Math.trunc(safeNum(promo.totalUsageLimit, 0)));
  if (totalUsageLimit > 0) {
    const totalPaidUsageCount = await Order.countDocuments({
      coupon,
      status: "paid",
    });

    if (totalPaidUsageCount >= totalUsageLimit) {
      return buildResult({
        code: coupon,
        reason: "This promo code usage limit has been reached",
        cartSubtotal,
        finalTotal: cartSubtotal,
        promo: promoLite,
      });
    }
  }

  if (promo.firstOrderOnly) {
    if (!userId) {
      return buildResult({
        code: coupon,
        reason: "Login required for this promo code",
        cartSubtotal,
        finalTotal: cartSubtotal,
        promo: promoLite,
      });
    }

    const paidOrderCount = await Order.countDocuments({
      userId,
      status: "paid",
    });

    if (paidOrderCount > 0) {
      return buildResult({
        code: coupon,
        reason: "This promo code is only for first-time users",
        cartSubtotal,
        finalTotal: cartSubtotal,
        promo: promoLite,
      });
    }
  }

  const perUserUsageLimit = Math.max(0, Math.trunc(safeNum(promo.perUserUsageLimit, 0)));
  if (perUserUsageLimit > 0 && userId) {
    const usedByThisUser = await Order.countDocuments({
      userId,
      status: "paid",
      coupon,
    });

    if (usedByThisUser >= perUserUsageLimit) {
      return buildResult({
        code: coupon,
        reason: "You have already used this promo code the maximum number of times",
        cartSubtotal,
        finalTotal: cartSubtotal,
        promo: promoLite,
      });
    }
  }

  const minOrderAmount = roundMoney(promo.minOrderAmount || 0);
  if (minOrderAmount > 0 && cartSubtotal < minOrderAmount) {
    return buildResult({
      code: coupon,
      reason: `Minimum order amount for this promo code is ₹${minOrderAmount}`,
      cartSubtotal,
      finalTotal: cartSubtotal,
      promo: promoLite,
    });
  }

  const totalQty = items.reduce((acc, item) => acc + item.quantity, 0);
  const distinctProducts = uniqueStrings(items.map((x) => x.productId)).length;
  const distinctCategories = uniqueStrings(items.map((x) => normalizeCategoryKey(x.category))).length;

  const minCartQuantity = Math.max(0, Math.trunc(safeNum(promo.minCartQuantity, 0)));
  const minDistinctProducts = Math.max(0, Math.trunc(safeNum(promo.minDistinctProducts, 0)));
  const minDistinctCategories = Math.max(0, Math.trunc(safeNum(promo.minDistinctCategories, 0)));

  if (minCartQuantity > 0 && totalQty < minCartQuantity) {
    return buildResult({
      code: coupon,
      reason: `Minimum ${minCartQuantity} item(s) required in cart`,
      cartSubtotal,
      finalTotal: cartSubtotal,
      promo: promoLite,
    });
  }

  if (minDistinctProducts > 0 && distinctProducts < minDistinctProducts) {
    return buildResult({
      code: coupon,
      reason: `Minimum ${minDistinctProducts} different product(s) required`,
      cartSubtotal,
      finalTotal: cartSubtotal,
      promo: promoLite,
    });
  }

  if (minDistinctCategories > 0 && distinctCategories < minDistinctCategories) {
    return buildResult({
      code: coupon,
      reason: `Minimum ${minDistinctCategories} different categor(ies) required`,
      cartSubtotal,
      finalTotal: cartSubtotal,
      promo: promoLite,
    });
  }

  const allowedCategories: string[] = Array.isArray(promo.allowedCategories)
    ? uniqueStrings(promo.allowedCategories.map((x: any) => normalizeCategoryKey(x)))
    : [];

  const blockedCategories: string[] = Array.isArray(promo.blockedCategories)
    ? uniqueStrings(promo.blockedCategories.map((x: any) => normalizeCategoryKey(x)))
    : [];

  const allowedProductIds: string[] = Array.isArray(promo.allowedProductIds)
    ? uniqueStrings(promo.allowedProductIds.map((x: any) => safeStr(x)))
    : [];

  const blockedProductIds: string[] = Array.isArray(promo.blockedProductIds)
    ? uniqueStrings(promo.blockedProductIds.map((x: any) => safeStr(x)))
    : [];

  const requiredProductIds: string[] = Array.isArray(promo.requiredProductIds)
    ? uniqueStrings(promo.requiredProductIds.map((x: any) => safeStr(x)))
    : [];

  const cartCategoryQty = new Map<string, number>();
  for (const item of items) {
    const key = normalizeCategoryKey(item.category);
    cartCategoryQty.set(key, (cartCategoryQty.get(key) || 0) + item.quantity);
  }

  const requiredCategoryRules = Array.isArray(promo.requiredCategoryRules)
    ? promo.requiredCategoryRules
    : [];

  for (const rule of requiredCategoryRules) {
    const categoryKey = normalizeCategoryKey(rule?.categoryKey);
    const minQty = Math.max(1, Math.trunc(safeNum(rule?.minQty, 1)));
    const qty = cartCategoryQty.get(categoryKey) || 0;

    if (qty < minQty) {
      return buildResult({
        code: coupon,
        reason: `Required category condition not matched for ${safeStr(rule?.categoryKey) || "selected category"}`,
        cartSubtotal,
        finalTotal: cartSubtotal,
        promo: promoLite,
      });
    }
  }

  if (requiredProductIds.length > 0) {
    const cartProductIds = new Set(items.map((x) => safeStr(x.productId)));
    const missingRequiredProductIds = requiredProductIds.filter(
      (id: string) => !cartProductIds.has(id)
    );

    if (missingRequiredProductIds.length > 0) {
      return buildResult({
        code: coupon,
        reason: "All required products must be present in cart for this promo code",
        cartSubtotal,
        finalTotal: cartSubtotal,
        promo: promoLite,
      });
    }
  }

  const eligibleItems = items.filter((item: PromoCartItem) => {
    const categoryKey = normalizeCategoryKey(item.category);
    const productId = safeStr(item.productId);

    if (allowedCategories.length > 0 && !allowedCategories.includes(categoryKey)) return false;
    if (blockedCategories.length > 0 && blockedCategories.includes(categoryKey)) return false;
    if (allowedProductIds.length > 0 && !allowedProductIds.includes(productId)) return false;
    if (blockedProductIds.length > 0 && blockedProductIds.includes(productId)) return false;

    return true;
  });

  const eligibleSubtotal = roundMoney(
    eligibleItems.reduce((acc, item) => acc + roundMoney(item.price * item.quantity), 0)
  );

  if (eligibleItems.length === 0 || eligibleSubtotal <= 0) {
    return buildResult({
      code: coupon,
      reason: "This promo code is not applicable on selected cart items",
      cartSubtotal,
      finalTotal: cartSubtotal,
      promo: promoLite,
    });
  }

  let discountAmount = 0;

  if (promoLite.discountType === "fixed") {
    discountAmount = roundMoney(promoLite.discountValue);
  } else {
    discountAmount = roundMoney((eligibleSubtotal * promoLite.discountValue) / 100);
  }

  if (promoLite.maxDiscountAmount > 0) {
    discountAmount = Math.min(discountAmount, promoLite.maxDiscountAmount);
  }

  discountAmount = Math.min(discountAmount, eligibleSubtotal, cartSubtotal);
  discountAmount = roundMoney(Math.max(0, discountAmount));

  if (discountAmount <= 0) {
    return buildResult({
      code: coupon,
      reason: "This promo code does not produce any discount on current cart",
      cartSubtotal,
      finalTotal: cartSubtotal,
      promo: promoLite,
    });
  }

  const finalTotal = roundMoney(Math.max(0, cartSubtotal - discountAmount));
  const matchedProductIds = uniqueStrings(eligibleItems.map((x) => safeStr(x.productId)));
  const matchedCategories = uniqueStrings(
    eligibleItems.map((x) => normalizeCategoryKey(x.category))
  );
  const matchedLineKeys = uniqueStrings(eligibleItems.map((x) => buildPromoLineKey(x)));

  return buildResult({
    code: coupon,
    valid: true,
    reason: "",
    discountAmount,
    eligibleSubtotal,
    cartSubtotal,
    finalTotal,
    matchedProductIds,
    matchedCategories,
    matchedLineKeys,
    promo: promoLite,
  });
}