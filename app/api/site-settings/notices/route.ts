import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Notice from "@/models/Notice";
import { requireAdmin } from "@/lib/adminAuth";

function safeStr(x: any) {
  return String(x || "").trim();
}
function safeInt(x: any, fallback = 1000) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: NextRequest) {
  await dbConnect();

  const url = new URL(req.url);
  const adminMode = url.searchParams.get("admin") === "1";

  const now = new Date();
  const filter: any = {};

  if (!adminMode) {
    filter.isActive = true;
    // hide expired notices
    filter.$or = [{ expiresAt: null }, { expiresAt: { $gt: now } }];
  }

  const rows = await Notice.find(filter)
    .sort({ order: 1, createdAt: -1, _id: 1 })
    .lean();

  const payload = (rows || []).map((n: any) => ({
    _id: String(n._id),
    id: String(n._id), // keep frontend compatibility
    title: n.title || "",
    href: n.href || "",
    badge: n.badge || "",
    isActive: !!n.isActive,
    order: Number(n.order || 1000),
    expiresAt: n.expiresAt ? new Date(n.expiresAt).toISOString() : null,
  }));

  if (!adminMode) {
    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  }

  return NextResponse.json(payload, { status: 200 });
}

export async function POST(req: NextRequest) {
  await (requireAdmin as any)(req);
  await dbConnect();

  const body = await req.json().catch(() => ({}));

  const title = safeStr(body.title);
  const href = safeStr(body.href);
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (!href) return NextResponse.json({ error: "href is required" }, { status: 400 });

  const badge = safeStr(body.badge);
  const isActive = body.isActive !== false;
  const order = safeInt(body.order, 1000);
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  const created = await Notice.create({
    title,
    href,
    badge,
    isActive,
    order,
    expiresAt: expiresAt && !isNaN(expiresAt.getTime()) ? expiresAt : null,
    lastModifiedAt: new Date(),
  });

  return NextResponse.json({ ok: true, _id: String(created._id) }, { status: 201 });
}
