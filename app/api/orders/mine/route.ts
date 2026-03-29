import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";
import { getAuthUser } from "@/lib/auth";
import { createOnDemandTimingResolver } from "@/lib/onDemandTiming";

export const runtime = "nodejs";

function asInt(x: any, def: number) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
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

function isComboItem(item: any) {
  return safeStr(item?.itemType).toLowerCase() === "combo";
}

function isPhysicalItem(item: any) {
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

function buildShiprocketSnapshot(order: any) {
  const sr =
    order?.meta?.shiprocket && typeof order.meta.shiprocket === "object"
      ? order.meta.shiprocket
      : {};

  return {
    enabled: Boolean(sr?.enabled),
    status: safeStr(sr?.status || ""),
    message: safeStr(sr?.message || ""),
    shiprocketOrderId: safeStr(sr?.shiprocketOrderId || sr?.orderId || ""),
    shipmentId: safeStr(sr?.shipmentId || ""),
    awbCode: safeStr(sr?.awbCode || ""),
    courierName: safeStr(sr?.courierName || ""),
    syncedAt: safeStr(sr?.syncedAt || ""),
  };
}

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(50, Math.max(1, asInt(url.searchParams.get("limit"), 10)));
  const page = Math.max(1, asInt(url.searchParams.get("page"), 1));
  const q = safeStr(url.searchParams.get("q")).toLowerCase();

  await dbConnect();

  const now = new Date();

  const orders: any[] = await Order.find({
    userId: user.id,
    status: "paid",
    expiresAt: { $gt: now },
  })
    .sort({ paidAt: -1, createdAt: -1 })
    .select("status items totalAmount currency paidAt expiresAt createdAt orderRef shipping meta")
    .lean();

  const productIds = Array.from(
    new Set(
      orders.flatMap((o) =>
        Array.isArray(o?.items)
          ? o.items
              .filter((it: any) => !isComboItem(it))
              .map((it: any) => safeStr(it?.productId))
              .filter(Boolean)
          : []
      )
    )
  );

  const products: any[] = productIds.length
    ? await Product.find({ _id: { $in: productIds } })
        .select("category courseCodes availability deliverWithinMinutes onDemandNote title")
        .lean()
    : [];

  const productMap = new Map<string, any>();
  for (const p of products) {
    productMap.set(String(p?._id || ""), p);
  }

  const resolveTiming = await createOnDemandTimingResolver(products);

  let items: any[] = [];

  for (const o of orders) {
    const orderId = safeStr(o?.orderRef || o?._id || "");
    const status = safeStr(o?.status || "pending");
    const currency = safeStr(o?.currency || "INR");
    const paidAt = o?.paidAt ? new Date(o.paidAt).toISOString() : null;
    const expiresAt = o?.expiresAt ? new Date(o.expiresAt).toISOString() : null;
    const createdAt = o?.createdAt ? new Date(o.createdAt).toISOString() : null;
    const shiprocket = buildShiprocketSnapshot(o);

    const its = Array.isArray(o?.items) ? o.items : [];
    for (const it of its) {
      const combo = isComboItem(it);
      const physical = isPhysicalItem(it);
      const pid = safeStr(it?.productId);
      const productDoc = combo ? null : productMap.get(pid);

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

      items.push({
        orderId,
        status,
        currency,
        paidAt,
        expiresAt,
        createdAt,

        productId: pid,
        itemType: combo ? "combo" : "product",
        isBuilderCombo: Boolean(it?.isBuilderCombo),

        title: safeStr(it?.title),
        category: safeStr(it?.category),
        price: safeNum(it?.payableUnitPrice ?? it?.price, 0),
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

        isPhysical: physical,
        currentAvailability: combo
          ? "available"
          : normalizeAvailability(productDoc?.availability),

        deliverWithinMinutes: combo
          ? 0
          : Math.max(1, safeNum(resolvedTiming?.deliverWithinMinutes, productDoc?.deliverWithinMinutes || 20)),
        onDemandNote: combo ? "" : safeStr(resolvedTiming?.onDemandNote || productDoc?.onDemandNote),

        rawDeliverWithinMinutes: combo ? 0 : safeNum(productDoc?.deliverWithinMinutes, 20),
        rawOnDemandNote: combo ? "" : safeStr(productDoc?.onDemandNote),

        onDemandTimingSource: combo ? "" : safeStr(resolvedTiming?.source),
        onDemandMatchedCourseCode: combo ? "" : safeStr(resolvedTiming?.matchedCourseCode),
        onDemandMatchedRuleId: combo ? "" : safeStr(resolvedTiming?.matchedRuleId),
        onDemandMatchedRuleType: combo ? "" : safeStr(resolvedTiming?.matchedRuleType),

        shipping:
          o?.shipping && typeof o.shipping === "object"
            ? {
                address: safeStr(o.shipping?.address),
                pincode: safeStr(o.shipping?.pincode),
                city: safeStr(o.shipping?.city),
                state: safeStr(o.shipping?.state),
              }
            : null,

        shiprocketStatus: physical ? safeStr(shiprocket.status) : "",
        shiprocketMessage: physical ? safeStr(shiprocket.message) : "",
        shiprocketOrderId: physical ? safeStr(shiprocket.shiprocketOrderId) : "",
        shiprocketShipmentId: physical ? safeStr(shiprocket.shipmentId) : "",
        shiprocketAwbCode: physical ? safeStr(shiprocket.awbCode) : "",
        shiprocketCourierName: physical ? safeStr(shiprocket.courierName) : "",
        shiprocketSyncedAt: physical ? safeStr(shiprocket.syncedAt) : "",
      });
    }
  }

  if (q) {
    items = items.filter((item) => {
      const hay = [
        safeStr(item?.title),
        safeStr(item?.category),
        safeStr(item?.orderId),
        safeStr(item?.productId),
        safeStr(item?.shiprocketAwbCode),
        safeStr(item?.shiprocketCourierName),
        safeStr(item?.onDemandTimingSource),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;
  const pagedItems = items.slice(start, start + limit);

  return NextResponse.json(
    {
      ok: true,
      items: pagedItems,
      total,
      page: safePage,
      pageSize: limit,
      totalPages,
      q,
    },
    { status: 200 }
  );
}