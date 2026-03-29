import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import Order from "@/models/Order";
import Product from "@/models/Product";
import { createOnDemandTimingResolver } from "@/lib/onDemandTiming";

export const runtime = "nodejs";

type OrderTypeFilter = "all" | "digital" | "hardcopy" | "combo";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function safeBool(x: any, def = false) {
  if (typeof x === "boolean") return x;
  if (typeof x === "string") {
    const v = x.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(v)) return true;
    if (["false", "0", "no", "off"].includes(v)) return false;
  }
  return def;
}

function roundMoney(x: any) {
  const n = safeNum(x, 0);
  return Math.round(n * 100) / 100;
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

function isPhysicalLike(item: any) {
  const category = safeStr(item?.category).toLowerCase();
  const title = safeStr(item?.title).toLowerCase();
  const comboCategorySlug = safeStr(item?.comboCategorySlug).toLowerCase();

  return (
    category.includes("hardcopy") ||
    category.includes("handwritten hardcopy") ||
    title.includes("hardcopy") ||
    title.includes("delivery") ||
    comboCategorySlug.includes("handwritten-hardcopy")
  );
}

function extractShiprocket(meta: any) {
  const sr =
    (meta?.shiprocket && typeof meta.shiprocket === "object" ? meta.shiprocket : null) ||
    (meta?.shippingMeta?.shiprocket && typeof meta.shippingMeta.shiprocket === "object"
      ? meta.shippingMeta.shiprocket
      : null) ||
    (meta?.shipment && typeof meta.shipment === "object" ? meta.shipment : null) ||
    {};

  return {
    enabled: safeBool(sr?.enabled, false),
    status: safeStr(
      sr?.status ||
        sr?.shipmentStatus ||
        sr?.currentStatus ||
        sr?.trackingStatus
    ),
    message: safeStr(sr?.message || sr?.note || sr?.statusMessage),
    shiprocketOrderId: safeStr(
      sr?.shiprocketOrderId || sr?.orderId || sr?.srOrderId
    ),
    shipmentId: safeStr(sr?.shipmentId || sr?.shipment_id),
    awbCode: safeStr(sr?.awbCode || sr?.awb_code || sr?.awb),
    courierName: safeStr(
      sr?.courierName || sr?.courier || sr?.courierCompanyName
    ),
    syncedAt: safeStr(sr?.syncedAt || sr?.updatedAt || sr?.lastSyncAt),
  };
}

function itTypeFromItem(it: any) {
  return safeStr(it?.itemType).toLowerCase() === "combo" ? "combo" : "product";
}

function matchesTypeFilter(order: any, type: OrderTypeFilter) {
  const items = Array.isArray(order?.items) ? order.items : [];

  if (type === "digital") {
    return items.some((it: any) => it?.itemType === "product" && !it?.isPhysical);
  }

  if (type === "hardcopy") {
    return items.some((it: any) => Boolean(it?.isPhysical));
  }

  if (type === "combo") {
    return items.some((it: any) => it?.itemType === "combo");
  }

  return true;
}

function matchesSearch(order: any, q: string) {
  const query = safeStr(q).toLowerCase();
  if (!query) return true;

  const shipping = order?.shipping || {};
  const shiprocket = order?.shiprocket || {};
  const items = Array.isArray(order?.items) ? order.items : [];

  const hay = [
    safeStr(order?._id),
    safeStr(order?.orderRef),
    safeStr(order?.status),
    safeStr(order?.currency),
    safeStr(shipping?.address),
    safeStr(shipping?.city),
    safeStr(shipping?.state),
    safeStr(shipping?.pincode),
    safeStr(shiprocket?.status),
    safeStr(shiprocket?.message),
    safeStr(shiprocket?.shiprocketOrderId),
    safeStr(shiprocket?.shipmentId),
    safeStr(shiprocket?.awbCode),
    safeStr(shiprocket?.courierName),
    ...items.flatMap((it: any) => [
      safeStr(it?.title),
      safeStr(it?.category),
      safeStr(it?.productId),
      safeStr(it?.comboSlug),
      safeStr(it?.comboCategorySlug),
      safeStr(it?.comboBadge),
      safeStr(it?.comboSaveLabel),
      safeStr(it?.comboMediumLabel),
      safeStr(it?.comboSessionLabel),
      safeStr(it?.currentAvailability),
      safeStr(it?.shiprocketStatus),
      safeStr(it?.shiprocketAwbCode),
      safeStr(it?.shiprocketCourierName),
      safeStr(it?.onDemandTimingSource),
      ...(Array.isArray(it?.comboItems)
        ? it.comboItems.flatMap((x: any) => [safeStr(x?.title), safeStr(x?.subtitle)])
        : []),
    ]),
  ]
    .join(" ")
    .toLowerCase();

  return hay.includes(query);
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  await dbConnect();

  const url = new URL(req.url);
  const q = safeStr(url.searchParams.get("q"));
  const typeRaw = safeStr(url.searchParams.get("type")).toLowerCase();
  const type: OrderTypeFilter =
    typeRaw === "digital" || typeRaw === "hardcopy" || typeRaw === "combo"
      ? typeRaw
      : "all";

  const page = Math.max(1, Math.trunc(safeNum(url.searchParams.get("page"), 1)));
  const limit = Math.min(24, Math.max(1, Math.trunc(safeNum(url.searchParams.get("limit"), 8))));

  const now = new Date();

  const orders: any[] = await Order.find({
    userId: user.id,
    status: "paid",
    expiresAt: { $gt: now },
  })
    .select(
      "_id orderRef status paidAt expiresAt createdAt totalAmount walletDebitAmount currency items shipping meta"
    )
    .sort({ paidAt: -1, createdAt: -1, _id: -1 })
    .lean();

  const productIds = Array.from(
    new Set(
      orders.flatMap((o: any) =>
        Array.isArray(o?.items)
          ? o.items
              .filter((it: any) => itTypeFromItem(it) !== "combo")
              .map((it: any) => safeStr(it?.productId))
              .filter(Boolean)
          : []
      )
    )
  );

  const products: any[] = productIds.length
    ? await Product.find({ _id: { $in: productIds } })
        .select("category courseCodes availability deliverWithinMinutes onDemandNote title isDigital")
        .lean()
    : [];

  const productMap = new Map<string, any>();
  for (const p of products) {
    productMap.set(String(p?._id || ""), p);
  }

  const resolveTiming = await createOnDemandTimingResolver(products);

  const enrichedOrders = orders.map((o: any) => {
    const items = Array.isArray(o?.items) ? o.items : [];
    const shiprocket = extractShiprocket(o?.meta);
    const hasPhysicalItem =
      safeBool(o?.meta?.hasPhysicalItem, false) || items.some((it: any) => isPhysicalLike(it));

    const enrichedItems = items.map((it: any) => {
      const pid = safeStr(it?.productId);
      const itemType = itTypeFromItem(it);
      const combo = itemType === "combo";
      const productDoc = !combo ? productMap.get(pid) : null;

      const currentAvailability = combo
        ? ""
        : normalizeAvailability(productDoc?.availability || it?.currentAvailability);

      const isPhysical = combo
        ? false
        : isPhysicalLike(it) || !safeBool(productDoc?.isDigital, true);

      const resolvedTiming = !combo
        ? resolveTiming({
            category: productDoc?.category || it?.category,
            courseCodes: Array.isArray(productDoc?.courseCodes)
              ? productDoc.courseCodes
              : Array.isArray(it?.courseCodes)
              ? it.courseCodes
              : [],
            deliverWithinMinutes: productDoc?.deliverWithinMinutes,
            onDemandNote: productDoc?.onDemandNote,
          })
        : null;

      return {
        productId: pid,
        itemType: combo ? "combo" : "product",
        isBuilderCombo: Boolean(it?.isBuilderCombo),

        title: safeStr(it?.title),
        category: safeStr(it?.category),
        price: safeNum(it?.price, 0),
        quantity: Math.max(1, safeNum(it?.quantity, 1)),

        comboSlug: safeStr(it?.comboSlug),
        comboCategorySlug: safeStr(it?.comboCategorySlug),
        comboBadge: safeStr(it?.comboBadge),
        comboSaveLabel: safeStr(it?.comboSaveLabel),
        comboMediumLabel: safeStr(it?.comboMediumLabel),
        comboSessionLabel: safeStr(it?.comboSessionLabel),
        comboItems: Array.isArray(it?.comboItems)
          ? it.comboItems.map((x: any) => ({
              title: safeStr(x?.title),
              subtitle: safeStr(x?.subtitle),
            }))
          : [],

        isPhysical,
        currentAvailability,

        deliverWithinMinutes: !combo
          ? Math.max(1, safeNum(resolvedTiming?.deliverWithinMinutes, productDoc?.deliverWithinMinutes || 20))
          : 0,
        onDemandNote: !combo
          ? safeStr(resolvedTiming?.onDemandNote || productDoc?.onDemandNote)
          : "",

        rawDeliverWithinMinutes: !combo
          ? Math.max(1, safeNum(productDoc?.deliverWithinMinutes, 20))
          : 0,
        rawOnDemandNote: !combo ? safeStr(productDoc?.onDemandNote) : "",

        onDemandTimingSource: !combo ? safeStr(resolvedTiming?.source) : "",
        onDemandMatchedCourseCode: !combo ? safeStr(resolvedTiming?.matchedCourseCode) : "",
        onDemandMatchedRuleId: !combo ? safeStr(resolvedTiming?.matchedRuleId) : "",
        onDemandMatchedRuleType: !combo ? safeStr(resolvedTiming?.matchedRuleType) : "",

        shiprocketStatus: isPhysical ? safeStr(shiprocket?.status) : "",
        shiprocketMessage: isPhysical ? safeStr(shiprocket?.message) : "",
        shiprocketOrderId: isPhysical ? safeStr(shiprocket?.shiprocketOrderId) : "",
        shiprocketShipmentId: isPhysical ? safeStr(shiprocket?.shipmentId) : "",
        shiprocketAwbCode: isPhysical ? safeStr(shiprocket?.awbCode) : "",
        shiprocketCourierName: isPhysical ? safeStr(shiprocket?.courierName) : "",
      };
    });

    const walletUsedAmount = roundMoney(o?.walletDebitAmount || 0);
    const payableAmount = roundMoney(o?.totalAmount || 0);
    const orderValue = roundMoney(payableAmount + walletUsedAmount);

    return {
      _id: String(o?._id || ""),
      orderRef: safeStr(o?.orderRef || o?._id || ""),
      status: safeStr(o?.status || "paid"),
      paidAt: o?.paidAt ? new Date(o.paidAt).toISOString() : null,
      expiresAt: o?.expiresAt ? new Date(o.expiresAt).toISOString() : null,
      createdAt: o?.createdAt ? new Date(o.createdAt).toISOString() : null,
      totalAmount: payableAmount,
      walletUsedAmount,
      orderValue,
      currency: safeStr(o?.currency || "INR"),
      hasPhysicalItem,
      shipping:
        o?.shipping && typeof o.shipping === "object"
          ? {
              address: safeStr(o.shipping?.address),
              pincode: safeStr(o.shipping?.pincode),
              city: safeStr(o.shipping?.city),
              state: safeStr(o.shipping?.state),
            }
          : null,
      shiprocket,
      items: enrichedItems,
    };
  });

  const filteredOrders = enrichedOrders.filter(
    (order: any) => matchesTypeFilter(order, type) && matchesSearch(order, q)
  );

  const summary = filteredOrders.reduce(
    (acc: any, order: any) => {
      acc.orders += 1;
      acc.totalValue = roundMoney(acc.totalValue + roundMoney(order?.orderValue || 0));
      acc.walletUsedAmount = roundMoney(
        acc.walletUsedAmount + roundMoney(order?.walletUsedAmount || 0)
      );

      for (const it of Array.isArray(order?.items) ? order.items : []) {
        if (it?.itemType === "combo") {
          acc.comboCount += Math.max(1, safeNum(it?.quantity, 1));
        } else if (it?.isPhysical) {
          acc.hardcopyCount += Math.max(1, safeNum(it?.quantity, 1));
        } else {
          acc.digitalCount += Math.max(1, safeNum(it?.quantity, 1));
        }
      }

      return acc;
    },
    {
      orders: 0,
      totalValue: 0,
      walletUsedAmount: 0,
      digitalCount: 0,
      hardcopyCount: 0,
      comboCount: 0,
    }
  );

  const totalOrders = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalOrders / limit));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * limit;
  const pageOrders = filteredOrders.slice(skip, skip + limit);

  return NextResponse.json(
    {
      ok: true,
      filters: {
        q,
        type,
      },
      summary,
      pagination: {
        page: safePage,
        limit,
        totalOrders,
        totalPages,
        hasPrev: safePage > 1,
        hasNext: safePage < totalPages,
      },
      orders: pageOrders,
    },
    { status: 200 }
  );
}