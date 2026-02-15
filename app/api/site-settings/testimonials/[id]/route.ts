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

export async function PUT(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    // ✅ 0 args
    await requireAdmin();
    await dbConnect();

    const id = ctx?.params?.id;
    const body = await req.json().catch(() => ({}));

    const patch: any = {};
    if (body?.name !== undefined) patch.name = safeStr(body.name);
    if (body?.course !== undefined) patch.course = safeStr(body.course);
    if (body?.text !== undefined) patch.text = safeStr(body.text);
    if (body?.avatarUrl !== undefined) patch.avatarUrl = safeStr(body.avatarUrl);

    if (body?.rating !== undefined) patch.rating = Math.min(5, Math.max(1, safeNum(body.rating, 5)));
    if (body?.sortOrder !== undefined) patch.sortOrder = safeNum(body.sortOrder, 1000);
    if (body?.isActive !== undefined) patch.isActive = !!body.isActive;

    const updated = await Testimonial.findByIdAndUpdate(id, patch, { new: true }).lean();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    // ✅ 0 args
    await requireAdmin();
    await dbConnect();

    const id = ctx?.params?.id;
    const deleted = await Testimonial.findByIdAndDelete(id).lean();
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
