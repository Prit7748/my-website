import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import ResellerConfig from "@/models/ResellerConfig";
import User from "@/models/User";
import WalletRecharge from "@/models/WalletRecharge";

export const runtime = "nodejs";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function safeList(input: any) {
  const raw = Array.isArray(input)
    ? input
    : typeof input === "string"
    ? input.split(/\r?\n/)
    : [];

  return Array.from(
    new Set(
      raw
        .map((x: any) => safeStr(x))
        .filter(Boolean)
    )
  );
}

function normalizePlacement(v: any) {
  const x = safeStr(v).toLowerCase();
  if (x === "combo_area" || x === "both") return x;
  return "home_slider_below";
}

function normalizePlanCode(v: any): "basic" | "standard" | "premium" {
  const x = safeStr(v).toLowerCase();
  if (x === "standard" || x === "premium") return x;
  return "basic";
}

function normalizeBenefitMode(v: any): "wallet_deduction" | "discount_only" | "excluded" {
  const x = safeStr(v).toLowerCase();
  if (x === "wallet_deduction" || x === "discount_only" || x === "excluded") return x;
  return "excluded";
}

function defaultConfigPayload() {
  return {
    key: "default",
    isActive: true,
    banner: {
      isActive: true,
      title: "Special Offers for Sellers",
      subtitle: "Earn more with exclusive reseller discounts and wallet benefits.",
      ctaText: "Activate Seller Wallet",
      placement: "home_slider_below",
    },
    plans: [
      {
        code: "basic",
        name: "Basic",
        price: 999,
        isActive: true,
        isHighlighted: false,
        badge: "Bronze",
        accentColor: "green",
        description: "Entry reseller plan",
        sortOrder: 1,
      },
      {
        code: "standard",
        name: "Standard",
        price: 1499,
        isActive: true,
        isHighlighted: true,
        badge: "Silver",
        accentColor: "orange",
        description: "Most recommended reseller plan",
        sortOrder: 2,
      },
      {
        code: "premium",
        name: "Premium",
        price: 1999,
        isActive: true,
        isHighlighted: false,
        badge: "Gold",
        accentColor: "violet",
        description: "Maximum reseller benefits",
        sortOrder: 3,
      },
    ],
    categoryRules: [
      {
        categoryKey: "Solved Assignments",
        categoryLabel: "Solved Assignments",
        isActive: true,
        benefitMode: "wallet_deduction",
        sortOrder: 1,
        planBenefits: [
          { planCode: "basic", discountPercent: 10, discountProductLimit: 0, walletDeductionEnabled: true },
          { planCode: "standard", discountPercent: 15, discountProductLimit: 0, walletDeductionEnabled: true },
          { planCode: "premium", discountPercent: 20, discountProductLimit: 0, walletDeductionEnabled: true },
        ],
      },
      {
        categoryKey: "Question Papers (PYQ)",
        categoryLabel: "Question Papers (PYQ)",
        isActive: true,
        benefitMode: "wallet_deduction",
        sortOrder: 2,
        planBenefits: [
          { planCode: "basic", discountPercent: 10, discountProductLimit: 0, walletDeductionEnabled: true },
          { planCode: "standard", discountPercent: 15, discountProductLimit: 0, walletDeductionEnabled: true },
          { planCode: "premium", discountPercent: 20, discountProductLimit: 0, walletDeductionEnabled: true },
        ],
      },
      {
        categoryKey: "Ebooks",
        categoryLabel: "E-books / Notes",
        isActive: true,
        benefitMode: "discount_only",
        sortOrder: 3,
        planBenefits: [
          { planCode: "basic", discountPercent: 10, discountProductLimit: 10, walletDeductionEnabled: false },
          { planCode: "standard", discountPercent: 15, discountProductLimit: 15, walletDeductionEnabled: false },
          { planCode: "premium", discountPercent: 20, discountProductLimit: 20, walletDeductionEnabled: false },
        ],
      },
      {
        categoryKey: "Guess Papers",
        categoryLabel: "Guess Papers",
        isActive: true,
        benefitMode: "discount_only",
        sortOrder: 4,
        planBenefits: [
          { planCode: "basic", discountPercent: 10, discountProductLimit: 10, walletDeductionEnabled: false },
          { planCode: "standard", discountPercent: 15, discountProductLimit: 15, walletDeductionEnabled: false },
          { planCode: "premium", discountPercent: 20, discountProductLimit: 20, walletDeductionEnabled: false },
        ],
      },
      {
        categoryKey: "Handwritten PDFs",
        categoryLabel: "Handwritten PDFs",
        isActive: true,
        benefitMode: "wallet_deduction",
        sortOrder: 5,
        planBenefits: [
          { planCode: "basic", discountPercent: 10, discountProductLimit: 0, walletDeductionEnabled: true },
          { planCode: "standard", discountPercent: 15, discountProductLimit: 0, walletDeductionEnabled: true },
          { planCode: "premium", discountPercent: 20, discountProductLimit: 0, walletDeductionEnabled: true },
        ],
      },
      {
        categoryKey: "Projects & Synopsis",
        categoryLabel: "Projects & Synopsis",
        isActive: true,
        benefitMode: "discount_only",
        sortOrder: 6,
        planBenefits: [
          { planCode: "basic", discountPercent: 10, discountProductLimit: 5, walletDeductionEnabled: false },
          { planCode: "standard", discountPercent: 15, discountProductLimit: 10, walletDeductionEnabled: false },
          { planCode: "premium", discountPercent: 20, discountProductLimit: 15, walletDeductionEnabled: false },
        ],
      },
      {
        categoryKey: "Combo",
        categoryLabel: "Combo",
        isActive: true,
        benefitMode: "excluded",
        sortOrder: 7,
        planBenefits: [
          { planCode: "basic", discountPercent: 0, discountProductLimit: 0, walletDeductionEnabled: false },
          { planCode: "standard", discountPercent: 0, discountProductLimit: 0, walletDeductionEnabled: false },
          { planCode: "premium", discountPercent: 0, discountProductLimit: 0, walletDeductionEnabled: false },
        ],
      },
      {
        categoryKey: "Handwritten Hardcopy (Delivery)",
        categoryLabel: "Handwritten Hardcopy (Delivery)",
        isActive: false,
        benefitMode: "excluded",
        sortOrder: 8,
        planBenefits: [
          { planCode: "basic", discountPercent: 0, discountProductLimit: 0, walletDeductionEnabled: false },
          { planCode: "standard", discountPercent: 0, discountProductLimit: 0, walletDeductionEnabled: false },
          { planCode: "premium", discountPercent: 0, discountProductLimit: 0, walletDeductionEnabled: false },
        ],
      },
    ],
    walletPageContent: {
      isActive: true,
      badgeText: "Seller Wallet Guide",
      sectionTitle: "How IGNOU Seller Wallet Recharge Works",
      sectionSubtitle:
        "Understand the seller wallet recharge process, wallet benefits, activation flow, and important usage rules before you recharge your seller account.",
      processTitle: "Seller wallet recharge process",
      processSteps: [
        "Choose the seller plan that matches your business requirement and click the activate or recharge button.",
        "Complete the secure payment through Razorpay using UPI, card, net banking, or other available methods.",
        "After successful payment verification, your seller plan and wallet balance are updated on your account automatically.",
        "Eligible categories start using seller benefits according to the rules configured by the admin panel.",
      ],
      benefitsTitle: "Benefits after wallet recharge",
      benefits: [
        "Seller users can access category-based wallet deduction and discount benefits where enabled by admin rules.",
        "Wallet dashboard starts showing recharge history, available balance, total used amount, and seller savings.",
        "Active seller plan identity becomes visible in the user dashboard and related seller sections.",
        "The website can apply wallet-supported seller pricing on selected categories during checkout.",
      ],
      activationTitle: "What changes after recharge",
      activationPoints: [
        "Your account can move from normal user status to active seller status after successful recharge verification.",
        "Selected seller plan benefits become available according to the current reseller configuration.",
        "Future eligible orders can use wallet balance, discount-only rules, or both based on admin settings.",
        "Seller-specific tracking values such as wallet balance, total recharge, total usage, and saved amount are updated.",
      ],
      notesTitle: "Important notes for sellers",
      notes: [
        "Wallet benefits apply only on categories and plans that are active in admin reseller settings.",
        "Some categories may be excluded, discount-only, or wallet-deduction enabled depending on business rules.",
        "If any payment is deducted but seller activation does not update automatically, admin can verify and update the account manually.",
        "Recharge amount, usage logic, and seller visibility can be changed later from the backend without coding changes.",
      ],
      ctaNote:
        "Read the full seller process carefully before recharge so you understand activation, benefits, deductions, and future plan usage clearly.",
    },
  };
}

