export const SELLER_MIN_ACTIVE_WALLET_BALANCE = 10;

export type ResellerPublicSnapshot = {
  isReseller: boolean;
  status: "inactive" | "active" | "paused" | "blocked";
  planCode: "" | "basic" | "standard" | "premium";
  planName: string;
  walletBalance: number;
  walletTotalRecharged: number;
  walletTotalUsed: number;
  walletTotalDiscountSaved: number;
  lastRechargeAt: string | null;
  planActivatedAt: string | null;
  sellerBenefitsActive: boolean;
  minimumActiveWalletBalance: number;
};

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

function safeDateIso(x: any) {
  if (!x) return null;
  try {
    return new Date(x).toISOString();
  } catch {
    return null;
  }
}

export function normalizePlanCode(input: any): "" | "basic" | "standard" | "premium" {
  const v = safeStr(input).toLowerCase();
  if (v === "basic" || v === "standard" || v === "premium") return v;
  return "";
}

export function normalizeResellerStatus(
  input: any
): "inactive" | "active" | "paused" | "blocked" {
  const v = safeStr(input).toLowerCase();
  if (v === "active" || v === "paused" || v === "blocked") return v;
  return "inactive";
}

export function getWalletBalance(userLike: any) {
  return Math.max(0, roundMoney(userLike?.reseller?.walletBalance || 0));
}

export function canUseWalletCredit(userLike: any) {
  return getWalletBalance(userLike) > 0;
}

export function isSellerBenefitsActive(userLike: any) {
  const reseller = userLike?.reseller || {};
  const isReseller = Boolean(reseller?.isReseller);
  const status = normalizeResellerStatus(reseller?.status);
  const planCode = normalizePlanCode(reseller?.planCode);
  const walletBalance = getWalletBalance(userLike);

  return (
    isReseller &&
    status === "active" &&
    !!planCode &&
    walletBalance >= SELLER_MIN_ACTIVE_WALLET_BALANCE
  );
}

export function applySellerLowBalanceRule(userDoc: any) {
  if (!userDoc || typeof userDoc !== "object") return userDoc;

  if (!userDoc.reseller || typeof userDoc.reseller !== "object") {
    userDoc.reseller = {};
  }

  userDoc.reseller.walletBalance = getWalletBalance(userDoc);

  if (
    Boolean(userDoc.reseller.isReseller) &&
    userDoc.reseller.walletBalance < SELLER_MIN_ACTIVE_WALLET_BALANCE
  ) {
    userDoc.reseller.status = "inactive";
  }

  return userDoc;
}

export function getPublicResellerSnapshot(userLike: any): ResellerPublicSnapshot {
  const reseller = userLike?.reseller || {};

  const isReseller = Boolean(reseller?.isReseller);
  const status = normalizeResellerStatus(reseller?.status);
  const planCode = normalizePlanCode(reseller?.planCode);
  const walletBalance = getWalletBalance(userLike);
  const sellerBenefitsActive =
    isReseller &&
    status === "active" &&
    !!planCode &&
    walletBalance >= SELLER_MIN_ACTIVE_WALLET_BALANCE;

  return {
    isReseller,
    status,
    planCode,
    planName: safeStr(reseller?.planName),
    walletBalance,
    walletTotalRecharged: Math.max(0, safeNum(reseller?.walletTotalRecharged, 0)),
    walletTotalUsed: Math.max(0, safeNum(reseller?.walletTotalUsed, 0)),
    walletTotalDiscountSaved: Math.max(0, safeNum(reseller?.walletTotalDiscountSaved, 0)),
    lastRechargeAt: safeDateIso(reseller?.lastRechargeAt),
    planActivatedAt: safeDateIso(reseller?.planActivatedAt),
    sellerBenefitsActive,
    minimumActiveWalletBalance: SELLER_MIN_ACTIVE_WALLET_BALANCE,
  };
}

export function isActiveReseller(userLike: any) {
  return isSellerBenefitsActive(userLike);
}

export function getResellerPlanTheme(planCode: any) {
  const code = normalizePlanCode(planCode);

  if (code === "basic") {
    return {
      capsuleClass: "bg-green-50 text-green-800 border-green-200",
      glowClass: "shadow-green-100",
      label: "Basic Seller",
    };
  }

  if (code === "standard") {
    return {
      capsuleClass: "bg-orange-50 text-orange-800 border-orange-200",
      glowClass: "shadow-orange-100",
      label: "Standard Seller",
    };
  }

  if (code === "premium") {
    return {
      capsuleClass: "bg-violet-50 text-violet-800 border-violet-200",
      glowClass: "shadow-violet-100",
      label: "Premium Seller",
    };
  }

  return {
    capsuleClass: "bg-blue-50 text-blue-800 border-blue-200",
    glowClass: "shadow-blue-100",
    label: "My Account",
  };
}