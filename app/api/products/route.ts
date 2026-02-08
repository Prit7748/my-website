import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";

function parseList(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function fileNameOf(urlOrPath: string) {
  const clean = (urlOrPath || "").split("?")[0];
  const parts = clean.split("/");
  return (parts[parts.length - 1] || "").toLowerCase();
}

function normalizeImagesToUrls(images: any) {
  const arr = Array.isArray(images) ? images : [];

  // Support BOTH shapes:
  // 1) string[] => ["/uploads/..jpg", ...]
  // 2) object[] => [{url, sortKey, filename}, ...]
  const strings: string[] = arr
    .filter((x: any) => typeof x === "string")
    .map((s: string) => s.trim())
    .filter(Boolean);

  const objects = arr
    .filter((x: any) => x && typeof x === "object" && typeof x.url === "string" && x.url.trim())
    .sort((a: any, b: any) => {
      const ak = (a.sortKey || a.filename || fileNameOf(a.url) || "").toLowerCase();
      const bk = (b.sortKey || b.filename || fileNameOf(b.url) || "").toLowerCase();
      return ak.localeCompare(bk, undefined, { numeric: true });
    })
    .map((x: any) => x.url.trim());

  const urls = Array.from(new Set([...strings, ...objects]));
  urls.sort((a, b) => fileNameOf(a).localeCompare(fileNameOf(b), undefined, { numeric: true }));

  const thumbUrl = urls[0] || "";
  const quickUrl = urls[1] || urls[0] || "";

  return { urls, thumbUrl, quickUrl };
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** normalize query for matching: lower, remove extra spaces, treat -/_/: as spaces */
function normalizeQuery(q: string) {
  return (q || "")
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

/**
 * Flexible code matcher:
 * - "MPA36" => /mpa[\s-]*0*36/i
 * - "MPA-36" => /mpa[\s-]*0*36/i
 * - "MPA 036" => /mpa[\s-]*0*36/i
 */
function buildFlexibleCodeRegexFromQuery(q: string) {
  const n = normalizeQuery(q).replace(/\s+/g, ""); // remove spaces
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

  let s = 0;

  // Strong signals
  if (subj && nq && subj.replace(/\s+/g, "") === nq) s += 140;
  if (slug && nq && slug.replace(/\s+/g, "") === nq) s += 90;

  // Contains
  if (subj && nq && subj.replace(/\s+/g, "").includes(nq)) s += 80;
  if (title && nq && title.includes(nq)) s += 40;
  if (slug && nq && slug.includes(nq)) s += 28;

  // Token hits
  const tokens = tokenize(q);
  for (const t of tokens) {
    if (t.length < 2) continue;
    if (subj.includes(t)) s += 18;
    if (title.includes(t)) s += 10;
    if (slug.includes(t)) s += 6;
  }

  return s;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const categories = parseList(searchParams.get("category"));
  const course = (searchParams.get("course") || "").trim(); // single course code
  const session = (searchParams.get("session") || "").trim();
  const searchRaw = (searchParams.get("search") || "").trim();

  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(48, Math.max(6, Number(searchParams.get("limit") || 24)));
  const skip = (page - 1) * limit;

  const sort = (searchParams.get("sort") || "latest").trim();

  // ✅ Search: avoid junk queries (0/1 length)
  const search = searchRaw.length >= 2 ? searchRaw : "";
  const hasSearch = !!search;

  // ✅ stable sorting (tie-breaker)
  // NOTE: Step-7B => if search then we sort by textScore first (later below)
  let sortObj: any = { createdAt: -1, _id: -1 };
  if (sort === "price_asc") sortObj = { price: 1, _id: 1 };
  if (sort === "price_desc") sortObj = { price: -1, _id: -1 };

  // ✅ Base filter
  const filter: any = { isActive: true };

  // category is single string
  if (categories.length) filter.category = { $in: categories };

  // courseCodes is array
  if (course) filter.courseCodes = { $in: [course] };

  if (session) filter.session = session;

  await dbConnect();

  // ✅ keep list payload lean (industrial)
  // ✅ Step-7B: include score only when search (textScore)
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

    createdAt: 1,
    updatedAt: 1,
  };

  // ✅ Step-7B APPLY:
  // Prefer $text search (fast + weighted),
  // but if index missing => fallback to SMART token+code regex (better than old regex).
  let rawProducts: any[] = [];
  let total = 0;

  if (hasSearch) {
    // 1) try TEXT search
    const textFilter = { ...filter, $text: { $search: search } };

    // add meta score
    projection.score = { $meta: "textScore" };

    // sort by score first, then newest (stable)
    const textSortObj: any = { score: { $meta: "textScore" }, createdAt: -1, _id: -1 };

    try {
      [rawProducts, total] = await Promise.all([
        Product.find(textFilter).select(projection).sort(textSortObj).skip(skip).limit(limit).lean(),
        Product.countDocuments(textFilter),
      ]);
    } catch (err: any) {
      // 2) fallback REGEX (smart)
      const msg = String(err?.message || "");
      const isTextIndexMissing =
        msg.toLowerCase().includes("text index required") ||
        msg.toLowerCase().includes("no text index") ||
        msg.toLowerCase().includes("failed to use text index");

      if (!isTextIndexMissing) {
        throw err;
      }

      // remove meta score in regex mode
      delete projection.score;

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

      // AND across tokens => better matching for "MPA SOLVED ASSIGNMENT", etc.
      const andParts: any[] = [];

      // special code match (MPA36, MPA-36, MPA 036)
      if (codeRx) {
        andParts.push({
          $or: [{ subjectCode: codeRx }, { title: codeRx }, { slug: codeRx }],
        });
      }

      // token AND
      for (const rx of tokenRegexes) {
        andParts.push({
          $or: fieldsToSearch.map((f) => ({ [f]: rx })),
        });
      }

      // if somehow no tokens, fallback to simple regex on title/subject/slug
      if (andParts.length) {
        regexFilter.$and = andParts;
      } else {
        const safe = escapeRegex(search);
        const rx = new RegExp(safe, "i");
        regexFilter.$or = [{ subjectCode: rx }, { title: rx }, { slug: rx }];
      }

      [rawProducts, total] = await Promise.all([
        Product.find(regexFilter).select(projection).sort(sortObj).skip(skip).limit(limit).lean(),
        Product.countDocuments(regexFilter),
      ]);

      // ✅ rank within returned page for best UX (exact > partial)
      rawProducts.sort((a, b) => scoreProductForQuery(b, search) - scoreProductForQuery(a, search));
    }
  } else {
    // No search: normal listing
    [rawProducts, total] = await Promise.all([
      Product.find(filter).select(projection).sort(sortObj).skip(skip).limit(limit).lean(),
      Product.countDocuments(filter),
    ]);
  }

  const products = (rawProducts || []).map((p: any) => {
    const { urls, thumbUrl, quickUrl } = normalizeImagesToUrls(p.images);

    const finalThumb = (p.thumbnailUrl || "").trim() || thumbUrl;
    const finalQuick = (p.quickUrl || "").trim() || quickUrl;

    return {
      _id: p._id,

      title: p.title || "",
      slug: p.slug || "",
      category: p.category || "",

      subjectCode: p.subjectCode || "",
      subjectTitleHi: p.subjectTitleHi || "",
      subjectTitleEn: p.subjectTitleEn || "",

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

      images: urls,
      thumbUrl: finalThumb,
      quickUrl: finalQuick,
    };
  });

  // ✅ Facets
  const baseForFacets: any = { isActive: true };
  if (categories.length) baseForFacets.category = { $in: categories };

  const [courseFacetRaw, sessionFacet] = await Promise.all([
    Product.distinct("courseCodes", baseForFacets),
    Product.distinct("session", baseForFacets),
  ]);

  const coursesFlat = Array.from(
    new Set(
      (courseFacetRaw || [])
        .flat()
        .map((x: any) => String(x || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const sessionsClean = (sessionFacet || [])
    .map((x: any) => String(x || "").trim())
    .filter(Boolean)
    .sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true }));

  return NextResponse.json(
    {
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
      applied: {
        categories,
        course,
        session,
        sort,
        search: search || "",
      },
    },
    { status: 200 }
  );
}
