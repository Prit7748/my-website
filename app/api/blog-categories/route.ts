// ✅ NEW FILE: app/api/blog-categories/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import BlogCategory from "@/models/BlogCategory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

export async function GET(_req: NextRequest) {
  try {
    await dbConnect();

    const rows = await BlogCategory.find({ isActive: true })
      .sort({ sortOrder: 1, createdAt: -1 })
      .limit(500)
      .lean();

    const categories = (rows || []).map((c: any) => ({
      _id: String(c._id),
      name: safeStr(c.name),
      slug: safeStr(c.slug),
      description: safeStr(c.description),
      sortOrder: Number(c.sortOrder || 0),
    }));

    return NextResponse.json({ categories }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Server error", message: e?.message || "" },
      { status: 500 }
    );
  }
}
