import dbConnect from "@/lib/db";
import { normalizeProductCategory } from "@/lib/productCatalog";
import {
  buildYoutubeGeneratedText,
  buildYoutubeSafeFileName,
  buildYoutubeTokenMap,
  getYoutubeProductAbsoluteUrl,
  getYoutubeProductCourseCodes,
  getYoutubeProductCourseTitles,
  getYoutubeProductSubjectTitle,
  replaceYoutubeTokens,
  type YoutubeTokenProductLike,
} from "@/lib/youtubeTokens";
import YoutubeTemplateConfig, {
  DEFAULT_YOUTUBE_ASSIGNMENT_TEXT_TEMPLATES,
  DEFAULT_YOUTUBE_ASSIGNMENT_THUMBNAIL,
  DEFAULT_YOUTUBE_PYQ_TEXT_TEMPLATES,
  DEFAULT_YOUTUBE_PYQ_THUMBNAIL,
  DEFAULT_YOUTUBE_TEMPLATE_CONFIG,
  YOUTUBE_TEMPLATE_CONFIG_KEY,
  type YoutubeTextTemplateBlock,
  type YoutubeThumbnailTemplateBlock,
} from "@/models/YoutubeTemplateConfig";

export type YoutubeContentKind = "assignment" | "pyq";

export const YOUTUBE_ASSIGNMENT_CATEGORY = "Solved Assignments";
export const YOUTUBE_PYQ_CATEGORY = "Question Papers (PYQ)";

export type YoutubePreparedProduct = YoutubeTokenProductLike & {
  _id?: any;
  createdAt?: any;
  updatedAt?: any;
  lastModifiedAt?: any;
  isActive?: boolean;
  deletedAt?: any;
};

export type YoutubeGeneratedPayload = {
  kind: YoutubeContentKind;
  product: {
    id: string;
    title: string;
    sku: string;
    slug: string;
    category: string;
    subjectCode: string;
    subjectTitle: string;
    courseCodes: string;
    courseTitles: string;
    session: string;
    medium: string;
    productLink: string;
  };
  templates: {
    titleTemplate: string;
    descriptionTemplate: string;
    pinnedCommentTemplate: string;
  };
  generated: {
    title: string;
    description: string;
    pinnedComment: string;
  };
  thumbnail: {
    previewUrl: string;
    svgUrl: string;
    downloadFileName: string;
    width: number;
    height: number;
  };
  tokens: Record<string, string>;
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeBool(x: any, def = false) {
  if (typeof x === "boolean") return x;

  if (typeof x === "string") {
    const v = x.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(v)) return true;
    if (["false", "0", "no", "off"].includes(v)) return false;
  }

  if (typeof x === "number") {
    if (x === 1) return true;
    if (x === 0) return false;
  }

  return def;
}

function safeNum(x: any, def: number) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function normalizeSpaces(input: any) {
  return safeStr(input).replace(/\s+/g, " ").trim();
}

function asPlainObject<T = any>(doc: any): T {
  if (!doc) return {} as T;
  if (typeof doc.toObject === "function") return doc.toObject() as T;
  return doc as T;
}

function getObjectIdString(input: any) {
  if (!input) return "";
  if (typeof input === "string") return input;
  if (typeof input.toString === "function") return input.toString();
  return "";
}

function normalizeTextBlock(
  block: any,
  defaults: YoutubeTextTemplateBlock
): YoutubeTextTemplateBlock {
  return {
    isEnabled: safeBool(block?.isEnabled, defaults.isEnabled),
    titleTemplate:
      safeStr(block?.titleTemplate) || defaults.titleTemplate,
    descriptionTemplate:
      safeStr(block?.descriptionTemplate) || defaults.descriptionTemplate,
    pinnedCommentTemplate:
      safeStr(block?.pinnedCommentTemplate) || defaults.pinnedCommentTemplate,
  };
}

