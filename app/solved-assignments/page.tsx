import type { Metadata } from "next";
import SolvedAssignmentsClient from "./SolvedAssignmentsClient";

import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import GlobalToggle from "@/models/GlobalToggle";
import { attachResolvedOnDemandTimingToProducts } from "@/lib/onDemandTiming";

const BASE_URL = "https://istudentsportal.com";
const SOLVED = "Solved Assignments";

type PageProps = {
  searchParams?: Promise<{
    category?: string;
    course?: string;
    session?: string;
    language?: string;
    search?: string;
    page?: string;
  }>;
};

type Meta = {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
};

function safeStr(x: unknown) {
  return String(x ?? "").trim();
}

function safeNum(x: unknown, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function parseList(value?: string | null) {
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

function normalizeImagesToUrls(images: unknown) {
  const arr = Array.isArray(images) ? images : [];
  if (!arr.length) {
    return { urls: [] as string[], thumbUrl: "", quickUrl: "" };
  }

  const allStrings = arr.every((x) => typeof x === "string");
  if (allStrings) {
    const urls = Array.from(
      new Set(
        arr.map((s) => safeStr(s)).filter(Boolean)
      )
    ).sort((a, b) =>
      fileNameOf(a).localeCompare(fileNameOf(b), undefined, { numeric: true })
    );

    const thumbUrl = urls[0] || "";
    const quickUrl = urls[1] || urls[0] || "";
    return { urls, thumbUrl, quickUrl };
  }

  const strings: string[] = arr
    .filter((x): x is string => typeof x === "string")
    .map((s) => safeStr(s))
    .filter(Boolean);

  const objects = arr
    .filter(
      (x): x is { url: string; sortKey?: string; filename?: string } =>
        !!x && typeof x === "object" && "url" in x && typeof (x as any).url === "string"
    )
    .filter((x) => safeStr(x.url))
    .sort((a, b) => {
      const ak = safeStr(a.sortKey || a.filename || fileNameOf(a.url)).toLowerCase();
      const bk = safeStr(b.sortKey || b.filename || fileNameOf(b.url)).toLowerCase();
      return ak.localeCompare(bk, undefined, { numeric: true });
    })
    .map((x) => safeStr(x.url))
    .filter(Boolean);

  const urls = Array.from(new Set([...strings, ...objects])).sort((a, b) =>
    fileNameOf(a).localeCompare(fileNameOf(b), undefined, { numeric: true })
  );

  const thumbUrl = urls[0] || "";
  const quickUrl = urls[1] || urls[0] || "";

  return { urls, thumbUrl, quickUrl };
}

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

  if (a === "out_of_stock" || a === "outofstock" || a === "out-of-stock") {
    return "want_to_buy";
  }
  if (a === "want_to_buy" || a === "wanttobuy" || a === "want-to-buy") {
    return "want_to_buy";
  }

  if (a === "coming_soon" || a === "comingsoon" || a === "coming-soon") {
    return onDemandSalesEnabled ? "on_demand" : "want_to_buy";
  }

  if (a === "on_demand" || a === "ondemand" || a === "on-demand") {
    return onDemandSalesEnabled ? "on_demand" : "want_to_buy";
  }

  if (a === "available" || a === "in_stock" || a === "instock" || a === "") {
    return "available";
  }

  return "available";
}

function normalizeSearchForClientQuery(raw: string) {
  const s = safeStr(raw).toUpperCase();
  const cleaned = s.replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const compact = cleaned.replace(/\s+/g, "");

  const m1 = compact.match(/([A-Z]{2,6})(\d{2,4})/);
  if (!m1) return cleaned;

  const letters = m1[1];
  const digits = m1[2];
  const digitsNoLeading = String(Number(digits));
  const pad3 = digitsNoLeading.padStart(3, "0");

  const variants = Array.from(
    new Set([
      `${letters}${digits}`,
      `${letters}${digitsNoLeading}`,
      `${letters}-${digits}`,
      `${letters}-${digitsNoLeading}`,
      `${letters} ${digits}`,
      `${letters} ${digitsNoLeading}`,
      `${letters}${pad3}`,
      `${letters}-${pad3}`,
      `${letters} ${pad3}`,
    ])
  );

  const extra = variants.slice(0, 6).join(" ");
  return extra ? `${cleaned} ${extra}` : cleaned;
}

function buildSolvedAssignmentsQueryKey(input: {
  course?: string;
  session?: string;
  language?: string;
  search?: string;
  page?: number;
}) {
  const selectedCourse = uniqueStrings(parseList(input.course));
  const selectedSession = uniqueStrings(parseList(input.session));
  const selectedLang = uniqueStrings(parseList(input.language));
  const page = Math.max(1, safeNum(input.page, 1));

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", "12");
  params.set("includeFacets", "0");
  params.set("sort", "latest");
  params.set("category", SOLVED);

  if (selectedCourse.length) params.set("course", selectedCourse.join(","));
  if (selectedSession.length) params.set("session", selectedSession.join(","));
  if (selectedLang.length) params.set("language", selectedLang.join(","));

  const normalizedSearch = normalizeSearchForClientQuery(safeStr(input.search));
  if (normalizedSearch) params.set("search", normalizedSearch);

  return params.toString();
}

async function getInitialSolvedAssignmentsData(input: {
  course?: string;
  session?: string;
  language?: string;
  search?: string;
  page?: number;
}) {
  const courses = uniqueStrings(parseList(input.course));
  const sessions = uniqueStrings(parseList(input.session));
  const languages = uniqueStrings(parseList(input.language));

  const searchRaw = safeStr(input.search);
  const page = Math.max(1, Math.trunc(safeNum(input.page, 1)));
  const limit = 12;
  const skip = (page - 1) * limit;

  const search = searchRaw.length >= 2 ? searchRaw : "";
  const hasSearch = !!search;

  const sortObj: any = { createdAt: -1, _id: -1 };

  const filter: any = {
    isActive: true,
    category: SOLVED,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  };

  if (courses.length) filter.courseCodes = { $in: courses };
  if (sessions.length) filter.session = { $in: sessions };
  if (languages.length) filter.language = { $in: languages };

  await dbConnect();

  const onDemandSalesEnabled = await getOnDemandSalesEnabled();

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
        Product.find(textFilter)
          .select(textProjection)
          .sort(textSortObj)
          .skip(skip)
          .limit(limit)
          .lean(),
        Product.countDocuments(textFilter),
      ]);
    } catch (err: any) {
      const msg = String(err?.message || "").toLowerCase();
      const isTextIndexMissing =
        msg.includes("text index required") ||
        msg.includes("no text index") ||
        msg.includes("failed to use text index");

      if (!isTextIndexMissing) throw err;

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

    const finalThumb = safeStr(p.thumbnailUrl) || thumbUrl;
    const finalQuick = safeStr(p.quickUrl) || quickUrl;

    const rawAvailability = safeStr(p.availability || "");
    const effectiveAvailability = resolveAvailability(rawAvailability, onDemandSalesEnabled);

    return {
      _id: String(p._id),
      title: p.title || "",
      slug: p.slug || "",
      category: p.category || "",

      subjectCode: p.subjectCode || "",
      subjectTitleHi: p.subjectTitleHi || "",
      subjectTitleEn: p.subjectTitleEn || "",
      subjectTitle:
        (safeStr(p.language).toLowerCase().startsWith("hin")
          ? p.subjectTitleHi
          : p.subjectTitleEn) ||
        p.subjectTitleEn ||
        p.subjectTitleHi ||
        "",

      courseCodes: Array.isArray(p.courseCodes) ? [...p.courseCodes] : [],
      courseTitles: Array.isArray(p.courseTitles) ? [...p.courseTitles] : [],

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

      images: [...urls],
      thumbUrl: finalThumb,
      quickUrl: finalQuick,
      thumbnailUrl: finalThumb,
    };
  });

  const resolvedProducts = await attachResolvedOnDemandTimingToProducts(normalizedProducts);

  const products = resolvedProducts.map((p: any) => ({
    _id: safeStr(p._id),
    title: safeStr(p.title),
    slug: safeStr(p.slug),
    category: safeStr(p.category),

    subjectCode: safeStr(p.subjectCode),
    subjectTitleHi: safeStr(p.subjectTitleHi),
    subjectTitleEn: safeStr(p.subjectTitleEn),
    subjectTitle: safeStr(p.subjectTitle),

    courseCodes: Array.isArray(p.courseCodes)
      ? [...p.courseCodes].map((x: any) => safeStr(x))
      : [],
    courseTitles: Array.isArray(p.courseTitles)
      ? [...p.courseTitles].map((x: any) => safeStr(x))
      : [],

    session: safeStr(p.session),
    language: safeStr(p.language),

    price: Number(p.price || 0),
    oldPrice: p.oldPrice ? Number(p.oldPrice) : null,
    shortDesc: safeStr(p.shortDesc),
    isDigital: !!p.isDigital,
    pdfUrl: safeStr(p.pdfUrl),
    isActive: !!p.isActive,

    availability: safeStr(p.availability),
    rawAvailability: safeStr(p.rawAvailability),
    canPurchase: !!p.canPurchase,

    deliverWithinMinutes: Math.max(1, safeNum(p.deliverWithinMinutesResolved, 20)),
    onDemandNote: safeStr(p.onDemandNoteResolved),

    rawDeliverWithinMinutes: Math.max(1, safeNum(p.rawDeliverWithinMinutes, 20)),
    rawOnDemandNote: safeStr(p.rawOnDemandNote),

    onDemandTimingSource: safeStr(p.onDemandTimingSource),
    onDemandMatchedCourseCode: safeStr(p.onDemandMatchedCourseCode),
    onDemandMatchedRuleId: safeStr(p.onDemandMatchedRuleId),
    onDemandMatchedRuleType: safeStr(p.onDemandMatchedRuleType),

    images: Array.isArray(p.images) ? [...p.images].map((x: any) => safeStr(x)) : [],
    thumbUrl: safeStr(p.thumbUrl),
    quickUrl: safeStr(p.quickUrl),
    thumbnailUrl: safeStr(p.thumbnailUrl),
  }));

  const meta: Meta = {
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    limit,
  };

  return { products, meta };
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = (await searchParams) || {};

  const course = safeStr(sp.course);
  const session = safeStr(sp.session);
  const language = safeStr(sp.language);
  const search = safeStr(sp.search);

  const hasFilters = !!(course || session || language || search);

  const baseTitle = "Solved Assignments";
  const parts = [course, session, language].filter(Boolean);
  const dynamicTitle = parts.length ? `${baseTitle} - ${parts.join(" - ")}` : baseTitle;

  const description = hasFilters
    ? `Browse IGNOU solved assignments${course ? ` for ${course}` : ""}${session ? ` (${session})` : ""}${language ? ` in ${language}` : ""}${search ? ` matching "${search}"` : ""}.`
    : "Browse session-wise IGNOU solved assignments with course-wise discovery and fast access.";

  return {
    title: `${dynamicTitle} | IGNOU Students Portal`,
    description,
    alternates: {
      canonical: `${BASE_URL}/solved-assignments`,
    },
    robots: hasFilters ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      type: "website",
      url: `${BASE_URL}/solved-assignments`,
      title: `${dynamicTitle} | IGNOU Students Portal`,
      description,
      siteName: "IGNOU Students Portal",
    },
    twitter: {
      card: "summary_large_image",
      title: `${dynamicTitle} | IGNOU Students Portal`,
      description,
    },
  };
}

