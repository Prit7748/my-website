import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import HeroSlide from "@/models/HeroSlide";
import { requireAdmin } from "@/lib/adminAuth";

function safeStr(x: any) {
  return String(x || "").trim();
}

function safeInt(x: any, fallback = 1000) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * GET (Public)
 * - /api/site-settings/hero-slides?device=desktop|mobile
 * Returns only ACTIVE slides (cached)
 *
 * GET (Admin)
 * - /api/site-settings/hero-slides?admin=1&device=desktop|mobile
 * Returns all slides (no cache)
 *
 * POST (Admin only)
 * - create slide
 */
export async function GET(req: NextRequest) {
  await dbConnect();

  const url = new URL(req.url);
  const adminMode = url.searchParams.get("admin") === "1";
  const device = safeStr(url.searchParams.get("device")) || "desktop";
  const deviceSafe = device === "mobile" ? "mobile" : "desktop";

  const filter: any = { device: deviceSafe };
  if (!adminMode) filter.isActive = true;

  const slides = await HeroSlide.find(filter)
    .sort({ order: 1, createdAt: -1, _id: 1 })
    .lean();

  const payload = (slides || []).map((s: any) => ({
    _id: String(s._id),
    device: s.device,
    type: s.type,
    src: s.src || "",
    link: s.link || "",
    alt: s.alt || "",
    isActive: !!s.isActive,
    order: Number(s.order || 1000),
  }));

  if (!adminMode) {
    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  }

  return NextResponse.json(payload, { status: 200 });
}

export async function POST(req: NextRequest) {
  // ✅ requireAdmin signature mismatch fix
  await (requireAdmin as any)(req);

  await dbConnect();
  const body = await req.json().catch(() => ({}));

  const deviceRaw = safeStr(body.device);
  const typeRaw = safeStr(body.type);

  const device = deviceRaw === "mobile" ? "mobile" : "desktop";
  const type = typeRaw === "video" ? "video" : "image";

  const src = safeStr(body.src);
  if (!src) {
    return NextResponse.json({ error: "src is required" }, { status: 400 });
  }

  const link = safeStr(body.link);
  const alt = safeStr(body.alt);
  const isActive = body.isActive !== false;
  const order = safeInt(body.order, 1000);

  const created = await HeroSlide.create({
    device,
    type,
    src,
    link,
    alt,
    isActive,
    order,
    lastModifiedAt: new Date(),
  });

  return NextResponse.json(
    { ok: true, _id: String(created._id) },
    { status: 201 }
  );
}
