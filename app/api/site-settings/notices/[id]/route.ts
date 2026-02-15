import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Notice from "@/models/Notice";
import { requireAdmin } from "@/lib/adminAuth";

function safeStr(x: any) {
  return String(x || "").trim();
}
function safeInt(x: any, fallback = 1000) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

export async function PUT(req: NextRequest, ctx: { params: { id: string } }) {
  await (requireAdmin as any)(req);
  await dbConnect();

  const id = ctx?.params?.id;
  const body = await req.json().catch(() => ({}));

  const update: any = { lastModifiedAt: new Date() };

  if (body.title !== undefined) update.title = safeStr(body.title);
  if (body.href !== undefined) update.href = safeStr(body.href);
  if (body.badge !== undefined) update.badge = safeStr(body.badge);
  if (body.isActive !== undefined) update.isActive = !!body.isActive;
  if (body.order !== undefined) update.order = safeInt(body.order, 1000);
  if (body.expiresAt !== undefined) {
    const d = body.expiresAt ? new Date(body.expiresAt) : null;
    update.expiresAt = d && !isNaN(d.getTime()) ? d : null;
  }

  const updated = await Notice.findByIdAndUpdate(id, update, { new: true }).lean();
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  await (requireAdmin as any)(req);
  await dbConnect();

  const id = ctx?.params?.id;
  const deleted = await Notice.findByIdAndDelete(id).lean();
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true }, { status: 200 });
}
