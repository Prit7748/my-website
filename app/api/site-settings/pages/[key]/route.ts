import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import PolicyPage from "@/models/PolicyPage";
import { requireAdmin } from "@/lib/adminAuth";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

async function ensureAdminOrFail() {
  const auth = await requireAdmin();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return null;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ key: string }> }
) {
  try {
    const denied = await ensureAdminOrFail();
    if (denied) return denied;

    await dbConnect();

    const { key } = await ctx.params;
    const row = await PolicyPage.findOne({ key: safeStr(key) }).lean();

    return NextResponse.json(row || null);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ key: string }> }
) {
  try {
    const denied = await ensureAdminOrFail();
    if (denied) return denied;

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