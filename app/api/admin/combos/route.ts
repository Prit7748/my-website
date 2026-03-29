import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Combo from "@/models/Combo";
import Product from "@/models/Product";
import ComboCategorySetting from "@/models/ComboCategorySetting";
import { requireAdmin } from "@/lib/adminAuth";
import { calculateComboPricingFromMasterDiscount } from "@/lib/comboPricing";
import { syncAllGeneratedCombos } from "@/lib/comboAutoSync";

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

function escapeRegex(str: string) {
  return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function normalizeCategory(x: any) {
  return safeStr(x).toLowerCase().replace(/\s+/g, " ").trim();
}

function isSolvedAssignmentCategory(x: any) {
  return normalizeCategory(x) === "solved assignments";
}

function isHardcopyCategory(x: any) {
  return normalizeCategory(x) === "handwritten hardcopy (delivery)";
}

function isPyqCategorySlug(x: any) {
  return safeStr(x).toLowerCase() === "question-papers";
}

function fileNameOf(path: string) {
  const clean = safeStr(path).split("?")[0];
  const parts = clean.split("/");
  return (parts[parts.length - 1] || "").toLowerCase();
}

function sortImagesNamewise(arr: any[]) {
  return (Array.isArray(arr) ? arr : [])
    .map((x) => safeStr(x))
    .filter(Boolean)
    .sort((a, b) =>
      fileNameOf(a).localeCompare(fileNameOf(b), undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
}

function normalizeSession(x: any) {
  const s = safeStr(x);
  if (!s) return "";
  return s.replace(/\s+/g, " ").trim();
}

function extractSubjectTitle(p: any) {
  const lang = safeStr(p?.language || p?.medium).toLowerCase();
  const hi = safeStr(p?.subjectTitleHi);
  const en = safeStr(p?.subjectTitleEn);

  if ((lang === "hindi" || lang.startsWith("hin")) && hi) return hi;
  if ((lang === "english" || lang.startsWith("eng")) && en) return en;

  return hi || en || safeStr(p?.subjectTitle) || safeStr(p?.title) || "";
}

function extractSubjectCode(p: any) {
  const direct =
    safeStr(p?.subjectCode) ||
    safeStr(p?.paperCode) ||
    safeStr(p?.code) ||
    safeStr(p?.subject_code);

  if (direct) return direct.toUpperCase();

  const t = safeStr(p?.title);
  const m = t.match(/\b([A-Z]{2,6})\s*[-]?\s*(\d{2,4})\b/i);
  if (m) return `${safeStr(m[1]).toUpperCase()} ${safeStr(m[2])}`.trim();

  return "";
}

function extractCourseCodesText(p: any) {
  const list = Array.isArray(p?.courseCodes)
    ? p.courseCodes.map((x: any) => safeStr(x).toUpperCase()).filter(Boolean)
    : [];

  if (list.length) return Array.from(new Set(list)).join(", ");

  return safeStr(p?.courseCode || p?.programmeCode || p?.programCode).toUpperCase();
}

function extractMedium(p: any) {
  return safeStr(p?.language) || safeStr(p?.medium) || "";
}

function buildAssignmentMasterThumb(p: any) {
  const session = normalizeSession(p?.session) || "2025-2026";
  const code = extractSubjectCode(p) || "IGNOU";
  const title = extractSubjectTitle(p) || "Solved Assignment";
  const course = extractCourseCodesText(p) || "IGNOU";
  const medium = extractMedium(p) || "English";
  const v =
    safeStr(p?._id) ||
    safeStr(p?.updatedAt) ||
    safeStr(p?.lastModifiedAt) ||
    safeStr(p?.slug) ||
    "1";

  const params = new URLSearchParams({
    session,
    code,
    title,
    course,
    medium,
    v,
  });

  return `/api/thumb/assignment?${params.toString()}`;
}

function buildHardcopyMasterThumb(p: any) {
  const session = normalizeSession(p?.session) || "2025-26";
  const code = extractSubjectCode(p) || "IGNOU";
  const medium = extractMedium(p) || "English";
  const v =
    safeStr(p?._id) ||
    safeStr(p?.updatedAt) ||
    safeStr(p?.lastModifiedAt) ||
    safeStr(p?.slug) ||
    "1";

  const params = new URLSearchParams({
    session,
    code,
    medium,
    v,
  });

  return `/api/thumb/hardcopy?${params.toString()}`;
}

function resolveUploadedImageThumb(p: any) {
  const sorted = sortImagesNamewise(p?.images);
  return sorted[0] || safeStr(p?.thumbnailUrl) || safeStr(p?.quickUrl) || "";
}

function buildProductSnapshotThumb(p: any) {
  if (isSolvedAssignmentCategory(p?.category)) {
    return buildAssignmentMasterThumb(p);
  }

  if (isHardcopyCategory(p?.category)) {
    return buildHardcopyMasterThumb(p);
  }

  return resolveUploadedImageThumb(p);
}

function derivePyqYears(comboKind: string, itemCount: number) {
  const kind = safeStr(comboKind).toLowerCase();
  if (kind === "pyq_5y") return "5";
  if (kind === "pyq_3y") return "3";
  return itemCount >= 10 ? "5" : "3";
}

function buildPyqComboThumb(args: {
  comboKind: string;
  subjectCode: string;
  medium: string;
  savePercent: number;
  versionSeed: string;
}) {
  const params = new URLSearchParams();
  params.set("years", derivePyqYears(args.comboKind, 0));
  params.set("code", safeStr(args.subjectCode).toUpperCase() || "IGNOU");
  params.set("medium", safeStr(args.medium) || "English");
  if (safeNum(args.savePercent, 0) > 0) {
    params.set("discount", `${Math.round(safeNum(args.savePercent, 0))}% OFF`);
  }
  params.set("v", safeStr(args.versionSeed) || "1");
  return `/api/thumb/pyq-combo?${params.toString()}`;
}

function buildComboThumbUrl(args: {
  explicitThumbUrl?: any;
  existingThumbUrl?: any;
  categorySlug: string;
  comboKind: string;
  subjectCode: string;
  medium: string;
  savePercent: number;
  itemsSnapshot: any[];
  versionSeed: string;
}) {
  const explicitThumbUrl = safeStr(args.explicitThumbUrl);
  if (explicitThumbUrl) return explicitThumbUrl;

  if (isPyqCategorySlug(args.categorySlug)) {
    return buildPyqComboThumb({
      comboKind: args.comboKind,
      subjectCode: args.subjectCode,
      medium: args.medium,
      savePercent: args.savePercent,
      versionSeed: args.versionSeed,
    });
  }

  const firstItemThumb =
    (Array.isArray(args.itemsSnapshot) ? args.itemsSnapshot : [])
      .map((item: any) => safeStr(item?.thumbUrl))
      .find(Boolean) || "";

  return firstItemThumb || safeStr(args.existingThumbUrl);
}

async function makeUniqueComboSlug(base: string) {
  const clean = toSlug(base) || "combo";
  let slug = clean;
  let i = 1;

  while (await Combo.findOne({ slug }).select("_id")) {
    i += 1;
    slug = `${clean}-${i}`;
  }

  return slug;
}

async function buildSnapshotFromProductIds(productIds: string[]) {
  if (!productIds.length) return [];

  const docs: any[] = await Product.find({
    _id: { $in: productIds },
    isActive: true,
    availability: { $in: ["available", "on_demand"] },
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
      subjectTitle: 1,
      courseCodes: 1,
      courseTitles: 1,
      courseCode: 1,
      language: 1,
      medium: 1,
      lang3: 1,
      session: 1,
      session6: 1,
      price: 1,
      thumbnailUrl: 1,
      quickUrl: 1,
      images: 1,
      updatedAt: 1,
      lastModifiedAt: 1,
    })
    .lean();

  const order = new Map(productIds.map((id, idx) => [String(id), idx]));
  docs.sort((a, b) => (order.get(String(a._id)) ?? 0) - (order.get(String(b._id)) ?? 0));

  return docs.map((p) => ({
    productId: p._id,
    title: safeStr(p.title),
    slug: toSlug(p.slug || p.title),
    category: safeStr(p.category),
    subjectCode: extractSubjectCode(p),
    subjectTitleEn: safeStr(p.subjectTitleEn),
    subjectTitleHi: safeStr(p.subjectTitleHi),
    medium: extractMedium(p),
    lang3: safeStr(p.lang3).toUpperCase(),
    session: safeStr(p.session),
    session6: safeStr(p.session6),
    courseCodes: uniqueStrings(safeArr(p.courseCodes), true),
    courseTitles: uniqueStrings(safeArr(p.courseTitles), false),
    price: Math.max(0, safeNum(p.price, 0)),
    thumbUrl: buildProductSnapshotThumb(p),
    sku: safeStr(p?.sku).toUpperCase(),
  }));
}

function deriveCourseCodesFromSnapshot(itemsSnapshot: any[], fallback: any[] = []) {
  const fromItems = (Array.isArray(itemsSnapshot) ? itemsSnapshot : []).flatMap((item: any) =>
    safeArr(item?.courseCodes).map((x: any) => safeStr(x).toUpperCase())
  );

  return uniqueStrings(
    [...fromItems, ...safeArr(fallback).map((x: any) => safeStr(x).toUpperCase())],
    true
  );
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

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  await dbConnect();

  const url = new URL(req.url);
  const q = safeStr(url.searchParams.get("q"));
  const categorySlug = safeStr(url.searchParams.get("categorySlug")).toLowerCase();
  const comboKind = safeStr(url.searchParams.get("comboKind")).toLowerCase();
  const status = safeStr(url.searchParams.get("status")).toLowerCase();
  const trash = url.searchParams.get("trash") === "1";

  const limitRaw = Math.trunc(safeNum(url.searchParams.get("limit"), 200));
  const limit = Math.min(Math.max(limitRaw || 200, 1), 500);

  const shouldAutoRepairPyq =
    !trash &&
    !q &&
    (!categorySlug || categorySlug === "question-papers");

  let autoRepair: any = null;

  if (shouldAutoRepairPyq) {
    try {
      autoRepair = await syncAllGeneratedCombos({
        includePyq: true,
        includeGeneric: false,
      });
    } catch (e: any) {
      autoRepair = {
        ok: false,
        error: safeStr(e?.message || "PYQ auto repair failed"),
      };
    }
  }

  const query: any = trash
    ? { deletedAt: { $ne: null } }
    : { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] };

  if (categorySlug) query.categorySlug = categorySlug;
  if (comboKind) query.comboKind = comboKind;
  if (status) query.status = status;

  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { title: rx },
        { slug: rx },
        { shortTitle: rx },
        { categorySlug: rx },
        { categoryLabel: rx },
        { comboKind: rx },
        { subjectCode: rx },
        { medium: rx },
        { metaTitle: rx },
        { metaDescription: rx },
        { generationKey: rx },
      ],
    });
  }

  const combos = await Combo.find(query).sort({ sortOrder: 1, createdAt: -1, _id: -1 }).limit(limit);

  return NextResponse.json(
    {
      ok: true,
      count: combos.length,
      combos,
      autoRepair,
    },
    { status: 200 }
  );
}

