import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Faq from "@/models/Faq";
import { requireAdmin } from "@/lib/adminAuth";

function num(x: any, d = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
}
function safeStr(x: any) {
  return String(x ?? "").trim();
}

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const url = new URL(req.url);
    const adminMode = url.searchParams.get("admin") === "1";

    if (adminMode) await requireAdmin(); // ✅ no args

    const query = adminMode ? {} : { isActive: true };
    const items = await Faq.find(query).sort({ sortOrder: 1, createdAt: -1 }).lean();

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Failed to fetch FAQs" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(); // ✅ no args
    await dbConnect();

    const body = await req.json();
    const question = safeStr(body?.question);
    const answer = safeStr(body?.answer);
    const isActive = body?.isActive !== undefined ? !!body.isActive : true;
    const sortOrder = num(body?.sortOrder, 0);

    if (!question || question.length < 5)
      return NextResponse.json(
        { ok: false, message: "Question is required (min 5 chars)." },
        { status: 400 }
      );

    if (!answer || answer.length < 5)
      return NextResponse.json(
        { ok: false, message: "Answer is required (min 5 chars)." },
        { status: 400 }
      );

    const created = await Faq.create({ question, answer, isActive, sortOrder });
    return NextResponse.json({ ok: true, item: created }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Failed to create FAQ" },
      { status: 500 }
    );
  }
}