export default async function Page({ searchParams }: PageProps) {
  const sp = (await searchParams) || {};

  const initialCategoryParam = typeof sp.category === "string" ? sp.category : SOLVED;
  const initialCourseParam = typeof sp.course === "string" ? sp.course : "";
  const initialSessionParam = typeof sp.session === "string" ? sp.session : "";
  const initialLanguageParam = typeof sp.language === "string" ? sp.language : "";
  const initialSearchParam = typeof sp.search === "string" ? sp.search : "";
  const initialPageParam = typeof sp.page === "string" ? sp.page : "1";

  const pageNum = Math.max(1, Number(initialPageParam || "1") || 1);

  const { products, meta } = await getInitialSolvedAssignmentsData({
    course: initialCourseParam,
    session: initialSessionParam,
    language: initialLanguageParam,
    search: initialSearchParam,
    page: pageNum,
  });

  const initialQueryKey = buildSolvedAssignmentsQueryKey({
    course: initialCourseParam,
    session: initialSessionParam,
    language: initialLanguageParam,
    search: initialSearchParam,
    page: pageNum,
  });

  return (
    <SolvedAssignmentsClient
      initialCategoryParam={initialCategoryParam}
      initialCourseParam={initialCourseParam}
      initialSessionParam={initialSessionParam}
      initialLanguageParam={initialLanguageParam}
      initialSearchParam={initialSearchParam}
      initialPageParam={String(pageNum)}
      initialProducts={products}
      initialMeta={meta}
      initialQueryKey={initialQueryKey}
    />
  );
}