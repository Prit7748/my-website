// app/api/admin/products/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import { getAuthUser, hasPermission } from "@/lib/auth";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function safeArr(x: any) {
  if (Array.isArray(x)) return x.map((v) => safeStr(v)).filter(Boolean);
  if (typeof x === "string") return x.split(",").map((v) => v.trim()).filter(Boolean);
  return [];
}

function toSlug(input: string) {
  return safeStr(input)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ✅ Avoid TS error: AuthUser may not have _id typed
function getUserId(user: any) {
  return safeStr(user?._id || user?.id || user?.userId || user?.email || "");
}

async function makeUniqueSlug(base: string) {
  const clean = toSlug(base) || "product";
  let slug = clean;
  let i = 1;
  while (await Product.findOne({ slug })) {
    i += 1;
    slug = `${clean}-${i}`;
  }
  return slug;
}

async function makeUniqueSku(base: string) {
  const clean = safeStr(base).toUpperCase().replace(/\s+/g, "-") || "SKU";
  let sku = clean;
  let i = 1;
  while (await Product.findOne({ sku })) {
    i += 1;
    sku = `${clean}-C${i}`;
  }
  return sku;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!hasPermission(user, "products:read") && !hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden (products permission missing)" }, { status: 403 });
  }

  await dbConnect();
  const { id } = await ctx.params;

  const product = await Product.findById(id);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  return NextResponse.json({ product }, { status: 200 });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden (products:write missing)" }, { status: 403 });
  }

  const body = await req.json();
  await dbConnect();
  const { id } = await ctx.params;

  const product: any = await Product.findById(id);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  if (body?.title !== undefined) product.title = safeStr(body.title);
  if (body?.category !== undefined) product.category = safeStr(body.category);

  if (body?.subjectCode !== undefined) product.subjectCode = safeStr(body.subjectCode);
  if (body?.subjectTitleHi !== undefined) product.subjectTitleHi = safeStr(body.subjectTitleHi);
  if (body?.subjectTitleEn !== undefined) product.subjectTitleEn = safeStr(body.subjectTitleEn);

  if (body?.courseCodes !== undefined) product.courseCodes = safeArr(body.courseCodes);
  if (body?.courseTitles !== undefined) product.courseTitles = safeArr(body.courseTitles);

  if (body?.session !== undefined) product.session = safeStr(body.session);
  if (body?.session6 !== undefined) product.session6 = safeStr(body.session6);
  if (body?.language !== undefined) product.language = safeStr(body.language);
  if (body?.lang3 !== undefined) product.lang3 = safeStr(body.lang3);

  if (body?.price !== undefined) product.price = safeNum(body.price, 0);
  if (body?.oldPrice !== undefined) product.oldPrice = safeNum(body.oldPrice, 0);

  if (body?.pages !== undefined) product.pages = safeNum(body.pages, 0);
  if (body?.availability !== undefined) product.availability = safeStr(body.availability) || "available";
  if (body?.importantNote !== undefined) product.importantNote = safeStr(body.importantNote);

  if (body?.shortDesc !== undefined) product.shortDesc = safeStr(body.shortDesc);
  if (body?.descriptionHtml !== undefined) product.descriptionHtml = safeStr(body.descriptionHtml);

  if (body?.isDigital !== undefined) product.isDigital = Boolean(body.isDigital);

  if (body?.pdfKey !== undefined) product.pdfKey = safeStr(body.pdfKey);
  if (body?.pdfUrl !== undefined) product.pdfUrl = safeStr(body.pdfUrl);

  if (body?.images !== undefined) product.images = safeArr(body.images);
  if (body?.thumbnailUrl !== undefined) product.thumbnailUrl = safeStr(body.thumbnailUrl);
  if (body?.quickUrl !== undefined) product.quickUrl = safeStr(body.quickUrl);

  if (body?.metaTitle !== undefined) product.metaTitle = safeStr(body.metaTitle);
  if (body?.metaDescription !== undefined) product.metaDescription = safeStr(body.metaDescription);

  if (body?.isActive !== undefined) product.isActive = Boolean(body.isActive);

  if (body?.slug !== undefined) {
    const nextSlug = toSlug(safeStr(body.slug) || product.title);
    const conflict = await Product.findOne({ slug: nextSlug, _id: { $ne: product._id } });
    if (conflict) return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    product.slug = nextSlug;
  }

  if (body?.sku !== undefined) {
    const nextSku = safeStr(body.sku);
    const conflict = await Product.findOne({ sku: nextSku, _id: { $ne: product._id } });
    if (conflict) return NextResponse.json({ error: "SKU already exists" }, { status: 409 });
    product.sku = nextSku;
  }

  product.lastModifiedAt = new Date();
  await product.save();

  return NextResponse.json({ ok: true, message: "Product updated", product }, { status: 200 });
}

