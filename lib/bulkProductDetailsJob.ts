import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import Subject from "@/models/Subject";
import Course from "@/models/Course";
import Session from "@/models/Session";
import { syncGeneratedCombosForProductChange } from "@/lib/comboAutoSync";
import { syncGeneratedHardcopyForProductChange } from "@/lib/hardcopyAutoSync";
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

export type PreparedBulkDetailsRow = {
  rowNumber: number;
  A: string; // unique_id / sku
  B: string; // subject_code
  C: string; // session
  D: string; // language
  E: string; // course_code
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

type SyncQueueItem = {
  before?: any | null;
  after?: any | null;
};

const MANUAL_HARDCOPY_BULK_BLOCK_MESSAGE =
  "Handwritten Hardcopy (Delivery) category ka manual bulk upload disabled hai. Ye products ab Solved Assignments se automatically generate honge.";

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

function getAvailabilityAfterSync(syncResult: any) {
  return safeStr(syncResult?.after?.availability || syncResult?.snapshot?.availability || "");
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

async function syncGeneratedHardcopiesForBulkChanges(changes: SyncQueueItem[]) {
  const errors: string[] = [];

  for (const change of changes) {
    try {
      const result: any = await syncGeneratedHardcopyForProductChange(change as any);

      if (result && result.ok === false) {
        const reason = safeStr(result.reason || result.error);
        if (reason) errors.push(reason);
      }
    } catch (e: any) {
      errors.push(safeStr(e?.message) || "Unknown hardcopy sync error");
    }
  }

  return {
    ok: errors.length === 0,
    errors: uniqueStrings(errors).slice(0, 10),
  };
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

  const rows: PreparedBulkDetailsRow[] = Array.isArray(job?.input?.rows) ? job.input.rows : [];
  const batchRows = rows.slice(args.fromIndex, args.toIndex + 1);

  const currentSummary = job?.summary || {};

  const comboSyncQueue: SyncQueueItem[] = [];
  const hardcopySyncQueue: SyncQueueItem[] = [];

  const [subjects, courses, sessions] = await Promise.all([
    Subject.find({ isActive: { $ne: false } }).lean(),
    Course.find({ isActive: { $ne: false } }).lean(),
    Session.find({ isActive: { $ne: false } })
      .select("name slug code title label categories")
      .lean(),
  ]);

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

  const categoryCandidates = categoryLabelToSessionSlugCandidates(config.category);
  const categoryCandidatesNormalized = new Set(
    categoryCandidates.flatMap((candidate) => {
      const cc = safeStr(candidate);
      const vals = [cc, cc.toLowerCase(), slugify(cc)].filter(Boolean);
      return vals;
    })
  );

  const sessionAllowed = new Set<string>();

  for (const s of sessions as any[]) {
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

  const isDigitalForCategory = deriveIsDigitalFromCategory(config.category);
  const allTemplates = [
    config.titleTemplate,
    config.importantNoteTemplate,
    config.shortDescTemplate,
    config.longDescTemplate,
    config.slugTemplate,
    config.metaTitleTemplate,
    config.metaDescriptionTemplate,
  ];

  let batchValidRows = 0;
  let batchCreatedRows = 0;
  let batchUpdatedRows = 0;
  let batchSkippedRows = 0;
  let batchFailedRows = 0;

  const failures: BulkDetailsBatchProcessResult["failures"] = [];

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
      const subjectCodeLoose = normalizeSubjectCodeLoose(subjectCodeRaw);
      const session = safeStr(row?.C);
      const language = safeStr(row?.D);
      const courseCodeRaw = safeStr(row?.E);

      if (!sku || !subjectCodeRaw || !session || !language || !courseCodeRaw) {
        batchFailedRows++;
        pushFailure("failed", "Required columns missing or invalid in this row");
        continue;
      }

      const courseCodeList = splitCourseCodes(courseCodeRaw);

      const subjectDoc = subjectMap.get(subjectCodeLoose);
      if (!subjectDoc) {
        batchFailedRows++;
        pushFailure("failed", `Subject not found in master subjects: ${subjectCodeRaw}`);
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
        pushFailure("failed", `Course not found in master courses: ${missingCourse.join(", ")}`);
        continue;
      }

      if (!sessionMatches(sessionAllowed, session)) {
        batchFailedRows++;
        pushFailure("failed", `Session not found in category-wise master sessions: ${session}`);
        continue;
      }

      const lang3 = normalizeLang3(language);
      const session6 = normalizeSession6(session);

      const { subjectTitleHi, subjectTitleEn, subjectTitleOther } = getSubjectTitle(subjectDoc);
      const matchedSubjectTitle = getMatchedSubjectTitleForLanguage(subjectDoc, language);
      const normalizedCourseTitles = uniqueStrings(courseTitles.filter(Boolean));
      const joinedCourseTitles = normalizedCourseTitles.join(", ");

      const tokenRow = {
        A: sku,
        B: subjectCodeRaw,
        C: session,
        D: language,
        E: courseCodeList.join(", "),
        F: matchedSubjectTitle,
        G: joinedCourseTitles,
        H: "",
      };

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

      const pricingResolution = await resolveRequiredProductPricing({
        category: config.category,
        courseCodes: courseCodeList,
        productSku: sku,
      });

      if (!pricingResolution.ok || Number(pricingResolution.price) <= 0) {
        batchFailedRows++;
        pushFailure(
          "failed",
          "Pricing rule not found. Pehle Product Pricing page me category + course rule ya product override set karo."
        );
        continue;
      }

      batchValidRows++;

      const existingMatchQuery = buildExistingProductMatchQuery(sku, normalizedSlugBase);
      const existing: any = existingMatchQuery
        ? await Product.findOne(existingMatchQuery)
        : null;

      const warningText = templateWarnings.length
        ? ` Warnings: ${templateWarnings.join(" | ")}.`
        : "";

      if (config.dryRun) {
        if (existing && config.duplicateStrategy === "ignore") {
          batchSkippedRows++;
          pushFailure(
            "skipped",
            `Duplicate मिला. Final create पर row skip होगी. Price auto from ${pricingResolution.source}.${warningText}`
          );
        }
        continue;
      }

      const payload: any = {
        title,
        sku,
        category: config.category,

        subjectCode: subjectCodeRaw,
        subjectTitleHi,
        subjectTitleEn,
        subjectTitleOther,

        courseCodes: courseCodeList,
        courseTitles: normalizedCourseTitles,

        session,
        session6,
        language,
        lang3,

        price: Math.max(0, safeNum(pricingResolution.price, 0)),
        oldPrice: Math.max(0, safeNum(pricingResolution.oldPrice, 0)),

        availability: "want_to_buy",
        importantNote: replaceTokens(config.importantNoteTemplate, tokenRow),

        shortDesc: replaceTokens(config.shortDescTemplate, tokenRow),
        descriptionHtml: replaceTokens(config.longDescTemplate, tokenRow),

        isDigital: isDigitalForCategory,

        metaTitle: replaceTokens(config.metaTitleTemplate, tokenRow),
        metaDescription: replaceTokens(config.metaDescriptionTemplate, tokenRow),

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
          batchSkippedRows++;
          pushFailure(
            "skipped",
            `Duplicate product already exists, new row ignored. Price auto from ${pricingResolution.source}. Availability current files se auto derive hoti rahegi.${warningText}`
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
        if (normalizedSlugBase && existing.slug !== normalizedSlugBase) {
          finalSlug = await makeUniqueSlug(normalizedSlugBase, String(existing._id));
        } else if (!safeStr(existing.slug)) {
          finalSlug = await makeUniqueSlug(slugBase || title, String(existing._id));
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

        hardcopySyncQueue.push({
          before: beforeDoc,
          after: afterDoc ? afterDoc.toObject() : null,
        });

        const _availabilityAfter =
          getAvailabilityAfterSync(availabilitySync) || safeStr(afterDoc?.availability || "");

        batchUpdatedRows++;
        continue;
      }

      const finalSlug = await makeUniqueSlug(slugBase || title);

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
      const createdObj = refreshedDoc?.toObject ? refreshedDoc.toObject() : createdDoc.toObject();

      comboSyncQueue.push({
        before: null,
        after: createdObj,
      });

      hardcopySyncQueue.push({
        before: null,
        after: createdObj,
      });

      const _availabilityAfter =
        getAvailabilityAfterSync(availabilitySync) || safeStr(createdObj?.availability || "");

      batchCreatedRows++;
    } catch (error: any) {
      batchFailedRows++;
      pushFailure("failed", sanitizeUnexpectedRowError(error));
      continue;
    }
  }

  let comboSyncPatch = currentSummary?.comboSync || {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
    mode: "none",
  };

  let hardcopySyncPatch = currentSummary?.hardcopySync || {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
    mode: "none",
  };

  if (!config.dryRun && comboSyncQueue.length) {
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

  if (!config.dryRun && hardcopySyncQueue.length) {
    const hardcopyResult = await syncGeneratedHardcopiesForBulkChanges(hardcopySyncQueue);
    hardcopySyncPatch = {
      attempted: safeNum(hardcopySyncPatch.attempted, 0) + hardcopySyncQueue.length,
      succeeded:
        safeNum(hardcopySyncPatch.succeeded, 0) +
        (hardcopyResult.ok ? hardcopySyncQueue.length : 0),
      failed:
        safeNum(hardcopySyncPatch.failed, 0) +
        (hardcopyResult.ok ? 0 : hardcopySyncQueue.length),
      errors: uniqueStrings([
        ...((hardcopySyncPatch.errors as string[]) || []),
        ...(hardcopyResult.errors || []),
      ]).slice(0, 10),
      mode: "batch-sync",
    };
  }

  const nextSummary = {
    totalRows: safeNum(currentSummary?.totalRows, rows.length),
    validRows: safeNum(currentSummary?.validRows, 0) + batchValidRows,
    createdRows: safeNum(currentSummary?.createdRows, 0) + batchCreatedRows,
    updatedRows: safeNum(currentSummary?.updatedRows, 0) + batchUpdatedRows,
    skippedRows: safeNum(currentSummary?.skippedRows, 0) + batchSkippedRows,
    failedRows: safeNum(currentSummary?.failedRows, 0) + batchFailedRows,
    duplicateStrategy: config.duplicateStrategy,
    dryRun: config.dryRun,
    category: config.category,
    comboSync: comboSyncPatch,
    hardcopySync: hardcopySyncPatch,
  };

  const successDelta = config.dryRun ? 0 : batchCreatedRows + batchUpdatedRows;

  return {
    processedDelta: batchRows.length,
    successDelta,
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
    note: `Batch ${args.batchNumber} processed. Created ${batchCreatedRows}, Updated ${batchUpdatedRows}, Skipped ${batchSkippedRows}, Failed ${batchFailedRows}.`,
  } as BulkDetailsBatchProcessResult;
}