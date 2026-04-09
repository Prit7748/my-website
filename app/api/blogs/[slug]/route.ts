import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Blog from "@/models/Blog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

async function getSlug(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  try {
    const params = await ctx.params;
    return decodeURIComponent(safeStr(params?.slug));
  } catch {
    const parts = new URL(req.url).pathname.split("/").filter(Boolean);
    return decodeURIComponent(safeStr(parts[2])); // ["api", "blogs", "<slug>"]
  }
}

function mapBlog(blog: any) {
  return {
    _id: String(blog._id),
    title: safeStr(blog.title),
    slug: safeStr(blog.slug),
    excerpt: safeStr(blog.excerpt),
    contentHtml: String(blog.contentHtml || ""),
    metaTitle: safeStr(blog.metaTitle),
    metaDescription: safeStr(blog.metaDescription),
    coverUrl: safeStr(blog.coverUrl),
    coverAlt: safeStr(blog.coverAlt),
    youtubeUrl: safeStr(blog.youtubeUrl),
    tags: Array.isArray(blog.tags) ? blog.tags.filter(Boolean) : [],
    categoryId: blog.categoryId ? String(blog.categoryId) : null,
    authorName: safeStr(blog.authorName) || "IGNOU Students Portal",
    publishedAt: blog.publishedAt || null,
    createdAt: blog.createdAt || null,
    updatedAt: blog.updatedAt || null,
  };
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  try {
    await dbConnect();

    const slug = await getSlug(req, ctx);
    if (!slug) {
      return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
    }

    const blog = await Blog.findOne({
      slug,
      isPublished: true,
      $or: [{ publishedAt: null }, { publishedAt: { $lte: new Date() } }],
    }).lean();

    if (!blog) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ blog: mapBlog(blog) }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Server error",
        message: error?.message || "",
      },
      { status: 500 }
    );
  }
}