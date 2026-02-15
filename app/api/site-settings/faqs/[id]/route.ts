import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import Faq from "@/models/Faq";

function num(x: any, d = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
}
function safeStr(x: any) {
  return String(x ?? "").trim();
}

type Ctx = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    await requireAdmin(); // ✅ no args
    await dbConnect();

    const item = await Faq.findById(params.id).lean();
    if (!item)
      return NextResponse.json({ ok: false, message: "FAQ not found" }, { status: 404 });

    return NextResponse.json({ ok: true, item });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Failed to fetch FAQ" },
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

    if (body?.question !== undefined) update.question = safeStr(body.question);
    if (body?.answer !== undefined) update.answer = safeStr(body.answer);
    if (body?.isActive !== undefined) update.isActive = !!body.isActive;
    if (body?.sortOrder !== undefined) update.sortOrder = num(body.sortOrder, 0);

    if (update.question !== undefined && update.question.length < 5)
      return NextResponse.json({ ok: false, message: "Question min 5 chars." }, { status: 400 });

    if (update.answer !== undefined && update.answer.length < 5)
      return NextResponse.json({ ok: false, message: "Answer min 5 chars." }, { status: 400 });

    const item = await Faq.findByIdAndUpdate(params.id, update, { new: true }).lean();
    if (!item)
      return NextResponse.json({ ok: false, message: "FAQ not found" }, { status: 404 });

    return NextResponse.json({ ok: true, item });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Failed to update FAQ" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    await requireAdmin(); // ✅ no args
    await dbConnect();

    const removed = await Faq.findByIdAndDelete(params.id).lean();
    if (!removed)
      return NextResponse.json({ ok: false, message: "FAQ not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Failed to delete FAQ" },
      { status: 500 }
    );
  }
}