export async function POST(req: NextRequest) {
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

  const title = safeStr(body?.title);
  let slug = toSlug(body?.slug || title);

  const categorySlug = safeStr(body?.categorySlug).toLowerCase();
  const comboKind = safeStr(body?.comboKind).toLowerCase();
  const status = safeStr(body?.status || "draft").toLowerCase();

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

  if (!safeBool(categorySettingsResult.setting?.manualCombosEnabled, true)) {
    return validationError(
      `${categoryLabelFromSlug(categorySlug)} me manual combo creation disabled hai.`,
      "categorySlug"
    );
  }

  const productIds = uniqueStrings(safeArr(body?.productIds).map((x: any) => safeStr(x)));
  if (!productIds.length) {
    return validationError("At least one real product required hai.", "productIds");
  }

  const itemsSnapshot = await buildSnapshotFromProductIds(productIds);
  if (itemsSnapshot.length !== productIds.length) {
    return validationError(
      "Kuch selected products invalid, deleted, want_to_buy ya unavailable hain.",
      "productIds"
    );
  }

  const productCategory = productCategoryFromCategorySlug(categorySlug);
  const categoryMismatch = itemsSnapshot.some((item: any) => safeStr(item?.category) !== productCategory);
  if (categoryMismatch) {
    return validationError("Combo me sirf same category ke products allowed hain.", "productIds");
  }

  if (!slug) slug = await makeUniqueComboSlug(title);

  const existsSlug = await Combo.findOne({ slug }).select("_id slug");
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
    safeStr(body?.subjectCode).toUpperCase() ||
    deriveSingleValue(itemsSnapshot.map((item: any) => safeStr(item?.subjectCode)), true);

  const medium =
    safeStr(body?.medium) ||
    deriveSingleValue(itemsSnapshot.map((item: any) => safeStr(item?.medium)), false);

  const lang3 =
    safeStr(body?.lang3).toUpperCase() ||
    deriveSingleValue(itemsSnapshot.map((item: any) => safeStr(item?.lang3)), true);

  const sessionRangeLabel =
    safeStr(body?.sessionRangeLabel) || buildSessionRangeLabel(itemsSnapshot);

  const courseCodes = deriveCourseCodesFromSnapshot(itemsSnapshot, body?.courseCodes || []);

  const thumbVersionSeed =
    safeStr(body?.thumbVersion) ||
    safeStr(body?.updatedAt) ||
    [slug || title, ...productIds].join("_").slice(0, 180);

  const comboThumbUrl = buildComboThumbUrl({
    explicitThumbUrl: body?.thumbUrl,
    existingThumbUrl: "",
    categorySlug,
    comboKind,
    subjectCode,
    medium,
    savePercent: pricing.savePercent,
    itemsSnapshot,
    versionSeed: thumbVersionSeed,
  });

  const docPayload = {
    title,
    slug,
    shortTitle: safeStr(body?.shortTitle) || title,

    categorySlug,
    categoryLabel: safeStr(body?.categoryLabel) || categoryLabelFromSlug(categorySlug),

    comboKind,
    variant: inferVariant(categorySlug, comboKind),
    status,
    isActive: safeBool(body?.isActive, status === "active"),
    isAutoGenerated: false,
    isMakeOwnComboAllowed:
      body?.isMakeOwnComboAllowed !== undefined
        ? safeBool(body?.isMakeOwnComboAllowed, false)
        : safeBool(categorySettingsResult.setting?.makeOwnComboEnabled, false),

    sourceType: "manual",
    sourceRuleId: "",
    sourceTemplateKey: "",
    generationKey: "",
    generationGroupKey: "",
    isLockedByAdmin: false,
    allowAutoRefresh: false,

    subjectCode,
    medium,
    lang3,
    sessionRangeLabel,
    courseCodes,

    description: safeStr(body?.description),
    shortDescription: safeStr(body?.shortDescription),
    badge: safeStr(body?.badge),
    itemsLabel: safeStr(body?.itemsLabel) || "Included Bundle Items",
    thumbMode: "dynamic",
    thumbUrl: comboThumbUrl,

    metaTitle: safeStr(body?.metaTitle),
    metaDescription: safeStr(body?.metaDescription),

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
      minCoPurchaseUsers: 0,
      minProductsRequired: comboKind === "pyq_3y" ? 6 : comboKind === "pyq_5y" ? 10 : 1,
      maxProductsAllowed: itemsSnapshot.length,
      sameSubjectOnly: comboKind === "pyq_3y" || comboKind === "pyq_5y",
      sameMediumOnly: comboKind === "pyq_3y" || comboKind === "pyq_5y",
      sameCategoryOnly: true,
      useLatestSessionsOnly: comboKind === "pyq_3y" || comboKind === "pyq_5y",
      latestProductCount: comboKind === "pyq_3y" ? 6 : comboKind === "pyq_5y" ? 10 : 0,
      generatedFrom: "",
    },

    builderConfigSnapshot: {
      minProductsRequired: 0,
      maxProductsAllowed: 0,
      sameSubjectOnly: false,
      sameMediumOnly: false,
      sameCategoryOnly: true,
    },

    productIds,
    itemsSnapshot,

    sortOrder: Math.trunc(safeNum(body?.sortOrder, 0)),
    generatedFromRule: "",
    lastGeneratedAt: null,

    createdBy: getAdminActor(admin),
    updatedBy: getAdminActor(admin),

    deletedAt: null,
    deletedBy: "",
  };

  try {
    const doc = await Combo.create(docPayload);

    return NextResponse.json(
      {
        ok: true,
        message: "Combo created ✅",
        combo: doc,
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
      { error: e?.message || "Failed to create combo" },
      { status: 500 }
    );
  }
}