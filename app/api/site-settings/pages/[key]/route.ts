import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import PolicyPage from "@/models/PolicyPage";
import { requireAdmin } from "@/lib/adminAuth";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

// ✅ GET single (admin)
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ key: string }> }
) {
  try {
    await requireAdmin();
    await dbConnect();

    const { key } = await ctx.params;
    const row = await PolicyPage.findOne({ key: safeStr(key) }).lean();
    return NextResponse.json(row || null);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

// ✅ PUT update (admin)
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ key: string }> }
) {
  try {
    await requireAdmin();
    await dbConnect();

    const { key } = await ctx.params;
    const body = await req.json().catch(() => ({}));

    const patch: any = {};
    if (body?.title !== undefined) patch.title = safeStr(body.title);
    if (body?.subtitle !== undefined) patch.subtitle = safeStr(body.subtitle);
    if (body?.contentHtml !== undefined) patch.contentHtml = String(body.contentHtml || "");
    if (body?.isEnabled !== undefined) patch.isEnabled = !!body.isEnabled;

    const saved = await PolicyPage.findOneAndUpdate(
      { key: safeStr(key) },
      { $set: patch },
      { new: true, upsert: true }
    ).lean();

    return NextResponse.json(saved);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
