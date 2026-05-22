import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
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
  if (typeof x === "number") return x === 1;

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

function isObjectIdLike(input: any) {
  return mongoose.Types.ObjectId.isValid(safeStr(input));
}

function uniqueStrings(arr: any[]) {
  return Array.from(
    new Set(
      (Array.isArray(arr) ? arr : [])
        .map((x: any) => safeStr(x))
        .filter(Boolean)
    )
  );
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
      sr?.status || sr?.shipmentStatus || sr?.currentStatus || sr?.trackingStatus
    ),
    message: safeStr(sr?.message || sr?.note || sr?.statusMessage),
    shiprocketOrderId: safeStr(sr?.shiprocketOrderId || sr?.orderId || sr?.srOrderId),
    shipmentId: safeStr(sr?.shipmentId || sr?.shipment_id),
    awbCode: safeStr(sr?.awbCode || sr?.awb_code || sr?.awb),
    courierName: safeStr(sr?.courierName || sr?.courier || sr?.courierCompanyName),
    syncedAt: safeStr(sr?.syncedAt || sr?.updatedAt || sr?.lastSyncAt),
  };
}

function itTypeFromItem(it: any) {
  return safeStr(it?.itemType).toLowerCase() === "combo" ? "combo" : "product";
}

function isBuilderComboItem(it: any) {
  const productId = safeStr(it?.productId).toLowerCase();

  return Boolean(it?.isBuilderCombo) || productId.startsWith("builder-combo:");
}

function extractBuilderComboProductIds(it: any) {
  const explicitIds = Array.isArray(it?.comboBuilderProductIds)
    ? it.comboBuilderProductIds.map((x: any) => safeStr(x)).filter(Boolean)
    : [];

  if (explicitIds.length > 0) {
    return uniqueStrings(explicitIds).filter(isObjectIdLike);
  }

  const productId = safeStr(it?.productId);

  if (!productId.toLowerCase().startsWith("builder-combo:")) {
    return [];
  }

  const parts = productId.split(":");
  const encodedIds = safeStr(parts.slice(2).join(":"));

  if (!encodedIds) {
    return [];
  }

  return uniqueStrings(encodedIds.split("-")).filter(isObjectIdLike);
}

function buildDownloadUrl(productId: string, download = false) {
  const id = safeStr(productId);
  if (!id) return "";

  const qs = new URLSearchParams({ productId: id });

  if (download) {
    qs.set("download", "1");
  }

  return `/api/products/download?${qs.toString()}`;
}

function normalizeComboItems(items: any[]) {
  return Array.isArray(items)
    ? items
        .map((x: any) => ({
          title: safeStr(x?.title),
          subtitle: safeStr(x?.subtitle),
        }))
        .filter((x: any) => x.title)
    : [];
}

function buildProductItemFromOrderLine(params: {
  item: any;
  productId: string;
  productDoc: any;
  resolveTiming: any;
  shiprocket: any;
  source?: "direct" | "builder_combo_child";
  parentCombo?: any;
}) {
  const {
    item,
    productId,
    productDoc,
    resolveTiming,
    shiprocket,
    source = "direct",
    parentCombo = null,
  } = params;

  const resolvedTiming = resolveTiming({
    category: productDoc?.category || item?.category,
    courseCodes: Array.isArray(productDoc?.courseCodes)
      ? productDoc.courseCodes
      : Array.isArray(item?.courseCodes)
      ? item.courseCodes
      : [],
    deliverWithinMinutes: productDoc?.deliverWithinMinutes,
    onDemandNote: productDoc?.onDemandNote,
  });

  const isPhysical =
    isPhysicalLike({
      ...item,
      category: productDoc?.category || item?.category,
      title: productDoc?.title || item?.title,
      comboCategorySlug: parentCombo?.comboCategorySlug || item?.comboCategorySlug,
    }) || !safeBool(productDoc?.isDigital, true);

  const currentAvailability = normalizeAvailability(
    productDoc?.availability || item?.currentAvailability
  );

  return {
    productId,
    itemType: "product",
    isBuilderCombo: false,
    isFromBuilderCombo: source === "builder_combo_child",
    parentComboId: parentCombo ? safeStr(parentCombo?.productId) : "",
    parentComboTitle: parentCombo ? safeStr(parentCombo?.title) : "",

    title: safeStr(productDoc?.title || item?.title),
    category: safeStr(productDoc?.category || item?.category),
    price:
      source === "builder_combo_child"
        ? 0
        : safeNum(item?.price ?? item?.payableUnitPrice, 0),
    quantity: source === "builder_combo_child" ? 1 : Math.max(1, safeNum(item?.quantity, 1)),

    comboSlug: "",
    comboCategorySlug: parentCombo ? safeStr(parentCombo?.comboCategorySlug) : "",
    comboBadge: parentCombo ? safeStr(parentCombo?.comboBadge) : "",
    comboSaveLabel: parentCombo ? safeStr(parentCombo?.comboSaveLabel) : "",
    comboMediumLabel: parentCombo ? safeStr(parentCombo?.comboMediumLabel) : "",
    comboSessionLabel: parentCombo ? safeStr(parentCombo?.comboSessionLabel) : "",
    comboItems: [],

    isPhysical,
    currentAvailability,

    deliverWithinMinutes: Math.max(
      1,
      safeNum(resolvedTiming?.deliverWithinMinutes, productDoc?.deliverWithinMinutes || 20)
    ),
    onDemandNote: safeStr(resolvedTiming?.onDemandNote || productDoc?.onDemandNote),

    rawDeliverWithinMinutes: Math.max(1, safeNum(productDoc?.deliverWithinMinutes, 20)),
    rawOnDemandNote: safeStr(productDoc?.onDemandNote),

    onDemandTimingSource: safeStr(resolvedTiming?.source),
    onDemandMatchedCourseCode: safeStr(resolvedTiming?.matchedCourseCode),
    onDemandMatchedRuleId: safeStr(resolvedTiming?.matchedRuleId),
    onDemandMatchedRuleType: safeStr(resolvedTiming?.matchedRuleType),

    previewUrl: !isPhysical ? buildDownloadUrl(productId, false) : "",
    downloadUrl: !isPhysical ? buildDownloadUrl(productId, true) : "",
    canDownload: !isPhysical,

    shiprocketStatus: isPhysical ? safeStr(shiprocket?.status) : "",
    shiprocketMessage: isPhysical ? safeStr(shiprocket?.message) : "",
    shiprocketOrderId: isPhysical ? safeStr(shiprocket?.shiprocketOrderId) : "",
    shiprocketShipmentId: isPhysical ? safeStr(shiprocket?.shipmentId) : "",
    shiprocketAwbCode: isPhysical ? safeStr(shiprocket?.awbCode) : "",
    shiprocketCourierName: isPhysical ? safeStr(shiprocket?.courierName) : "",
  };
}

