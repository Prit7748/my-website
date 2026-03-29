import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import Subject from "@/models/Subject";
import Course from "@/models/Course";
import Session from "@/models/Session";
import { getAuthUser, hasPermission } from "@/lib/auth";
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
import * as XLSX from "xlsx";

export const runtime = "nodejs";

type DuplicateStrategy = "replace" | "ignore";

type BulkBody = {
  dryRun?: boolean;
  category?: string;
  titleTemplate?: string;
  importantNoteTemplate?: string;
  shortDescTemplate?: string;
  longDescTemplate?: string;
  slugTemplate?: string;
  metaTitleTemplate?: string;
  metaDescriptionTemplate?: string;
  publishNow?: boolean;
  csvText?: string;
  duplicateStrategy?: DuplicateStrategy;
};

type ResultItem = {
  rowNumber: number;
  sku?: string;
  title?: string;
  slug?: string;
  status: "created" | "updated" | "skipped" | "failed" | "validated";
  reason?: string;
  missingSubject?: string;
  missingCourse?: string[];
  missingSession?: string;
  duplicateFound?: boolean;
  matchedBy?: "sku" | "slug" | "sku_or_slug";
  courseCodes?: string[];
  courseTitles?: string[];
  availabilityAfter?: string;
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

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

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

function makeRowMap(cols: string[]) {
  const clean = cols.map((x) => safeStr(x));

  return {
    A: safeStr(clean[0]),
    B: safeStr(clean[1]),
    C: safeStr(clean[2]),
    D: safeStr(clean[3]),
    E: safeStr(clean[4]),
    F: safeStr(clean[5]),
    G: safeStr(clean[6]),
    H: safeStr(clean[7]),
  };
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

async function makeUniqueSlug(base: string, excludeId?: string) {
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
    reason: uniqueStrings(errors).slice(0, 10).join(" | "),
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
    reason: uniqueStrings(errors).slice(0, 10).join(" | "),
  };
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (!hasPermission(user, "products:write")) {
      return NextResponse.json({ error: "Forbidden (products:write missing)" }, { status: 403 });
    }

    let body: BulkBody = {};
    let csvTextFromFile = "";
    const contentType = req.headers.get("content-type") || "";
    const comboSyncQueue: SyncQueueItem[] = [];
    const hardcopySyncQueue: SyncQueueItem[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "File required" }, { status: 400 });
      }

      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: "File exceeds 5MB limit" }, { status: 400 });
      }

      const lowerName = safeStr(file.name).toLowerCase();
      const buffer = Buffer.from(await file.arrayBuffer());

      if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const firstSheetName = workbook.SheetNames?.[0];
        if (!firstSheetName) {
          return NextResponse.json({ error: "Excel sheet not found" }, { status: 400 });
        }
        const sheet = workbook.Sheets[firstSheetName];
        csvTextFromFile = XLSX.utils.sheet_to_csv(sheet);
      } else if (lowerName.endsWith(".csv")) {
        csvTextFromFile = buffer.toString("utf8");
      } else {
        return NextResponse.json({ error: "Only CSV or Excel allowed" }, { status: 400 });
      }

      body = {
        dryRun: formData.get("dryRun") === "true",
        category: String(formData.get("category") || ""),
        titleTemplate: String(formData.get("titleTemplate") || ""),
        importantNoteTemplate: String(formData.get("importantNoteTemplate") || ""),
        shortDescTemplate: String(formData.get("shortDescTemplate") || ""),
        longDescTemplate: String(formData.get("longDescTemplate") || ""),
        slugTemplate: String(formData.get("slugTemplate") || ""),
        metaTitleTemplate: String(formData.get("metaTitleTemplate") || ""),
        metaDescriptionTemplate: String(formData.get("metaDescriptionTemplate") || ""),
        publishNow: formData.get("publishNow") === "true",
        csvText: csvTextFromFile,
        duplicateStrategy: (safeStr(formData.get("duplicateStrategy")) || "ignore") as DuplicateStrategy,
      };
    } else {
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }
    }

    const dryRun = safeBool(body?.dryRun, true);
    const category = normalizeProductCategory(body?.category);
    const titleTemplate = safeStr(body?.titleTemplate);
    const importantNoteTemplate = safeStr(body?.importantNoteTemplate);
    const shortDescTemplate = safeStr(body?.shortDescTemplate);
    const longDescTemplate = safeStr(body?.longDescTemplate);
    const slugTemplate = safeStr(body?.slugTemplate);
    const metaTitleTemplate = safeStr(body?.metaTitleTemplate);
    const metaDescriptionTemplate = safeStr(body?.metaDescriptionTemplate);
    const publishNow =
      body?.publishNow !== undefined
        ? safeBool(body?.publishNow, false)
        : category === "Question Papers (PYQ)";
    const csvText = String(body?.csvText || csvTextFromFile || "");
    const duplicateStrategy: DuplicateStrategy =
      body?.duplicateStrategy === "replace" ? "replace" : "ignore";

    if (!category) return NextResponse.json({ error: "Category required" }, { status: 400 });
    if (category === PHYSICAL_CATEGORY) {
      return NextResponse.json({ error: MANUAL_HARDCOPY_BULK_BLOCK_MESSAGE }, { status: 400 });
    }
    if (!titleTemplate) {
      return NextResponse.json({ error: "Title Template required" }, { status: 400 });
    }
    if (!csvText.trim()) {
      return NextResponse.json({ error: "CSV text required" }, { status: 400 });
    }

    const categoryConf = CATEGORY_CONFIG.find((x) => x.label === category);
    if (!categoryConf) {
      return NextResponse.json({ error: "Invalid category selected" }, { status: 400 });
    }

    const isDigitalForCategory = deriveIsDigitalFromCategory(category);

    await dbConnect();

    const [subjects, courses, sessions] = await Promise.all([
      Subject.find({ isActive: { $ne: false } }).lean(),
      Course.find({ isActive: { $ne: false } }).lean(),
      Session.find({ isActive: { $ne: false } }).select("name categories").lean(),
    ]);

    const subjectMap = new Map<string, any>();
    for (const s of subjects as any[]) {
      const key = normalizeSubjectCodeLoose(String(s?.code || ""));
      if (key) subjectMap.set(key, s);
    }

    const courseMap = new Map<string, any>();
    for (const c of courses as any[]) {
      const key = normalizeCourseCodeLoose(String(c?.code || ""));
      if (key) courseMap.set(key, c);
    }

    const categoryCandidates = categoryLabelToSessionSlugCandidates(category);

    const sessionAllowed = new Set<string>();
    for (const s of sessions as any[]) {
      const cats = Array.isArray(s?.categories)
        ? s.categories.map((x: any) => safeStr(x)).filter(Boolean)
        : [];

      const matchesCategory =
        !cats.length ||
        cats.some((c: string) => {
          const cTrim = safeStr(c);
          const cLower = cTrim.toLowerCase();
          const cSlug = slugify(cTrim);

          return categoryCandidates.some((candidate) => {
            const cc = safeStr(candidate);
            return cc === cTrim || cc === cLower || cc === cSlug;
          });
        });

      if (matchesCategory) {
        const nm = safeStr(s?.name);
        if (nm) sessionAllowed.add(nm);
      }
    }

    let parsedRows = parseCsv(csvText);
    if (!parsedRows.length) {
      return NextResponse.json({ error: "CSV empty hai" }, { status: 400 });
    }

    if (parsedRows.length && rowLooksLikeHeader(parsedRows[0])) {
      parsedRows = parsedRows.slice(1);
    }

    const items: ResultItem[] = [];
    let validRows = 0;
    let createdRows = 0;
    let updatedRows = 0;
    let skippedRows = 0;
    let failedRows = 0;

    for (let i = 0; i < parsedRows.length; i++) {
      const raw = parsedRows[i] || [];
      const rowNumber = i + 2;

      const cols = [...raw];
      while (cols.length < 5) cols.push("");
      const row = makeRowMap(cols);

      const sku = normalizeSku(row.A);
      const subjectCodeRaw = safeStr(row.B);
      const subjectCodeLoose = normalizeSubjectCodeLoose(subjectCodeRaw);
      const session = safeStr(row.C);
      const language = safeStr(row.D);
      const courseCodeRaw = safeStr(row.E);

      const missingCourse: string[] = [];

      if (!sku || !subjectCodeRaw || !session || !language || !courseCodeRaw) {
        items.push({
          rowNumber,
          sku,
          status: "failed",
          reason: "Required columns missing or invalid in this row",
        });
        failedRows++;
        continue;
      }

      const courseCodeList = splitCourseCodes(courseCodeRaw);

      const subjectDoc = subjectMap.get(subjectCodeLoose);
      if (!subjectDoc) {
        items.push({
          rowNumber,
          sku,
          status: "failed",
          reason: "Subject not found in master subjects",
          missingSubject: subjectCodeRaw,
        });
        failedRows++;
        continue;
      }

      if (!courseCodeList.length) {
        items.push({
          rowNumber,
          sku,
          status: "failed",
          reason: "Course code missing or invalid",
          missingCourse: [courseCodeRaw],
        });
        failedRows++;
        continue;
      }

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
        items.push({
          rowNumber,
          sku,
          status: "failed",
          reason: "Course not found in master courses",
          missingCourse,
        });
        failedRows++;
        continue;
      }

      if (!sessionAllowed.has(session)) {
        items.push({
          rowNumber,
          sku,
          status: "failed",
          reason: "Session not found in category-wise master sessions",
          missingSession: session,
        });
        failedRows++;
        continue;
      }

      const title = replaceTokens(titleTemplate, row);
      const slugBase = slugTemplate ? replaceTokens(slugTemplate, row) : title;
      const normalizedSlugBase = slugify(slugBase);
      const lang3 = normalizeLang3(language);
      const session6 = normalizeSession6(session);
      const { subjectTitleHi, subjectTitleEn, subjectTitleOther } = getSubjectTitle(subjectDoc);

      if (!title) {
        items.push({
          rowNumber,
          sku,
          status: "failed",
          reason: "Generated title empty hai",
        });
        failedRows++;
        continue;
      }

      const pricingResolution = await resolveRequiredProductPricing({
        category,
        courseCodes: courseCodeList,
        productSku: sku,
      });

      if (!pricingResolution.ok || Number(pricingResolution.price) <= 0) {
        items.push({
          rowNumber,
          sku,
          title,
          slug: normalizedSlugBase,
          status: "failed",
          reason:
            "Pricing rule not found. Pehle Product Pricing page me category + course rule ya product override set karo.",
          courseCodes: courseCodeList,
          courseTitles,
        });
        failedRows++;
        continue;
      }

      validRows++;

      const existing: any = await Product.findOne({
        $or: [{ sku }, { slug: normalizedSlugBase }],
      });

      if (dryRun) {
        items.push({
          rowNumber,
          sku,
          title,
          slug: normalizedSlugBase,
          status: "validated",
          duplicateFound: !!existing,
          matchedBy: existing
            ? existing?.sku === sku && existing?.slug === normalizedSlugBase
              ? "sku_or_slug"
              : existing?.sku === sku
              ? "sku"
              : "slug"
            : undefined,
          reason: existing
            ? duplicateStrategy === "replace"
              ? `Duplicate mila: final create par existing product replace/update hoga. Price auto from ${pricingResolution.source}. Availability auto file-existence se derive hogi.`
              : `Duplicate mila: final create par new row ignore/skip hogi. Price auto from ${pricingResolution.source}. Availability auto file-existence se derive hogi.`
            : `Ready to create. Price auto from ${pricingResolution.source}. Availability auto file-existence se derive hogi.`,
          courseCodes: courseCodeList,
          courseTitles,
        });
        continue;
      }

      const payload: any = {
        title,
        sku,
        category,

        subjectCode: subjectCodeRaw,
        subjectTitleHi,
        subjectTitleEn,
        subjectTitleOther,

        courseCodes: courseCodeList,
        courseTitles,

        session,
        session6,
        language,
        lang3,

        price: Math.max(0, safeNum(pricingResolution.price, 0)),
        oldPrice: Math.max(0, safeNum(pricingResolution.oldPrice, 0)),

        pages: 0,
        availability: "want_to_buy",
        importantNote: replaceTokens(importantNoteTemplate, row),

        deliverWithinMinutes: 20,
        onDemandNote: "",
        autoMakeAvailableOnUpload: true,

        shortDesc: replaceTokens(shortDescTemplate, row),
        descriptionHtml: replaceTokens(longDescTemplate, row),

        isDigital: isDigitalForCategory,

        metaTitle: replaceTokens(metaTitleTemplate, row),
        metaDescription: replaceTokens(metaDescriptionTemplate, row),

        isAutoGenerated: false,
        autoGenerationType: "",
        autoGeneratedFromProductId: null,
        autoGeneratedFromSku: "",
        autoGeneratedFromCategory: "",
        autoGeneratedAt: null,

        isActive: publishNow,
        lastModifiedAt: new Date(),

        deletedAt: null,
        deletedBy: "",

        pdfKey: "",
        pdfUrl: "",

        images: [],
        thumbnailUrl: "",
        quickUrl: "",
      };

      if (existing) {
        if (duplicateStrategy === "ignore") {
          items.push({
            rowNumber,
            sku,
            title,
            slug: existing.slug,
            status: "skipped",
            duplicateFound: true,
            matchedBy:
              existing?.sku === sku && existing?.slug === normalizedSlugBase
                ? "sku_or_slug"
                : existing?.sku === sku
                ? "sku"
                : "slug",
            reason: `Duplicate product already exists, new row ignored. Price auto from ${pricingResolution.source}. Availability current files se auto derive hoti rahegi.`,
            courseCodes: courseCodeList,
            courseTitles,
          });
          skippedRows++;
          continue;
        }

        const beforeDoc = existing.toObject();

        let finalSlug = existing.slug;
        if (existing.slug !== normalizedSlugBase) {
          finalSlug = await makeUniqueSlug(normalizedSlugBase, String(existing._id));
        }

        await Product.updateOne(
          { _id: existing._id },
          {
            $set: {
              ...payload,
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

        items.push({
          rowNumber,
          sku,
          title,
          slug: finalSlug,
          status: "updated",
          duplicateFound: true,
          matchedBy:
            existing?.sku === sku && existing?.slug === normalizedSlugBase
              ? "sku_or_slug"
              : existing?.sku === sku
              ? "sku"
              : "slug",
          reason: `Existing product replaced successfully. Price auto from ${pricingResolution.source}. Availability auto synced.`,
          courseCodes: courseCodeList,
          courseTitles,
          availabilityAfter: getAvailabilityAfterSync(availabilitySync) || safeStr(afterDoc?.availability || ""),
        });
        updatedRows++;
        continue;
      }

      const finalSlug = await makeUniqueSlug(slugBase);

      const createdDoc: any = await Product.create({
        ...payload,
        slug: finalSlug,
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

      items.push({
        rowNumber,
        sku,
        title,
        slug: finalSlug,
        status: "created",
        reason: `Created successfully. Price auto from ${pricingResolution.source}. Availability auto synced.`,
        courseCodes: courseCodeList,
        courseTitles,
        availabilityAfter: getAvailabilityAfterSync(availabilitySync) || safeStr(createdObj?.availability || ""),
      });
      createdRows++;
    }

    let comboSync = {
      attempted: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[],
      mode: "none",
    };

    if (!dryRun && comboSyncQueue.length) {
      comboSync.attempted = comboSyncQueue.length;
      comboSync.mode = "bulk-scoped-sync";

      try {
        const result = await syncGeneratedCombosForBulkChanges(comboSyncQueue);
        comboSync.succeeded = Array.isArray(comboSyncQueue) ? comboSyncQueue.length : 0;
        comboSync.failed = 0;

        if (result && result.ok === false && safeStr((result as any).reason)) {
          comboSync.errors = [safeStr((result as any).reason)];
        }
      } catch (e: any) {
        comboSync.failed = comboSyncQueue.length;
        comboSync.succeeded = 0;
        comboSync.errors = [safeStr(e?.message) || "Unknown combo sync error"];
      }

      comboSync.errors = uniqueStrings(comboSync.errors).slice(0, 10);
    }

    let hardcopySync = {
      attempted: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[],
      mode: "none",
    };

    if (!dryRun && hardcopySyncQueue.length) {
      hardcopySync.attempted = hardcopySyncQueue.length;
      hardcopySync.mode = "bulk-scoped-sync";

      try {
        const result = await syncGeneratedHardcopiesForBulkChanges(hardcopySyncQueue);
        hardcopySync.succeeded = Array.isArray(hardcopySyncQueue) ? hardcopySyncQueue.length : 0;
        hardcopySync.failed = 0;

        if (result && result.ok === false && safeStr((result as any).reason)) {
          hardcopySync.errors = [safeStr((result as any).reason)];
        }
      } catch (e: any) {
        hardcopySync.failed = hardcopySyncQueue.length;
        hardcopySync.succeeded = 0;
        hardcopySync.errors = [safeStr(e?.message) || "Unknown hardcopy sync error"];
      }

      hardcopySync.errors = uniqueStrings(hardcopySync.errors).slice(0, 10);
    }

    const successMessage = dryRun
      ? "Validation completed successfully."
      : `Bulk product upload completed. Created: ${createdRows}, Updated: ${updatedRows}, Skipped: ${skippedRows}, Failed: ${failedRows}.`;

    return NextResponse.json({
      ok: true,
      message: successMessage,
      dryRun,
      duplicateStrategy,
      comboSync,
      hardcopySync,
      summary: {
        totalRows: parsedRows.length,
        validRows,
        createdRows,
        updatedRows,
        skippedRows,
        failedRows,
      },
      items,
    });
  } catch (error: any) {
    console.error("Bulk details upload error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Internal server error in bulk details upload",
      },
      { status: 500 }
    );
  }
}
