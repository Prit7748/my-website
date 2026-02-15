// ✅ FILE: app/api/site-settings/faqs/[id]/route.ts (COMPLETE REPLACE - Next.js typed params fix)
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";

// ⚠️ model import apke project ke according
// agar aapke yahan model ka naam/path different hai to ONLY is line ko adjust karna.
import Faq from "@/models/Faq";

export const runtime = "nodejs";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function idFromRequest(req: Request, params?: any) {
  // 1) params first
  const pId = params?.id;
  if (typeof pId === "string" && pId.trim()) return decodeURIComponent(pId).trim();

  // 2) fallback from pathname: /api/site-settings/faqs/<id>
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean); // ["api","site-settings","faqs","<id>"]
  const raw = parts[3] || "";
  return decodeURIComponent(raw).trim();
}

// ✅ Next.js build expects params as Promise
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const resolvedParams = context?.params ? await context.params : undefined;
    const id = safeStr(idFromRequest(req, resolvedParams));

    if (!id) {
      return NextResponse.json({ ok: false, message: "Invalid id" }, { status: 400 });
    }

    const item = await Faq.findById(id).lean();
    if (!item) {
      return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const resolvedParams = context?.params ? await context.params : undefined;
    const id = safeStr(idFromRequest(req, resolvedParams));

    if (!id) {
      return NextResponse.json({ ok: false, message: "Invalid id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));

    const updated = await Faq.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    }).lean();

    if (!updated) {
      return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item: updated }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const resolvedParams = context?.params ? await context.params : undefined;
    const id = safeStr(idFromRequest(req, resolvedParams));

    if (!id) {
      return NextResponse.json({ ok: false, message: "Invalid id" }, { status: 400 });
    }

    const deleted = await Faq.findByIdAndDelete(id).lean();
    if (!deleted) {
      return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
