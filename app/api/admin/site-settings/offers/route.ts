import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import OfferEntry from "@/models/OfferEntry";
import { requireAdmin } from "@/lib/adminAuth";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeDateInput(x: any) {
  const v = safeStr(x);
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

async function ensureAdminOrFail() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  return null;
}

export async function GET(_req: NextRequest) {
  try {
    const denied = await ensureAdminOrFail();
    if (denied) return denied;

    await dbConnect();

    const rows = await OfferEntry.find({})
      .sort({ isFeatured: -1, sortOrder: 1, createdAt: -1, _id: -1 })
      .lean();

    return NextResponse.json(rows || []);
  } catch (e: any) {
    return NextResponse.json({ error: safeStr(e?.message) || "Failed to load offers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const denied = await ensureAdminOrFail();
    if (denied) return denied;

    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const title = safeStr(body?.title);

    if (!title) {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }

    const saved = await OfferEntry.create({
      title,
      shortText: safeStr(body?.shortText),
      badgeText: safeStr(body?.badgeText),
      couponCode: safeStr(body?.couponCode).toUpperCase(),
      ctaText: safeStr(body?.ctaText),
      ctaHref: safeStr(body?.ctaHref),
      coverImageUrl: safeStr(body?.coverImageUrl),
      bgVariant: safeStr(body?.bgVariant).toLowerCase() || "blue",
      categoryTags: Array.isArray(body?.categoryTags) ? body.categoryTags : [],
      sortOrder: Math.trunc(safeNum(body?.sortOrder, 0)),
      isFeatured: !!body?.isFeatured,
      isActive: body?.isActive !== false,
      startsAt: normalizeDateInput(body?.startsAt),
      endsAt: normalizeDateInput(body?.endsAt),
      updatedBy: "admin",
    });

    return NextResponse.json(saved);
  } catch (e: any) {
    return NextResponse.json({ error: safeStr(e?.message) || "Failed to create offer" }, { status: 500 });
  }
}



