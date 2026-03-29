import mongoose, { Schema, type Model } from "mongoose";
import { normalizeProductCategory } from "@/lib/productCatalog";

const RULE_TYPES = ["course_rule", "product_override"] as const;
type RuleType = (typeof RULE_TYPES)[number];

export type ProductPricingRuleDoc = {
  key: string;
  ruleType: RuleType;
  category: string;
  courseCode: string;
  courseTitle: string;
  productId: mongoose.Types.ObjectId | null;
  productSku: string;
  productTitleSnapshot: string;
  price: number;
  oldPrice: number;
  isActive: boolean;
  notes: string;
  updatedBy: string;
  lastAppliedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function normalizeCategory(input: any) {
  return normalizeProductCategory(input);
}

function normalizeCourseCode(input: any) {
  return safeStr(input).toUpperCase().replace(/\s+/g, " ").trim();
}

function normalizeSku(input: any) {
  return safeStr(input).toUpperCase().replace(/\s+/g, "");
}

function makeRuleKey(doc: Partial<ProductPricingRuleDoc>) {
  const ruleType = safeStr(doc?.ruleType).toLowerCase();

  if (ruleType === "course_rule") {
    const category = normalizeCategory(doc?.category).toLowerCase();
    const courseCode = normalizeCourseCode(doc?.courseCode).toLowerCase();
    return `course_rule::${category}::${courseCode}`;
  }

  if (ruleType === "product_override") {
    const productId = safeStr(doc?.productId);
    const productSku = normalizeSku(doc?.productSku).toLowerCase();
    return `product_override::${productId || productSku}`;
  }

  return "";
}

const ProductPricingRuleSchema = new Schema<ProductPricingRuleDoc>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
      maxlength: 500,
    },

    ruleType: {
      type: String,
      required: true,
      enum: RULE_TYPES,
      index: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
      maxlength: 120,
    },

    courseCode: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      index: true,
      maxlength: 80,
    },

    courseTitle: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      default: null,
      index: true,
    },

    productSku: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      index: true,
      maxlength: 80,
    },

    productTitleSnapshot: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    oldPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },

    updatedBy: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    lastAppliedAt: {
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

ProductPricingRuleSchema.pre("validate", function () {
  const doc = this as mongoose.HydratedDocument<ProductPricingRuleDoc>;

  doc.category = normalizeCategory(doc.category);
  doc.courseCode = normalizeCourseCode(doc.courseCode);
  doc.productSku = normalizeSku(doc.productSku);
  doc.price = Math.max(0, safeNum(doc.price, 0));
  doc.oldPrice = Math.max(0, safeNum(doc.oldPrice, 0));

  if (safeStr(doc.ruleType) === "course_rule") {
    if (!doc.category) {
      throw new Error("Category required for course_rule");
    }
    if (!doc.courseCode) {
      throw new Error("Course code required for course_rule");
    }
    doc.productId = null;
    doc.productSku = "";
  }

  if (safeStr(doc.ruleType) === "product_override") {
    if (!doc.category) {
      throw new Error("Category required for product_override");
    }
    if (!doc.productId && !doc.productSku) {
      throw new Error("productId or productSku required for product_override");
    }
  }

  const key = makeRuleKey(doc);
  if (!key) {
    throw new Error("Unable to build pricing rule key");
  }

  doc.key = key.toLowerCase();
});

ProductPricingRuleSchema.index({ ruleType: 1, category: 1, courseCode: 1, isActive: 1 });
ProductPricingRuleSchema.index({ ruleType: 1, productId: 1, isActive: 1 });
ProductPricingRuleSchema.index({ ruleType: 1, productSku: 1, isActive: 1 });
ProductPricingRuleSchema.index({ category: 1, updatedAt: -1 });

const ProductPricingRule =
  (mongoose.models.ProductPricingRule as Model<ProductPricingRuleDoc>) ||
  mongoose.model<ProductPricingRuleDoc>("ProductPricingRule", ProductPricingRuleSchema);

export default ProductPricingRule;