function normalizeThumbnailField(field: any, fallback: any) {
  return {
    key: safeStr(field?.key || fallback?.key) || "field",
    label: safeStr(field?.label || fallback?.label) || "Field",
    enabled: safeBool(field?.enabled, safeBool(fallback?.enabled, true)),
    token: safeStr(field?.token || fallback?.token),
    fallbackText: safeStr(field?.fallbackText || fallback?.fallbackText),
    x: safeNum(field?.x, safeNum(fallback?.x, 640)),
    y: safeNum(field?.y, safeNum(fallback?.y, 360)),
    width: safeNum(field?.width, safeNum(fallback?.width, 900)),
    maxLines: Math.max(1, Math.min(5, Math.trunc(safeNum(field?.maxLines, safeNum(fallback?.maxLines, 1))))),
    fontSize: Math.max(10, Math.min(180, Math.trunc(safeNum(field?.fontSize, safeNum(fallback?.fontSize, 54))))),
    minFontSize: Math.max(8, Math.min(120, Math.trunc(safeNum(field?.minFontSize, safeNum(fallback?.minFontSize, 24))))),
    lineHeight: Math.max(0.8, Math.min(2, safeNum(field?.lineHeight, safeNum(fallback?.lineHeight, 1.18)))),
    letterSpacing: Math.max(-5, Math.min(20, safeNum(field?.letterSpacing, safeNum(fallback?.letterSpacing, 0)))),
    fontFamily:
      safeStr(field?.fontFamily || fallback?.fontFamily) ||
      "Arial, Helvetica, sans-serif",
    fontWeight: Math.max(100, Math.min(900, Math.trunc(safeNum(field?.fontWeight, safeNum(fallback?.fontWeight, 900))))),
    color: safeStr(field?.color || fallback?.color) || "#111111",
    align: ["left", "center", "right"].includes(safeStr(field?.align))
      ? safeStr(field?.align)
      : safeStr(fallback?.align) || "center",
    uppercase: safeBool(field?.uppercase, safeBool(fallback?.uppercase, false)),
  };
}

function normalizeThumbnailBlock(
  block: any,
  defaults: YoutubeThumbnailTemplateBlock
): YoutubeThumbnailTemplateBlock {
  const inputFields = Array.isArray(block?.fields) ? block.fields : [];
  const defaultFields = Array.isArray(defaults.fields) ? defaults.fields : [];

  const fallbackMap = new Map(defaultFields.map((field: any) => [safeStr(field.key), field]));

  const fields =
    inputFields.length > 0
      ? inputFields.map((field: any) =>
          normalizeThumbnailField(field, fallbackMap.get(safeStr(field?.key)) || defaultFields[0])
        )
      : defaultFields.map((field: any) => normalizeThumbnailField(field, field));

  return {
    isEnabled: safeBool(block?.isEnabled, defaults.isEnabled),
    templateImageUrl: safeStr(block?.templateImageUrl || defaults.templateImageUrl),
    width: 1280,
    height: 720,
    outputFilePrefix:
      safeStr(block?.outputFilePrefix || defaults.outputFilePrefix) ||
      "ignou-youtube-thumbnail",
    fields,
  };
}

export function getYoutubeContentKindFromCategory(
  categoryInput: any
): YoutubeContentKind | "" {
  const category = normalizeProductCategory(categoryInput);

  if (category === YOUTUBE_ASSIGNMENT_CATEGORY) return "assignment";
  if (category === YOUTUBE_PYQ_CATEGORY) return "pyq";

  const loose = safeStr(categoryInput).toLowerCase();

  if (loose.includes("assignment")) return "assignment";
  if (loose.includes("pyq") || loose.includes("question paper")) return "pyq";

  return "";
}

export function isYoutubeSupportedProduct(product: YoutubePreparedProduct) {
  return Boolean(getYoutubeContentKindFromCategory(product?.category));
}

export function getYoutubeKindLabel(kind: YoutubeContentKind) {
  if (kind === "assignment") return "Solved Assignment";
  if (kind === "pyq") return "Solved PYQ";
  return "YouTube";
}

export function getDefaultYoutubeTextTemplates(kind: YoutubeContentKind) {
  return kind === "pyq"
    ? DEFAULT_YOUTUBE_PYQ_TEXT_TEMPLATES
    : DEFAULT_YOUTUBE_ASSIGNMENT_TEXT_TEMPLATES;
}

export function getDefaultYoutubeThumbnailTemplate(kind: YoutubeContentKind) {
  return kind === "pyq"
    ? DEFAULT_YOUTUBE_PYQ_THUMBNAIL
    : DEFAULT_YOUTUBE_ASSIGNMENT_THUMBNAIL;
}

export function normalizeYoutubeTemplateConfig(raw: any) {
  return {
    key: YOUTUBE_TEMPLATE_CONFIG_KEY,
    assignment: normalizeTextBlock(
      raw?.assignment,
      DEFAULT_YOUTUBE_ASSIGNMENT_TEXT_TEMPLATES
    ),
    pyq: normalizeTextBlock(raw?.pyq, DEFAULT_YOUTUBE_PYQ_TEXT_TEMPLATES),
    assignmentThumbnail: normalizeThumbnailBlock(
      raw?.assignmentThumbnail,
      DEFAULT_YOUTUBE_ASSIGNMENT_THUMBNAIL
    ),
    pyqThumbnail: normalizeThumbnailBlock(
      raw?.pyqThumbnail,
      DEFAULT_YOUTUBE_PYQ_THUMBNAIL
    ),
    updatedBy: safeStr(raw?.updatedBy),
    createdAt: raw?.createdAt || null,
    updatedAt: raw?.updatedAt || null,
  };
}

