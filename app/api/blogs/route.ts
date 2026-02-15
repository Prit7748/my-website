// ✅ UPDATE FILE: app/api/blogs/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Blog from "@/models/Blog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeStr(x: any) {
  return String(x ?? "").trim();
}
function toInt(x: any, fallback: number) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const url = new URL(req.url);

    const limitRaw = toInt(url.searchParams.get("limit"), 6);
    const limit = Math.max(1, Math.min(limitRaw, 60));
    const pageRaw = toInt(url.searchParams.get("page"), 1);
    const page = Math.max(1, pageRaw);

    const tag = safeStr(url.searchParams.get("tag"));
    const categoryId = safeStr(url.searchParams.get("categoryId")); // ✅ NEW
    const exclude = safeStr(url.searchParams.get("exclude"));
    const search = safeStr(url.searchParams.get("search"));

    const q: any = { isPublished: true };

    if (tag) q.tags = tag;
    if (categoryId) q.categoryId = categoryId;
    if (exclude) q.slug = { $ne: exclude };

    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      q.$or = [{ title: re }, { excerpt: re }, { tags: re }];
    }

    const total = await Blog.countDocuments(q);
    const skip = (page - 1) * limit;

    const blogs = await Blog.find(q)
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const mapped = (blogs || []).map((b: any) => ({
      _id: String(b._id),
      title: safeStr(b.title),
      slug: safeStr(b.slug),
      excerpt: safeStr(b.excerpt),
      coverUrl: safeStr(b.coverUrl),
      tags: Array.isArray(b.tags) ? b.tags.filter(Boolean) : [],
      categoryId: b.categoryId ? String(b.categoryId) : null,
      publishedAt: b.publishedAt || null,
    }));

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({ blogs: mapped, total, page, totalPages, limit }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: "Server error", message: e?.message || "" }, { status: 500 });
  }
}
