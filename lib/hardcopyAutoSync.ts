import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import HardcopyTemplateConfig, {
  HARDCOPY_TEMPLATE_CONFIG_KEY,
} from "@/models/HardcopyTemplateConfig";
import { resolveRequiredProductPricing } from "@/lib/productPricing";
import {
  PHYSICAL_CATEGORY,
  normalizeProductCategory,
} from "@/lib/productCatalog";

const SOLVED_ASSIGNMENTS_CATEGORY = "Solved Assignments";
const HARDCOPY_AUTO_GENERATION_TYPE = "solved_assignment_hardcopy";
const SYSTEM_DELETED_BY = "system:auto-hardcopy-sync";

const DEFAULT_HARDCOPY_PATTERNS = {
  title: "IGNOU %1 Handwritten Hardcopy Assignment %5 (%6 Medium)",
  shortDesc:
    "Buy IGNOU %1 handwritten hardcopy assignment for session %5 in %6 medium. This is a physical handwritten delivery product.",
  longDesc:
    "This product is the handwritten hardcopy delivery version of the solved assignment for subject %1 (%2). It is mapped to course %3 (%4), prepared for session %5, and available in %6 medium. This is a physical handwritten product, not a downloadable PDF.",
  importantNote:
    "This product is a handwritten physical hardcopy delivery version of the related solved assignment. PDF is not included with this product. Please verify subject code, medium, session, and course before placing the order.",
  metaTitle: "IGNOU %1 Handwritten Hardcopy Assignment %5 (%6 Medium)",
  metaDescription:
    "Order IGNOU %1 handwritten hardcopy assignment for session %5 in %6 medium. Physical delivery product based on the solved assignment source.",
};

let templateCache: any = null;
let templateCacheAt = 0;
const TEMPLATE_CACHE_TTL_MS = 15 * 1000;

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function safeArr(x: any) {
  if (Array.isArray(x)) return x.map((v) => safeStr(v)).filter(Boolean);
  if (typeof x === "string") return x.split(",").map((v) => v.trim()).filter(Boolean);
  return [];
}

