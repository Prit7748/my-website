import { getReadableProductMeta } from "@/lib/productDisplay";
import { productHref } from "@/lib/productHref";

export type YoutubeTokenProductLike = {
  _id?: any;
  id?: any;

  title?: string;
  slug?: string;
  sku?: string;
  category?: string;

  subjectCode?: string;
  subjectTitle?: string;
  subjectTitleHi?: string;
  subjectTitleEn?: string;
  subjectTitleOther?: string;

  courseCode?: string;
  courseCodes?: string[];
  courseTitle?: string;
  courseTitles?: string[];

  session?: string;
  session6?: string;

  language?: string;
  medium?: string;
  lang3?: string;
};

export type YoutubeTokenBuildOptions = {
  siteName?: string;
  siteBaseUrl?: string;
};

export type YoutubeTokenMap = Record<string, string>;

export const DEFAULT_YOUTUBE_SITE_NAME = "IGNOU Students Portal";
export const DEFAULT_YOUTUBE_SITE_BASE_URL = "https://www.istudentsportal.com";

export const YOUTUBE_TOKEN_LABELS: Array<{
  token: string;
  label: string;
  description: string;
}> = [
  {
    token: "%1",
    label: "Subject Code",
    description: "Example: BCOS 186",
  },
  {
    token: "%2",
    label: "Subject Title",
    description: "Example: Personal Selling and Salesmanship",
  },
  {
    token: "%3",
    label: "Course Codes",
    description: "Example: BCOMG, BAG",
  },
  {
    token: "%4",
    label: "Course Titles",
    description: "Example: Bachelor of Commerce - General",
  },
  {
    token: "%5",
    label: "Session",
    description: "Example: July 2025 / 2025-26",
  },
  {
    token: "%6",
    label: "Medium",
    description: "Example: Hindi / English",
  },
  {
    token: "%7",
    label: "Product Link",
    description: "Direct product page link on website",
  },
  {
    token: "%8",
    label: "Product Title",
    description: "Full saved product title",
  },
  {
    token: "%9",
    label: "Category",
    description: "Example: Solved Assignments / Question Papers (PYQ)",
  },
  {
    token: "%10",
    label: "Unique ID / SKU",
    description: "Product SKU / Unique ID",
  },
  {
    token: "%11",
    label: "Website Name",
    description: "Example: IGNOU Students Portal",
  },
  {
    token: "%12",
    label: "Website Home Link",
    description: "Website home URL",
  },
];

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function normalizeSpaces(input: any) {
  return safeStr(input).replace(/\s+/g, " ").trim();
}

function normalizeSiteBaseUrl(input?: string) {
  const raw =
    safeStr(input) ||
    safeStr(process.env.NEXT_PUBLIC_SITE_URL) ||
    DEFAULT_YOUTUBE_SITE_BASE_URL;

  return raw.replace(/\/+$/, "") || DEFAULT_YOUTUBE_SITE_BASE_URL;
}

function uniqueStrings(values: any[]) {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    const clean = normalizeSpaces(value);
    if (!clean) continue;

    const key = clean.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(clean);
  }

  return out;
}

function joinList(values: any[], uppercase = false) {
  const list = uniqueStrings(values).map((item) =>
    uppercase ? item.toUpperCase() : item
  );

  return list.join(", ");
}

function normalizeMediumForTitle(input: any) {
  const raw = normalizeSpaces(input);
  const upper = raw.toUpperCase();

  if (upper === "HIN" || upper === "HINDI" || upper === "HINDI MEDIUM") {
    return "Hindi";
  }

  if (upper === "ENG" || upper === "ENGLISH" || upper === "ENGLISH MEDIUM") {
    return "English";
  }

  if (upper === "URD" || upper === "URDU" || upper === "URDU MEDIUM") {
    return "Urdu";
  }

  if (upper === "SAN" || upper === "SANSKRIT" || upper === "SANSKRIT MEDIUM") {
    return "Sanskrit";
  }

  return raw;
}

export function getYoutubeProductSubjectTitle(product: YoutubeTokenProductLike) {
  const medium = normalizeMediumForTitle(
    product?.language || product?.medium || product?.lang3
  ).toLowerCase();

  const hi = normalizeSpaces(product?.subjectTitleHi);
  const en = normalizeSpaces(product?.subjectTitleEn);
  const other = normalizeSpaces(product?.subjectTitleOther);
  const direct = normalizeSpaces(product?.subjectTitle);

  if ((medium === "hindi" || medium.startsWith("hin")) && hi) return hi;
  if ((medium === "english" || medium.startsWith("eng")) && en) return en;

  return en || hi || other || direct || "";
}

