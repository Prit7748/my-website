import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import ProductPricingRule from "@/models/ProductPricingRule";
import { normalizeProductCategory } from "@/lib/productCatalog";

export type PricingSource =
  | "product_override"
  | "course_rule"
  | "fallback"
  | "not_found";

export type ResolveProductPricingInput = {
  category?: any;
  courseCodes?: any[] | string;
  productId?: any;
  productSku?: any;
  fallbackPrice?: any;
  fallbackOldPrice?: any;
  allowFallback?: boolean;
};

export type ResolvedProductPricing = {
  ok: boolean;
  source: PricingSource;
  price: number;
  oldPrice: number;
  matchedCourseCode: string;
  matchedRuleId: string;
  matchedRuleKey: string;
  reason: string;
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

export function normalizePricingCategory(input: any) {
  return normalizeProductCategory(input);
}

export function normalizePricingCourseCode(input: any) {
  return safeStr(input).toUpperCase().replace(/\s+/g, " ").trim();
}

export function normalizePricingSku(input: any) {
  return safeStr(input).toUpperCase().replace(/\s+/g, "");
}

export function splitPricingCourseCodes(input: any[] | string | undefined | null) {
  if (Array.isArray(input)) {
    return Array.from(
      new Set(
        input
          .map((x) => normalizePricingCourseCode(x))
          .filter(Boolean)
      )
    );
  }

  const text = safeStr(input);
  if (!text) return [];

  return Array.from(
    new Set(
      text
        .split(",")
        .map((x) => normalizePricingCourseCode(x))
        .filter(Boolean)
    )
  );
}

export function buildCourseRuleKey(category: any, courseCode: any) {
  const cat = normalizePricingCategory(category).toLowerCase();
  const code = normalizePricingCourseCode(courseCode).toLowerCase();
  return `course_rule::${cat}::${code}`;
}

export function buildProductOverrideKeyFromId(productId: any) {
  const id = safeStr(productId);
  return id ? `product_override::${id}` : "";
}

export function buildProductOverrideKeyFromSku(productSku: any) {
  const sku = normalizePricingSku(productSku).toLowerCase();
  return sku ? `product_override::${sku}` : "";
}

export async function resolveProductPricing(
  input: ResolveProductPricingInput
): Promise<ResolvedProductPricing> {
  await dbConnect();

  const category = normalizePricingCategory(input?.category);
  const courseCodes = splitPricingCourseCodes(input?.courseCodes);
  const productId = safeStr(input?.productId);
  const productSku = normalizePricingSku(input?.productSku);

  const fallbackPrice = Math.max(0, safeNum(input?.fallbackPrice, 0));
  const fallbackOldPrice = Math.max(0, safeNum(input?.fallbackOldPrice, 0));
  const allowFallback = Boolean(input?.allowFallback);

  const overrideOr: any[] = [];

  if (productId && mongoose.Types.ObjectId.isValid(productId)) {
    overrideOr.push({ productId: new mongoose.Types.ObjectId(productId) });
  }

  if (productSku) {
    overrideOr.push({ productSku });
  }

  if (overrideOr.length) {
    const overrideRule: any = await ProductPricingRule.findOne({
      ruleType: "product_override",
      isActive: true,
      $or: overrideOr,
    })
      .sort({ updatedAt: -1, _id: -1 })
      .lean();

    if (overrideRule) {
      return {
        ok: true,
        source: "product_override",
        price: Math.max(0, safeNum(overrideRule.price, 0)),
        oldPrice: Math.max(0, safeNum(overrideRule.oldPrice, 0)),
        matchedCourseCode: "",
        matchedRuleId: safeStr(overrideRule._id),
        matchedRuleKey: safeStr(overrideRule.key),
        reason: "Matched active product-level pricing override.",
      };
    }
  }

  if (category && courseCodes.length) {
    const courseRules: any[] = await ProductPricingRule.find({
      ruleType: "course_rule",
      isActive: true,
      category,
      courseCode: { $in: courseCodes },
    })
      .sort({ updatedAt: -1, _id: -1 })
      .lean();

    if (courseRules.length) {
      const firstByCourse = new Map<string, any>();

      for (const rule of courseRules) {
        const code = normalizePricingCourseCode(rule?.courseCode);
        if (code && !firstByCourse.has(code)) {
          firstByCourse.set(code, rule);
        }
      }

      for (const code of courseCodes) {
        const matched = firstByCourse.get(code);
        if (matched) {
          return {
            ok: true,
            source: "course_rule",
            price: Math.max(0, safeNum(matched.price, 0)),
            oldPrice: Math.max(0, safeNum(matched.oldPrice, 0)),
            matchedCourseCode: code,
            matchedRuleId: safeStr(matched._id),
            matchedRuleKey: safeStr(matched.key),
            reason: `Matched active category + course pricing rule for ${code}.`,
          };
        }
      }
    }
  }

  if (allowFallback && fallbackPrice > 0) {
    return {
      ok: true,
      source: "fallback",
      price: fallbackPrice,
      oldPrice: fallbackOldPrice,
      matchedCourseCode: "",
      matchedRuleId: "",
      matchedRuleKey: "",
      reason: "No pricing rule matched, fallback price used.",
    };
  }

  return {
    ok: false,
    source: "not_found",
    price: 0,
    oldPrice: 0,
    matchedCourseCode: "",
    matchedRuleId: "",
    matchedRuleKey: "",
    reason: "No active pricing rule found for this product/category/course.",
  };
}

export const STRICT_PRODUCT_PRICING = true;

export async function resolveRequiredProductPricing(
  input: ResolveProductPricingInput
): Promise<ResolvedProductPricing> {
  return resolveProductPricing({
    ...input,
    fallbackPrice: 0,
    fallbackOldPrice: 0,
    allowFallback: false,
  });
}