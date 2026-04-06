// app/api/products/route.ts
import { NextResponse } from "next/server";

import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import GlobalToggle from "@/models/GlobalToggle";
import { attachResolvedOnDemandTimingToProducts } from "@/lib/onDemandTiming";

export const runtime = "nodejs";

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

function categorySlugFromProductCategory(category?: string) {
  const c = safeStr(category).toLowerCase();

  if (c === "solved assignments") return "solved-assignments";
  if (c === "handwritten pdfs") return "handwritten-pdfs";
  if (c.includes("handwritten") && (c.includes("hardcopy") || c.includes("delivery"))) {
    return "handwritten-hardcopy";
  }
  if (c.includes("question") && (c.includes("paper") || c.includes("pyq"))) return "question-papers";
  if (c.includes("guess")) return "guess-papers";
  if (c.includes("ebook") || c.includes("notes")) return "ebooks";
  if (c.includes("project") || c.includes("synopsis")) return "projects";
  if (c.includes("combo")) return "combo";

  return "products";
}

function normalizeImagesToUrls(images: any) {
  const arr = Array.isArray(images) ? images : [];
  if (!arr.length) {
    return { urls: [] as string[], thumbUrl: "", quickUrl: "" };
  }

  const urls = arr
    .map((x: any) => {
      if (typeof x === "string") return safeStr(x);
      if (x && typeof x === "object" && typeof x.url === "string") return safeStr(x.url);
      return "";
    })
    .filter(Boolean);

  const unique = Array.from(new Set(urls)).sort((a, b) =>
    fileNameOf(a).localeCompare(fileNameOf(b), undefined, { numeric: true })
  );

  const thumbUrl = unique[0] || "";
  const quickUrl = unique[1] || unique[0] || "";

  return { urls: unique, thumbUrl, quickUrl };
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

function buildBaseLiveFilter() {
  return {
    $and: [
      { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] },
      { $or: [{ isActive: true }, { isActive: { $exists: false } }] },
    ],
  };
}

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
    ...buildBaseLiveFilter(),
  };

  if (categories.length) filter.category = { $in: categories };
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
        regexFilter.$and = [...(Array.isArray(regexFilter.$and) ? regexFilter.$and : []), ...andParts];
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
    const categorySlug = categorySlugFromProductCategory(p.category);

    return {
      _id: p._id,

      title: p.title || "",
      slug: p.slug || "",
      category: p.category || "",
      categorySlug,
      href: `/${categorySlug}/${encodeURIComponent(p.slug || "")}`,

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
      oldPrice: p.oldPrice !== undefined && p.oldPrice !== null ? Number(p.oldPrice) : null,
      shortDesc: p.shortDesc || "",
      isDigital: !!p.isDigital,
      pdfUrl: p.pdfUrl || "",
      isActive: !!p.isActive,

      availability: effectiveAvailability,
      rawAvailability,
      canPurchase: effectiveAvailability !== "want_to_buy",

      rawDeliverWithinMinutes: Math.max(1, safeNum(p.deliverWithinMinutes, 20)),
      rawOnDemandNote: safeStr(p.onDemandNote),

      images: urls,
      thumbUrl: finalThumb,
      quickUrl: finalQuick,
      thumbnailUrl: finalThumb,

      createdAt: p.createdAt || null,
      updatedAt: p.updatedAt || null,
    };
  });

  const resolvedProducts = await attachResolvedOnDemandTimingToProducts(normalizedProducts);

  const products = resolvedProducts.map((p: any) => ({
    _id: p._id,

    title: p.title || "",
    slug: p.slug || "",
    category: p.category || "",
    categorySlug: p.categorySlug || categorySlugFromProductCategory(p.category),
    href:
      p.href ||
      `/${p.categorySlug || categorySlugFromProductCategory(p.category)}/${encodeURIComponent(p.slug || "")}`,

    subjectCode: p.subjectCode || "",
    subjectTitleHi: p.subjectTitleHi || "",
    subjectTitleEn: p.subjectTitleEn || "",
    subjectTitle: p.subjectTitle || "",

    courseCodes: Array.isArray(p.courseCodes) ? p.courseCodes : [],
    courseTitles: Array.isArray(p.courseTitles) ? p.courseTitles : [],

    session: p.session || "",
    language: p.language || "",

    price: Number(p.price || 0),
    oldPrice: p.oldPrice !== undefined && p.oldPrice !== null ? Number(p.oldPrice) : null,
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

    createdAt: p.createdAt || null,
    updatedAt: p.updatedAt || null,
  }));

  let coursesFlat: string[] = [];
  let sessionsClean: string[] = [];

  if (includeFacets) {
    const baseForFacets: any = {
      ...buildBaseLiveFilter(),
    };

    if (categories.length) baseForFacets.category = { $in: categories };

    const [courseFacetRaw, sessionFacet] = await Promise.all([
      Product.distinct("courseCodes", baseForFacets),
      Product.distinct("session", baseForFacets),
    ]);

    coursesFlat = Array.from(
      new Set(
        (courseFacetRaw || [])
          .flat()
          .map((x: any) => safeStr(x))
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    sessionsClean = (sessionFacet || [])
      .map((x: any) => safeStr(x))
      .filter(Boolean)
      .sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true }));
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
      facets: {
        courses: coursesFlat,
        sessions: sessionsClean,
      },
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