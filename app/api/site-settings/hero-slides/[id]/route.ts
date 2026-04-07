import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import HeroSlide from "@/models/HeroSlide";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

type Device = "desktop" | "mobile";
type SlideType = "image" | "video";
type Ctx = { params: Promise<{ id: string }> };

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

export async function PUT(req: NextRequest, context: Ctx) {
  try {
    await requireAdmin();
    await dbConnect();

    const { id } = await context.params;
    const slideId = safeStr(id);

    if (!slideId) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const update: Record<string, unknown> = {
      lastModifiedAt: new Date(),
    };

    if (body?.device !== undefined) {
      update.device = normalizeDevice(body.device);
    }

    if (body?.type !== undefined) {
      update.type = normalizeType(body.type);
    }

    if (body?.src !== undefined) {
      const src = safeStr(body.src);
      if (!src) {
        return NextResponse.json({ error: "src cannot be empty" }, { status: 400 });
      }
      update.src = src;
    }

    if (body?.link !== undefined) {
      update.link = safeStr(body.link);
    }

    if (body?.alt !== undefined) {
      update.alt = normalizeAlt(body.alt);
    }

    if (body?.isActive !== undefined) {
      update.isActive = !!body.isActive;
    }

    if (body?.order !== undefined) {
      update.order = normalizeOrder(body.order);
    }

    if (body?.durationSeconds !== undefined) {
      update.durationSeconds = normalizeDurationSeconds(body.durationSeconds);
    }

    const updated = await HeroSlide.findByIdAndUpdate(slideId, update, {
      new: true,
      runValidators: true,
    }).lean();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        ok: true,
        item: serializeSlide(updated),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to update hero slide" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: Ctx) {
  try {
    await requireAdmin();
    await dbConnect();

    const { id } = await context.params;
    const slideId = safeStr(id);

    if (!slideId) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const deleted = await HeroSlide.findByIdAndDelete(slideId).lean();

    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(
      { ok: true },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to delete hero slide" },
      { status: 500 }
    );
  }
}