function sanitizeBanner(input: any) {
  return {
    isActive: Boolean(input?.isActive ?? true),
    title: safeStr(input?.title || "Special Offers for Sellers"),
    subtitle: safeStr(
      input?.subtitle || "Earn more with exclusive reseller discounts and wallet benefits."
    ),
    ctaText: safeStr(input?.ctaText || "Activate Seller Wallet"),
    placement: normalizePlacement(input?.placement),
  };
}

function sanitizePlans(input: any[]) {
  const base = Array.isArray(input) ? input : [];
  const normalized = base.map((item: any, idx: number) => ({
    code: normalizePlanCode(item?.code),
    name: safeStr(item?.name || "Plan"),
    price: Math.max(0, safeNum(item?.price, 0)),
    isActive: Boolean(item?.isActive ?? true),
    isHighlighted: Boolean(item?.isHighlighted),
    badge: safeStr(item?.badge),
    accentColor: safeStr(item?.accentColor),
    description: safeStr(item?.description),
    sortOrder: safeNum(item?.sortOrder, idx + 1),
  }));

  const map = new Map<string, any>();
  for (const row of normalized) map.set(row.code, row);

  return ["basic", "standard", "premium"].map((code, idx) => {
    const existing = map.get(code);
    if (existing) return existing;
    return {
      code,
      name: code === "basic" ? "Basic" : code === "standard" ? "Standard" : "Premium",
      price: code === "basic" ? 999 : code === "standard" ? 1499 : 1999,
      isActive: true,
      isHighlighted: code === "standard",
      badge: code === "basic" ? "Bronze" : code === "standard" ? "Silver" : "Gold",
      accentColor: code === "basic" ? "green" : code === "standard" ? "orange" : "violet",
      description: "",
      sortOrder: idx + 1,
    };
  });
}

