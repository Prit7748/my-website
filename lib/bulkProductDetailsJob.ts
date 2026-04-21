import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import Subject from "@/models/Subject";
import Course from "@/models/Course";
import Session from "@/models/Session";
import ProductPricingRule from "@/models/ProductPricingRule";
import { syncGeneratedCombosForProductChange } from "@/lib/comboAutoSync";
import { resolveRequiredProductPricing } from "@/lib/productPricing";
import { syncProductAvailabilityBySku } from "@/lib/productAvailability";
import {
  CATEGORY_CONFIG,
  normalizeProductCategory,
  deriveIsDigitalFromCategory,
  categoryLabelToSessionSlugCandidates,
  PHYSICAL_CATEGORY,
} from "@/lib/productCatalog";

export type DuplicateStrategy = "replace" | "ignore";
export type BulkPipelineStage = "prevalidation" | "execution" | "completed";

export type PreparedBulkDetailsRow = {
  rowNumber: number;
  A: string; // unique_id / sku
  B: string; // subject_code
  C: string; // session
  D: string; // language
  E: string; // course_code
};

export type PrevalidatedBulkDetailsRow = {
  itemIndex: number;
  rowNumber: number;
  sku: string;
  subjectCodeRaw: string;
  subjectCodeLoose: string;
  session: string;
  session6: string;
  language: string;
  lang3: string;
  courseCodeList: string[];
  normalizedCourseTitles: string[];
  joinedCourseTitles: string;
  subjectTitleHi: string;
  subjectTitleEn: string;
  subjectTitleOther: string;
  matchedSubjectTitle: string;
  title: string;
  slugBase: string;
  normalizedSlugBase: string;
  importantNote: string;
  shortDesc: string;
  descriptionHtml: string;
  metaTitle: string;
  metaDescription: string;
  price: number;
  oldPrice: number;
  pricingSource: string;
  templateWarnings: string[];
  raw: {
    unique_id: string;
    subject_code: string;
    session: string;
    language: string;
    course_code: string;
    A: string;
    B: string;
    C: string;
    D: string;
    E: string;
  };
};

export type BulkDetailsJobConfig = {
  dryRun: boolean;
  category: string;
  titleTemplate: string;
  importantNoteTemplate: string;
  shortDescTemplate: string;
  longDescTemplate: string;
  slugTemplate: string;
  metaTitleTemplate: string;
  metaDescriptionTemplate: string;
  publishNow: boolean;
  duplicateStrategy: DuplicateStrategy;
};

export type BulkDetailsPipelineSummary = {
  totalRows: number;
  validRows: number;
  createdRows: number;
  updatedRows: number;
  skippedRows: number;
  failedRows: number;
  duplicateStrategy: DuplicateStrategy;
  dryRun: boolean;
  category: string;
  pipelineStage: BulkPipelineStage;
  prevalidation: {
    totalRows: number;
    processedRows: number;
    validRows: number;
    failedRows: number;
    skippedRows: number;
    duplicateUploadRows: number;
    readyRows: number;
    startedAt: Date | null;
    completedAt: Date | null;
    lastNote: string;
  };
  execution: {
    totalRows: number;
    processedRows: number;
    createdRows: number;
    updatedRows: number;
    skippedRows: number;
    failedRows: number;
    successRows: number;
    startedAt: Date | null;
    completedAt: Date | null;
    lastNote: string;
  };
  comboSync: {
    attempted: number;
    succeeded: number;
    failed: number;
    errors: string[];
    mode: string;
  };
  hardcopySync: {
    attempted: number;
    succeeded: number;
    failed: number;
    errors: string[];
    mode: string;
  };
};

export type BulkDetailsBatchProcessResult = {
  stage: BulkPipelineStage;
  processedDelta: number;
  successDelta: number;
  failedDelta: number;
  skippedDelta: number;
  validDelta: number;
  nextLastProcessedIndex: number;
  batchNumber: number;
  fromIndex: number;
  toIndex: number;
  attempted: number;
  failures: Array<{
    itemIndex: number;
    rowNumber: number;
    batchNumber: number;
    identifier?: string;
    sku?: string;
    status?: string;
    reason?: string;
    raw?: any;
  }>;
  summaryPatch: BulkDetailsPipelineSummary;
  inputPatch?: Record<string, any>;
  inputAppendPatch?: {
    prevalidationSeenSkus?: string[];
    prevalidatedRows?: PrevalidatedBulkDetailsRow[];
  };
  nextStage?: BulkPipelineStage;
  note: string;
};

type SyncQueueItem = {
  before?: any | null;
  after?: any | null;
};

type MasterDataCache = {
  loadedAt: number;
  subjects: any[];
  courses: any[];
  sessions: any[];
  subjectMap: Map<string, any>;
  courseMap: Map<string, any>;
  sessionAllowedByCategory: Map<string, Set<string>>;
};

type PricingCache = {
  loadedAt: number;
  category: string;
  courseRuleMap: Map<string, any>;
  productOverrideBySku: Map<string, any>;
  productOverrideByProductId: Map<string, any>;
};

const MANUAL_HARDCOPY_BULK_BLOCK_MESSAGE =
  "Handwritten Hardcopy (Delivery) category ka manual bulk upload disabled hai. Ye products ab Solved Assignments se automatically generate honge.";

const MASTER_CACHE_TTL_MS = 2 * 60 * 1000;
const PRICING_CACHE_TTL_MS = 30 * 1000;

let masterDataCache: MasterDataCache | null = null;
let pricingCache: PricingCache | null = null;

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

function normalizeSku(input: string) {
  return safeStr(input).toUpperCase().replace(/\s+/g, "");
}

