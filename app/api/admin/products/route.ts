import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import { getAuthUser, hasPermission } from "@/lib/auth";

function toSlug(input: string) {
  return (input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function asString(x: any) {
  return (x ?? "").toString().trim();
}

function asNumber(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function asStringArray(x: any) {
  if (Array.isArray(x)) return x.map((v) => asString(v)).filter(Boolean);
  if (typeof x === "string") return x.split(",").map((v) => v.trim()).filter(Boolean);
  return [];
}

// GET: list products (admin)
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!hasPermission(user, "products:read") && !hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden (products permission missing)" }, { status: 403 });
  }

  await dbConnect();
  const products = await Product.find().sort({ createdAt: -1 }).limit(200);
  return NextResponse.json({ products }, { status: 200 });
}

// POST: create product (admin)
export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden (products:write missing)" }, { status: 403 });
  }

  const body = await req.json();

  const title = asString(body?.title);
  const category = asString(body?.category);
  const price = asNumber(body?.price, 0);

  if (!title || !category || !price) {
    return NextResponse.json({ error: "title, category, price are required" }, { status: 400 });
  }

  const slug = toSlug(body?.slug ? String(body.slug) : title);
  const sku = asString(body?.sku);

  await dbConnect();

  // uniqueness checks
  const existsSlug = await Product.findOne({ slug });
  if (existsSlug) return NextResponse.json({ error: "Slug already exists" }, { status: 409 });

  if (sku) {
    const existsSku = await Product.findOne({ sku });
    if (existsSku) return NextResponse.json({ error: "SKU already exists" }, { status: 409 });
  }

  // images normalize + auto thumbnail/quick
  const images = asStringArray(body?.images);
  const thumbnailUrl = asString(body?.thumbnailUrl) || images[0] || "";
  const quickUrl = asString(body?.quickUrl) || images[1] || images[0] || "";

  const doc = await Product.create({
    // Identity
    title,
    slug,
    sku: sku || "",

    // Category
    category,

    // Subject fields (if your schema has them)
    subjectCode: asString(body?.subjectCode),
    subjectTitleHi: asString(body?.subjectTitleHi),
    subjectTitleEn: asString(body?.subjectTitleEn),

    // Course mapping (arrays)
    courseCodes: asStringArray(body?.courseCodes),
    courseTitles: asStringArray(body?.courseTitles),

    // Session + Language
    session: asString(body?.session),
    session6: asString(body?.session6),
    language: asString(body?.language),
    lang3: asString(body?.lang3),

    // Pricing
    price,
    oldPrice: asNumber(body?.oldPrice, 0),

    // Extra fields
    pages: asNumber(body?.pages, 0),
    availability: asString(body?.availability) || "available",
    importantNote: asString(body?.importantNote),

    // Descriptions
    shortDesc: asString(body?.shortDesc),
    descriptionHtml: asString(body?.descriptionHtml),

    // Digital
    isDigital: Boolean(body?.isDigital ?? true),
    pdfUrl: asString(body?.pdfUrl),

    // Images system
    images,
    thumbnailUrl,
    quickUrl,

    // SEO
    metaTitle: asString(body?.metaTitle),
    metaDescription: asString(body?.metaDescription),

    // Publish
    isActive: Boolean(body?.isActive ?? false),
    lastModifiedAt: new Date(),
  });

  return NextResponse.json({ message: "Product created", product: doc }, { status: 201 });
}
