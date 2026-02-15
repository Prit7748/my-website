import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import SocialLink from "../../../../models/SocialLink";

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

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const url = new URL(req.url);
    const adminMode = url.searchParams.get("admin") === "1";

    if (adminMode) await requireAdmin(); // ✅ no args

    const query = adminMode ? {} : { isActive: true };
    const items = await SocialLink.find(query)
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Failed to fetch social links" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(); // ✅ no args
    await dbConnect();

    const body = await req.json();
    const name = safeStr(body?.name);
    const linkUrl = safeStr(body?.url);
    const icon = safeStr(body?.icon);
    const isActive = body?.isActive !== undefined ? !!body.isActive : true;
    const sortOrder = num(body?.sortOrder, 0);

    if (!name || name.length < 2)
      return NextResponse.json({ ok: false, message: "Name min 2 chars." }, { status: 400 });

    if (!linkUrl || !isValidUrl(linkUrl))
      return NextResponse.json({ ok: false, message: "Valid https URL required." }, { status: 400 });

    const created = await SocialLink.create({
      name,
      url: linkUrl,
      icon,
      isActive,
      sortOrder,
    });

    return NextResponse.json({ ok: true, item: created }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Failed to create social link" },
      { status: 500 }
    );
  }
}
