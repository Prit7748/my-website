import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import SocialLink from "../../../../../models/SocialLink";

export const runtime = "nodejs";

function num(x: any, d = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
}
function safeStr(x: any) {
  return String(x ?? "").trim();
}
function isValidUrl(u: string) {
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// ✅ Next.js build expects params as Promise
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: Ctx) {
  try {
    await requireAdmin(); // ✅ no args
    await dbConnect();

    const { id } = await context.params;
    const docId = safeStr(id);
    if (!docId) return NextResponse.json({ ok: false, message: "Invalid id" }, { status: 400 });

    const item = await SocialLink.findById(docId).lean();
    if (!item)
      return NextResponse.json({ ok: false, message: "Social link not found" }, { status: 404 });

    return NextResponse.json({ ok: true, item }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Failed to fetch social link" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, context: Ctx) {
  try {
    await requireAdmin(); // ✅ no args
    await dbConnect();

    const { id } = await context.params;
    const docId = safeStr(id);
    if (!docId) return NextResponse.json({ ok: false, message: "Invalid id" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const update: any = {};

    if (body?.name !== undefined) update.name = safeStr(body.name);
    if (body?.url !== undefined) update.url = safeStr(body.url);
    if (body?.icon !== undefined) update.icon = safeStr(body.icon);
    if (body?.isActive !== undefined) update.isActive = !!body.isActive;
    if (body?.sortOrder !== undefined) update.sortOrder = num(body.sortOrder, 0);

    if (update.name !== undefined && update.name.length < 2)
      return NextResponse.json({ ok: false, message: "Name min 2 chars." }, { status: 400 });

    if (update.url !== undefined && !isValidUrl(update.url))
      return NextResponse.json({ ok: false, message: "Valid https URL required." }, { status: 400 });

    const item = await SocialLink.findByIdAndUpdate(docId, update, { new: true }).lean();
    if (!item)
      return NextResponse.json({ ok: false, message: "Social link not found" }, { status: 404 });

    return NextResponse.json({ ok: true, item }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Failed to update social link" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: Ctx) {
  try {
    await requireAdmin(); // ✅ no args
    await dbConnect();

    const { id } = await context.params;
    const docId = safeStr(id);
    if (!docId) return NextResponse.json({ ok: false, message: "Invalid id" }, { status: 400 });

    const removed = await SocialLink.findByIdAndDelete(docId).lean();
    if (!removed)
      return NextResponse.json({ ok: false, message: "Social link not found" }, { status: 404 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Failed to delete social link" },
      { status: 500 }
    );
  }
}
