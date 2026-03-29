import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Combo from "@/models/Combo";
import Product from "@/models/Product";
import ComboCategorySetting from "@/models/ComboCategorySetting";
import { requireAdmin } from "@/lib/adminAuth";
import { calculateComboPricingFromMasterDiscount } from "@/lib/comboPricing";

const ALLOWED_CATEGORY_SLUGS = new Set([
  "solved-assignments",
  "question-papers",
  "guess-papers",
  "ebooks-notes",
  "handwritten-pdfs",
  "handwritten-hardcopy",
  "projects-synopsis",
]);

const ALLOWED_COMBO_KINDS = new Set([
  "auto",
  "custom",
  "pyq_3y",
  "pyq_5y",
  "admin",
]);

const ALLOWED_STATUS = new Set(["active", "inactive", "draft"]);

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

function safeArr(x: any) {
  if (Array.isArray(x)) return x;
  if (typeof x === "string") {
    return x
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function uniqueStrings(arr: any[], upper = false) {
  return Array.from(
    new Set(
      (Array.isArray(arr) ? arr : [])
        .map((x) => (upper ? safeStr(x).toUpperCase() : safeStr(x)))
        .filter(Boolean)
    )
  );
}

function toSlug(input: any) {
  return safeStr(input)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
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

function productCategoryFromCategorySlug(slug: string) {
  const s = safeStr(slug).toLowerCase();
  if (s === "solved-assignments") return "Solved Assignments";
  if (s === "question-papers") return "Question Papers (PYQ)";
  if (s === "guess-papers") return "Guess Papers";
  if (s === "ebooks-notes") return "eBooks/Notes";
  if (s === "handwritten-pdfs") return "Handwritten PDFs";
  if (s === "handwritten-hardcopy") return "Handwritten Hardcopy (Delivery)";
  if (s === "projects-synopsis") return "Projects & Synopsis";
  return "";
}

function inferVariant(categorySlug: string, comboKind: string) {
  if (comboKind === "pyq_3y" || comboKind === "pyq_5y" || categorySlug === "question-papers") {
    return "pyq";
  }
  if (categorySlug === "handwritten-hardcopy") return "hardcopy";
  return "default";
}

function buildDynamicProductThumb(p: any) {
  const category = safeStr(p?.category);
  const subjectCode = safeStr(p?.subjectCode).toUpperCase();
  const title = safeStr(p?.subjectTitleEn) || safeStr(p?.subjectTitleHi) || safeStr(p?.title);
  const session = safeStr(p?.session);
  const medium = safeStr(p?.language);
  const firstCourseCode =
    Array.isArray(p?.courseCodes) && p.courseCodes[0]
      ? safeStr(p.courseCodes[0]).toUpperCase()
      : "";

  const params = new URLSearchParams();
  if (subjectCode) params.set("code", subjectCode);
  if (title) params.set("title", title);
  if (session) params.set("session", session);
  if (medium) params.set("medium", medium);
  if (firstCourseCode) params.set("course", firstCourseCode);

  if (category === "Solved Assignments") {
    return `/api/thumb/assignment?${params.toString()}`;
  }

  if (category === "Handwritten Hardcopy (Delivery)") {
    return `/api/thumb/hardcopy?${params.toString()}`;
  }

  return "";
}

async function buildSnapshotFromProductIds(productIds: string[]) {
  if (!productIds.length) return [];

  const docs: any[] = await Product.find({
    _id: { $in: productIds },
    isActive: true,
    availability: "available",
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  })
    .select({
      _id: 1,
      title: 1,
      slug: 1,
      category: 1,
      subjectCode: 1,
      subjectTitleEn: 1,
      subjectTitleHi: 1,
      courseCodes: 1,
      courseTitles: 1,
      language: 1,
      lang3: 1,
      session: 1,
      session6: 1,
      price: 1,
      thumbnailUrl: 1,
      quickUrl: 1,
      images: 1,
    })
    .lean();

  const order = new Map(productIds.map((id, idx) => [String(id), idx]));
  docs.sort((a, b) => (order.get(String(a._id)) ?? 0) - (order.get(String(b._id)) ?? 0));

  return docs.map((p) => ({
    productId: p._id,
    title: safeStr(p.title),
    slug: toSlug(p.slug || p.title),
    category: safeStr(p.category),
    subjectCode: safeStr(p.subjectCode).toUpperCase(),
    subjectTitleEn: safeStr(p.subjectTitleEn),
    subjectTitleHi: safeStr(p.subjectTitleHi),
    medium: safeStr(p.language),
    lang3: safeStr(p.lang3).toUpperCase(),
    session: safeStr(p.session),
    session6: safeStr(p.session6),
    courseCodes: uniqueStrings(safeArr(p.courseCodes), true),
    courseTitles: uniqueStrings(safeArr(p.courseTitles), false),
    price: Math.max(0, safeNum(p.price, 0)),
    thumbUrl:
      safeStr(p.thumbnailUrl) ||
      safeStr(p.quickUrl) ||
      (Array.isArray(p.images) && p.images[0] ? safeStr(p.images[0]) : "") ||
      buildDynamicProductThumb(p),
  }));
}

function deriveCourseCodesFromSnapshot(itemsSnapshot: any[], fallback: any[] = []) {
  const fromItems = (Array.isArray(itemsSnapshot) ? itemsSnapshot : []).flatMap((item: any) =>
    safeArr(item?.courseCodes).map((x: any) => safeStr(x).toUpperCase())
  );

  return uniqueStrings([...fromItems, ...safeArr(fallback).map((x: any) => safeStr(x).toUpperCase())], true);
}

function deriveSingleValue(values: any[], upper = false) {
  const arr = uniqueStrings(values, upper);
  return arr.length === 1 ? arr[0] : "";
}

function sessionSortValue(session6: string, session: string) {
  const s6 = safeStr(session6);
  if (/^\d{6}$/.test(s6)) return Number(s6);

  const raw = safeStr(session).toUpperCase();
  const m = raw.match(/(JUN|JUNE|DEC|DECEMBER)[\s\-]*(\d{2,4})/i);
  if (m) {
    const monRaw = m[1].toUpperCase();
    const yyRaw = m[2];
    const year = yyRaw.length === 2 ? Number(`20${yyRaw}`) : Number(yyRaw);
    const mm = monRaw.startsWith("JUN") ? 6 : 12;
    return year * 100 + mm;
  }

  const nums = raw.replace(/\D/g, "");
  if (nums.length >= 6) return Number(nums.slice(0, 6));
  if (nums.length === 4) return Number(`${nums}00`);
  return 0;
}

function buildSessionRangeLabel(itemsSnapshot: any[]) {
  const rows = Array.isArray(itemsSnapshot) ? [...itemsSnapshot] : [];
  if (!rows.length) return "";

  rows.sort(
    (a, b) =>
      sessionSortValue(safeStr(b?.session6), safeStr(b?.session)) -
      sessionSortValue(safeStr(a?.session6), safeStr(a?.session))
  );

  const first = safeStr(rows[0]?.session);
  const last = safeStr(rows[rows.length - 1]?.session);

  if (first && last && first !== last) return `${first} to ${last}`;
  return first || "";
}

async function makeUniqueComboSlug(base: string, excludeId: string) {
  const clean = toSlug(base) || "combo";
  let slug = clean;
  let i = 1;

  while (await Combo.findOne({ slug, _id: { $ne: excludeId } }).select("_id")) {
    i += 1;
    slug = `${clean}-${i}`;
  }

  return slug;
}

async function loadCategoryMasterSettings(categorySlug: string) {
  const setting: any = await ComboCategorySetting.findOne({
    categorySlug,
    isActive: true,
    comboEnabled: true,
  })
    .select({
      _id: 1,
      categorySlug: 1,
      categoryLabel: 1,
      isActive: 1,
      comboEnabled: 1,
      manualCombosEnabled: 1,
      makeOwnComboEnabled: 1,
      discountType: 1,
      discountValue: 1,
    })
    .lean();

  if (!setting) {
    return {
      ok: false as const,
      error: `${categoryLabelFromSlug(categorySlug)} ke liye active category setting nahi mili.`,
    };
  }

  const discountType = safeStr(setting?.discountType).toLowerCase();
  const discountValue = Math.max(0, Math.min(100, safeNum(setting?.discountValue, 0)));

  if (discountType !== "percent" || discountValue <= 0) {
    return {
      ok: false as const,
      error: `${categoryLabelFromSlug(categorySlug)} ke liye valid master discount % set kijiye.`,
    };
  }

  return {
    ok: true as const,
    setting,
    pricing: {
      discountValue,
      roundOfferPrice: true,
    },
  };
}

function getAdminActor(admin: any) {
  return (
    safeStr(admin?.decoded?.email) ||
    safeStr(admin?.decoded?.name) ||
    safeStr(admin?.decoded?.id)
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
    return NextResponse.json({ error: "Combo id required" }, { status: 400 });
  }

  await dbConnect();

  const combo = await Combo.findById(id);

  if (!combo) {
    return NextResponse.json({ error: "Combo not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, combo }, { status: 200 });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { id } = await params;
  if (!safeStr(id)) {
    return NextResponse.json({ error: "Combo id required" }, { status: 400 });
  }

  const action = safeStr(new URL(req.url).searchParams.get("action")).toLowerCase();
  if (!action) {
    return NextResponse.json({ error: "Action required" }, { status: 400 });
  }

  await dbConnect();

  const existing: any = await Combo.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Combo not found" }, { status: 404 });
  }

  if (action === "restore") {
    if (!existing.deletedAt) {
      return NextResponse.json({ ok: true, message: "Combo already active" }, { status: 200 });
    }

    existing.deletedAt = null;
    existing.deletedBy = "";
    existing.updatedBy = getAdminActor(admin);
    await existing.save();

    return NextResponse.json({ ok: true, message: "Combo restored ✅" }, { status: 200 });
  }

  if (action === "purge") {
    await Combo.deleteOne({ _id: existing._id });
    return NextResponse.json(
      { ok: true, message: "Combo permanently deleted ✅" },
      { status: 200 }
    );
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
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
    return NextResponse.json({ error: "Combo id required" }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  await dbConnect();

  const existing: any = await Combo.findOne({
    _id: id,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  });

  if (!existing) {
    return NextResponse.json({ error: "Combo not found" }, { status: 404 });
  }

  const title = safeStr(body?.title || existing.title);
  const categorySlug = safeStr(body?.categorySlug || existing.categorySlug).toLowerCase();
  const comboKind = safeStr(body?.comboKind || existing.comboKind).toLowerCase();
  const status = safeStr(body?.status || existing.status || "draft").toLowerCase();

  if (!title) return validationError("Title required hai.", "title");
  if (!categorySlug || !ALLOWED_CATEGORY_SLUGS.has(categorySlug)) {
    return validationError("Invalid categorySlug.", "categorySlug");
  }
  if (!comboKind || !ALLOWED_COMBO_KINDS.has(comboKind)) {
    return validationError("Invalid comboKind.", "comboKind");
  }
  if (!ALLOWED_STATUS.has(status)) {
    return validationError("Invalid status.", "status");
  }

  const categorySettingsResult = await loadCategoryMasterSettings(categorySlug);
  if (!categorySettingsResult.ok) {
    return validationError(categorySettingsResult.error, "categorySlug");
  }

  const incomingProductIds = body?.productIds
    ? uniqueStrings(safeArr(body.productIds).map((x: any) => safeStr(x)))
    : null;

  let itemsSnapshot = Array.isArray(existing.itemsSnapshot) ? existing.itemsSnapshot : [];
  let productIds = Array.isArray(existing.productIds)
    ? existing.productIds.map((x: any) => String(x))
    : [];

  if (incomingProductIds) {
    productIds = incomingProductIds;
    itemsSnapshot = await buildSnapshotFromProductIds(productIds);

    if (itemsSnapshot.length !== productIds.length) {
      return validationError(
        "Kuch selected products invalid, deleted ya unavailable hain.",
        "productIds"
      );
    }

    const productCategory = productCategoryFromCategorySlug(categorySlug);
    const categoryMismatch = itemsSnapshot.some(
      (item: any) => safeStr(item?.category) !== productCategory
    );
    if (categoryMismatch) {
      return validationError("Combo me sirf same category ke products allowed hain.", "productIds");
    }
  }

  if (!productIds.length || !itemsSnapshot.length) {
    return validationError("At least one real product required hai.", "productIds");
  }

  let slug = safeStr(body?.slug);
  if (slug) slug = toSlug(slug);
  else if (body?.title && safeStr(body.title) !== safeStr(existing.title)) {
    slug = await makeUniqueComboSlug(title, String(existing._id));
  } else {
    slug = safeStr(existing.slug);
  }

  if (!slug) slug = await makeUniqueComboSlug(title, String(existing._id));

  const existsSlug = await Combo.findOne({
    slug,
    _id: { $ne: existing._id },
  }).select("_id slug");

  if (existsSlug) {
    return NextResponse.json(
      { error: "Slug already exists", field: "slug", conflictValue: slug },
      { status: 409 }
    );
  }

  const pricing = calculateComboPricingFromMasterDiscount(
    itemsSnapshot,
    categorySettingsResult.pricing
  );

  const subjectCode =
    safeStr(body?.subjectCode || existing.subjectCode).toUpperCase() ||
    deriveSingleValue(itemsSnapshot.map((item: any) => safeStr(item?.subjectCode)), true);

  const medium =
    safeStr(body?.medium || existing.medium) ||
    deriveSingleValue(itemsSnapshot.map((item: any) => safeStr(item?.medium)), false);

  const lang3 =
    safeStr(body?.lang3 || existing.lang3).toUpperCase() ||
    deriveSingleValue(itemsSnapshot.map((item: any) => safeStr(item?.lang3)), true);

  const sessionRangeLabel =
    safeStr(body?.sessionRangeLabel || existing.sessionRangeLabel) ||
    buildSessionRangeLabel(itemsSnapshot);

  const courseCodes = deriveCourseCodesFromSnapshot(
    itemsSnapshot,
    body?.courseCodes ?? existing.courseCodes ?? []
  );

  const nextSourceType = safeStr(existing.sourceType || "manual").toLowerCase();
  const isGenerated =
    safeBool(existing.isAutoGenerated, false) ||
    nextSourceType === "generated" ||
    nextSourceType === "pyq_generated";

  if (!isGenerated && !safeBool(categorySettingsResult.setting?.manualCombosEnabled, true)) {
    return validationError(
      `${categoryLabelFromSlug(categorySlug)} me manual combo update disabled hai.`,
      "categorySlug"
    );
  }

  const updateDoc: any = {
    title,
    slug,
    shortTitle: safeStr(body?.shortTitle ?? existing.shortTitle),

    categorySlug,
    categoryLabel:
      safeStr(body?.categoryLabel) ||
      safeStr(existing.categoryLabel) ||
      categoryLabelFromSlug(categorySlug),

    comboKind,
    variant: inferVariant(categorySlug, comboKind),
    status,
    isActive:
      body?.isActive !== undefined ? safeBool(body?.isActive, false) : Boolean(existing.isActive),

    isAutoGenerated: isGenerated,
    isMakeOwnComboAllowed:
      body?.isMakeOwnComboAllowed !== undefined
        ? safeBool(body?.isMakeOwnComboAllowed, false)
        : Boolean(existing.isMakeOwnComboAllowed),

    sourceType: nextSourceType || "manual",
    sourceRuleId: safeStr(existing.sourceRuleId),
    sourceTemplateKey: safeStr(existing.sourceTemplateKey),
    generationKey: safeStr(existing.generationKey),
    generationGroupKey: safeStr(existing.generationGroupKey),
    isLockedByAdmin:
      body?.isLockedByAdmin !== undefined
        ? safeBool(body?.isLockedByAdmin, false)
        : Boolean(existing.isLockedByAdmin),
    allowAutoRefresh:
      body?.allowAutoRefresh !== undefined
        ? safeBool(body?.allowAutoRefresh, true)
        : Boolean(existing.allowAutoRefresh),

    subjectCode,
    medium,
    lang3,
    sessionRangeLabel,
    courseCodes,

    description: safeStr(body?.description ?? existing.description),
    shortDescription: safeStr(body?.shortDescription ?? existing.shortDescription),
    badge: safeStr(body?.badge ?? existing.badge),
    itemsLabel: safeStr(body?.itemsLabel ?? existing.itemsLabel) || "Included Bundle Items",
    thumbMode: safeStr(existing.thumbMode || "dynamic"),
    thumbUrl: safeStr(body?.thumbUrl ?? existing.thumbUrl ?? itemsSnapshot?.[0]?.thumbUrl),

    metaTitle: safeStr(body?.metaTitle ?? existing.metaTitle),
    metaDescription: safeStr(body?.metaDescription ?? existing.metaDescription),

    totalMrp: pricing.totalMrp,
    offerPrice: pricing.offerPrice,
    saveAmount: pricing.saveAmount,
    savePercent: pricing.savePercent,
    priceLabel: pricing.priceLabel,
    saveLabel: pricing.saveLabel,
    mediumLabel: medium,
    sessionLabel: sessionRangeLabel,
    pricingSnapshot: pricing.pricingSnapshot,

    rules: {
      minCoPurchaseUsers: safeNum(existing?.rules?.minCoPurchaseUsers, 0),
      minProductsRequired: comboKind === "pyq_3y" ? 6 : comboKind === "pyq_5y" ? 10 : 1,
      maxProductsAllowed: itemsSnapshot.length,
      sameSubjectOnly: comboKind === "pyq_3y" || comboKind === "pyq_5y",
      sameMediumOnly: comboKind === "pyq_3y" || comboKind === "pyq_5y",
      sameCategoryOnly: true,
      useLatestSessionsOnly: comboKind === "pyq_3y" || comboKind === "pyq_5y",
      latestProductCount: comboKind === "pyq_3y" ? 6 : comboKind === "pyq_5y" ? 10 : 0,
      generatedFrom: safeStr(existing?.rules?.generatedFrom),
    },

    builderConfigSnapshot: existing?.builderConfigSnapshot || {
      minProductsRequired: 0,
      maxProductsAllowed: 0,
      sameSubjectOnly: false,
      sameMediumOnly: false,
      sameCategoryOnly: true,
    },

    productIds,
    itemsSnapshot,

    sortOrder:
      body?.sortOrder !== undefined
        ? Math.trunc(safeNum(body?.sortOrder, 0))
        : Math.trunc(safeNum(existing.sortOrder, 0)),

    generatedFromRule: safeStr(existing.generatedFromRule),
    lastGeneratedAt: existing.lastGeneratedAt || null,

    updatedBy: getAdminActor(admin),
  };

  if (!isGenerated) {
    updateDoc.sourceType = "manual";
    updateDoc.sourceRuleId = "";
    updateDoc.sourceTemplateKey = "";
    updateDoc.generationKey = "";
    updateDoc.generationGroupKey = "";
    updateDoc.allowAutoRefresh = false;
  }

  try {
    const updated = await Combo.findByIdAndUpdate(existing._id, updateDoc, {
      new: true,
      runValidators: true,
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Combo updated ✅",
        combo: updated,
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
      { error: e?.message || "Failed to update combo" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { id } = await params;
  if (!safeStr(id)) {
    return NextResponse.json({ error: "Combo id required" }, { status: 400 });
  }

  await dbConnect();

  const existing: any = await Combo.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Combo not found" }, { status: 404 });
  }

  if (existing.deletedAt) {
    return NextResponse.json({ ok: true, message: "Combo already in trash" }, { status: 200 });
  }

  existing.deletedAt = new Date();
  existing.deletedBy = getAdminActor(admin);
  existing.updatedBy = getAdminActor(admin);
  existing.isActive = false;
  existing.status = "inactive";

  await existing.save();

  return NextResponse.json(
    {
      ok: true,
      message: "Combo moved to trash ✅",
    },
    { status: 200 }
  );
}