function sanitizePlanBenefits(input: any[]) {
  const base = Array.isArray(input) ? input : [];
  const map = new Map<string, any>();

  for (const item of base) {
    const code = normalizePlanCode(item?.planCode);
    map.set(code, {
      planCode: code,
      discountPercent: Math.max(0, Math.min(100, safeNum(item?.discountPercent, 0))),
      discountProductLimit: Math.max(0, safeNum(item?.discountProductLimit, 0)),
      walletDeductionEnabled: Boolean(item?.walletDeductionEnabled),
    });
  }

  return ["basic", "standard", "premium"].map((code) => {
    const row = map.get(code);
    return (
      row || {
        planCode: code,
        discountPercent: 0,
        discountProductLimit: 0,
        walletDeductionEnabled: false,
      }
    );
  });
}

function sanitizeCategoryRules(input: any[]) {
  const base = Array.isArray(input) ? input : [];
  return base.map((rule: any, idx: number) => ({
    categoryKey: safeStr(rule?.categoryKey || `Category ${idx + 1}`),
    categoryLabel: safeStr(rule?.categoryLabel || rule?.categoryKey || `Category ${idx + 1}`),
    isActive: Boolean(rule?.isActive ?? true),
    benefitMode: normalizeBenefitMode(rule?.benefitMode),
    sortOrder: safeNum(rule?.sortOrder, idx + 1),
    planBenefits: sanitizePlanBenefits(rule?.planBenefits),
  }));
}

