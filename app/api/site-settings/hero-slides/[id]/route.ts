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

export async function PUT(req: NextRequest, ctx: { params: { id: string } }) {
  // ✅ requireAdmin signature mismatch fix
  await (requireAdmin as any)(req);

  await dbConnect();

  const id = ctx?.params?.id;
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

  const updated = await HeroSlide.findByIdAndUpdate(id, update, {
    new: true,
  }).lean();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  // ✅ requireAdmin signature mismatch fix
  await (requireAdmin as any)(req);

  await dbConnect();

  const id = ctx?.params?.id;
  const deleted = await HeroSlide.findByIdAndDelete(id).lean();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
