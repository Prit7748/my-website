// app/api/admin/combo-category-settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ComboCategorySetting from "@/models/ComboCategorySetting";
import { requireAdmin } from "@/lib/adminAuth";

const ALLOWED_CATEGORY_SLUGS = new Set([
  "solved-assignments",
  "question-papers",
  "guess-papers",
  "ebooks-notes",
  "handwritten-pdfs",
  "handwritten-hardcopy",
  "projects-synopsis",
]);

const ALLOWED_DISCOUNT_TYPES = new Set(["percent"]);

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

function validationError(message: string, field?: string) {
  return NextResponse.json({ error: message, field: field || "" }, { status: 400 });
}

function categoryLabelFromSlug(slug: string) {
  const s = safeStr(slug).toLowerCase();
  if (s === "solved-assignments") return "Solved Assignments";
  if (s === "question-papers") return "Question Papers (PYQ)";
  if (s === "guess-papers") return "Guess Papers";
  if (s === "ebooks-notes") return "eBooks/Notes";
  if (s === "handwritten-pdfs") return "Handwritten PDFs";
  if (s === "handwritten-hardcopy") return "Handwritten Hardcopy (Delivery)";
  if (s === "projects-synopsis") return "Projects & Synopsis";
  return slug;
}

function getAdminActor(admin: any) {
  return (
    safeStr((admin as any)?.decoded?.email) ||
    safeStr((admin as any)?.decoded?.name) ||
    safeStr((admin as any)?.decoded?.id)
  );
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  await dbConnect();

  const url = new URL(req.url);
  const categorySlug = safeStr(url.searchParams.get("categorySlug")).toLowerCase();

  const query: any = {};
  if (categorySlug) query.categorySlug = categorySlug;

  const settings = await ComboCategorySetting.find(query).sort({ categorySlug: 1 });

  return NextResponse.json(
    {
      ok: true,
      count: settings.length,
      settings,
    },
    { status: 200 }
  );
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  await dbConnect();

  const categorySlug = safeStr(body?.categorySlug).toLowerCase();
  if (!categorySlug || !ALLOWED_CATEGORY_SLUGS.has(categorySlug)) {
    return validationError("Invalid categorySlug.", "categorySlug");
  }

  const discountType = safeStr(body?.discountType || "percent").toLowerCase();
  if (!ALLOWED_DISCOUNT_TYPES.has(discountType)) {
    return validationError("Invalid discountType.", "discountType");
  }

  const exists = await ComboCategorySetting.findOne({ categorySlug }).select("_id categorySlug");
  if (exists) {
    return NextResponse.json(
      {
        error: "Category setting already exists",
        field: "categorySlug",
        conflictValue: categorySlug,
      },
      { status: 409 }
    );
  }

  try {
    const actor = getAdminActor(admin);

    const doc = await ComboCategorySetting.create({
      categorySlug,
      categoryLabel: safeStr(body?.categoryLabel) || categoryLabelFromSlug(categorySlug),

      isActive: safeBool(body?.isActive, true),
      comboEnabled: safeBool(body?.comboEnabled, true),
      manualCombosEnabled: safeBool(body?.manualCombosEnabled, true),
      makeOwnComboEnabled: safeBool(body?.makeOwnComboEnabled, false),

      discountType,
      discountValue: Math.max(0, Math.min(100, safeNum(body?.discountValue, 0))),

      builderRules: {
        minProductsRequired: Math.max(
          0,
          Math.trunc(safeNum(body?.builderRules?.minProductsRequired, 0))
        ),
        maxProductsAllowed: Math.max(
          0,
          Math.trunc(safeNum(body?.builderRules?.maxProductsAllowed, 0))
        ),
        sameCategoryOnly: safeBool(body?.builderRules?.sameCategoryOnly, true),
        sameSubjectOnly: safeBool(body?.builderRules?.sameSubjectOnly, false),
        sameMediumOnly: safeBool(body?.builderRules?.sameMediumOnly, false),
      },

      ui: {
        makeOwnComboText: safeStr(body?.ui?.makeOwnComboText),
      },

      createdBy: actor,
      updatedBy: actor,
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Combo category setting created ✅",
        setting: doc,
      },
      { status: 201 }
    );
  } catch (e: any) {
    if (e?.code === 11000) {
      const key = Object.keys(e?.keyPattern || e?.keyValue || {})[0] || "unknown";
      const val = e?.keyValue?.[key];
      return NextResponse.json(
        {
          error: `${String(key).toUpperCase()} already exists`,
          field: key,
          conflictValue: safeStr(val),
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: e?.message || "Failed to create category setting" },
      { status: 500 }
    );
  }
}