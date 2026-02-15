import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Testimonial from "@/models/Testimonial";
import { requireAdmin } from "@/lib/adminAuth";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, fallback: number) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * GET: public (active only) OR admin (all)
 * /api/site-settings/testimonials
 * /api/site-settings/testimonials?admin=1
 */
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const url = new URL(req.url);
    const adminMode = url.searchParams.get("admin") === "1";

    // ✅ Your project requireAdmin() expects 0 args
    if (adminMode) await requireAdmin();

    const query = adminMode ? {} : { isActive: true };

    const rows = await Testimonial.find(query)
      .sort({ sortOrder: 1, createdAt: -1, _id: 1 })
      .limit(adminMode ? 200 : 30)
      .lean();

    return NextResponse.json(rows || []);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

/**
 * POST: admin only
 */
export async function POST(req: NextRequest) {
  try {
    // ✅ 0 args
    await requireAdmin();
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const name = safeStr(body?.name);
    const course = safeStr(body?.course);
    const text = safeStr(body?.text);

    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
    if (!course) return NextResponse.json({ error: "Course required" }, { status: 400 });
    if (!text) return NextResponse.json({ error: "Text required" }, { status: 400 });

    const rating = Math.min(5, Math.max(1, safeNum(body?.rating, 5)));
    const sortOrder = safeNum(body?.sortOrder, 1000);
    const isActive = body?.isActive !== false;

    const avatarUrl = safeStr(body?.avatarUrl);

    const created = await Testimonial.create({
      name,
      course,
      text,
      rating,
      sortOrder,
      isActive,
      avatarUrl,
    });

    return NextResponse.json(created);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
