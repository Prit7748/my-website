import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import HeroSlide from "@/models/HeroSlide";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

type Device = "desktop" | "mobile";
type SlideType = "image" | "video";

function safeStr(x: unknown) {
  return String(x ?? "").trim();
}

function safeInt(x: unknown, fallback = 1000) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function normalizeDevice(value: unknown): Device {
  return safeStr(value).toLowerCase() === "mobile" ? "mobile" : "desktop";
}

function normalizeType(value: unknown): SlideType {
  return safeStr(value).toLowerCase() === "video" ? "video" : "image";
}

function normalizeSrc(value: unknown) {
  return safeStr(value);
}

function normalizeLink(value: unknown) {
  return safeStr(value);
}

function normalizeAlt(value: unknown) {
  return safeStr(value).slice(0, 220);
}

function normalizeOrder(value: unknown) {
  const n = safeInt(value, 1000);
  if (n < 0) return 0;
  if (n > 999999) return 999999;
  return n;
}

function normalizeDurationSeconds(value: unknown) {
  const n = safeInt(value, 5);
  if (n < 1) return 1;
  if (n > 60) return 60;
  return n;
}

function serializeSlide(s: any) {
  return {
    _id: String(s?._id || ""),
    device: normalizeDevice(s?.device),
    type: normalizeType(s?.type),
    src: safeStr(s?.src),
    link: safeStr(s?.link),
    alt: safeStr(s?.alt),
    isActive: !!s?.isActive,
    order: normalizeOrder(s?.order),
    durationSeconds: normalizeDurationSeconds(s?.durationSeconds),
    createdAt: s?.createdAt ? new Date(s.createdAt).toISOString() : null,
    updatedAt: s?.updatedAt ? new Date(s.updatedAt).toISOString() : null,
    lastModifiedAt: s?.lastModifiedAt
      ? new Date(s.lastModifiedAt).toISOString()
      : null,
  };
}

/**
 * GET (Public)
 * /api/site-settings/hero-slides?device=desktop|mobile
 * Returns only active slides
 *
 * GET (Admin)
 * /api/site-settings/hero-slides?admin=1&device=desktop|mobile
 * Returns all slides
 *
 * POST (Admin)
 * Create slide
 */
export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const adminMode = searchParams.get("admin") === "1";
    const device = normalizeDevice(searchParams.get("device"));

    const filter: Record<string, unknown> = { device };
    if (!adminMode) {
      filter.isActive = true;
    }

    const rows = await HeroSlide.find(filter)
      .sort({ order: 1, createdAt: -1, _id: 1 })
      .lean();

    const payload = (Array.isArray(rows) ? rows : []).map(serializeSlide);

    if (adminMode) {
      return NextResponse.json(payload, {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to load hero slides" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    await dbConnect();

    const body = await req.json().catch(() => ({}));

    const device = normalizeDevice(body?.device);
    const type = normalizeType(body?.type);
    const src = normalizeSrc(body?.src);
    const link = normalizeLink(body?.link);
    const alt = normalizeAlt(body?.alt);
    const order = normalizeOrder(body?.order);
    const durationSeconds = normalizeDurationSeconds(body?.durationSeconds);
    const isActive = body?.isActive !== false;

    if (!src) {
      return NextResponse.json({ error: "src is required" }, { status: 400 });
    }

    const created = await HeroSlide.create({
      device,
      type,
      src,
      link,
      alt,
      isActive,
      order,
      durationSeconds,
      lastModifiedAt: new Date(),
    });

    return NextResponse.json(
      {
        ok: true,
        item: serializeSlide(created),
      },
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to create hero slide" },
      { status: 500 }
    );
  }
}