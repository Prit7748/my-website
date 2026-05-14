import { NextRequest, NextResponse } from "next/server";

import dbConnect from "@/lib/db";
import { getAuthUser, hasPermission } from "@/lib/auth";
import ProductReview from "@/models/ProductReview";

export const runtime = "nodejs";

function safeStr(input: any) {
  return String(input ?? "").trim();
}

function parsePositiveInt(input: any, fallback: number) {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function normalizeLimit(input: any) {
  const n = parsePositiveInt(input, 25);
  return Math.max(1, Math.min(100, n));
}

function normalizeStatus(input: any) {
  const s = safeStr(input).toLowerCase();
  if (["pending", "approved", "rejected", "all"].includes(s)) return s;
  return "pending";
}

function getUserId(user: any) {
  return safeStr(user?.id || user?._id || user?.email || "");
}

async function assertAdminAccess() {
  const user = await getAuthUser();

  if (!user) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  if (!hasPermission(user, "products:write")) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, user };
}

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mapReview(row: any) {
  return {
    _id: String(row._id),
    productId: safeStr(row.productId),
    productSlug: safeStr(row.productSlug),
    productTitle: safeStr(row.productTitle),

    userId: row.userId ? String(row.userId) : "",
    userName: safeStr(row.userName),
    userEmail: safeStr(row.userEmail),

    rating: Number(row.rating || 0),
    review: safeStr(row.review),

    verifiedPurchase: Boolean(row.verifiedPurchase),
    orderId: row.orderId ? String(row.orderId) : "",
    orderRef: safeStr(row.orderRef),
    purchasedAt: row.purchasedAt || null,
    purchaseCheckedAt: row.purchaseCheckedAt || null,

    status: safeStr(row.status || "pending"),
    adminNote: safeStr(row.adminNote),

    approvedAt: row.approvedAt || null,
    approvedBy: safeStr(row.approvedBy),
    rejectedAt: row.rejectedAt || null,
    rejectedBy: safeStr(row.rejectedBy),

    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
    deletedAt: row.deletedAt || null,
  };
}

async function getStats() {
  const [pending, approved, rejected, deleted] = await Promise.all([
    ProductReview.countDocuments({ status: "pending", deletedAt: null }),
    ProductReview.countDocuments({ status: "approved", deletedAt: null }),
    ProductReview.countDocuments({ status: "rejected", deletedAt: null }),
    ProductReview.countDocuments({ deletedAt: { $ne: null } }),
  ]);

  return {
    pending,
    approved,
    rejected,
    deleted,
    totalLive: pending + approved + rejected,
  };
}

export async function GET(req: NextRequest) {
  const guard = await assertAdminAccess();
  if (!guard.ok) return guard.res;

  await dbConnect();

  const url = new URL(req.url);
  const status = normalizeStatus(url.searchParams.get("status"));
  const q = safeStr(url.searchParams.get("q"));
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const limit = normalizeLimit(url.searchParams.get("limit"));
  const skip = (page - 1) * limit;

  const query: any = {
    deletedAt: null,
  };

  if (status !== "all") {
    query.status = status;
  }

  if (q) {
    const regex = new RegExp(escapeRegex(q), "i");
    query.$or = [
      { productTitle: regex },
      { productSlug: regex },
      { productId: regex },
      { userName: regex },
      { userEmail: regex },
      { review: regex },
      { orderRef: regex },
    ];
  }

  const [stats, total, rows] = await Promise.all([
    getStats(),
    ProductReview.countDocuments(query),
    ProductReview.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return NextResponse.json(
    {
      ok: true,
      stats,
      reviews: rows.map(mapReview),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      filters: {
        status,
        q,
      },
    },
    { status: 200 }
  );
}

export async function PATCH(req: NextRequest) {
  const guard = await assertAdminAccess();
  if (!guard.ok) return guard.res;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  await dbConnect();

  const reviewId = safeStr(body?.reviewId);
  const action = safeStr(body?.action).toLowerCase();
  const adminNote = safeStr(body?.adminNote);

  if (!reviewId) {
    return NextResponse.json({ error: "reviewId required" }, { status: 400 });
  }

  if (!["approve", "reject", "restore", "trash"].includes(action)) {
    return NextResponse.json(
      { error: "Unsupported action" },
      { status: 400 }
    );
  }

  const review: any = await ProductReview.findById(reviewId);

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const adminId = getUserId(guard.user);
  const now = new Date();

  if (action === "approve") {
    if (review.deletedAt) {
      return NextResponse.json(
        { error: "Trashed review cannot be approved. Restore it first." },
        { status: 400 }
      );
    }

    review.status = "approved";
    review.adminNote = adminNote;
    review.approvedAt = now;
    review.approvedBy = adminId;
    review.rejectedAt = null;
    review.rejectedBy = "";
  }

  if (action === "reject") {
    if (review.deletedAt) {
      return NextResponse.json(
        { error: "Trashed review cannot be rejected. Restore it first." },
        { status: 400 }
      );
    }

    review.status = "rejected";
    review.adminNote = adminNote;
    review.rejectedAt = now;
    review.rejectedBy = adminId;
    review.approvedAt = null;
    review.approvedBy = "";
  }

  if (action === "trash") {
    if (!review.deletedAt) {
      review.deletedAt = now;
    }

    review.adminNote = adminNote || review.adminNote || "";
  }

  if (action === "restore") {
    review.deletedAt = null;

    if (!["pending", "approved", "rejected"].includes(safeStr(review.status))) {
      review.status = "pending";
    }

    review.adminNote = adminNote || review.adminNote || "";
  }

  await review.save();

  return NextResponse.json(
    {
      ok: true,
      message:
        action === "approve"
          ? "Review approved successfully."
          : action === "reject"
          ? "Review rejected successfully."
          : action === "trash"
          ? "Review moved to trash."
          : "Review restored successfully.",
      review: mapReview(review),
      stats: await getStats(),
    },
    { status: 200 }
  );
}

export async function DELETE(req: NextRequest) {
  const guard = await assertAdminAccess();
  if (!guard.ok) return guard.res;

  await dbConnect();

  const url = new URL(req.url);
  const reviewId = safeStr(url.searchParams.get("reviewId"));

  if (!reviewId) {
    return NextResponse.json({ error: "reviewId required" }, { status: 400 });
  }

  const review: any = await ProductReview.findById(reviewId);

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  await ProductReview.deleteOne({ _id: review._id });

  return NextResponse.json(
    {
      ok: true,
      message: "Review permanently deleted.",
      reviewId,
      stats: await getStats(),
    },
    { status: 200 }
  );
}