import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import Course from "@/models/Course";
import ProductPricingRule from "@/models/ProductPricingRule";
import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  buildCourseRuleKey,
  buildProductOverrideKeyFromId,
  normalizePricingCourseCode,
  normalizePricingSku,
  resolveProductPricing,
} from "@/lib/productPricing";
import { syncGeneratedCombosForProductChange } from "@/lib/comboAutoSync";

export const runtime = "nodejs";

const CATEGORY_OPTIONS = [
  "Solved Assignments",
  "Question Papers (PYQ)",
  "Handwritten PDFs",
  "Ebooks",
  "projects",
  "Guess Papers",
  "Handwritten Hardcopy (Delivery)",
] as const;

const PAGE_SIZES = [25, 50, 100] as const;

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

function uniqueStrings(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of arr) {
    const v = safeStr(item);
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function escRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getActor(user: any) {
  return safeStr(user?.email || user?._id || user?.id || "admin");
}

function normalizeCategory(input: any) {
  const raw = safeStr(input);
  if (!raw) return "";
  const matched = CATEGORY_OPTIONS.find(
    (c) => c.toLowerCase() === raw.toLowerCase()
  );
  return matched || raw;
}

function normalizePageSize(input: any) {
  const n = Math.trunc(safeNum(input, 25));
  return PAGE_SIZES.includes(n as any) ? n : 25;
}

function sortStringsAsc(arr: string[]) {
  return [...arr].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

async function syncPriceChangedProducts(changes: Array<{ before: any; after: any }>) {
  const errors: string[] = [];

  for (const change of changes) {
    try {
      const result: any = await syncGeneratedCombosForProductChange(change as any);
      if (result && result.ok === false) {
        const reason = safeStr(result.reason || result.error);
        if (reason) errors.push(reason);
      }
    } catch (e: any) {
      const msg = safeStr(e?.message || "Combo sync failed");
      if (msg) errors.push(msg);
    }
  }

  return {
    ok: errors.length === 0,
    errors: uniqueStrings(errors).slice(0, 10),
  };
}

async function applyPriceToMatchedProducts(
  docs: any[],
  price: number,
  oldPrice: number
) {
  const syncChanges: Array<{ before: any; after: any }> = [];
  let updatedCount = 0;

  for (const doc of docs) {
    const before = doc.toObject();
    doc.price = Math.max(0, safeNum(price, 0));
    doc.oldPrice = Math.max(0, safeNum(oldPrice, 0));
    doc.lastModifiedAt = new Date();
    await doc.save();
    updatedCount++;
    syncChanges.push({ before, after: doc.toObject() });
  }

  const comboSync = await syncPriceChangedProducts(syncChanges);

  return {
    updatedCount,
    comboSync,
  };
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!hasPermission(user, "products:read") && !hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden (products permission missing)" }, { status: 403 });
  }

  await dbConnect();

  const url = new URL(req.url);
  const mode = safeStr(url.searchParams.get("mode"));

  if (mode === "preview") {
    const category = normalizeCategory(url.searchParams.get("category"));
    const courseCodes = safeStr(url.searchParams.get("courseCodes"));
    const productId = safeStr(url.searchParams.get("productId"));
    const productSku = safeStr(url.searchParams.get("productSku"));
    const fallbackPrice = safeStr(url.searchParams.get("fallbackPrice"));
    const fallbackOldPrice = safeStr(url.searchParams.get("fallbackOldPrice"));
    const allowFallback = url.searchParams.get("allowFallback") === "1";

    const preview = await resolveProductPricing({
      category,
      courseCodes,
      productId,
      productSku,
      fallbackPrice,
      fallbackOldPrice,
      allowFallback,
    });

    return NextResponse.json({ ok: true, preview }, { status: 200 });
  }

  const q = safeStr(url.searchParams.get("q"));
  const productCategory = normalizeCategory(url.searchParams.get("productCategory"));
  const productCourseCode = normalizePricingCourseCode(url.searchParams.get("productCourseCode"));
  const productSession = safeStr(url.searchParams.get("productSession"));
  const productLanguage = safeStr(url.searchParams.get("productLanguage"));
  const page = Math.max(1, Math.trunc(safeNum(url.searchParams.get("page"), 1)));
  const pageSize = normalizePageSize(url.searchParams.get("pageSize"));

  const productQuery: any = { deletedAt: null };

  if (productCategory) {
    productQuery.category = productCategory;
  }

  if (productCourseCode) {
    productQuery.courseCodes = productCourseCode;
  }

  if (productSession) {
    productQuery.session = productSession;
  }

  if (productLanguage) {
    productQuery.language = productLanguage;
  }

  if (q) {
    const rx = new RegExp(escRegex(q), "i");
    productQuery.$or = [
      { title: rx },
      { sku: rx },
      { subjectCode: rx },
      { courseCodes: rx },
      { courseTitles: rx },
      { session: rx },
      { language: rx },
    ];
  }

  const skip = (page - 1) * pageSize;

  const [
    courses,
    courseRules,
    productOverrides,
    totalProducts,
    products,
    sessionOptionsRaw,
    languageOptionsRaw,
  ] = await Promise.all([
    Course.find({ isActive: { $ne: false } })
      .sort({ code: 1 })
      .select("code title isActive")
      .lean(),
    ProductPricingRule.find({ ruleType: "course_rule" })
      .sort({ updatedAt: -1, _id: -1 })
      .limit(1000)
      .lean(),
    ProductPricingRule.find({ ruleType: "product_override" })
      .sort({ updatedAt: -1, _id: -1 })
      .limit(1000)
      .lean(),
    Product.countDocuments(productQuery),
    Product.find(productQuery)
      .sort({ updatedAt: -1, _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .select(
        "_id title sku category subjectCode courseCodes courseTitles session language price oldPrice isActive availability updatedAt"
      )
      .lean(),
    Product.distinct("session", { deletedAt: null }),
    Product.distinct("language", { deletedAt: null }),
  ]);

  const sessionOptions = sortStringsAsc(
    (Array.isArray(sessionOptionsRaw) ? sessionOptionsRaw : []).map((x) => safeStr(x)).filter(Boolean)
  );

  const languageOptions = sortStringsAsc(
    (Array.isArray(languageOptionsRaw) ? languageOptionsRaw : []).map((x) => safeStr(x)).filter(Boolean)
  );

  return NextResponse.json(
    {
      ok: true,
      categories: CATEGORY_OPTIONS,
      courses,
      courseRules,
      productOverrides,
      products,
      sessionOptions,
      languageOptions,
      pagination: {
        page,
        pageSize,
        pageSizes: PAGE_SIZES,
        totalProducts,
        totalPages: Math.max(1, Math.ceil(totalProducts / pageSize)),
      },
      filters: {
        q,
        productCategory,
        productCourseCode,
        productSession,
        productLanguage,
      },
    },
    { status: 200 }
  );
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden (products:write missing)" }, { status: 403 });
  }

  await dbConnect();

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = safeStr(body?.action);
  const updatedBy = getActor(user);

  if (action === "upsert_course_rule") {
    const category = normalizeCategory(body?.category);
    const price = Math.max(0, safeNum(body?.price, 0));
    const oldPrice = Math.max(0, safeNum(body?.oldPrice, 0));
    const notes = safeStr(body?.notes);
    const isActive = safeBool(body?.isActive, true);
    const applyToExisting = safeBool(body?.applyToExisting, true);
    const selectAllCourses = safeBool(body?.selectAllCourses, false);

    if (!category) {
      return NextResponse.json({ error: "Category required" }, { status: 400 });
    }

    if (price <= 0) {
      return NextResponse.json({ error: "Valid price required" }, { status: 400 });
    }

    const allCourseDocs: any[] = await Course.find({ isActive: { $ne: false } })
      .sort({ code: 1 })
      .select("code title")
      .lean();

    const requestedCourseCodes = uniqueStrings(
      (
        Array.isArray(body?.courseCodes)
          ? body.courseCodes
          : body?.courseCode
          ? [body.courseCode]
          : []
      )
        .map((x: any) => normalizePricingCourseCode(x))
        .filter(Boolean)
    );

    let targetCourseDocs: any[] = [];

    if (selectAllCourses) {
      targetCourseDocs = allCourseDocs.filter((c) => safeStr(c?.code));
    } else {
      if (!requestedCourseCodes.length) {
        return NextResponse.json({ error: "At least one course code required" }, { status: 400 });
      }

      const byCode = new Map<string, any>();
      for (const c of allCourseDocs) {
        const code = normalizePricingCourseCode(c?.code);
        if (code && !byCode.has(code)) byCode.set(code, c);
      }

      const missing = requestedCourseCodes.filter((code) => !byCode.has(code));
      if (missing.length) {
        return NextResponse.json(
          {
            error: `Some course codes not found in master courses: ${missing.join(", ")}`,
          },
          { status: 400 }
        );
      }

      targetCourseDocs = requestedCourseCodes.map((code) => byCode.get(code)).filter(Boolean);
    }

    if (!targetCourseDocs.length) {
      return NextResponse.json({ error: "No active courses found to apply pricing rule" }, { status: 400 });
    }

    const savedRules: any[] = [];
    const ruleKeys: string[] = [];

    for (const courseDoc of targetCourseDocs) {
      const courseCode = normalizePricingCourseCode(courseDoc?.code);
      const courseTitle = safeStr(courseDoc?.title);
      const ruleKey = buildCourseRuleKey(category, courseCode);

      const rule: any = await ProductPricingRule.findOneAndUpdate(
        { key: ruleKey },
        {
          $set: {
            key: ruleKey,
            ruleType: "course_rule",
            category,
            courseCode,
            courseTitle,
            price,
            oldPrice,
            isActive,
            notes,
            updatedBy,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      savedRules.push(rule);
      ruleKeys.push(ruleKey);
    }

    let applyResult = {
      updatedCount: 0,
      comboSync: { ok: true, errors: [] as string[] },
    };

    const selectedCourseCodes = targetCourseDocs
      .map((c) => normalizePricingCourseCode(c?.code))
      .filter(Boolean);

    if (applyToExisting && isActive && selectedCourseCodes.length) {
      const docs: any[] = await Product.find({
        deletedAt: null,
        category,
        courseCodes: { $in: selectedCourseCodes },
      });

      applyResult = await applyPriceToMatchedProducts(docs, price, oldPrice);

      await ProductPricingRule.updateMany(
        { key: { $in: ruleKeys } },
        { $set: { lastAppliedAt: new Date() } }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: selectAllCourses
          ? `Pricing rule saved for all active courses (${savedRules.length}).`
          : `Pricing rule saved for ${savedRules.length} selected course(s).`,
        savedRuleCount: savedRules.length,
        savedCourseCodes: selectedCourseCodes,
        appliedToExistingProducts: applyResult,
      },
      { status: 200 }
    );
  }

  if (action === "batch_product_override") {
    const productIds = Array.isArray(body?.productIds)
      ? uniqueStrings(body.productIds.map((x: any) => safeStr(x)))
      : [];

    const price = Math.max(0, safeNum(body?.price, 0));
    const oldPrice = Math.max(0, safeNum(body?.oldPrice, 0));
    const notes = safeStr(body?.notes);
    const isActive = safeBool(body?.isActive, true);
    const applyToExisting = safeBool(body?.applyToExisting, true);

    if (!productIds.length) {
      return NextResponse.json({ error: "At least one product must be selected" }, { status: 400 });
    }

    if (price <= 0) {
      return NextResponse.json({ error: "Valid override price required" }, { status: 400 });
    }

    const docs: any[] = await Product.find({
      _id: { $in: productIds },
      deletedAt: null,
    });

    if (!docs.length) {
      return NextResponse.json({ error: "Selected products not found" }, { status: 404 });
    }

    for (const doc of docs) {
      const key = buildProductOverrideKeyFromId(String(doc._id));

      await ProductPricingRule.findOneAndUpdate(
        { key },
        {
          $set: {
            key,
            ruleType: "product_override",
            category: normalizeCategory(doc.category),
            productId: doc._id,
            productSku: normalizePricingSku(doc.sku),
            productTitleSnapshot: safeStr(doc.title),
            price,
            oldPrice,
            isActive,
            notes,
            updatedBy,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );
    }

    let applyResult = {
      updatedCount: 0,
      comboSync: { ok: true, errors: [] as string[] },
    };

    if (applyToExisting && isActive) {
      applyResult = await applyPriceToMatchedProducts(docs, price, oldPrice);

      await ProductPricingRule.updateMany(
        {
          ruleType: "product_override",
          productId: { $in: docs.map((d) => d._id) },
        },
        {
          $set: {
            lastAppliedAt: new Date(),
          },
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Selected product overrides saved successfully.",
        affectedProducts: docs.length,
        appliedToExistingProducts: applyResult,
      },
      { status: 200 }
    );
  }

  if (action === "delete_rule") {
    const ruleId = safeStr(body?.ruleId);
    if (!ruleId) {
      return NextResponse.json({ error: "ruleId required" }, { status: 400 });
    }

    const deleted = await ProductPricingRule.findByIdAndDelete(ruleId);
    if (!deleted) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Pricing rule deleted successfully.",
      },
      { status: 200 }
    );
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}