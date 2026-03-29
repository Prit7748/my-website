import mongoose, { Schema, models, model } from "mongoose";

const ALLOWED_CATEGORY_SLUGS = [
  "solved-assignments",
  "question-papers",
  "guess-papers",
  "ebooks-notes",
  "handwritten-pdfs",
  "handwritten-hardcopy",
  "projects-synopsis",
] as const;

const ALLOWED_VARIANTS = ["default", "pyq", "hardcopy"] as const;

const ALLOWED_COMBO_KINDS = [
  "auto",
  "custom",
  "pyq_3y",
  "pyq_5y",
  "admin",
] as const;

const ALLOWED_STATUS = ["active", "inactive", "draft"] as const;
const ALLOWED_SOURCE_TYPES = ["manual", "generated", "pyq_generated"] as const;
const ALLOWED_THUMB_MODES = ["master", "dynamic", "manual"] as const;
const ALLOWED_DISCOUNT_TYPES = ["percent", "flat"] as const;

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function safeBool(x: any, def = false) {
  if (typeof x === "boolean") return x;
  if (typeof x === "string") {
    const v = x.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(v)) return true;
    if (["false", "0", "no", "off"].includes(v)) return false;
  }
  return def;
}

function toSlug(input: any) {
  return safeStr(input)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanStringArray(arr: any, upper = false) {
  if (!Array.isArray(arr)) return [];
  return Array.from(
    new Set(
      arr
        .map((x: any) => (upper ? safeStr(x).toUpperCase() : safeStr(x)))
        .filter(Boolean)
    )
  );
}

function categoryLabelFromSlug(slug: any) {
  const s = safeStr(slug).toLowerCase();
  if (s === "solved-assignments") return "Solved Assignments";
  if (s === "question-papers") return "Question Papers (PYQ)";
  if (s === "guess-papers") return "Guess Papers";
  if (s === "ebooks-notes") return "eBooks/Notes";
  if (s === "handwritten-pdfs") return "Handwritten PDFs";
  if (s === "handwritten-hardcopy") return "Handwritten Hardcopy (Delivery)";
  if (s === "projects-synopsis") return "Projects & Synopsis";
  return safeStr(slug);
}

function inferVariant(categorySlug: any, comboKind: any, current: any) {
  const existing = safeStr(current).toLowerCase();
  if ((ALLOWED_VARIANTS as readonly string[]).includes(existing)) return existing;

  const cat = safeStr(categorySlug).toLowerCase();
  const kind = safeStr(comboKind).toLowerCase();

  if (kind === "pyq_3y" || kind === "pyq_5y" || cat === "question-papers") return "pyq";
  if (cat === "handwritten-hardcopy") return "hardcopy";
  return "default";
}

const ComboItemSnapshotSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      default: null,
      index: true,
    },
    title: {
      type: String,
      default: "",
      trim: true,
      maxlength: 400,
    },
    slug: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 400,
    },
    category: {
      type: String,
      default: "",
      trim: true,
      maxlength: 150,
    },
    subjectCode: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      maxlength: 60,
      index: true,
    },
    subjectTitleEn: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    subjectTitleHi: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    medium: {
      type: String,
      default: "",
      trim: true,
      maxlength: 60,
      index: true,
    },
    lang3: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      maxlength: 3,
      index: true,
    },
    session: {
      type: String,
      default: "",
      trim: true,
      maxlength: 40,
      index: true,
    },
    session6: {
      type: String,
      default: "",
      trim: true,
      maxlength: 6,
      index: true,
    },
    courseCodes: {
      type: [String],
      default: [],
    },
    courseTitles: {
      type: [String],
      default: [],
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    thumbUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 3000,
    },
  },
  {
    _id: false,
    minimize: true,
  }
);

const ComboRulesSchema = new Schema(
  {
    minCoPurchaseUsers: {
      type: Number,
      default: 0,
      min: 0,
    },
    minProductsRequired: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxProductsAllowed: {
      type: Number,
      default: 0,
      min: 0,
    },
    sameSubjectOnly: {
      type: Boolean,
      default: false,
    },
    sameMediumOnly: {
      type: Boolean,
      default: false,
    },
    sameCategoryOnly: {
      type: Boolean,
      default: true,
    },
    useLatestSessionsOnly: {
      type: Boolean,
      default: false,
    },
    latestProductCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    generatedFrom: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },
  },
  {
    _id: false,
    minimize: true,
  }
);

