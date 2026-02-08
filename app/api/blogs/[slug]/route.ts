// app/api/blogs/[slug]/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Blog from "@/models/Blog";

function safeStr(x: any) {
  return String(x || "").trim();
}

// ✅ Only changes:
// 1) Request -> NextRequest
// 2) ctx.params type -> Promise<{ slug: string }>
// 3) slug extraction uses await ctx.params (fallback kept)
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  try {
    await dbConnect();

    let rawSlug: string | undefined;

    // Primary: params from Next.js (awaitable in your Next 16 typing)
    try {
      const p = await ctx.params;
      rawSlug = p?.slug;
    } catch {
      rawSlug = undefined;
    }

    // Fallback: parse from URL path (kept exactly like your original intent)
    if (!rawSlug) {
      const url = new URL(req.url);
      const parts = url.pathname.split("/").filter(Boolean); // ["api","blogs","<slug>"]
      rawSlug = parts[2];
    }

    const slug = decodeURIComponent(safeStr(rawSlug));
    if (!slug) return NextResponse.json({ error: "Invalid slug" }, { status: 400 });

    const b: any = await Blog.findOne({ slug, isPublished: true }).lean();
    if (!b) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const blog = {
      _id: String(b._id),
      title: safeStr(b.title),
      slug: safeStr(b.slug),
      excerpt: safeStr(b.excerpt),
      contentHtml: String(b.contentHtml || ""),
      coverUrl: safeStr(b.coverUrl),
      youtubeUrl: safeStr(b.youtubeUrl),
      tags: Array.isArray(b.tags) ? b.tags.filter(Boolean) : [],
      authorName: safeStr(b.authorName) || "IGNOU Students Portal",
      publishedAt: b.publishedAt || null,
      createdAt: b.createdAt || null,
      updatedAt: b.updatedAt || null,
    };

    return NextResponse.json({ blog }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Server error", message: e?.message || "" },
      { status: 500 }
    );
  }
}
