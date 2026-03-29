import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Course from "@/models/Course";
import OnDemandTimingRule, {
  normalizeOnDemandTimingCategoryKey,
  normalizeOnDemandTimingCourseCode,
} from "@/models/OnDemandTimingRule";
import { getAuthUser, hasPermission } from "@/lib/auth";
import { CATEGORY_CONFIG } from "@/lib/productCatalog";

export const runtime = "nodejs";

const TimingRuleModel: any = OnDemandTimingRule;

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

function getUserId(user: any) {
  return safeStr(user?._id || user?.id || user?.userId || user?.email || "");
}

function getAllowedCategoryLabels() {
  return (Array.isArray(CATEGORY_CONFIG) ? CATEGORY_CONFIG : [])
    .map((x: any) => safeStr(x?.label))
    .filter(Boolean);
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

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  await dbConnect();

  const existing: any = await TimingRuleModel.findById(id);
  if (!existing) {
    return NextResponse.json(
      { error: "Timing rule not found" },
      { status: 404 }
    );
  }

  const nextCategoryLabel =
    body?.categoryLabel !== undefined || body?.category !== undefined
      ? normalizeCategoryLabel(body?.categoryLabel || body?.category)
      : safeStr(existing?.categoryLabel);

  if (!nextCategoryLabel) {
    return NextResponse.json({ error: "Category required" }, { status: 400 });
  }

  const nextCategoryKey =
    normalizeOnDemandTimingCategoryKey(nextCategoryLabel);

  const nextCourseCode =
    body?.courseCode !== undefined
      ? normalizeOnDemandTimingCourseCode(body?.courseCode)
      : safeStr(existing?.courseCodeKey || existing?.courseCode);

  const nextRuleType = nextCourseCode
    ? "course_override"
    : "category_default";

  const nextDeliverWithinMinutes =
    body?.deliverWithinMinutes !== undefined
      ? clampMinutes(body?.deliverWithinMinutes, 20)
      : clampMinutes(existing?.deliverWithinMinutes, 20);

  const nextOnDemandNote =
    body?.onDemandNote !== undefined
      ? safeStr(body?.onDemandNote)
      : safeStr(existing?.onDemandNote);

  const nextIsActive =
    body?.isActive !== undefined
      ? safeBool(body?.isActive, true)
      : safeBool(existing?.isActive, true);

  const nextCourseTitle = nextCourseCode
    ? await resolveCourseTitle(
        nextCourseCode,
        body?.courseTitle !== undefined
          ? body?.courseTitle
          : existing?.courseTitle
      )
    : "";

  const duplicate: any = await TimingRuleModel.findOne({
    _id: { $ne: id },
    categoryKey: nextCategoryKey,
    courseCodeKey: nextCourseCode,
  })
    .select("_id")
    .lean();

  if (duplicate) {
    return NextResponse.json(
      {
        error: "Same category + course rule already exists",
        field: nextCourseCode ? "courseCode" : "categoryLabel",
      },
      { status: 409 }
    );
  }

  existing.categoryLabel = nextCategoryLabel;
  existing.categoryKey = nextCategoryKey;
  existing.courseCode = nextCourseCode;
  existing.courseCodeKey = nextCourseCode;
  existing.courseTitle = nextCourseTitle;
  existing.ruleType = nextRuleType;
  existing.deliverWithinMinutes = nextDeliverWithinMinutes;
  existing.onDemandNote = nextOnDemandNote;
  existing.isActive = nextIsActive;
  existing.updatedBy = getUserId(user);
  existing.lastModifiedAt = new Date();

  await existing.save();

  return NextResponse.json(
    {
      ok: true,
      message: "Timing rule updated successfully.",
      item: {
        _id: safeStr(existing?._id),
        categoryLabel: safeStr(existing?.categoryLabel),
        categoryKey: safeStr(existing?.categoryKey),
        courseCode: safeStr(existing?.courseCode),
        courseCodeKey: safeStr(existing?.courseCodeKey),
        courseTitle: safeStr(existing?.courseTitle),
        ruleType: safeStr(existing?.ruleType),
        deliverWithinMinutes: clampMinutes(
          existing?.deliverWithinMinutes,
          20
        ),
        onDemandNote: safeStr(existing?.onDemandNote),
        isActive: safeBool(existing?.isActive, true),
        updatedBy: safeStr(existing?.updatedBy),
        createdAt: existing?.createdAt
          ? new Date(existing.createdAt).toISOString()
          : null,
        updatedAt: existing?.updatedAt
          ? new Date(existing.updatedAt).toISOString()
          : null,
        lastModifiedAt: existing?.lastModifiedAt
          ? new Date(existing.lastModifiedAt).toISOString()
          : null,
      },
    },
    { status: 200 }
  );
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  await dbConnect();

  const existing: any = await TimingRuleModel.findById(id).lean();
  if (!existing) {
    return NextResponse.json(
      { error: "Timing rule not found" },
      { status: 404 }
    );
  }

  await TimingRuleModel.deleteOne({ _id: id });

  return NextResponse.json(
    {
      ok: true,
      message: "Timing rule deleted successfully.",
      deleted: {
        _id: safeStr(existing?._id),
        categoryLabel: safeStr(existing?.categoryLabel),
        courseCode: safeStr(existing?.courseCode),
        ruleType: safeStr(existing?.ruleType),
      },
    },
    { status: 200 }
  );
}