export async function getYoutubeTemplateConfig() {
  await dbConnect();

  const doc: any = await YoutubeTemplateConfig.findOne({
    key: YOUTUBE_TEMPLATE_CONFIG_KEY,
  }).lean();

  if (!doc) {
    return normalizeYoutubeTemplateConfig({
      key: YOUTUBE_TEMPLATE_CONFIG_KEY,
      ...DEFAULT_YOUTUBE_TEMPLATE_CONFIG,
      updatedBy: "",
      createdAt: null,
      updatedAt: null,
    });
  }

  return normalizeYoutubeTemplateConfig(doc);
}

export async function saveYoutubeTemplateConfig(input: any, updatedBy = "") {
  await dbConnect();

  const normalized = normalizeYoutubeTemplateConfig({
    key: YOUTUBE_TEMPLATE_CONFIG_KEY,
    assignment: input?.assignment,
    pyq: input?.pyq,
    assignmentThumbnail: input?.assignmentThumbnail,
    pyqThumbnail: input?.pyqThumbnail,
    updatedBy,
  });

  const doc: any = await YoutubeTemplateConfig.findOneAndUpdate(
    { key: YOUTUBE_TEMPLATE_CONFIG_KEY },
    {
      $set: {
        key: YOUTUBE_TEMPLATE_CONFIG_KEY,
        assignment: normalized.assignment,
        pyq: normalized.pyq,
        assignmentThumbnail: normalized.assignmentThumbnail,
        pyqThumbnail: normalized.pyqThumbnail,
        updatedBy: safeStr(updatedBy),
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  ).lean();

  return normalizeYoutubeTemplateConfig(doc);
}

export function pickYoutubeTextTemplateBlock(config: any, kind: YoutubeContentKind) {
  const defaults = getDefaultYoutubeTextTemplates(kind);
  return normalizeTextBlock(kind === "pyq" ? config?.pyq : config?.assignment, defaults);
}

export function pickYoutubeThumbnailTemplateBlock(
  config: any,
  kind: YoutubeContentKind
) {
  const defaults = getDefaultYoutubeThumbnailTemplate(kind);
  return normalizeThumbnailBlock(
    kind === "pyq" ? config?.pyqThumbnail : config?.assignmentThumbnail,
    defaults
  );
}

export function buildYoutubeThumbnailRoute(params: {
  kind: YoutubeContentKind;
  product: YoutubePreparedProduct;
  tokenMap?: Record<string, string>;
}) {
  const kind = params.kind;
  const product = params.product;
  const tokenMap = params.tokenMap || buildYoutubeTokenMap(product);

  const apiPath =
    kind === "pyq" ? "/api/thumb/youtube-pyq" : "/api/thumb/youtube-assignment";

  const updated =
    safeStr(product?.updatedAt) ||
    safeStr(product?.lastModifiedAt) ||
    safeStr(product?._id) ||
    safeStr(product?.sku);

  const qs = new URLSearchParams({
    code: tokenMap["%1"] || "",
    title: tokenMap["%2"] || "",
    course: tokenMap["%3"] || "",
    courseTitles: tokenMap["%4"] || "",
    session: tokenMap["%5"] || "",
    medium: tokenMap["%6"] || "",
    productTitle: tokenMap["%8"] || "",
    category: tokenMap["%9"] || "",
    sku: tokenMap["%10"] || "",
    v: buildYoutubeSafeFileName(`${tokenMap["%10"] || tokenMap["%1"] || "thumb"}-${updated}`),
  });

  return `${apiPath}?${qs.toString()}`;
}

export function buildYoutubeThumbnailDownloadFileName(params: {
  kind: YoutubeContentKind;
  product: YoutubePreparedProduct;
  tokenMap?: Record<string, string>;
  prefix?: string;
}) {
  const tokenMap = params.tokenMap || buildYoutubeTokenMap(params.product);
  const prefix =
    safeStr(params.prefix) ||
    (params.kind === "pyq"
      ? "ignou-pyq-youtube-thumbnail"
      : "ignou-assignment-youtube-thumbnail");

  const code = tokenMap["%1"] || safeStr(params.product?.subjectCode) || "ignou";
  const medium = tokenMap["%6"] || safeStr(params.product?.language) || "";
  const session = tokenMap["%5"] || safeStr(params.product?.session) || "";

  return `${buildYoutubeSafeFileName(
    `${prefix}-${code}-${medium}-${session}`,
    prefix
  )}.png`;
}

export function buildYoutubePreparedProductSummary(params: {
  product: YoutubePreparedProduct;
  kind: YoutubeContentKind;
  tokenMap: Record<string, string>;
}) {
  const { product, tokenMap } = params;

  return {
    id: getObjectIdString(product?._id || product?.id),
    title: tokenMap["%8"] || safeStr(product?.title),
    sku: tokenMap["%10"] || safeStr(product?.sku),
    slug: safeStr(product?.slug),
    category: tokenMap["%9"] || safeStr(product?.category),
    subjectCode: tokenMap["%1"] || safeStr(product?.subjectCode),
    subjectTitle: tokenMap["%2"] || getYoutubeProductSubjectTitle(product),
    courseCodes: tokenMap["%3"] || getYoutubeProductCourseCodes(product),
    courseTitles: tokenMap["%4"] || getYoutubeProductCourseTitles(product),
    session: tokenMap["%5"] || safeStr(product?.session),
    medium: tokenMap["%6"] || safeStr(product?.language || product?.medium),
    productLink: tokenMap["%7"] || getYoutubeProductAbsoluteUrl(product),
  };
}

export async function buildYoutubeGeneratedPayload(params: {
  product: YoutubePreparedProduct;
  siteName?: string;
  siteBaseUrl?: string;
  config?: any;
}): Promise<YoutubeGeneratedPayload> {
  const product = asPlainObject<YoutubePreparedProduct>(params.product);

  const kind = getYoutubeContentKindFromCategory(product?.category);

  if (!kind) {
    throw new Error(
      "Only Solved Assignments and Question Papers (PYQ) products are supported for YouTube content."
    );
  }

  const config = params.config || (await getYoutubeTemplateConfig());

  const textBlock = pickYoutubeTextTemplateBlock(config, kind);
  const thumbBlock = pickYoutubeThumbnailTemplateBlock(config, kind);

  const tokenMap = buildYoutubeTokenMap(product, {
    siteName: params.siteName,
    siteBaseUrl: params.siteBaseUrl,
  });

  const generated = buildYoutubeGeneratedText({
    titleTemplate: textBlock.titleTemplate,
    descriptionTemplate: textBlock.descriptionTemplate,
    pinnedCommentTemplate: textBlock.pinnedCommentTemplate,
    tokenMap,
  });

  const thumbnailUrl = buildYoutubeThumbnailRoute({
    kind,
    product,
    tokenMap,
  });

  const downloadFileName = buildYoutubeThumbnailDownloadFileName({
    kind,
    product,
    tokenMap,
    prefix: thumbBlock.outputFilePrefix,
  });

  return {
    kind,
    product: buildYoutubePreparedProductSummary({
      product,
      kind,
      tokenMap,
    }),
    templates: {
      titleTemplate: textBlock.titleTemplate,
      descriptionTemplate: textBlock.descriptionTemplate,
      pinnedCommentTemplate: textBlock.pinnedCommentTemplate,
    },
    generated,
    thumbnail: {
      previewUrl: thumbnailUrl,
      svgUrl: thumbnailUrl,
      downloadFileName,
      width: 1280,
      height: 720,
    },
    tokens: tokenMap,
  };
}

export function buildYoutubeFieldPreviewText(params: {
  token?: string;
  fallbackText?: string;
  tokenMap?: Record<string, string>;
}) {
  const token = safeStr(params.token);
  const fallback = safeStr(params.fallbackText);
  const tokenMap = params.tokenMap || {};

  if (token && tokenMap[token]) return tokenMap[token];
  if (token) {
    const replaced = replaceYoutubeTokens(token, tokenMap);
    if (replaced && replaced !== token) return replaced;
  }

  return fallback;
}

export function sanitizeYoutubeTemplatePayload(input: any) {
  return normalizeYoutubeTemplateConfig({
    key: YOUTUBE_TEMPLATE_CONFIG_KEY,
    assignment: input?.assignment,
    pyq: input?.pyq,
    assignmentThumbnail: input?.assignmentThumbnail,
    pyqThumbnail: input?.pyqThumbnail,
    updatedBy: input?.updatedBy,
  });
}