import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import Subject from "@/models/Subject";
import Course from "@/models/Course";
import Session from "@/models/Session";
import BulkUploadJob from "@/models/BulkUploadJob";
import ProductPricingRule from "@/models/ProductPricingRule";
import {
  CATEGORY_CONFIG,
  normalizeProductCategory,
  deriveIsDigitalFromCategory,
  categoryLabelToSessionSlugCandidates,
  PHYSICAL_CATEGORY,
} from "@/lib/productCatalog";

export type DuplicateStrategy = "replace" | "ignore";

export type BulkDetailsDetailedStage =
  | "sku_scan"
  | "course_validation"
  | "session_validation"
  | "subject_validation"
  | "pricing_validation"
  | "execution"
  | "completed";

export type BulkDetailsPipelineStage =
  | "prevalidation"
  | "execution"
  | "completed";

export type BulkPipelineStage = BulkDetailsPipelineStage;

export type PreparedBulkDetailsRow = {
  rowNumber: number;
  A: string; // unique_id / sku
  B: string; // subject_code
  C: string; // session
  D: string; // language
  E: string; // course_code
};

export type PreparedExecutionRow = {
  itemIndex: number;
  rowNumber: number;
  sku: string;
  subjectCodeRaw: string;
  session: string;
  session6: string;
  language: string;
  lang3: string;
  courseCodeList: string[];
  courseTitles: string[];
  joinedCourseTitles: string;
  subjectTitleHi: string;
  subjectTitleEn: string;
  subjectTitleOther: string;
  matchedSubjectTitle: string;
  price: number;
  oldPrice: number;
  pricingSource: string;
  templateWarnings: string[];
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

export type BulkDetailsBatchProcessResult = {
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
  summaryPatch: Record<string, any>;
  note: string;
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

type PricingContext = {
  overrideBySku: Map<string, any>;
  courseRuleByCode: Map<string, any>;
};

type ChunkValidationResult<RowOut> = {
  acceptedRows: RowOut[];
  failures: BulkDetailsBatchProcessResult["failures"];
  validCount: number;
  failedCount: number;
  skippedCount: number;
};

const MANUAL_HARDCOPY_BULK_BLOCK_MESSAGE =
  "Handwritten Hardcopy (Delivery) category ka manual bulk upload disabled hai. Ye products ab Solved Assignments se automatically generate honge.";

const MASTER_CACHE_TTL_MS = 2 * 60 * 1000;
const PREVALIDATION_STAGE_CHUNK_SIZE = 250;

const PRODUCT_EXECUTION_SELECT = [
  "_id",
  "slug",
  "sku",
  "pages",
  "pdfKey",
  "pdfUrl",
  "images",
  "thumbnailUrl",
  "quickUrl",
  "deliverWithinMinutes",
  "onDemandNote",
  "autoMakeAvailableOnUpload",
].join(" ");

let masterDataCache: MasterDataCache | null = null;

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
  return safeStr(input).toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9]/g, "");
}

function normalizeCourseCodeLoose(input: string) {
  return safeStr(input).toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9]/g, "");
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

function buildDeterministicSlug(seed: string, sku: string) {
  const cleanSeed = slugify(seed);
  const cleanSku = normalizeSku(sku).toLowerCase();
  if (cleanSeed && cleanSku) return slugify(`${cleanSeed}-${cleanSku}`);
  if (cleanSeed) return cleanSeed;
  if (cleanSku) return cleanSku;
  return "product";
}

function buildDeferredSyncPatch(current: any, label: string) {
  const errors = Array.isArray(current?.errors)
    ? current.errors.map((x: any) => safeStr(x)).filter(Boolean).slice(0, 10)
    : [];

  return {
    attempted: safeNum(current?.attempted, 0),
    succeeded: safeNum(current?.succeeded, 0),
    failed: safeNum(current?.failed, 0),
    errors,
    mode: "separate_notifications_flow",
    deferred: true,
    note: `${label} sync final product upload/create flow se alag kar di gayi hai. Isko Notifications page se separately run karo.`,
  };
}