function sanitizeWalletPageContent(input: any) {
  return {
    isActive: Boolean(input?.isActive ?? true),
    badgeText: safeStr(input?.badgeText || "Seller Wallet Guide"),
    sectionTitle: safeStr(input?.sectionTitle || "How IGNOU Seller Wallet Recharge Works"),
    sectionSubtitle: safeStr(
      input?.sectionSubtitle ||
        "Understand the seller wallet recharge process, wallet benefits, activation flow, and important usage rules before you recharge your seller account."
    ),
    processTitle: safeStr(input?.processTitle || "Seller wallet recharge process"),
    processSteps: safeList(input?.processSteps),
    benefitsTitle: safeStr(input?.benefitsTitle || "Benefits after wallet recharge"),
    benefits: safeList(input?.benefits),
    activationTitle: safeStr(input?.activationTitle || "What changes after recharge"),
    activationPoints: safeList(input?.activationPoints),
    notesTitle: safeStr(input?.notesTitle || "Important notes for sellers"),
    notes: safeList(input?.notes),
    ctaNote: safeStr(
      input?.ctaNote ||
        "Read the full seller process carefully before recharge so you understand activation, benefits, deductions, and future plan usage clearly."
    ),
  };
}

async function getStats() {
  const [activeSellerCount, pausedSellerCount, blockedSellerCount, walletAgg, rechargeAgg] =
    await Promise.all([
      User.countDocuments({ "reseller.isReseller": true, "reseller.status": "active" }),
      User.countDocuments({ "reseller.isReseller": true, "reseller.status": "paused" }),
      User.countDocuments({ "reseller.isReseller": true, "reseller.status": "blocked" }),
      User.aggregate([
        { $match: { "reseller.isReseller": true } },
        {
          $group: {
            _id: null,
            totalWalletBalance: { $sum: "$reseller.walletBalance" },
            totalWalletUsed: { $sum: "$reseller.walletTotalUsed" },
            totalDiscountSaved: { $sum: "$reseller.walletTotalDiscountSaved" },
          },
        },
      ]),
      WalletRecharge.aggregate([
        { $match: { status: "paid" } },
        {
          $group: {
            _id: null,
            totalRechargeAmount: { $sum: "$amount" },
            totalPaidRecharges: { $sum: 1 },
          },
        },
      ]),
    ]);

  const walletRow = Array.isArray(walletAgg) && walletAgg[0] ? walletAgg[0] : {};
  const rechargeRow = Array.isArray(rechargeAgg) && rechargeAgg[0] ? rechargeAgg[0] : {};

  return {
    activeSellerCount: Number(activeSellerCount || 0),
    pausedSellerCount: Number(pausedSellerCount || 0),
    blockedSellerCount: Number(blockedSellerCount || 0),
    totalWalletBalance: Number(walletRow?.totalWalletBalance || 0),
    totalWalletUsed: Number(walletRow?.totalWalletUsed || 0),
    totalDiscountSaved: Number(walletRow?.totalDiscountSaved || 0),
    totalRechargeAmount: Number(rechargeRow?.totalRechargeAmount || 0),
    totalPaidRecharges: Number(rechargeRow?.totalPaidRecharges || 0),
  };
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  await dbConnect();

  let config: any = await ResellerConfig.findOne({ key: "default" }).lean();
  if (!config) {
    config = defaultConfigPayload();
  }

  const stats = await getStats();

  return NextResponse.json(
    {
      ok: true,
      config,
      stats,
    },
    { status: 200 }
  );
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  await dbConnect();

  const body = await req.json().catch(() => ({}));

  const payload = {
    key: "default",
    isActive: Boolean(body?.isActive ?? true),
    banner: sanitizeBanner(body?.banner),
    plans: sanitizePlans(body?.plans),
    categoryRules: sanitizeCategoryRules(body?.categoryRules),
    walletPageContent: sanitizeWalletPageContent(body?.walletPageContent),
  };

  const doc =
    (await ResellerConfig.findOne({ key: "default" })) ||
    new (ResellerConfig as any)({ key: "default" });

  doc.isActive = payload.isActive;
  doc.banner = payload.banner;
  doc.plans = payload.plans;
  doc.categoryRules = payload.categoryRules;
  doc.walletPageContent = payload.walletPageContent;

  await doc.save();

  const stats = await getStats();

  return NextResponse.json(
    {
      ok: true,
      message: "Reseller settings saved successfully",
      config: doc.toObject(),
      stats,
    },
    { status: 200 }
  );
}