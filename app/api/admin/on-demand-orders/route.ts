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

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!hasPermission(user, "products:read") && !hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();

  const url = new URL(req.url);
  const q = safeStr(url.searchParams.get("q")).toLowerCase();

  const paidOrders: any[] = await Order.find({ status: "paid" })
    .select("userId userEmail items createdAt paidAt")
    .sort({ createdAt: -1 })
    .lean();

  const productIdsSet = new Set<string>();
  const userIdsSet = new Set<string>();

  for (const order of paidOrders) {
    if (order?.userId) userIdsSet.add(String(order.userId));
    const items = Array.isArray(order?.items) ? order.items : [];
    for (const it of items) {
      if (it?.productId) productIdsSet.add(String(it.productId));
    }
  }

  const productIds = Array.from(productIdsSet)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const userIds = Array.from(userIdsSet)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const products: any[] = await Product.find({ _id: { $in: productIds } })
    .select("_id title slug category availability pdfKey isActive sku")
    .lean();

  const users: any[] = await User.find({ _id: { $in: userIds } })
    .select("_id name email phone createdAt")
    .lean();

  const productMap = new Map<string, any>();
  for (const p of products) productMap.set(String(p._id), p);

  const userMap = new Map<string, any>();
  for (const u of users) userMap.set(String(u._id), u);

  const grouped = new Map<
    string,
    {
      userId: string;
      userName: string;
      userEmail: string;
      userPhone: string;
      joinedAt: string | null;
      totalPurchasedProducts: number;
      totalOnDemandProducts: number;
      latestAt: string | null;
      productIds: Set<string>;
    }
  >();

  for (const order of paidOrders) {
    const uid = safeStr(order?.userId);
    if (!uid) continue;

    const dbUser = userMap.get(uid);

    const items = Array.isArray(order?.items) ? order.items : [];
    const totalPurchasedProducts = items.length;

    const onDemandItems = items.filter((it: any) => {
      const p = productMap.get(String(it?.productId || ""));
      if (!p) return false;

      const availability = normalizeAvailability(p?.availability);
      const hasPdf = !!safeStr(p?.pdfKey);
      const isActive = Boolean(p?.isActive);

      return availability === "on_demand" && !hasPdf && isActive;
    });

    if (!onDemandItems.length) continue;

    if (!grouped.has(uid)) {
      grouped.set(uid, {
        userId: uid,
        userName: safeStr(dbUser?.name),
        userEmail: safeStr(dbUser?.email || order?.userEmail),
        userPhone: safeStr(dbUser?.phone),
        joinedAt: dbUser?.createdAt ? new Date(dbUser.createdAt).toISOString() : null,
        totalPurchasedProducts: 0,
        totalOnDemandProducts: 0,
        latestAt: null,
        productIds: new Set<string>(),
      });
    }

    const row = grouped.get(uid)!;

    row.totalPurchasedProducts += totalPurchasedProducts;
    row.totalOnDemandProducts += onDemandItems.length;

    const dt = order?.paidAt || order?.createdAt || null;
    if (dt) {
      const iso = new Date(dt).toISOString();
      if (!row.latestAt || new Date(iso).getTime() > new Date(row.latestAt).getTime()) {
        row.latestAt = iso;
      }
    }

    for (const it of onDemandItems) {
      if (it?.productId) row.productIds.add(String(it.productId));
    }
  }

  let items = Array.from(grouped.values()).map((x) => ({
    userId: x.userId,
    userName: x.userName || "No Name",
    userEmail: x.userEmail,
    userPhone: x.userPhone || "-",
    joinedAt: x.joinedAt,
    totalPurchasedProducts: x.totalPurchasedProducts,
    totalOnDemandProducts: x.totalOnDemandProducts,
    latestAt: x.latestAt,
    distinctOnDemandProducts: x.productIds.size,
  }));

  if (q) {
    items = items.filter((x) => {
      const hay = [x.userName, x.userEmail, x.userPhone].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  items.sort((a, b) => {
    const byOnDemand = Number(b.totalOnDemandProducts || 0) - Number(a.totalOnDemandProducts || 0);
    if (byOnDemand !== 0) return byOnDemand;

    return new Date(b.latestAt || 0).getTime() - new Date(a.latestAt || 0).getTime();
  });

  return NextResponse.json(
    {
      ok: true,
      items,
      stats: {
        totalUsers: items.length,
        totalOnDemandProducts: items.reduce((acc, x) => acc + Number(x.totalOnDemandProducts || 0), 0),
      },
    },
    { status: 200 }
  );
}