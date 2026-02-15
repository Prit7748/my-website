import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Testimonial from "@/models/Testimonial";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

function safeStr(x: any) {
  return String(x ?? "").trim();
}
function safeNum(x: any, fallback: number) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

// ✅ Next.js build expects params as Promise
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, context: Ctx) {
  try {
    await requireAdmin(); // ✅ 0 args
    await dbConnect();

    const { id } = await context.params;
    const docId = safeStr(id);
    if (!docId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await req.json().catch(() => ({}));

    const patch: any = {};
    if (body?.name !== undefined) patch.name = safeStr(body.name);
    if (body?.course !== undefined) patch.course = safeStr(body.course);
    if (body?.text !== undefined) patch.text = safeStr(body.text);
    if (body?.avatarUrl !== undefined) patch.avatarUrl = safeStr(body.avatarUrl);

    if (body?.rating !== undefined) patch.rating = Math.min(5, Math.max(1, safeNum(body.rating, 5)));
    if (body?.sortOrder !== undefined) patch.sortOrder = safeNum(body.sortOrder, 1000);
    if (body?.isActive !== undefined) patch.isActive = !!body.isActive;

    const updated = await Testimonial.findByIdAndUpdate(docId, patch, { new: true }).lean();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(updated, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: Ctx) {
  try {
    await requireAdmin(); // ✅ 0 args
    await dbConnect();

    const { id } = await context.params;
    const docId = safeStr(id);
    if (!docId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const deleted = await Testimonial.findByIdAndDelete(docId).lean();
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
