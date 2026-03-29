import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import User from "@/models/User";
import Order from "@/models/Order";
import WalletLedger from "@/models/WalletLedger";
import {
  applySellerLowBalanceRule,
  getPublicResellerSnapshot,
} from "@/lib/reseller";

export const runtime = "nodejs";

type UserTypeFilter = "all" | "student" | "seller" | "co_admin" | "admin";
type SellerStatusFilter = "all" | "active" | "paused" | "blocked" | "inactive";

function safeText(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function roundMoney(x: any) {
  const n = safeNum(x, 0);
  return Math.round(n * 100) / 100;
}

function escRegex(s: string) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getPlanNameFromCode(code: string) {
  const c = safeText(code).toLowerCase();
  if (c === "basic") return "Basic";
  if (c === "standard") return "Standard";
  if (c === "premium") return "Premium";
  return "";
}

function isPlanCode(code: string) {
  const c = safeText(code).toLowerCase();
  return c === "basic" || c === "standard" || c === "premium";
}

function normalizeUserType(value: any): UserTypeFilter {
  const v = safeText(value).toLowerCase();
  if (v === "student") return "student";
  if (v === "seller") return "seller";
  if (v === "co_admin") return "co_admin";
  if (v === "admin") return "admin";
  return "all";
}

function normalizeSellerStatus(value: any): SellerStatusFilter {
  const v = safeText(value).toLowerCase();
  if (v === "active") return "active";
  if (v === "paused") return "paused";
  if (v === "blocked") return "blocked";
  if (v === "inactive") return "inactive";
  return "all";
}

function resolveUserType(user: any, resellerSnap: any) {
  const role = safeText(user?.role).toLowerCase();

  if (role === "master_admin") return "admin";
  if (role === "co_admin") return "co_admin";
  if (Boolean(resellerSnap?.isReseller)) return "seller";
  return "student";
}

function resolveUserTypeLabel(userType: string) {
  if (userType === "admin") return "Admin";
  if (userType === "co_admin") return "Co Admin";
  if (userType === "seller") return "Seller";
  return "Student";
}

function countTotalProductsFromOrder(order: any) {
  const items = Array.isArray(order?.items) ? order.items : [];
  return items.reduce((acc: number, item: any) => {
    return acc + Math.max(1, Math.trunc(safeNum(item?.quantity, 1)));
  }, 0);
}

function parseYmd(value: string) {
  const v = safeText(value);
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function ymdStartUtc(value: string) {
  const p = parseYmd(value);
  if (!p) return null;
  return new Date(Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0, 0));
}

function ymdEndExclusiveUtc(value: string) {
  const p = parseYmd(value);
  if (!p) return null;
  return new Date(Date.UTC(p.year, p.month - 1, p.day + 1, 0, 0, 0, 0));
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  await dbConnect();

  const url = new URL(req.url);

  const q = safeText(url.searchParams.get("q"));
  const userType = normalizeUserType(url.searchParams.get("userType"));
  const sellerStatus = normalizeSellerStatus(url.searchParams.get("sellerStatus"));

  const joinedFrom = safeText(url.searchParams.get("joinedFrom"));
  const joinedTo = safeText(url.searchParams.get("joinedTo"));

  const exportAll = url.searchParams.get("exportAll") === "1";

  const page = Math.max(1, safeNum(url.searchParams.get("page"), 1));
  const limit = exportAll
    ? Math.min(5000, Math.max(10, safeNum(url.searchParams.get("limit"), 5000)))
    : Math.min(100, Math.max(10, safeNum(url.searchParams.get("limit"), 15)));
  const skip = exportAll ? 0 : (page - 1) * limit;

  const andFilters: any[] = [];

  if (q) {
    const rx = new RegExp(escRegex(q), "i");
    andFilters.push({
      $or: [
        { name: rx },
        { email: rx },
        { phone: rx },
        { role: rx },
        { "reseller.planName": rx },
        { "reseller.planCode": rx },
        { "reseller.status": rx },
        { "reseller.notes": rx },
      ],
    });
  }

  if (userType === "seller") {
    andFilters.push({ role: { $nin: ["master_admin", "co_admin"] } });
    andFilters.push({ "reseller.isReseller": true });
  } else if (userType === "student") {
    andFilters.push({ role: { $nin: ["master_admin", "co_admin"] } });
    andFilters.push({ "reseller.isReseller": { $ne: true } });
  } else if (userType === "co_admin") {
    andFilters.push({ role: "co_admin" });
  } else if (userType === "admin") {
    andFilters.push({ role: "master_admin" });
  }

  if (sellerStatus !== "all") {
    andFilters.push({ "reseller.isReseller": true });
    andFilters.push({ "reseller.status": sellerStatus });
  }

  if (joinedFrom || joinedTo) {
    const createdAtQuery: any = {};

    if (joinedFrom) {
      const dt = ymdStartUtc(joinedFrom);
      if (!dt) {
        return NextResponse.json(
          { error: "Invalid joinedFrom date" },
          { status: 400 }
        );
      }
      createdAtQuery.$gte = dt;
    }

    if (joinedTo) {
      const dt = ymdEndExclusiveUtc(joinedTo);
      if (!dt) {
        return NextResponse.json(
          { error: "Invalid joinedTo date" },
          { status: 400 }
        );
      }
      createdAtQuery.$lt = dt;
    }

    andFilters.push({ createdAt: createdAtQuery });
  }

  const query: any = andFilters.length ? { $and: andFilters } : {};

  const total = await User.countDocuments(query);

  const users = await User.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .select({
      name: 1,
      email: 1,
      phone: 1,
      role: 1,
      createdAt: 1,
      updatedAt: 1,
      reseller: 1,
    })
    .lean();

  const userObjectIds = users.map((u: any) => u._id);
  const userIdSet = new Set(users.map((u: any) => String(u._id)));
  const emailToUserId = new Map<string, string>();

  for (const u of users) {
    const email = safeText(u?.email).toLowerCase();
    if (email) {
      emailToUserId.set(email, String(u._id));
    }
  }

  const emails = Array.from(emailToUserId.keys());

  let paidOrders: any[] = [];
  if (userObjectIds.length > 0 || emails.length > 0) {
    paidOrders = await Order.find({
      status: "paid",
      $or: [
        ...(userObjectIds.length > 0 ? [{ userId: { $in: userObjectIds } }] : []),
        ...(emails.length > 0 ? [{ userEmail: { $in: emails } }] : []),
      ],
    })
      .select({
        userId: 1,
        userEmail: 1,
        totalAmount: 1,
        items: 1,
      })
      .lean();
  }

  const statsMap = new Map<
    string,
    {
      totalPaidOrders: number;
      totalProductsOrdered: number;
      totalPaidAmount: number;
    }
  >();

  for (const order of paidOrders) {
    const orderUserId = safeText(order?.userId);
    const orderEmail = safeText(order?.userEmail).toLowerCase();

    let targetUserId = "";
    if (orderUserId && userIdSet.has(orderUserId)) {
      targetUserId = orderUserId;
    } else if (orderEmail && emailToUserId.has(orderEmail)) {
      targetUserId = safeText(emailToUserId.get(orderEmail));
    }

    if (!targetUserId) continue;

    const prev = statsMap.get(targetUserId) || {
      totalPaidOrders: 0,
      totalProductsOrdered: 0,
      totalPaidAmount: 0,
    };

    prev.totalPaidOrders += 1;
    prev.totalProductsOrdered += countTotalProductsFromOrder(order);
    prev.totalPaidAmount = roundMoney(
      prev.totalPaidAmount + roundMoney(order?.totalAmount || 0)
    );

    statsMap.set(targetUserId, prev);
  }

  const items = users.map((u: any) => {
    const id = String(u._id);
    const stats = statsMap.get(id) || {
      totalPaidOrders: 0,
      totalProductsOrdered: 0,
      totalPaidAmount: 0,
    };

    const resellerSnap = getPublicResellerSnapshot(u);
    const resolvedUserType = resolveUserType(u, resellerSnap);

    return {
      _id: id,
      name: safeText(u?.name),
      email: safeText(u?.email),
      phone: safeText(u?.phone),
      role: safeText(u?.role || "user"),
      userType: resolvedUserType,
      userTypeLabel: resolveUserTypeLabel(resolvedUserType),
      createdAt: u?.createdAt ? new Date(u.createdAt).toISOString() : "",
      updatedAt: u?.updatedAt ? new Date(u.updatedAt).toISOString() : "",

      orderCount: stats.totalPaidOrders,
      totalPaidOrders: stats.totalPaidOrders,
      totalProductsOrdered: stats.totalProductsOrdered,
      totalPaidAmount: roundMoney(stats.totalPaidAmount),

      reseller: {
        ...resellerSnap,
        notes: safeText(u?.reseller?.notes),
      },
    };
  });

  return NextResponse.json(
    {
      items,
      filters: {
        q,
        userType,
        sellerStatus,
        joinedFrom,
        joinedTo,
      },
      pagination: {
        total,
        page: exportAll ? 1 : page,
        totalPages: exportAll ? 1 : Math.max(1, Math.ceil(total / limit)),
        limit,
      },
    },
    { status: 200 }
  );
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  await dbConnect();

  const body = await req.json().catch(() => ({}));
  const userId = safeText(body?.userId);
  const action = safeText(body?.action).toLowerCase();
  const amount = roundMoney(body?.amount);
  const note = safeText(body?.note);
  const requestedPlanCode = safeText(body?.planCode).toLowerCase();

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  const user: any = await User.findById(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!user.reseller || typeof user.reseller !== "object") {
    user.reseller = {};
  }

  const now = new Date();

  if (
    action === "activate_basic" ||
    action === "activate_standard" ||
    action === "activate_premium"
  ) {
    const planCode = action.replace("activate_", "");
    user.reseller.isReseller = true;
    user.reseller.status = "active";
    user.reseller.planCode = planCode;
    user.reseller.planName = getPlanNameFromCode(planCode);
    user.reseller.planActivatedAt = now;

    applySellerLowBalanceRule(user);
    await user.save();

    return NextResponse.json(
      {
        ok: true,
        message:
          safeText(user?.reseller?.status) === "inactive"
            ? "Seller plan saved, but account remains inactive because wallet balance is below ₹10"
            : `${getPlanNameFromCode(planCode)} seller plan activated successfully`,
        user: {
          _id: String(user._id),
          reseller: getPublicResellerSnapshot(user),
        },
      },
      { status: 200 }
    );
  }

  if (action === "pause_seller") {
    user.reseller.isReseller = true;
    user.reseller.status = "paused";

    await user.save();

    return NextResponse.json(
      {
        ok: true,
        message: "Seller paused successfully",
        user: {
          _id: String(user._id),
          reseller: getPublicResellerSnapshot(user),
        },
      },
      { status: 200 }
    );
  }

  if (action === "block_seller") {
    user.reseller.isReseller = true;
    user.reseller.status = "blocked";

    await user.save();

    return NextResponse.json(
      {
        ok: true,
        message: "Seller blocked successfully",
        user: {
          _id: String(user._id),
          reseller: getPublicResellerSnapshot(user),
        },
      },
      { status: 200 }
    );
  }

  if (action === "remove_seller") {
    user.reseller.isReseller = false;
    user.reseller.status = "inactive";
    user.reseller.planCode = "";
    user.reseller.planName = "";

    await user.save();

    return NextResponse.json(
      {
        ok: true,
        message: "Seller role removed successfully",
        user: {
          _id: String(user._id),
          reseller: getPublicResellerSnapshot(user),
        },
      },
      { status: 200 }
    );
  }

  if (action === "save_seller_note") {
    user.reseller.notes = note;
    await user.save();

    return NextResponse.json(
      {
        ok: true,
        message: "Seller note saved successfully",
        user: {
          _id: String(user._id),
          reseller: {
            ...getPublicResellerSnapshot(user),
            notes: safeText(user?.reseller?.notes),
          },
        },
      },
      { status: 200 }
    );
  }

  if (action === "manual_wallet_credit") {
    if (amount <= 0) {
      return NextResponse.json(
        { error: "Please enter a valid credit amount" },
        { status: 400 }
      );
    }

    const balanceBefore = roundMoney(user?.reseller?.walletBalance || 0);
    const balanceAfter = roundMoney(balanceBefore + amount);

    if (isPlanCode(requestedPlanCode)) {
      user.reseller.isReseller = true;
      user.reseller.status = "active";
      user.reseller.planCode = requestedPlanCode;
      user.reseller.planName = getPlanNameFromCode(requestedPlanCode);
      user.reseller.planActivatedAt = user.reseller.planActivatedAt || now;
    }

    user.reseller.walletBalance = balanceAfter;
    user.reseller.walletTotalRecharged = roundMoney(
      (user?.reseller?.walletTotalRecharged || 0) + amount
    );
    user.reseller.lastRechargeAt = now;

    applySellerLowBalanceRule(user);
    await user.save();

    await WalletLedger.create({
      userId: user._id,
      userEmail: safeText(user.email),
      entryType: "manual_credit",
      source: "admin",
      status: "success",
      direction: "credit",
      amount,
      balanceBefore,
      balanceAfter,
      planCode: safeText(user?.reseller?.planCode).toLowerCase(),
      planName: safeText(user?.reseller?.planName),
      note: note || "Manual wallet credit by admin",
      meta: {
        action,
        adminActionAt: now.toISOString(),
      },
    });

    return NextResponse.json(
      {
        ok: true,
        message:
          safeText(user?.reseller?.status) === "inactive"
            ? `₹${amount} added successfully, but seller remains inactive because wallet balance is below ₹10`
            : `₹${amount} added successfully to seller wallet`,
        user: {
          _id: String(user._id),
          reseller: {
            ...getPublicResellerSnapshot(user),
            notes: safeText(user?.reseller?.notes),
          },
        },
      },
      { status: 200 }
    );
  }

  if (action === "manual_wallet_debit") {
    if (amount <= 0) {
      return NextResponse.json(
        { error: "Please enter a valid debit amount" },
        { status: 400 }
      );
    }

    const balanceBefore = roundMoney(user?.reseller?.walletBalance || 0);
    const debitAmount = roundMoney(Math.min(balanceBefore, amount));
    const balanceAfter = roundMoney(balanceBefore - debitAmount);

    if (debitAmount <= 0) {
      return NextResponse.json(
        { error: "Wallet balance is already zero" },
        { status: 400 }
      );
    }

    user.reseller.walletBalance = balanceAfter;
    user.reseller.walletTotalUsed = roundMoney(
      (user?.reseller?.walletTotalUsed || 0) + debitAmount
    );

    applySellerLowBalanceRule(user);
    await user.save();

    await WalletLedger.create({
      userId: user._id,
      userEmail: safeText(user.email),
      entryType: "manual_debit",
      source: "admin",
      status: "success",
      direction: "debit",
      amount: debitAmount,
      balanceBefore,
      balanceAfter,
      planCode: safeText(user?.reseller?.planCode).toLowerCase(),
      planName: safeText(user?.reseller?.planName),
      note: note || "Manual wallet debit by admin",
      meta: {
        requestedAmount: amount,
        actualDebitAmount: debitAmount,
        action,
        adminActionAt: now.toISOString(),
      },
    });

    return NextResponse.json(
      {
        ok: true,
        message:
          safeText(user?.reseller?.status) === "inactive"
            ? `₹${debitAmount} deducted and seller auto-inactive because wallet balance is below ₹10`
            : `₹${debitAmount} deducted successfully from seller wallet`,
        user: {
          _id: String(user._id),
          reseller: {
            ...getPublicResellerSnapshot(user),
            notes: safeText(user?.reseller?.notes),
          },
        },
      },
      { status: 200 }
    );
  }

  return NextResponse.json({ error: "Invalid reseller action" }, { status: 400 });
}