export function getYoutubeProductCourseCodes(product: YoutubeTokenProductLike) {
  const courseCodes = Array.isArray(product?.courseCodes)
    ? product.courseCodes
    : [];

  return joinList(
    [...courseCodes, normalizeSpaces(product?.courseCode)].filter(Boolean),
    true
  );
}

export function getYoutubeProductCourseTitles(product: YoutubeTokenProductLike) {
  const courseTitles = Array.isArray(product?.courseTitles)
    ? product.courseTitles
    : [];

  return joinList(
    [...courseTitles, normalizeSpaces(product?.courseTitle)].filter(Boolean),
    false
  );
}

export function getYoutubeProductAbsoluteUrl(
  product: YoutubeTokenProductLike,
  siteBaseUrl?: string
) {
  const baseUrl = normalizeSiteBaseUrl(siteBaseUrl);
  const href = productHref({
    slug: safeStr(product?.slug),
    category: safeStr(product?.category),
  });

  if (!href || href === "/products") return baseUrl;

  return `${baseUrl}${href.startsWith("/") ? href : `/${href}`}`;
}

export function buildYoutubeTokenMap(
  product: YoutubeTokenProductLike,
  options: YoutubeTokenBuildOptions = {}
): YoutubeTokenMap {
  const readable = getReadableProductMeta({
    subjectCode: product?.subjectCode,
    session: product?.session,
    session6: product?.session6,
    language: product?.language || product?.medium,
    medium: product?.medium,
    lang3: product?.lang3,
    sku: product?.sku,
  });

  const siteName =
    normalizeSpaces(options.siteName) || DEFAULT_YOUTUBE_SITE_NAME;
  const siteBaseUrl = normalizeSiteBaseUrl(options.siteBaseUrl);

  const subjectCode =
    normalizeSpaces(readable.subjectCode) ||
    normalizeSpaces(product?.subjectCode) ||
    "IGNOU";

  const subjectTitle =
    getYoutubeProductSubjectTitle(product) ||
    normalizeSpaces(product?.title) ||
    subjectCode;

  const courseCodes = getYoutubeProductCourseCodes(product) || "IGNOU";
  const courseTitles = getYoutubeProductCourseTitles(product) || courseCodes;

  const session =
    normalizeSpaces(readable.session) ||
    normalizeSpaces(product?.session) ||
    normalizeSpaces(product?.session6) ||
    "";

  const medium =
    normalizeMediumForTitle(readable.medium) ||
    normalizeMediumForTitle(product?.language || product?.medium || product?.lang3) ||
    "";

  const productLink = getYoutubeProductAbsoluteUrl(product, siteBaseUrl);

  const productTitle =
    normalizeSpaces(product?.title) ||
    `${subjectCode} ${normalizeSpaces(product?.category)}`.trim();

  const category = normalizeSpaces(product?.category);
  const sku = normalizeSpaces(product?.sku).toUpperCase();

  return {
    "%1": subjectCode,
    "%2": subjectTitle,
    "%3": courseCodes,
    "%4": courseTitles,
    "%5": session,
    "%6": medium,
    "%7": productLink,
    "%8": productTitle,
    "%9": category,
    "%10": sku,
    "%11": siteName,
    "%12": siteBaseUrl,
  };
}

export function replaceYoutubeTokens(template: any, tokenMap: YoutubeTokenMap) {
  let output = String(template ?? "");

  const tokenEntries = Object.entries(tokenMap).sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [token, value] of tokenEntries) {
    output = output.split(token).join(value || "");
  }

  return output;
}

export function normalizeYoutubeTextOutput(input: any) {
  return String(input ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export function buildYoutubeGeneratedText(params: {
  titleTemplate: string;
  descriptionTemplate: string;
  pinnedCommentTemplate: string;
  tokenMap: YoutubeTokenMap;
}) {
  const tokenMap = params.tokenMap || {};

  return {
    title: normalizeYoutubeTextOutput(
      replaceYoutubeTokens(params.titleTemplate, tokenMap)
    ),
    description: normalizeYoutubeTextOutput(
      replaceYoutubeTokens(params.descriptionTemplate, tokenMap)
    ),
    pinnedComment: normalizeYoutubeTextOutput(
      replaceYoutubeTokens(params.pinnedCommentTemplate, tokenMap)
    ),
  };
}

export function buildYoutubeSafeFileName(input: any, fallback = "youtube-content") {
  const raw = normalizeSpaces(input)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-_]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return raw.slice(0, 120) || fallback;
}