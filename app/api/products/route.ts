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

function normalizeImagesToUrls(images: any[]) {
  const arr = Array.isArray(images) ? images : [];

  // We sort by sortKey (best), else filename, else url filename
  const sorted = [...arr]
    .filter((img) => img && typeof img === "object" && typeof img.url === "string" && img.url.trim())
    .sort((a, b) => {
      const ak = (a.sortKey || a.filename || fileNameOf(a.url) || "").toLowerCase();
      const bk = (b.sortKey || b.filename || fileNameOf(b.url) || "").toLowerCase();
      return ak.localeCompare(bk, undefined, { numeric: true });
    });

  const urls = sorted.map((x) => x.url);
  const thumbUrl = urls[0] || "";
  const quickUrl = urls[1] || urls[0] || "";

  return { urls, thumbUrl, quickUrl };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const categories = parseList(searchParams.get("category"));
  const course = (searchParams.get("course") || "").trim();
  const session = (searchParams.get("session") || "").trim();

  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(48, Math.max(6, Number(searchParams.get("limit") || 24)));
  const skip = (page - 1) * limit;

  const sort = (searchParams.get("sort") || "latest").trim();
  let sortObj: any = { createdAt: -1 };
  if (sort === "price_asc") sortObj = { price: 1 };
  if (sort === "price_desc") sortObj = { price: -1 };

  const filter: any = { isActive: true };
  // Note: In your schema, category is [String]. Using $in works for arrays.
  if (categories.length) filter.category = { $in: categories };
  if (course) filter.courseCode = course;
  if (session) filter.session = session;

  await dbConnect();

  // ✅ Select only what frontend needs (faster, cleaner, SEO/Core Web Vitals friendly)
  const projection = {
    title: 1,
    slug: 1,
    category: 1,
    courseCode: 1,
    session: 1,
    language: 1,
    price: 1,
    oldPrice: 1,
    shortDesc: 1,
    isDigital: 1,
    pdfUrl: 1,
    isActive: 1,
    images: 1,
    thumbKey: 1,
    quickKey: 1,
    createdAt: 1,
    updatedAt: 1,
  };

  const [rawProducts, total] = await Promise.all([
    Product.find(filter).select(projection).sort(sortObj).skip(skip).limit(limit).lean(),
    Product.countDocuments(filter),
  ]);

  // ✅ Transform for UI:
  // - images => string[] urls (sorted)
  // - thumbUrl/quickUrl => helpful fields
  const products = (rawProducts || []).map((p: any) => {
    const { urls, thumbUrl, quickUrl } = normalizeImagesToUrls(p.images);
    return {
      _id: p._id,
      title: p.title,
      slug: p.slug,
      category: Array.isArray(p.category) ? p.category.join(", ") : p.category, // UI me string convenient
      courseCode: p.courseCode || "",
      session: p.session || "",
      language: p.language || "",
      price: p.price,
      oldPrice: p.oldPrice || null,
      shortDesc: p.shortDesc || "",
      isDigital: !!p.isDigital,
      pdfUrl: p.pdfUrl || "",
      isActive: !!p.isActive,

      // Frontend expects string[]
      images: urls,

      // Extra convenience
      thumbUrl,
      quickUrl,
    };
  });

  // Facets (course/session) — keep as before
  const baseForFacets: any = { isActive: true };
  if (categories.length) baseForFacets.category = { $in: categories };

  const [courseFacet, sessionFacet] = await Promise.all([
    Product.distinct("courseCode", baseForFacets),
    Product.distinct("session", baseForFacets),
  ]);

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
        courses: courseFacet.filter(Boolean).sort(),
        sessions: sessionFacet.filter(Boolean).sort(),
      },
      applied: {
        categories,
        course,
        session,
        sort,
      },
    },
    { status: 200 }
  );
}