function buildComboParentItem(it: any) {
  return {
    productId: safeStr(it?.productId),
    itemType: "combo",
    isBuilderCombo: isBuilderComboItem(it),
    comboBuilderProductIds: extractBuilderComboProductIds(it),

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
    comboItems: normalizeComboItems(it?.comboItems),

    isPhysical: false,
    currentAvailability: "",

    deliverWithinMinutes: 0,
    onDemandNote: "",

    rawDeliverWithinMinutes: 0,
    rawOnDemandNote: "",

    onDemandTimingSource: "",
    onDemandMatchedCourseCode: "",
    onDemandMatchedRuleId: "",
    onDemandMatchedRuleType: "",

    previewUrl: "",
    downloadUrl: "",
    canDownload: false,

    shiprocketStatus: "",
    shiprocketMessage: "",
    shiprocketOrderId: "",
    shiprocketShipmentId: "",
    shiprocketAwbCode: "",
    shiprocketCourierName: "",
  };
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
      safeStr(it?.parentComboTitle),
      safeStr(it?.currentAvailability),
      safeStr(it?.shiprocketStatus),
      safeStr(it?.shiprocketAwbCode),
      safeStr(it?.shiprocketCourierName),
      safeStr(it?.onDemandTimingSource),
      ...(Array.isArray(it?.comboItems)
        ? it.comboItems.flatMap((x: any) => [safeStr(x?.title), safeStr(x?.subtitle)])
        : []),
      ...(Array.isArray(it?.comboBuilderProductIds)
        ? it.comboBuilderProductIds.map((x: any) => safeStr(x))
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

  const productIds = uniqueStrings(
    orders.flatMap((o: any) =>
      Array.isArray(o?.items)
        ? o.items.flatMap((it: any) => {
            const itemType = itTypeFromItem(it);

            if (itemType === "combo") {
              return isBuilderComboItem(it) ? extractBuilderComboProductIds(it) : [];
            }

            return [safeStr(it?.productId)];
          })
        : []
    )
  ).filter(isObjectIdLike);

  const products: any[] = productIds.length
    ? await Product.find({ _id: { $in: productIds } })
        .select(
          "title category courseCodes availability deliverWithinMinutes onDemandNote price isDigital"
        )
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

    const enrichedItems = items.flatMap((it: any) => {
      const pid = safeStr(it?.productId);
      const itemType = itTypeFromItem(it);
      const combo = itemType === "combo";

      if (combo) {
        const parentComboItem = buildComboParentItem(it);

        if (!isBuilderComboItem(it)) {
          return [parentComboItem];
        }

        const childProductIds = extractBuilderComboProductIds(it);

        const childItems = childProductIds
          .map((childProductId: string) => {
            const productDoc = productMap.get(childProductId);
            if (!productDoc) return null;

            return buildProductItemFromOrderLine({
              item: it,
              productId: childProductId,
              productDoc,
              resolveTiming,
              shiprocket,
              source: "builder_combo_child",
              parentCombo: it,
            });
          })
          .filter(Boolean);

        return [parentComboItem, ...childItems];
      }

      if (!isObjectIdLike(pid)) {
        return [];
      }

      const productDoc = productMap.get(pid);

      return [
        buildProductItemFromOrderLine({
          item: it,
          productId: pid,
          productDoc,
          resolveTiming,
          shiprocket,
          source: "direct",
        }),
      ];
    });

    const hasPhysicalItem =
      safeBool(o?.meta?.hasPhysicalItem, false) ||
      enrichedItems.some((it: any) => Boolean(it?.isPhysical));

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