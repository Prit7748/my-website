import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";
import User from "@/models/User";
import { getAuthUser, hasPermission } from "@/lib/auth";

export const runtime = "nodejs";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function uniqueStrings(arr: string[]) {
  return Array.from(new Set(arr.map((x) => safeStr(x)).filter(Boolean)));
}

function normalizeAvailability(input: any) {
  const v = safeStr(input).toLowerCase();

  if (v === "available" || v === "in_stock" || v === "instock") return "available";

  if (
    v === "on_demand" ||
    v === "ondemand" ||
    v === "on-demand" ||
    v === "coming_soon" ||
    v === "comingsoon" ||
    v === "coming-soon"
  ) {
    return "on_demand";
  }

  if (
    v === "want_to_buy" ||
    v === "wanttobuy" ||
    v === "want-to-buy" ||
    v === "out_of_stock" ||
    v === "outofstock" ||
    v === "out-of-stock"
  ) {
    return "want_to_buy";
  }

  return "available";
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ userId: string }> }
) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!hasPermission(authUser, "products:read") && !hasPermission(authUser, "products:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();

  const { userId } = await ctx.params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  const user: any = await User.findById(userId)
    .select("_id name email phone createdAt")
    .lean();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const allPaidOrders: any[] = await Order.find({
    userId: new mongoose.Types.ObjectId(userId),
    status: "paid",
  })
    .select("items createdAt paidAt totalAmount")
    .sort({ createdAt: -1 })
    .lean();

  const allProductIdsSet = new Set<string>();
  for (const order of allPaidOrders) {
    const items = Array.isArray(order?.items) ? order.items : [];
    for (const it of items) {
      if (it?.productId) allProductIdsSet.add(String(it.productId));
    }
  }

  const allProductIds = Array.from(allProductIdsSet)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const products: any[] = await Product.find({ _id: { $in: allProductIds } })
    .select("_id title slug sku category availability pdfKey isActive courseCodes")
    .lean();

  const productMap = new Map<string, any>();
  for (const p of products) productMap.set(String(p._id), p);

  const purchasedCourseCodes: string[] = [];
  let totalPurchasedProducts = 0;

  const onDemandRows: any[] = [];

  for (const order of allPaidOrders) {
    const items = Array.isArray(order?.items) ? order.items : [];
    totalPurchasedProducts += items.length;

    for (const it of items) {
      const p = productMap.get(String(it?.productId || ""));
      if (!p) continue;

      const courseCodes = Array.isArray(p?.courseCodes) ? p.courseCodes : [];
      purchasedCourseCodes.push(...courseCodes);

      const availability = normalizeAvailability(p?.availability);
      const hasPdf = !!safeStr(p?.pdfKey);
      const isActive = Boolean(p?.isActive);

      if (availability === "on_demand" && !hasPdf && isActive) {
        onDemandRows.push({
          orderDate: order?.paidAt || order?.createdAt || null,
          productId: String(p._id),
          sku: safeStr(p?.sku),
          title: safeStr(p?.title || it?.title),
          slug: safeStr(p?.slug),
          category: safeStr(p?.category || it?.category),
          price: Number(it?.price || p?.price || 0),
        });
      }
    }
  }

  onDemandRows.sort((a, b) => {
    return new Date(b.orderDate || 0).getTime() - new Date(a.orderDate || 0).getTime();
  });

  const joinedAt = user?.createdAt ? new Date(user.createdAt) : null;
  const daysOld = joinedAt
    ? Math.max(
        0,
        Math.floor((Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24))
      )
    : 0;

  return NextResponse.json(
    {
      ok: true,
      user: {
        _id: String(user._id),
        name: safeStr(user.name) || "No Name",
        email: safeStr(user.email),
        phone: safeStr(user.phone) || "-",
        joinedAt: joinedAt ? joinedAt.toISOString() : null,
        daysOld,
      },
      summary: {
        totalPurchasedProducts,
        totalOnDemandProducts: onDemandRows.length,
        purchasedCourseCodes: uniqueStrings(purchasedCourseCodes).slice(0, 30),
      },
      items: onDemandRows,
    },
    { status: 200 }
  );
}