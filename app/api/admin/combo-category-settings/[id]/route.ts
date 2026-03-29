// app/api/admin/combo-category-settings/[id]/route.ts
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { id } = await params;
  if (!safeStr(id)) {
    return NextResponse.json({ error: "Setting id required" }, { status: 400 });
  }

  await dbConnect();

  const setting = await ComboCategorySetting.findById(id);
  if (!setting) {
    return NextResponse.json({ error: "Setting not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, setting }, { status: 200 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { id } = await params;
  if (!safeStr(id)) {
    return NextResponse.json({ error: "Setting id required" }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  await dbConnect();

  const existing: any = await ComboCategorySetting.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Setting not found" }, { status: 404 });
  }

  const categorySlug = safeStr(body?.categorySlug || existing.categorySlug).toLowerCase();
  if (!categorySlug || !ALLOWED_CATEGORY_SLUGS.has(categorySlug)) {
    return validationError("Invalid categorySlug.", "categorySlug");
  }

  const discountType = safeStr(body?.discountType || existing.discountType || "percent").toLowerCase();
  if (!ALLOWED_DISCOUNT_TYPES.has(discountType)) {
    return validationError("Invalid discountType.", "discountType");
  }

  const conflict = await ComboCategorySetting.findOne({
    categorySlug,
    _id: { $ne: existing._id },
  }).select("_id categorySlug");

  if (conflict) {
    return NextResponse.json(
      {
        error: "Another setting already exists for this category",
        field: "categorySlug",
        conflictValue: categorySlug,
      },
      { status: 409 }
    );
  }

  const updateDoc: any = {
    categorySlug,
    categoryLabel:
      safeStr(body?.categoryLabel) ||
      safeStr(existing.categoryLabel) ||
      categoryLabelFromSlug(categorySlug),

    isActive:
      body?.isActive !== undefined ? safeBool(body?.isActive, true) : Boolean(existing.isActive),

    comboEnabled:
      body?.comboEnabled !== undefined
        ? safeBool(body?.comboEnabled, true)
        : Boolean(existing.comboEnabled),

    manualCombosEnabled:
      body?.manualCombosEnabled !== undefined
        ? safeBool(body?.manualCombosEnabled, true)
        : Boolean(existing.manualCombosEnabled),

    makeOwnComboEnabled:
      body?.makeOwnComboEnabled !== undefined
        ? safeBool(body?.makeOwnComboEnabled, false)
        : Boolean(existing.makeOwnComboEnabled),

    discountType,
    discountValue:
      body?.discountValue !== undefined
        ? Math.max(0, Math.min(100, safeNum(body?.discountValue, 0)))
        : Math.max(0, Math.min(100, safeNum(existing.discountValue, 0))),

    builderRules: {
      minProductsRequired:
        body?.builderRules?.minProductsRequired !== undefined
          ? Math.max(0, Math.trunc(safeNum(body?.builderRules?.minProductsRequired, 0)))
          : Math.max(0, Math.trunc(safeNum(existing?.builderRules?.minProductsRequired, 0))),

      maxProductsAllowed:
        body?.builderRules?.maxProductsAllowed !== undefined
          ? Math.max(0, Math.trunc(safeNum(body?.builderRules?.maxProductsAllowed, 0)))
          : Math.max(0, Math.trunc(safeNum(existing?.builderRules?.maxProductsAllowed, 0))),

      sameCategoryOnly:
        body?.builderRules?.sameCategoryOnly !== undefined
          ? safeBool(body?.builderRules?.sameCategoryOnly, true)
          : existing?.builderRules?.sameCategoryOnly !== undefined
          ? Boolean(existing.builderRules.sameCategoryOnly)
          : true,

      sameSubjectOnly:
        body?.builderRules?.sameSubjectOnly !== undefined
          ? safeBool(body?.builderRules?.sameSubjectOnly, false)
          : Boolean(existing?.builderRules?.sameSubjectOnly),

      sameMediumOnly:
        body?.builderRules?.sameMediumOnly !== undefined
          ? safeBool(body?.builderRules?.sameMediumOnly, false)
          : Boolean(existing?.builderRules?.sameMediumOnly),
    },

    ui: {
      makeOwnComboText: safeStr(body?.ui?.makeOwnComboText ?? existing?.ui?.makeOwnComboText),
    },

    updatedBy: getAdminActor(admin),
  };

  try {
    const updated = await ComboCategorySetting.findByIdAndUpdate(existing._id, updateDoc, {
      new: true,
      runValidators: true,
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Combo category setting updated ✅",
        setting: updated,
      },
      { status: 200 }
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
      { error: e?.message || "Failed to update category setting" },
      { status: 500 }
    );
  }
}