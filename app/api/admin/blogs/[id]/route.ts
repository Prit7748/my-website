// ✅ UPDATE FILE: app/api/admin/blogs/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "../../../../../lib/db";
import Blog from "../../../../../models/Blog";
import BlogCategory from "../../../../../models/BlogCategory";
import { requireAdmin } from "../../../../../lib/adminAuth";
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

// ✅ Next 16 params can be Promise — unwrap safely
async function getId(ctx: { params: Promise<{ id: string }> }, req: NextRequest) {
  try {
    const p = await ctx.params;
    return safeStr(p?.id);
  } catch {
    const parts = new URL(req.url).pathname.split("/").filter(Boolean);
    return safeStr(parts[3]); // ["api","admin","blogs","ID"]
  }
}

// ✅ Admin: get one blog
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    await dbConnect();
    const id = await getId(ctx, req);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const b: any = await Blog.findById(id).lean();
    if (!b) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(
      {
        blog: {
          _id: String(b._id),
          title: safeStr(b.title),
          slug: safeStr(b.slug),
          excerpt: safeStr(b.excerpt),
          contentHtml: String(b.contentHtml || ""),
          coverUrl: safeStr(b.coverUrl),
          youtubeUrl: safeStr(b.youtubeUrl),
          tags: Array.isArray(b.tags) ? b.tags.filter(Boolean) : [],
          categoryId: b.categoryId ? String(b.categoryId) : null,
          authorName: safeStr(b.authorName) || "IGNOU Students Portal",
          isPublished: !!b.isPublished,
          publishedAt: b.publishedAt || null,
          createdAt: b.createdAt || null,
          updatedAt: b.updatedAt || null,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: "Server error", message: e?.message || "" }, { status: 500 });
  }
}

// ✅ Admin: update blog
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    await dbConnect();
    const id = await getId(ctx, req);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await req.json();
    const update: any = {};

    if (body.title !== undefined) update.title = safeStr(body.title);
    if (body.slug !== undefined) update.slug = slugify(body.slug);
    if (body.coverUrl !== undefined) update.coverUrl = safeStr(body.coverUrl);
    if (body.youtubeUrl !== undefined) update.youtubeUrl = safeStr(body.youtubeUrl);
    if (body.tags !== undefined) update.tags = parseTags(body.tags);
    if (body.authorName !== undefined) update.authorName = safeStr(body.authorName) || "IGNOU Students Portal";

    if (body.categoryId !== undefined) {
      update.categoryId = await normalizeCategoryId(body.categoryId);
    }

    if (body.contentHtml !== undefined) {
      update.contentHtml = normalizeContentHtml(body.contentHtml);
      if (body.excerpt === undefined) update.excerpt = autoExcerpt("", update.contentHtml);
    }
    if (body.excerpt !== undefined) update.excerpt = safeStr(body.excerpt).slice(0, 220);

    if (update.title && !update.slug) update.slug = slugify(update.title);

    if (update.slug) {
      const exists = await Blog.findOne({ slug: update.slug, _id: { $ne: id } }).select("_id").lean();
      if (exists) return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }

    if (body.isPublished !== undefined) {
      const nextPub = Boolean(body.isPublished);
      update.isPublished = nextPub;
      if (nextPub) update.publishedAt = body.publishedAt ? new Date(body.publishedAt) : new Date();
      else update.publishedAt = null;
    } else if (body.publishedAt !== undefined) {
      update.publishedAt = body.publishedAt ? new Date(body.publishedAt) : null;
    }

    const b: any = await Blog.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!b) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(
      {
        blog: {
          _id: String(b._id),
          title: safeStr(b.title),
          slug: safeStr(b.slug),
          isPublished: !!b.isPublished,
          publishedAt: b.publishedAt || null,
          updatedAt: b.updatedAt || null,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: "Server error", message: e?.message || "" }, { status: 500 });
  }
}

// ✅ Admin: delete blog
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    await dbConnect();
    const id = await getId(ctx, req);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const deleted = await Blog.findByIdAndDelete(id).lean();
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: "Server error", message: e?.message || "" }, { status: 500 });
  }
}
