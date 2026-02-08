// ✅ FILE: app/api/products/[slug]/route.ts (Complete Replace)
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";

function fileNameOf(urlOrPath: string) {
  const clean = (urlOrPath || "").split("?")[0];
  const parts = clean.split("/");
  return (parts[parts.length - 1] || "").toLowerCase();
}

function normalizeImagesToUrls(images: any) {
  const arr = Array.isArray(images) ? images : [];

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

// ✅ NEW: Next.js me params kabhi-kabhi Promise hota hai (fix for your other categories blank issue)
async function resolveParams<T extends Record<string, any>>(params: any): Promise<T> {
  if (params && typeof params.then === "function") return (await params) as T;
  return params as T;
}

export async function GET(
  request: Request,
  context: { params?: { slug?: string } | Promise<{ slug?: string }> } // ✅ allow promise too
) {
  await dbConnect();

  // ✅ 1) unwrap params safely
  const unwrapped = await resolveParams<{ slug?: string }>(context?.params);

  // ✅ 2) try params first
  let rawSlug: string | undefined = unwrapped?.slug;

  // ✅ 3) fallback: extract slug from URL if params missing
  // (keep your old fallback, but now it also covers promise-params edge cases)
  if (!rawSlug) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean); // ["api","products","<slug>"]
    rawSlug = parts[2];
  }

  const slug = decodeURIComponent(String(rawSlug || "")).trim();

  if (!slug) {
    return NextResponse.json(
      {
        error: "Invalid slug",
        debug: {
          rawSlug: rawSlug ?? null,
          path: new URL(request.url).pathname,
          note: "params may be promise; resolved safely",
        },
      },
      { status: 400 }
    );
  }

  // ✅ Missing isActive => treat as active
  const p: any = await Product.findOne({
    slug,
    $or: [{ isActive: true }, { isActive: { $exists: false } }],
  }).lean();

  if (!p) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { urls, thumbUrl, quickUrl } = normalizeImagesToUrls(p.images);

  const finalThumb = (p.thumbnailUrl || "").trim() || thumbUrl;
  const finalQuick = (p.quickUrl || "").trim() || quickUrl;

  const product = {
    _id: String(p._id),

    title: p.title || "",
    slug: p.slug || "",
    sku: p.sku || "",
    category: p.category || "",

    subjectCode: p.subjectCode || "",
    subjectTitleHi: p.subjectTitleHi || "",
    subjectTitleEn: p.subjectTitleEn || "",
    courseCodes: Array.isArray(p.courseCodes) ? p.courseCodes : [],
    courseTitles: Array.isArray(p.courseTitles) ? p.courseTitles : [],

    session: p.session || "",
    language: p.language || "",

    price: Number(p.price || 0),
    oldPrice: p.oldPrice !== undefined && p.oldPrice !== null ? Number(p.oldPrice) : null,

    shortDesc: p.shortDesc || "",
    descriptionHtml: p.descriptionHtml || "",

    pages: Number(p.pages || 0),
    availability: p.availability || "",
    importantNote: p.importantNote || "",

    isDigital: !!p.isDigital,
    pdfUrl: p.pdfUrl || "",

    images: urls,
    thumbnailUrl: finalThumb,
    quickUrl: finalQuick,

    createdAt: p.createdAt || null,
    updatedAt: p.updatedAt || null,
  };

  return NextResponse.json({ product }, { status: 200 });
}
