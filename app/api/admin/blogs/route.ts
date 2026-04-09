import { NextRequest, NextResponse } from "next/server";
import dbConnect from "../../../../lib/db";
import Blog from "../../../../models/Blog";
import BlogCategory from "../../../../models/BlogCategory";
import { requireAdmin } from "../../../../lib/adminAuth";
import sanitizeHtml from "sanitize-html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function slugify(input: string) {
  return safeStr(input)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseTags(input: unknown) {
  if (Array.isArray(input)) {
    return input.map((item) => safeStr(item)).filter(Boolean).slice(0, 25);
  }

  const raw = safeStr(input);
  if (!raw) return [];

  return raw
    .split(",")
    .map((item) => safeStr(item))
    .filter(Boolean)
    .slice(0, 25);
}

function stripHtmlToText(html: string) {
  return safeStr(html)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?[^>]+(>|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isExternalHref(href: string) {
  const raw = safeStr(href);
  if (!raw) return false;
  if (raw.startsWith("/") || raw.startsWith("#")) return false;

  try {
    const linkUrl = new URL(raw);
    const siteBase =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      "https://istudentsportal.com";

    const siteUrl = new URL(siteBase);
    return linkUrl.hostname !== siteUrl.hostname;
  } catch {
    return false;
  }
}

function normalizeContentHtml(input: unknown) {
  let html = String(input ?? "").trim();
  if (!html) return "";

  const fenced = html.match(/^```(?:html|HTML)?\s*([\s\S]*?)\s*```$/);
  if (fenced?.[1]) {
    html = fenced[1].trim();
  }

  const clean = sanitizeHtml(html, {
    allowedTags: [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "br",
      "hr",
      "ul",
      "ol",
      "li",
      "b",
      "strong",
      "i",
      "em",
      "u",
      "s",
      "blockquote",
      "a",
      "img",
      "code",
      "pre",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "span",
      "div",
      "figure",
      "figcaption",
    ],
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      "*": ["class", "id"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attribs) => {
        const href = safeStr(attribs.href);
        const nextAttribs: Record<string, string> = {};

        if (href) nextAttribs.href = href;
        if (safeStr(attribs.name)) nextAttribs.name = safeStr(attribs.name);

        const target = safeStr(attribs.target);
        if (target === "_blank") {
          nextAttribs.target = "_blank";
        }

        const rel = safeStr(attribs.rel);
        if (isExternalHref(href)) {
          nextAttribs.rel = rel
            ? rel
            : "nofollow noopener noreferrer";
        } else if (rel) {
          nextAttribs.rel = rel;
        }

        return { tagName: "a", attribs: nextAttribs };
      },
      img: (_tagName, attribs) => {
        const nextAttribs: Record<string, string> = {};
        const src = safeStr(attribs.src);

        if (src) nextAttribs.src = src;
        if (safeStr(attribs.alt)) nextAttribs.alt = safeStr(attribs.alt);
        if (safeStr(attribs.title)) nextAttribs.title = safeStr(attribs.title);
        if (safeStr(attribs.width)) nextAttribs.width = safeStr(attribs.width);
        if (safeStr(attribs.height)) nextAttribs.height = safeStr(attribs.height);
        nextAttribs.loading = safeStr(attribs.loading) || "lazy";

        return { tagName: "img", attribs: nextAttribs };
      },
    },
    disallowedTagsMode: "discard",
  });

  return safeStr(clean);
}

function autoExcerpt(excerpt: string, contentHtml: string) {
  const manualExcerpt = safeStr(excerpt);
  if (manualExcerpt) return manualExcerpt.slice(0, 220);

  const text = stripHtmlToText(contentHtml);
  if (!text) return "";

  return text.slice(0, 180);
}

function normalizeMetaTitle(metaTitle: unknown, title: string) {
  const value = safeStr(metaTitle) || safeStr(title);
  return value.slice(0, 70);
}

function normalizeMetaDescription(
  metaDescription: unknown,
  excerpt: string,
  contentHtml: string
) {
  const manual = safeStr(metaDescription);
  if (manual) return manual.slice(0, 170);

  const fallback = safeStr(excerpt) || stripHtmlToText(contentHtml);
  return fallback.slice(0, 170);
}

function normalizeCoverAlt(coverAlt: unknown, title: string) {
  const value = safeStr(coverAlt) || safeStr(title);
  return value.slice(0, 140);
}

function normalizePublishedAt(input: unknown) {
  const raw = safeStr(input);
  if (!raw) return null;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function normalizeCategoryId(input: unknown) {
  const id = safeStr(input);
  if (!id) return null;

  try {
    const exists = await BlogCategory.findById(id).select("_id").lean();
    return exists ? id : null;
  } catch {
    return null;
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
    isPublished: !!blog.isPublished,
    publishedAt: blog.publishedAt || null,
    createdAt: blog.createdAt || null,
    updatedAt: blog.updatedAt || null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    await dbConnect();

    const url = new URL(req.url);
    const search = safeStr(url.searchParams.get("search"));
    const only = safeStr(url.searchParams.get("only")); // published | draft | ""

    const query: Record<string, any> = {};

    if (only === "published") query.isPublished = true;
    if (only === "draft") query.isPublished = false;

    if (search) {
      const re = new RegExp(escapeRegex(search), "i");
      query.$or = [
        { title: re },
        { slug: re },
        { excerpt: re },
        { metaTitle: re },
        { metaDescription: re },
        { tags: re },
      ];
    }

    const blogs = await Blog.find(query)
      .sort({ publishedAt: -1, updatedAt: -1, createdAt: -1 })
      .limit(200)
      .lean();

    return NextResponse.json(
      { blogs: (blogs || []).map(mapBlogRow) },
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

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    await dbConnect();

    const body = await req.json();

    const title = safeStr(body?.title);
    const slug = slugify(body?.slug || title);

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    if (!slug) {
      return NextResponse.json(
        { error: "Slug is required" },
        { status: 400 }
      );
    }

    const exists = await Blog.findOne({ slug }).select("_id").lean();
    if (exists) {
      return NextResponse.json(
        { error: "Slug already exists" },
        { status: 409 }
      );
    }

    const contentHtml = normalizeContentHtml(body?.contentHtml);
    const excerpt = autoExcerpt(body?.excerpt, contentHtml);
    const metaTitle = normalizeMetaTitle(body?.metaTitle, title);
    const metaDescription = normalizeMetaDescription(
      body?.metaDescription,
      excerpt,
      contentHtml
    );

    const coverUrl =
      safeStr(body?.coverUrl) ||
      safeStr(body?.imageUrl) ||
      safeStr(body?.coverImageUrl);

    const coverAlt = normalizeCoverAlt(body?.coverAlt, title);
    const categoryId = await normalizeCategoryId(body?.categoryId);

    const isPublished = Boolean(body?.isPublished);
    const manualPublishedAt = normalizePublishedAt(body?.publishedAt);
    const publishedAt = isPublished
      ? manualPublishedAt || new Date()
      : null;

    const doc = await Blog.create({
      title,
      slug,
      excerpt,
      contentHtml,
      metaTitle,
      metaDescription,
      coverUrl,
      coverAlt,
      youtubeUrl: safeStr(body?.youtubeUrl),
      tags: parseTags(body?.tags),
      categoryId,
      authorName: safeStr(body?.authorName) || "IGNOU Students Portal",
      isPublished,
      publishedAt,
    });

    return NextResponse.json(
      {
        blog: {
          _id: String(doc._id),
          title: safeStr(doc.title),
          slug: safeStr(doc.slug),
          excerpt: safeStr(doc.excerpt),
          metaTitle: safeStr(doc.metaTitle),
          metaDescription: safeStr(doc.metaDescription),
          coverUrl: safeStr(doc.coverUrl),
          coverAlt: safeStr(doc.coverAlt),
          isPublished: !!doc.isPublished,
          publishedAt: doc.publishedAt || null,
        },
      },
      { status: 201 }
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