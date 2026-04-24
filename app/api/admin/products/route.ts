import { NextRequest, NextResponse } from "next/server";
import type { SortOrder } from "mongoose";

import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import PdfVaultFile from "@/models/PdfVaultFile";
import Session from "@/models/Session";
import Course from "@/models/Course";
import { getAuthUser, hasPermission } from "@/lib/auth";
import { autoResolveWantToBuyForProduct } from "@/lib/wantToBuyAutoResolve";
import { findVaultPdfBySku, safeStr as safeVaultStr } from "@/lib/pdfVault";
import { syncGeneratedCombosForProductChange } from "@/lib/comboAutoSync";
import { syncGeneratedHardcopyForProductChange } from "@/lib/hardcopyAutoSync";
import { resolveRequiredProductPricing } from "@/lib/productPricing";
import {
  syncProductAvailabilityByProductId,
  syncProductAvailabilityBySku,
} from "@/lib/productAvailability";
import {
  normalizeProductCategory,
  deriveIsDigitalFromCategory,
  PHYSICAL_CATEGORY,
} from "@/lib/productCatalog";

const DB_AVAILABILITY = new Set(["available", "on_demand", "want_to_buy"]);
const VAULT_MANAGED_PDF_MESSAGE =
  "Direct PDF upload disabled hai. Product PDF sirf PDF Vault se SKU filename ke basis par link hogi.";
const MANUAL_HARDCOPY_BLOCK_MESSAGE =
  "Handwritten Hardcopy (Delivery) product manual create disabled hai. Ye category ab Solved Assignments se automatically generate hogi.";

type SortKey =
  | "latest"
  | "oldest"
  | "title_asc"
  | "title_desc"
  | "price_low"
  | "price_high"
  | "sku_asc"
  | "active_first"
  | "availability";

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
  if (Array.isArray(x)) return x.map((v) => safeStr(v)).filter(Boolean);
  if (typeof x === "string") return x.split(",").map((v) => v.trim()).filter(Boolean);
  return [];
}

