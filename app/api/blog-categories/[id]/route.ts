import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import BlogCategory from "../../../../models/BlogCategory";

function safeStr(x: any) {
  return String(x || "").trim();
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

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    await dbConnect();

    let id = "";
    try {
      const p = await ctx.params;
      id = safeStr(p?.id);
    } catch {
      id = "";
    }

    // Fallback ID extraction if params fail
    if (!id) {
      const url = new URL(req.url);
      const parts = url.pathname.split("/").filter(Boolean); // ["api","blog-categories","<id>"]
      id = safeStr(parts[2]);
    }

    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await req.json();

    const update: any = {};
    if (body.name !== undefined) update.name = safeStr(body.name);
    if (body.slug !== undefined) update.slug = slugify(body.slug);
    if (body.description !== undefined) update.description = safeStr(body.description);
    if (body.seoTitle !== undefined) update.seoTitle = safeStr(body.seoTitle);
    if (body.seoDescription !== undefined) update.seoDescription = safeStr(body.seoDescription);
    if (body.sortOrder !== undefined) update.sortOrder = Number(body.sortOrder || 0);
    if (body.isActive !== undefined) update.isActive = Boolean(body.isActive);

    if (update.name && !update.slug) update.slug = slugify(update.name);

    // Ensure slug uniqueness if changed
    if (update.slug) {
      const exists = await BlogCategory.findOne({
        slug: update.slug,
        _id: { $ne: id },
      });
      if (exists) {
        return NextResponse.json(
          { error: "Slug already exists" },
          { status: 400 }
        );
      }
    }

    const category = await BlogCategory.findByIdAndUpdate(id, update, {
      new: true,
    }).lean();
    
    if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ category }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", message: err?.message },
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
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    await dbConnect();

    let id = "";
    try {
      const p = await ctx.params;
      id = safeStr(p?.id);
    } catch {
      id = "";
    }

    if (!id) {
      const url = new URL(req.url);
      const parts = url.pathname.split("/").filter(Boolean);
      id = safeStr(parts[2]);
    }

    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const deleted = await BlogCategory.findByIdAndDelete(id).lean();
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", message: err?.message },
      { status: 500 }
    );
  }
}