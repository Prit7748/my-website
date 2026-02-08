// app/api/blogs/route.ts
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Blog from "@/models/Blog";

function safeStr(x: any) {
  return String(x || "").trim();
}

export async function GET(req: Request) {
  try {
    await dbConnect();
    const url = new URL(req.url);

    const limit = Math.min(Number(url.searchParams.get("limit") || 6), 12);
    const tag = safeStr(url.searchParams.get("tag"));
    const exclude = safeStr(url.searchParams.get("exclude"));

    const q: any = { isPublished: true };
    if (tag) q.tags = tag;
    if (exclude) q.slug = { $ne: exclude };

    const blogs = await Blog.find(q)
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    const mapped = (blogs || []).map((b: any) => ({
      _id: String(b._id),
      title: safeStr(b.title),
      slug: safeStr(b.slug),
      excerpt: safeStr(b.excerpt),
      coverUrl: safeStr(b.coverUrl),
      tags: Array.isArray(b.tags) ? b.tags.filter(Boolean) : [],
      publishedAt: b.publishedAt || null,
    }));

    return NextResponse.json({ blogs: mapped }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: "Server error", message: e?.message || "" }, { status: 500 });
  }
}
