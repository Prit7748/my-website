import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import { getAuthUser, hasPermission } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 1000;

const CATEGORY_VALUES = [
  "Solved Assignments",
  "solved-assignments",

  "Question Papers (PYQ)",
  "Question Papers",
  "question-papers",

  "Handwritten PDFs",
  "handwritten-pdfs",

  "Handwritten Hardcopy (Delivery)",
  "Handwritten Hardcopy",
  "handwritten-hardcopy",

  "Ebooks",
  "eBooks",
  "eBooks/Notes",
  "Ebooks/Notes",
  "ebooks",

  "projects",
  "Projects",
  "Projects & Synopsis",

  "Guess Papers",
  "guess-papers",
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

  shortDesc?: string;
  descriptionHtml?: string;
  importantNote?: string;
  metaTitle?: string;
  metaDescription?: string;

  pages?: number;
  price?: number;
  updatedAt?: Date;
  createdAt?: Date;
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

function escapeHtml(value: unknown) {
  return safeStr(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function truncateText(value: unknown, maxLength: number) {
  const text = compactText(value);

  if (!text) return "";
  if (text.length <= maxLength) return text;

  const sliced = text.slice(0, maxLength).trim();
  const lastSpace = sliced.lastIndexOf(" ");

  if (lastSpace > Math.floor(maxLength * 0.65)) {
    return sliced.slice(0, lastSpace).trim();
  }

  return sliced;
}

function normalizeCategory(value: unknown) {
  const raw = safeStr(value);
  const loose = raw.toLowerCase().replace(/\s+/g, " ").trim();

  const map: Record<string, string> = {
    "solved assignments": "Solved Assignments",
    "solved assignment": "Solved Assignments",
    "solved-assignments": "Solved Assignments",

    "question papers (pyq)": "Question Papers (PYQ)",
    "question papers": "Question Papers (PYQ)",
    "question paper": "Question Papers (PYQ)",
    "question-papers": "Question Papers (PYQ)",
    pyq: "Question Papers (PYQ)",

    "handwritten pdfs": "Handwritten PDFs",
    "handwritten pdf": "Handwritten PDFs",
    "handwritten-pdfs": "Handwritten PDFs",

    "handwritten hardcopy (delivery)": "Handwritten Hardcopy (Delivery)",
    "handwritten hardcopy delivery": "Handwritten Hardcopy (Delivery)",
    "handwritten hardcopy": "Handwritten Hardcopy (Delivery)",
    "handwritten-hardcopy": "Handwritten Hardcopy (Delivery)",
    hardcopy: "Handwritten Hardcopy (Delivery)",

    ebooks: "Ebooks",
    ebook: "Ebooks",
    "ebooks/notes": "Ebooks",
    "ebooks-notes": "Ebooks",
    "ebooks notes": "Ebooks",
    notes: "Ebooks",

    projects: "projects",
    project: "projects",
    "projects & synopsis": "projects",
    "projects-synopsis": "projects",

    "guess papers": "Guess Papers",
    "guess paper": "Guess Papers",
    "guess-papers": "Guess Papers",
  };

  return map[loose] || raw;
}

function categoryPublicLabel(category: string) {
  const normalized = normalizeCategory(category);

  const map: Record<string, string> = {
    "Solved Assignments": "Solved Assignment",
    "Question Papers (PYQ)": "Solved Previous Year Question Paper",
    "Handwritten PDFs": "Handwritten PDF",
    "Handwritten Hardcopy (Delivery)": "Handwritten Hardcopy Assignment",
    Ebooks: "Ebook Notes",
    projects: "Project and Synopsis",
    "Guess Papers": "Guess Paper",
  };

  return map[normalized] || normalized || "Study Material";
}

function categoryActionText(category: string) {
  const normalized = normalizeCategory(category);

  const map: Record<string, string> = {
    "Solved Assignments": "Download",
    "Question Papers (PYQ)": "Download",
    "Handwritten PDFs": "Download",
    "Handwritten Hardcopy (Delivery)": "Order",
    Ebooks: "Download",
    projects: "Download",
    "Guess Papers": "Download",
  };

  return map[normalized] || "View";
}

function categoryUseText(category: string) {
  const normalized = normalizeCategory(category);

  const map: Record<string, string> = {
    "Solved Assignments":
      "assignment writing, answer structure, presentation style and concept revision",
    "Question Papers (PYQ)":
      "exam pattern understanding, PYQ practice, question trend analysis and revision",
    "Handwritten PDFs":
      "handwritten-style study support, assignment preparation and quick revision",
    "Handwritten Hardcopy (Delivery)":
      "physical handwritten assignment support, neat presentation reference and delivery-based convenience",
    Ebooks:
      "digital study notes, topic-wise revision, concept clarity and exam preparation",
    projects:
      "project planning, synopsis structure, topic clarity and reference preparation",
    "Guess Papers":
      "focused exam preparation, important question practice and quick revision",
  };

  return map[normalized] || "study preparation, revision and academic support";
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

function joinedCourseCodes(product: ProductDoc) {
  return Array.isArray(product.courseCodes)
    ? product.courseCodes.map((item) => safeStr(item)).filter(Boolean).join(", ")
    : "";
}

function joinedCourseTitles(product: ProductDoc) {
  return Array.isArray(product.courseTitles)
    ? product.courseTitles.map((item) => safeStr(item)).filter(Boolean).join(", ")
    : "";
}

function buildMetaTitle(product: ProductDoc) {
  const category = normalizeCategory(product.category);
  const label = categoryPublicLabel(category);
  const subjectCode = safeStr(product.subjectCode);
  const session = safeStr(product.session);
  const language = safeStr(product.language);

  const title = [
    "IGNOU",
    subjectCode,
    label,
    session,
    language ? `(${language} Medium)` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return truncateText(title, 95);
}

function buildMetaDescription(product: ProductDoc) {
  const category = normalizeCategory(product.category);
  const action = categoryActionText(category);
  const label = categoryPublicLabel(category);
  const subjectCode = safeStr(product.subjectCode);
  const subjectTitle = chooseSubjectTitle(product);
  const courseCodes = joinedCourseCodes(product);
  const session = safeStr(product.session);
  const language = safeStr(product.language);

  return truncateText(
    [
      `${action} IGNOU ${subjectCode} ${label}`,
      subjectTitle ? `for ${subjectTitle}` : "",
      session ? `${session} session` : "",
      language ? `in ${language} medium` : "",
      courseCodes ? `Course: ${courseCodes}.` : "",
      "Student-friendly study support from IGNOU Students Portal.",
    ]
      .filter(Boolean)
      .join(" "),
    180
  );
}

function buildShortDesc(product: ProductDoc) {
  const category = normalizeCategory(product.category);
  const action = categoryActionText(category);
  const label = categoryPublicLabel(category);
  const subjectCode = safeStr(product.subjectCode);
  const subjectTitle = chooseSubjectTitle(product);
  const courseCodes = joinedCourseCodes(product);
  const session = safeStr(product.session);
  const language = safeStr(product.language);

  return truncateText(
    [
      `${action} IGNOU ${subjectCode} ${label}`,
      subjectTitle ? `for ${subjectTitle}` : "",
      session ? `(${session})` : "",
      language ? `in ${language} medium.` : ".",
      courseCodes ? `Course: ${courseCodes}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    280
  );
}

function buildLongDescriptionHtml(product: ProductDoc) {
  const category = normalizeCategory(product.category);
  const label = categoryPublicLabel(category);
  const useText = categoryUseText(category);

  const title = safeStr(product.title) || buildMetaTitle(product);
  const subjectCode = safeStr(product.subjectCode);
  const subjectTitle = chooseSubjectTitle(product);
  const courseCodes = joinedCourseCodes(product);
  const courseTitles = joinedCourseTitles(product);
  const session = safeStr(product.session);
  const language = safeStr(product.language);
  const pages = safeNum(product.pages, 0);

  const paragraph1 = [
    `${title} is prepared for IGNOU students who need reliable and well-organized academic support.`,
    subjectCode ? `This material is mapped with subject code ${subjectCode}.` : "",
    subjectTitle ? `The subject title is ${subjectTitle}.` : "",
    courseCodes ? `It is linked with course code(s) ${courseCodes}.` : "",
    courseTitles ? `Course title(s): ${courseTitles}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const paragraph2 = [
    `This ${label.toLowerCase()} is useful for ${useText}.`,
    session ? `It is suitable for the ${session} session.` : "",
    language ? `The material is available in ${language} medium.` : "",
    pages > 0 ? `The product contains approximately ${pages} pages.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const paragraph3 =
    "Students can use this material as a study reference to understand important points, answer flow, headings, presentation method and exam-oriented preparation. It is designed to save time and support better academic planning.";

  const paragraph4 =
    "Before purchasing, please check the product title, subject code, course code, session, medium, preview/thumbnail and all visible product details carefully. Buy only if the details match your IGNOU requirement.";

  const details = [
    ["Subject Code", subjectCode],
    ["Subject Title", subjectTitle],
    ["Course Code(s)", courseCodes],
    ["Course Title(s)", courseTitles],
    ["Session", session],
    ["Medium", language],
    ["Category", category],
    ["Pages", pages > 0 ? String(pages) : ""],
  ].filter(([, value]) => safeStr(value));

  const detailsHtml = details.length
    ? `<ul>${details
        .map(
          ([name, value]) =>
            `<li><strong>${escapeHtml(name)}:</strong> ${escapeHtml(value)}</li>`
        )
        .join("")}</ul>`
    : "";

  return [
    `<p>${escapeHtml(paragraph1)}</p>`,
    `<p>${escapeHtml(paragraph2)}</p>`,
    detailsHtml,
    `<p>${escapeHtml(paragraph3)}</p>`,
    `<p>${escapeHtml(paragraph4)}</p>`,
  ]
    .filter(Boolean)
    .join("\n");
}

function isWeakMetaTitle(value: unknown) {
  const text = compactText(value);
  if (!text) return true;
  if (text.length < 25) return true;
  if (/^ignou\s*$/i.test(text)) return true;
  if (/undefined|null|%[a-z]/i.test(text)) return true;
  return false;
}

function isWeakMetaDescription(value: unknown) {
  const text = compactText(value);
  if (!text) return true;
  if (text.length < 70) return true;
  if (/undefined|null|%[a-z]/i.test(text)) return true;
  return false;
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
  if (!text) return true;
  if (text.length < 650) return true;
  if (/undefined|null|%[a-z]/i.test(text)) return true;

  const genericSignals = [
    "prepared for session",
    "download it now",
    "buy it now",
    "no related products found",
    "no. of pages 0",
  ];

  const lower = text.toLowerCase();
  return genericSignals.some((signal) => lower.includes(signal));
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
        { ok: false, error: "Forbidden (products:write missing)" },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, user };
}

function validObjectId(value: string) {
  return value && Types.ObjectId.isValid(value);
}

function buildBaseFilter(category: string, afterId: string) {
  const filter: any = {
    isActive: true,
    category: { $in: CATEGORY_VALUES },
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  };

  const normalizedCategory = normalizeCategory(category);

  if (normalizedCategory && CATEGORY_VALUES.includes(normalizedCategory)) {
    filter.category = normalizedCategory;
  }

  if (afterId) {
    if (!validObjectId(afterId)) {
      throw new Error("Invalid afterId");
    }

    filter._id = { $gt: new Types.ObjectId(afterId) };
  }

  return filter;
}

function buildPatch(product: ProductDoc, force: boolean) {
  const patch: Record<string, any> = {};
  const reasons: string[] = [];

  if (force || isWeakMetaTitle(product.metaTitle)) {
    patch.metaTitle = buildMetaTitle(product);
    reasons.push("metaTitle");
  }

  if (force || isWeakMetaDescription(product.metaDescription)) {
    patch.metaDescription = buildMetaDescription(product);
    reasons.push("metaDescription");
  }

  if (force || isWeakShortDesc(product.shortDesc)) {
    patch.shortDesc = buildShortDesc(product);
    reasons.push("shortDesc");
  }

  if (force || isWeakLongDesc(product.descriptionHtml)) {
    patch.descriptionHtml = buildLongDescriptionHtml(product);
    reasons.push("descriptionHtml");
  }

  if (Object.keys(patch).length) {
    patch.lastModifiedAt = new Date();
  }

  return { patch, reasons };
}

function buildScanUrl(input: {
  dryRun: boolean;
  limit: number;
  category: string;
  afterId: string;
  force: boolean;
}) {
  const params = new URLSearchParams();

  params.set("dryRun", String(input.dryRun));
  params.set("limit", String(input.limit));

  if (input.afterId) {
    params.set("afterId", input.afterId);
  }

  if (input.category) {
    params.set("category", normalizeCategory(input.category));
  }

  if (input.force) {
    params.set("force", "true");
  }

  return `/api/admin/products/seo-backfill?${params.toString()}`;
}

async function runBackfill(req: NextRequest, methodBody?: any) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);

  const dryRun =
    methodBody?.dryRun !== undefined
      ? safeBool(methodBody.dryRun, true)
      : safeBool(url.searchParams.get("dryRun"), true);

  const force =
    methodBody?.force !== undefined
      ? safeBool(methodBody.force, false)
      : safeBool(url.searchParams.get("force"), false);

  const category =
    methodBody?.category !== undefined
      ? safeStr(methodBody.category)
      : safeStr(url.searchParams.get("category"));

  const afterId =
    methodBody?.afterId !== undefined
      ? safeStr(methodBody.afterId)
      : safeStr(url.searchParams.get("afterId"));

  const limitInput =
    methodBody?.limit !== undefined ? methodBody.limit : url.searchParams.get("limit");

  const limit = clamp(Math.trunc(safeNum(limitInput, DEFAULT_LIMIT)), 1, MAX_LIMIT);

  await dbConnect();

  let filter: any;

  try {
    filter = buildBaseFilter(category, afterId);
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message) || "Invalid cursor",
      },
      { status: 400 }
    );
  }

  const rows: ProductDoc[] = await Product.find(filter)
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
        "shortDesc",
        "descriptionHtml",
        "importantNote",
        "metaTitle",
        "metaDescription",
        "pages",
        "price",
        "updatedAt",
        "createdAt",
      ].join(" ")
    )
    .sort({ _id: 1 })
    .limit(limit + 1)
    .lean();

  const candidates = rows.slice(0, limit);
  const hasMore = rows.length > limit;

  const firstScannedId = candidates.length ? String(candidates[0]._id) : "";
  const lastScannedId = candidates.length
    ? String(candidates[candidates.length - 1]._id)
    : "";

  const nextScanUrl =
    candidates.length && hasMore
      ? buildScanUrl({
          dryRun,
          limit,
          category,
          afterId: lastScannedId,
          force,
        })
      : null;

  const preview: any[] = [];
  const bulkOps: any[] = [];

  let updateCandidates = 0;
  let updated = 0;
  let skippedStrong = 0;

  for (const product of candidates) {
    const { patch, reasons } = buildPatch(product, force);

    if (!Object.keys(patch).length) {
      skippedStrong += 1;
      continue;
    }

    updateCandidates += 1;

    preview.push({
      id: String(product._id),
      sku: safeStr(product.sku),
      slug: safeStr(product.slug),
      category: safeStr(product.category),
      title: safeStr(product.title),
      reasons,
      before: {
        metaTitle: safeStr(product.metaTitle),
        metaDescription: safeStr(product.metaDescription),
        shortDescLength: stripHtml(product.shortDesc).length,
        descriptionLength: stripHtml(product.descriptionHtml).length,
      },
      after: {
        metaTitle: safeStr(patch.metaTitle || product.metaTitle),
        metaDescription: safeStr(patch.metaDescription || product.metaDescription),
        shortDescLength: patch.shortDesc
          ? stripHtml(patch.shortDesc).length
          : stripHtml(product.shortDesc).length,
        descriptionLength: patch.descriptionHtml
          ? stripHtml(patch.descriptionHtml).length
          : stripHtml(product.descriptionHtml).length,
      },
    });

    if (!dryRun) {
      bulkOps.push({
        updateOne: {
          filter: { _id: product._id },
          update: {
            $set: patch,
          },
        },
      });
    }
  }

  if (!dryRun && bulkOps.length) {
    const result = await Product.bulkWrite(bulkOps, { ordered: false });
    updated =
      Number(result.modifiedCount || 0) +
      Number((result as any).upsertedCount || 0);
  }

  return NextResponse.json({
    ok: true,
    mode: dryRun ? "preview" : "execute",
    updateMethod: dryRun ? "preview-only" : "bulkWrite",
    cursorMode: true,
    dryRun,
    force,
    category: normalizeCategory(category) || "all",
    limit,
    maxLimit: MAX_LIMIT,
    inputAfterId: afterId || null,
    firstScannedId: firstScannedId || null,
    lastScannedId: lastScannedId || null,
    nextAfterId: hasMore ? lastScannedId : null,
    hasMore,
    nextScanUrl,
    scanned: candidates.length,
    updateCandidates,
    updated,
    skippedStrong,
    message: dryRun
      ? "SEO backfill preview completed for this cursor batch."
      : "SEO backfill executed for this cursor batch.",
    preview: preview.slice(0, 25),
  });
}

export async function GET(req: NextRequest) {
  return runBackfill(req);
}

export async function POST(req: NextRequest) {
  let body: any = {};

  try {
    body = await req.json();
  } catch {
    body = {};
  }

  return runBackfill(req, body);
}