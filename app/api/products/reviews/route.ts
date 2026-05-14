import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import dbConnect from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import User from "@/models/User";
import Order from "@/models/Order";
import Product from "@/models/Product";
import ProductReview from "@/models/ProductReview";

export const runtime = "nodejs";

function safeStr(input: any) {
  return String(input ?? "").trim();
}

function safeNum(input: any, fallback = 0) {
  const n = Number(input);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeRating(input: any) {
  const n = Math.trunc(safeNum(input, 0));
  return Math.max(1, Math.min(5, n));
}

function cleanReviewText(input: any) {
  return safeStr(input)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function parsePositiveInt(input: any, fallback: number) {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function normalizeLimit(input: any) {
  const n = parsePositiveInt(input, 10);
  return Math.max(1, Math.min(50, n));
}

function publicUserName(input: any) {
  const name = safeStr(input);
  if (!name) return "Verified Student";

  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    const first = parts[0];
    if (first.length <= 2) return `${first[0] || "S"}***`;
    return `${first.slice(0, 2)}***`;
  }

  return `${parts[0]} ${parts[1]?.slice(0, 1) || ""}.`.trim();
}

async function findProductByInput(productIdInput: any, slugInput: any) {
  const productId = safeStr(productIdInput);
  const productSlug = safeStr(slugInput);

  const or: any[] = [];

  if (productId && mongoose.Types.ObjectId.isValid(productId)) {
    or.push({ _id: productId });
  }

  if (productSlug) {
    or.push({ slug: productSlug });
  }

  if (!or.length) return null;

  const product: any = await Product.findOne({
    $or: or,
    deletedAt: null,
    isActive: { $ne: false },
  })
    .select({
      _id: 1,
      title: 1,
      slug: 1,
      sku: 1,
      category: 1,
      deletedAt: 1,
      isActive: 1,
    })
    .lean();

  return product || null;
}

async function findVerifiedPurchase(userId: string, productId: string) {
  const uid = safeStr(userId);
  const pid = safeStr(productId);

  if (!uid || !pid) return null;

  const order: any = await Order.findOne({
    userId: uid,
    status: "paid",
    "items.productId": pid,
  })
    .sort({ paidAt: -1, createdAt: -1 })
    .select({
      _id: 1,
      orderRef: 1,
      paidAt: 1,
      createdAt: 1,
      status: 1,
      items: 1,
    })
    .lean();

  if (!order) return null;

  const matchedItem = Array.isArray(order.items)
    ? order.items.find((item: any) => safeStr(item?.productId) === pid)
    : null;

  if (!matchedItem) return null;

  return {
    orderId: String(order._id),
    orderRef: safeStr(order.orderRef),
    paidAt: order.paidAt || order.createdAt || null,
    matchedItem,
  };
}

async function buildReviewSummary(productId: string) {
  const rows: any[] = await ProductReview.aggregate([
    {
      $match: {
        productId,
        status: "approved",
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: "$productId",
        totalReviews: { $sum: 1 },
        averageRating: { $avg: "$rating" },
        rating5: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
        rating4: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
        rating3: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
        rating2: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
        rating1: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } },
      },
    },
  ]);

  const row = rows?.[0] || {};

  return {
    totalReviews: Number(row.totalReviews || 0),
    averageRating:
      row.averageRating === undefined || row.averageRating === null
        ? 0
        : Math.round(Number(row.averageRating || 0) * 10) / 10,
    breakdown: {
      5: Number(row.rating5 || 0),
      4: Number(row.rating4 || 0),
      3: Number(row.rating3 || 0),
      2: Number(row.rating2 || 0),
      1: Number(row.rating1 || 0),
    },
  };
}

