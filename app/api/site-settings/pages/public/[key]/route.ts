import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import SitePage from "@/models/SitePage";

export const runtime = "nodejs";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

// ✅ Next.js build expects params as Promise
type Ctx = { params: Promise<{ key: string }> };

export async function GET(req: NextRequest, context: Ctx) {
  try {
    await dbConnect();

    const { key } = await context.params;
    const pageKey = safeStr(key);

    if (!pageKey) {
      return NextResponse.json({ error: "key required" }, { status: 400 });
    }

    const doc = await SitePage.findOne({ key: pageKey, isActive: true }).lean();

    // ✅ IMPORTANT: if not active / not found -> return null (so page uses fallback)
    if (!doc) return NextResponse.json(null);

    return NextResponse.json(
      {
        key: String((doc as any).key),
        title: String((doc as any).title || ""),
        content: String((doc as any).content || ""),
        updatedAt: (doc as any).updatedAt ? new Date((doc as any).updatedAt).toISOString() : null,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
