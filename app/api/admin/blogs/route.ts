// ✅ UPDATE FILE: app/api/admin/blogs/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "../../../../lib/db";
import Blog from "../../../../models/Blog";
import BlogCategory from "../../../../models/BlogCategory";
import { requireAdmin } from "../../../../lib/adminAuth";
import sanitizeHtml from "sanitize-html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeStr(x: any) {
  return String(x ?? "").trim();
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
function parseTags(input: any) {
  if (Array.isArray(input)) return input.map((t) => safeStr(t)).filter(Boolean).slice(0, 25);
  const s = safeStr(input);
  if (!s) return [];
  return s.split(",").map((x) => safeStr(x)).filter(Boolean).slice(0, 25);
}

function stripHtmlToText(html: string) {
  const x = safeStr(html)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?[^>]+(>|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return x;
}

function normalizeContentHtml(input: any) {
  let s = String(input ?? "").trim();
  if (!s) return "";

  const fence = s.match(/^```(?:html|HTML)?\s*([\s\S]*?)\s*```$/);
  if (fence?.[1]) s = fence[1].trim();

  const clean = sanitizeHtml(s, {
    allowedTags: [
      "h1","h2","h3","h4","h5","h6",
      "p","br","hr","ul","ol","li",
      "b","strong","i","em","u","s",
      "blockquote","a","img","code","pre",
      "table","thead","tbody","tr","th","td",
      "span","div",
    ],
    allowedAttributes: {
      a: ["href","name","target","rel"],
      img: ["src","alt","title","width","height","loading"],
      "*": ["class","id"],
    },
    allowedSchemes: ["http","https","mailto"],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => {
        const href = safeStr(attribs.href);
        const next: any = { ...attribs };
        if (href) {
          next.rel = "nofollow noopener noreferrer";
          if (safeStr(attribs.target) === "_blank") next.target = "_blank";
        }
        return { tagName, attribs: next };
      },
    },
    disallowedTagsMode: "discard",
  });

  return safeStr(clean);
}

function autoExcerpt(excerpt: string, contentHtml: string) {
  const ex = safeStr(excerpt);
  if (ex) return ex.slice(0, 220);
  const text = stripHtmlToText(contentHtml);
  if (!text) return "";
  return text.slice(0, 180);
}

async function normalizeCategoryId(input: any) {
  const id = safeStr(input);
  if (!id) return null;
  try {
    const exists = await BlogCategory.findById(id).select("_id").lean();
    return exists ? id : null;
  } catch {
    return null;
  }
}

// ✅ Admin: list blogs
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    await dbConnect();
    const url = new URL(req.url);
    const qSearch = safeStr(url.searchParams.get("search"));
    const only = safeStr(url.searchParams.get("only")); // published | draft | ""

    const query: any = {};
    if (only === "published") query.isPublished = true;
    if (only === "draft") query.isPublished = false;

    if (qSearch) {
      const re = new RegExp(qSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ title: re }, { slug: re }, { excerpt: re }, { tags: re }];
    }

    const blogs = await Blog.find(query)
      .sort({ publishedAt: -1, updatedAt: -1, createdAt: -1 })
      .limit(200)
      .lean();

    const mapped = (blogs || []).map((b: any) => ({
      _id: String(b._id),
      title: safeStr(b.title),
      slug: safeStr(b.slug),
      excerpt: safeStr(b.excerpt),
      coverUrl: safeStr(b.coverUrl),
      tags: Array.isArray(b.tags) ? b.tags.filter(Boolean) : [],
      categoryId: b.categoryId ? String(b.categoryId) : null,
      authorName: safeStr(b.authorName) || "IGNOU Students Portal",
      isPublished: !!b.isPublished,
      publishedAt: b.publishedAt || null,
      createdAt: b.createdAt || null,
      updatedAt: b.updatedAt || null,
    }));

    return NextResponse.json({ blogs: mapped }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: "Server error", message: e?.message || "" }, { status: 500 });
  }
}

// ✅ Admin: create blog
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    await dbConnect();
    const body = await req.json();

    const title = safeStr(body.title);
    const slug = slugify(body.slug || title);

    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    if (!slug) return NextResponse.json({ error: "Slug is required" }, { status: 400 });

    const exists = await Blog.findOne({ slug }).select("_id").lean();
    if (exists) return NextResponse.json({ error: "Slug already exists" }, { status: 409 });

    const isPublished = Boolean(body.isPublished);
    const publishedAt = isPublished ? (body.publishedAt ? new Date(body.publishedAt) : new Date()) : null;

    const contentHtml = normalizeContentHtml(body.contentHtml);
    const excerpt = autoExcerpt(safeStr(body.excerpt), contentHtml);

    const categoryId = await normalizeCategoryId(body.categoryId);

    const doc = await Blog.create({
      title,
      slug,
      excerpt,
      contentHtml,
      coverUrl: safeStr(body.coverUrl),
      youtubeUrl: safeStr(body.youtubeUrl),
      tags: parseTags(body.tags),
      categoryId,
      authorName: safeStr(body.authorName) || "IGNOU Students Portal",
      isPublished,
      publishedAt,
    });

    return NextResponse.json(
      {
        blog: {
          _id: String(doc._id),
          title: safeStr(doc.title),
          slug: safeStr(doc.slug),
          isPublished: !!doc.isPublished,
          publishedAt: doc.publishedAt || null,
        },
      },
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: "Server error", message: e?.message || "" }, { status: 500 });
  }
}
