import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import BlogCategory from "@/models/BlogCategory";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeStr(x: any) {
  return String(x ?? "").trim();
}
function toInt(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
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

// ✅ Next 16 params can be Promise — unwrap safely
async function getId(ctx: { params: Promise<{ id: string }> }, req: NextRequest) {
  try {
    const p = await ctx.params;
    return safeStr(p?.id);
  } catch {
    const parts = new URL(req.url).pathname.split("/").filter(Boolean);
    // ["api","admin","blog-categories","ID"]
    return safeStr(parts[3]);
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    await dbConnect();

    const id = await getId(ctx, req);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const c: any = await BlogCategory.findById(id).lean();
    if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(
      {
        category: {
          _id: String(c._id),
          name: safeStr(c.name),
          slug: safeStr(c.slug),
          description: safeStr(c.description),
          isActive: !!c.isActive,
          sortOrder: Number(c.sortOrder || 0),
          createdAt: c.createdAt || null,
          updatedAt: c.updatedAt || null,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: "Server error", message: e?.message || "" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    await dbConnect();

    const id = await getId(ctx, req);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await req.json().catch(() => ({} as any));
    const update: any = {};

    if (body?.name !== undefined) update.name = safeStr(body.name);
    if (body?.slug !== undefined) update.slug = slugify(body.slug);
    if (body?.description !== undefined) update.description = safeStr(body.description);
    if (body?.isActive !== undefined) update.isActive = Boolean(body.isActive);
    if (body?.sortOrder !== undefined) update.sortOrder = toInt(body.sortOrder, 0);

    if (update.name && !update.slug) update.slug = slugify(update.name);

    if (update.slug) {
      const exists = await BlogCategory.findOne({ slug: update.slug, _id: { $ne: id } })
        .select("_id")
        .lean();
      if (exists) return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }

    const c: any = await BlogCategory.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(
      {
        category: {
          _id: String(c._id),
          name: safeStr(c.name),
          slug: safeStr(c.slug),
          description: safeStr(c.description),
          isActive: !!c.isActive,
          sortOrder: Number(c.sortOrder || 0),
          updatedAt: c.updatedAt || null,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    if (String(e?.message || "").toLowerCase().includes("duplicate")) {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Server error", message: e?.message || "" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    await dbConnect();

    const id = await getId(ctx, req);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const deleted = await BlogCategory.findByIdAndDelete(id).lean();
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Server error", message: e?.message || "" },
      { status: 500 }
    );
  }
}