import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Blog from "@/models/Blog";
import BlogCategory from "@/models/BlogCategory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function toInt(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSort(input: string) {
  return safeStr(input).toLowerCase() === "oldest" ? "oldest" : "newest";
}

async function resolveCategoryIdFromSlug(slug: string) {
  const cleanSlug = safeStr(slug);
  if (!cleanSlug) return "";

  try {
    const category: any = await BlogCategory.findOne({
      slug: cleanSlug,
      isActive: true,
    })
      .select("_id")
      .lean();

    return category?._id ? String(category._id) : "";
  } catch {
    return "";
  }
}

function mapBlogRow(blog: any) {
  return {
    _id: String(blog._id),
    title: safeStr(blog.title),
    slug: safeStr(blog.slug),
    excerpt: safeStr(blog.excerpt),
    metaTitle: safeStr(blog.metaTitle),
    metaDescription: safeStr(blog.metaDescription),
    coverUrl: safeStr(blog.coverUrl),
    coverAlt: safeStr(blog.coverAlt),
    tags: Array.isArray(blog.tags) ? blog.tags.filter(Boolean) : [],
    categoryId: blog.categoryId ? String(blog.categoryId) : null,
    authorName: safeStr(blog.authorName) || "IGNOU Students Portal",
    publishedAt: blog.publishedAt || null,
    createdAt: blog.createdAt || null,
    updatedAt: blog.updatedAt || null,
  };
}

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const url = new URL(req.url);

    const limitRaw = toInt(url.searchParams.get("limit"), 9);
    const pageRaw = toInt(url.searchParams.get("page"), 1);

    const limit = Math.max(1, Math.min(limitRaw, 60));
    const page = Math.max(1, pageRaw);

    const tag = safeStr(url.searchParams.get("tag"));
    const categoryIdParam = safeStr(url.searchParams.get("categoryId"));
    const categorySlug = safeStr(url.searchParams.get("categorySlug"));
    const exclude = safeStr(url.searchParams.get("exclude"));
    const search = safeStr(url.searchParams.get("search"));
    const slug = safeStr(url.searchParams.get("slug"));
    const sort = normalizeSort(url.searchParams.get("sort") || "newest");

    let resolvedCategoryId = categoryIdParam;
    if (!resolvedCategoryId && categorySlug) {
      resolvedCategoryId = await resolveCategoryIdFromSlug(categorySlug);
    }

    const query: Record<string, any> = {
      isPublished: true,
      slug: { $exists: true, $ne: "" },
      $or: [{ publishedAt: null }, { publishedAt: { $lte: new Date() } }],
    };

    if (tag) {
      query.tags = tag;
    }

    if (resolvedCategoryId) {
      query.categoryId = resolvedCategoryId;
    }

    if (exclude) {
      query.slug = { ...(query.slug || {}), $ne: exclude };
    }

    if (slug) {
      query.slug = slug;
    }

    if (search) {
      const re = new RegExp(escapeRegex(search), "i");
      query.$and = [
        {
          $or: [
            { title: re },
            { excerpt: re },
            { metaTitle: re },
            { metaDescription: re },
            { tags: re },
          ],
        },
      ];
    }

    const total = await Blog.countDocuments(query);
    const skip = (page - 1) * limit;

    const sortQuery =
      sort === "oldest"
        ? ({ publishedAt: 1, createdAt: 1, _id: 1 } as const)
        : ({ publishedAt: -1, createdAt: -1, _id: -1 } as const);

    const blogs = await Blog.find(query)
      .sort(sortQuery)
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json(
      {
        blogs: (blogs || []).map(mapBlogRow),
        total,
        page,
        totalPages,
        limit,
        filters: {
          tag: tag || "",
          categoryId: resolvedCategoryId || "",
          categorySlug: categorySlug || "",
          search: search || "",
          sort,
        },
      },
      { status: 200 }
    );
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