function uniqueStrings(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    const k = safeStr(v);
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toSlug(input: string) {
  return safeStr(input)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeSku(input: string) {
  return safeStr(input).toUpperCase().replace(/\s+/g, "-");
}

function normalizeSkuLike(input: string) {
  return safeStr(input).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeSubjectCode(input: string) {
  return safeStr(input).toUpperCase().replace(/\s+/g, " ").trim();
}

function normalizeSession6(input: any) {
  const s = safeStr(input);
  if (!s) return "";

  if (/^\d{6}$/.test(s)) return s;

  const years4 = s.match(/\d{4}/g) || [];
  if (years4.length >= 2) return `${years4[0]}${years4[1].slice(-2)}`;

  if (/^\d{4}$/.test(s)) return `${s}00`;

  const m = s.match(
    /^(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+(\d{4})$/i
  );
  if (m) {
    const mon = m[1].toLowerCase();
    const year = m[2];
    const mmMap: Record<string, string> = {
      jan: "01",
      january: "01",
      feb: "02",
      february: "02",
      mar: "03",
      march: "03",
      apr: "04",
      april: "04",
      may: "05",
      jun: "06",
      june: "06",
      jul: "07",
      july: "07",
      aug: "08",
      august: "08",
      sep: "09",
      sept: "09",
      september: "09",
      oct: "10",
      october: "10",
      nov: "11",
      november: "11",
      dec: "12",
      december: "12",
    };
    const mm = mmMap[mon];
    if (mm) return `${year}${mm}`;
  }

  const normalized = s.toLowerCase().replace(/\s+/g, " ").trim();
  if (normalized === "latest" || normalized === "new session") return "";

  const digits = s.replace(/\D/g, "");
  if (digits.length >= 6) return digits.slice(0, 6);

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

function normalizeAvailability(input: any) {
  const v = safeStr(input).toLowerCase();

  if (v === "available" || v === "in_stock" || v === "instock") return "available";

  if (
    v === "on_demand" ||
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

function getAvailabilityAfterSync(syncResult: any) {
  if (!syncResult || typeof syncResult !== "object") return "";
  const x = syncResult as any;

  if (x.after && typeof x.after === "object") {
    return safeStr(x.after?.availability);
  }

  if (x.snapshot && typeof x.snapshot === "object") {
    return safeStr(x.snapshot?.availability);
  }

  return "";
}

function validationError(message: string, field?: string) {
  return NextResponse.json({ error: message, field: field || "" }, { status: 400 });
}

async function makeUniqueSlug(base: string) {
  const clean = toSlug(base) || "product";
  let slug = clean;
  let i = 1;
  while (await Product.findOne({ slug }).select("_id").lean()) {
    i += 1;
    slug = `${clean}-${i}`;
  }
  return slug;
}

async function makeUniqueSku(base: string) {
  const clean = normalizeSku(base) || "SKU";
  let sku = clean;
  let i = 1;
  while (await Product.findOne({ sku }).select("_id").lean()) {
    i += 1;
    sku = `${clean}-C${i}`;
  }
  return sku;
}

async function getVaultAutofillForSku(sku: string) {
  const skuLike = normalizeSkuLike(sku);
  if (!skuLike) {
    return {
      pdfKey: "",
      pages: 0,
    };
  }

  const vaultFile: any = await findVaultPdfBySku(skuLike);

  return {
    pdfKey: safeVaultStr(vaultFile?.s3Key),
    pages: Math.max(0, Math.trunc(Number(vaultFile?.pageCount || 0))),
  };
}

async function runInitialAvailabilitySyncForCreatedProduct(doc: any) {
  const productId = safeStr(doc?._id);
  const productSku = safeStr(doc?.sku);

  try {
    if (productId) {
      const byId = await syncProductAvailabilityByProductId(productId);
      if (byId?.ok) return byId;
    }
  } catch {
    // fallback below
  }

  try {
    if (productSku) {
      const bySku = await syncProductAvailabilityBySku(productSku);
      return bySku;
    }
  } catch (error: any) {
    return {
      ok: false,
      reason: safeStr(error?.message || "Initial availability sync failed"),
      productId,
      productSku,
    };
  }

  return {
    ok: false,
    reason: "Initial availability sync skipped",
    productId,
    productSku,
  };
}

function buildSort(sortByRaw: string): Record<string, SortOrder> {
  const sortBy = safeStr(sortByRaw) as SortKey;
  const sort: Record<string, SortOrder> = {};

  switch (sortBy) {
    case "oldest":
      sort.createdAt = 1;
      sort._id = 1;
      break;
    case "title_asc":
      sort.title = 1;
      sort._id = -1;
      break;
    case "title_desc":
      sort.title = -1;
      sort._id = -1;
      break;
    case "price_low":
      sort.price = 1;
      sort.createdAt = -1;
      sort._id = -1;
      break;
    case "price_high":
      sort.price = -1;
      sort.createdAt = -1;
      sort._id = -1;
      break;
    case "sku_asc":
      sort.sku = 1;
      sort._id = -1;
      break;
    case "active_first":
      sort.isActive = -1;
      sort.title = 1;
      sort._id = -1;
      break;
    case "availability":
      sort.availability = 1;
      sort.title = 1;
      sort._id = -1;
      break;
    case "latest":
    default:
      sort.createdAt = -1;
      sort._id = -1;
      break;
  }

  return sort;
}

function buildListQuery(url: URL) {
  const trash = url.searchParams.get("trash") === "1";
  const q = safeStr(url.searchParams.get("q"));
  const category = safeStr(url.searchParams.get("category"));
  const availability = normalizeAvailability(url.searchParams.get("availability"));
  const isActiveParam = safeStr(url.searchParams.get("isActive"));
  const session = safeStr(url.searchParams.get("session"));
  const courseCode = safeStr(url.searchParams.get("courseCode")).toUpperCase();
  const language = safeStr(url.searchParams.get("language"));

  const query: any = trash ? { deletedAt: { $ne: null } } : { deletedAt: null };

  if (category) {
    const cats = uniqueStrings(category.split(",").map((x) => normalizeProductCategory(x)));
    if (cats.length === 1) query.category = cats[0];
    else if (cats.length > 1) query.category = { $in: cats };
  }

  if (availability) {
    query.availability = availability;
  }

  if (isActiveParam) {
    const v = isActiveParam.toLowerCase();
    if (["1", "true", "yes", "active"].includes(v)) query.isActive = true;
    if (["0", "false", "no", "inactive"].includes(v)) query.isActive = false;
  }

  if (session) {
    const rx = new RegExp(escapeRegex(session), "i");
    const session6 = normalizeSession6(session);
    query.$and = Array.isArray(query.$and) ? query.$and : [];
    query.$and.push({
      $or: [{ session: rx }, ...(session6 ? [{ session6 }] : [])],
    });
  }

  if (courseCode) {
    const rx = new RegExp(escapeRegex(courseCode), "i");
    query.courseCodes = rx;
  }

  if (language) {
    const rx = new RegExp(escapeRegex(language), "i");
    const lang3 = normalizeLang3(language);
    query.$and = Array.isArray(query.$and) ? query.$and : [];
    query.$and.push({
      $or: [{ language: rx }, ...(lang3 ? [{ lang3 }] : [])],
    });
  }

  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    const skuLike = normalizeSkuLike(q);
    const subjectCodeLike = normalizeSubjectCode(q);

    const orList: any[] = [
      { title: rx },
      { slug: rx },
      { sku: rx },
      { category: rx },
      { subjectCode: rx },
      { subjectTitleHi: rx },
      { subjectTitleEn: rx },
      { subjectTitleOther: rx },
      { language: rx },
      { session: rx },
      { courseCodes: rx },
      { courseTitles: rx },
      { autoGeneratedFromSku: rx },
      { autoGenerationType: rx },
    ];

    if (skuLike) {
      orList.push({ sku: new RegExp(escapeRegex(skuLike), "i") });
    }

    if (subjectCodeLike) {
      orList.push({ subjectCode: new RegExp(escapeRegex(subjectCodeLike), "i") });
    }

    query.$or = orList;
  }

  return {
    trash,
    q,
    category,
    availability,
    isActiveParam,
    session,
    courseCode,
    language,
    query,
  };
}

async function getCategoryAvailabilityBreakdown() {
  const rows: any[] = await Product.aggregate([
    {
      $match: {
        deletedAt: null,
        category: { $ne: PHYSICAL_CATEGORY },
        availability: { $in: ["on_demand", "want_to_buy"] },
      },
    },
    {
      $group: {
        _id: {
          category: "$category",
          availability: "$availability",
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: {
        "_id.availability": 1,
        count: -1,
        "_id.category": 1,
      },
    },
  ]);

  const onDemandByCategory: Array<{ category: string; count: number }> = [];
  const wantToBuyByCategory: Array<{ category: string; count: number }> = [];

  for (const row of rows) {
    const category = normalizeProductCategory(row?._id?.category);
    const availability = safeStr(row?._id?.availability);
    const count = Number(row?.count || 0);

    if (!category || category === PHYSICAL_CATEGORY || count <= 0) continue;

    if (availability === "on_demand") {
      onDemandByCategory.push({ category, count });
    }

    if (availability === "want_to_buy") {
      wantToBuyByCategory.push({ category, count });
    }
  }

  return {
    onDemandByCategory,
    wantToBuyByCategory,
  };
}

async function getFilterOptions() {
  const [sessionsRaw, coursesRaw, languagesRaw] = await Promise.all([
    Session.find({ isActive: true })
      .sort({ sortOrder: 1, name: 1, _id: 1 })
      .select("_id name slug")
      .lean(),
    Course.find({ isActive: true })
      .sort({ code: 1, _id: 1 })
      .select("_id code title")
      .lean(),
    Product.aggregate([
      { $match: { deletedAt: null, language: { $type: "string", $ne: "" } } },
      { $group: { _id: "$language" } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const sessions = (Array.isArray(sessionsRaw) ? sessionsRaw : []).map((row: any) => ({
    _id: String(row._id),
    name: safeStr(row.name),
    slug: safeStr(row.slug),
  }));

  const courses = (Array.isArray(coursesRaw) ? coursesRaw : []).map((row: any) => ({
    _id: String(row._id),
    code: safeStr(row.code),
    title: safeStr(row.title),
  }));

  const languages = Array.from(
    new Set(
      (Array.isArray(languagesRaw) ? languagesRaw : [])
        .map((row: any) => safeStr(row?._id))
        .filter(Boolean)
    )
  );

  return {
    sessions,
    courses,
    languages,
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
  const {
    trash,
    q,
    category,
    availability,
    isActiveParam,
    session,
    courseCode,
    language,
    query,
  } = buildListQuery(url);

  const pageRaw = Math.trunc(safeNum(url.searchParams.get("page"), 1));
  const page = Math.max(pageRaw || 1, 1);

  const limitRaw = Math.trunc(safeNum(url.searchParams.get("limit"), 25));
  const limit = Math.min(Math.max(limitRaw || 25, 1), 200);

  const skip = (page - 1) * limit;
  const sortBy = safeStr(url.searchParams.get("sortBy")) || "latest";
  const sort = buildSort(sortBy);

  const selectFields = [
    "_id",
    "title",
    "sku",
    "slug",
    "category",
    "subjectCode",
    "session",
    "session6",
    "language",
    "lang3",
    "courseCodes",
    "price",
    "isActive",
    "availability",
    "createdAt",
    "deletedAt",
    "thumbnailUrl",
    "quickUrl",
    "pages",
    "pdfKey",
  ].join(" ");

  const baseLiveQuery = { deletedAt: null };

  const statsPromise = trash
    ? Promise.resolve({
        productStats: [],
        vaultPdfCount: 0,
        breakdown: {
          onDemandByCategory: [],
          wantToBuyByCategory: [],
        },
        filterOptions: {
          sessions: [],
          courses: [],
          languages: [],
        },
      })
    : Promise.all([
        Product.aggregate([
          { $match: baseLiveQuery },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              active: {
                $sum: {
                  $cond: [{ $eq: ["$isActive", true] }, 1, 0],
                },
              },
              availableProducts: {
                $sum: {
                  $cond: [{ $eq: ["$availability", "available"] }, 1, 0],
                },
              },
            },
          },
        ]),
        PdfVaultFile.countDocuments({ deletedAt: null }),
        getCategoryAvailabilityBreakdown(),
        getFilterOptions(),
      ]).then(([productStats, vaultPdfCount, breakdown, filterOptions]) => ({
        productStats,
        vaultPdfCount,
        breakdown,
        filterOptions,
      }));

  const [products, filteredTotal, trashCount, statsData] = await Promise.all([
    Product.find(query)
      .select(selectFields)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(query),
    Product.countDocuments({ deletedAt: { $ne: null } }),
    statsPromise,
  ]);

  const statsAgg = Array.isArray((statsData as any)?.productStats)
    ? (statsData as any).productStats
    : [];
  const statsRow = statsAgg[0] || null;

  const totalProducts = Number(statsRow?.total || 0);
  const activeProducts = Number(statsRow?.active || 0);
  const availableProducts = Number(statsRow?.availableProducts || 0);
  const inactiveProducts = Math.max(0, totalProducts - activeProducts);
  const availablePdfCount = Number((statsData as any)?.vaultPdfCount || 0);

  const totalPages = Math.max(1, Math.ceil(filteredTotal / limit));

  return NextResponse.json(
    {
      ok: true,
      count: products.length,
      products,
      filters: {
        trash,
        q,
        category,
        availability,
        isActive: isActiveParam || "",
        session,
        courseCode,
        language,
        sortBy,
      },
      filterOptions: {
        sessions: (statsData as any)?.filterOptions?.sessions || [],
        courses: (statsData as any)?.filterOptions?.courses || [],
        languages: (statsData as any)?.filterOptions?.languages || [],
      },
      pagination: {
        page,
        limit,
        skip,
        totalPages,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
      },
      totals: {
        filtered: filteredTotal,
        currentPage: products.length,
        allProducts: totalProducts,
        activeProducts,
        inactiveProducts,
        availableProducts,
        availablePdfCount,
        onDemandByCategory: (statsData as any)?.breakdown?.onDemandByCategory || [],
        wantToBuyByCategory: (statsData as any)?.breakdown?.wantToBuyByCategory || [],
        trashCount,
      },
    },
    { status: 200 }
  );
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden (products:write missing)" }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  await dbConnect();

  const title = safeStr(body?.title);
  const category = normalizeProductCategory(body?.category);

  if (category === PHYSICAL_CATEGORY && !safeBool(body?.isAutoGenerated, false)) {
    return validationError(MANUAL_HARDCOPY_BLOCK_MESSAGE, "category");
  }

  let slug = toSlug(body?.slug ? String(body.slug) : title);
  let sku = normalizeSku(body?.sku);

  const subjectCode = normalizeSubjectCode(body?.subjectCode);
  const subjectTitleHi = safeStr(body?.subjectTitleHi);
  const subjectTitleEn = safeStr(body?.subjectTitleEn);
  const subjectTitleOther = safeStr(body?.subjectTitleOther);

  const courseCodes = uniqueStrings(safeArr(body?.courseCodes).map((x) => x.toUpperCase()));
  const courseTitles = uniqueStrings(safeArr(body?.courseTitles));

  const session = safeStr(body?.session);
  const session6 = normalizeSession6(body?.session6 || session);

  const language = safeStr(body?.language);
  const lang3 = normalizeLang3(body?.lang3) || normalizeLang3(language || "OTH");

  let pages = Math.max(0, Math.trunc(safeNum(body?.pages, 0)));

  let pdfKey = "";
  const pdfUrl = safeStr(body?.pdfUrl);

  const images = uniqueStrings(safeArr(body?.images));
  const thumbnailUrl = safeStr(body?.thumbnailUrl) || images[0] || "";
  const quickUrl = safeStr(body?.quickUrl) || images[1] || images[0] || "";

  const isDigital = deriveIsDigitalFromCategory(category);

  const deliverWithinMinutes = Math.trunc(safeNum(body?.deliverWithinMinutes, 20));
  const onDemandNote = safeStr(body?.onDemandNote || body?.comingSoonNote);
  const autoMakeAvailableOnUpload = safeBool(body?.autoMakeAvailableOnUpload, true);

  const importantNote = safeStr(body?.importantNote);
  const shortDesc = safeStr(body?.shortDesc);
  const descriptionHtml = safeStr(body?.descriptionHtml);

  const metaTitle = safeStr(body?.metaTitle);
  const metaDescription = safeStr(body?.metaDescription);

  const isActive = safeBool(body?.isActive, false);

  if (!title) return validationError("Title required hai.", "title");
  if (!category) return validationError("Category required hai.", "category");
  if (!subjectCode) return validationError("Subject Code required hai.", "subjectCode");
  if (!session) return validationError("Session required hai.", "session");

  const sessionRawNormalized = safeStr(session).toLowerCase().replace(/\s+/g, " ").trim();
  const isNamedSession = sessionRawNormalized === "latest" || sessionRawNormalized === "new session";

  if (!isNamedSession && !/^\d{6}$/.test(session6)) {
    return validationError(
      "Session invalid hai. Examples: 2025-2026, 2026, July 2024, Latest",
      "session"
    );
  }

  if (!language) return validationError("Language required hai.", "language");
  if (!/^[A-Z]{3}$/.test(lang3)) {
    return validationError("lang3 invalid hai. 3 uppercase letters required.", "lang3");
  }

  if (!slug) slug = await makeUniqueSlug(title || "product");

  if (!sku) {
    const baseSku = `${subjectCode.replace(/\s+/g, "") || "CODE"}${lang3}${session6}`;
    sku = await makeUniqueSku(baseSku);
  }

  const vaultAutofill = await getVaultAutofillForSku(sku);

  if (vaultAutofill.pdfKey) {
    pdfKey = vaultAutofill.pdfKey;
  }

  if ((!pages || pages <= 0) && vaultAutofill.pages > 0) {
    pages = vaultAutofill.pages;
  }

  const pricingResolution = await resolveRequiredProductPricing({
    category,
    courseCodes,
    productSku: sku,
  });

  if (!pricingResolution.ok || Number(pricingResolution.price) <= 0) {
    return validationError(
      "Pricing rule not found. Pehle Product Pricing page me category + course rule ya product override set karo.",
      "price"
    );
  }

  const price = Math.max(0, safeNum(pricingResolution.price, 0));
  const oldPrice = Math.max(0, safeNum(pricingResolution.oldPrice, 0));

  if (safeStr(body?.pdfKey)) {
    return validationError(VAULT_MANAGED_PDF_MESSAGE, "pdfKey");
  }

  if (isDigital && safeStr(body?.availability) === "available" && !pdfKey) {
    return validationError(
      `Available digital product ke liye vault-linked PDF required hai. ${VAULT_MANAGED_PDF_MESSAGE}`,
      "pdfKey"
    );
  }

  if (!Number.isFinite(deliverWithinMinutes) || deliverWithinMinutes < 1 || deliverWithinMinutes > 1440) {
    return validationError("deliverWithinMinutes 1 se 1440 ke beech hona chahiye.", "deliverWithinMinutes");
  }

  const placeholderAvailability = pdfKey ? "available" : "want_to_buy";

  if (!DB_AVAILABILITY.has(placeholderAvailability)) {
    return validationError("Invalid derived availability value.", "availability");
  }

  const [existsSlug, existsSku] = await Promise.all([
    Product.findOne({ slug }).select("_id slug").lean(),
    Product.findOne({ sku }).select("_id sku").lean(),
  ]);

  if (existsSlug) {
    return NextResponse.json({ error: "Slug already exists", field: "slug", conflictValue: slug }, { status: 409 });
  }

  if (existsSku) {
    return NextResponse.json({ error: "SKU already exists", field: "sku", conflictValue: sku }, { status: 409 });
  }

  try {
    const doc = await Product.create({
      title,
      slug,
      sku,
      category,

      subjectCode,
      subjectTitleHi,
      subjectTitleEn,
      subjectTitleOther,

      courseCodes,
      courseTitles,

      session,
      session6,
      language,
      lang3,

      price,
      oldPrice,

      pages,
      availability: placeholderAvailability,
      importantNote,

      deliverWithinMinutes,
      onDemandNote,
      autoMakeAvailableOnUpload,

      shortDesc,
      descriptionHtml,

      isDigital,

      pdfKey,
      pdfUrl,

      images,
      thumbnailUrl,
      quickUrl,

      metaTitle,
      metaDescription,

      isAutoGenerated: false,
      autoGenerationType: "",
      autoGeneratedFromProductId: null,
      autoGeneratedFromSku: "",
      autoGeneratedFromCategory: "",
      autoGeneratedAt: null,

      isActive,
      lastModifiedAt: new Date(),

      deletedAt: null,
      deletedBy: "",
    });

    const availabilitySync = await runInitialAvailabilitySyncForCreatedProduct(doc);
    const freshDoc: any = await Product.findById(doc._id);

    const finalDoc = freshDoc || doc;

    const resolveResult = await autoResolveWantToBuyForProduct({
      productId: finalDoc._id,
      availability: finalDoc.availability,
      pdfKey: finalDoc.pdfKey,
      isActive: finalDoc.isActive,
    });

    let comboSync: any = { ok: true, skipped: true };
    try {
      comboSync = await syncGeneratedCombosForProductChange({
        after: finalDoc.toObject ? finalDoc.toObject() : finalDoc,
      });
    } catch (syncErr: any) {
      comboSync = {
        ok: false,
        error: safeStr(syncErr?.message || "Combo sync failed"),
      };
    }

    let hardcopySync: any = { ok: true, skipped: true };
    try {
      hardcopySync = await syncGeneratedHardcopyForProductChange({
        after: finalDoc.toObject ? finalDoc.toObject() : finalDoc,
      });
    } catch (syncErr: any) {
      hardcopySync = {
        ok: false,
        error: safeStr(syncErr?.message || "Hardcopy sync failed"),
      };
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Product created ✅",
        product: finalDoc,
        pricingResolution,
        autoResolvedWantToBuy: resolveResult,
        comboSync,
        hardcopySync,
        vaultAutofill: {
          pdfLinked: Boolean(pdfKey),
          pagesFilled: Number(finalDoc.pages || 0),
        },
        availabilityAutomation: {
          mode: "derived-and-synced-on-create",
          syncOk: Boolean(availabilitySync?.ok),
          syncReason: safeStr(availabilitySync?.reason || ""),
          finalAvailability:
            getAvailabilityAfterSync(availabilitySync) || safeStr(finalDoc.availability || ""),
        },
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
      { error: e?.message || "Failed to create product" },
      { status: 500 }
    );
  }
}