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

function safeInt(x: any, def = -1) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.trunc(n) : def;
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

function canRemoveAsOnDemand(product: any) {
  if (!product) return false;

  const availability = normalizeAvailability(product?.availability);
  const hasPdf = !!safeStr(product?.pdfKey);
  const isActive = Boolean(product?.isActive);

  return availability === "on_demand" && !hasPdf && isActive;
}

async function ensureAdminAccess() {
  const authUser = await getAuthUser();

  if (!authUser) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  if (!hasPermission(authUser, "products:read") && !hasPermission(authUser, "products:write")) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, authUser };
}

function buildLineId(orderId: string, itemIndex: number, productId: string) {
  return `${safeStr(orderId)}::${Math.max(0, itemIndex)}::${safeStr(productId)}`;
}

function parseLineId(lineId: string) {
  const raw = safeStr(lineId);
  const parts = raw.split("::");

  return {
    orderMongoId: safeStr(parts[0]),
    itemIndex: safeInt(parts[1], -1),
    productId: safeStr(parts[2]),
  };
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ userId: string }> }
) {
  const access = await ensureAdminAccess();
  if (!access.ok) return access.response;

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
    .select("_id orderRef items createdAt paidAt totalAmount")
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

    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const it = items[itemIndex];
      const p = productMap.get(String(it?.productId || ""));
      if (!p) continue;

      const courseCodes = Array.isArray(p?.courseCodes) ? p.courseCodes : [];
      purchasedCourseCodes.push(...courseCodes);

      const availability = normalizeAvailability(p?.availability);
      const hasPdf = !!safeStr(p?.pdfKey);
      const isActive = Boolean(p?.isActive);

      if (availability === "on_demand" && !hasPdf && isActive) {
        const orderMongoId = String(order?._id || "");
        const productId = String(p?._id || "");

        onDemandRows.push({
          lineId: buildLineId(orderMongoId, itemIndex, productId),
          orderMongoId,
          orderId: safeStr(order?.orderRef || order?._id),
          orderDate: order?.paidAt || order?.createdAt || null,
          productId,
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

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ userId: string }> }
) {
  const access = await ensureAdminAccess();
  if (!access.ok) return access.response;

  await dbConnect();

  const { userId } = await ctx.params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  const userDoc: any = await User.findById(userId).select("_id name email").lean();
  if (!userDoc) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const lineId = safeStr(url.searchParams.get("lineId"));

  if (lineId) {
    const parsed = parseLineId(lineId);

    if (!mongoose.Types.ObjectId.isValid(parsed.orderMongoId)) {
      return NextResponse.json({ error: "Invalid order reference." }, { status: 400 });
    }

    if (parsed.itemIndex < 0) {
      return NextResponse.json({ error: "Invalid item reference." }, { status: 400 });
    }

    const order: any = await Order.findOne({
      _id: new mongoose.Types.ObjectId(parsed.orderMongoId),
      userId: new mongoose.Types.ObjectId(userId),
      status: "paid",
    });

    if (!order) {
      return NextResponse.json({ error: "Paid order not found." }, { status: 404 });
    }

    const orderItems = Array.isArray(order?.items) ? order.items : [];
    if (parsed.itemIndex >= orderItems.length) {
      return NextResponse.json(
        { error: "Selected item no longer exists in this order." },
        { status: 404 }
      );
    }

    const targetItem = orderItems[parsed.itemIndex];
    const targetProductId = safeStr(targetItem?.productId);

    if (!targetProductId) {
      return NextResponse.json({ error: "Target product not found." }, { status: 404 });
    }

    if (parsed.productId && parsed.productId !== targetProductId) {
      return NextResponse.json(
        { error: "Item mismatch detected. Please refresh and try again." },
        { status: 409 }
      );
    }

    const productDoc: any = mongoose.Types.ObjectId.isValid(targetProductId)
      ? await Product.findById(targetProductId)
          .select("_id title availability pdfKey isActive")
          .lean()
      : null;

    if (!canRemoveAsOnDemand(productDoc)) {
      return NextResponse.json(
        {
          error: "This selected item is no longer an active on-demand product.",
        },
        { status: 400 }
      );
    }

    const keptItems = orderItems.filter((_: any, idx: number) => idx !== parsed.itemIndex);
    const removedTitle = safeStr(productDoc?.title || targetItem?.title);

    order.items = keptItems;

    if (!keptItems.length) {
      order.status = "refunded";
    }

    await order.save();

    return NextResponse.json(
      {
        ok: true,
        mode: "single",
        message: "Selected on-demand item deleted successfully.",
        summary: {
          affectedOrders: 1,
          removedOnDemandProducts: 1,
          fullyRefundedOrders: keptItems.length ? 0 : 1,
          partiallyUpdatedOrders: keptItems.length ? 1 : 0,
        },
        removed: {
          orderId: safeStr(order?.orderRef || order?._id),
          productId: targetProductId,
          title: removedTitle,
        },
      },
      { status: 200 }
    );
  }

  const paidOrders: any[] = await Order.find({
    userId: new mongoose.Types.ObjectId(userId),
    status: "paid",
  }).sort({ createdAt: -1 });

  if (!paidOrders.length) {
    return NextResponse.json(
      {
        ok: false,
        error: "No paid orders found for this user.",
      },
      { status: 404 }
    );
  }

  const productIdsSet = new Set<string>();
  for (const order of paidOrders) {
    const items = Array.isArray(order?.items) ? order.items : [];
    for (const it of items) {
      const pid = safeStr(it?.productId);
      if (pid && mongoose.Types.ObjectId.isValid(pid)) {
        productIdsSet.add(pid);
      }
    }
  }

  const productIds = Array.from(productIdsSet).map((id) => new mongoose.Types.ObjectId(id));

  const products: any[] = productIds.length
    ? await Product.find({ _id: { $in: productIds } })
        .select("_id availability pdfKey isActive title")
        .lean()
    : [];

  const removableProductIds = new Set<string>();
  const removableTitleSet = new Set<string>();

  for (const product of products) {
    if (canRemoveAsOnDemand(product)) {
      const pid = String(product?._id || "");
      if (pid) removableProductIds.add(pid);

      const title = safeStr(product?.title);
      if (title) removableTitleSet.add(title);
    }
  }

  if (!removableProductIds.size) {
    return NextResponse.json(
      {
        ok: false,
        error: "No active on-demand products found to delete for this user.",
      },
      { status: 400 }
    );
  }

  let affectedOrders = 0;
  let fullyRefundedOrders = 0;
  let partiallyUpdatedOrders = 0;
  let removedOnDemandProducts = 0;

  for (const order of paidOrders) {
    const originalItems = Array.isArray(order?.items) ? order.items : [];
    if (!originalItems.length) continue;

    const keptItems = [];
    let removedInThisOrder = 0;

    for (const item of originalItems) {
      const pid = safeStr(item?.productId);
      const shouldRemove = pid && removableProductIds.has(pid);

      if (shouldRemove) {
        removedInThisOrder += Math.max(1, Number(item?.quantity || 1));
        continue;
      }

      keptItems.push(item);
    }

    if (!removedInThisOrder) continue;

    affectedOrders += 1;
    removedOnDemandProducts += removedInThisOrder;

    order.items = keptItems;

    if (!keptItems.length) {
      order.status = "refunded";
      fullyRefundedOrders += 1;
    } else {
      partiallyUpdatedOrders += 1;
    }

    await order.save();
  }

  if (!affectedOrders) {
    return NextResponse.json(
      {
        ok: false,
        error: "No removable on-demand entries were updated.",
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      mode: "bulk",
      message: "All current on-demand entries deleted successfully.",
      user: {
        userId: String(userDoc?._id || ""),
        name: safeStr(userDoc?.name) || "No Name",
        email: safeStr(userDoc?.email),
      },
      summary: {
        affectedOrders,
        fullyRefundedOrders,
        partiallyUpdatedOrders,
        removedOnDemandProducts,
        removedDistinctProducts: removableProductIds.size,
        removedTitles: Array.from(removableTitleSet).slice(0, 20),
      },
    },
    { status: 200 }
  );
}