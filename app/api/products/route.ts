import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import Course from "@/models/Course";
import Session from "@/models/Session";
import GlobalToggle from "@/models/GlobalToggle";
import PyqThumbnailConfig, {
  PYQ_THUMBNAIL_CONFIG_KEY,
} from "@/models/PyqThumbnailConfig";
import { attachResolvedOnDemandTimingToProducts } from "@/lib/onDemandTiming";
import { categoryLabelToSessionSlugCandidates } from "@/lib/productCatalog";

/* =========================
   Basic helpers
   ========================= */

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function parseList(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
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

function escapeRegex(str: string) {
  return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fileNameOf(urlOrPath: string) {
  const clean = safeStr(urlOrPath).split("?")[0];
  const parts = clean.split("/");
  return (parts[parts.length - 1] || "").toLowerCase();
}

function normalizeCourseCodeForCompare(input: any) {
  return safeStr(input).replace(/\s+/g, " ").toUpperCase();
}

function normalizeLanguageValue(input: any) {
  return safeStr(input).replace(/\s+/g, " ").trim();
}

function sortAlphaNumeric(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function uniqueByKey<T>(items: T[], keyFn: (item: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function sortLanguages(values: string[]) {
  const preferredOrder = [
    "English",
    "Hindi",
    "Urdu",
    "Sanskrit",
    "Bengali",
    "Punjabi",
    "Marathi",
    "Gujarati",
    "Tamil",
    "Telugu",
    "Kannada",
    "Malayalam",
    "Odia",
    "Assamese",
  ];

  const rank = new Map<string, number>();
  preferredOrder.forEach((v, i) => rank.set(v.toLowerCase(), i));

  return [...values].sort((a, b) => {
    const ra = rank.has(a.toLowerCase()) ? rank.get(a.toLowerCase())! : 999;
    const rb = rank.has(b.toLowerCase()) ? rank.get(b.toLowerCase())! : 999;
    if (ra !== rb) return ra - rb;
    return sortAlphaNumeric(a, b);
  });
}

/* =========================
   Flexible session helpers
   ========================= */

const SESSION_MONTHS = [
  { full: "January", short: "Jan", aliases: ["january", "jan"] },
  { full: "February", short: "Feb", aliases: ["february", "feb"] },
  { full: "March", short: "Mar", aliases: ["march", "mar"] },
  { full: "April", short: "Apr", aliases: ["april", "apr"] },
  { full: "May", short: "May", aliases: ["may"] },
  { full: "June", short: "Jun", aliases: ["june", "jun"] },
  { full: "July", short: "Jul", aliases: ["july", "jul"] },
  { full: "August", short: "Aug", aliases: ["august", "aug"] },
  { full: "September", short: "Sep", aliases: ["september", "sept", "sep"] },
  { full: "October", short: "Oct", aliases: ["october", "oct"] },
  { full: "November", short: "Nov", aliases: ["november", "nov"] },
  { full: "December", short: "Dec", aliases: ["december", "dec"] },
];

function normalizeSessionForDetect(value: any) {
  return safeStr(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function detectSessionMonth(value: any) {
  const raw = normalizeSessionForDetect(value);
  const compact = raw.replace(/[^a-z0-9]/g, "");

  for (const month of SESSION_MONTHS) {
    for (const alias of month.aliases) {
      const aliasLower = alias.toLowerCase();

      if (compact.startsWith(aliasLower)) {
        return month;
      }

      const rx = new RegExp(`(^|[^a-z])${escapeRegex(aliasLower)}([^a-z]|$|\\d)`, "i");
      if (rx.test(raw)) {
        return month;
      }
    }
  }

  return null;
}

function detectSessionYear(value: any) {
  const raw = normalizeSessionForDetect(value);
  const compact = raw.replace(/[^a-z0-9]/g, "");

  const year4 = raw.match(/\b(20\d{2})\b/) || compact.match(/(20\d{2})/);
  if (year4?.[1]) return year4[1];

  const year2 = raw.match(/(^|[^0-9])(\d{2})([^0-9]|$)/) || compact.match(/(\d{2})$/);
  const yy = year2?.[2] || year2?.[1];

  if (yy && /^\d{2}$/.test(yy)) {
    return `20${yy}`;
  }

  return "";
}

function buildMonthYearSessionRegex(value: string) {
  const month = detectSessionMonth(value);
  const year = detectSessionYear(value);

  if (!month || !year) return null;

  const aliasPattern = month.aliases.map(escapeRegex).join("|");
  const shortYear = year.slice(-2);

  return new RegExp(
    `^\\s*(?:${aliasPattern})\\s*[,._/\\-–—]*\\s*(?:${escapeRegex(year)}|${escapeRegex(
      shortYear
    )})\\s*$`,
    "i"
  );
}

function buildLooseExactSessionRegex(value: string) {
  const tokens = safeStr(value)
    .split(/[\s,._/\-–—]+/g)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!tokens.length) return null;

  const pattern = tokens.map(escapeRegex).join("[\\s,._/\\-–—]*");

  return new RegExp(`^\\s*${pattern}\\s*$`, "i");
}

function buildMonthYearSessionCandidates(value: string) {
  const month = detectSessionMonth(value);
  const year = detectSessionYear(value);

  if (!month || !year) return [];

  const shortYear = year.slice(-2);

  return uniqueStrings([
    `${month.full} ${year}`,
    `${month.full}, ${year}`,
    `${month.full}-${year}`,
    `${month.full}/${year}`,
    `${month.full} ${shortYear}`,
    `${month.full}-${shortYear}`,

    `${month.short} ${year}`,
    `${month.short}, ${year}`,
    `${month.short}-${year}`,
    `${month.short}/${year}`,
    `${month.short} ${shortYear}`,
    `${month.short}-${shortYear}`,

    `${month.short.toUpperCase()}${shortYear}`,
    `${month.short.toUpperCase()}${year}`,
    `${month.full.toUpperCase()} ${year}`,
    `${month.full.toUpperCase()}-${year}`,
    `${month.short.toUpperCase()} ${year}`,
    `${month.short.toUpperCase()}-${year}`,
  ]);
}

function buildSessionMatchValues(sessions: string[]) {
  const values: any[] = [];
  const seen = new Set<string>();

  function add(value: any) {
    if (!value) return;

    const key = value instanceof RegExp ? value.toString() : `str:${safeStr(value)}`;
    if (seen.has(key)) return;

    seen.add(key);
    values.push(value);
  }

  for (const session of sessions) {
    const clean = safeStr(session);
    if (!clean) continue;

    add(clean);

    for (const candidate of buildMonthYearSessionCandidates(clean)) {
      add(candidate);
    }

    add(buildMonthYearSessionRegex(clean));
    add(buildLooseExactSessionRegex(clean));
  }

  return values.length ? values : sessions;
}

/* =========================
   Image normalization
   ========================= */

function normalizeImagesToUrls(images: any) {
  const arr = Array.isArray(images) ? images : [];
  if (!arr.length) {
    return { urls: [] as string[], thumbUrl: "", quickUrl: "" };
  }

  const allStrings = arr.every((x: any) => typeof x === "string");
  if (allStrings) {
    const urls = Array.from(
      new Set(
        arr
          .map((s: string) => safeStr(s))
          .filter(Boolean)
      )
    ).sort((a, b) =>
      fileNameOf(a).localeCompare(fileNameOf(b), undefined, { numeric: true })
    );

    const thumbUrl = urls[0] || "";
    const quickUrl = urls[1] || urls[0] || "";
    return { urls, thumbUrl, quickUrl };
  }

  const strings: string[] = arr
    .filter((x: any) => typeof x === "string")
    .map((s: string) => safeStr(s))
    .filter(Boolean);

  const objects = arr
    .filter(
      (x: any) =>
        x &&
        typeof x === "object" &&
        typeof x.url === "string" &&
        x.url.trim()
    )
    .sort((a: any, b: any) => {
      const ak = safeStr(a.sortKey || a.filename || fileNameOf(a.url)).toLowerCase();
      const bk = safeStr(b.sortKey || b.filename || fileNameOf(b.url)).toLowerCase();
      return ak.localeCompare(bk, undefined, { numeric: true });
    })
    .map((x: any) => safeStr(x.url))
    .filter(Boolean);

  const urls = Array.from(new Set([...strings, ...objects])).sort((a, b) =>
    fileNameOf(a).localeCompare(fileNameOf(b), undefined, { numeric: true })
  );

  const thumbUrl = urls[0] || "";
  const quickUrl = urls[1] || urls[0] || "";

  return { urls, thumbUrl, quickUrl };
}

function isRealProductImage(url: string) {
  const u = safeStr(url).toLowerCase();
  if (!u) return false;

  if (u.includes("/api/thumb/")) return false;
  if (u.includes("pyq-master-template")) return false;
  if (u.includes("/uploads/site-settings/pyq-thumbnail/")) return false;

  return true;
}

function uniqueRealImages(values: string[]) {
  return uniqueStrings(values.map((x) => safeStr(x)).filter(isRealProductImage));
}

/* =========================
   Search normalization + ranking
   ========================= */

function normalizeQuery(q: string) {
  return safeStr(q)
    .toLowerCase()
    .replace(/[_:]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(q: string) {
  const n = normalizeQuery(q);
  if (!n) return [];
  return n
    .split(" ")
    .map((t) => t.trim())
    .filter(Boolean);
}

function buildFlexibleCodeRegexFromQuery(q: string) {
  const n = normalizeQuery(q).replace(/\s+/g, "");
  const m = n.match(/^([a-z]{2,10})0*([0-9]{1,6})$/i);
  if (!m) return null;

  const prefix = m[1];
  const num = m[2];

  return new RegExp(`${escapeRegex(prefix)}[\\s\\-]*0*${escapeRegex(num)}`, "i");
}

function scoreProductForQuery(p: any, q: string) {
  const nq = normalizeQuery(q).replace(/\s+/g, "");
  const title = normalizeQuery(p?.title || "");
  const subj = normalizeQuery(p?.subjectCode || "");
  const slug = normalizeQuery(p?.slug || "");
  const cat = normalizeQuery(p?.category || "");

  let s = 0;

  if (subj && nq && subj.replace(/\s+/g, "") === nq) s += 160;
  if (slug && nq && slug.replace(/\s+/g, "") === nq) s += 110;

  if (subj && nq && subj.replace(/\s+/g, "").includes(nq)) s += 95;
  if (title && nq && title.replace(/\s+/g, "").includes(nq)) s += 55;
  if (slug && nq && slug.replace(/\s+/g, "").includes(nq)) s += 35;
  if (cat && nq && cat.includes(nq)) s += 12;

  const tokens = tokenize(q);
  for (const t of tokens) {
    if (t.length < 2) continue;
    if (subj.includes(t)) s += 20;
    if (title.includes(t)) s += 12;
    if (slug.includes(t)) s += 8;
    if (cat.includes(t)) s += 4;
  }

  return s;
}

/* =========================
   Availability helpers
   ========================= */

function normAvail(v?: string) {
  return safeStr(v).toLowerCase();
}

async function getOnDemandSalesEnabled() {
  try {
    const doc: any =
      (await GlobalToggle.findOne({ key: "on_demand_sales" }).lean()) ||
      (await GlobalToggle.findOne({ key: "coming_soon_sales" }).lean());

    if (!doc) return true;
    return Boolean(doc.enabled);
  } catch {
    return true;
  }
}

function resolveAvailability(rawAvailability: string, onDemandSalesEnabled: boolean) {
  const a = normAvail(rawAvailability);

  if (a === "out_of_stock" || a === "outofstock" || a === "out-of-stock") return "want_to_buy";
  if (a === "want_to_buy" || a === "wanttobuy" || a === "want-to-buy") return "want_to_buy";

  if (a === "coming_soon" || a === "comingsoon" || a === "coming-soon") {
    return onDemandSalesEnabled ? "on_demand" : "want_to_buy";
  }

  if (a === "on_demand" || a === "ondemand" || a === "on-demand") {
    return onDemandSalesEnabled ? "on_demand" : "want_to_buy";
  }

  if (a === "available" || a === "in_stock" || a === "instock" || a === "") return "available";

  return "available";
}

/* =========================
   Runtime thumbnail helpers
   ========================= */

function isPyqCategory(input: any) {
  const c = safeStr(input).toLowerCase();
  return (
    c === "question papers (pyq)" ||
    c === "question papers" ||
    c === "question paper (pyq)" ||
    c === "question paper" ||
    c === "pyq" ||
    c === "pyqs" ||
    c === "previous year paper" ||
    c === "previous year papers"
  );
}

function isGuessPaperCategory(input: any) {
  const c = safeStr(input).toLowerCase();
  return (
    c === "guess papers" ||
    c === "guess paper" ||
    c === "guess-paper" ||
    c === "guess-papers" ||
    c.includes("guess")
  );
}

function extractSubjectCodeFromProduct(p: any) {
  const direct = safeStr(p?.subjectCode);
  if (direct) return direct;

  const title = safeStr(p?.title);
  const m = title.match(/\b([A-Z]{2,10})\s*[- ]?\s*(\d{1,6}[A-Z0-9]*)\b/i);
  if (m) return `${safeStr(m[1]).toUpperCase()}-${safeStr(m[2]).toUpperCase()}`;

  return "";
}

function extractSubjectTitleFromProduct(p: any, fallback: string) {
  const lang = safeStr(p?.language).toLowerCase();
  const hi = safeStr(p?.subjectTitleHi);
  const en = safeStr(p?.subjectTitleEn);

  if ((lang === "hindi" || lang.startsWith("hin")) && hi) return hi;
  if ((lang === "english" || lang.startsWith("eng")) && en) return en;

  return hi || en || safeStr(p?.title) || fallback;
}

function extractCourseTextFromProduct(p: any) {
  const list = Array.isArray(p?.courseCodes)
    ? p.courseCodes.map((x: any) => safeStr(x)).filter(Boolean)
    : [];

  if (list.length) return Array.from(new Set(list)).join(", ");
  return "";
}

function extractMediumFromProduct(p: any) {
  return safeStr(p?.language) || "English";
}

async function getPyqTemplateVersionToken() {
  try {
    const doc: any = await PyqThumbnailConfig.findOne({
      key: PYQ_THUMBNAIL_CONFIG_KEY,
    })
      .select("templateImageUrl updatedAt isEnabled")
      .lean();

    const isEnabled = doc?.isEnabled !== false;
    const templateImageUrl = safeStr(doc?.templateImageUrl);
    const updatedAt = doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : "";

    return [
      "pyq-template-v4",
      isEnabled ? "enabled" : "disabled",
      templateImageUrl,
      updatedAt,
    ]
      .filter(Boolean)
      .join("|");
  } catch {
    return "pyq-template-v4-fallback";
  }
}

function buildPyqRuntimeThumbUrl(p: any, templateVersionToken: string) {
  const session = safeStr(p?.session) || "June, 2025";
  const code = extractSubjectCodeFromProduct(p) || "IGNOU";
  const title = extractSubjectTitleFromProduct(p, "Solved Previous Year Paper");
  const course = extractCourseTextFromProduct(p) || "IGNOU";
  const medium = extractMediumFromProduct(p) || "English";

  const v = [
    templateVersionToken,
    "pyq-runtime",
    safeStr(p?._id),
    safeStr(p?.slug),
    safeStr(p?.updatedAt),
    safeStr(p?.category),
    code,
    title,
    course,
    session,
    medium,
  ]
    .filter(Boolean)
    .join("|");

  const qs = new URLSearchParams({
    session,
    code,
    title,
    course,
    medium,
    v,
  });

  return `/api/thumb/pyq?${qs.toString()}`;
}

function buildGuessPaperRuntimeThumbUrl(p: any, templateVersionToken: string) {
  const session = safeStr(p?.session) || "Latest";
  const code = extractSubjectCodeFromProduct(p) || "IGNOU";
  const title = extractSubjectTitleFromProduct(p, "Guess Paper");
  const course = extractCourseTextFromProduct(p) || "IGNOU";
  const medium = extractMediumFromProduct(p) || "English";

  const v = [
    "guess-paper-runtime-v1",
    templateVersionToken,
    safeStr(p?._id),
    safeStr(p?.slug),
    safeStr(p?.updatedAt),
    safeStr(p?.category),
    code,
    title,
    course,
    session,
    medium,
  ]
    .filter(Boolean)
    .join("|");

  const qs = new URLSearchParams({
    session,
    code,
    title,
    course,
    medium,
    type: "guess-paper",
    v,
  });

  return `/api/thumb/pyq?${qs.toString()}`;
}

/* =========================
   Facet helpers
   ========================= */

async function buildCategoryAwareFacets(categories: string[]) {
  const baseForFacets: any = {
    isActive: true,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  };

  if (categories.length) {
    baseForFacets.category = { $in: categories };
  }

  const [courseFacetRaw, sessionFacetRaw, languageFacetRaw] = await Promise.all([
    Product.distinct("courseCodes", baseForFacets),
    Product.distinct("session", baseForFacets),
    Product.distinct("language", baseForFacets),
  ]);

  const courseCodes = uniqueStrings(
    (courseFacetRaw || [])
      .flat()
      .map((x: any) => normalizeCourseCodeForCompare(x))
      .filter(Boolean)
  ).sort(sortAlphaNumeric);

  const productSessions = uniqueStrings(
    (sessionFacetRaw || []).map((x: any) => safeStr(x)).filter(Boolean)
  ).sort((a, b) => sortAlphaNumeric(b, a));

  const languages = sortLanguages(
    uniqueStrings(
      (languageFacetRaw || []).map((x: any) => normalizeLanguageValue(x)).filter(Boolean)
    )
  );

  let coursesDetailed: Array<{ code: string; title: string }> = [];
  if (courseCodes.length) {
    const courseDocs: any[] = await Course.find({
      isActive: true,
      code: { $in: courseCodes },
    })
      .select("code title")
      .lean();

    const courseTitleMap = new Map<string, string>();
    for (const doc of courseDocs || []) {
      const code = normalizeCourseCodeForCompare(doc?.code);
      if (!code) continue;
      if (!courseTitleMap.has(code)) {
        courseTitleMap.set(code, safeStr(doc?.title));
      }
    }

    coursesDetailed = courseCodes.map((code) => ({
      code,
      title: courseTitleMap.get(code) || "",
    }));
  }

  let sessionsDetailed: Array<{
    name: string;
    slug: string;
    categories: string[];
    sortOrder: number;
  }> = [];

  if (categories.length) {
    const sessionCategoryCandidates = uniqueStrings(
      categories
        .flatMap((cat) => categoryLabelToSessionSlugCandidates(cat))
        .map((x) => safeStr(x))
        .filter(Boolean)
    );

    const sessionDocs: any[] = await Session.find({
      isActive: true,
      categories: { $in: sessionCategoryCandidates },
    })
      .select("name slug categories sortOrder")
      .sort({ sortOrder: 1, name: 1, _id: 1 })
      .lean();

    sessionsDetailed = uniqueByKey(
      (sessionDocs || []).map((doc: any) => ({
        name: safeStr(doc?.name),
        slug: safeStr(doc?.slug),
        categories: Array.isArray(doc?.categories)
          ? doc.categories.map((x: any) => safeStr(x)).filter(Boolean)
          : [],
        sortOrder: Number(doc?.sortOrder || 0),
      })),
      (item) => item.name
    ).filter((item) => item.name);
  }

  const sessions =
    sessionsDetailed.length > 0
      ? uniqueStrings(sessionsDetailed.map((x) => x.name))
      : productSessions;

  return {
    courses: courseCodes,
    coursesDetailed,
    sessions,
    sessionsDetailed,
    languages,
  };
}

/* =========================
   API
   ========================= */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const categories = uniqueStrings(parseList(searchParams.get("category")));
  const courses = uniqueStrings(parseList(searchParams.get("course")));
  const sessions = uniqueStrings(parseList(searchParams.get("session")));
  const languages = uniqueStrings(parseList(searchParams.get("language")));

  const searchRaw = safeStr(searchParams.get("search"));
  const sort = safeStr(searchParams.get("sort") || "latest");

  const page = Math.max(1, Math.trunc(safeNum(searchParams.get("page"), 1)));
  const limit = Math.min(48, Math.max(6, Math.trunc(safeNum(searchParams.get("limit"), 24))));
  const skip = (page - 1) * limit;

  const includeFacetsParam = safeStr(searchParams.get("includeFacets")).toLowerCase();
  const includeFacets =
    includeFacetsParam === "" ||
    includeFacetsParam === "1" ||
    includeFacetsParam === "true" ||
    includeFacetsParam === "yes";

  const search = searchRaw.length >= 2 ? searchRaw : "";
  const hasSearch = !!search;

  let sortObj: any = { createdAt: -1, _id: -1 };
  if (sort === "price_asc") sortObj = { price: 1, _id: 1 };
  if (sort === "price_desc") sortObj = { price: -1, _id: -1 };

  const filter: any = {
    isActive: true,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  };

  if (categories.length) filter.category = { $in: categories };
  if (courses.length) filter.courseCodes = { $in: courses };
  if (sessions.length) filter.session = { $in: buildSessionMatchValues(sessions) };
  if (languages.length) filter.language = { $in: languages };

  await dbConnect();

  const onDemandSalesEnabled = await getOnDemandSalesEnabled();
  const pyqTemplateVersionToken = await getPyqTemplateVersionToken();

  const projection: any = {
    title: 1,
    slug: 1,
    category: 1,

    subjectCode: 1,
    subjectTitleHi: 1,
    subjectTitleEn: 1,
    courseCodes: 1,
    courseTitles: 1,

    session: 1,
    language: 1,

    price: 1,
    oldPrice: 1,
    shortDesc: 1,
    isDigital: 1,
    pdfUrl: 1,
    isActive: 1,

    images: 1,
    thumbnailUrl: 1,
    quickUrl: 1,

    availability: 1,
    deliverWithinMinutes: 1,
    onDemandNote: 1,

    createdAt: 1,
    updatedAt: 1,
  };

  let rawProducts: any[] = [];
  let total = 0;

  if (hasSearch) {
    const textFilter = { ...filter, $text: { $search: search } };
    const textProjection = { ...projection, score: { $meta: "textScore" } };
    const textSortObj: any = { score: { $meta: "textScore" }, createdAt: -1, _id: -1 };

    try {
      [rawProducts, total] = await Promise.all([
        Product.find(textFilter).select(textProjection).sort(textSortObj).skip(skip).limit(limit).lean(),
        Product.countDocuments(textFilter),
      ]);
    } catch (err: any) {
      const msg = String(err?.message || "").toLowerCase();
      const isTextIndexMissing =
        msg.includes("text index required") ||
        msg.includes("no text index") ||
        msg.includes("failed to use text index");

      if (!isTextIndexMissing) {
        throw err;
      }

      const tokens = tokenize(search)
        .filter((t) => t.length >= 2)
        .slice(0, 6);

      const tokenRegexes = tokens.map((t) => new RegExp(escapeRegex(t), "i"));
      const codeRx = buildFlexibleCodeRegexFromQuery(search);

      const fieldsToSearch = [
        "title",
        "slug",
        "subjectCode",
        "subjectTitleHi",
        "subjectTitleEn",
        "courseCodes",
        "courseTitles",
        "category",
        "session",
        "language",
      ];

      const regexFilter: any = { ...filter };
      const andParts: any[] = [];

      if (codeRx) {
        andParts.push({
          $or: [{ subjectCode: codeRx }, { title: codeRx }, { slug: codeRx }],
        });
      }

      for (const rx of tokenRegexes) {
        andParts.push({
          $or: fieldsToSearch.map((f) => ({ [f]: rx })),
        });
      }

      if (andParts.length) {
        regexFilter.$and = andParts;
      } else {
        const rx = new RegExp(escapeRegex(search), "i");
        regexFilter.$or = [{ subjectCode: rx }, { title: rx }, { slug: rx }];
      }

      [rawProducts, total] = await Promise.all([
        Product.find(regexFilter).select(projection).sort(sortObj).skip(skip).limit(limit).lean(),
        Product.countDocuments(regexFilter),
      ]);

      rawProducts.sort((a, b) => scoreProductForQuery(b, search) - scoreProductForQuery(a, search));
    }
  } else {
    [rawProducts, total] = await Promise.all([
      Product.find(filter).select(projection).sort(sortObj).skip(skip).limit(limit).lean(),
      Product.countDocuments(filter),
    ]);
  }

  const normalizedProducts = (rawProducts || []).map((p: any) => {
    const { urls, thumbUrl, quickUrl } = normalizeImagesToUrls(p.images);

    const rawAvailability = safeStr(p.availability || "");
    const effectiveAvailability = resolveAvailability(rawAvailability, onDemandSalesEnabled);

    const isPyq = isPyqCategory(p.category);
    const isGuessPaper = isGuessPaperCategory(p.category);

    let finalImages = urls;
    let finalThumb = safeStr(p.thumbnailUrl) || thumbUrl;
    let finalQuick = safeStr(p.quickUrl) || quickUrl || finalThumb;

    if (isPyq || isGuessPaper) {
      const runtimeThumb = isPyq
        ? buildPyqRuntimeThumbUrl(p, pyqTemplateVersionToken)
        : buildGuessPaperRuntimeThumbUrl(p, pyqTemplateVersionToken);

      const realImages = uniqueRealImages([
        ...urls,
        safeStr(p.thumbnailUrl),
        safeStr(p.quickUrl),
      ]);

      if (realImages.length > 0) {
        finalImages = realImages;

        finalThumb = isRealProductImage(safeStr(p.thumbnailUrl))
          ? safeStr(p.thumbnailUrl)
          : realImages[0] || runtimeThumb;

        finalQuick = isRealProductImage(safeStr(p.quickUrl))
          ? safeStr(p.quickUrl)
          : realImages[1] || realImages[0] || runtimeThumb;
      } else {
        finalImages = [runtimeThumb];
        finalThumb = runtimeThumb;
        finalQuick = runtimeThumb;
      }
    }

    return {
      _id: p._id,

      title: p.title || "",
      slug: p.slug || "",
      category: p.category || "",

      subjectCode: p.subjectCode || "",
      subjectTitleHi: p.subjectTitleHi || "",
      subjectTitleEn: p.subjectTitleEn || "",

      subjectTitle:
        (safeStr(p.language).toLowerCase().startsWith("hin") ? p.subjectTitleHi : p.subjectTitleEn) ||
        p.subjectTitleEn ||
        p.subjectTitleHi ||
        "",

      courseCodes: Array.isArray(p.courseCodes) ? p.courseCodes : [],
      courseTitles: Array.isArray(p.courseTitles) ? p.courseTitles : [],

      session: p.session || "",
      language: p.language || "",

      price: Number(p.price || 0),
      oldPrice: p.oldPrice ? Number(p.oldPrice) : null,
      shortDesc: p.shortDesc || "",
      isDigital: !!p.isDigital,
      pdfUrl: p.pdfUrl || "",
      isActive: !!p.isActive,

      availability: effectiveAvailability,
      rawAvailability,
      canPurchase: effectiveAvailability !== "want_to_buy",

      rawDeliverWithinMinutes: Math.max(1, safeNum(p.deliverWithinMinutes, 20)),
      rawOnDemandNote: safeStr(p.onDemandNote),

      images: finalImages,
      thumbUrl: finalThumb,
      quickUrl: finalQuick,
      thumbnailUrl: finalThumb,
    };
  });

  const resolvedProducts = await attachResolvedOnDemandTimingToProducts(normalizedProducts);

  const products = resolvedProducts.map((p: any) => ({
    _id: p._id,

    title: p.title || "",
    slug: p.slug || "",
    category: p.category || "",

    subjectCode: p.subjectCode || "",
    subjectTitleHi: p.subjectTitleHi || "",
    subjectTitleEn: p.subjectTitleEn || "",
    subjectTitle: p.subjectTitle || "",

    courseCodes: Array.isArray(p.courseCodes) ? p.courseCodes : [],
    courseTitles: Array.isArray(p.courseTitles) ? p.courseTitles : [],

    session: p.session || "",
    language: p.language || "",

    price: Number(p.price || 0),
    oldPrice: p.oldPrice ? Number(p.oldPrice) : null,
    shortDesc: p.shortDesc || "",
    isDigital: !!p.isDigital,
    pdfUrl: p.pdfUrl || "",
    isActive: !!p.isActive,

    availability: p.availability,
    rawAvailability: p.rawAvailability,
    canPurchase: !!p.canPurchase,

    deliverWithinMinutes: Math.max(1, safeNum(p.deliverWithinMinutesResolved, 20)),
    onDemandNote: safeStr(p.onDemandNoteResolved),

    rawDeliverWithinMinutes: Math.max(1, safeNum(p.rawDeliverWithinMinutes, 20)),
    rawOnDemandNote: safeStr(p.rawOnDemandNote),

    onDemandTimingSource: safeStr(p.onDemandTimingSource),
    onDemandMatchedCourseCode: safeStr(p.onDemandMatchedCourseCode),
    onDemandMatchedRuleId: safeStr(p.onDemandMatchedRuleId),
    onDemandMatchedRuleType: safeStr(p.onDemandMatchedRuleType),

    images: Array.isArray(p.images) ? p.images : [],
    thumbUrl: p.thumbUrl || "",
    quickUrl: p.quickUrl || "",
    thumbnailUrl: p.thumbnailUrl || "",
  }));

  let facets = {
    courses: [] as string[],
    coursesDetailed: [] as Array<{ code: string; title: string }>,
    sessions: [] as string[],
    sessionsDetailed: [] as Array<{
      name: string;
      slug: string;
      categories: string[];
      sortOrder: number;
    }>,
    languages: [] as string[],
  };

  if (includeFacets) {
    facets = await buildCategoryAwareFacets(categories);
  }

  return NextResponse.json(
    {
      ok: true,
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      facets,
      toggles: {
        onDemandSalesEnabled,
      },
      applied: {
        categories,
        course: courses,
        session: sessions,
        language: languages,
        sort: sort || "latest",
        search: search || "",
      },
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}