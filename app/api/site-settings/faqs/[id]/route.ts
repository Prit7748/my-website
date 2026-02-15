import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import Faq from "@/models/Faq";

export const runtime = "nodejs";

function num(x: any, d = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
}
function safeStr(x: any) {
  return String(x ?? "").trim();
}

// ✅ Next.js build expects params as Promise
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: Ctx) {
  try {
    await requireAdmin(); // ✅ no args
    await dbConnect();

    const { id } = (context?.params ? await context.params : { id: "" }) as { id: string };
    const faqId = safeStr(id);

    if (!faqId) {
      return NextResponse.json({ ok: false, message: "Invalid id" }, { status: 400 });
    }

    const item = await Faq.findById(faqId).lean();
    if (!item) return NextResponse.json({ ok: false, message: "FAQ not found" }, { status: 404 });

    return NextResponse.json({ ok: true, item });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Failed to fetch FAQ" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, context: Ctx) {
  try {
    await requireAdmin(); // ✅ no args
    await dbConnect();

    const { id } = (context?.params ? await context.params : { id: "" }) as { id: string };
    const faqId = safeStr(id);

    if (!faqId) {
      return NextResponse.json({ ok: false, message: "Invalid id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const update: any = {};

    if (body?.question !== undefined) update.question = safeStr(body.question);
    if (body?.answer !== undefined) update.answer = safeStr(body.answer);
    if (body?.isActive !== undefined) update.isActive = !!body.isActive;
    if (body?.sortOrder !== undefined) update.sortOrder = num(body.sortOrder, 0);

    if (update.question !== undefined && update.question.length < 5)
      return NextResponse.json({ ok: false, message: "Question min 5 chars." }, { status: 400 });

    if (update.answer !== undefined && update.answer.length < 5)
      return NextResponse.json({ ok: false, message: "Answer min 5 chars." }, { status: 400 });

    const item = await Faq.findByIdAndUpdate(faqId, update, { new: true }).lean();
    if (!item) return NextResponse.json({ ok: false, message: "FAQ not found" }, { status: 404 });

    return NextResponse.json({ ok: true, item });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Failed to update FAQ" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: Ctx) {
  try {
    await requireAdmin(); // ✅ no args
    await dbConnect();

    const { id } = (context?.params ? await context.params : { id: "" }) as { id: string };
    const faqId = safeStr(id);

    if (!faqId) {
      return NextResponse.json({ ok: false, message: "Invalid id" }, { status: 400 });
    }

    const removed = await Faq.findByIdAndDelete(faqId).lean();
    if (!removed) return NextResponse.json({ ok: false, message: "FAQ not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Failed to delete FAQ" },
      { status: 500 }
    );
  }
}
