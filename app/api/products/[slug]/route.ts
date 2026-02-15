// ✅ FILE: app/api/products/[slug]/route.ts (COMPLETE REPLACE - params fallback safe)
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";

export const runtime = "nodejs";

function slugFromRequest(req: Request, params?: any) {
  // 1) params first
  const pSlug = params?.slug;
  if (typeof pSlug === "string" && pSlug.trim()) return decodeURIComponent(pSlug).trim();

  // 2) fallback from pathname: /api/products/<slug>
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean); // ["api","products","<slug>"]
  const raw = parts[2] || "";
  return decodeURIComponent(raw).trim();
}

export async function GET(req: Request, ctx: { params?: { slug?: string } }) {
  try {
    await dbConnect();

    const slug = slugFromRequest(req, ctx?.params);
    if (!slug) return NextResponse.json({ error: "Invalid slug" }, { status: 400 });

    const p: any = await Product.findOne({
      slug,
      $or: [{ isActive: true }, { isActive: { $exists: false } }],
    }).lean();

    if (!p) return NextResponse.json({ error: "Not found", slug }, { status: 404 });

    return NextResponse.json(
      {
        product: {
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
          pdfKey: p.pdfKey || "",

          images: Array.isArray(p.images) ? p.images : [],
          thumbnailUrl: p.thumbnailUrl || "",
          quickUrl: p.quickUrl || "",

          createdAt: p.createdAt || null,
          updatedAt: p.updatedAt || null,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: "Server error", details: e?.message || "unknown" },
      { status: 500 }
    );
  }
}