const ComboBuilderConfigSnapshotSchema = new Schema(
  {
    minProductsRequired: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxProductsAllowed: {
      type: Number,
      default: 0,
      min: 0,
    },
    sameSubjectOnly: {
      type: Boolean,
      default: false,
    },
    sameMediumOnly: {
      type: Boolean,
      default: false,
    },
    sameCategoryOnly: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: false,
    minimize: true,
  }
);

const ComboPricingSnapshotSchema = new Schema(
  {
    discountType: {
      type: String,
      default: "percent",
      enum: ALLOWED_DISCOUNT_TYPES,
    },
    discountValue: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    _id: false,
    minimize: true,
  }
);

const ComboSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 400,
      index: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 450,
      index: true,
    },

    shortTitle: {
      type: String,
      default: "",
      trim: true,
      maxlength: 250,
    },

    categorySlug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      enum: ALLOWED_CATEGORY_SLUGS,
      index: true,
    },

    categoryLabel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 150,
    },

    comboKind: {
      type: String,
      required: true,
      enum: ALLOWED_COMBO_KINDS,
      index: true,
    },

    variant: {
      type: String,
      default: "default",
      enum: ALLOWED_VARIANTS,
      index: true,
    },

    status: {
      type: String,
      default: "draft",
      enum: ALLOWED_STATUS,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },

    isAutoGenerated: {
      type: Boolean,
      default: false,
      index: true,
    },

    isMakeOwnComboAllowed: {
      type: Boolean,
      default: false,
      index: true,
    },

    sourceType: {
      type: String,
      default: "manual",
      enum: ALLOWED_SOURCE_TYPES,
      index: true,
    },

    sourceRuleId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
      index: true,
    },

    sourceTemplateKey: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
      index: true,
    },

    generationKey: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
      index: true,
      sparse: true,
    },

    generationGroupKey: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
      index: true,
    },

    isLockedByAdmin: {
      type: Boolean,
      default: false,
      index: true,
    },

    allowAutoRefresh: {
      type: Boolean,
      default: false,
      index: true,
    },

    subjectCode: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      maxlength: 60,
      index: true,
    },

    medium: {
      type: String,
      default: "",
      trim: true,
      maxlength: 60,
      index: true,
    },

    lang3: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      maxlength: 3,
      index: true,
    },

    sessionRangeLabel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },

    courseCodes: {
      type: [String],
      default: [],
      index: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 4000,
    },

    shortDescription: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1500,
    },

    badge: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },

    itemsLabel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },

    accentClass: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    thumbMode: {
      type: String,
      default: "dynamic",
      enum: ALLOWED_THUMB_MODES,
    },

    thumbUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 3000,
    },

    metaTitle: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    metaDescription: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    totalMrp: {
      type: Number,
      default: 0,
      min: 0,
    },

    offerPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    saveAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    savePercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    priceLabel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },

    saveLabel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },

    mediumLabel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },

    sessionLabel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },

    pricingSnapshot: {
      type: ComboPricingSnapshotSchema,
      default: () => ({}),
    },

    rules: {
      type: ComboRulesSchema,
      default: () => ({}),
    },

    builderConfigSnapshot: {
      type: ComboBuilderConfigSnapshotSchema,
      default: () => ({}),
    },

    productIds: {
      type: [Schema.Types.ObjectId],
      ref: "Product",
      default: [],
      index: true,
    },

    itemsSnapshot: {
      type: [ComboItemSnapshotSchema],
      default: [],
    },

    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },

    generatedFromRule: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    lastGeneratedAt: {
      type: Date,
      default: null,
      index: true,
    },

    createdBy: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    updatedBy: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },

    deletedBy: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
  },
  {
    timestamps: true,
    minimize: true,
  }
);

