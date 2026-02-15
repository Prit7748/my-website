import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import SitePage from "@/models/SitePage";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

export async function GET(_req: NextRequest, ctx: { params: { key: string } }) {
  try {
    await dbConnect();
    const key = safeStr(ctx?.params?.key);
    if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

    const doc = await SitePage.findOne({ key, isActive: true }).lean();

    // ✅ IMPORTANT: if not active / not found -> return null (so page uses fallback)
    if (!doc) return NextResponse.json(null);

    return NextResponse.json({
      key: String(doc.key),
      title: String(doc.title || ""),
      content: String(doc.content || ""),
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
