import { NextRequest, NextResponse } from "next/server";

import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import { productHref } from "@/lib/productHref";
import { getAuthUser, hasPermission } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BASE_URL = "https://istudentsportal.com";

const INDEXABLE_CATEGORY_VALUES = [
  "Solved Assignments",
  "solved-assignments",

  "Handwritten PDFs",
  "handwritten-pdfs",

  "Handwritten Hardcopy (Delivery)",
  "Handwritten Hardcopy",
  "handwritten-hardcopy",

  "Question Papers (PYQ)",
  "Question Papers",
  "question-papers",

  "Guess Papers",
  "guess-papers",

  "eBooks/Notes",
  "Ebooks/Notes",
  "eBooks",
  "Ebooks",
  "ebooks",

  "Projects & Synopsis",
  "Projects",
  "projects",
];

const INDEXABLE_PREFIXES = new Set([
  "solved-assignments",
  "handwritten-pdfs",
  "handwritten-hardcopy",
  "question-papers",
  "guess-papers",
  "ebooks",
  "projects",
]);

type ProductDoc = {
  _id: any;
  title?: string;
  slug?: string;
  sku?: string;
  category?: string;
  subjectCode?: string;
  subjectTitleHi?: string;
  subjectTitleEn?: string;
  courseCodes?: string[];
  courseTitles?: string[];
  session?: string;
  language?: string;
  price?: number;
  shortDesc?: string;
  descriptionHtml?: string;
  metaTitle?: string;
  metaDescription?: string;
  thumbnailUrl?: string;
  quickUrl?: string;
  images?: string[];
  availability?: string;
  isActive?: boolean;
  deletedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  createdAt?: Date | string | null;
};

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function safeNum(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function stripHtml(value: unknown) {
  return safeStr(value)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?[^>]+(>|$)/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(value: unknown) {
  return safeStr(value).replace(/\s+/g, " ").trim();
}

function normalizeCategory(value: unknown) {
  const raw = safeStr(value);
  const loose = raw.toLowerCase().replace(/\s+/g, " ").trim();

  const map: Record<string, string> = {
    "solved assignments": "Solved Assignments",
    "solved assignment": "Solved Assignments",

    "question papers (pyq)": "Question Papers (PYQ)",
    "question papers": "Question Papers (PYQ)",
    "question paper": "Question Papers (PYQ)",
    pyq: "Question Papers (PYQ)",

    "handwritten pdfs": "Handwritten PDFs",
    "handwritten pdf": "Handwritten PDFs",

    "handwritten hardcopy (delivery)": "Handwritten Hardcopy (Delivery)",
    "handwritten hardcopy delivery": "Handwritten Hardcopy (Delivery)",
    "handwritten hardcopy": "Handwritten Hardcopy (Delivery)",
    hardcopy: "Handwritten Hardcopy (Delivery)",

    ebooks: "Ebooks",
    ebook: "Ebooks",
    "ebooks/notes": "Ebooks",
    "ebooks notes": "Ebooks",
    notes: "Ebooks",

    projects: "projects",
    project: "projects",
    "projects & synopsis": "projects",

    "guess papers": "Guess Papers",
    "guess paper": "Guess Papers",
  };

  return map[loose] || raw;
}

function cleanPath(path: string) {
  const clean = safeStr(path).split("?")[0].split("#")[0];

  if (!clean) return "";
  if (!clean.startsWith("/")) return "";
  if (clean === "/") return "/";

  return clean.replace(/\/+$/, "");
}

function hasLocalhost(value: unknown) {
  return /https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i.test(
    safeStr(value)
  );
}

function isWeakMetaTitle(value: unknown) {
  const text = compactText(value);

  if (!text) return true;
  if (text.length < 25) return true;
  if (/undefined|null|%[a-z]/i.test(text)) return true;

  return false;
}

function isLongMetaTitle(value: unknown) {
  const text = compactText(value);
  return text.length > 110;
}

function isWeakMetaDescription(value: unknown) {
  const text = compactText(value);

  if (!text) return true;
  if (text.length < 70) return true;
  if (/undefined|null|%[a-z]/i.test(text)) return true;

  return false;
}

function isLongMetaDescription(value: unknown) {
  const text = compactText(value);
  return text.length > 230;
}

function isWeakShortDesc(value: unknown) {
  const text = stripHtml(value);

  if (!text) return true;
  if (text.length < 80) return true;
  if (/undefined|null|%[a-z]/i.test(text)) return true;

  return false;
}

function isWeakLongDesc(value: unknown) {
  const text = stripHtml(value);
  const lower = text.toLowerCase();

  if (!text) return true;
  if (text.length < 650) return true;
  if (/undefined|null|%[a-z]/i.test(text)) return true;

  const weakSignals = [
    "no related products found",
    "no. of pages 0",
    "download it now",
    "buy it now",
    "prepared for session %c",
  ];

  return weakSignals.some((signal) => lower.includes(signal));
}

function imageCount(product: ProductDoc) {
  const images = Array.isArray(product.images)
    ? product.images.map((item) => safeStr(item)).filter(Boolean)
    : [];

  const extra = [
    safeStr(product.thumbnailUrl),
    safeStr(product.quickUrl),
  ].filter(Boolean);

  return new Set([...images, ...extra]).size;
}

function hasGeneratedThumbnail(product: ProductDoc) {
  const category = normalizeCategory(product.category);
  const subjectCode = safeStr(product.subjectCode);
  const title = safeStr(product.title);
  const session = safeStr(product.session);
  const language = safeStr(product.language);

  if (!title) return false;

  if (
    category === "Solved Assignments" ||
    category === "Question Papers (PYQ)" ||
    category === "Handwritten Hardcopy (Delivery)"
  ) {
    return Boolean(subjectCode || session || language);
  }

  return false;
}

function effectiveImageCount(product: ProductDoc) {
  const stored = imageCount(product);
  if (stored > 0) return stored;

  return hasGeneratedThumbnail(product) ? 1 : 0;
}

function hasImageLocalhost(product: ProductDoc) {
  const values = [
    safeStr(product.thumbnailUrl),
    safeStr(product.quickUrl),
    ...(Array.isArray(product.images) ? product.images : []),
  ];

  return values.some(hasLocalhost);
}

function isValidSlug(value: unknown) {
  const slug = safeStr(value);

  if (!slug) return false;
  if (slug.includes("?") || slug.includes("#")) return false;
  if (slug.startsWith("/") || slug.endsWith("/")) return false;
  if (slug.toLowerCase() === "undefined" || slug.toLowerCase() === "null") return false;

  return true;
}

function getCanonicalPath(product: ProductDoc) {
  try {
    const path = cleanPath(
      productHref({
        slug: safeStr(product.slug),
        category: safeStr(product.category),
      })
    );

    return path;
  } catch {
    return "";
  }
}

function isIndexableCanonical(product: ProductDoc) {
  const path = getCanonicalPath(product);
  if (!path) return false;

  const parts = path.split("/").filter(Boolean);
  if (parts.length !== 2) return false;

  const prefix = parts[0];
  const slug = parts[1];

  if (!INDEXABLE_PREFIXES.has(prefix)) return false;
  if (!isValidSlug(slug)) return false;
  if (path.startsWith("/products/")) return false;
  if (path.startsWith("/combo/")) return false;

  return true;
}

function productFilter(category?: string) {
  const filter: any = {
    isActive: true,
    slug: { $exists: true, $ne: "" },
    category: { $in: INDEXABLE_CATEGORY_VALUES },
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  };

  const normalized = normalizeCategory(category);

  if (normalized && INDEXABLE_CATEGORY_VALUES.includes(normalized)) {
    filter.category = normalized;
  }

  return filter;
}

async function assertAdminAccess() {
  const user = await getAuthUser();

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      ),
    };
  }

  if (!hasPermission(user, "products:read") && !hasPermission(user, "products:write")) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Forbidden: products read/write permission required" },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, user };
}

