import { NextRequest, NextResponse } from "next/server";
import type { SortOrder } from "mongoose";

import dbConnect from "@/lib/db";
import { getAuthUser, hasPermission } from "@/lib/auth";
import Product from "@/models/Product";
import Session from "@/models/Session";
import {
  normalizeProductCategory,
  CATEGORY_CONFIG,
} from "@/lib/productCatalog";
import { getReadableProductMeta } from "@/lib/productDisplay";
import {
  getYoutubeContentKindFromCategory,
  getYoutubeKindLabel,
  isYoutubeSupportedProduct,
  YOUTUBE_ASSIGNMENT_CATEGORY,
  YOUTUBE_PYQ_CATEGORY,
  type YoutubeContentKind,
} from "@/lib/youtubeContent";
import {
  getYoutubeProductAbsoluteUrl,
  getYoutubeProductCourseCodes,
  getYoutubeProductCourseTitles,
  getYoutubeProductSubjectTitle,
} from "@/lib/youtubeTokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SortKey = "latest" | "oldest" | "subject_asc" | "sku_asc";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSpaces(input: any) {
  return safeStr(input).replace(/\s+/g, " ").trim();
}

function normalizeSkuLike(input: any) {
  return safeStr(input).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeSubjectCodeLike(input: any) {
  return safeStr(input).toUpperCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeLang3(input: any) {
  const s = safeStr(input).toUpperCase().replace(/[^A-Z]/g, "");
  if (!s) return "";
  if (s.startsWith("HIN")) return "HIN";
  if (s.startsWith("ENG")) return "ENG";
  if (s.startsWith("URD")) return "URD";
  if (s.startsWith("SAN")) return "SAN";
  return s.slice(0, 3);
}

function normalizeSession6(input: any) {
  const s = safeStr(input);
  if (!s) return "";

  if (/^\d{6}$/.test(s)) return s;

  const years4 = s.match(/\d{4}/g) || [];
  if (years4.length >= 2) return `${years4[0]}${years4[1].slice(-2)}`;

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

  const digits = s.replace(/\D/g, "");
  if (digits.length >= 6) return digits.slice(0, 6);

  return "";
}

function normalizeYoutubeCategoryFilter(input: any): YoutubeContentKind | "" {
  const raw = safeStr(input).toLowerCase();
  const normalized = normalizeProductCategory(input);

  if (!raw || raw === "all") return "";
  if (raw === "assignment" || raw === "assignments") return "assignment";
  if (raw === "pyq" || raw === "question-papers" || raw === "question papers") return "pyq";

  const kind = getYoutubeContentKindFromCategory(normalized);
  return kind || "";
}

function buildSort(sortByRaw: any): Record<string, SortOrder> {
  const sortBy = safeStr(sortByRaw) as SortKey;

  switch (sortBy) {
    case "oldest":
      return { createdAt: 1, _id: 1 };
    case "subject_asc":
      return { subjectCode: 1, sku: 1, _id: -1 };
    case "sku_asc":
      return { sku: 1, _id: -1 };
    case "latest":
    default:
      return { createdAt: -1, _id: -1 };
  }
}

function buildProductQuery(url: URL) {
  const q = safeStr(url.searchParams.get("q"));
  const categoryRaw = safeStr(url.searchParams.get("category"));
  const categoryKind = normalizeYoutubeCategoryFilter(categoryRaw);
  const session = safeStr(url.searchParams.get("session"));
  const medium = safeStr(url.searchParams.get("medium"));
  const onlyActive = safeStr(url.searchParams.get("onlyActive")).toLowerCase();

  const categoryList =
    categoryKind === "assignment"
      ? [YOUTUBE_ASSIGNMENT_CATEGORY]
      : categoryKind === "pyq"
      ? [YOUTUBE_PYQ_CATEGORY]
      : [YOUTUBE_ASSIGNMENT_CATEGORY, YOUTUBE_PYQ_CATEGORY];

  const query: any = {
    deletedAt: null,
    category: { $in: categoryList },
  };

  if (onlyActive === "1" || onlyActive === "true" || onlyActive === "yes") {
    query.isActive = true;
  }

  if (session) {
    const rx = new RegExp(escapeRegex(session), "i");
    const session6 = normalizeSession6(session);

    query.$and = Array.isArray(query.$and) ? query.$and : [];
    query.$and.push({
      $or: [{ session: rx }, ...(session6 ? [{ session6 }] : [])],
    });
  }

  if (medium) {
    const rx = new RegExp(escapeRegex(medium), "i");
    const lang3 = normalizeLang3(medium);

    query.$and = Array.isArray(query.$and) ? query.$and : [];
    query.$and.push({
      $or: [{ language: rx }, ...(lang3 ? [{ lang3 }] : [])],
    });
  }

  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    const skuLike = normalizeSkuLike(q);
    const subjectLike = normalizeSubjectCodeLike(q);

    const orList: any[] = [
      { title: rx },
      { sku: rx },
      { slug: rx },
      { subjectCode: rx },
      { subjectTitleEn: rx },
      { subjectTitleHi: rx },
      { subjectTitleOther: rx },
      { courseCodes: rx },
      { courseTitles: rx },
      { session: rx },
      { language: rx },
    ];

    if (skuLike) {
      orList.push({ sku: new RegExp(escapeRegex(skuLike), "i") });
    }

    if (subjectLike) {
      orList.push({ subjectCode: new RegExp(escapeRegex(subjectLike), "i") });
    }

    query.$and = Array.isArray(query.$and) ? query.$and : [];
    query.$and.push({ $or: orList });
  }

  return {
    query,
    q,
    categoryKind,
    session,
    medium,
  };
}

function mapProductForYoutube(product: any) {
  const readable = getReadableProductMeta({
    subjectCode: product?.subjectCode,
    session: product?.session,
    session6: product?.session6,
    language: product?.language,
    lang3: product?.lang3,
    sku: product?.sku,
  });

  const kind = getYoutubeContentKindFromCategory(product?.category) as YoutubeContentKind;
  const subjectTitle = getYoutubeProductSubjectTitle(product);
  const courseCodes = getYoutubeProductCourseCodes(product);
  const courseTitles = getYoutubeProductCourseTitles(product);
  const productLink = getYoutubeProductAbsoluteUrl(product);

  return {
    _id: safeStr(product?._id),
    kind,
    kindLabel: kind ? getYoutubeKindLabel(kind) : "YouTube",
    title: safeStr(product?.title),
    sku: safeStr(product?.sku),
    slug: safeStr(product?.slug),
    category: normalizeProductCategory(product?.category),
    subjectCode: normalizeSpaces(readable.subjectCode || product?.subjectCode),
    subjectTitle,
    courseCodes,
    courseTitles,
    courseCodesList: Array.isArray(product?.courseCodes) ? product.courseCodes : [],
    courseTitlesList: Array.isArray(product?.courseTitles) ? product.courseTitles : [],
    session: normalizeSpaces(readable.session || product?.session),
    sessionRaw: safeStr(product?.session),
    session6: safeStr(product?.session6),
    medium: normalizeSpaces(readable.medium || product?.language),
    language: safeStr(product?.language),
    lang3: safeStr(product?.lang3),
    productLink,
    isActive: Boolean(product?.isActive),
    availability: safeStr(product?.availability),
    createdAt: product?.createdAt || null,
    updatedAt: product?.updatedAt || null,
    lastModifiedAt: product?.lastModifiedAt || null,
  };
}

async function getFilterOptions() {
  const [sessionsRaw, languagesRaw] = await Promise.all([
    Session.find({ isActive: true })
      .sort({ sortOrder: 1, name: 1, _id: 1 })
      .select("_id name slug categories")
      .lean(),
    Product.aggregate([
      {
        $match: {
          deletedAt: null,
          category: { $in: [YOUTUBE_ASSIGNMENT_CATEGORY, YOUTUBE_PYQ_CATEGORY] },
          language: { $type: "string", $ne: "" },
        },
      },
      { $group: { _id: "$language" } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const sessions = (Array.isArray(sessionsRaw) ? sessionsRaw : []).map((row: any) => ({
    _id: safeStr(row?._id),
    name: safeStr(row?.name),
    slug: safeStr(row?.slug),
  }));

  const mediums = Array.from(
    new Set(
      (Array.isArray(languagesRaw) ? languagesRaw : [])
        .map((row: any) => safeStr(row?._id))
        .filter(Boolean)
    )
  );

  const categories = CATEGORY_CONFIG.filter((item) =>
    [YOUTUBE_ASSIGNMENT_CATEGORY, YOUTUBE_PYQ_CATEGORY].includes(item.label)
  ).map((item) => ({
    label: item.label,
    kind: getYoutubeContentKindFromCategory(item.label),
    slugKey: item.slugKey,
  }));

  return {
    sessions,
    mediums,
    categories,
  };
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!hasPermission(user, "products:read") && !hasPermission(user, "products:write")) {
    return NextResponse.json(
      { error: "Forbidden (products permission missing)" },
      { status: 403 }
    );
  }

  await dbConnect();

  const url = new URL(req.url);
  const { query, q, categoryKind, session, medium } = buildProductQuery(url);

  const pageRaw = Math.trunc(safeNum(url.searchParams.get("page"), 1));
  const page = Math.max(pageRaw || 1, 1);

  const limitRaw = Math.trunc(safeNum(url.searchParams.get("limit"), 20));
  const limit = Math.min(Math.max(limitRaw || 20, 1), 80);

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
    "subjectTitleHi",
    "subjectTitleEn",
    "subjectTitleOther",
    "courseCodes",
    "courseTitles",
    "session",
    "session6",
    "language",
    "lang3",
    "isActive",
    "availability",
    "createdAt",
    "updatedAt",
    "lastModifiedAt",
  ].join(" ");

  try {
    const [productsRaw, filteredTotal, filterOptions] = await Promise.all([
      Product.find(query)
        .select(selectFields)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(query),
      getFilterOptions(),
    ]);

    const products = (Array.isArray(productsRaw) ? productsRaw : [])
      .filter((product: any) => isYoutubeSupportedProduct(product))
      .map(mapProductForYoutube);

    const totalPages = Math.max(1, Math.ceil(filteredTotal / limit));

    return NextResponse.json(
      {
        ok: true,
        products,
        count: products.length,
        filters: {
          q,
          category: categoryKind || "",
          session,
          medium,
          sortBy,
        },
        filterOptions,
        pagination: {
          page,
          limit,
          skip,
          totalPages,
          total: filteredTotal,
          hasPrevPage: page > 1,
          hasNextPage: page < totalPages,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        error: e?.message || "Failed to load YouTube products",
      },
      { status: 500 }
    );
  }
}