function normalizeSubjectCodeLoose(input: string) {
  return safeStr(input)
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeCourseCodeLoose(input: string) {
  return safeStr(input)
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeLang3(input: string) {
  const s = safeStr(input).toUpperCase().replace(/[^A-Z]/g, "");
  if (!s) return "OTH";
  if (s.startsWith("HIN") || s === "HINDI") return "HIN";
  if (s.startsWith("ENG") || s === "ENGLISH") return "ENG";
  if (s.startsWith("SAN") || s === "SANSKRIT") return "SAN";
  if (s.startsWith("URD") || s === "URDU") return "URD";
  return (s.slice(0, 3) || "OTH").padEnd(3, "X");
}

function normalizeSession6(input: string) {
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

  const digits = s.replace(/\D/g, "");
  if (digits.length >= 6) return digits.slice(0, 6);
  return "";
}

function buildSessionVariants(input: string) {
  const raw = safeStr(input);
  const out = new Set<string>();

  if (!raw) return out;

  const add = (v: string) => {
    const s = safeStr(v);
    if (!s) return;
    out.add(s);
    out.add(s.toLowerCase());
  };

  add(raw);
  add(raw.replace(/\s+/g, ""));
  add(raw.replace(/\s+/g, " ").trim());

  const s6 = normalizeSession6(raw);
  if (s6) {
    add(s6);

    if (/^\d{6}$/.test(s6)) {
      const year1 = s6.slice(0, 4);
      const tail = s6.slice(4);
      const tailNum = Number(tail);

      add(`${year1}-${tail}`);

      if (tailNum >= 13 && tailNum <= 99) {
        const century = year1.slice(0, 2);
        const fullYear2 = `${century}${tail}`;
        add(`${year1}-${fullYear2}`);
      }
    }
  }

  return out;
}

function sessionMatches(allowedSet: Set<string>, value: string) {
  const variants = buildSessionVariants(value);
  for (const v of variants) {
    if (allowedSet.has(v)) return true;
  }
  return false;
}

function replaceTokens(template: string, row: Record<string, string>) {
  return safeStr(template)
    .replace(/%A/g, row.A || "")
    .replace(/%B/g, row.B || "")
    .replace(/%C/g, row.C || "")
    .replace(/%D/g, row.D || "")
    .replace(/%E/g, row.E || "")
    .replace(/%F/g, row.F || "")
    .replace(/%G/g, row.G || "")
    .replace(/%H/g, row.H || "");
}

export function parseCsv(text: string) {
  const cleaned = String(text ?? "").replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows
    .map((r) => r.map((c) => safeStr(c)))
    .filter((r) => r.some((c) => c !== ""));
}

function rowLooksLikeHeader(row: string[]) {
  const joined = row.map((x) => safeStr(x).toLowerCase()).join(",");
  return (
    joined.includes("unique_id") ||
    joined.includes("subject_code") ||
    joined.includes("session") ||
    joined.includes("language") ||
    joined.includes("course_code")
  );
}

export function prepareBulkDetailsRows(csvText: string) {
  let parsedRows = parseCsv(csvText);

  if (!parsedRows.length) {
    throw new Error("CSV empty hai");
  }

  const hasHeader = parsedRows.length > 0 && rowLooksLikeHeader(parsedRows[0]);
  if (hasHeader) {
    parsedRows = parsedRows.slice(1);
  }

  return parsedRows.map((raw, i) => {
    const cols = [...raw];
    while (cols.length < 5) cols.push("");

    return {
      rowNumber: hasHeader ? i + 2 : i + 1,
      A: safeStr(cols[0]),
      B: safeStr(cols[1]),
      C: safeStr(cols[2]),
      D: safeStr(cols[3]),
      E: safeStr(cols[4]),
    } as PreparedBulkDetailsRow;
  });
}

export function normalizeBulkDetailsConfig(input: any): BulkDetailsJobConfig {
  const category = normalizeProductCategory(input?.category);

  return {
    dryRun: safeBool(input?.dryRun, true),
    category,
    titleTemplate: safeStr(input?.titleTemplate),
    importantNoteTemplate: safeStr(input?.importantNoteTemplate),
    shortDescTemplate: safeStr(input?.shortDescTemplate),
    longDescTemplate: safeStr(input?.longDescTemplate),
    slugTemplate: safeStr(input?.slugTemplate),
    metaTitleTemplate: safeStr(input?.metaTitleTemplate),
    metaDescriptionTemplate: safeStr(input?.metaDescriptionTemplate),
    publishNow:
      input?.publishNow !== undefined
        ? safeBool(input?.publishNow, false)
        : category === "Question Papers (PYQ)",
    duplicateStrategy:
      input?.duplicateStrategy === "replace" ? "replace" : "ignore",
  };
}

export function validateBulkDetailsConfig(config: BulkDetailsJobConfig) {
  if (!config.category) throw new Error("Category required");
  if (config.category === PHYSICAL_CATEGORY) {
    throw new Error(MANUAL_HARDCOPY_BULK_BLOCK_MESSAGE);
  }
  if (!config.titleTemplate) throw new Error("Title Template required");

  const categoryConf = CATEGORY_CONFIG.find((x) => x.label === config.category);
  if (!categoryConf) {
    throw new Error("Invalid category selected");
  }
}

function splitCourseCodes(input: string) {
  return uniqueStrings(
    safeStr(input)
      .split(",")
      .map((x) => safeStr(x).toUpperCase())
      .filter(Boolean)
  );
}

function pickFirstNonEmpty(...vals: any[]) {
  for (const v of vals) {
    const s = safeStr(v);
    if (s) return s;
  }
  return "";
}

function getSubjectTitle(subject: any) {
  return {
    subjectTitleHi: pickFirstNonEmpty(
      subject?.titleHi,
      subject?.nameHi,
      subject?.labelHi
    ),
    subjectTitleEn: pickFirstNonEmpty(
      subject?.titleEn,
      subject?.nameEn,
      subject?.title,
      subject?.name,
      subject?.label
    ),
    subjectTitleOther: pickFirstNonEmpty(
      subject?.titleOther,
      subject?.otherLangTitle,
      subject?.otherLangNameValue
    ),
  };
}

function getCourseTitle(course: any) {
  return pickFirstNonEmpty(
    course?.title,
    course?.name,
    course?.titleEn,
    course?.nameEn,
    course?.label
  );
}

function normalizeLooseText(input: string) {
  return safeStr(input)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function detectLanguageBucket(input: string): "en" | "hi" | "other" | "" {
  const raw = safeStr(input).toLowerCase();
  const norm = normalizeLooseText(input);

  if (!raw && !norm) return "";
  if (
    raw === "en" ||
    raw.includes("english") ||
    norm === "en" ||
    norm.includes("english")
  ) {
    return "en";
  }
  if (
    raw === "hi" ||
    raw.includes("hindi") ||
    norm === "hi" ||
    norm.includes("hindi") ||
    norm.includes("हिंदी") ||
    norm.includes("हिन्दी")
  ) {
    return "hi";
  }
  return "other";
}

function getMatchedSubjectTitleForLanguage(subject: any, language: string) {
  const bucket = detectLanguageBucket(language);
  const { subjectTitleHi, subjectTitleEn, subjectTitleOther } =
    getSubjectTitle(subject);

  if (bucket === "en") return subjectTitleEn;
  if (bucket === "hi") return subjectTitleHi;

  if (bucket === "other") {
    const subjectOtherLanguageName = normalizeLooseText(
      subject?.otherLangName || ""
    );
    const rowLanguage = normalizeLooseText(language);

    if (
      subjectOtherLanguageName &&
      rowLanguage &&
      subjectOtherLanguageName === rowLanguage
    ) {
      return subjectTitleOther;
    }
    return "";
  }

  return "";
}

function buildTemplateWarnings(params: {
  allTemplates: string[];
  matchedSubjectTitle: string;
  joinedCourseTitles: string;
}) {
  const warnings: string[] = [];
  const usesSubjectTitle = params.allTemplates.some((t) => /%F/.test(safeStr(t)));
  const usesCourseTitle = params.allTemplates.some((t) => /%G/.test(safeStr(t)));

  if (usesSubjectTitle && !safeStr(params.matchedSubjectTitle)) {
    warnings.push(
      "Matched subject title is blank for this row language in master subjects"
    );
  }

  if (usesCourseTitle && !safeStr(params.joinedCourseTitles)) {
    warnings.push("Matched course title is blank in master courses");
  }

  return warnings;
}

function sanitizeUnexpectedRowError(error: any) {
  const msg = safeStr(error?.message || error);
  return msg || "Unexpected row processing error";
}

function buildFailureRawRow(row: PreparedBulkDetailsRow) {
  return {
    unique_id: safeStr(row?.A),
    subject_code: safeStr(row?.B),
    session: safeStr(row?.C),
    language: safeStr(row?.D),
    course_code: safeStr(row?.E),
    A: safeStr(row?.A),
    B: safeStr(row?.B),
    C: safeStr(row?.C),
    D: safeStr(row?.D),
    E: safeStr(row?.E),
  };
}

async function makeUniqueSlug(base: string, excludeId?: string) {
  await dbConnect();

  const clean = slugify(base) || "product";
  let slug = clean;
  let i = 1;

  while (true) {
    const existing = await Product.findOne(
      excludeId ? { slug, _id: { $ne: excludeId } } : { slug }
    ).select("_id");

    if (!existing) return slug;

    i += 1;
    slug = `${clean}-${i}`;
  }
}

function buildExistingProductMatchQuery(sku: string, normalizedSlugBase: string) {
  const or: any[] = [];

  if (safeStr(sku)) {
    or.push({ sku });
  }

  if (safeStr(normalizedSlugBase)) {
    or.push({ slug: normalizedSlugBase });
  }

  if (!or.length) {
    return null;
  }

  return { $or: or };
}

async function syncGeneratedCombosForBulkChanges(changes: SyncQueueItem[]) {
  const errors: string[] = [];

  for (const change of changes) {
    try {
      const result: any = await syncGeneratedCombosForProductChange(change as any);

      if (result && result.ok === false) {
        const reason = safeStr(result.reason || result.error);
        if (reason) errors.push(reason);
      }
    } catch (e: any) {
      errors.push(safeStr(e?.message) || "Unknown combo sync error");
    }
  }

  return {
    ok: errors.length === 0,
    errors: uniqueStrings(errors).slice(0, 10),
  };
}

function buildSubjectMap(subjects: any[]) {
  const subjectMap = new Map<string, any>();

  for (const s of subjects as any[]) {
    const subjectKeys = uniqueStrings([
      normalizeSubjectCodeLoose(String(s?.code || "")),
      normalizeSubjectCodeLoose(String(s?.subjectCode || "")),
      normalizeSubjectCodeLoose(String(s?.subject_code || "")),
    ]);

    for (const key of subjectKeys) {
      if (key && !subjectMap.has(key)) {
        subjectMap.set(key, s);
      }
    }
  }

  return subjectMap;
}

function buildCourseMap(courses: any[]) {
  const courseMap = new Map<string, any>();

  for (const c of courses as any[]) {
    const courseKeys = uniqueStrings([
      normalizeCourseCodeLoose(String(c?.code || "")),
      normalizeCourseCodeLoose(String(c?.courseCode || "")),
      normalizeCourseCodeLoose(String(c?.course_code || "")),
    ]);

    for (const key of courseKeys) {
      if (key && !courseMap.has(key)) {
        courseMap.set(key, c);
      }
    }
  }

  return courseMap;
}

async function getMasterDataCache(forceRefresh = false) {
  const now = Date.now();

  if (
    !forceRefresh &&
    masterDataCache &&
    now - masterDataCache.loadedAt < MASTER_CACHE_TTL_MS
  ) {
    return masterDataCache;
  }

  await dbConnect();

  const [subjects, courses, sessions] = await Promise.all([
    Subject.find({ isActive: { $ne: false } }).lean(),
    Course.find({ isActive: { $ne: false } }).lean(),
    Session.find({ isActive: { $ne: false } })
      .select("name slug code title label categories")
      .lean(),
  ]);

  masterDataCache = {
    loadedAt: now,
    subjects: Array.isArray(subjects) ? subjects : [],
    courses: Array.isArray(courses) ? courses : [],
    sessions: Array.isArray(sessions) ? sessions : [],
    subjectMap: buildSubjectMap(Array.isArray(subjects) ? subjects : []),
    courseMap: buildCourseMap(Array.isArray(courses) ? courses : []),
    sessionAllowedByCategory: new Map<string, Set<string>>(),
  };

  return masterDataCache;
}

function getSessionAllowedForCategory(
  cache: MasterDataCache,
  category: string
) {
  const categoryKey = safeStr(category);

  const existing = cache.sessionAllowedByCategory.get(categoryKey);
  if (existing) return existing;

  const categoryCandidates = categoryLabelToSessionSlugCandidates(categoryKey);
  const categoryCandidatesNormalized = new Set(
    categoryCandidates.flatMap((candidate) => {
      const cc = safeStr(candidate);
      const vals = [cc, cc.toLowerCase(), slugify(cc)].filter(Boolean);
      return vals;
    })
  );

  const sessionAllowed = new Set<string>();

  for (const s of cache.sessions as any[]) {
    const cats = Array.isArray(s?.categories)
      ? s.categories.map((x: any) => safeStr(x)).filter(Boolean)
      : [];

    const matchesCategory =
      !cats.length ||
      cats.some((c: string) => {
        const raw = safeStr(c);
        const vals = [raw, raw.toLowerCase(), slugify(raw)].filter(Boolean);
        return vals.some((v) => categoryCandidatesNormalized.has(v));
      });

    if (!matchesCategory) continue;

    const sessionNames = uniqueStrings([
      safeStr(s?.name),
      safeStr(s?.slug),
      safeStr(s?.code),
      safeStr(s?.title),
      safeStr(s?.label),
    ]);

    for (const sessionName of sessionNames) {
      for (const variant of buildSessionVariants(sessionName)) {
        sessionAllowed.add(variant);
      }
    }
  }

  cache.sessionAllowedByCategory.set(categoryKey, sessionAllowed);
  return sessionAllowed;
}

async function buildPricingCacheForCategory(args: {
  category: string;
  courseCodes: string[];
  skus: string[];
  existingProductIds: string[];
}) {
  const category = safeStr(args.category);
  const now = Date.now();

  if (
    pricingCache &&
    pricingCache.category === category &&
    now - pricingCache.loadedAt < PRICING_CACHE_TTL_MS
  ) {
    return pricingCache;
  }

  await dbConnect();

  const courseCodes = uniqueStrings(args.courseCodes.map((x) => safeStr(x).toUpperCase()));
  const skus = uniqueStrings(args.skus.map((x) => normalizeSku(x)));
  const existingProductIds = uniqueStrings(
    args.existingProductIds.map((x) => safeStr(x))
  );

  const [courseRules, skuOverrides, productIdOverrides] = await Promise.all([
    courseCodes.length
      ? ProductPricingRule.find({
          ruleType: "course_rule",
          isActive: true,
          category,
          courseCode: { $in: courseCodes },
        }).lean()
      : Promise.resolve([]),
    skus.length
      ? ProductPricingRule.find({
          ruleType: "product_override",
          isActive: true,
          productSku: { $in: skus },
        }).lean()
      : Promise.resolve([]),
    existingProductIds.length
      ? ProductPricingRule.find({
          ruleType: "product_override",
          isActive: true,
          productId: { $in: existingProductIds },
        }).lean()
      : Promise.resolve([]),
  ]);

  const courseRuleMap = new Map<string, any>();
  const productOverrideBySku = new Map<string, any>();
  const productOverrideByProductId = new Map<string, any>();

  for (const rule of Array.isArray(courseRules) ? courseRules : []) {
    const key = normalizeCourseCodeLoose(rule?.courseCode || "");
    if (key && !courseRuleMap.has(key)) courseRuleMap.set(key, rule);
  }

  for (const rule of Array.isArray(skuOverrides) ? skuOverrides : []) {
    const key = normalizeSku(rule?.productSku || "");
    if (key && !productOverrideBySku.has(key)) {
      productOverrideBySku.set(key, rule);
    }
  }

  for (const rule of Array.isArray(productIdOverrides) ? productIdOverrides : []) {
    const key = safeStr(rule?.productId);
    if (key && !productOverrideByProductId.has(key)) {
      productOverrideByProductId.set(key, rule);
    }
  }

  pricingCache = {
    loadedAt: now,
    category,
    courseRuleMap,
    productOverrideBySku,
    productOverrideByProductId,
  };

  return pricingCache;
}

function resolveRequiredPricingFromCache(args: {
  pricingCache: PricingCache;
  courseCodeList: string[];
  sku: string;
  existingProductId?: string;
}) {
  const existingProductId = safeStr(args.existingProductId);

  if (
    existingProductId &&
    args.pricingCache.productOverrideByProductId.has(existingProductId)
  ) {
    const rule = args.pricingCache.productOverrideByProductId.get(existingProductId);
    return {
      ok: true,
      source: "product_override",
      price: Math.max(0, safeNum(rule?.price, 0)),
      oldPrice: Math.max(0, safeNum(rule?.oldPrice, 0)),
      matchedRule: rule,
    };
  }

  const sku = normalizeSku(args.sku);
  if (sku && args.pricingCache.productOverrideBySku.has(sku)) {
    const rule = args.pricingCache.productOverrideBySku.get(sku);
    return {
      ok: true,
      source: "product_override",
      price: Math.max(0, safeNum(rule?.price, 0)),
      oldPrice: Math.max(0, safeNum(rule?.oldPrice, 0)),
      matchedRule: rule,
    };
  }

  for (const oneCode of args.courseCodeList) {
    const key = normalizeCourseCodeLoose(oneCode);
    if (key && args.pricingCache.courseRuleMap.has(key)) {
      const rule = args.pricingCache.courseRuleMap.get(key);
      return {
        ok: true,
        source: "course_rule",
        price: Math.max(0, safeNum(rule?.price, 0)),
        oldPrice: Math.max(0, safeNum(rule?.oldPrice, 0)),
        matchedRule: rule,
      };
    }
  }

  return {
    ok: false,
    source: "not_found",
    price: 0,
    oldPrice: 0,
    matchedRule: null,
  };
}

function buildInitialPipelineSummary(args: {
  totalRows: number;
  config: BulkDetailsJobConfig;
  existingSummary?: any;
}) {
  const totalRows = Math.max(0, safeNum(args.totalRows, 0));
  const config = args.config;
  const existing = args.existingSummary || {};

  const prevalidation = existing?.prevalidation || {};
  const execution = existing?.execution || {};
  const comboSync = existing?.comboSync || {};
  const hardcopySync = existing?.hardcopySync || {};

  const normalized: BulkDetailsPipelineSummary = {
    totalRows,
    validRows: Math.max(0, safeNum(existing?.validRows, 0)),
    createdRows: Math.max(0, safeNum(existing?.createdRows, 0)),
    updatedRows: Math.max(0, safeNum(existing?.updatedRows, 0)),
    skippedRows: Math.max(0, safeNum(existing?.skippedRows, 0)),
    failedRows: Math.max(0, safeNum(existing?.failedRows, 0)),
    duplicateStrategy: config.duplicateStrategy,
    dryRun: config.dryRun,
    category: config.category,
    pipelineStage:
      safeStr(existing?.pipelineStage) === "execution" ||
      safeStr(existing?.pipelineStage) === "completed"
        ? (safeStr(existing?.pipelineStage) as BulkPipelineStage)
        : "prevalidation",
    prevalidation: {
      totalRows,
      processedRows: Math.max(0, safeNum(prevalidation?.processedRows, 0)),
      validRows: Math.max(0, safeNum(prevalidation?.validRows, 0)),
      failedRows: Math.max(0, safeNum(prevalidation?.failedRows, 0)),
      skippedRows: Math.max(0, safeNum(prevalidation?.skippedRows, 0)),
      duplicateUploadRows: Math.max(
        0,
        safeNum(prevalidation?.duplicateUploadRows, 0)
      ),
      readyRows: Math.max(0, safeNum(prevalidation?.readyRows, 0)),
      startedAt: prevalidation?.startedAt || null,
      completedAt: prevalidation?.completedAt || null,
      lastNote: safeStr(prevalidation?.lastNote),
    },
    execution: {
      totalRows: Math.max(0, safeNum(execution?.totalRows, 0)),
      processedRows: Math.max(0, safeNum(execution?.processedRows, 0)),
      createdRows: Math.max(0, safeNum(execution?.createdRows, 0)),
      updatedRows: Math.max(0, safeNum(execution?.updatedRows, 0)),
      skippedRows: Math.max(0, safeNum(execution?.skippedRows, 0)),
      failedRows: Math.max(0, safeNum(execution?.failedRows, 0)),
      successRows: Math.max(0, safeNum(execution?.successRows, 0)),
      startedAt: execution?.startedAt || null,
      completedAt: execution?.completedAt || null,
      lastNote: safeStr(execution?.lastNote),
    },
    comboSync: {
      attempted: Math.max(0, safeNum(comboSync?.attempted, 0)),
      succeeded: Math.max(0, safeNum(comboSync?.succeeded, 0)),
      failed: Math.max(0, safeNum(comboSync?.failed, 0)),
      errors: Array.isArray(comboSync?.errors)
        ? uniqueStrings(comboSync.errors.map((x: any) => safeStr(x))).slice(0, 10)
        : [],
      mode: safeStr(comboSync?.mode || "none"),
    },
    hardcopySync: {
      attempted: Math.max(0, safeNum(hardcopySync?.attempted, 0)),
      succeeded: Math.max(0, safeNum(hardcopySync?.succeeded, 0)),
      failed: Math.max(0, safeNum(hardcopySync?.failed, 0)),
      errors: Array.isArray(hardcopySync?.errors)
        ? uniqueStrings(hardcopySync.errors.map((x: any) => safeStr(x))).slice(0, 10)
        : [],
      mode: safeStr(hardcopySync?.mode || "none"),
    },
  };

  return normalized;
}

function buildTokenRow(args: {
  sku: string;
  subjectCodeRaw: string;
  session: string;
  language: string;
  courseCodeList: string[];
  matchedSubjectTitle: string;
  joinedCourseTitles: string;
}) {
  return {
    A: args.sku,
    B: args.subjectCodeRaw,
    C: args.session,
    D: args.language,
    E: args.courseCodeList.join(", "),
    F: args.matchedSubjectTitle,
    G: args.joinedCourseTitles,
    H: "",
  };
}

function buildPrevalidatedRow(args: {
  itemIndex: number;
  row: PreparedBulkDetailsRow;
  courseCodeList: string[];
  normalizedCourseTitles: string[];
  joinedCourseTitles: string;
  subjectDoc: any;
  matchedSubjectTitle: string;
  config: BulkDetailsJobConfig;
  title: string;
  slugBase: string;
  normalizedSlugBase: string;
  price: number;
  oldPrice: number;
  pricingSource: string;
  templateWarnings: string[];
}) {
  const { subjectTitleHi, subjectTitleEn, subjectTitleOther } = getSubjectTitle(
    args.subjectDoc
  );

  const tokenRow = buildTokenRow({
    sku: normalizeSku(args.row.A),
    subjectCodeRaw: safeStr(args.row.B),
    session: safeStr(args.row.C),
    language: safeStr(args.row.D),
    courseCodeList: args.courseCodeList,
    matchedSubjectTitle: args.matchedSubjectTitle,
    joinedCourseTitles: args.joinedCourseTitles,
  });

  return {
    itemIndex: args.itemIndex,
    rowNumber: safeNum(args.row.rowNumber, args.itemIndex + 1),
    sku: normalizeSku(args.row.A),
    subjectCodeRaw: safeStr(args.row.B),
    subjectCodeLoose: normalizeSubjectCodeLoose(args.row.B),
    session: safeStr(args.row.C),
    session6: normalizeSession6(args.row.C),
    language: safeStr(args.row.D),
    lang3: normalizeLang3(args.row.D),
    courseCodeList: args.courseCodeList,
    normalizedCourseTitles: args.normalizedCourseTitles,
    joinedCourseTitles: args.joinedCourseTitles,
    subjectTitleHi,
    subjectTitleEn,
    subjectTitleOther,
    matchedSubjectTitle: args.matchedSubjectTitle,
    title: args.title,
    slugBase: args.slugBase,
    normalizedSlugBase: args.normalizedSlugBase,
    importantNote: replaceTokens(args.config.importantNoteTemplate, tokenRow),
    shortDesc: replaceTokens(args.config.shortDescTemplate, tokenRow),
    descriptionHtml: replaceTokens(args.config.longDescTemplate, tokenRow),
    metaTitle: replaceTokens(args.config.metaTitleTemplate, tokenRow),
    metaDescription: replaceTokens(args.config.metaDescriptionTemplate, tokenRow),
    price: Math.max(0, safeNum(args.price, 0)),
    oldPrice: Math.max(0, safeNum(args.oldPrice, 0)),
    pricingSource: safeStr(args.pricingSource),
    templateWarnings: args.templateWarnings,
    raw: buildFailureRawRow(args.row),
  } satisfies PrevalidatedBulkDetailsRow;
}

function buildExecutionPayload(args: {
  config: BulkDetailsJobConfig;
  row: PrevalidatedBulkDetailsRow;
}) {
  return {
    title: args.row.title,
    sku: args.row.sku,
    category: args.config.category,

    subjectCode: args.row.subjectCodeRaw,
    subjectTitleHi: args.row.subjectTitleHi,
    subjectTitleEn: args.row.subjectTitleEn,
    subjectTitleOther: args.row.subjectTitleOther,

    courseCodes: args.row.courseCodeList,
    courseTitles: args.row.normalizedCourseTitles,

    session: args.row.session,
    session6: args.row.session6,
    language: args.row.language,
    lang3: args.row.lang3,

    price: Math.max(0, safeNum(args.row.price, 0)),
    oldPrice: Math.max(0, safeNum(args.row.oldPrice, 0)),

    availability: "want_to_buy",
    importantNote: args.row.importantNote,

    shortDesc: args.row.shortDesc,
    descriptionHtml: args.row.descriptionHtml,

    isDigital: deriveIsDigitalFromCategory(args.config.category),

    metaTitle: args.row.metaTitle,
    metaDescription: args.row.metaDescription,

    isAutoGenerated: false,
    autoGenerationType: "",
    autoGeneratedFromProductId: null,
    autoGeneratedFromSku: "",
    autoGeneratedFromCategory: "",
    autoGeneratedAt: null,

    isActive: args.config.publishNow,
    lastModifiedAt: new Date(),

    deletedAt: null,
    deletedBy: "",
  };
}

function applyHardcopySyncPatch(
  currentPatch: BulkDetailsPipelineSummary["hardcopySync"],
  syncResult: any
) {
  const next = {
    attempted: Math.max(0, safeNum(currentPatch?.attempted, 0)),
    succeeded: Math.max(0, safeNum(currentPatch?.succeeded, 0)),
    failed: Math.max(0, safeNum(currentPatch?.failed, 0)),
    errors: Array.isArray(currentPatch?.errors)
      ? [...currentPatch.errors]
      : [],
    mode: safeStr(currentPatch?.mode || "none"),
  };

  const hardcopySync = syncResult?.hardcopySync;
  if (!hardcopySync) return next;

  next.attempted += 1;
  next.mode = "via-availability-sync";

  if (hardcopySync?.ok === false) {
    next.failed += 1;
    const reason = safeStr(hardcopySync?.reason || hardcopySync?.error);
    if (reason) {
      next.errors = uniqueStrings([...next.errors, reason]).slice(0, 10);
    }
    return next;
  }

  next.succeeded += 1;
  return next;
}

async function prevalidateBulkDetailsBatch(args: {
  job: any;
  batchNumber: number;
  fromIndex: number;
  toIndex: number;
}) {
  await dbConnect();

  const job = args.job;
  const config = normalizeBulkDetailsConfig(job?.config || {});
  validateBulkDetailsConfig(config);

  const rows: PreparedBulkDetailsRow[] = Array.isArray(job?.input?.rows)
    ? job.input.rows
    : [];

  const batchRows = rows.slice(args.fromIndex, args.toIndex + 1);
  const currentSummary = buildInitialPipelineSummary({
    totalRows: rows.length,
    config,
    existingSummary: job?.summary || {},
  });

  const prevalidationStartedAt =
    currentSummary.prevalidation.startedAt || new Date();

  const seenSkuSet = new Set<string>(
    Array.isArray(job?.input?.prevalidationSeenSkus)
      ? job.input.prevalidationSeenSkus.map((x: any) => normalizeSku(x))
      : []
  );

  const newPreparedRows: PrevalidatedBulkDetailsRow[] = [];
  const newSeenSkus: string[] = [];
  const failures: BulkDetailsBatchProcessResult["failures"] = [];

  const master = await getMasterDataCache(false);
  const subjectMap = master.subjectMap;
  const courseMap = master.courseMap;
  const sessionAllowed = getSessionAllowedForCategory(master, config.category);

  const allTemplates = [
    config.titleTemplate,
    config.importantNoteTemplate,
    config.shortDescTemplate,
    config.longDescTemplate,
    config.slugTemplate,
    config.metaTitleTemplate,
    config.metaDescriptionTemplate,
  ];

  const batchSkus = uniqueStrings(batchRows.map((row) => normalizeSku(row?.A)));
  const batchCourseCodes = uniqueStrings(
    batchRows.flatMap((row) => splitCourseCodes(row?.E))
  );

  const existingProducts: any[] = batchSkus.length
    ? await Product.find({
        sku: { $in: batchSkus },
        deletedAt: null,
      })
        .select("_id sku")
        .lean()
    : [];

  const existingBySku = new Map<string, any>();
  for (const item of Array.isArray(existingProducts) ? existingProducts : []) {
    const key = normalizeSku(item?.sku || "");
    if (key && !existingBySku.has(key)) existingBySku.set(key, item);
  }

  const pricing = await buildPricingCacheForCategory({
    category: config.category,
    courseCodes: batchCourseCodes,
    skus: batchSkus,
    existingProductIds: existingProducts.map((x: any) => safeStr(x?._id)),
  });

  let batchValidRows = 0;
  let batchFailedRows = 0;
  let batchSkippedRows = 0;
  let batchDuplicateRows = 0;

  for (let idx = 0; idx < batchRows.length; idx++) {
    const row = batchRows[idx];
    const itemIndex = args.fromIndex + idx;
    const rowNumber = Number(row?.rowNumber || itemIndex + 1);

    const sku = normalizeSku(row?.A);
    const subjectCodeRaw = safeStr(row?.B);

    const pushFailure = (status: string, reason: string, customSku?: string) => {
      const effectiveSku = safeStr(customSku || sku);
      failures.push({
        itemIndex,
        rowNumber,
        batchNumber: args.batchNumber,
        identifier: effectiveSku || subjectCodeRaw || `row-${rowNumber}`,
        sku: effectiveSku,
        status,
        reason,
        raw: buildFailureRawRow(row),
      });
    };

    try {
      const session = safeStr(row?.C);
      const language = safeStr(row?.D);
      const courseCodeRaw = safeStr(row?.E);

      if (!sku || !subjectCodeRaw || !session || !language || !courseCodeRaw) {
        batchFailedRows++;
        pushFailure("failed", "Required columns missing or invalid in this row");
        continue;
      }

      if (seenSkuSet.has(sku)) {
        batchSkippedRows++;
        batchDuplicateRows++;
        pushFailure(
          "skipped",
          "Duplicate SKU found inside uploaded sheet. First occurrence kept, later duplicate row skipped before validation."
        );
        continue;
      }

      seenSkuSet.add(sku);
      newSeenSkus.push(sku);

      const subjectCodeLoose = normalizeSubjectCodeLoose(subjectCodeRaw);
      const courseCodeList = splitCourseCodes(courseCodeRaw);

      const subjectDoc = subjectMap.get(subjectCodeLoose);
      if (!subjectDoc) {
        batchFailedRows++;
        pushFailure(
          "failed",
          `Subject not found in master subjects: ${subjectCodeRaw}`
        );
        continue;
      }

      if (!courseCodeList.length) {
        batchFailedRows++;
        pushFailure("failed", `Course code missing or invalid: ${courseCodeRaw}`);
        continue;
      }

      const missingCourse: string[] = [];
      const courseTitles: string[] = [];

      for (const oneCode of courseCodeList) {
        const loose = normalizeCourseCodeLoose(oneCode);
        const courseDoc = courseMap.get(loose);

        if (!courseDoc) {
          missingCourse.push(oneCode);
        } else {
          courseTitles.push(getCourseTitle(courseDoc));
        }
      }

      if (missingCourse.length) {
        batchFailedRows++;
        pushFailure(
          "failed",
          `Course not found in master courses: ${missingCourse.join(", ")}`
        );
        continue;
      }

      if (!sessionMatches(sessionAllowed, session)) {
        batchFailedRows++;
        pushFailure(
          "failed",
          `Session not found in category-wise master sessions: ${session}`
        );
        continue;
      }

      const normalizedCourseTitles = uniqueStrings(courseTitles.filter(Boolean));
      const joinedCourseTitles = normalizedCourseTitles.join(", ");
      const matchedSubjectTitle = getMatchedSubjectTitleForLanguage(
        subjectDoc,
        language
      );

      const tokenRow = buildTokenRow({
        sku,
        subjectCodeRaw,
        session,
        language,
        courseCodeList,
        matchedSubjectTitle,
        joinedCourseTitles,
      });

      const title = replaceTokens(config.titleTemplate, tokenRow);
      const slugBase = config.slugTemplate
        ? replaceTokens(config.slugTemplate, tokenRow)
        : title;
      const normalizedSlugBase = slugify(slugBase);

      if (!title) {
        batchFailedRows++;
        pushFailure("failed", "Generated title empty hai");
        continue;
      }

      const templateWarnings = buildTemplateWarnings({
        allTemplates,
        matchedSubjectTitle,
        joinedCourseTitles,
      });

      const existingProduct = existingBySku.get(sku);
      const cachedPricing = resolveRequiredPricingFromCache({
        pricingCache: pricing,
        courseCodeList,
        sku,
        existingProductId: safeStr(existingProduct?._id),
      });

      let finalPricing = cachedPricing;
      if (!finalPricing.ok) {
        const fallbackPricing = await resolveRequiredProductPricing({
          category: config.category,
          courseCodes: courseCodeList,
          productSku: sku,
          productId: safeStr(existingProduct?._id),
        });

        finalPricing = {
          ok: fallbackPricing.ok,
          source: fallbackPricing.source,
          price: fallbackPricing.price,
          oldPrice: fallbackPricing.oldPrice,
          matchedRule: null,
        };
      }

      if (!finalPricing.ok || Number(finalPricing.price) <= 0) {
        batchFailedRows++;
        pushFailure(
          "failed",
          "Pricing rule not found. Pehle Product Pricing page me category + course rule ya product override set karo."
        );
        continue;
      }

      const prepared = buildPrevalidatedRow({
        itemIndex,
        row,
        courseCodeList,
        normalizedCourseTitles,
        joinedCourseTitles,
        subjectDoc,
        matchedSubjectTitle,
        config,
        title,
        slugBase,
        normalizedSlugBase,
        price: finalPricing.price,
        oldPrice: finalPricing.oldPrice,
        pricingSource: finalPricing.source,
        templateWarnings,
      });

      newPreparedRows.push(prepared);
      batchValidRows++;
    } catch (error: any) {
      batchFailedRows++;
      pushFailure("failed", sanitizeUnexpectedRowError(error));
      continue;
    }
  }

  const nextSummary = buildInitialPipelineSummary({
    totalRows: rows.length,
    config,
    existingSummary: currentSummary,
  });

  nextSummary.pipelineStage = "prevalidation";
  nextSummary.validRows =
    safeNum(currentSummary.validRows, 0) + batchValidRows;
  nextSummary.failedRows =
    safeNum(currentSummary.failedRows, 0) + batchFailedRows;
  nextSummary.skippedRows =
    safeNum(currentSummary.skippedRows, 0) + batchSkippedRows;

  nextSummary.prevalidation = {
    ...nextSummary.prevalidation,
    totalRows: rows.length,
    processedRows:
      safeNum(currentSummary.prevalidation.processedRows, 0) + batchRows.length,
    validRows: safeNum(currentSummary.prevalidation.validRows, 0) + batchValidRows,
    failedRows:
      safeNum(currentSummary.prevalidation.failedRows, 0) + batchFailedRows,
    skippedRows:
      safeNum(currentSummary.prevalidation.skippedRows, 0) + batchSkippedRows,
    duplicateUploadRows:
      safeNum(currentSummary.prevalidation.duplicateUploadRows, 0) +
      batchDuplicateRows,
    readyRows:
      safeNum(currentSummary.prevalidation.readyRows, 0) + batchValidRows,
    startedAt: prevalidationStartedAt,
    completedAt: null,
    lastNote: `Pre-validation batch ${args.batchNumber} processed. Valid ${batchValidRows}, Duplicate skipped ${batchDuplicateRows}, Failed ${batchFailedRows}.`,
  };

  let nextStage: BulkPipelineStage = "prevalidation";

  if (nextSummary.prevalidation.processedRows >= rows.length) {
    nextSummary.prevalidation.completedAt = new Date();

    if (config.dryRun) {
      nextSummary.pipelineStage = "completed";
      nextSummary.execution = {
        ...nextSummary.execution,
        totalRows: safeNum(nextSummary.prevalidation.readyRows, 0),
        processedRows: 0,
        createdRows: 0,
        updatedRows: 0,
        skippedRows: 0,
        failedRows: 0,
        successRows: 0,
        startedAt: null,
        completedAt: new Date(),
        lastNote:
          "Pre-validation completed. Dry run enabled hai, isliye final product create/update stage run nahi hui.",
      };
      nextStage = "completed";
    } else {
      nextSummary.pipelineStage = "execution";
      nextSummary.execution = {
        ...nextSummary.execution,
        totalRows: safeNum(nextSummary.prevalidation.readyRows, 0),
        processedRows: 0,
        createdRows: 0,
        updatedRows: 0,
        skippedRows: 0,
        failedRows: 0,
        successRows: 0,
        startedAt: null,
        completedAt: null,
        lastNote:
          "Pre-validation completed successfully. Final product upload/create stage ready hai.",
      };
      nextStage = "execution";
    }
  }

  return {
    stage: "prevalidation" as BulkPipelineStage,
    processedDelta: batchRows.length,
    successDelta: 0,
    failedDelta: batchFailedRows,
    skippedDelta: batchSkippedRows,
    validDelta: batchValidRows,
    nextLastProcessedIndex: args.toIndex,
    batchNumber: args.batchNumber,
    fromIndex: args.fromIndex,
    toIndex: args.toIndex,
    attempted: batchRows.length,
    failures,
    summaryPatch: nextSummary,
    inputAppendPatch: {
      prevalidationSeenSkus: newSeenSkus,
      prevalidatedRows: newPreparedRows,
    },
    nextStage,
    note: nextSummary.prevalidation.lastNote,
  } satisfies BulkDetailsBatchProcessResult;
}

async function executeBulkDetailsBatch(args: {
  job: any;
  batchNumber: number;
  fromIndex: number;
  toIndex: number;
}) {
  await dbConnect();

  const job = args.job;
  const config = normalizeBulkDetailsConfig(job?.config || {});
  validateBulkDetailsConfig(config);

  const preparedRows: PrevalidatedBulkDetailsRow[] = Array.isArray(
    job?.input?.prevalidatedRows
  )
    ? job.input.prevalidatedRows
    : [];

  const batchRows = preparedRows.slice(args.fromIndex, args.toIndex + 1);
  const currentSummary = buildInitialPipelineSummary({
    totalRows: safeNum(job?.summary?.totalRows, preparedRows.length),
    config,
    existingSummary: job?.summary || {},
  });

  const comboSyncQueue: SyncQueueItem[] = [];
  let hardcopySyncPatch = {
    ...currentSummary.hardcopySync,
  };

  let batchCreatedRows = 0;
  let batchUpdatedRows = 0;
  let batchSkippedRows = 0;
  let batchFailedRows = 0;

  const failures: BulkDetailsBatchProcessResult["failures"] = [];

  for (let idx = 0; idx < batchRows.length; idx++) {
    const row = batchRows[idx];
    const rowNumber = safeNum(row?.rowNumber, args.fromIndex + idx + 1);
    const itemIndex = safeNum(row?.itemIndex, args.fromIndex + idx);
    const sku = normalizeSku(row?.sku);
    const subjectCodeRaw = safeStr(row?.subjectCodeRaw);

    const pushFailure = (status: string, reason: string, customSku?: string) => {
      const effectiveSku = safeStr(customSku || sku);
      failures.push({
        itemIndex,
        rowNumber,
        batchNumber: args.batchNumber,
        identifier: effectiveSku || subjectCodeRaw || `row-${rowNumber}`,
        sku: effectiveSku,
        status,
        reason,
        raw: row?.raw || null,
      });
    };

    try {
      if (!sku || !row?.title || !Array.isArray(row?.courseCodeList)) {
        batchFailedRows++;
        pushFailure(
          "failed",
          "Prevalidated row payload invalid hai. Is row ko skip karke आगे बढ़ा गया."
        );
        continue;
      }

      const payload = buildExecutionPayload({
        config,
        row,
      });

      const existingMatchQuery = buildExistingProductMatchQuery(
        sku,
        safeStr(row?.normalizedSlugBase)
      );

      const existing: any = existingMatchQuery
        ? await Product.findOne(existingMatchQuery)
        : null;

      const warningText = Array.isArray(row?.templateWarnings) && row.templateWarnings.length
        ? ` Warnings: ${row.templateWarnings.join(" | ")}.`
        : "";

      if (existing) {
        if (config.duplicateStrategy === "ignore") {
          batchSkippedRows++;
          pushFailure(
            "skipped",
            `Duplicate product already exists, new row ignored. Price pre-validation stage me confirm ho chuki thi.${warningText}`
          );
          continue;
        }

        const beforeDoc = existing.toObject();

        const preservedMedia = {
          pages: safeNum(existing?.pages, 0),
          pdfKey: safeStr(existing?.pdfKey),
          pdfUrl: safeStr(existing?.pdfUrl),
          images: Array.isArray(existing?.images) ? existing.images : [],
          thumbnailUrl: safeStr(existing?.thumbnailUrl),
          quickUrl: safeStr(existing?.quickUrl),
        };

        const preservedDemandConfig = {
          deliverWithinMinutes: safeNum(existing?.deliverWithinMinutes, 20),
          onDemandNote: safeStr(existing?.onDemandNote),
          autoMakeAvailableOnUpload:
            typeof existing?.autoMakeAvailableOnUpload === "boolean"
              ? existing.autoMakeAvailableOnUpload
              : true,
        };

        let finalSlug = existing.slug;
        if (
          safeStr(row?.normalizedSlugBase) &&
          safeStr(existing.slug) !== safeStr(row?.normalizedSlugBase)
        ) {
          finalSlug = await makeUniqueSlug(
            safeStr(row?.normalizedSlugBase),
            String(existing._id)
          );
        } else if (!safeStr(existing.slug)) {
          finalSlug = await makeUniqueSlug(
            safeStr(row?.slugBase || row?.title),
            String(existing._id)
          );
        }

        await Product.updateOne(
          { _id: existing._id },
          {
            $set: {
              ...payload,
              ...preservedMedia,
              ...preservedDemandConfig,
              slug: finalSlug,
            },
          }
        );

        const availabilitySync: any = await syncProductAvailabilityBySku(sku);
        const afterDoc: any = await Product.findById(existing._id);

        comboSyncQueue.push({
          before: beforeDoc,
          after: afterDoc ? afterDoc.toObject() : null,
        });

        hardcopySyncPatch = applyHardcopySyncPatch(
          hardcopySyncPatch,
          availabilitySync
        );

        batchUpdatedRows++;
        continue;
      }

      const finalSlug = await makeUniqueSlug(
        safeStr(row?.slugBase || row?.title)
      );

      const createdDoc: any = await Product.create({
        ...payload,
        slug: finalSlug,
        pages: 0,
        pdfKey: "",
        pdfUrl: "",
        images: [],
        thumbnailUrl: "",
        quickUrl: "",
        deliverWithinMinutes: 20,
        onDemandNote: "",
        autoMakeAvailableOnUpload: true,
      });

      const availabilitySync: any = await syncProductAvailabilityBySku(sku);
      const refreshedDoc: any = await Product.findById(createdDoc._id);
      const createdObj =
        refreshedDoc?.toObject?.() || createdDoc?.toObject?.() || createdDoc;

      comboSyncQueue.push({
        before: null,
        after: createdObj,
      });

      hardcopySyncPatch = applyHardcopySyncPatch(
        hardcopySyncPatch,
        availabilitySync
      );

      batchCreatedRows++;
    } catch (error: any) {
      batchFailedRows++;
      pushFailure("failed", sanitizeUnexpectedRowError(error));
      continue;
    }
  }

  let comboSyncPatch = currentSummary.comboSync || {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
    mode: "none",
  };

  if (comboSyncQueue.length) {
    const comboResult = await syncGeneratedCombosForBulkChanges(comboSyncQueue);
    comboSyncPatch = {
      attempted: safeNum(comboSyncPatch.attempted, 0) + comboSyncQueue.length,
      succeeded:
        safeNum(comboSyncPatch.succeeded, 0) +
        (comboResult.ok ? comboSyncQueue.length : 0),
      failed:
        safeNum(comboSyncPatch.failed, 0) +
        (comboResult.ok ? 0 : comboSyncQueue.length),
      errors: uniqueStrings([
        ...((comboSyncPatch.errors as string[]) || []),
        ...(comboResult.errors || []),
      ]).slice(0, 10),
      mode: "batch-sync",
    };
  }

  const nextSummary = buildInitialPipelineSummary({
    totalRows: safeNum(job?.summary?.totalRows, preparedRows.length),
    config,
    existingSummary: currentSummary,
  });

  const successRows = batchCreatedRows + batchUpdatedRows;

  nextSummary.pipelineStage = "execution";
  nextSummary.createdRows =
    safeNum(currentSummary.createdRows, 0) + batchCreatedRows;
  nextSummary.updatedRows =
    safeNum(currentSummary.updatedRows, 0) + batchUpdatedRows;
  nextSummary.skippedRows =
    safeNum(currentSummary.skippedRows, 0) + batchSkippedRows;
  nextSummary.failedRows =
    safeNum(currentSummary.failedRows, 0) + batchFailedRows;

  nextSummary.execution = {
    ...nextSummary.execution,
    totalRows: preparedRows.length,
    processedRows:
      safeNum(currentSummary.execution.processedRows, 0) + batchRows.length,
    createdRows:
      safeNum(currentSummary.execution.createdRows, 0) + batchCreatedRows,
    updatedRows:
      safeNum(currentSummary.execution.updatedRows, 0) + batchUpdatedRows,
    skippedRows:
      safeNum(currentSummary.execution.skippedRows, 0) + batchSkippedRows,
    failedRows:
      safeNum(currentSummary.execution.failedRows, 0) + batchFailedRows,
    successRows:
      safeNum(currentSummary.execution.successRows, 0) + successRows,
    startedAt: currentSummary.execution.startedAt || new Date(),
    completedAt: null,
    lastNote: `Upload batch ${args.batchNumber} processed. Created ${batchCreatedRows}, Updated ${batchUpdatedRows}, Skipped ${batchSkippedRows}, Failed ${batchFailedRows}.`,
  };

  nextSummary.comboSync = comboSyncPatch;
  nextSummary.hardcopySync = hardcopySyncPatch;

  let nextStage: BulkPipelineStage = "execution";
  if (nextSummary.execution.processedRows >= preparedRows.length) {
    nextSummary.pipelineStage = "completed";
    nextSummary.execution.completedAt = new Date();
    nextSummary.execution.lastNote =
      "Final product upload/create stage completed.";
    nextStage = "completed";
  }

  return {
    stage: "execution" as BulkPipelineStage,
    processedDelta: batchRows.length,
    successDelta: successRows,
    failedDelta: batchFailedRows,
    skippedDelta: batchSkippedRows,
    validDelta: 0,
    nextLastProcessedIndex: args.toIndex,
    batchNumber: args.batchNumber,
    fromIndex: args.fromIndex,
    toIndex: args.toIndex,
    attempted: batchRows.length,
    failures,
    summaryPatch: nextSummary,
    nextStage,
    note: nextSummary.execution.lastNote,
  } satisfies BulkDetailsBatchProcessResult;
}

export async function processBulkDetailsJobBatch(args: {
  job: any;
  batchNumber: number;
  fromIndex: number;
  toIndex: number;
}) {
  const job = args.job;
  const config = normalizeBulkDetailsConfig(job?.config || {});
  const rows: PreparedBulkDetailsRow[] = Array.isArray(job?.input?.rows)
    ? job.input.rows
    : [];
  const preparedRows: PrevalidatedBulkDetailsRow[] = Array.isArray(
    job?.input?.prevalidatedRows
  )
    ? job.input.prevalidatedRows
    : [];

  const summary = buildInitialPipelineSummary({
    totalRows: rows.length,
    config,
    existingSummary: job?.summary || {},
  });

  const stage =
    safeStr(summary.pipelineStage) === "execution" ||
    safeStr(summary.pipelineStage) === "completed"
      ? (safeStr(summary.pipelineStage) as BulkPipelineStage)
      : "prevalidation";

  if (stage === "completed") {
    return {
      stage: "completed" as BulkPipelineStage,
      processedDelta: 0,
      successDelta: 0,
      failedDelta: 0,
      skippedDelta: 0,
      validDelta: 0,
      nextLastProcessedIndex: args.toIndex,
      batchNumber: args.batchNumber,
      fromIndex: args.fromIndex,
      toIndex: args.toIndex,
      attempted: 0,
      failures: [],
      summaryPatch: summary,
      nextStage: "completed" as BulkPipelineStage,
      note: "Bulk details job already completed.",
    } satisfies BulkDetailsBatchProcessResult;
  }

  if (stage === "prevalidation") {
    const safeToIndex = Math.min(args.toIndex, rows.length - 1);
    return prevalidateBulkDetailsBatch({
      ...args,
      toIndex: safeToIndex,
    });
  }

  const safeToIndex = Math.min(args.toIndex, preparedRows.length - 1);
  return executeBulkDetailsBatch({
    ...args,
    toIndex: safeToIndex,
  });
}