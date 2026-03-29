import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Course from "@/models/Course";
import OnDemandTimingRule, {
  ON_DEMAND_DEFAULT_COURSE_KEY,
  normalizeOnDemandTimingCategoryKey,
  normalizeOnDemandTimingCourseCode,
  resolveOnDemandTimingCourseKey,
} from "@/models/OnDemandTimingRule";
import { getAuthUser, hasPermission } from "@/lib/auth";
import { CATEGORY_CONFIG } from "@/lib/productCatalog";

export const runtime = "nodejs";

const TimingRuleModel: any = OnDemandTimingRule;

let syncIndexesOncePromise: Promise<any> | null = null;

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeBool(x: any, def = false) {
  if (typeof x === "boolean") return x;
  if (typeof x === "number") return x === 1;
  const v = safeStr(x).toLowerCase();
  if (["true", "1", "yes", "on"].includes(v)) return true;
  if (["false", "0", "no", "off"].includes(v)) return false;
  return def;
}

function clampMinutes(input: any, fallback = 20) {
  const n = Number(input);
  if (!Number.isFinite(n)) return fallback;
  const v = Math.trunc(n);
  return Math.min(1440, Math.max(1, v));
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

function getUserId(user: any) {
  return safeStr(user?._id || user?.id || user?.userId || user?.email || "");
}

function getAllowedCategoryLabels() {
  return uniqueStrings(
    (Array.isArray(CATEGORY_CONFIG) ? CATEGORY_CONFIG : [])
      .map((x: any) => safeStr(x?.label))
      .filter(Boolean)
  );
}

function normalizeCategoryLabel(input: any) {
  const value = safeStr(input);
  if (!value) return "";

  const allowed = getAllowedCategoryLabels();
  const matched = allowed.find(
    (label) =>
      normalizeOnDemandTimingCategoryKey(label) ===
      normalizeOnDemandTimingCategoryKey(value)
  );

  return matched || value;
}

async function ensureIndexesSyncedOnce() {
  if (!syncIndexesOncePromise) {
    syncIndexesOncePromise = TimingRuleModel.syncIndexes().catch((err: any) => {
      console.error("ON_DEMAND_TIMING_SYNC_INDEXES_ERROR:", err);
      return null;
    });
  }

  await syncIndexesOncePromise;
}

async function resolveCourseTitle(courseCode: string, fallbackTitle = "") {
  const normalizedCode = normalizeOnDemandTimingCourseCode(courseCode);
  if (!normalizedCode) return "";

  const row: any = await Course.findOne({
    code: {
      $regex: `^${normalizedCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      $options: "i",
    },
    isActive: { $ne: false },
  })
    .select("code title name titleEn nameEn label")
    .lean()
    .catch(() => null);

  if (!row) return safeStr(fallbackTitle);

  return (
    safeStr(row?.title) ||
    safeStr(row?.name) ||
    safeStr(row?.titleEn) ||
    safeStr(row?.nameEn) ||
    safeStr(row?.label) ||
    safeStr(fallbackTitle)
  );
}

function normalizeRuleRow(row: any) {
  const rawCourseCodeKey = safeStr(row?.courseCodeKey).toUpperCase();
  const isDefault =
    !rawCourseCodeKey || rawCourseCodeKey === ON_DEMAND_DEFAULT_COURSE_KEY;

  return {
    _id: safeStr(row?._id),
    categoryLabel: safeStr(row?.categoryLabel),
    categoryKey: safeStr(row?.categoryKey),
    courseCode: isDefault ? "" : safeStr(row?.courseCode),
    courseCodeKey: isDefault ? "" : rawCourseCodeKey,
    courseTitle: isDefault ? "" : safeStr(row?.courseTitle),
    ruleType: isDefault ? "category_default" : "course_override",
    deliverWithinMinutes: clampMinutes(row?.deliverWithinMinutes, 20),
    onDemandNote: safeStr(row?.onDemandNote),
    isActive: safeBool(row?.isActive, true),
    updatedBy: safeStr(row?.updatedBy),
    createdAt: row?.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    lastModifiedAt: row?.lastModifiedAt ? new Date(row.lastModifiedAt).toISOString() : null,
  };
}

function buildGroupedResponse(rows: any[]) {
  const grouped = new Map<
    string,
    {
      categoryLabel: string;
      categoryKey: string;
      defaultRule: any | null;
      courseOverrides: any[];
    }
  >();

  for (const rawRow of Array.isArray(rows) ? rows : []) {
    const row = normalizeRuleRow(rawRow);
    const categoryLabel = safeStr(row.categoryLabel);
    const categoryKey = safeStr(row.categoryKey);

    if (!grouped.has(categoryKey)) {
      grouped.set(categoryKey, {
        categoryLabel,
        categoryKey,
        defaultRule: null,
        courseOverrides: [],
      });
    }

    const bucket = grouped.get(categoryKey)!;

    if (row.ruleType === "course_override" && row.courseCodeKey) {
      bucket.courseOverrides.push(row);
    } else {
      bucket.defaultRule = row;
    }
  }

  return Array.from(grouped.values())
    .map((bucket) => ({
      ...bucket,
      courseOverrides: bucket.courseOverrides.sort((a, b) =>
        safeStr(a.courseCode).localeCompare(safeStr(b.courseCode), undefined, {
          numeric: true,
        })
      ),
      totalRules: (bucket.defaultRule ? 1 : 0) + bucket.courseOverrides.length,
    }))
    .sort((a, b) =>
      safeStr(a.categoryLabel).localeCompare(safeStr(b.categoryLabel), undefined, {
        numeric: true,
      })
    );
}

async function findExistingRuleForWrite(params: {
  categoryKey: string;
  courseCode: string;
  courseCodeKey: string;
  ruleType: "category_default" | "course_override";
}) {
  const { categoryKey, courseCode, courseCodeKey, ruleType } = params;

  if (ruleType === "category_default") {
    const existingDefault: any = await TimingRuleModel.findOne({
      categoryKey,
      $or: [
        { courseCodeKey: ON_DEMAND_DEFAULT_COURSE_KEY },
        { courseCodeKey: "" },
        { courseCodeKey: { $exists: false } },
        { courseCode: "" },
        { courseCode: { $exists: false } },
        { ruleType: "category_default" },
      ],
    })
      .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
      .lean();

    return existingDefault || null;
  }

  const existingOverride: any = await TimingRuleModel.findOne({
    categoryKey,
    $or: [{ courseCodeKey }, { courseCode }],
  })
    .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
    .lean();

  return existingOverride || null;
}

async function normalizeLegacyRowsForCategory(categoryKey: string) {
  await TimingRuleModel.updateMany(
    {
      categoryKey,
      $and: [
        {
          $or: [
            { courseCodeKey: { $exists: false } },
            { courseCodeKey: "" },
          ],
        },
        {
          $or: [
            { courseCode: { $exists: false } },
            { courseCode: "" },
          ],
        },
      ],
    },
    {
      $set: {
        courseCode: "",
        courseCodeKey: ON_DEMAND_DEFAULT_COURSE_KEY,
        ruleType: "category_default",
        lastModifiedAt: new Date(),
      },
    }
  ).catch(() => null);
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (
      !hasPermission(user, "products:read") &&
      !hasPermission(user, "products:write")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();
    await ensureIndexesSyncedOnce();

    const url = new URL(req.url);
    const category = normalizeCategoryLabel(url.searchParams.get("category"));
    const courseCode = normalizeOnDemandTimingCourseCode(
      url.searchParams.get("courseCode")
    );
    const onlyActive = safeStr(url.searchParams.get("onlyActive")).toLowerCase();
    const grouped = safeStr(url.searchParams.get("grouped")).toLowerCase();

    const query: Record<string, any> = {};

    if (category) {
      query.categoryKey = normalizeOnDemandTimingCategoryKey(category);
    }

    if (courseCode) {
      query.courseCodeKey = resolveOnDemandTimingCourseKey(courseCode);
    }

    if (["1", "true", "yes"].includes(onlyActive)) {
      query.isActive = true;
    }

    const rows: any[] = await TimingRuleModel.find(query)
      .select(
        "_id categoryLabel categoryKey courseCode courseCodeKey courseTitle ruleType deliverWithinMinutes onDemandNote isActive updatedBy createdAt updatedAt lastModifiedAt"
      )
      .sort({ categoryLabel: 1, ruleType: 1, courseCode: 1, updatedAt: -1, _id: -1 })
      .lean();

    const normalizedRows = rows.map(normalizeRuleRow);

    const payload =
      grouped === "0" || grouped === "false"
        ? normalizedRows
        : buildGroupedResponse(rows);

    return NextResponse.json(
      {
        ok: true,
        items: payload,
        meta: {
          allowedCategoryLabels: getAllowedCategoryLabels(),
          totalRules: rows.length,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("ON_DEMAND_TIMING_RULES_GET_ERROR:", error);
    return NextResponse.json(
      {
        error: safeStr(error?.message || "Failed to load timing rules"),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!hasPermission(user, "products:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    await dbConnect();
    await ensureIndexesSyncedOnce();

    const categoryLabel = normalizeCategoryLabel(
      body?.categoryLabel || body?.category
    );
    if (!categoryLabel) {
      return NextResponse.json({ error: "Category required" }, { status: 400 });
    }

    const categoryKey = normalizeOnDemandTimingCategoryKey(categoryLabel);
    const courseCode = normalizeOnDemandTimingCourseCode(body?.courseCode);
    const courseCodeKey = resolveOnDemandTimingCourseKey(courseCode);
    const ruleType =
      courseCodeKey === ON_DEMAND_DEFAULT_COURSE_KEY
        ? "category_default"
        : "course_override";

    await normalizeLegacyRowsForCategory(categoryKey);

    const deliverWithinMinutes = clampMinutes(body?.deliverWithinMinutes, 20);
    const onDemandNote = safeStr(body?.onDemandNote);
    const isActive = safeBool(body?.isActive, true);
    const updatedBy = getUserId(user);

    const courseTitle =
      ruleType === "course_override"
        ? await resolveCourseTitle(courseCode, body?.courseTitle)
        : "";

    const existingRule = await findExistingRuleForWrite({
      categoryKey,
      courseCode,
      courseCodeKey,
      ruleType,
    });

    const filter: Record<string, any> = existingRule?._id
      ? { _id: existingRule._id }
      : { categoryKey, courseCodeKey };

    const update: Record<string, any> = {
      $set: {
        categoryLabel,
        categoryKey,
        courseCode: ruleType === "course_override" ? courseCode : "",
        courseCodeKey,
        courseTitle,
        ruleType,
        deliverWithinMinutes,
        onDemandNote,
        isActive,
        updatedBy,
        lastModifiedAt: new Date(),
      },
    };

    const options: Record<string, any> = {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    };

    let doc: any;

    try {
      doc = await TimingRuleModel.findOneAndUpdate(filter, update, options).lean();
    } catch (error: any) {
      if (error?.code === 11000) {
        await ensureIndexesSyncedOnce();

        const retryExistingRule = await findExistingRuleForWrite({
          categoryKey,
          courseCode,
          courseCodeKey,
          ruleType,
        });

        const retryFilter: Record<string, any> = retryExistingRule?._id
          ? { _id: retryExistingRule._id }
          : { categoryKey, courseCodeKey };

        doc = await TimingRuleModel.findOneAndUpdate(
          retryFilter,
          update,
          options
        ).lean();
      } else {
        throw error;
      }
    }

    return NextResponse.json(
      {
        ok: true,
        message:
          ruleType === "course_override"
            ? "Course override timing rule saved successfully."
            : "Category default timing rule saved successfully.",
        item: normalizeRuleRow(doc),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("ON_DEMAND_TIMING_RULES_POST_ERROR:", error);

    if (error?.name === "ValidationError") {
      const firstMessage =
        Object.values(error?.errors || {})[0] &&
        typeof Object.values(error.errors || {})[0] === "object"
          ? safeStr((Object.values(error.errors || {})[0] as any)?.message)
          : "Validation failed";

      return NextResponse.json(
        {
          error: firstMessage || "Validation failed",
        },
        { status: 400 }
      );
    }

    if (error?.code === 11000) {
      return NextResponse.json(
        {
          error:
            "Database me old duplicate/legacy unique index conflict hai. Ab next step me cleanup fix karna padega.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: safeStr(error?.message || "Failed to save timing rule"),
      },
      { status: 500 }
    );
  }
}