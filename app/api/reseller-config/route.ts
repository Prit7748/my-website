import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ResellerConfig from "@/models/ResellerConfig";

export const runtime = "nodejs";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function safeList(input: any, fallback: string[] = []) {
  const raw = Array.isArray(input) ? input : fallback;
  return Array.from(
    new Set(
      raw
        .map((x: any) => safeStr(x))
        .filter(Boolean)
    )
  );
}

function normalizePlanCode(v: any): "basic" | "standard" | "premium" {
  const x = safeStr(v).toLowerCase();
  if (x === "standard" || x === "premium") return x;
  return "basic";
}

function normalizePlacement(v: any): "home_slider_below" | "combo_area" | "both" {
  const x = safeStr(v).toLowerCase();
  if (x === "combo_area" || x === "both") return x;
  return "home_slider_below";
}

function normalizeBenefitMode(v: any): "wallet_deduction" | "discount_only" | "excluded" {
  const x = safeStr(v).toLowerCase();
  if (x === "wallet_deduction" || x === "discount_only" || x === "excluded") return x;
  return "excluded";
}

function getDefaultConfig() {
  return {
    isActive: true,
    banner: {
      isActive: true,
      title: "Special Offers for Sellers",
      subtitle: "Earn more with exclusive reseller discounts and wallet benefits.",
      ctaText: "Activate Seller Wallet",
      placement: "home_slider_below" as const,
    },
    plans: [
      {
        code: "basic" as const,
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
        code: "standard" as const,
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
        code: "premium" as const,
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
        benefitMode: "wallet_deduction" as const,
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
        benefitMode: "wallet_deduction" as const,
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
        benefitMode: "discount_only" as const,
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
        benefitMode: "discount_only" as const,
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
        benefitMode: "wallet_deduction" as const,
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
        benefitMode: "discount_only" as const,
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
        benefitMode: "excluded" as const,
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
        benefitMode: "excluded" as const,
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

export async function GET() {
  await dbConnect();

  const raw: any = await ResellerConfig.findOne({
    key: "default",
    isActive: true,
  }).lean();

  const fallback = getDefaultConfig();

  const banner = raw?.banner
    ? {
        isActive: Boolean(raw.banner?.isActive ?? true),
        title: safeStr(raw.banner?.title || fallback.banner.title),
        subtitle: safeStr(raw.banner?.subtitle || fallback.banner.subtitle),
        ctaText: safeStr(raw.banner?.ctaText || fallback.banner.ctaText),
        placement: normalizePlacement(raw.banner?.placement || fallback.banner.placement),
      }
    : fallback.banner;

  const plansRaw = Array.isArray(raw?.plans) && raw.plans.length ? raw.plans : fallback.plans;

  const plans = plansRaw
    .map((plan: any, idx: number) => ({
      code: normalizePlanCode(plan?.code),
      name: safeStr(plan?.name || "Plan"),
      price: Math.max(0, safeNum(plan?.price, 0)),
      isActive: Boolean(plan?.isActive ?? true),
      isHighlighted: Boolean(plan?.isHighlighted),
      badge: safeStr(plan?.badge),
      accentColor: safeStr(plan?.accentColor),
      description: safeStr(plan?.description),
      sortOrder: safeNum(plan?.sortOrder, idx + 1),
    }))
    .sort((a: any, b: any) => a.sortOrder - b.sortOrder);

  const rulesRaw =
    Array.isArray(raw?.categoryRules) && raw.categoryRules.length
      ? raw.categoryRules
      : fallback.categoryRules;

  const categoryRules = rulesRaw
    .map((rule: any, idx: number) => ({
      categoryKey: safeStr(rule?.categoryKey || `Category ${idx + 1}`),
      categoryLabel: safeStr(rule?.categoryLabel || rule?.categoryKey || `Category ${idx + 1}`),
      isActive: Boolean(rule?.isActive ?? true),
      benefitMode: normalizeBenefitMode(rule?.benefitMode),
      sortOrder: safeNum(rule?.sortOrder, idx + 1),
      planBenefits: Array.isArray(rule?.planBenefits)
        ? rule.planBenefits.map((b: any) => ({
            planCode: normalizePlanCode(b?.planCode),
            discountPercent: Math.max(0, Math.min(100, safeNum(b?.discountPercent, 0))),
            discountProductLimit: Math.max(0, safeNum(b?.discountProductLimit, 0)),
            walletDeductionEnabled: Boolean(b?.walletDeductionEnabled),
          }))
        : [],
    }))
    .sort((a: any, b: any) => a.sortOrder - b.sortOrder);

  const contentRaw = raw?.walletPageContent || fallback.walletPageContent;

  const walletPageContent = {
    isActive: Boolean(contentRaw?.isActive ?? true),
    badgeText: safeStr(contentRaw?.badgeText || fallback.walletPageContent.badgeText),
    sectionTitle: safeStr(contentRaw?.sectionTitle || fallback.walletPageContent.sectionTitle),
    sectionSubtitle: safeStr(
      contentRaw?.sectionSubtitle || fallback.walletPageContent.sectionSubtitle
    ),
    processTitle: safeStr(contentRaw?.processTitle || fallback.walletPageContent.processTitle),
    processSteps: safeList(contentRaw?.processSteps, fallback.walletPageContent.processSteps),
    benefitsTitle: safeStr(
      contentRaw?.benefitsTitle || fallback.walletPageContent.benefitsTitle
    ),
    benefits: safeList(contentRaw?.benefits, fallback.walletPageContent.benefits),
    activationTitle: safeStr(
      contentRaw?.activationTitle || fallback.walletPageContent.activationTitle
    ),
    activationPoints: safeList(
      contentRaw?.activationPoints,
      fallback.walletPageContent.activationPoints
    ),
    notesTitle: safeStr(contentRaw?.notesTitle || fallback.walletPageContent.notesTitle),
    notes: safeList(contentRaw?.notes, fallback.walletPageContent.notes),
    ctaNote: safeStr(contentRaw?.ctaNote || fallback.walletPageContent.ctaNote),
  };

  return NextResponse.json(
    {
      ok: true,
      config: {
        banner,
        plans,
        categoryRules,
        walletPageContent,
      },
    },
    { status: 200 }
  );
}