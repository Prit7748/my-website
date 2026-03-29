import mongoose, { Schema, models, model } from "mongoose";

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

function cleanStringArray(arr: any, upper = false) {
  if (!Array.isArray(arr)) return [];
  return Array.from(
    new Set(
      arr
        .map((x: any) => {
          const v = safeStr(x);
          return upper ? v.toUpperCase() : v;
        })
        .filter(Boolean)
    )
  );
}

const PromoCategoryRuleSchema = new Schema(
  {
    categoryKey: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },
    minQty: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  { _id: false }
);

const PromoCodeSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    badgeText: {
      type: String,
      default: "",
      trim: true,
      maxlength: 60,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    startsAt: {
      type: Date,
      default: null,
      index: true,
    },

    endsAt: {
      type: Date,
      default: null,
      index: true,
    },

    discountType: {
      type: String,
      enum: ["percent", "fixed"],
      required: true,
      default: "percent",
      index: true,
    },

    discountValue: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    maxDiscountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalUsageLimit: {
      type: Number,
      default: 0,
      min: 0,
    },

    perUserUsageLimit: {
      type: Number,
      default: 1,
      min: 0,
    },

    totalUsedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    firstOrderOnly: {
      type: Boolean,
      default: false,
      index: true,
    },

    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    minCartQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    minDistinctProducts: {
      type: Number,
      default: 0,
      min: 0,
    },

    minDistinctCategories: {
      type: Number,
      default: 0,
      min: 0,
    },

    allowCombos: {
      type: Boolean,
      default: true,
      index: true,
    },

    allowResellers: {
      type: Boolean,
      default: true,
      index: true,
    },

    isAutoApply: {
      type: Boolean,
      default: false,
      index: true,
    },

    isStackable: {
      type: Boolean,
      default: false,
      index: true,
    },

    allowedCategories: {
      type: [String],
      default: [],
    },

    blockedCategories: {
      type: [String],
      default: [],
    },

    allowedProductIds: {
      type: [String],
      default: [],
    },

    blockedProductIds: {
      type: [String],
      default: [],
    },

    requiredCategoryRules: {
      type: [PromoCategoryRuleSchema],
      default: [],
    },

    requiredProductIds: {
      type: [String],
      default: [],
    },

    customerTag: {
      type: String,
      default: "",
      trim: true,
      maxlength: 60,
    },

    priority: {
      type: Number,
      default: 0,
      index: true,
    },

    publicNote: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    internalNote: {
      type: String,
      default: "",
      trim: true,
      maxlength: 3000,
    },

    createdBy: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },

    updatedBy: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },

    lastUsedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    minimize: true,
  }
);

PromoCodeSchema.pre("save", function () {
  const doc = this as any;

  doc.code = safeStr(doc.code).toUpperCase();
  doc.title = safeStr(doc.title);
  doc.description = safeStr(doc.description);
  doc.badgeText = safeStr(doc.badgeText);
  doc.customerTag = safeStr(doc.customerTag);
  doc.publicNote = safeStr(doc.publicNote);
  doc.internalNote = safeStr(doc.internalNote);
  doc.createdBy = safeStr(doc.createdBy);
  doc.updatedBy = safeStr(doc.updatedBy);

  doc.discountType = safeStr(doc.discountType).toLowerCase() === "fixed" ? "fixed" : "percent";
  doc.discountValue = roundMoney(Math.max(0, safeNum(doc.discountValue, 0)));
  doc.maxDiscountAmount = roundMoney(Math.max(0, safeNum(doc.maxDiscountAmount, 0)));

  if (doc.discountType === "percent") {
    doc.discountValue = Math.min(100, doc.discountValue);
  }

  doc.totalUsageLimit = Math.max(0, Math.trunc(safeNum(doc.totalUsageLimit, 0)));
  doc.perUserUsageLimit = Math.max(0, Math.trunc(safeNum(doc.perUserUsageLimit, 1)));
  doc.totalUsedCount = Math.max(0, Math.trunc(safeNum(doc.totalUsedCount, 0)));

  doc.minOrderAmount = roundMoney(Math.max(0, safeNum(doc.minOrderAmount, 0)));
  doc.minCartQuantity = Math.max(0, Math.trunc(safeNum(doc.minCartQuantity, 0)));
  doc.minDistinctProducts = Math.max(0, Math.trunc(safeNum(doc.minDistinctProducts, 0)));
  doc.minDistinctCategories = Math.max(0, Math.trunc(safeNum(doc.minDistinctCategories, 0)));
  doc.priority = Math.trunc(safeNum(doc.priority, 0));

  doc.allowedCategories = cleanStringArray(doc.allowedCategories, false);
  doc.blockedCategories = cleanStringArray(doc.blockedCategories, false);
  doc.allowedProductIds = cleanStringArray(doc.allowedProductIds, false);
  doc.blockedProductIds = cleanStringArray(doc.blockedProductIds, false);
  doc.requiredProductIds = cleanStringArray(doc.requiredProductIds, false);

  doc.requiredCategoryRules = Array.isArray(doc.requiredCategoryRules)
    ? doc.requiredCategoryRules
        .map((x: any) => ({
          categoryKey: safeStr(x?.categoryKey),
          minQty: Math.max(1, Math.trunc(safeNum(x?.minQty, 1))),
        }))
        .filter((x: any) => x.categoryKey)
    : [];

  if (doc.startsAt && doc.endsAt && new Date(doc.startsAt).getTime() > new Date(doc.endsAt).getTime()) {
    const temp = doc.startsAt;
    doc.startsAt = doc.endsAt;
    doc.endsAt = temp;
  }
});

PromoCodeSchema.index({ isActive: 1, startsAt: 1, endsAt: 1, priority: -1, createdAt: -1 });
PromoCodeSchema.index({ isActive: 1, isAutoApply: 1, priority: -1, createdAt: -1 });
PromoCodeSchema.index({ discountType: 1, isActive: 1, createdAt: -1 });
PromoCodeSchema.index({ lastUsedAt: -1, totalUsedCount: -1 });

export default models.PromoCode || model("PromoCode", PromoCodeSchema);