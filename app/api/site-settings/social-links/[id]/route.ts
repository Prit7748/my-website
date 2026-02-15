import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import SocialLink from "../../../../../models/SocialLink";

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

type Ctx = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    await requireAdmin(); // ✅ no args
    await dbConnect();

    const item = await SocialLink.findById(params.id).lean();
    if (!item)
      return NextResponse.json({ ok: false, message: "Social link not found" }, { status: 404 });

    return NextResponse.json({ ok: true, item });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Failed to fetch social link" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    await requireAdmin(); // ✅ no args
    await dbConnect();

    const body = await req.json();
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

    const item = await SocialLink.findByIdAndUpdate(params.id, update, { new: true }).lean();
    if (!item)
      return NextResponse.json({ ok: false, message: "Social link not found" }, { status: 404 });

    return NextResponse.json({ ok: true, item });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Failed to update social link" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    await requireAdmin(); // ✅ no args
    await dbConnect();

    const removed = await SocialLink.findByIdAndDelete(params.id).lean();
    if (!removed)
      return NextResponse.json({ ok: false, message: "Social link not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Failed to delete social link" },
      { status: 500 }
    );
  }
}