ComboSchema.pre("save", function () {
  const doc = this as any;

  doc.title = safeStr(doc.title);
  doc.slug = toSlug(doc.slug || doc.title);
  doc.shortTitle = safeStr(doc.shortTitle) || doc.title;

  doc.categorySlug = safeStr(doc.categorySlug).toLowerCase();
  doc.categoryLabel = safeStr(doc.categoryLabel) || categoryLabelFromSlug(doc.categorySlug);

  doc.comboKind = safeStr(doc.comboKind).toLowerCase();
  doc.variant = inferVariant(doc.categorySlug, doc.comboKind, doc.variant);
  doc.status = safeStr(doc.status || "draft").toLowerCase();

  doc.isActive = safeBool(doc.isActive, false);
  doc.isAutoGenerated = safeBool(doc.isAutoGenerated, false);
  doc.isMakeOwnComboAllowed = safeBool(doc.isMakeOwnComboAllowed, false);

  doc.sourceType = safeStr(doc.sourceType || (doc.isAutoGenerated ? "generated" : "manual")).toLowerCase();
  doc.sourceRuleId = safeStr(doc.sourceRuleId);
  doc.sourceTemplateKey = safeStr(doc.sourceTemplateKey);
  doc.generationKey = safeStr(doc.generationKey);
  doc.generationGroupKey = safeStr(doc.generationGroupKey);

  doc.isLockedByAdmin = safeBool(doc.isLockedByAdmin, false);
  doc.allowAutoRefresh = safeBool(
    doc.allowAutoRefresh,
    doc.sourceType === "manual" ? false : true
  );

  doc.subjectCode = safeStr(doc.subjectCode).toUpperCase();
  doc.medium = safeStr(doc.medium);
  doc.lang3 = safeStr(doc.lang3).toUpperCase();
  doc.sessionRangeLabel = safeStr(doc.sessionRangeLabel);

  doc.courseCodes = cleanStringArray(doc.courseCodes, true);

  doc.description = safeStr(doc.description);
  doc.shortDescription = safeStr(doc.shortDescription);
  doc.badge = safeStr(doc.badge);
  doc.itemsLabel = safeStr(doc.itemsLabel) || "Included Bundle Items";
  doc.accentClass = safeStr(doc.accentClass);
  doc.thumbMode = safeStr(doc.thumbMode || "dynamic").toLowerCase();
  doc.thumbUrl = safeStr(doc.thumbUrl);

  doc.metaTitle = safeStr(doc.metaTitle) || doc.title;
  doc.metaDescription =
    safeStr(doc.metaDescription) ||
    safeStr(doc.shortDescription) ||
    safeStr(doc.description);

  doc.totalMrp = Math.max(0, safeNum(doc.totalMrp, 0));
  doc.offerPrice = Math.max(0, safeNum(doc.offerPrice, 0));
  doc.saveAmount = Math.max(0, safeNum(doc.saveAmount, 0));
  doc.savePercent = Math.max(0, Math.min(100, safeNum(doc.savePercent, 0)));

  doc.priceLabel = safeStr(doc.priceLabel);
  doc.saveLabel = safeStr(doc.saveLabel);
  doc.mediumLabel = safeStr(doc.mediumLabel);
  doc.sessionLabel = safeStr(doc.sessionLabel);

  doc.sortOrder = Math.trunc(safeNum(doc.sortOrder, 0));
  doc.generatedFromRule = safeStr(doc.generatedFromRule);

  doc.createdBy = safeStr(doc.createdBy);
  doc.updatedBy = safeStr(doc.updatedBy);
  doc.deletedBy = safeStr(doc.deletedBy);

  if (!doc.pricingSnapshot || typeof doc.pricingSnapshot !== "object") {
    doc.pricingSnapshot = {};
  }
  doc.pricingSnapshot.discountType = safeStr(doc.pricingSnapshot.discountType || "percent").toLowerCase();
  doc.pricingSnapshot.discountValue = Math.max(0, safeNum(doc.pricingSnapshot.discountValue, 0));

  if (!doc.rules || typeof doc.rules !== "object") {
    doc.rules = {};
  }
  doc.rules.minCoPurchaseUsers = Math.max(0, Math.trunc(safeNum(doc.rules.minCoPurchaseUsers, 0)));
  doc.rules.minProductsRequired = Math.max(0, Math.trunc(safeNum(doc.rules.minProductsRequired, 0)));
  doc.rules.maxProductsAllowed = Math.max(0, Math.trunc(safeNum(doc.rules.maxProductsAllowed, 0)));
  doc.rules.sameSubjectOnly = safeBool(doc.rules.sameSubjectOnly, false);
  doc.rules.sameMediumOnly = safeBool(doc.rules.sameMediumOnly, false);
  doc.rules.sameCategoryOnly = safeBool(doc.rules.sameCategoryOnly, true);
  doc.rules.useLatestSessionsOnly = safeBool(doc.rules.useLatestSessionsOnly, false);
  doc.rules.latestProductCount = Math.max(0, Math.trunc(safeNum(doc.rules.latestProductCount, 0)));
  doc.rules.generatedFrom = safeStr(doc.rules.generatedFrom);

  if (!doc.builderConfigSnapshot || typeof doc.builderConfigSnapshot !== "object") {
    doc.builderConfigSnapshot = {};
  }
  doc.builderConfigSnapshot.minProductsRequired = Math.max(
    0,
    Math.trunc(safeNum(doc.builderConfigSnapshot.minProductsRequired, 0))
  );
  doc.builderConfigSnapshot.maxProductsAllowed = Math.max(
    0,
    Math.trunc(safeNum(doc.builderConfigSnapshot.maxProductsAllowed, 0))
  );
  doc.builderConfigSnapshot.sameSubjectOnly = safeBool(doc.builderConfigSnapshot.sameSubjectOnly, false);
  doc.builderConfigSnapshot.sameMediumOnly = safeBool(doc.builderConfigSnapshot.sameMediumOnly, false);
  doc.builderConfigSnapshot.sameCategoryOnly = safeBool(doc.builderConfigSnapshot.sameCategoryOnly, true);

  if (!Array.isArray(doc.productIds)) doc.productIds = [];
  doc.productIds = Array.from(
    new Set(
      doc.productIds
        .map((x: any) => String(x || "").trim())
        .filter(Boolean)
    )
  );

  if (!Array.isArray(doc.itemsSnapshot)) doc.itemsSnapshot = [];
  doc.itemsSnapshot = doc.itemsSnapshot.map((item: any) => ({
    productId: item?.productId || null,
    title: safeStr(item?.title),
    slug: toSlug(item?.slug || item?.title),
    category: safeStr(item?.category),
    subjectCode: safeStr(item?.subjectCode).toUpperCase(),
    subjectTitleEn: safeStr(item?.subjectTitleEn),
    subjectTitleHi: safeStr(item?.subjectTitleHi),
    medium: safeStr(item?.medium),
    lang3: safeStr(item?.lang3).toUpperCase(),
    session: safeStr(item?.session),
    session6: safeStr(item?.session6),
    courseCodes: cleanStringArray(item?.courseCodes, true),
    courseTitles: cleanStringArray(item?.courseTitles, false),
    price: Math.max(0, safeNum(item?.price, 0)),
    thumbUrl: safeStr(item?.thumbUrl),
  }));

  if (!doc.offerPrice && doc.totalMrp > 0 && doc.savePercent > 0) {
    doc.offerPrice = Math.max(0, Math.round(doc.totalMrp * (1 - doc.savePercent / 100)));
  }

  if (!doc.saveAmount && doc.totalMrp > 0) {
    doc.saveAmount = Math.max(0, doc.totalMrp - doc.offerPrice);
  }

  if (!doc.savePercent && doc.totalMrp > 0) {
    doc.savePercent = Math.max(0, Math.min(100, Math.round((doc.saveAmount / doc.totalMrp) * 100)));
  }

  if (!doc.priceLabel && doc.offerPrice > 0) {
    doc.priceLabel = `₹${doc.offerPrice}`;
  }

  if (!doc.saveLabel && doc.savePercent > 0) {
    doc.saveLabel = `Save ${doc.savePercent}%`;
  }

  if (!doc.mediumLabel && doc.medium) {
    doc.mediumLabel = doc.medium;
  }

  if (!doc.sessionLabel && doc.sessionRangeLabel) {
    doc.sessionLabel = doc.sessionRangeLabel;
  }

  if (!doc.isActive && doc.status === "active") {
    doc.isActive = true;
  }

  if (doc.isActive && doc.status !== "active") {
    doc.status = "active";
  }

  if (doc.sourceType === "manual") {
    doc.isAutoGenerated = false;
    doc.sourceRuleId = "";
    doc.sourceTemplateKey = "";
    doc.generationKey = "";
    doc.generationGroupKey = "";
    doc.allowAutoRefresh = false;
  }

  if (doc.sourceType === "generated" || doc.sourceType === "pyq_generated") {
    doc.isAutoGenerated = true;
  }
});

ComboSchema.index({ categorySlug: 1, deletedAt: 1, status: 1, sortOrder: 1, createdAt: -1 });
ComboSchema.index({ categorySlug: 1, comboKind: 1, subjectCode: 1, lang3: 1, deletedAt: 1 });
ComboSchema.index({ sourceType: 1, isAutoGenerated: 1, deletedAt: 1, createdAt: -1 });
ComboSchema.index({ generationKey: 1 }, { sparse: true });
ComboSchema.index({ generationGroupKey: 1, categorySlug: 1 });
ComboSchema.index({ isLockedByAdmin: 1, allowAutoRefresh: 1, sourceType: 1 });
ComboSchema.index({ deletedAt: 1, createdAt: -1 });

export default models.Combo || model("Combo", ComboSchema);