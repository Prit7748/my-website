import { NextRequest, NextResponse } from "next/server";

import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import { getAuthUser, hasPermission } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_TARGET_LENGTH = 180;
const DEFAULT_LONG_THRESHOLD = 230;
const DEFAULT_SUBJECT_TITLE_MAX = 45;

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

type ProductDoc = {
  _id: any;
  title?: string;
  slug?: string;
  sku?: string;
  category?: string;

  subjectCode?: string;
  subjectTitleHi?: string;
  subjectTitleEn?: string;
  subjectTitleOther?: string;

  courseCodes?: string[];
  courseTitles?: string[];

  session?: string;
  language?: string;
  metaDescription?: string;
};

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function safeNum(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeBool(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;

  const text = safeStr(value).toLowerCase();

  if (["1", "true", "yes", "on"].includes(text)) return true;
  if (["0", "false", "no", "off"].includes(text)) return false;

  return fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function compactText(value: unknown) {
  return safeStr(value).replace(/\s+/g, " ").trim();
}

function truncateClean(value: unknown, maxLength: number) {
  const text = compactText(value);

  if (!text) return "";
  if (text.length <= maxLength) return text;

  const sliced = text.slice(0, maxLength).trim();
  const lastSpace = sliced.lastIndexOf(" ");

  const clean =
    lastSpace > Math.floor(maxLength * 0.55)
      ? sliced.slice(0, lastSpace).trim()
      : sliced;

  return clean.replace(/[,.|;:-]+$/g, "").trim() + "...";
}

function finalTrim(value: unknown, maxLength: number) {
  const text = compactText(value);

  if (!text) return "";
  if (text.length <= maxLength) return text;

  const sliced = text.slice(0, maxLength).trim();
  const lastSpace = sliced.lastIndexOf(" ");

  const clean =
    lastSpace > Math.floor(maxLength * 0.65)
      ? sliced.slice(0, lastSpace).trim()
      : sliced;

  return clean.replace(/[,.|;:-]+$/g, "").trim();
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

function categoryProductLabel(category: string) {
  const normalized = normalizeCategory(category);

  const map: Record<string, string> = {
    "Solved Assignments": "solved assignment",
    "Question Papers (PYQ)": "solved previous year paper",
    "Handwritten PDFs": "handwritten PDF",
    "Handwritten Hardcopy (Delivery)": "handwritten hardcopy assignment",
    Ebooks: "ebook notes",
    projects: "project and synopsis",
    "Guess Papers": "guess paper",
  };

  return map[normalized] || "study material";
}

function categoryAction(category: string) {
  const normalized = normalizeCategory(category);

  if (normalized === "Handwritten Hardcopy (Delivery)") return "Order";

  return "Download";
}

function categoryTail(category: string) {
  const normalized = normalizeCategory(category);

  const map: Record<string, string> = {
    "Solved Assignments": "assignment writing support.",
    "Question Papers (PYQ)": "PYQ exam preparation support.",
    "Handwritten PDFs": "handwritten study support.",
    "Handwritten Hardcopy (Delivery)": "physical delivery support.",
    Ebooks: "digital study notes support.",
    projects: "project reference support.",
    "Guess Papers": "focused exam preparation support.",
  };

  return map[normalized] || "IGNOU study support.";
}

function chooseSubjectTitle(product: ProductDoc) {
  const language = safeStr(product.language).toLowerCase();

  if (language.includes("hindi") || language.includes("hin")) {
    return (
      safeStr(product.subjectTitleHi) ||
      safeStr(product.subjectTitleEn) ||
      safeStr(product.subjectTitleOther)
    );
  }

  return (
    safeStr(product.subjectTitleEn) ||
    safeStr(product.subjectTitleHi) ||
    safeStr(product.subjectTitleOther)
  );
}

function firstCourseCode(product: ProductDoc) {
  if (!Array.isArray(product.courseCodes)) return "";

  return safeStr(product.courseCodes.find((item) => safeStr(item)));
}

function buildSmartMetaDescription(input: {
  product: ProductDoc;
  subjectTitleMax: number;
  targetLength: number;
}) {
  const { product, subjectTitleMax, targetLength } = input;

  const category = normalizeCategory(product.category);
  const action = categoryAction(category);
  const label = categoryProductLabel(category);
  const subjectCode = safeStr(product.subjectCode);
  const subjectTitle = truncateClean(chooseSubjectTitle(product), subjectTitleMax);
  const session = safeStr(product.session);
  const language = safeStr(product.language);
  const courseCode = firstCourseCode(product);
  const tail = categoryTail(category);

  const parts = [
    `${action} IGNOU${subjectCode ? ` ${subjectCode}` : ""} ${label}`,
    subjectTitle ? `for ${subjectTitle}` : "",
    session ? `${session} session` : "",
    language ? `in ${language} medium` : "",
    courseCode ? `Course: ${courseCode}.` : "",
    tail,
  ];

  let description = compactText(parts.filter(Boolean).join(" "));

  if (description.length <= targetLength) {
    return description;
  }

  const compactWithoutCourse = [
    `${action} IGNOU${subjectCode ? ` ${subjectCode}` : ""} ${label}`,
    subjectTitle ? `for ${subjectTitle}` : "",
    session ? `${session} session` : "",
    language ? `in ${language} medium.` : ".",
    tail,
  ];

  description = compactText(compactWithoutCourse.filter(Boolean).join(" "));

  if (description.length <= targetLength) {
    return description;
  }

  const shorterSubjectTitle = truncateClean(
    chooseSubjectTitle(product),
    Math.max(25, Math.floor(subjectTitleMax * 0.7))
  );

  const compactShort = [
    `${action} IGNOU${subjectCode ? ` ${subjectCode}` : ""} ${label}`,
    shorterSubjectTitle ? `for ${shorterSubjectTitle}` : "",
    session ? `${session}` : "",
    language ? `${language} medium.` : ".",
    tail,
  ];

  description = compactText(compactShort.filter(Boolean).join(" "));

  return finalTrim(description, targetLength);
}

function productFilter(category?: string, force = false, threshold = DEFAULT_LONG_THRESHOLD) {
  const filter: any = {
    isActive: true,
    slug: { $exists: true, $ne: "" },
    category: { $in: INDEXABLE_CATEGORY_VALUES },
    metaDescription: { $exists: true, $type: "string" },
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  };

  const normalizedCategory = normalizeCategory(category);

  if (normalizedCategory && INDEXABLE_CATEGORY_VALUES.includes(normalizedCategory)) {
    filter.category = normalizedCategory;
  }

  if (!force) {
    filter.$expr = {
      $gt: [{ $strLenCP: "$metaDescription" }, threshold],
    };
  }

  return filter;
}

async function assertAdminWriteAccess() {
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

  if (!hasPermission(user, "products:write")) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Forbidden: products:write permission required" },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, user };
}

async function runRegenerate(req: NextRequest, body?: any) {
  const guard = await assertAdminWriteAccess();

  if (!guard.ok) return guard.response;

  const url = new URL(req.url);

  const dryRun =
    body?.dryRun !== undefined
      ? safeBool(body.dryRun, true)
      : safeBool(url.searchParams.get("dryRun"), true);

  const force =
    body?.force !== undefined
      ? safeBool(body.force, false)
      : safeBool(url.searchParams.get("force"), false);

  const category =
    body?.category !== undefined
      ? safeStr(body.category)
      : safeStr(url.searchParams.get("category"));

  const limit =
    body?.limit !== undefined
      ? clamp(Math.trunc(safeNum(body.limit, 100)), 1, 500)
      : clamp(Math.trunc(safeNum(url.searchParams.get("limit"), 100)), 1, 500);

  const threshold =
    body?.threshold !== undefined
      ? clamp(Math.trunc(safeNum(body.threshold, DEFAULT_LONG_THRESHOLD)), 160, 500)
      : clamp(Math.trunc(safeNum(url.searchParams.get("threshold"), DEFAULT_LONG_THRESHOLD)), 160, 500);

  const targetLength =
    body?.targetLength !== undefined
      ? clamp(Math.trunc(safeNum(body.targetLength, DEFAULT_TARGET_LENGTH)), 140, 220)
      : clamp(Math.trunc(safeNum(url.searchParams.get("targetLength"), DEFAULT_TARGET_LENGTH)), 140, 220);

  const subjectTitleMax =
    body?.subjectTitleMax !== undefined
      ? clamp(Math.trunc(safeNum(body.subjectTitleMax, DEFAULT_SUBJECT_TITLE_MAX)), 20, 90)
      : clamp(Math.trunc(safeNum(url.searchParams.get("subjectTitleMax"), DEFAULT_SUBJECT_TITLE_MAX)), 20, 90);

  await dbConnect();

  const filter = productFilter(category, force, threshold);

  const products: ProductDoc[] = await Product.find(filter)
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
        "subjectTitleOther",
        "courseCodes",
        "courseTitles",
        "session",
        "language",
        "metaDescription",
      ].join(" ")
    )
    .sort({ updatedAt: -1, _id: -1 })
    .limit(limit)
    .lean();

  const preview: any[] = [];
  let updateCandidates = 0;
  let updated = 0;
  let skipped = 0;

  for (const product of products) {
    const before = compactText(product.metaDescription);
    const after = buildSmartMetaDescription({
      product,
      subjectTitleMax,
      targetLength,
    });

    if (!after || after === before) {
      skipped += 1;
      continue;
    }

    updateCandidates += 1;

    preview.push({
      id: String(product._id),
      sku: safeStr(product.sku),
      slug: safeStr(product.slug),
      category: safeStr(product.category),
      title: safeStr(product.title),
      subjectTitleOriginal: chooseSubjectTitle(product),
      beforeLength: before.length,
      afterLength: after.length,
      before,
      after,
    });

    if (!dryRun) {
      await Product.updateOne(
        { _id: product._id },
        {
          $set: {
            metaDescription: after,
            lastModifiedAt: new Date(),
          },
        }
      );

      updated += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    mode: dryRun ? "preview" : "execute",
    dryRun,
    force,
    category: normalizeCategory(category) || "all",
    limit,
    threshold,
    targetLength,
    subjectTitleMax,
    scanned: products.length,
    updateCandidates,
    updated,
    skipped,
    message: dryRun
      ? "Preview completed. Check before/after, then run dryRun=false."
      : "Smart meta descriptions regenerated for this batch.",
    nextRecommendedUrl: `/api/admin/products/meta-description-regenerate?dryRun=false&limit=${limit}&threshold=${threshold}&targetLength=${targetLength}&subjectTitleMax=${subjectTitleMax}${
      category ? `&category=${encodeURIComponent(normalizeCategory(category))}` : ""
    }`,
    preview: preview.slice(0, 25),
  });
}

export async function GET(req: NextRequest) {
  return runRegenerate(req);
}

export async function POST(req: NextRequest) {
  let body: any = {};

  try {
    body = await req.json();
  } catch {
    body = {};
  }

  return runRegenerate(req, body);
}