import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import HeroSlide from "@/models/HeroSlide";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeInt(x: any, fallback = 1000) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

// ✅ Next.js build expects params as Promise
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, context: Ctx) {
  try {
    await requireAdmin(); // ✅ no args (consistent)
    await dbConnect();

    const { id } = await context.params;
    const slideId = safeStr(id);
    if (!slideId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await req.json().catch(() => ({}));

    const update: any = { lastModifiedAt: new Date() };

    if (body.device !== undefined) {
      const d = safeStr(body.device);
      update.device = d === "mobile" ? "mobile" : "desktop";
    }
    if (body.type !== undefined) {
      const t = safeStr(body.type);
      update.type = t === "video" ? "video" : "image";
    }
    if (body.src !== undefined) update.src = safeStr(body.src);
    if (body.link !== undefined) update.link = safeStr(body.link);
    if (body.alt !== undefined) update.alt = safeStr(body.alt);
    if (body.isActive !== undefined) update.isActive = !!body.isActive;
    if (body.order !== undefined) update.order = safeInt(body.order, 1000);

    const updated = await HeroSlide.findByIdAndUpdate(slideId, update, { new: true }).lean();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true, item: updated }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to update hero slide" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: Ctx) {
  try {
    await requireAdmin(); // ✅ no args
    await dbConnect();

    const { id } = await context.params;
    const slideId = safeStr(id);
    if (!slideId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const deleted = await HeroSlide.findByIdAndDelete(slideId).lean();
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to delete hero slide" },
      { status: 500 }
    );
  }
}
