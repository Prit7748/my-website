import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

type OrderTypeFilter = "all" | "product" | "saved_combo" | "builder_combo" | "combo";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function roundMoney(x: any) {
  const n = safeNum(x, 0);
  return Math.round(n * 100) / 100;
}

function escapeRegex(str: string) {
  return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeStatus(value: any) {
  const v = safeStr(value).toLowerCase();
  if (["all", "paid", "pending", "failed", "refunded", "cancelled"].includes(v)) {
    return v;
  }
  return "all";
}

function normalizePaymentGateway(value: any) {
  const v = safeStr(value).toLowerCase();
  if (!v || v === "all") return "all";
  return v;
}

function normalizeType(value: any): OrderTypeFilter {
  const v = safeStr(value).toLowerCase();
  if (v === "product") return "product";
  if (v === "saved_combo") return "saved_combo";
  if (v === "builder_combo") return "builder_combo";
  if (v === "combo") return "combo";
  return "all";
}

function buildTypeQuery(type: OrderTypeFilter) {
  if (type === "product") {
    return {
      items: {
        $elemMatch: {
          $or: [{ itemType: "product" }, { itemType: { $exists: false } }],
        },
      },
    };
  }

  if (type === "saved_combo") {
    return {
      items: {
        $elemMatch: {
          itemType: "combo",
          $or: [{ isBuilderCombo: false }, { isBuilderCombo: { $exists: false } }],
        },
      },
    };
  }

  if (type === "builder_combo") {
    return {
      items: {
        $elemMatch: {
          itemType: "combo",
          isBuilderCombo: true,
        },
      },
    };
  }

  if (type === "combo") {
    return {
      items: {
        $elemMatch: {
          itemType: "combo",
        },
      },
    };
  }

  return {};
}

function parseDateInput(value: string) {
  const v = safeStr(value);
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function dateStartUtc(dateStr: string) {
  const p = parseDateInput(dateStr);
  if (!p) return null;
  return new Date(Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0, 0));
}

function dateEndExclusiveUtc(dateStr: string) {
  const p = parseDateInput(dateStr);
  if (!p) return null;
  return new Date(Date.UTC(p.year, p.month - 1, p.day + 1, 0, 0, 0, 0));
}

function getCustomerName(order: any) {
  const customer =
    order?.customer && typeof order.customer === "object" ? order.customer : {};
  const shipping =
    order?.shipping && typeof order.shipping === "object" ? order.shipping : {};
  const meta = order?.meta && typeof order.meta === "object" ? order.meta : {};

  const customerFullName = [safeStr(customer?.firstName), safeStr(customer?.lastName)]
    .filter(Boolean)
    .join(" ");

  const shippingFullName = [safeStr(shipping?.firstName), safeStr(shipping?.lastName)]
    .filter(Boolean)
    .join(" ");

  return (
    safeStr(customer?.name) ||
    safeStr(customer?.fullName) ||
    customerFullName ||
    safeStr(shipping?.name) ||
    safeStr(shipping?.fullName) ||
    shippingFullName ||
    safeStr(meta?.customerName) ||
    safeStr(meta?.shippingName) ||
    ""
  );
}

function mapOrderForClient(order: any) {
  const customer =
    order?.customer && typeof order.customer === "object" ? order.customer : {};
  const shipping =
    order?.shipping && typeof order.shipping === "object" ? order.shipping : {};

  const customerName = getCustomerName(order);
  const customerEmail =
    safeStr(customer?.email) ||
    safeStr(order?.userEmail) ||
    "";
  const customerPhone =
    safeStr(customer?.phone) ||
    safeStr(shipping?.phone) ||
    "";

  return {
    _id: String(order?._id || ""),
    orderRef: safeStr(order?.orderRef || order?._id || ""),
    userId: safeStr(order?.userId),
    userEmail: safeStr(order?.userEmail),

    customerName,
    customerEmail,
    customerPhone,

    status: safeStr(order?.status || ""),
    totalAmount: roundMoney(order?.totalAmount || 0),
    currency: safeStr(order?.currency || "INR"),
    paymentGateway: safeStr(order?.paymentGateway || ""),
    paymentId: safeStr(order?.paymentId || ""),
    createdAt: order?.createdAt ? new Date(order.createdAt).toISOString() : "",
    paidAt: order?.paidAt ? new Date(order.paidAt).toISOString() : null,

    customer,
    shipping,
    items: Array.isArray(order?.items) ? order.items : [],
    meta: order?.meta || null,
  };
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  await dbConnect();

  const url = new URL(req.url);

  const q = safeStr(url.searchParams.get("q"));
  const status = normalizeStatus(url.searchParams.get("status"));
  const paymentGateway = normalizePaymentGateway(url.searchParams.get("paymentGateway"));
  const type = normalizeType(url.searchParams.get("type"));

  const startDate = safeStr(url.searchParams.get("startDate"));
  const endDate = safeStr(url.searchParams.get("endDate"));

  const page = Math.max(1, Math.trunc(safeNum(url.searchParams.get("page"), 1)));
  const limit = Math.min(
    200,
    Math.max(1, Math.trunc(safeNum(url.searchParams.get("limit"), 15)))
  );
  const skip = (page - 1) * limit;

  const query: any = {
    ...buildTypeQuery(type),
  };

  if (status !== "all") {
    query.status = status;
  }

  if (paymentGateway !== "all") {
    query.paymentGateway = paymentGateway;
  }

  if (startDate || endDate) {
    const range: any = {};
    const startUtc = startDate ? dateStartUtc(startDate) : null;
    const endUtcExclusive = endDate ? dateEndExclusiveUtc(endDate) : null;

    if (startDate && !startUtc) {
      return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
    }

    if (endDate && !endUtcExclusive) {
      return NextResponse.json({ error: "Invalid endDate" }, { status: 400 });
    }

    if (startUtc) range.$gte = startUtc;
    if (endUtcExclusive) range.$lt = endUtcExclusive;

    query.createdAt = range;
  }

  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { orderRef: rx },
        { userEmail: rx },
        { paymentGateway: rx },
        { paymentId: rx },
        { "customer.name": rx },
        { "customer.fullName": rx },
        { "customer.firstName": rx },
        { "customer.lastName": rx },
        { "customer.email": rx },
        { "customer.phone": rx },
        { "shipping.name": rx },
        { "shipping.fullName": rx },
        { "shipping.firstName": rx },
        { "shipping.lastName": rx },
        { "shipping.phone": rx },
        { "items.title": rx },
        { "items.category": rx },
        { "items.comboCategorySlug": rx },
        { "items.comboItems.title": rx },
      ],
    });
  }

  const selectFields =
    "_id orderRef userId userEmail customer shipping status totalAmount currency paymentGateway paymentId createdAt paidAt items meta";

  const [totalOrders, ordersRaw, totalRevenueAgg] = await Promise.all([
    Order.countDocuments(query),
    Order.find(query)
      .select(selectFields)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $ifNull: ["$totalAmount", 0] } },
        },
      },
    ]),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalOrders / limit));
  const orders = Array.isArray(ordersRaw) ? ordersRaw.map(mapOrderForClient) : [];

  return NextResponse.json(
    {
      ok: true,
      filters: {
        q,
        status,
        paymentGateway,
        type,
        startDate,
        endDate,
      },
      summary: {
        totalOrders,
        totalRevenue: roundMoney(totalRevenueAgg?.[0]?.totalRevenue || 0),
        pageOrders: orders.length,
      },
      pagination: {
        page,
        limit,
        totalOrders,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages,
      },
      orders,
    },
    { status: 200 }
  );
}