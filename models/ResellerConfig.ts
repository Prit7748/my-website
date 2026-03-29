import mongoose, { Schema, models, model } from "mongoose";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function safeStringList(input: any) {
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

const ResellerPlanSchema = new Schema(
  {
    code: {
      type: String,
      enum: ["basic", "standard", "premium"],
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    isHighlighted: {
      type: Boolean,
      default: false,
    },

    badge: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },

    accentColor: {
      type: String,
      default: "",
      trim: true,
      maxlength: 40,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const ResellerPlanBenefitSchema = new Schema(
  {
    planCode: {
      type: String,
      enum: ["basic", "standard", "premium"],
      required: true,
    },

    discountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    discountProductLimit: {
      type: Number,
      default: 0,
      min: 0,
    },

    walletDeductionEnabled: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const ResellerCategoryRuleSchema = new Schema(
  {
    categoryKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    categoryLabel: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    benefitMode: {
      type: String,
      enum: ["wallet_deduction", "discount_only", "excluded"],
      default: "excluded",
    },

    sortOrder: {
      type: Number,
      default: 0,
    },

    planBenefits: {
      type: [ResellerPlanBenefitSchema],
      default: [],
    },
  },
  { _id: false }
);

const ResellerBannerSchema = new Schema(
  {
    isActive: {
      type: Boolean,
      default: true,
    },

    title: {
      type: String,
      default: "Special Offers for Sellers",
      trim: true,
      maxlength: 150,
    },

    subtitle: {
      type: String,
      default: "Earn more with exclusive reseller discounts and wallet benefits.",
      trim: true,
      maxlength: 300,
    },

    ctaText: {
      type: String,
      default: "Activate Seller Wallet",
      trim: true,
      maxlength: 80,
    },

    placement: {
      type: String,
      enum: ["home_slider_below", "combo_area", "both"],
      default: "home_slider_below",
    },
  },
  { _id: false }
);

const WalletPageContentSchema = new Schema(
  {
    isActive: {
      type: Boolean,
      default: true,
    },

    badgeText: {
      type: String,
      default: "Seller Wallet Guide",
      trim: true,
      maxlength: 120,
    },

    sectionTitle: {
      type: String,
      default: "How IGNOU Seller Wallet Recharge Works",
      trim: true,
      maxlength: 200,
    },

    sectionSubtitle: {
      type: String,
      default:
        "Understand the seller wallet recharge process, wallet benefits, activation flow, and important usage rules before you recharge your seller account.",
      trim: true,
      maxlength: 1200,
    },

    processTitle: {
      type: String,
      default: "Seller wallet recharge process",
      trim: true,
      maxlength: 160,
    },

    processSteps: {
      type: [String],
      default: [
        "Choose the seller plan that matches your business requirement and click the activate or recharge button.",
        "Complete the secure payment through Razorpay using UPI, card, net banking, or other available methods.",
        "After successful payment verification, your seller plan and wallet balance are updated on your account automatically.",
        "Eligible categories start using seller benefits according to the rules configured by the admin panel.",
      ],
    },

    benefitsTitle: {
      type: String,
      default: "Benefits after wallet recharge",
      trim: true,
      maxlength: 160,
    },

    benefits: {
      type: [String],
      default: [
        "Seller users can access category-based wallet deduction and discount benefits where enabled by admin rules.",
        "Wallet dashboard starts showing recharge history, available balance, total used amount, and seller savings.",
        "Active seller plan identity becomes visible in the user dashboard and related seller sections.",
        "The website can apply wallet-supported seller pricing on selected categories during checkout.",
      ],
    },

    activationTitle: {
      type: String,
      default: "What changes after recharge",
      trim: true,
      maxlength: 160,
    },

    activationPoints: {
      type: [String],
      default: [
        "Your account can move from normal user status to active seller status after successful recharge verification.",
        "Selected seller plan benefits become available according to the current reseller configuration.",
        "Future eligible orders can use wallet balance, discount-only rules, or both based on admin settings.",
        "Seller-specific tracking values such as wallet balance, total recharge, total usage, and saved amount are updated.",
      ],
    },

    notesTitle: {
      type: String,
      default: "Important notes for sellers",
      trim: true,
      maxlength: 160,
    },

    notes: {
      type: [String],
      default: [
        "Wallet benefits apply only on categories and plans that are active in admin reseller settings.",
        "Some categories may be excluded, discount-only, or wallet-deduction enabled depending on business rules.",
        "If any payment is deducted but seller activation does not update automatically, admin can verify and update the account manually.",
        "Recharge amount, usage logic, and seller visibility can be changed later from the backend without coding changes.",
      ],
    },

    ctaNote: {
      type: String,
      default:
        "Read the full seller process carefully before recharge so you understand activation, benefits, deductions, and future plan usage clearly.",
      trim: true,
      maxlength: 400,
    },
  },
  { _id: false }
);

const ResellerConfigSchema = new Schema(
  {
    key: {
      type: String,
      default: "default",
      unique: true,
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    banner: {
      type: ResellerBannerSchema,
      default: () => ({}),
    },

    plans: {
      type: [ResellerPlanSchema],
      default: [
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
    },

    categoryRules: {
      type: [ResellerCategoryRuleSchema],
      default: [
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
    },

    walletPageContent: {
      type: WalletPageContentSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

ResellerConfigSchema.pre("save", function () {
  const doc = this as any;

  doc.key = safeStr(doc.key || "default") || "default";
  doc.isActive = Boolean(doc.isActive);

  if (!doc.banner || typeof doc.banner !== "object") {
    doc.banner = {};
  }

  doc.banner.title = safeStr(doc.banner.title || "Special Offers for Sellers");
  doc.banner.subtitle = safeStr(
    doc.banner.subtitle || "Earn more with exclusive reseller discounts and wallet benefits."
  );
  doc.banner.ctaText = safeStr(doc.banner.ctaText || "Activate Seller Wallet");

  const placement = safeStr(doc.banner.placement || "home_slider_below").toLowerCase();
  doc.banner.placement = ["home_slider_below", "combo_area", "both"].includes(placement)
    ? placement
    : "home_slider_below";

  doc.plans = Array.isArray(doc.plans)
    ? doc.plans.map((plan: any) => ({
        code: ["basic", "standard", "premium"].includes(safeStr(plan?.code).toLowerCase())
          ? safeStr(plan?.code).toLowerCase()
          : "basic",
        name: safeStr(plan?.name),
        price: Math.max(0, safeNum(plan?.price, 0)),
        isActive: Boolean(plan?.isActive),
        isHighlighted: Boolean(plan?.isHighlighted),
        badge: safeStr(plan?.badge),
        accentColor: safeStr(plan?.accentColor),
        description: safeStr(plan?.description),
        sortOrder: safeNum(plan?.sortOrder, 0),
      }))
    : [];

  doc.categoryRules = Array.isArray(doc.categoryRules)
    ? doc.categoryRules.map((rule: any) => ({
        categoryKey: safeStr(rule?.categoryKey),
        categoryLabel: safeStr(rule?.categoryLabel),
        isActive: Boolean(rule?.isActive),
        benefitMode: ["wallet_deduction", "discount_only", "excluded"].includes(
          safeStr(rule?.benefitMode).toLowerCase()
        )
          ? safeStr(rule?.benefitMode).toLowerCase()
          : "excluded",
        sortOrder: safeNum(rule?.sortOrder, 0),
        planBenefits: Array.isArray(rule?.planBenefits)
          ? rule.planBenefits.map((b: any) => ({
              planCode: ["basic", "standard", "premium"].includes(
                safeStr(b?.planCode).toLowerCase()
              )
                ? safeStr(b?.planCode).toLowerCase()
                : "basic",
              discountPercent: Math.max(0, Math.min(100, safeNum(b?.discountPercent, 0))),
              discountProductLimit: Math.max(0, safeNum(b?.discountProductLimit, 0)),
              walletDeductionEnabled: Boolean(b?.walletDeductionEnabled),
            }))
          : [],
      }))
    : [];

  if (!doc.walletPageContent || typeof doc.walletPageContent !== "object") {
    doc.walletPageContent = {};
  }

  doc.walletPageContent.isActive = Boolean(doc.walletPageContent.isActive ?? true);
  doc.walletPageContent.badgeText = safeStr(doc.walletPageContent.badgeText || "Seller Wallet Guide");
  doc.walletPageContent.sectionTitle = safeStr(
    doc.walletPageContent.sectionTitle || "How IGNOU Seller Wallet Recharge Works"
  );
  doc.walletPageContent.sectionSubtitle = safeStr(
    doc.walletPageContent.sectionSubtitle ||
      "Understand the seller wallet recharge process, wallet benefits, activation flow, and important usage rules before you recharge your seller account."
  );
  doc.walletPageContent.processTitle = safeStr(
    doc.walletPageContent.processTitle || "Seller wallet recharge process"
  );
  doc.walletPageContent.processSteps = safeStringList(doc.walletPageContent.processSteps);
  doc.walletPageContent.benefitsTitle = safeStr(
    doc.walletPageContent.benefitsTitle || "Benefits after wallet recharge"
  );
  doc.walletPageContent.benefits = safeStringList(doc.walletPageContent.benefits);
  doc.walletPageContent.activationTitle = safeStr(
    doc.walletPageContent.activationTitle || "What changes after recharge"
  );
  doc.walletPageContent.activationPoints = safeStringList(doc.walletPageContent.activationPoints);
  doc.walletPageContent.notesTitle = safeStr(
    doc.walletPageContent.notesTitle || "Important notes for sellers"
  );
  doc.walletPageContent.notes = safeStringList(doc.walletPageContent.notes);
  doc.walletPageContent.ctaNote = safeStr(doc.walletPageContent.ctaNote || "");
});

export default models.ResellerConfig || model("ResellerConfig", ResellerConfigSchema);