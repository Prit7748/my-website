import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import WantToBuy from "@/models/WantToBuy";
import Product from "@/models/Product";
import { getAuthUser, hasPermission } from "@/lib/auth";

export const runtime = "nodejs";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!hasPermission(user, "products:read") && !hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();

  const url = new URL(req.url);
  const q = safeStr(url.searchParams.get("q"));
  const status = safeStr(url.searchParams.get("status")).toLowerCase();
  const page = Math.max(1, Math.trunc(safeNum(url.searchParams.get("page"), 1)));
  const limit = Math.min(100, Math.max(1, Math.trunc(safeNum(url.searchParams.get("limit"), 50))));
  const skip = (page - 1) * limit;

  const match: any = {};
  if (status && ["new", "contacted", "closed"].includes(status)) {
    match.status = status;
  }

  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    match.$or = [
      { productTitle: rx },
      { productSlug: rx },
      { userEmail: rx },
      { phone: rx },
      { message: rx },
    ];

    if (mongoose.Types.ObjectId.isValid(q)) {
      match.$or.push({ productId: new mongoose.Types.ObjectId(q) });
    }
  }

  const [summaryRows, totalsAgg] = await Promise.all([
    WantToBuy.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$productId",
          productId: { $first: "$productId" },
          productTitle: { $last: "$productTitle" },
          productSlug: { $last: "$productSlug" },
          category: { $last: "$category" },
          totalEnquiries: { $sum: 1 },
          uniqueEmails: { $addToSet: "$userEmail" },
          pending: {
            $sum: {
              $cond: [{ $eq: ["$status", "new"] }, 1, 0],
            },
          },
          latestAt: { $max: "$createdAt" },
        },
      },
      {
        $project: {
          _id: 0,
          productId: { $toString: "$productId" },
          productTitle: 1,
          productSlug: 1,
          category: 1,
          totalEnquiries: 1,
          uniqueCustomers: {
            $size: {
              $filter: {
                input: "$uniqueEmails",
                as: "em",
                cond: { $gt: [{ $strLenCP: { $ifNull: ["$$em", ""] } }, 0] },
              },
            },
          },
          pending: 1,
          latestAt: 1,
        },
      },
      { $sort: { totalEnquiries: -1, pending: -1, latestAt: -1, productTitle: 1 } },
      { $skip: skip },
      { $limit: limit },
    ]),
    WantToBuy.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$productId",
        },
      },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
        },
      },
    ]),
  ]);

  const productIds = summaryRows
    .map((x: any) => safeStr(x.productId))
    .filter((x: string) => mongoose.Types.ObjectId.isValid(x))
    .map((x: string) => new mongoose.Types.ObjectId(x));

  const products = await Product.find({ _id: { $in: productIds } })
    .select("_id title slug deletedAt")
    .lean();

  const productMap = new Map<string, any>();
  for (const p of products) {
    productMap.set(String((p as any)._id), p);
  }

  const items = summaryRows.map((row: any) => {
    const p = productMap.get(String(row.productId));
    return {
      productId: String(row.productId),
      productTitle: safeStr(p?.title) || safeStr(row.productTitle) || "Untitled Product",
      productSlug: safeStr(p?.slug) || safeStr(row.productSlug),
      totalEnquiries: Number(row.totalEnquiries || 0),
      uniqueCustomers: Number(row.uniqueCustomers || 0),
      pending: Number(row.pending || 0),
      latestAt: row.latestAt || null,
      productExists: !!p,
      productDeleted: !!p?.deletedAt,
    };
  });

  const totalProducts = Number(totalsAgg?.[0]?.totalProducts || 0);
  const totalEnquiries = await WantToBuy.countDocuments(match);

  return NextResponse.json(
    {
      ok: true,
      items,
      meta: {
        page,
        limit,
        count: items.length,
        totalProducts,
        totalEnquiries,
      },
      filters: {
        q,
        status: status || "",
      },
    },
    { status: 200 }
  );
}