function buildExecutionErrorReason(error: any) {
  const code = safeNum(error?.code, 0);
  const message = safeStr(error?.message || "");

  if (code === 11000) {
    const keyPattern = error?.keyPattern || {};
    const keyValue = error?.keyValue || {};

    if (keyPattern?.sku || message.includes("sku_1")) {
      return `SKU duplicate key conflict in database: ${safeStr(
        keyValue?.sku || ""
      ) || "unknown sku"}.`;
    }

    if (keyPattern?.slug || message.includes("slug_1")) {
      return `Generated slug already exists in database: ${safeStr(
        keyValue?.slug || ""
      ) || "unknown slug"}.`;
    }

    return "Duplicate key conflict in database for this row.";
  }

  return sanitizeUnexpectedRowError(error);
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
    duplicateStrategy: input?.duplicateStrategy === "replace" ? "replace" : "ignore",
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
    subjectTitleHi: pickFirstNonEmpty(subject?.titleHi, subject?.nameHi, subject?.labelHi),
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
  if (raw === "en" || raw.includes("english") || norm === "en" || norm.includes("english")) {
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
  const { subjectTitleHi, subjectTitleEn, subjectTitleOther } = getSubjectTitle(subject);

  if (bucket === "en") return subjectTitleEn;
  if (bucket === "hi") return subjectTitleHi;

  if (bucket === "other") {
    const subjectOtherLanguageName = normalizeLooseText(subject?.otherLangName || "");
    const rowLanguage = normalizeLooseText(language);

    if (subjectOtherLanguageName && rowLanguage && subjectOtherLanguageName === rowLanguage) {
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
    warnings.push("Matched subject title is blank for this row language in master subjects");
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

function buildFailureRawExecutionRow(row: PreparedExecutionRow) {
  return {
    unique_id: safeStr(row?.sku),
    subject_code: safeStr(row?.subjectCodeRaw),
    session: safeStr(row?.session),
    language: safeStr(row?.language),
    course_code: Array.isArray(row?.courseCodeList) ? row.courseCodeList.join(", ") : "",
  };
}

function pushFailureRow(
  failures: BulkDetailsBatchProcessResult["failures"],
  args: {
    itemIndex: number;
    rowNumber: number;
    batchNumber: number;
    identifier?: string;
    sku?: string;
    status: string;
    reason: string;
    raw?: any;
  }
) {
  failures.push({
    itemIndex: args.itemIndex,
    rowNumber: args.rowNumber,
    batchNumber: args.batchNumber,
    identifier: safeStr(args.identifier),
    sku: safeStr(args.sku),
    status: safeStr(args.status),
    reason: safeStr(args.reason),
    raw: args.raw ?? null,
  });
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

function getSessionAllowedForCategory(cache: MasterDataCache, category: string) {
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

function buildStageBlock(totalRows = 0, extra?: Record<string, any>) {
  return {
    totalRows: safeNum(totalRows, 0),
    processedRows: 0,
    validRows: 0,
    failedRows: 0,
    skippedRows: 0,
    startedAt: null,
    completedAt: null,
    lastNote: "",
    ...(extra || {}),
  };
}

function buildExecutionBlock(totalRows = 0) {
  return {
    totalRows: safeNum(totalRows, 0),
    processedRows: 0,
    createdRows: 0,
    updatedRows: 0,
    skippedRows: 0,
    failedRows: 0,
    successRows: 0,
    startedAt: null,
    completedAt: null,
    lastNote: "",
  };
}

function cloneRecord(input: any) {
  return input && typeof input === "object" && !Array.isArray(input)
    ? { ...input }
    : {};
}

function getStageBlock(summary: any, key: string, totalRows = 0, extra?: Record<string, any>) {
  const current = summary?.[key];
  return {
    ...buildStageBlock(totalRows, extra),
    ...(current && typeof current === "object" && !Array.isArray(current) ? current : {}),
  };
}

function getChunkInfo<T>(rows: T[], cursor: number, chunkSize: number) {
  const safeCursor = Math.max(0, safeNum(cursor, 0));
  const size = Math.max(1, safeNum(chunkSize, 1));
  const endExclusive = Math.min(rows.length, safeCursor + size);

  return {
    cursor: safeCursor,
    chunkRows: rows.slice(safeCursor, endExclusive),
    nextCursor: endExclusive,
    isDone: endExclusive >= rows.length,
  };
}

async function persistJobInput(job: any, patch: Record<string, any>) {
  await dbConnect();

  await BulkUploadJob.updateOne(
    {
      _id: String(job?._id),
      createdBy: safeStr(job?.createdBy),
    },
    {
      $set: Object.fromEntries(
        Object.entries(patch).map(([key, value]) => [`input.${key}`, value])
      ),
    }
  );
}

async function loadExistingLiveProductSkuSet(rows: PreparedBulkDetailsRow[]) {
  await dbConnect();

  const skuList = uniqueStrings(rows.map((row) => normalizeSku(row?.A)).filter(Boolean));
  if (!skuList.length) return new Set<string>();

  const existingDocs: Array<{ sku?: string }> = await Product.find({
    sku: { $in: skuList },
    deletedAt: null,
  })
    .select("sku")
    .lean();

  const existingSet = new Set<string>();

  for (const doc of Array.isArray(existingDocs) ? existingDocs : []) {
    const sku = normalizeSku(doc?.sku || "");
    if (sku) existingSet.add(sku);
  }

  return existingSet;
}

async function buildSkuScanResult(rows: PreparedBulkDetailsRow[], batchNumber: number) {
  const failures: BulkDetailsBatchProcessResult["failures"] = [];
  const remainingRows: PreparedBulkDetailsRow[] = [];

  const firstIndexBySku = new Map<string, number>();
  const firstRowNumberBySku = new Map<string, number>();

  const existingLiveSkuSet = await loadExistingLiveProductSkuSet(rows);

  let validCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  let duplicateRows = 0;
  let siteDuplicateRows = 0;
  let sheetDuplicateRows = 0;

  rows.forEach((row, itemIndex) => {
    const rowNumber = safeNum(row?.rowNumber, itemIndex + 1);
    const sku = normalizeSku(row?.A);

    if (!sku) {
      failedCount++;
      pushFailureRow(failures, {
        itemIndex,
        rowNumber,
        batchNumber,
        identifier: `row-${rowNumber}`,
        sku: "",
        status: "failed",
        reason: "Unique SKU required",
        raw: buildFailureRawRow(row),
      });
      return;
    }

    if (existingLiveSkuSet.has(sku)) {
      skippedCount++;
      duplicateRows++;
      siteDuplicateRows++;

      pushFailureRow(failures, {
        itemIndex,
        rowNumber,
        batchNumber,
        identifier: sku,
        sku,
        status: "skipped",
        reason:
          "SKU already exists in live site products. Ye row invalid hai aur upload/create stage me nahi jayegi.",
        raw: buildFailureRawRow(row),
      });
      return;
    }

    if (!firstIndexBySku.has(sku)) {
      firstIndexBySku.set(sku, itemIndex);
      firstRowNumberBySku.set(sku, rowNumber);
      remainingRows.push({
        ...row,
        A: sku,
      });
      validCount++;
      return;
    }

    skippedCount++;
    duplicateRows++;
    sheetDuplicateRows++;

    pushFailureRow(failures, {
      itemIndex,
      rowNumber,
      batchNumber,
      identifier: sku,
      sku,
      status: "skipped",
      reason: `Duplicate SKU within uploaded sheet. First occurrence row ${safeNum(
        firstRowNumberBySku.get(sku),
        0
      )} kept, current row skipped.`,
      raw: buildFailureRawRow(row),
    });
  });

  return {
    remainingRows,
    failures,
    validCount,
    failedCount,
    skippedCount,
    duplicateRows,
    siteDuplicateRows,
    sheetDuplicateRows,
  };
}

function buildCourseValidationChunk(args: {
  rows: PreparedBulkDetailsRow[];
  startIndex: number;
  batchNumber: number;
  courseMap: Map<string, any>;
}): ChunkValidationResult<PreparedBulkDetailsRow> {
  const failures: BulkDetailsBatchProcessResult["failures"] = [];
  const acceptedRows: PreparedBulkDetailsRow[] = [];

  let validCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  args.rows.forEach((row, localIndex) => {
    const itemIndex = args.startIndex + localIndex;
    const rowNumber = safeNum(row?.rowNumber, itemIndex + 1);
    const sku = normalizeSku(row?.A);
    const courseCodeRaw = safeStr(row?.E);

    try {
      if (!courseCodeRaw) {
        failedCount++;
        pushFailureRow(failures, {
          itemIndex,
          rowNumber,
          batchNumber: args.batchNumber,
          identifier: sku || `row-${rowNumber}`,
          sku,
          status: "failed",
          reason: "Course code missing",
          raw: buildFailureRawRow(row),
        });
        return;
      }

      const courseCodeList = splitCourseCodes(courseCodeRaw);
      if (!courseCodeList.length) {
        failedCount++;
        pushFailureRow(failures, {
          itemIndex,
          rowNumber,
          batchNumber: args.batchNumber,
          identifier: sku || `row-${rowNumber}`,
          sku,
          status: "failed",
          reason: "Course code missing or invalid",
          raw: buildFailureRawRow(row),
        });
        return;
      }

      const missingCourse: string[] = [];

      for (const oneCode of courseCodeList) {
        const loose = normalizeCourseCodeLoose(oneCode);
        const courseDoc = args.courseMap.get(loose);
        if (!courseDoc) missingCourse.push(oneCode);
      }

      if (missingCourse.length) {
        failedCount++;
        pushFailureRow(failures, {
          itemIndex,
          rowNumber,
          batchNumber: args.batchNumber,
          identifier: sku || `row-${rowNumber}`,
          sku,
          status: "failed",
          reason: `Course not found in master courses: ${missingCourse.join(", ")}`,
          raw: buildFailureRawRow(row),
        });
        return;
      }

      acceptedRows.push(row);
      validCount++;
    } catch (error: any) {
      failedCount++;
      pushFailureRow(failures, {
        itemIndex,
        rowNumber,
        batchNumber: args.batchNumber,
        identifier: sku || `row-${rowNumber}`,
        sku,
        status: "failed",
        reason: sanitizeUnexpectedRowError(error),
        raw: buildFailureRawRow(row),
      });
    }
  });

  return {
    acceptedRows,
    failures,
    validCount,
    failedCount,
    skippedCount,
  };
}

function buildSessionValidationChunk(args: {
  rows: PreparedBulkDetailsRow[];
  startIndex: number;
  batchNumber: number;
  sessionAllowed: Set<string>;
}): ChunkValidationResult<PreparedBulkDetailsRow> {
  const failures: BulkDetailsBatchProcessResult["failures"] = [];
  const acceptedRows: PreparedBulkDetailsRow[] = [];

  let validCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  args.rows.forEach((row, localIndex) => {
    const itemIndex = args.startIndex + localIndex;
    const rowNumber = safeNum(row?.rowNumber, itemIndex + 1);
    const sku = normalizeSku(row?.A);
    const session = safeStr(row?.C);

    try {
      if (!session) {
        failedCount++;
        pushFailureRow(failures, {
          itemIndex,
          rowNumber,
          batchNumber: args.batchNumber,
          identifier: sku || `row-${rowNumber}`,
          sku,
          status: "failed",
          reason: "Session missing",
          raw: buildFailureRawRow(row),
        });
        return;
      }

      if (!sessionMatches(args.sessionAllowed, session)) {
        failedCount++;
        pushFailureRow(failures, {
          itemIndex,
          rowNumber,
          batchNumber: args.batchNumber,
          identifier: sku || `row-${rowNumber}`,
          sku,
          status: "failed",
          reason: `Session not found in category-wise master sessions: ${session}`,
          raw: buildFailureRawRow(row),
        });
        return;
      }

      acceptedRows.push(row);
      validCount++;
    } catch (error: any) {
      failedCount++;
      pushFailureRow(failures, {
        itemIndex,
        rowNumber,
        batchNumber: args.batchNumber,
        identifier: sku || `row-${rowNumber}`,
        sku,
        status: "failed",
        reason: sanitizeUnexpectedRowError(error),
        raw: buildFailureRawRow(row),
      });
    }
  });

  return {
    acceptedRows,
    failures,
    validCount,
    failedCount,
    skippedCount,
  };
}

function buildSubjectValidationChunk(args: {
  rows: PreparedBulkDetailsRow[];
  startIndex: number;
  batchNumber: number;
  subjectMap: Map<string, any>;
}): ChunkValidationResult<PreparedBulkDetailsRow> {
  const failures: BulkDetailsBatchProcessResult["failures"] = [];
  const acceptedRows: PreparedBulkDetailsRow[] = [];

  let validCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  args.rows.forEach((row, localIndex) => {
    const itemIndex = args.startIndex + localIndex;
    const rowNumber = safeNum(row?.rowNumber, itemIndex + 1);
    const sku = normalizeSku(row?.A);
    const subjectCodeRaw = safeStr(row?.B);

    try {
      if (!subjectCodeRaw) {
        failedCount++;
        pushFailureRow(failures, {
          itemIndex,
          rowNumber,
          batchNumber: args.batchNumber,
          identifier: sku || `row-${rowNumber}`,
          sku,
          status: "failed",
          reason: "Subject code missing",
          raw: buildFailureRawRow(row),
        });
        return;
      }

      const subjectCodeLoose = normalizeSubjectCodeLoose(subjectCodeRaw);
      const subjectDoc = args.subjectMap.get(subjectCodeLoose);

      if (!subjectDoc) {
        failedCount++;
        pushFailureRow(failures, {
          itemIndex,
          rowNumber,
          batchNumber: args.batchNumber,
          identifier: sku || subjectCodeRaw || `row-${rowNumber}`,
          sku,
          status: "failed",
          reason: `Subject not found in master subjects: ${subjectCodeRaw}`,
          raw: buildFailureRawRow(row),
        });
        return;
      }

      acceptedRows.push(row);
      validCount++;
    } catch (error: any) {
      failedCount++;
      pushFailureRow(failures, {
        itemIndex,
        rowNumber,
        batchNumber: args.batchNumber,
        identifier: sku || subjectCodeRaw || `row-${rowNumber}`,
        sku,
        status: "failed",
        reason: sanitizeUnexpectedRowError(error),
        raw: buildFailureRawRow(row),
      });
    }
  });

  return {
    acceptedRows,
    failures,
    validCount,
    failedCount,
    skippedCount,
  };
}

async function loadPricingContext(args: {
  category: string;
  rows: PreparedBulkDetailsRow[];
}) {
  await dbConnect();

  const skus = uniqueStrings(
    args.rows.map((row) => normalizeSku(row?.A)).filter(Boolean)
  );

  const courseCodes = uniqueStrings(
    args.rows
      .flatMap((row) => splitCourseCodes(safeStr(row?.E)))
      .filter(Boolean)
  );

  const [overridesRaw, courseRulesRaw] = await Promise.all([
    skus.length
      ? ProductPricingRule.find({
          ruleType: "product_override",
          isActive: true,
          productSku: { $in: skus },
        })
          .sort({ updatedAt: -1, _id: -1 })
          .lean()
      : [],
    courseCodes.length
      ? ProductPricingRule.find({
          ruleType: "course_rule",
          isActive: true,
          category: args.category,
          courseCode: { $in: courseCodes },
        })
          .sort({ updatedAt: -1, _id: -1 })
          .lean()
      : [],
  ]);

  const overrideBySku = new Map<string, any>();
  const courseRuleByCode = new Map<string, any>();

  for (const rule of Array.isArray(overridesRaw) ? overridesRaw : []) {
    const sku = normalizeSku(rule?.productSku);
    if (sku && !overrideBySku.has(sku)) {
      overrideBySku.set(sku, rule);
    }
  }

  for (const rule of Array.isArray(courseRulesRaw) ? courseRulesRaw : []) {
    const code = safeStr(rule?.courseCode).toUpperCase();
    if (code && !courseRuleByCode.has(code)) {
      courseRuleByCode.set(code, rule);
    }
  }

  return {
    overrideBySku,
    courseRuleByCode,
  } as PricingContext;
}

function resolvePricingForRow(args: {
  pricingContext: PricingContext;
  sku: string;
  courseCodeList: string[];
}) {
  const overrideRule = args.pricingContext.overrideBySku.get(args.sku);
  if (overrideRule) {
    return {
      ok: true,
      source: "product_override",
      price: Math.max(0, safeNum(overrideRule?.price, 0)),
      oldPrice: Math.max(0, safeNum(overrideRule?.oldPrice, 0)),
    };
  }

  for (const code of args.courseCodeList) {
    const courseRule = args.pricingContext.courseRuleByCode.get(code);
    if (courseRule) {
      return {
        ok: true,
        source: "course_rule",
        price: Math.max(0, safeNum(courseRule?.price, 0)),
        oldPrice: Math.max(0, safeNum(courseRule?.oldPrice, 0)),
      };
    }
  }

  return {
    ok: false,
    source: "not_found",
    price: 0,
    oldPrice: 0,
  };
}

async function buildPricingValidationChunk(args: {
  rows: PreparedBulkDetailsRow[];
  startIndex: number;
  config: BulkDetailsJobConfig;
  subjectMap: Map<string, any>;
  courseMap: Map<string, any>;
  pricingContext: PricingContext;
  batchNumber: number;
}): Promise<ChunkValidationResult<PreparedExecutionRow>> {
  const failures: BulkDetailsBatchProcessResult["failures"] = [];
  const acceptedRows: PreparedExecutionRow[] = [];

  const allTemplates = [
    args.config.titleTemplate,
    args.config.importantNoteTemplate,
    args.config.shortDescTemplate,
    args.config.longDescTemplate,
    args.config.slugTemplate,
    args.config.metaTitleTemplate,
    args.config.metaDescriptionTemplate,
  ];

  let validCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  args.rows.forEach((row, localIndex) => {
    const itemIndex = args.startIndex + localIndex;
    const rowNumber = safeNum(row?.rowNumber, itemIndex + 1);
    const sku = normalizeSku(row?.A);
    const subjectCodeRaw = safeStr(row?.B);
    const session = safeStr(row?.C);
    const language = safeStr(row?.D);
    const courseCodeRaw = safeStr(row?.E);

    try {
      const subjectCodeLoose = normalizeSubjectCodeLoose(subjectCodeRaw);
      const subjectDoc = args.subjectMap.get(subjectCodeLoose);
      const courseCodeList = splitCourseCodes(courseCodeRaw);

      if (!subjectDoc || !courseCodeList.length) {
        failedCount++;
        pushFailureRow(failures, {
          itemIndex,
          rowNumber,
          batchNumber: args.batchNumber,
          identifier: sku || subjectCodeRaw || `row-${rowNumber}`,
          sku,
          status: "failed",
          reason: "Pricing stage input invalid. Previous validation output mismatch.",
          raw: buildFailureRawRow(row),
        });
        return;
      }

      const courseTitles: string[] = [];
      for (const oneCode of courseCodeList) {
        const courseDoc = args.courseMap.get(normalizeCourseCodeLoose(oneCode));
        if (courseDoc) {
          courseTitles.push(getCourseTitle(courseDoc));
        }
      }

      const normalizedCourseTitles = uniqueStrings(courseTitles.filter(Boolean));
      const joinedCourseTitles = normalizedCourseTitles.join(", ");

      const { subjectTitleHi, subjectTitleEn, subjectTitleOther } =
        getSubjectTitle(subjectDoc);
      const matchedSubjectTitle = getMatchedSubjectTitleForLanguage(
        subjectDoc,
        language
      );

      const templateWarnings = buildTemplateWarnings({
        allTemplates,
        matchedSubjectTitle,
        joinedCourseTitles,
      });

      const pricingResolution = resolvePricingForRow({
        pricingContext: args.pricingContext,
        sku,
        courseCodeList,
      });

      if (!pricingResolution.ok || Number(pricingResolution.price) <= 0) {
        failedCount++;
        pushFailureRow(failures, {
          itemIndex,
          rowNumber,
          batchNumber: args.batchNumber,
          identifier: sku || subjectCodeRaw || `row-${rowNumber}`,
          sku,
          status: "failed",
          reason:
            "Pricing rule not found. Pehle Product Pricing page me category + course rule ya product override set karo.",
          raw: buildFailureRawRow(row),
        });
        return;
      }

      acceptedRows.push({
        itemIndex,
        rowNumber,
        sku,
        subjectCodeRaw,
        session,
        session6: normalizeSession6(session),
        language,
        lang3: normalizeLang3(language),
        courseCodeList,
        courseTitles: normalizedCourseTitles,
        joinedCourseTitles,
        subjectTitleHi,
        subjectTitleEn,
        subjectTitleOther,
        matchedSubjectTitle,
        price: Math.max(0, safeNum(pricingResolution.price, 0)),
        oldPrice: Math.max(0, safeNum(pricingResolution.oldPrice, 0)),
        pricingSource: safeStr(pricingResolution.source),
        templateWarnings,
      });

      validCount++;
    } catch (error: any) {
      failedCount++;
      pushFailureRow(failures, {
        itemIndex,
        rowNumber,
        batchNumber: args.batchNumber,
        identifier: sku || subjectCodeRaw || `row-${rowNumber}`,
        sku,
        status: "failed",
        reason: sanitizeUnexpectedRowError(error),
        raw: buildFailureRawRow(row),
      });
    }
  });

  return {
    acceptedRows,
    failures,
    validCount,
    failedCount,
    skippedCount,
  };
}

async function loadExistingProductsForExecution(
  executionRows: PreparedExecutionRow[]
) {
  await dbConnect();

  const skus = uniqueStrings(
    executionRows
      .map((row: PreparedExecutionRow) => normalizeSku(row?.sku))
      .filter((sku: string) => Boolean(sku))
  );

  if (!skus.length) {
    return new Map<string, any>();
  }

  const docs: any[] = await Product.find({
    sku: { $in: skus },
    deletedAt: null,
  })
    .select(PRODUCT_EXECUTION_SELECT)
    .lean();

  const out = new Map<string, any>();
  for (const doc of docs) {
    const sku = normalizeSku(doc?.sku);
    if (sku) {
      out.set(sku, doc);
    }
  }

  return out;
}

function buildProductPayload(config: BulkDetailsJobConfig, row: PreparedExecutionRow) {
  const tokenRow = {
    A: row.sku,
    B: row.subjectCodeRaw,
    C: row.session,
    D: row.language,
    E: row.courseCodeList.join(", "),
    F: row.matchedSubjectTitle,
    G: row.joinedCourseTitles,
    H: "",
  };

  const title = replaceTokens(config.titleTemplate, tokenRow);
  const slugSeed = config.slugTemplate
    ? replaceTokens(config.slugTemplate, tokenRow)
    : title;

  return {
    title,
    slugBase: buildDeterministicSlug(slugSeed || title, row.sku),
    importantNote: replaceTokens(config.importantNoteTemplate, tokenRow),
    shortDesc: replaceTokens(config.shortDescTemplate, tokenRow),
    descriptionHtml: replaceTokens(config.longDescTemplate, tokenRow),
    metaTitle: replaceTokens(config.metaTitleTemplate, tokenRow),
    metaDescription: replaceTokens(config.metaDescriptionTemplate, tokenRow),
  };
}

function getDetailedStage(jobLike: any): BulkDetailsDetailedStage {
  const stage = safeStr(jobLike?.summary?.pipelineStage).toLowerCase();

  if (
    stage === "sku_scan" ||
    stage === "course_validation" ||
    stage === "session_validation" ||
    stage === "subject_validation" ||
    stage === "pricing_validation" ||
    stage === "execution" ||
    stage === "completed"
  ) {
    return stage as BulkDetailsDetailedStage;
  }

  return "sku_scan";
}

export function getBulkDetailsDetailedStage(jobLike: any) {
  return getDetailedStage(jobLike);
}

export function getBulkDetailsPipelineStage(
  jobLike: any
): BulkDetailsPipelineStage {
  const stage = getDetailedStage(jobLike);
  if (stage === "execution") return "execution";
  if (stage === "completed") return "completed";
  return "prevalidation";
}

function buildNextStageLabel(stage: BulkDetailsDetailedStage) {
  if (stage === "sku_scan") return "Unique SKU Scan";
  if (stage === "course_validation") return "Master Course Validation";
  if (stage === "session_validation") return "Master Session Validation";
  if (stage === "subject_validation") return "Master Subject Validation";
  if (stage === "pricing_validation") return "Pricing Validation";
  if (stage === "execution") return "Final Product Upload/Create";
  return "Completed";
}

export async function processBulkDetailsJobBatch(args: {
  job: any;
  batchNumber: number;
  fromIndex: number;
  toIndex: number;
}) {
  await dbConnect();

  const job = args.job;
  const config = normalizeBulkDetailsConfig(job?.config || {});
  validateBulkDetailsConfig(config);

  const summary = cloneRecord(job?.summary || {});
  const detailedStage = getDetailedStage(job);

  const rawRows: PreparedBulkDetailsRow[] = Array.isArray(job?.input?.rows)
    ? job.input.rows
    : [];
  const stageRows: PreparedBulkDetailsRow[] = Array.isArray(job?.input?.stageRows)
    ? job.input.stageRows
    : rawRows;
  const stageCursor = Math.max(0, safeNum(job?.input?.stageCursor, 0));
  const nextStageRows: PreparedBulkDetailsRow[] = Array.isArray(job?.input?.nextStageRows)
    ? job.input.nextStageRows
    : [];
  const executionRows: PreparedExecutionRow[] = Array.isArray(job?.input?.executionRows)
    ? job.input.executionRows
    : [];

  const failures: BulkDetailsBatchProcessResult["failures"] = [];

  const master = await getMasterDataCache(false);
  const subjectMap = master.subjectMap;
  const courseMap = master.courseMap;
  const sessionAllowed = getSessionAllowedForCategory(master, config.category);

  if (detailedStage === "sku_scan") {
    const result = await buildSkuScanResult(rawRows, args.batchNumber);
    failures.push(...result.failures);

    await persistJobInput(job, {
      stageRows: result.remainingRows,
      stageCursor: 0,
      nextStageRows: [],
      executionRows: [],
    });

    const skuScan = {
      ...getStageBlock(summary, "skuScan", rawRows.length, {
        duplicateRows: 0,
        remainingRows: rawRows.length,
        siteDuplicateRows: 0,
        sheetDuplicateRows: 0,
      }),
      totalRows: rawRows.length,
      processedRows: rawRows.length,
      validRows: result.validCount,
      failedRows: result.failedCount,
      skippedRows: result.skippedCount,
      duplicateRows: result.duplicateRows,
      remainingRows: result.remainingRows.length,
      siteDuplicateRows: result.siteDuplicateRows,
      sheetDuplicateRows: result.sheetDuplicateRows,
      startedAt: summary?.skuScan?.startedAt || new Date().toISOString(),
      completedAt: new Date().toISOString(),
      lastNote: `Unique SKU scan complete. Remaining valid rows ${result.remainingRows.length}, site duplicate skipped ${result.siteDuplicateRows}, sheet duplicate skipped ${result.sheetDuplicateRows}, failed ${result.failedCount}.`,
    };

    const courseValidation = {
      ...getStageBlock(summary, "courseValidation", result.remainingRows.length),
      totalRows: result.remainingRows.length,
    };

    const nextSummary = {
      ...summary,
      totalRows: rawRows.length,
      validRows: result.remainingRows.length,
      failedRows: safeNum(summary.failedRows, 0) + result.failedCount,
      skippedRows: safeNum(summary.skippedRows, 0) + result.skippedCount,
      pipelineStage: "course_validation",
      stageLabel: buildNextStageLabel("course_validation"),
      nextStageTotalItems: result.remainingRows.length,
      skuScan,
      courseValidation,
    };

    return {
      processedDelta: rawRows.length,
      successDelta: 0,
      failedDelta: result.failedCount,
      skippedDelta: result.skippedCount,
      validDelta: 0,
      nextLastProcessedIndex: Math.max(-1, rawRows.length - 1),
      batchNumber: args.batchNumber,
      fromIndex: 0,
      toIndex: Math.max(-1, rawRows.length - 1),
      attempted: rawRows.length,
      failures,
      summaryPatch: nextSummary,
      note: skuScan.lastNote,
    } as BulkDetailsBatchProcessResult;
  }

  if (detailedStage === "course_validation") {
    const chunkInfo = getChunkInfo(
      stageRows,
      stageCursor,
      PREVALIDATION_STAGE_CHUNK_SIZE
    );

    const result = buildCourseValidationChunk({
      rows: chunkInfo.chunkRows,
      startIndex: chunkInfo.cursor,
      batchNumber: args.batchNumber,
      courseMap,
    });

    failures.push(...result.failures);

    const accumulatedNextRows = [...nextStageRows, ...result.acceptedRows];
    const courseValidation = {
      ...getStageBlock(summary, "courseValidation", stageRows.length),
      totalRows: stageRows.length,
      processedRows:
        safeNum(summary?.courseValidation?.processedRows, 0) + chunkInfo.chunkRows.length,
      validRows: safeNum(summary?.courseValidation?.validRows, 0) + result.validCount,
      failedRows: safeNum(summary?.courseValidation?.failedRows, 0) + result.failedCount,
      skippedRows: safeNum(summary?.courseValidation?.skippedRows, 0) + result.skippedCount,
      startedAt: summary?.courseValidation?.startedAt || new Date().toISOString(),
      completedAt: chunkInfo.isDone ? new Date().toISOString() : null,
      lastNote: chunkInfo.isDone
        ? `Master course validation complete. Remaining valid rows ${accumulatedNextRows.length}, failed ${safeNum(summary?.courseValidation?.failedRows, 0) + result.failedCount}.`
        : `Master course validation running: ${chunkInfo.nextCursor}/${stageRows.length} rows checked. Valid till now ${accumulatedNextRows.length}.`,
    };

    if (chunkInfo.isDone) {
      await persistJobInput(job, {
        stageRows: accumulatedNextRows,
        stageCursor: 0,
        nextStageRows: [],
      });

      const sessionValidation = {
        ...getStageBlock(summary, "sessionValidation", accumulatedNextRows.length),
        totalRows: accumulatedNextRows.length,
      };

      const nextSummary = {
        ...summary,
        validRows: accumulatedNextRows.length,
        failedRows: safeNum(summary.failedRows, 0) + result.failedCount,
        skippedRows: safeNum(summary.skippedRows, 0) + result.skippedCount,
        pipelineStage: "session_validation",
        stageLabel: buildNextStageLabel("session_validation"),
        nextStageTotalItems: accumulatedNextRows.length,
        courseValidation,
        sessionValidation,
      };

      return {
        processedDelta: chunkInfo.chunkRows.length,
        successDelta: 0,
        failedDelta: result.failedCount,
        skippedDelta: result.skippedCount,
        validDelta: 0,
        nextLastProcessedIndex: Math.max(-1, chunkInfo.nextCursor - 1),
        batchNumber: args.batchNumber,
        fromIndex: chunkInfo.cursor,
        toIndex: Math.max(-1, chunkInfo.nextCursor - 1),
        attempted: chunkInfo.chunkRows.length,
        failures,
        summaryPatch: nextSummary,
        note: courseValidation.lastNote,
      } as BulkDetailsBatchProcessResult;
    }

    await persistJobInput(job, {
      stageRows,
      stageCursor: chunkInfo.nextCursor,
      nextStageRows: accumulatedNextRows,
    });

    const nextSummary = {
      ...summary,
      validRows: accumulatedNextRows.length,
      failedRows: safeNum(summary.failedRows, 0) + result.failedCount,
      skippedRows: safeNum(summary.skippedRows, 0) + result.skippedCount,
      pipelineStage: "course_validation",
      stageLabel: buildNextStageLabel("course_validation"),
      nextStageTotalItems: stageRows.length,
      courseValidation,
    };

    return {
      processedDelta: chunkInfo.chunkRows.length,
      successDelta: 0,
      failedDelta: result.failedCount,
      skippedDelta: result.skippedCount,
      validDelta: 0,
      nextLastProcessedIndex: Math.max(-1, chunkInfo.nextCursor - 1),
      batchNumber: args.batchNumber,
      fromIndex: chunkInfo.cursor,
      toIndex: Math.max(-1, chunkInfo.nextCursor - 1),
      attempted: chunkInfo.chunkRows.length,
      failures,
      summaryPatch: nextSummary,
      note: courseValidation.lastNote,
    } as BulkDetailsBatchProcessResult;
  }

  if (detailedStage === "session_validation") {
    const chunkInfo = getChunkInfo(
      stageRows,
      stageCursor,
      PREVALIDATION_STAGE_CHUNK_SIZE
    );

    const result = buildSessionValidationChunk({
      rows: chunkInfo.chunkRows,
      startIndex: chunkInfo.cursor,
      batchNumber: args.batchNumber,
      sessionAllowed,
    });

    failures.push(...result.failures);

    const accumulatedNextRows = [...nextStageRows, ...result.acceptedRows];
    const sessionValidation = {
      ...getStageBlock(summary, "sessionValidation", stageRows.length),
      totalRows: stageRows.length,
      processedRows:
        safeNum(summary?.sessionValidation?.processedRows, 0) + chunkInfo.chunkRows.length,
      validRows: safeNum(summary?.sessionValidation?.validRows, 0) + result.validCount,
      failedRows: safeNum(summary?.sessionValidation?.failedRows, 0) + result.failedCount,
      skippedRows: safeNum(summary?.sessionValidation?.skippedRows, 0) + result.skippedCount,
      startedAt: summary?.sessionValidation?.startedAt || new Date().toISOString(),
      completedAt: chunkInfo.isDone ? new Date().toISOString() : null,
      lastNote: chunkInfo.isDone
        ? `Master session validation complete. Remaining valid rows ${accumulatedNextRows.length}, failed ${safeNum(summary?.sessionValidation?.failedRows, 0) + result.failedCount}.`
        : `Master session validation running: ${chunkInfo.nextCursor}/${stageRows.length} rows checked. Valid till now ${accumulatedNextRows.length}.`,
    };

    if (chunkInfo.isDone) {
      await persistJobInput(job, {
        stageRows: accumulatedNextRows,
        stageCursor: 0,
        nextStageRows: [],
      });

      const subjectValidation = {
        ...getStageBlock(summary, "subjectValidation", accumulatedNextRows.length),
        totalRows: accumulatedNextRows.length,
      };

      const nextSummary = {
        ...summary,
        validRows: accumulatedNextRows.length,
        failedRows: safeNum(summary.failedRows, 0) + result.failedCount,
        skippedRows: safeNum(summary.skippedRows, 0) + result.skippedCount,
        pipelineStage: "subject_validation",
        stageLabel: buildNextStageLabel("subject_validation"),
        nextStageTotalItems: accumulatedNextRows.length,
        sessionValidation,
        subjectValidation,
      };

      return {
        processedDelta: chunkInfo.chunkRows.length,
        successDelta: 0,
        failedDelta: result.failedCount,
        skippedDelta: result.skippedCount,
        validDelta: 0,
        nextLastProcessedIndex: Math.max(-1, chunkInfo.nextCursor - 1),
        batchNumber: args.batchNumber,
        fromIndex: chunkInfo.cursor,
        toIndex: Math.max(-1, chunkInfo.nextCursor - 1),
        attempted: chunkInfo.chunkRows.length,
        failures,
        summaryPatch: nextSummary,
        note: sessionValidation.lastNote,
      } as BulkDetailsBatchProcessResult;
    }

    await persistJobInput(job, {
      stageRows,
      stageCursor: chunkInfo.nextCursor,
      nextStageRows: accumulatedNextRows,
    });

    const nextSummary = {
      ...summary,
      validRows: accumulatedNextRows.length,
      failedRows: safeNum(summary.failedRows, 0) + result.failedCount,
      skippedRows: safeNum(summary.skippedRows, 0) + result.skippedCount,
      pipelineStage: "session_validation",
      stageLabel: buildNextStageLabel("session_validation"),
      nextStageTotalItems: stageRows.length,
      sessionValidation,
    };

    return {
      processedDelta: chunkInfo.chunkRows.length,
      successDelta: 0,
      failedDelta: result.failedCount,
      skippedDelta: result.skippedCount,
      validDelta: 0,
      nextLastProcessedIndex: Math.max(-1, chunkInfo.nextCursor - 1),
      batchNumber: args.batchNumber,
      fromIndex: chunkInfo.cursor,
      toIndex: Math.max(-1, chunkInfo.nextCursor - 1),
      attempted: chunkInfo.chunkRows.length,
      failures,
      summaryPatch: nextSummary,
      note: sessionValidation.lastNote,
    } as BulkDetailsBatchProcessResult;
  }

  if (detailedStage === "subject_validation") {
    const chunkInfo = getChunkInfo(
      stageRows,
      stageCursor,
      PREVALIDATION_STAGE_CHUNK_SIZE
    );

    const result = buildSubjectValidationChunk({
      rows: chunkInfo.chunkRows,
      startIndex: chunkInfo.cursor,
      batchNumber: args.batchNumber,
      subjectMap,
    });

    failures.push(...result.failures);

    const accumulatedNextRows = [...nextStageRows, ...result.acceptedRows];
    const subjectValidation = {
      ...getStageBlock(summary, "subjectValidation", stageRows.length),
      totalRows: stageRows.length,
      processedRows:
        safeNum(summary?.subjectValidation?.processedRows, 0) + chunkInfo.chunkRows.length,
      validRows: safeNum(summary?.subjectValidation?.validRows, 0) + result.validCount,
      failedRows: safeNum(summary?.subjectValidation?.failedRows, 0) + result.failedCount,
      skippedRows: safeNum(summary?.subjectValidation?.skippedRows, 0) + result.skippedCount,
      startedAt: summary?.subjectValidation?.startedAt || new Date().toISOString(),
      completedAt: chunkInfo.isDone ? new Date().toISOString() : null,
      lastNote: chunkInfo.isDone
        ? `Master subject validation complete. Remaining valid rows ${accumulatedNextRows.length}, failed ${safeNum(summary?.subjectValidation?.failedRows, 0) + result.failedCount}.`
        : `Master subject validation running: ${chunkInfo.nextCursor}/${stageRows.length} rows checked. Valid till now ${accumulatedNextRows.length}.`,
    };

    if (chunkInfo.isDone) {
      await persistJobInput(job, {
        stageRows: accumulatedNextRows,
        stageCursor: 0,
        nextStageRows: [],
        executionRows: [],
      });

      const pricingValidation = {
        ...getStageBlock(summary, "pricingValidation", accumulatedNextRows.length),
        totalRows: accumulatedNextRows.length,
      };

      const nextSummary = {
        ...summary,
        validRows: accumulatedNextRows.length,
        failedRows: safeNum(summary.failedRows, 0) + result.failedCount,
        skippedRows: safeNum(summary.skippedRows, 0) + result.skippedCount,
        pipelineStage: "pricing_validation",
        stageLabel: buildNextStageLabel("pricing_validation"),
        nextStageTotalItems: accumulatedNextRows.length,
        subjectValidation,
        pricingValidation,
      };

      return {
        processedDelta: chunkInfo.chunkRows.length,
        successDelta: 0,
        failedDelta: result.failedCount,
        skippedDelta: result.skippedCount,
        validDelta: 0,
        nextLastProcessedIndex: Math.max(-1, chunkInfo.nextCursor - 1),
        batchNumber: args.batchNumber,
        fromIndex: chunkInfo.cursor,
        toIndex: Math.max(-1, chunkInfo.nextCursor - 1),
        attempted: chunkInfo.chunkRows.length,
        failures,
        summaryPatch: nextSummary,
        note: subjectValidation.lastNote,
      } as BulkDetailsBatchProcessResult;
    }

    await persistJobInput(job, {
      stageRows,
      stageCursor: chunkInfo.nextCursor,
      nextStageRows: accumulatedNextRows,
    });

    const nextSummary = {
      ...summary,
      validRows: accumulatedNextRows.length,
      failedRows: safeNum(summary.failedRows, 0) + result.failedCount,
      skippedRows: safeNum(summary.skippedRows, 0) + result.skippedCount,
      pipelineStage: "subject_validation",
      stageLabel: buildNextStageLabel("subject_validation"),
      nextStageTotalItems: stageRows.length,
      subjectValidation,
    };

    return {
      processedDelta: chunkInfo.chunkRows.length,
      successDelta: 0,
      failedDelta: result.failedCount,
      skippedDelta: result.skippedCount,
      validDelta: 0,
      nextLastProcessedIndex: Math.max(-1, chunkInfo.nextCursor - 1),
      batchNumber: args.batchNumber,
      fromIndex: chunkInfo.cursor,
      toIndex: Math.max(-1, chunkInfo.nextCursor - 1),
      attempted: chunkInfo.chunkRows.length,
      failures,
      summaryPatch: nextSummary,
      note: subjectValidation.lastNote,
    } as BulkDetailsBatchProcessResult;
  }

  if (detailedStage === "pricing_validation") {
    const pricingContext =
      job?.input?.pricingContext &&
      typeof job.input.pricingContext === "object" &&
      !Array.isArray(job.input.pricingContext)
        ? {
            overrideBySku: new Map<string, any>(job.input.pricingContext.overrideBySku || []),
            courseRuleByCode: new Map<string, any>(job.input.pricingContext.courseRuleByCode || []),
          }
        : await loadPricingContext({
            category: config.category,
            rows: stageRows,
          });

    if (
      !job?.input?.pricingContext ||
      typeof job.input.pricingContext !== "object" ||
      Array.isArray(job.input.pricingContext)
    ) {
      await persistJobInput(job, {
        pricingContext: {
          overrideBySku: Array.from(pricingContext.overrideBySku.entries()),
          courseRuleByCode: Array.from(pricingContext.courseRuleByCode.entries()),
        },
      });
    }

    const chunkInfo = getChunkInfo(
      stageRows,
      stageCursor,
      PREVALIDATION_STAGE_CHUNK_SIZE
    );

    const result = await buildPricingValidationChunk({
      rows: chunkInfo.chunkRows,
      startIndex: chunkInfo.cursor,
      config,
      subjectMap,
      courseMap,
      pricingContext,
      batchNumber: args.batchNumber,
    });

    failures.push(...result.failures);

    const accumulatedExecutionRows = [...executionRows, ...result.acceptedRows];
    const pricingValidation = {
      ...getStageBlock(summary, "pricingValidation", stageRows.length),
      totalRows: stageRows.length,
      processedRows:
        safeNum(summary?.pricingValidation?.processedRows, 0) + chunkInfo.chunkRows.length,
      validRows: safeNum(summary?.pricingValidation?.validRows, 0) + result.validCount,
      failedRows: safeNum(summary?.pricingValidation?.failedRows, 0) + result.failedCount,
      skippedRows: safeNum(summary?.pricingValidation?.skippedRows, 0) + result.skippedCount,
      startedAt: summary?.pricingValidation?.startedAt || new Date().toISOString(),
      completedAt: chunkInfo.isDone ? new Date().toISOString() : null,
      lastNote: chunkInfo.isDone
        ? `Pricing validation complete. Valid rows for final upload/create ${accumulatedExecutionRows.length}, failed ${safeNum(summary?.pricingValidation?.failedRows, 0) + result.failedCount}.`
        : `Pricing validation running: ${chunkInfo.nextCursor}/${stageRows.length} rows checked. Ready for final upload/create till now ${accumulatedExecutionRows.length}.`,
    };

    if (chunkInfo.isDone) {
      await persistJobInput(job, {
        stageRows: [],
        stageCursor: 0,
        nextStageRows: [],
        executionRows: accumulatedExecutionRows,
        pricingContext: null,
      });

      const execution = {
        ...(summary?.execution && typeof summary.execution === "object"
          ? summary.execution
          : buildExecutionBlock(accumulatedExecutionRows.length)),
        totalRows: accumulatedExecutionRows.length,
      };

      const nextSummary = {
        ...summary,
        validRows: accumulatedExecutionRows.length,
        failedRows: safeNum(summary.failedRows, 0) + result.failedCount,
        skippedRows: safeNum(summary.skippedRows, 0) + result.skippedCount,
        pipelineStage: "execution",
        stageLabel: buildNextStageLabel("execution"),
        nextStageTotalItems: accumulatedExecutionRows.length,
        pricingValidation,
        execution,
      };

      return {
        processedDelta: chunkInfo.chunkRows.length,
        successDelta: 0,
        failedDelta: result.failedCount,
        skippedDelta: result.skippedCount,
        validDelta: 0,
        nextLastProcessedIndex: Math.max(-1, chunkInfo.nextCursor - 1),
        batchNumber: args.batchNumber,
        fromIndex: chunkInfo.cursor,
        toIndex: Math.max(-1, chunkInfo.nextCursor - 1),
        attempted: chunkInfo.chunkRows.length,
        failures,
        summaryPatch: nextSummary,
        note: pricingValidation.lastNote,
      } as BulkDetailsBatchProcessResult;
    }

    await persistJobInput(job, {
      stageRows,
      stageCursor: chunkInfo.nextCursor,
      executionRows: accumulatedExecutionRows,
    });

    const nextSummary = {
      ...summary,
      validRows: accumulatedExecutionRows.length,
      failedRows: safeNum(summary.failedRows, 0) + result.failedCount,
      skippedRows: safeNum(summary.skippedRows, 0) + result.skippedCount,
      pipelineStage: "pricing_validation",
      stageLabel: buildNextStageLabel("pricing_validation"),
      nextStageTotalItems: stageRows.length,
      pricingValidation,
    };

    return {
      processedDelta: chunkInfo.chunkRows.length,
      successDelta: 0,
      failedDelta: result.failedCount,
      skippedDelta: result.skippedCount,
      validDelta: 0,
      nextLastProcessedIndex: Math.max(-1, chunkInfo.nextCursor - 1),
      batchNumber: args.batchNumber,
      fromIndex: chunkInfo.cursor,
      toIndex: Math.max(-1, chunkInfo.nextCursor - 1),
      attempted: chunkInfo.chunkRows.length,
      failures,
      summaryPatch: nextSummary,
      note: pricingValidation.lastNote,
    } as BulkDetailsBatchProcessResult;
  }

  const executionInputRows: PreparedExecutionRow[] = executionRows;
  const requestedChunkSize = Math.max(
    1,
    safeNum(args.toIndex, 0) - safeNum(args.fromIndex, 0) + 1
  );
  const startIndex = Math.max(0, args.fromIndex);
  const endIndex = Math.min(
    executionInputRows.length - 1,
    startIndex + requestedChunkSize - 1
  );
  const batchExecutionRows =
    startIndex <= endIndex
      ? executionInputRows.slice(startIndex, endIndex + 1)
      : [];

  const existingBySku = await loadExistingProductsForExecution(batchExecutionRows);

  let createdRows = 0;
  let updatedRows = 0;
  let failedRows = 0;
  let skippedRows = 0;

  for (const row of batchExecutionRows) {
    try {
      const generated = buildProductPayload(config, row);
      const existing = existingBySku.get(row.sku) || null;

      if (config.dryRun) {
        skippedRows++;
        pushFailureRow(failures, {
          itemIndex: row.itemIndex,
          rowNumber: row.rowNumber,
          batchNumber: args.batchNumber,
          identifier: row.sku || row.subjectCodeRaw,
          sku: row.sku,
          status: "skipped",
          reason: "Dry run active hai. Final product create/update skip ki gayi.",
          raw: buildFailureRawExecutionRow(row),
        });
        continue;
      }

      const payload: any = {
        title: generated.title,
        sku: row.sku,
        category: config.category,

        subjectCode: row.subjectCodeRaw,
        subjectTitleHi: row.subjectTitleHi,
        subjectTitleEn: row.subjectTitleEn,
        subjectTitleOther: row.subjectTitleOther,

        courseCodes: row.courseCodeList,
        courseTitles: row.courseTitles,

        session: row.session,
        session6: row.session6,
        language: row.language,
        lang3: row.lang3,

        price: Math.max(0, safeNum(row.price, 0)),
        oldPrice: Math.max(0, safeNum(row.oldPrice, 0)),

        availability: "want_to_buy",
        importantNote: generated.importantNote,

        shortDesc: generated.shortDesc,
        descriptionHtml: generated.descriptionHtml,

        isDigital: deriveIsDigitalFromCategory(config.category),

        metaTitle: generated.metaTitle,
        metaDescription: generated.metaDescription,

        isAutoGenerated: false,
        autoGenerationType: "",
        autoGeneratedFromProductId: null,
        autoGeneratedFromSku: "",
        autoGeneratedFromCategory: "",
        autoGeneratedAt: null,

        isActive: config.publishNow,
        lastModifiedAt: new Date(),

        deletedAt: null,
        deletedBy: "",
      };

      if (existing) {
        if (config.duplicateStrategy === "ignore") {
          skippedRows++;
          pushFailureRow(failures, {
            itemIndex: row.itemIndex,
            rowNumber: row.rowNumber,
            batchNumber: args.batchNumber,
            identifier: row.sku || row.subjectCodeRaw,
            sku: row.sku,
            status: "skipped",
            reason:
              "Execution stage me duplicate live product mila. Row ignored.",
            raw: buildFailureRawExecutionRow(row),
          });
          continue;
        }

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

        await Product.updateOne(
          { _id: existing._id },
          {
            $set: {
              ...payload,
              ...preservedMedia,
              ...preservedDemandConfig,
              slug: generated.slugBase,
            },
          }
        );

        updatedRows++;
        continue;
      }

      await Product.create({
        ...payload,
        slug: generated.slugBase,
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

      createdRows++;
    } catch (error: any) {
      failedRows++;
      pushFailureRow(failures, {
        itemIndex: row.itemIndex,
        rowNumber: row.rowNumber,
        batchNumber: args.batchNumber,
        identifier: row.sku || row.subjectCodeRaw,
        sku: row.sku,
        status: "failed",
        reason: buildExecutionErrorReason(error),
        raw: buildFailureRawExecutionRow(row),
      });
    }
  }

  const execution = {
    ...(summary?.execution && typeof summary.execution === "object"
      ? summary.execution
      : buildExecutionBlock(executionInputRows.length)),
    totalRows: safeNum(summary?.execution?.totalRows, executionInputRows.length),
    processedRows:
      safeNum(summary?.execution?.processedRows, 0) + batchExecutionRows.length,
    createdRows: safeNum(summary?.execution?.createdRows, 0) + createdRows,
    updatedRows: safeNum(summary?.execution?.updatedRows, 0) + updatedRows,
    skippedRows: safeNum(summary?.execution?.skippedRows, 0) + skippedRows,
    failedRows: safeNum(summary?.execution?.failedRows, 0) + failedRows,
    successRows:
      safeNum(summary?.execution?.successRows, 0) + createdRows + updatedRows,
    startedAt: summary?.execution?.startedAt || new Date().toISOString(),
    completedAt:
      endIndex >= executionInputRows.length - 1 ? new Date().toISOString() : null,
    lastNote:
      endIndex >= executionInputRows.length - 1
        ? `Final product upload/create complete. Created ${safeNum(summary?.execution?.createdRows, 0) + createdRows}, Updated ${safeNum(summary?.execution?.updatedRows, 0) + updatedRows}, Skipped ${safeNum(summary?.execution?.skippedRows, 0) + skippedRows}, Failed ${safeNum(summary?.execution?.failedRows, 0) + failedRows}.`
        : `Final product upload/create running: ${Math.min(
            executionInputRows.length,
            safeNum(summary?.execution?.processedRows, 0) + batchExecutionRows.length
          )}/${executionInputRows.length} rows processed. Created ${safeNum(summary?.execution?.createdRows, 0) + createdRows}, Updated ${safeNum(summary?.execution?.updatedRows, 0) + updatedRows}.`,
  };

  const nextSummary = {
    ...summary,
    createdRows: safeNum(summary.createdRows, 0) + createdRows,
    updatedRows: safeNum(summary.updatedRows, 0) + updatedRows,
    skippedRows: safeNum(summary.skippedRows, 0) + skippedRows,
    failedRows: safeNum(summary.failedRows, 0) + failedRows,
    pipelineStage:
      endIndex >= executionInputRows.length - 1 ? "completed" : "execution",
    stageLabel: buildNextStageLabel(
      endIndex >= executionInputRows.length - 1 ? "completed" : "execution"
    ),
    nextStageTotalItems: 0,
    execution,
    comboSync: buildDeferredSyncPatch(summary?.comboSync, "Combo"),
    hardcopySync: buildDeferredSyncPatch(summary?.hardcopySync, "Hardcopy"),
  };

  return {
    processedDelta: batchExecutionRows.length,
    successDelta: createdRows + updatedRows,
    failedDelta: failedRows,
    skippedDelta: skippedRows,
    validDelta: 0,
    nextLastProcessedIndex: endIndex,
    batchNumber: args.batchNumber,
    fromIndex: startIndex,
    toIndex: endIndex,
    attempted: batchExecutionRows.length,
    failures,
    summaryPatch: nextSummary,
    note: execution.lastNote,
  } as BulkDetailsBatchProcessResult;
}