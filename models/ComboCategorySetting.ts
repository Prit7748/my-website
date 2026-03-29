// models/ComboCategorySetting.ts
import { Schema, models, model } from "mongoose";

const ALLOWED_CATEGORY_SLUGS = [
  "solved-assignments",
  "question-papers",
  "guess-papers",
  "ebooks-notes",
  "handwritten-pdfs",
  "handwritten-hardcopy",
  "projects-synopsis",
] as const;

const ALLOWED_DISCOUNT_TYPES = ["percent"] as const;

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

function normalizeDiscountType(x: any) {
  const v = safeStr(x || "percent").toLowerCase();
  if ((ALLOWED_DISCOUNT_TYPES as readonly string[]).includes(v)) return v;
  return "percent";
}

const ComboCategoryBuilderRulesSchema = new Schema(
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

    sameCategoryOnly: {
      type: Boolean,
      default: true,
    },

    sameSubjectOnly: {
      type: Boolean,
      default: false,
    },

    sameMediumOnly: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: false,
    minimize: true,
  }
);

const ComboCategoryUiSchema = new Schema(
  {
    makeOwnComboText: {
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

const ComboCategorySettingSchema = new Schema(
  {
    categorySlug: {
      type: String,
      required: true,
      unique: true,
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

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    comboEnabled: {
      type: Boolean,
      default: true,
      index: true,
    },

    manualCombosEnabled: {
      type: Boolean,
      default: true,
    },

    makeOwnComboEnabled: {
      type: Boolean,
      default: false,
    },

    discountType: {
      type: String,
      default: "percent",
      enum: ALLOWED_DISCOUNT_TYPES,
    },

    discountValue: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    builderRules: {
      type: ComboCategoryBuilderRulesSchema,
      default: () => ({}),
    },

    ui: {
      type: ComboCategoryUiSchema,
      default: () => ({}),
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
  },
  {
    timestamps: true,
    minimize: true,
  }
);

ComboCategorySettingSchema.pre("save", function () {
  const doc = this as any;

  doc.categorySlug = safeStr(doc.categorySlug).toLowerCase();
  doc.categoryLabel = safeStr(doc.categoryLabel);

  doc.isActive = safeBool(doc.isActive, true);
  doc.comboEnabled = safeBool(doc.comboEnabled, true);
  doc.manualCombosEnabled = safeBool(doc.manualCombosEnabled, true);
  doc.makeOwnComboEnabled = safeBool(doc.makeOwnComboEnabled, false);

  doc.discountType = normalizeDiscountType(doc.discountType);
  doc.discountValue = Math.max(0, Math.min(100, safeNum(doc.discountValue, 0)));

  doc.createdBy = safeStr(doc.createdBy);
  doc.updatedBy = safeStr(doc.updatedBy);

  if (!doc.builderRules || typeof doc.builderRules !== "object") {
    doc.builderRules = {};
  }

  doc.builderRules.minProductsRequired = Math.max(
    0,
    Math.trunc(safeNum(doc.builderRules.minProductsRequired, 0))
  );

  doc.builderRules.maxProductsAllowed = Math.max(
    0,
    Math.trunc(safeNum(doc.builderRules.maxProductsAllowed, 0))
  );

  doc.builderRules.sameCategoryOnly = safeBool(doc.builderRules.sameCategoryOnly, true);
  doc.builderRules.sameSubjectOnly = safeBool(doc.builderRules.sameSubjectOnly, false);
  doc.builderRules.sameMediumOnly = safeBool(doc.builderRules.sameMediumOnly, false);

  if (!doc.ui || typeof doc.ui !== "object") {
    doc.ui = {};
  }

  doc.ui.makeOwnComboText = safeStr(doc.ui.makeOwnComboText);
});

ComboCategorySettingSchema.index({ isActive: 1, comboEnabled: 1, categorySlug: 1 });

ComboCategorySettingSchema.index(
  {
    categorySlug: "text",
    categoryLabel: "text",
    "ui.makeOwnComboText": "text",
  },
  {
    name: "combo_category_setting_text_search_v2",
    default_language: "none",
    weights: {
      categorySlug: 20,
      categoryLabel: 12,
      "ui.makeOwnComboText": 4,
    },
  }
);

export default models.ComboCategorySetting ||
  model("ComboCategorySetting", ComboCategorySettingSchema);