function createEmptyCounters() {
  return {
    scanned: 0,
    weakMetaTitle: 0,
    longMetaTitle: 0,
    weakMetaDescription: 0,
    longMetaDescription: 0,
    weakShortDesc: 0,
    weakLongDesc: 0,
    missingSubjectCode: 0,
    missingCourseCodes: 0,
    missingSession: 0,
    missingLanguage: 0,
    missingImage: 0,
    generatedThumbnailUsed: 0,
    imageLocalhost: 0,
    invalidSlug: 0,
    invalidCanonical: 0,
    localhostInTextFields: 0,
    zeroOrInvalidPrice: 0,
  };
}

function analyzeProduct(product: ProductDoc) {
  const issues: string[] = [];

  if (isWeakMetaTitle(product.metaTitle)) issues.push("weakMetaTitle");
  if (isLongMetaTitle(product.metaTitle)) issues.push("longMetaTitle");

  if (isWeakMetaDescription(product.metaDescription)) {
    issues.push("weakMetaDescription");
  } else if (isLongMetaDescription(product.metaDescription)) {
    issues.push("longMetaDescription");
  }

  if (isWeakShortDesc(product.shortDesc)) issues.push("weakShortDesc");
  if (isWeakLongDesc(product.descriptionHtml)) issues.push("weakLongDesc");

  if (!safeStr(product.subjectCode)) issues.push("missingSubjectCode");

  if (
    !Array.isArray(product.courseCodes) ||
    !product.courseCodes.map((item) => safeStr(item)).filter(Boolean).length
  ) {
    issues.push("missingCourseCodes");
  }

  if (!safeStr(product.session)) issues.push("missingSession");
  if (!safeStr(product.language)) issues.push("missingLanguage");

  if (effectiveImageCount(product) === 0) {
    issues.push("missingImage");
  } else if (imageCount(product) === 0 && hasGeneratedThumbnail(product)) {
    issues.push("generatedThumbnailUsed");
  }

  if (hasImageLocalhost(product)) issues.push("imageLocalhost");
  if (!isValidSlug(product.slug)) issues.push("invalidSlug");
  if (!isIndexableCanonical(product)) issues.push("invalidCanonical");

  const textFields = [
    product.title,
    product.shortDesc,
    product.descriptionHtml,
    product.metaTitle,
    product.metaDescription,
  ];

  if (textFields.some(hasLocalhost)) issues.push("localhostInTextFields");

  if (safeNum(product.price, 0) < 0) issues.push("zeroOrInvalidPrice");

  return issues;
}

