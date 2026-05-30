import { NextRequest, NextResponse } from "next/server";

import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import { getAuthUser, hasPermission } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_META_DESCRIPTION_LENGTH = 180;
const LONG_META_DESCRIPTION_THRESHOLD = 230;

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

function trimMetaDescription(value: unknown, maxLength = MAX_META_DESCRIPTION_LENGTH) {
  const text = compactText(value);

  if (!text) return "";
  if (text.length <= maxLength) return text;

  const sliced = text.slice(0, maxLength).trim();
  const lastSpace = sliced.lastIndexOf(" ");

  if (lastSpace > Math.floor(maxLength * 0.65)) {
    return sliced.slice(0, lastSpace).replace(/[,.|;:-]+$/g, "").trim();
  }

  return sliced.replace(/[,.|;:-]+$/g, "").trim();
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

function productFilter(category?: string) {
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

async function runTrim(req: NextRequest, body?: any) {
  const guard = await assertAdminWriteAccess();

  if (!guard.ok) return guard.response;

  const url = new URL(req.url);

  const dryRun =
    body?.dryRun !== undefined
      ? safeBool(body.dryRun, true)
      : safeBool(url.searchParams.get("dryRun"), true);

  const category =
    body?.category !== undefined
      ? safeStr(body.category)
      : safeStr(url.searchParams.get("category"));

  const limit =
    body?.limit !== undefined
      ? clamp(Math.trunc(safeNum(body.limit, 100)), 1, 500)
      : clamp(Math.trunc(safeNum(url.searchParams.get("limit"), 100)), 1, 500);

  await dbConnect();

  const filter = productFilter(category);

  const products: ProductDoc[] = await Product.find(filter)
    .select("_id title slug sku category metaDescription")
    .sort({ updatedAt: -1, _id: -1 })
    .limit(limit)
    .lean();

  const candidates = products.filter(
    (product) => compactText(product.metaDescription).length > LONG_META_DESCRIPTION_THRESHOLD
  );

  const preview: any[] = [];
  let updated = 0;

  for (const product of candidates) {
    const before = compactText(product.metaDescription);
    const after = trimMetaDescription(before);

    preview.push({
      id: String(product._id),
      sku: safeStr(product.sku),
      slug: safeStr(product.slug),
      category: safeStr(product.category),
      title: safeStr(product.title),
      beforeLength: before.length,
      afterLength: after.length,
      before,
      after,
    });

    if (!dryRun && after && after !== before) {
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
    category: normalizeCategory(category) || "all",
    limit,
    scanned: products.length,
    trimCandidates: candidates.length,
    updated,
    threshold: LONG_META_DESCRIPTION_THRESHOLD,
    targetLength: MAX_META_DESCRIPTION_LENGTH,
    message: dryRun
      ? "Preview completed. Check before/after, then run dryRun=false."
      : "Long meta descriptions trimmed for this batch.",
    nextRecommendedUrl: `/api/admin/products/meta-description-trim?dryRun=false&limit=${limit}${
      category ? `&category=${encodeURIComponent(normalizeCategory(category))}` : ""
    }`,
    preview: preview.slice(0, 25),
  });
}

export async function GET(req: NextRequest) {
  return runTrim(req);
}

export async function POST(req: NextRequest) {
  let body: any = {};

  try {
    body = await req.json();
  } catch {
    body = {};
  }

  return runTrim(req, body);
}