function mapPublicReview(row: any) {
  return {
    _id: String(row._id),
    rating: Number(row.rating || 0),
    review: safeStr(row.review),
    userName: publicUserName(row.userName),
    verifiedPurchase: Boolean(row.verifiedPurchase),
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

function mapMyReview(row: any) {
  if (!row) return null;

  return {
    _id: String(row._id),
    rating: Number(row.rating || 0),
    review: safeStr(row.review),
    status: safeStr(row.status || "pending"),
    verifiedPurchase: Boolean(row.verifiedPurchase),
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

export async function GET(req: NextRequest) {
  await dbConnect();

  const url = new URL(req.url);
  const productIdInput = safeStr(url.searchParams.get("productId"));
  const productSlugInput = safeStr(url.searchParams.get("slug"));
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const limit = normalizeLimit(url.searchParams.get("limit"));
  const skip = (page - 1) * limit;

  const product: any = await findProductByInput(productIdInput, productSlugInput);

  if (!product) {
    return NextResponse.json(
      {
        ok: false,
        error: "Product not found",
      },
      { status: 404 }
    );
  }

  const productId = String(product._id);

  const [summary, totalApproved, reviewRows] = await Promise.all([
    buildReviewSummary(productId),
    ProductReview.countDocuments({
      productId,
      status: "approved",
      deletedAt: null,
    }),
    ProductReview.find({
      productId,
      status: "approved",
      deletedAt: null,
    })
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const authUser = await getAuthUser();

  let myReview: any = null;
  let purchase: any = null;

  if (authUser?.id) {
    [myReview, purchase] = await Promise.all([
      ProductReview.findOne({
        productId,
        userId: authUser.id,
        deletedAt: null,
      })
        .select({
          _id: 1,
          rating: 1,
          review: 1,
          status: 1,
          verifiedPurchase: 1,
          createdAt: 1,
          updatedAt: 1,
        })
        .lean(),
      findVerifiedPurchase(authUser.id, productId),
    ]);
  }

  const totalPages = Math.max(1, Math.ceil(totalApproved / limit));

  return NextResponse.json(
    {
      ok: true,
      product: {
        _id: productId,
        slug: safeStr(product.slug),
        title: safeStr(product.title),
      },
      summary,
      reviews: reviewRows.map(mapPublicReview),
      pagination: {
        page,
        limit,
        total: totalApproved,
        totalPages,
      },
      viewer: {
        loggedIn: Boolean(authUser?.id),
        verifiedBuyer: Boolean(purchase),
        canReview: Boolean(authUser?.id && purchase),
        hasReview: Boolean(myReview),
        myReview: mapMyReview(myReview),
      },
    },
    { status: 200 }
  );
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser();

  if (!authUser?.id) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please login to submit a review.",
      },
      { status: 401 }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid JSON body",
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const product: any = await findProductByInput(body?.productId, body?.slug);

  if (!product) {
    return NextResponse.json(
      {
        ok: false,
        error: "Product not found",
      },
      { status: 404 }
    );
  }

  const productId = String(product._id);
  const rating = normalizeRating(body?.rating);
  const review = cleanReviewText(body?.review);

  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json(
      {
        ok: false,
        error: "Rating 1 se 5 ke beech honi chahiye.",
      },
      { status: 400 }
    );
  }

  if (review.length < 10) {
    return NextResponse.json(
      {
        ok: false,
        error: "Review kam se kam 10 characters ka hona chahiye.",
      },
      { status: 400 }
    );
  }

  if (review.length > 2000) {
    return NextResponse.json(
      {
        ok: false,
        error: "Review 2000 characters se zyada nahi ho sakta.",
      },
      { status: 400 }
    );
  }

  const purchase = await findVerifiedPurchase(authUser.id, productId);

  if (!purchase) {
    return NextResponse.json(
      {
        ok: false,
        error: "Only students who purchased this product can submit a review.",
      },
      { status: 403 }
    );
  }

  const user: any = await User.findById(authUser.id)
    .select({
      _id: 1,
      name: 1,
      email: 1,
    })
    .lean();

  const userName = safeStr(user?.name) || "Verified Student";
  const userEmail = safeStr(user?.email || authUser.email).toLowerCase();

  let saved: any = null;

  try {
    const existing: any = await ProductReview.findOne({
      productId,
      userId: authUser.id,
      deletedAt: null,
    });

    if (existing) {
      existing.productSlug = safeStr(product.slug);
      existing.productTitle = safeStr(product.title);
      existing.userName = userName;
      existing.userEmail = userEmail;
      existing.rating = rating;
      existing.review = review;
      existing.verifiedPurchase = true;
      existing.orderId = purchase.orderId;
      existing.orderRef = safeStr(purchase.orderRef);
      existing.purchasedAt = purchase.paidAt || null;
      existing.purchaseCheckedAt = new Date();
      existing.status = "pending";
      existing.adminNote = "";
      existing.approvedAt = null;
      existing.approvedBy = "";
      existing.rejectedAt = null;
      existing.rejectedBy = "";

      saved = await existing.save();
    } else {
      saved = await ProductReview.create({
        productId,
        productSlug: safeStr(product.slug),
        productTitle: safeStr(product.title),
        userId: authUser.id,
        userName,
        userEmail,
        rating,
        review,
        verifiedPurchase: true,
        orderId: purchase.orderId,
        orderRef: safeStr(purchase.orderRef),
        purchasedAt: purchase.paidAt || null,
        purchaseCheckedAt: new Date(),
        status: "pending",
      });
    }
  } catch (error: any) {
    if (Number(error?.code) === 11000) {
      return NextResponse.json(
        {
          ok: false,
          error: "You have already submitted a review for this product.",
        },
        { status: 409 }
      );
    }

    throw error;
  }

  return NextResponse.json(
    {
      ok: true,
      message: "Review saved successfully.",
      review: mapMyReview(saved),
    },
    { status: 200 }
  );
}
