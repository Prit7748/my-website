import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import PromoCodeUsage from "@/models/PromoCodeUsage";
import { requireAdmin } from "@/lib/adminAuth";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

async function getAdminOrFail() {
  const auth = await requireAdmin();

  if (!auth.ok) {
    return {
      denied: NextResponse.json({ error: auth.error }, { status: auth.status }),
      auth: null,
    };
  }

  return { denied: null, auth };
}

export async function GET(req: NextRequest) {
  try {
    const { denied } = await getAdminOrFail();
    if (denied) return denied;

    await dbConnect();

    const { searchParams } = new URL(req.url);
    const code = safeStr(searchParams.get("code")).toUpperCase();
    const userEmail = safeStr(searchParams.get("userEmail")).toLowerCase();
    const orderRef = safeStr(searchParams.get("orderRef"));
    const status = safeStr(searchParams.get("status")).toLowerCase();
    const page = Math.max(1, Math.trunc(safeNum(searchParams.get("page"), 1)));
    const limit = Math.min(100, Math.max(1, Math.trunc(safeNum(searchParams.get("limit"), 20))));
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (code) filter.code = code;
    if (userEmail) filter.userEmail = { $regex: userEmail, $options: "i" };
    if (orderRef) filter.orderRef = { $regex: orderRef, $options: "i" };
    if (status) filter.orderStatus = status;

    const [items, total, summaryRows] = await Promise.all([
      PromoCodeUsage.find(filter)
        .sort({ redeemedAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PromoCodeUsage.countDocuments(filter),
      PromoCodeUsage.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalDiscount: { $sum: "$discountAmount" },
            totalAppliedOnAmount: { $sum: "$appliedOnAmount" },
            usageCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    const summary = summaryRows?.[0] || {
      totalDiscount: 0,
      totalAppliedOnAmount: 0,
      usageCount: 0,
    };

    return NextResponse.json({
      ok: true,
      items: items || [],
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      summary,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load promo usage" }, { status: 500 });
  }
}