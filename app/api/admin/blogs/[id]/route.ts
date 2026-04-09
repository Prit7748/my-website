import { NextRequest, NextResponse } from "next/server";
import dbConnect from "../../../../../lib/db";
import Blog from "../../../../../models/Blog";
import BlogCategory from "../../../../../models/BlogCategory";
import { requireAdmin } from "../../../../../lib/adminAuth";
import sanitizeHtml from "sanitize-html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeStr(value: unknown) {
  return String(value ?? "").trim();
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
          nextAttribs.rel = rel || "nofollow noopener noreferrer";
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

async function getId(
  ctx: { params: Promise<{ id: string }> },
  req: NextRequest
) {
  try {
    const params = await ctx.params;
    return safeStr(params?.id);
  } catch {
    const parts = new URL(req.url).pathname.split("/").filter(Boolean);
    return safeStr(parts[3]); // ["api","admin","blogs","id"]
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
    isPublished: !!blog.isPublished,
    publishedAt: blog.publishedAt || null,
    createdAt: blog.createdAt || null,
    updatedAt: blog.updatedAt || null,
  };
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    await dbConnect();

    const id = await getId(ctx, req);
    if (!id) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const blog = await Blog.findById(id).lean();
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

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    await dbConnect();

    const id = await getId(ctx, req);
    if (!id) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing: any = await Blog.findById(id).lean();
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const update: Record<string, any> = {};

    const nextTitle =
      body.title !== undefined ? safeStr(body.title) : safeStr(existing.title);

    if (body.title !== undefined) {
      if (!nextTitle) {
        return NextResponse.json(
          { error: "Title is required" },
          { status: 400 }
        );
      }
      update.title = nextTitle;
    }

    if (body.slug !== undefined) {
      const nextSlug = slugify(body.slug || nextTitle);
      if (!nextSlug) {
        return NextResponse.json(
          { error: "Slug is required" },
          { status: 400 }
        );
      }
      update.slug = nextSlug;
    } else if (body.title !== undefined && !safeStr(existing.slug)) {
      update.slug = slugify(nextTitle);
    }

    if (update.slug) {
      const exists = await Blog.findOne({
        slug: update.slug,
        _id: { $ne: id },
      })
        .select("_id")
        .lean();

      if (exists) {
        return NextResponse.json(
          { error: "Slug already exists" },
          { status: 409 }
        );
      }
    }

    if (body.coverUrl !== undefined || body.imageUrl !== undefined || body.coverImageUrl !== undefined) {
      update.coverUrl =
        safeStr(body.coverUrl) ||
        safeStr(body.imageUrl) ||
        safeStr(body.coverImageUrl);
    }

    if (body.coverAlt !== undefined) {
      update.coverAlt = normalizeCoverAlt(body.coverAlt, nextTitle);
    } else if (body.title !== undefined && !safeStr(existing.coverAlt)) {
      update.coverAlt = normalizeCoverAlt("", nextTitle);
    }

    if (body.youtubeUrl !== undefined) {
      update.youtubeUrl = safeStr(body.youtubeUrl);
    }

    if (body.tags !== undefined) {
      update.tags = parseTags(body.tags);
    }

    if (body.authorName !== undefined) {
      update.authorName =
        safeStr(body.authorName) || "IGNOU Students Portal";
    }

    if (body.categoryId !== undefined) {
      update.categoryId = await normalizeCategoryId(body.categoryId);
    }

    const nextContentHtml =
      body.contentHtml !== undefined
        ? normalizeContentHtml(body.contentHtml)
        : String(existing.contentHtml || "");

    if (body.contentHtml !== undefined) {
      update.contentHtml = nextContentHtml;
    }

    const nextExcerpt =
      body.excerpt !== undefined
        ? autoExcerpt(body.excerpt, nextContentHtml)
        : body.contentHtml !== undefined
        ? autoExcerpt("", nextContentHtml)
        : safeStr(existing.excerpt);

    if (body.excerpt !== undefined || body.contentHtml !== undefined) {
      update.excerpt = nextExcerpt;
    }

    if (body.metaTitle !== undefined) {
      update.metaTitle = normalizeMetaTitle(body.metaTitle, nextTitle);
    } else if (body.title !== undefined && !safeStr(existing.metaTitle)) {
      update.metaTitle = normalizeMetaTitle("", nextTitle);
    }

    if (
      body.metaDescription !== undefined ||
      body.excerpt !== undefined ||
      body.contentHtml !== undefined
    ) {
      update.metaDescription = normalizeMetaDescription(
        body.metaDescription,
        nextExcerpt,
        nextContentHtml
      );
    }

    if (body.isPublished !== undefined) {
      const nextPublished = Boolean(body.isPublished);
      update.isPublished = nextPublished;

      if (nextPublished) {
        const manualPublishedAt = normalizePublishedAt(body.publishedAt);
        update.publishedAt =
          manualPublishedAt ||
          existing.publishedAt ||
          new Date();
      } else {
        update.publishedAt = null;
      }
    } else if (body.publishedAt !== undefined) {
      update.publishedAt = normalizePublishedAt(body.publishedAt);
    }

    const updated = await Blog.findByIdAndUpdate(id, update, {
      new: true,
    }).lean();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        blog: {
          _id: String(updated._id),
          title: safeStr(updated.title),
          slug: safeStr(updated.slug),
          excerpt: safeStr(updated.excerpt),
          metaTitle: safeStr(updated.metaTitle),
          metaDescription: safeStr(updated.metaDescription),
          coverUrl: safeStr(updated.coverUrl),
          coverAlt: safeStr(updated.coverAlt),
          isPublished: !!updated.isPublished,
          publishedAt: updated.publishedAt || null,
          updatedAt: updated.updatedAt || null,
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

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    await dbConnect();

    const id = await getId(ctx, req);
    if (!id) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const deleted = await Blog.findByIdAndDelete(id).lean();
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
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