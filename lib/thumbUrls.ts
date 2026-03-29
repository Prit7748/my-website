import { buildThumbVersionToken } from "@/lib/thumbVersion";

export const SOLVED_ASSIGNMENTS_CATEGORY = "Solved Assignments";
export const HANDWRITTEN_HARDCOPY_CATEGORY = "Handwritten Hardcopy (Delivery)";

export type ThumbProductLike = {
  _id?: string;
  id?: string;
  slug?: string;
  title?: string;
  category?: string;

  subjectCode?: string;
  subjectTitle?: string;
  subjectTitleHi?: string;
  subjectTitleEn?: string;

  courseCode?: string;
  courseCodes?: string[];

  session?: string;
  updatedAt?: string;

  language?: string;
  medium?: string;

  images?: string[];
};

function safeText(x: any) {
  return String(x ?? "").trim();
}

function normalizeSession(x: any) {
  const s = safeText(x);
  if (!s) return "";
  return s.replace(/\s+/g, " ").trim();
}

export function isSolvedAssignmentProduct(product: ThumbProductLike) {
  return safeText(product?.category).toLowerCase() === SOLVED_ASSIGNMENTS_CATEGORY.toLowerCase();
}

export function isHandwrittenHardcopyProduct(product: ThumbProductLike) {
  return safeText(product?.category).toLowerCase() === HANDWRITTEN_HARDCOPY_CATEGORY.toLowerCase();
}

export function extractSubjectTitle(product: ThumbProductLike) {
  const lang = safeText(product?.language).toLowerCase();
  const hi = safeText(product?.subjectTitleHi);
  const en = safeText(product?.subjectTitleEn);

  if ((lang === "hindi" || lang.startsWith("hin")) && hi) return hi;
  if ((lang === "english" || lang.startsWith("eng")) && en) return en;

  return hi || en || safeText(product?.subjectTitle) || "";
}

export function extractSubjectCode(product: ThumbProductLike) {
  const direct = safeText(product?.subjectCode);
  if (direct) return direct;

  const t = safeText(product?.title);
  const m = t.match(/\b([A-Z]{2,6})\s*[-]?\s*(\d{2,4})\b/);
  if (m) return `${m[1]} ${m[2]}`.trim();

  return "";
}

export function extractCourseCodesText(product: ThumbProductLike) {
  const list = Array.isArray(product?.courseCodes)
    ? product.courseCodes.map((x) => safeText(x)).filter(Boolean)
    : [];

  if (list.length) return Array.from(new Set(list)).join(", ");

  return safeText(product?.courseCode) || "";
}

export function extractMedium(product: ThumbProductLike) {
  return safeText(product?.language) || safeText(product?.medium) || "";
}

export function fileNameOf(path: string) {
  const clean = safeText(path).split("?")[0];
  const parts = clean.split("/");
  return safeText(parts[parts.length - 1]).toLowerCase();
}

export function sortImageUrlsNamewise(images?: string[]) {
  const arr = Array.isArray(images) ? [...images] : [];
  return arr
    .map((x) => safeText(x))
    .filter(Boolean)
    .sort((a, b) =>
      fileNameOf(a).localeCompare(fileNameOf(b), undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
}

export function pickSortedImagePair(images?: string[]) {
  const sorted = sortImageUrlsNamewise(images);
  return {
    first: sorted[0] || "",
    second: sorted[1] || sorted[0] || "",
    all: sorted,
  };
}

function buildAssignmentThumbVersion(product: ThumbProductLike) {
  return buildThumbVersionToken("assignment", [
    product?._id,
    product?.id,
    product?.slug,
    product?.updatedAt,
    product?.category,
    extractSubjectCode(product),
    extractSubjectTitle(product),
    extractCourseCodesText(product),
    normalizeSession(product?.session),
    extractMedium(product),
  ]);
}

function buildHardcopyThumbVersion(product: ThumbProductLike) {
  return buildThumbVersionToken("hardcopy", [
    product?._id,
    product?.id,
    product?.slug,
    product?.updatedAt,
    product?.category,
    extractSubjectCode(product),
    normalizeSession(product?.session),
    extractMedium(product),
  ]);
}

export function buildAssignmentMasterThumbUrl(product: ThumbProductLike) {
  const session = normalizeSession(product?.session) || "2025-2026";
  const code = extractSubjectCode(product) || "IGNOU";
  const title = extractSubjectTitle(product) || "Solved Assignment";
  const course = extractCourseCodesText(product) || "IGNOU";
  const medium = extractMedium(product) || "English";
  const v = buildAssignmentThumbVersion(product);

  const qs = new URLSearchParams({
    session,
    code,
    title,
    course,
    medium,
    v,
  });

  return `/api/thumb/assignment?${qs.toString()}`;
}

export function buildHardcopyMasterThumbUrl(product: ThumbProductLike) {
  const session = normalizeSession(product?.session) || "2025-26";
  const code = extractSubjectCode(product) || "IGNOU";
  const medium = extractMedium(product) || "English";
  const v = buildHardcopyThumbVersion(product);

  const qs = new URLSearchParams({
    session,
    code,
    medium,
    v,
  });

  return `/api/thumb/hardcopy?${qs.toString()}`;
}

export function buildPyqComboThumbUrl(input: {
  years?: number | string;
  code?: string;
  medium?: string;
  slug?: string;
  updatedAt?: string;
  id?: string;
}) {
  const years = String(input?.years) === "5" ? "5" : "3";
  const code = safeText(input?.code) || "BCOS186";
  const medium = safeText(input?.medium) || "ENG";

  const v = buildThumbVersionToken("pyqCombo", [
    input?.id,
    input?.slug,
    input?.updatedAt,
    years,
    code,
    medium,
  ]);

  const params = new URLSearchParams({
    years,
    code,
    medium,
    v,
  });

  return `/api/thumb/pyq-combo?${params.toString()}`;
}
