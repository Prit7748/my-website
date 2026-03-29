import dbConnect from "@/lib/db";
import OnDemandTimingRule, {
  normalizeOnDemandTimingCategoryKey,
  normalizeOnDemandTimingCourseCode,
} from "@/models/OnDemandTimingRule";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function uniqueStrings(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of arr) {
    const key = safeStr(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }

  return out;
}

function normalizeCourseCodeList(input: any) {
  if (Array.isArray(input)) {
    return uniqueStrings(input.map((x) => normalizeOnDemandTimingCourseCode(x)).filter(Boolean));
  }

  const single = normalizeOnDemandTimingCourseCode(input);
  return single ? [single] : [];
}

function clampMinutes(input: any, fallback = 20) {
  const n = Number(input);
  if (!Number.isFinite(n)) return fallback;
  const v = Math.trunc(n);
  return Math.min(1440, Math.max(1, v));
}

export type OnDemandTimingRuleLean = {
  _id?: any;
  categoryLabel?: string;
  categoryKey: string;
  courseCode?: string;
  courseCodeKey?: string;
  courseTitle?: string;
  ruleType: "category_default" | "course_override";
  deliverWithinMinutes: number;
  onDemandNote?: string;
  isActive?: boolean;
};

export type ResolvedOnDemandTiming = {
  source: "course_override" | "category_default" | "product_fallback" | "system_fallback";
  deliverWithinMinutes: number;
  onDemandNote: string;
  categoryKey: string;
  matchedCourseCode: string;
  matchedRuleId: string;
  matchedRuleType: "category_default" | "course_override" | "";
};

export async function fetchActiveOnDemandTimingRules(filters?: {
  categoryKeys?: string[];
  courseCodeKeys?: string[];
}) {
  await dbConnect();

  const categoryKeys = uniqueStrings(
    (Array.isArray(filters?.categoryKeys) ? filters!.categoryKeys : [])
      .map((x) => normalizeOnDemandTimingCategoryKey(x))
      .filter(Boolean)
  );

  const courseCodeKeys = uniqueStrings(
    (Array.isArray(filters?.courseCodeKeys) ? filters!.courseCodeKeys : [])
      .map((x) => normalizeOnDemandTimingCourseCode(x))
      .filter(Boolean)
  );

  const query: any = { isActive: true };

  if (categoryKeys.length) {
    query.categoryKey = { $in: categoryKeys };
  }

  if (courseCodeKeys.length) {
    query.$or = [{ courseCodeKey: "" }, { courseCodeKey: { $in: courseCodeKeys } }];
  }

  const rows: any[] = await OnDemandTimingRule.find(query)
    .select(
      "_id categoryLabel categoryKey courseCode courseCodeKey courseTitle ruleType deliverWithinMinutes onDemandNote isActive"
    )
    .sort({ categoryKey: 1, ruleType: 1, courseCodeKey: 1, updatedAt: -1, _id: -1 })
    .lean();

  return (Array.isArray(rows) ? rows : []) as OnDemandTimingRuleLean[];
}

export async function createOnDemandTimingResolver(products: any[]) {
  const list = Array.isArray(products) ? products : [];

  const categoryKeys = uniqueStrings(
    list
      .map((p) => normalizeOnDemandTimingCategoryKey(p?.category))
      .filter(Boolean)
  );

  const courseCodeKeys = uniqueStrings(
    list.flatMap((p) => normalizeCourseCodeList(p?.courseCodes))
  );

  const rules = await fetchActiveOnDemandTimingRules({
    categoryKeys,
    courseCodeKeys,
  });

  const defaultByCategory = new Map<string, OnDemandTimingRuleLean>();
  const overrideByCategoryCourse = new Map<string, OnDemandTimingRuleLean>();

  for (const rule of rules) {
    const categoryKey = normalizeOnDemandTimingCategoryKey(rule?.categoryKey || rule?.categoryLabel);
    const courseCodeKey = normalizeOnDemandTimingCourseCode(rule?.courseCodeKey || rule?.courseCode);

    if (!categoryKey) continue;

    if (courseCodeKey) {
      const key = `${categoryKey}__${courseCodeKey}`;
      if (!overrideByCategoryCourse.has(key)) {
        overrideByCategoryCourse.set(key, {
          ...rule,
          categoryKey,
          courseCodeKey,
          ruleType: "course_override",
        });
      }
      continue;
    }

    if (!defaultByCategory.has(categoryKey)) {
      defaultByCategory.set(categoryKey, {
        ...rule,
        categoryKey,
        courseCodeKey: "",
        ruleType: "category_default",
      });
    }
  }

  return function resolve(productLike: any): ResolvedOnDemandTiming {
    const categoryKey = normalizeOnDemandTimingCategoryKey(productLike?.category);
    const courseCodes = normalizeCourseCodeList(productLike?.courseCodes);

    for (const courseCode of courseCodes) {
      const overrideKey = `${categoryKey}__${courseCode}`;
      const overrideRule = overrideByCategoryCourse.get(overrideKey);

      if (overrideRule) {
        return {
          source: "course_override",
          deliverWithinMinutes: clampMinutes(overrideRule.deliverWithinMinutes, 20),
          onDemandNote: safeStr(overrideRule.onDemandNote),
          categoryKey,
          matchedCourseCode: courseCode,
          matchedRuleId: safeStr(overrideRule._id),
          matchedRuleType: "course_override",
        };
      }
    }

    const defaultRule = defaultByCategory.get(categoryKey);
    if (defaultRule) {
      return {
        source: "category_default",
        deliverWithinMinutes: clampMinutes(defaultRule.deliverWithinMinutes, 20),
        onDemandNote: safeStr(defaultRule.onDemandNote),
        categoryKey,
        matchedCourseCode: "",
        matchedRuleId: safeStr(defaultRule._id),
        matchedRuleType: "category_default",
      };
    }

    const fallbackMinutes = clampMinutes(productLike?.deliverWithinMinutes, 20);
    const fallbackNote = safeStr(productLike?.onDemandNote);

    return {
      source:
        productLike?.deliverWithinMinutes !== undefined || fallbackNote
          ? "product_fallback"
          : "system_fallback",
      deliverWithinMinutes: fallbackMinutes,
      onDemandNote: fallbackNote,
      categoryKey,
      matchedCourseCode: "",
      matchedRuleId: "",
      matchedRuleType: "",
    };
  };
}

export async function resolveOnDemandTimingForProduct(productLike: any) {
  const resolver = await createOnDemandTimingResolver([productLike]);
  return resolver(productLike);
}

export async function attachResolvedOnDemandTimingToProducts<T extends Record<string, any>>(
  products: T[]
) {
  const list = Array.isArray(products) ? products : [];
  if (!list.length) return [];

  const resolver = await createOnDemandTimingResolver(list);

  return list.map((product) => {
    const timing = resolver(product);

    return {
      ...product,
      effectiveOnDemandTiming: timing,
      deliverWithinMinutesResolved: timing.deliverWithinMinutes,
      onDemandNoteResolved: timing.onDemandNote,
      onDemandTimingSource: timing.source,
      onDemandMatchedCourseCode: timing.matchedCourseCode,
      onDemandMatchedRuleId: timing.matchedRuleId,
      onDemandMatchedRuleType: timing.matchedRuleType,
    };
  });
}