function uniqueStrings(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    const k = safeStr(v);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function slugify(input: string) {
  return safeStr(input)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeSku(input: any) {
  return safeStr(input).toUpperCase().replace(/\s+/g, "");
}

function normalizeAvailability(input: any) {
  const v = safeStr(input).toLowerCase();

  if (v === "available" || v === "available (buy now)" || v === "buy now") return "available";

  if (
    v === "on_demand" ||
    v === "on demand" ||
    v === "ondemand" ||
    v === "on-demand" ||
    v === "coming_soon" ||
    v === "comingsoon" ||
    v === "coming-soon"
  ) {
    return "on_demand";
  }

  if (
    v === "want_to_buy" ||
    v === "want to buy" ||
    v === "wanttobuy" ||
    v === "want-to-buy" ||
    v === "out_of_stock" ||
    v === "outofstock" ||
    v === "out-of-stock"
  ) {
    return "want_to_buy";
  }

  return "";
}

function normalizeLang3(input: any) {
  const s = safeStr(input).toUpperCase().replace(/[^A-Z]/g, "");
  if (!s) return "";
  if (s.startsWith("HIN")) return "HIN";
  if (s.startsWith("ENG")) return "ENG";
  if (s.startsWith("SAN")) return "SAN";
  return (s.slice(0, 3) || "").padEnd(3, "X");
}

function normalizeLanguageLabel(inputLanguage: any, inputLang3?: any) {
  const language = safeStr(inputLanguage);
  const langLower = language.toLowerCase();
  const lang3 = normalizeLang3(inputLang3 || inputLanguage);

  if (
    langLower === "hindi" ||
    langLower === "hind" ||
    lang3 === "HIN"
  ) {
    return "Hindi";
  }

  if (
    langLower === "english" ||
    langLower === "eng" ||
    lang3 === "ENG"
  ) {
    return "English";
  }

  if (
    langLower === "sanskrit" ||
    langLower === "san" ||
    lang3 === "SAN"
  ) {
    return "Sanskrit";
  }

  return language;
}

function isAllowedHardcopyLanguage(inputLanguage: any, inputLang3?: any) {
  const label = normalizeLanguageLabel(inputLanguage, inputLang3).toLowerCase();
  const lang3 = normalizeLang3(inputLang3 || inputLanguage);

  return (
    label === "hindi" ||
    label === "english" ||
    label === "sanskrit" ||
    lang3 === "HIN" ||
    lang3 === "ENG" ||
    lang3 === "SAN"
  );
}

function pickMediumSubjectTitle(source: any) {
  const language = normalizeLanguageLabel(source?.language, source?.lang3).toLowerCase();

  const hi = safeStr(source?.subjectTitleHi);
  const en = safeStr(source?.subjectTitleEn);
  const other = safeStr(source?.subjectTitleOther);

  if (language === "hindi") return hi || other || en;
  if (language === "english") return en || other || hi;
  if (language === "sanskrit") return other || hi || en;

  return other || hi || en;
}

function replacePatternTokens(template: string, tokens: Record<string, string>) {
  return safeStr(template)
    .replace(/%1/g, tokens["%1"] || "")
    .replace(/%2/g, tokens["%2"] || "")
    .replace(/%3/g, tokens["%3"] || "")
    .replace(/%4/g, tokens["%4"] || "")
    .replace(/%5/g, tokens["%5"] || "")
    .replace(/%6/g, tokens["%6"] || "");
}

function buildHardcopySkuFromSourceSku(sourceSku: any) {
  const sku = normalizeSku(sourceSku);
  if (!sku) return "";

  if (sku.endsWith("A")) {
    return `${sku.slice(0, -1)}D`;
  }

  return `${sku}D`;
}

function buildHardcopySlugFromSource(source: any, derivedSku: string) {
  const sourceSlug = safeStr(source?.slug);
  if (sourceSlug) {
    return slugify(`${sourceSlug}-handwritten-hardcopy-delivery`);
  }
  return slugify(`${safeStr(source?.title)} ${derivedSku} handwritten hardcopy delivery`);
}

function buildPatternTokens(source: any) {
  return {
    "%1": safeStr(source?.subjectCode),
    "%2": pickMediumSubjectTitle(source),
    "%3": uniqueStrings(safeArr(source?.courseCodes).map((x) => safeStr(x).toUpperCase())).join(", "),
    "%4": uniqueStrings(safeArr(source?.courseTitles)).join(", "),
    "%5": safeStr(source?.session),
    "%6": normalizeLanguageLabel(source?.language, source?.lang3),
  };
}

async function loadHardcopyTemplatePatterns() {
  const now = Date.now();

  if (templateCache && now - templateCacheAt < TEMPLATE_CACHE_TTL_MS) {
    return templateCache;
  }

  const doc: any = await HardcopyTemplateConfig.findOne({
    key: HARDCOPY_TEMPLATE_CONFIG_KEY,
  }).lean();

  const merged = {
    title: safeStr(doc?.titleTemplate || DEFAULT_HARDCOPY_PATTERNS.title),
    shortDesc: safeStr(doc?.shortDescTemplate || DEFAULT_HARDCOPY_PATTERNS.shortDesc),
    longDesc: safeStr(doc?.longDescTemplate || DEFAULT_HARDCOPY_PATTERNS.longDesc),
    importantNote: safeStr(doc?.importantNoteTemplate || DEFAULT_HARDCOPY_PATTERNS.importantNote),
    metaTitle: safeStr(doc?.metaTitleTemplate || DEFAULT_HARDCOPY_PATTERNS.metaTitle),
    metaDescription: safeStr(
      doc?.metaDescriptionTemplate || DEFAULT_HARDCOPY_PATTERNS.metaDescription
    ),
  };

  templateCache = merged;
  templateCacheAt = now;

  return merged;
}

function isEligibleSolvedAssignmentSource(source: any) {
  if (!source) {
    return {
      ok: false,
      reason: "Source product missing.",
    };
  }

  if (Boolean(source?.isAutoGenerated)) {
    return {
      ok: false,
      reason: "Auto-generated product ko source nahi maana jayega.",
    };
  }

  const category = normalizeProductCategory(source?.category);
  if (category !== SOLVED_ASSIGNMENTS_CATEGORY) {
    return {
      ok: false,
      reason: "Only Solved Assignments source se hardcopy auto-generate hogi.",
    };
  }

  if (source?.deletedAt) {
    return {
      ok: false,
      reason: "Deleted source product ke liye hardcopy active nahi rahegi.",
    };
  }

  const availability = normalizeAvailability(source?.availability);
  if (!["available", "on_demand"].includes(availability)) {
    return {
      ok: false,
      reason: "Source availability available ya on_demand honi chahiye.",
    };
  }

  if (!isAllowedHardcopyLanguage(source?.language, source?.lang3)) {
    return {
      ok: false,
      reason: "Hardcopy auto-generation sirf Hindi, English, Sanskrit medium ke liye allowed hai.",
    };
  }

  const derivedSku = buildHardcopySkuFromSourceSku(source?.sku);
  if (!derivedSku) {
    return {
      ok: false,
      reason: "Source SKU missing hai.",
    };
  }

  return {
    ok: true,
    reason: "Eligible solved assignment source found.",
  };
}

async function findExistingGeneratedHardcopy(source: any, derivedSku: string) {
  const or: any[] = [];

  if (source?._id) {
    or.push({
      autoGenerationType: HARDCOPY_AUTO_GENERATION_TYPE,
      autoGeneratedFromProductId: source._id,
    });
  }

  const sourceSku = normalizeSku(source?.sku);
  if (sourceSku) {
    or.push({
      autoGenerationType: HARDCOPY_AUTO_GENERATION_TYPE,
      autoGeneratedFromSku: sourceSku,
    });
  }

  if (derivedSku) {
    or.push({ sku: derivedSku });
  }

  if (!or.length) return null;

  const existing: any = await Product.findOne({
    $or: or,
  }).sort({ updatedAt: -1, _id: -1 });

  return existing || null;
}

async function ensureUniqueSlug(baseSlug: string, excludeId?: any) {
  const clean = slugify(baseSlug) || "product";
  let slug = clean;
  let i = 1;

  while (true) {
    const query: any = { slug };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await Product.findOne(query).select("_id");
    if (!existing) return slug;

    i += 1;
    slug = `${clean}-${i}`;
  }
}

async function buildHardcopyPayload(source: any, pricing: any) {
  const patterns = await loadHardcopyTemplatePatterns();

  const derivedSku = buildHardcopySkuFromSourceSku(source?.sku);
  const languageLabel = normalizeLanguageLabel(source?.language, source?.lang3);
  const lang3 = normalizeLang3(source?.lang3 || languageLabel);
  const sourceImages = uniqueStrings(safeArr(source?.images));

  const tokens = buildPatternTokens(source);

  const title = replacePatternTokens(patterns.title, tokens);
  const shortDesc = replacePatternTokens(patterns.shortDesc, tokens);
  const descriptionHtml = replacePatternTokens(patterns.longDesc, tokens);
  const importantNote = replacePatternTokens(patterns.importantNote, tokens);
  const metaTitle = replacePatternTokens(patterns.metaTitle, tokens);
  const metaDescription = replacePatternTokens(patterns.metaDescription, tokens);

  return {
    title,
    slugBase: buildHardcopySlugFromSource(source, derivedSku),
    sku: derivedSku,
    category: PHYSICAL_CATEGORY,

    subjectCode: safeStr(source?.subjectCode),
    subjectTitleHi: safeStr(source?.subjectTitleHi),
    subjectTitleEn: safeStr(source?.subjectTitleEn),
    subjectTitleOther: safeStr(source?.subjectTitleOther),

    courseCodes: uniqueStrings(safeArr(source?.courseCodes).map((x) => safeStr(x).toUpperCase())),
    courseTitles: uniqueStrings(safeArr(source?.courseTitles)),

    session: safeStr(source?.session),
    session6: safeStr(source?.session6),
    language: languageLabel,
    lang3,

    price: Math.max(0, safeNum(pricing?.price, 0)),
    oldPrice: Math.max(0, safeNum(pricing?.oldPrice, 0)),

    pages: 20,
    availability: "available",
    importantNote,

    deliverWithinMinutes: 20,
    onDemandNote: "",
    autoMakeAvailableOnUpload: false,

    shortDesc,
    descriptionHtml,

    isDigital: false,

    pdfKey: "",
    pdfUrl: "",

    images: sourceImages,
    thumbnailUrl: sourceImages[0] || "",
    quickUrl: sourceImages[1] || sourceImages[0] || "",

    metaTitle,
    metaDescription,

    isAutoGenerated: true,
    autoGenerationType: HARDCOPY_AUTO_GENERATION_TYPE,
    autoGeneratedFromProductId: source?._id || null,
    autoGeneratedFromSku: normalizeSku(source?.sku),
    autoGeneratedFromCategory: normalizeProductCategory(source?.category),
    autoGeneratedAt: new Date(),

    isActive: Boolean(source?.isActive),
    deletedAt: null,
    deletedBy: "",
    lastModifiedAt: new Date(),
  };
}

async function trashGeneratedHardcopy(existing: any, reason: string) {
  if (!existing) {
    return {
      ok: true,
      action: "none",
      reason,
      childId: "",
      childSku: "",
    };
  }

  if (existing.deletedAt) {
    return {
      ok: true,
      action: "already_trashed",
      reason,
      childId: safeStr(existing?._id),
      childSku: safeStr(existing?.sku),
    };
  }

  existing.deletedAt = new Date();
  existing.deletedBy = SYSTEM_DELETED_BY;
  existing.isActive = false;
  existing.lastModifiedAt = new Date();
  await existing.save();

  return {
    ok: true,
    action: "trashed",
    reason,
    childId: safeStr(existing?._id),
    childSku: safeStr(existing?.sku),
  };
}

export async function syncGeneratedHardcopyForProductChange(args: {
  before?: any;
  after?: any;
}) {
  await dbConnect();

  const before = args?.before || null;
  const after = args?.after || null;

  const sourceForLookup = after || before;
  if (!sourceForLookup) {
    return {
      ok: true,
      action: "skipped",
      reason: "No source product found for hardcopy sync.",
    };
  }

  if (Boolean(sourceForLookup?.isAutoGenerated)) {
    return {
      ok: true,
      action: "skipped",
      reason: "Generated child product change par hardcopy sync run nahi hogi.",
    };
  }

  const derivedSku = buildHardcopySkuFromSourceSku(sourceForLookup?.sku);
  const existing = await findExistingGeneratedHardcopy(sourceForLookup, derivedSku);

  const eligibility = isEligibleSolvedAssignmentSource(after || sourceForLookup);

  if (!after || !eligibility.ok) {
    return trashGeneratedHardcopy(
      existing,
      eligibility.reason || "Source ineligible or removed, generated hardcopy moved to trash."
    );
  }

  const pricing = await resolveRequiredProductPricing({
    category: PHYSICAL_CATEGORY,
    courseCodes: uniqueStrings(safeArr(after?.courseCodes).map((x) => safeStr(x).toUpperCase())),
    productSku: derivedSku,
  });

  if (!pricing?.ok || Number(pricing?.price || 0) <= 0) {
    return {
      ok: false,
      action: "pricing_missing",
      reason:
        "Hardcopy pricing rule not found. Pehle Handwritten Hardcopy (Delivery) category ke liye Product Pricing rule set karo.",
      childId: safeStr(existing?._id),
      childSku: safeStr(existing?.sku || derivedSku),
    };
  }

  const payload = await buildHardcopyPayload(after, pricing);
  const finalSlug = await ensureUniqueSlug(payload.slugBase, existing?._id);

  if (existing) {
    existing.title = payload.title;
    existing.slug = finalSlug;
    existing.sku = payload.sku;
    existing.category = payload.category;

    existing.subjectCode = payload.subjectCode;
    existing.subjectTitleHi = payload.subjectTitleHi;
    existing.subjectTitleEn = payload.subjectTitleEn;
    existing.subjectTitleOther = payload.subjectTitleOther;

    existing.courseCodes = payload.courseCodes;
    existing.courseTitles = payload.courseTitles;

    existing.session = payload.session;
    existing.session6 = payload.session6;
    existing.language = payload.language;
    existing.lang3 = payload.lang3;

    existing.price = payload.price;
    existing.oldPrice = payload.oldPrice;

    existing.pages = payload.pages;
    existing.availability = payload.availability;
    existing.importantNote = payload.importantNote;

    existing.deliverWithinMinutes = payload.deliverWithinMinutes;
    existing.onDemandNote = payload.onDemandNote;
    existing.autoMakeAvailableOnUpload = payload.autoMakeAvailableOnUpload;

    existing.shortDesc = payload.shortDesc;
    existing.descriptionHtml = payload.descriptionHtml;

    existing.isDigital = payload.isDigital;
    existing.pdfKey = "";
    existing.pdfUrl = "";

    existing.images = payload.images;
    existing.thumbnailUrl = payload.thumbnailUrl;
    existing.quickUrl = payload.quickUrl;

    existing.metaTitle = payload.metaTitle;
    existing.metaDescription = payload.metaDescription;

    existing.isAutoGenerated = true;
    existing.autoGenerationType = payload.autoGenerationType;
    existing.autoGeneratedFromProductId = payload.autoGeneratedFromProductId;
    existing.autoGeneratedFromSku = payload.autoGeneratedFromSku;
    existing.autoGeneratedFromCategory = payload.autoGeneratedFromCategory;
    existing.autoGeneratedAt = payload.autoGeneratedAt;

    existing.isActive = payload.isActive;
    existing.deletedAt = null;
    existing.deletedBy = "";
    existing.lastModifiedAt = new Date();

    await existing.save();

    return {
      ok: true,
      action: "updated",
      reason: "Generated handwritten hardcopy synced successfully.",
      childId: safeStr(existing?._id),
      childSku: safeStr(existing?.sku),
      pricingSource: safeStr(pricing?.source),
    };
  }

  const created: any = await Product.create({
    ...payload,
    slug: finalSlug,
  });

  return {
    ok: true,
    action: "created",
    reason: "Generated handwritten hardcopy created successfully.",
    childId: safeStr(created?._id),
    childSku: safeStr(created?.sku),
    pricingSource: safeStr(pricing?.source),
  };
}

export async function backfillGeneratedHardcopies(args?: {
  dryRun?: boolean;
  limit?: number;
  skip?: number;
}) {
  await dbConnect();

  const dryRun = Boolean(args?.dryRun);
  const limit = Math.min(Math.max(Math.trunc(safeNum(args?.limit, 250)), 1), 1000);
  const skip = Math.max(Math.trunc(safeNum(args?.skip, 0)), 0);

  const query: any = {
    deletedAt: null,
    isAutoGenerated: { $ne: true },
    category: SOLVED_ASSIGNMENTS_CATEGORY,
    availability: { $in: ["available", "on_demand"] },
    $or: [
      { language: { $in: ["Hindi", "English", "Sanskrit", "hindi", "english", "sanskrit"] } },
      { lang3: { $in: ["HIN", "ENG", "SAN"] } },
    ],
  };

  const totalEligibleSources = await Product.countDocuments(query);

  const sources: any[] = await Product.find(query)
    .sort({ updatedAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit);

  const items: any[] = [];

  let processed = 0;
  let created = 0;
  let updated = 0;
  let trashed = 0;
  let skipped = 0;
  let failed = 0;

  for (const source of sources) {
    processed += 1;

    try {
      const eligibility = isEligibleSolvedAssignmentSource(source.toObject ? source.toObject() : source);
      const derivedSku = buildHardcopySkuFromSourceSku(source?.sku);
      const existing = await findExistingGeneratedHardcopy(source, derivedSku);

      if (dryRun) {
        let previewAction = "skip";
        if (!eligibility.ok) {
          previewAction = existing ? "would_trash" : "skip";
        } else if (!existing) {
          previewAction = "would_create";
        } else {
          previewAction = "would_update";
        }

        items.push({
          sourceSku: safeStr(source?.sku),
          sourceTitle: safeStr(source?.title),
          sourceAvailability: safeStr(source?.availability),
          sourceLanguage: safeStr(source?.language),
          childSku: safeStr(existing?.sku || derivedSku),
          childId: safeStr(existing?._id),
          ok: true,
          action: previewAction,
          reason: eligibility.reason,
        });

        if (previewAction === "would_create") created += 1;
        else if (previewAction === "would_update") updated += 1;
        else if (previewAction === "would_trash") trashed += 1;
        else skipped += 1;

        continue;
      }

      const result: any = await syncGeneratedHardcopyForProductChange({
        after: source.toObject ? source.toObject() : source,
      });

      const action = safeStr(result?.action || "unknown");
      const reason = safeStr(result?.reason || result?.error || "");
      const childSku = safeStr(result?.childSku || "");
      const childId = safeStr(result?.childId || "");

      if (result?.ok === false) {
        failed += 1;
      } else if (action === "created") {
        created += 1;
      } else if (action === "updated") {
        updated += 1;
      } else if (action === "trashed" || action === "already_trashed") {
        trashed += 1;
      } else {
        skipped += 1;
      }

      items.push({
        sourceSku: safeStr(source?.sku),
        sourceTitle: safeStr(source?.title),
        sourceAvailability: safeStr(source?.availability),
        sourceLanguage: safeStr(source?.language),
        childSku,
        childId,
        ok: result?.ok !== false,
        action,
        reason,
      });
    } catch (e: any) {
      failed += 1;
      items.push({
        sourceSku: safeStr(source?.sku),
        sourceTitle: safeStr(source?.title),
        sourceAvailability: safeStr(source?.availability),
        sourceLanguage: safeStr(source?.language),
        childSku: "",
        childId: "",
        ok: false,
        action: "exception",
        reason: safeStr(e?.message || "Unknown error"),
      });
    }
  }

  return {
    ok: true,
    summary: {
      totalEligibleSources,
      processed,
      created,
      updated,
      trashed,
      skipped,
      failed,
      hasMore: totalEligibleSources > skip + sources.length,
      nextSkip: skip + sources.length,
      dryRun,
      limit,
      skip,
    },
    items,
  };
}

export {
  HARDCOPY_AUTO_GENERATION_TYPE,
  SOLVED_ASSIGNMENTS_CATEGORY,
  DEFAULT_HARDCOPY_PATTERNS,
};