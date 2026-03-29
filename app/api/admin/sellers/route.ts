import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import User from "@/models/User";
import { getPublicResellerSnapshot } from "@/lib/reseller";

export const runtime = "nodejs";

function safeText(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function escRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSellerBaseMatch() {
  return {
    $or: [
      { "reseller.isReseller": true },
      { "reseller.planCode": { $in: ["basic", "standard", "premium"] } },
      { "reseller.walletBalance": { $gt: 0 } },
      { "reseller.walletTotalRecharged": { $gt: 0 } },
      { "reseller.walletTotalUsed": { $gt: 0 } },
      { "reseller.walletTotalDiscountSaved": { $gt: 0 } },
      { "reseller.notes": { $exists: true, $ne: "" } },
    ],
  };
}

function buildStatusFilter(status: string) {
  const s = safeText(status).toLowerCase();
  if (s === "active" || s === "inactive" || s === "paused" || s === "blocked") {
    return { "reseller.status": s };
  }
  return {};
}

function buildPlanFilter(plan: string) {
  const p = safeText(plan).toLowerCase();
  if (p === "basic" || p === "standard" || p === "premium") {
    return { "reseller.planCode": p };
  }
  return {};
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  await dbConnect();

  const url = new URL(req.url);
  const q = safeText(url.searchParams.get("q"));
  const status = safeText(url.searchParams.get("status"));
  const plan = safeText(url.searchParams.get("plan"));
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const limit = Math.min(200, Math.max(10, Number(url.searchParams.get("limit") || 24)));
  const skip = (page - 1) * limit;

  const match: any = {
    ...buildSellerBaseMatch(),
    ...buildStatusFilter(status),
    ...buildPlanFilter(plan),
  };

  if (q) {
    const rx = new RegExp(escRegex(q), "i");
    match.$and = [
      {
        $or: [
          { name: rx },
          { email: rx },
          { phone: rx },
          { "reseller.planName": rx },
          { "reseller.planCode": rx },
          { "reseller.status": rx },
          { "reseller.notes": rx },
        ],
      },
    ];
  }

  const total = await User.countDocuments(match);

  const users: any[] = await User.find(match)
    .sort({
      "reseller.status": 1,
      "reseller.walletBalance": -1,
      updatedAt: -1,
      createdAt: -1,
    })
    .skip(skip)
    .limit(limit)
    .select({
      name: 1,
      email: 1,
      phone: 1,
      createdAt: 1,
      updatedAt: 1,
      reseller: 1,
    })
    .lean();

  const items = users.map((u: any) => ({
    _id: String(u._id),
    name: safeText(u.name),
    email: safeText(u.email),
    phone: safeText(u.phone),
    createdAt: u?.createdAt ? new Date(u.createdAt).toISOString() : null,
    updatedAt: u?.updatedAt ? new Date(u.updatedAt).toISOString() : null,
    reseller: {
      ...getPublicResellerSnapshot(u),
      notes: safeText(u?.reseller?.notes),
    },
  }));

  const statsAgg = await User.aggregate([
    { $match: buildSellerBaseMatch() },
    {
      $group: {
        _id: null,
        totalSellerAccounts: { $sum: 1 },
        activeCount: {
          $sum: {
            $cond: [{ $eq: ["$reseller.status", "active"] }, 1, 0],
          },
        },
        inactiveCount: {
          $sum: {
            $cond: [{ $eq: ["$reseller.status", "inactive"] }, 1, 0],
          },
        },
        pausedCount: {
          $sum: {
            $cond: [{ $eq: ["$reseller.status", "paused"] }, 1, 0],
          },
        },
        blockedCount: {
          $sum: {
            $cond: [{ $eq: ["$reseller.status", "blocked"] }, 1, 0],
          },
        },
        totalWalletBalance: { $sum: { $ifNull: ["$reseller.walletBalance", 0] } },
        totalRecharge: { $sum: { $ifNull: ["$reseller.walletTotalRecharged", 0] } },
        totalUsed: { $sum: { $ifNull: ["$reseller.walletTotalUsed", 0] } },
        totalSaved: { $sum: { $ifNull: ["$reseller.walletTotalDiscountSaved", 0] } },
      },
    },
  ]);

  const statsRow = Array.isArray(statsAgg) && statsAgg[0] ? statsAgg[0] : {};

  return NextResponse.json(
    {
      ok: true,
      items,
      stats: {
        totalSellerAccounts: safeNum(statsRow?.totalSellerAccounts, 0),
        activeCount: safeNum(statsRow?.activeCount, 0),
        inactiveCount: safeNum(statsRow?.inactiveCount, 0),
        pausedCount: safeNum(statsRow?.pausedCount, 0),
        blockedCount: safeNum(statsRow?.blockedCount, 0),
        totalWalletBalance: safeNum(statsRow?.totalWalletBalance, 0),
        totalRecharge: safeNum(statsRow?.totalRecharge, 0),
        totalUsed: safeNum(statsRow?.totalUsed, 0),
        totalSaved: safeNum(statsRow?.totalSaved, 0),
      },
      pagination: {
        total,
        page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        limit,
      },
      filters: {
        q,
        status,
        plan,
      },
    },
    { status: 200 }
  );
}