export async function GET(req: NextRequest) {
  const guard = await assertAdminAccess();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);

  const category = safeStr(url.searchParams.get("category"));
  const limit = clamp(Math.trunc(safeNum(url.searchParams.get("limit"), 1000)), 1, 5000);
  const skip = Math.max(0, Math.trunc(safeNum(url.searchParams.get("skip"), 0)));
  const onlyIssues = safeStr(url.searchParams.get("onlyIssues")).toLowerCase() !== "false";

  await dbConnect();

  const filter = productFilter(category);

  const [totalMatching, products] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter)
      .select(
        [
          "_id",
          "title",
          "slug",
          "sku",
          "category",
          "subjectCode",
          "subjectTitleHi",
          "subjectTitleEn",
          "courseCodes",
          "courseTitles",
          "session",
          "language",
          "price",
          "shortDesc",
          "descriptionHtml",
          "metaTitle",
          "metaDescription",
          "thumbnailUrl",
          "quickUrl",
          "images",
          "availability",
          "isActive",
          "deletedAt",
          "updatedAt",
          "createdAt",
        ].join(" ")
      )
      .sort({ updatedAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const counters = createEmptyCounters();
  const categoryBreakdown: Record<string, number> = {};
  const issueSamples: any[] = [];

  for (const product of products as ProductDoc[]) {
    counters.scanned += 1;

    const normalizedCategory = normalizeCategory(product.category) || "unknown";
    categoryBreakdown[normalizedCategory] = (categoryBreakdown[normalizedCategory] || 0) + 1;

    const issues = analyzeProduct(product);

    for (const issue of issues) {
      if (issue in counters) {
        (counters as any)[issue] += 1;
      }
    }

    const visibleIssues = issues.filter((issue) => issue !== "generatedThumbnailUsed");

    if ((!onlyIssues || visibleIssues.length) && issueSamples.length < 100) {
      const path = getCanonicalPath(product);

      issueSamples.push({
        id: String(product._id),
        sku: safeStr(product.sku),
        title: safeStr(product.title),
        category: safeStr(product.category),
        slug: safeStr(product.slug),
        canonicalPath: path,
        canonicalUrl: path ? `${BASE_URL}${path}` : "",
        issues: visibleIssues,
        metaTitleLength: compactText(product.metaTitle).length,
        metaDescriptionLength: compactText(product.metaDescription).length,
        shortDescLength: stripHtml(product.shortDesc).length,
        descriptionLength: stripHtml(product.descriptionHtml).length,
        imageCount: effectiveImageCount(product),
        storedImageCount: imageCount(product),
        generatedThumbnail: hasGeneratedThumbnail(product),
        updatedAt: product.updatedAt || null,
      });
    }
  }

  const totalIssueCount = Object.entries(counters)
    .filter(([key]) => key !== "scanned" && key !== "generatedThumbnailUsed")
    .reduce((sum, [, value]) => sum + Number(value || 0), 0);

  return NextResponse.json({
    ok: true,
    baseUrl: BASE_URL,
    category: normalizeCategory(category) || "all",
    limit,
    skip,
    nextSkip: skip + limit,
    totalMatching,
    scanned: counters.scanned,
    totalIssueCount,
    categoryBreakdown,
    counters,
    note:
      "generatedThumbnailUsed means DB image is not stored, but runtime generated thumbnail is available. It is not counted as a blocking issue.",
    issueSamples,
    nextRecommendedUrl:
      skip + limit < totalMatching
        ? `/api/admin/seo/health-check?limit=${limit}&skip=${skip + limit}${
            category ? `&category=${encodeURIComponent(normalizeCategory(category))}` : ""
          }`
        : null,
    message:
      totalIssueCount === 0
        ? "SEO health check passed for this batch."
        : "SEO health check completed. Review counters and issueSamples.",
  });
}