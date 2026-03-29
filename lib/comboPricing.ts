// lib/comboPricing.ts
export type ComboPricingItem = {
  price?: number;
};

export type ComboPricingInput = {
  discountType?: "percent" | "flat" | string;
  discountValue?: number;
  roundOfferPrice?: boolean;
};

export type MasterCategoryDiscountInput = {
  discountValue?: number;
  roundOfferPrice?: boolean;
};

export type ComboPricingResult = {
  totalMrp: number;
  offerPrice: number;
  saveAmount: number;
  savePercent: number;
  priceLabel: string;
  saveLabel: string;
  pricingSnapshot: {
    discountType: "percent" | "flat";
    discountValue: number;
  };
};

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

export function normalizeDiscountType(x: any): "percent" | "flat" {
  const v = String(x ?? "").trim().toLowerCase();
  if (v === "flat") return "flat";
  return "percent";
}

export function normalizePercentDiscountValue(x: any) {
  return Math.max(0, Math.min(100, safeNum(x, 0)));
}

export function hasValidMasterDiscountPercent(x: any) {
  const n = normalizePercentDiscountValue(x);
  return n > 0 && n <= 100;
}

export function calculateComboPricing(
  items: ComboPricingItem[],
  input: ComboPricingInput = {}
): ComboPricingResult {
  const rows = Array.isArray(items) ? items : [];

  const totalMrp = Math.max(
    0,
    rows.reduce((sum, item) => sum + Math.max(0, safeNum(item?.price, 0)), 0)
  );

  const discountType = normalizeDiscountType(input.discountType);
  const discountValue = Math.max(0, safeNum(input.discountValue, 0));
  const roundOfferPrice = input.roundOfferPrice !== false;

  let rawOfferPrice = totalMrp;

  if (discountType === "percent") {
    const pct = Math.min(100, discountValue);
    rawOfferPrice = totalMrp * (1 - pct / 100);
  } else {
    rawOfferPrice = totalMrp - discountValue;
  }

  const offerPrice = Math.max(
    0,
    roundOfferPrice ? Math.round(rawOfferPrice) : Number(rawOfferPrice.toFixed(2))
  );

  const saveAmount = Math.max(
    0,
    roundOfferPrice ? totalMrp - offerPrice : Number((totalMrp - offerPrice).toFixed(2))
  );

  const savePercent =
    totalMrp > 0 ? Math.max(0, Math.min(100, Math.round((saveAmount / totalMrp) * 100))) : 0;

  return {
    totalMrp,
    offerPrice,
    saveAmount,
    savePercent,
    priceLabel: offerPrice > 0 ? `₹${offerPrice}` : "",
    saveLabel: savePercent > 0 ? `Save ${savePercent}%` : "",
    pricingSnapshot: {
      discountType,
      discountValue,
    },
  };
}

export function calculateComboPricingFromMasterDiscount(
  items: ComboPricingItem[],
  input: MasterCategoryDiscountInput = {}
): ComboPricingResult {
  return calculateComboPricing(items, {
    discountType: "percent",
    discountValue: normalizePercentDiscountValue(input.discountValue),
    roundOfferPrice: input.roundOfferPrice !== false,
  });
}