// ✅ Soft delete -> Trash
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden (products:write missing)" }, { status: 403 });
  }

  await dbConnect();
  const { id } = await ctx.params;

  const product: any = await Product.findById(id);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  if (product.deletedAt) {
    return NextResponse.json({ ok: true, message: "Already in trash", productId: product._id }, { status: 200 });
  }

  product.deletedAt = new Date();
  product.deletedBy = getUserId(user);
  product.lastModifiedAt = new Date();
  await product.save();

  return NextResponse.json({ ok: true, message: "Moved to trash", productId: product._id }, { status: 200 });
}

// ✅ Actions: restore / purge / duplicate
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden (products:write missing)" }, { status: 403 });
  }

  const action = req.nextUrl.searchParams.get("action") || "";
  await dbConnect();
  const { id } = await ctx.params;

  if (action === "restore") {
    const product: any = await Product.findById(id);
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    product.deletedAt = null;
    product.deletedBy = "";
    product.lastModifiedAt = new Date();
    await product.save();

    return NextResponse.json({ ok: true, message: "Restored", productId: product._id }, { status: 200 });
  }

  if (action === "purge") {
    const product: any = await Product.findById(id);
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    if (!product.deletedAt) {
      return NextResponse.json({ error: "Product is not in trash. Move to trash first." }, { status: 400 });
    }

    await Product.deleteOne({ _id: id });
    return NextResponse.json({ ok: true, message: "Permanently deleted", productId: id }, { status: 200 });
  }

  if (action === "duplicate") {
    const src: any = await Product.findById(id);
    if (!src) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const newSlug = await makeUniqueSlug(`${src.slug}-copy`);
    const newSku = await makeUniqueSku(`${src.sku}-COPY`);

    const created = await Product.create({
      title: `${safeStr(src.title)} (Copy)`,
      slug: newSlug,
      sku: newSku,

      category: src.category,

      subjectCode: src.subjectCode,
      subjectTitleHi: src.subjectTitleHi,
      subjectTitleEn: src.subjectTitleEn,

      courseCodes: Array.isArray(src.courseCodes) ? src.courseCodes : [],
      courseTitles: Array.isArray(src.courseTitles) ? src.courseTitles : [],

      session: src.session,
      session6: src.session6,
      language: src.language,
      lang3: src.lang3,

      price: src.price,
      oldPrice: src.oldPrice,

      pages: src.pages,
      availability: src.availability,
      importantNote: src.importantNote,

      shortDesc: src.shortDesc,
      descriptionHtml: src.descriptionHtml,

      isDigital: src.isDigital,
      pdfKey: src.pdfKey,
      pdfUrl: src.pdfUrl,

      images: Array.isArray(src.images) ? src.images : [],
      thumbnailUrl: src.thumbnailUrl,
      quickUrl: src.quickUrl,

      metaTitle: src.metaTitle,
      metaDescription: src.metaDescription,

      isActive: false,
      lastModifiedAt: new Date(),

      deletedAt: null,
      deletedBy: "",
    });

    return NextResponse.json({ ok: true, message: "Product duplicated", product: created }, { status: 201 });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
