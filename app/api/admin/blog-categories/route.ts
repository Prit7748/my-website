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

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    await dbConnect();

    const url = new URL(req.url);
    const search = safeStr(url.searchParams.get("search"));
    const only = safeStr(url.searchParams.get("only")); // "active" | "inactive" | ""

    const q: any = {};
    if (only === "active") q.isActive = true;
    if (only === "inactive") q.isActive = false;

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(escaped, "i");
      q.$or = [{ name: re }, { slug: re }, { description: re }];
    }

    const rows = await BlogCategory.find(q)
      .sort({ sortOrder: 1, name: 1, updatedAt: -1 })
      .limit(500)
      .lean();

    const categories = (rows || []).map((c: any) => ({
      _id: String(c._id),
      name: safeStr(c.name),
      slug: safeStr(c.slug),
      description: safeStr(c.description),
      isActive: !!c.isActive,
      sortOrder: Number(c.sortOrder || 0),
      createdAt: c.createdAt || null,
      updatedAt: c.updatedAt || null,
    }));

    return NextResponse.json({ categories }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Server error", message: e?.message || "" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    await dbConnect();

    const body = await req.json().catch(() => ({} as any));

    const name = safeStr(body?.name);
    const slug = slugify(body?.slug || name);
    const description = safeStr(body?.description);
    const isActive = body?.isActive === undefined ? true : Boolean(body?.isActive);
    const sortOrder = toInt(body?.sortOrder, 0);

    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!slug) return NextResponse.json({ error: "Slug is required" }, { status: 400 });

    const exists = await BlogCategory.findOne({ slug }).select("_id").lean();
    if (exists) return NextResponse.json({ error: "Slug already exists" }, { status: 409 });

    const doc: any = await BlogCategory.create({
      name,
      slug,
      description,
      isActive,
      sortOrder,
    });

    return NextResponse.json(
      {
        category: {
          _id: String(doc._id),
          name: safeStr(doc.name),
          slug: safeStr(doc.slug),
          description: safeStr(doc.description),
          isActive: !!doc.isActive,
          sortOrder: Number(doc.sortOrder || 0),
          createdAt: doc.createdAt || null,
          updatedAt: doc.updatedAt || null,
        },
      },
      { status: 201 }
    );
  } catch (e: any) {
    // mongoose unique index error fallback
    if (String(e?.message || "").toLowerCase().includes("duplicate")) {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Server error", message: e?.message || "" },
      { status: 500 }
    );
  }
}
