import { NextResponse } from "next/server";
import mongoose from "mongoose";
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

function isComboItem(item: any) {
  return safeStr(item?.itemType).toLowerCase() === "combo";
}

function isBuilderComboItem(item: any) {
  const productId = safeStr(item?.productId);
  return Boolean(item?.isBuilderCombo) || productId.toLowerCase().startsWith("builder-combo:");
}

function extractBuilderComboProductIds(item: any) {
  const explicitIds = Array.isArray(item?.comboBuilderProductIds)
    ? item.comboBuilderProductIds.map((x: any) => safeStr(x)).filter(Boolean)
    : [];

  if (explicitIds.length > 0) {
    return uniqueStrings(explicitIds).filter(isObjectIdLike);
  }

  const productId = safeStr(item?.productId);

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

function buildDownloadUrl(productId: string, download = false) {
  const id = safeStr(productId);
  if (!id) return "";

  const qs = new URLSearchParams({
    productId: id,
  });

  if (download) {
    qs.set("download", "1");
  }

  return `/api/products/download?${qs.toString()}`;
}

function buildProductRow(params: {
  order: any;
  item: any;
  productDoc: any;
  productId: string;
  orderId: string;
  status: string;
  currency: string;
  paidAt: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  shiprocket: any;
  resolveTiming: any;
  source?: "direct" | "builder_combo_child";
  parentCombo?: any;
}) {
  const {
    item,
    productDoc,
    productId,
    orderId,
    status,
    currency,
    paidAt,
    expiresAt,
    createdAt,
    shiprocket,
    resolveTiming,
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

  const physical =
    source === "builder_combo_child"
      ? isPhysicalItem({
          ...item,
          category: productDoc?.category || item?.category,
          title: productDoc?.title || item?.title,
        }) || productDoc?.isDigital === false
      : isPhysicalItem(item) || productDoc?.isDigital === false;

  const currentAvailability = normalizeAvailability(
    productDoc?.availability || item?.currentAvailability || "available"
  );

  return {
    orderId,
    status,
    currency,
    paidAt,
    expiresAt,
    createdAt,

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
        : safeNum(item?.payableUnitPrice ?? item?.price, 0),
    originalProductPrice: safeNum(productDoc?.price, 0),
    quantity: source === "builder_combo_child" ? 1 : Math.max(1, safeNum(item?.quantity, 1)),

    comboSlug: "",
    comboCategorySlug: parentCombo ? safeStr(parentCombo?.comboCategorySlug) : "",
    comboBadge: parentCombo ? safeStr(parentCombo?.comboBadge) : "",
    comboSaveLabel: parentCombo ? safeStr(parentCombo?.comboSaveLabel) : "",
    comboMediumLabel: parentCombo ? safeStr(parentCombo?.comboMediumLabel) : "",
    comboSessionLabel: parentCombo ? safeStr(parentCombo?.comboSessionLabel) : "",
    comboItems: [],

    isPhysical: physical,
    currentAvailability,

    deliverWithinMinutes: safeNum(resolvedTiming?.deliverWithinMinutes, 0),
    onDemandNote: safeStr(resolvedTiming?.onDemandNote || productDoc?.onDemandNote),
    onDemandTimingSource: safeStr(resolvedTiming?.source),

    canDownload: !physical,
    previewUrl: !physical ? buildDownloadUrl(productId, false) : "",
    downloadUrl: !physical ? buildDownloadUrl(productId, true) : "",

    shiprocket,
  };
}

function buildComboParentRow(params: {
  orderId: string;
  status: string;
  currency: string;
  paidAt: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  item: any;
  shiprocket: any;
}) {
  const { orderId, status, currency, paidAt, expiresAt, createdAt, item, shiprocket } = params;

  return {
    orderId,
    status,
    currency,
    paidAt,
    expiresAt,
    createdAt,

    productId: safeStr(item?.productId),
    itemType: "combo",
    isBuilderCombo: isBuilderComboItem(item),

    title: safeStr(item?.title),
    category: safeStr(item?.category || "Combo"),
    price: safeNum(item?.payableUnitPrice ?? item?.price, 0),
    quantity: Math.max(1, safeNum(item?.quantity, 1)),

    comboSlug: safeStr(item?.comboSlug),
    comboCategorySlug: safeStr(item?.comboCategorySlug),
    comboBadge: safeStr(item?.comboBadge),
    comboSaveLabel: safeStr(item?.comboSaveLabel),
    comboMediumLabel: safeStr(item?.comboMediumLabel),
    comboSessionLabel: safeStr(item?.comboSessionLabel),
    comboItems: Array.isArray(item?.comboItems)
      ? item.comboItems.map((x: any) => ({
          title: safeStr(x?.title),
          subtitle: safeStr(x?.subtitle),
        }))
      : [],

    isPhysical: isPhysicalItem(item),
    currentAvailability: "available",

    deliverWithinMinutes: 0,
    onDemandNote: "",
    onDemandTimingSource: "",

    canDownload: false,
    previewUrl: "",
    downloadUrl: "",

    shiprocket,
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

  const productIds = uniqueStrings(
    orders.flatMap((o) =>
      Array.isArray(o?.items)
        ? o.items.flatMap((it: any) => {
            if (isComboItem(it)) {
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
      const pid = safeStr(it?.productId);

      if (combo) {
        const parentRow = buildComboParentRow({
          orderId,
          status,
          currency,
          paidAt,
          expiresAt,
          createdAt,
          item: it,
          shiprocket,
        });

        items.push(parentRow);

        if (isBuilderComboItem(it)) {
          const childProductIds = extractBuilderComboProductIds(it);

          for (const childProductId of childProductIds) {
            const productDoc = productMap.get(childProductId);

            if (!productDoc) {
              continue;
            }

            items.push(
              buildProductRow({
                order: o,
                item: it,
                productDoc,
                productId: childProductId,
                orderId,
                status,
                currency,
                paidAt,
                expiresAt,
                createdAt,
                shiprocket,
                resolveTiming,
                source: "builder_combo_child",
                parentCombo: it,
              })
            );
          }
        }

        continue;
      }

      if (!isObjectIdLike(pid)) {
        continue;
      }

      const productDoc = productMap.get(pid);

      items.push(
        buildProductRow({
          order: o,
          item: it,
          productDoc,
          productId: pid,
          orderId,
          status,
          currency,
          paidAt,
          expiresAt,
          createdAt,
          shiprocket,
          resolveTiming,
          source: "direct",
        })
      );
    }
  }

  if (q) {
    items = items.filter((item) => {
      const hay = [
        item.orderId,
        item.title,
        item.category,
        item.productId,
        item.comboSlug,
        item.comboCategorySlug,
        item.comboBadge,
        item.comboSaveLabel,
        item.comboMediumLabel,
        item.comboSessionLabel,
        item.parentComboTitle,
        item.currentAvailability,
        ...(Array.isArray(item.comboItems)
          ? item.comboItems.flatMap((x: any) => [safeStr(x?.title), safeStr(x?.subtitle)])
          : []),
      ]
        .map((x) => safeStr(x).toLowerCase())
        .join(" ");

      return hay.includes(q);
    });
  }

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;
  const paginated = items.slice(start, start + limit);

  return NextResponse.json(
    {
      ok: true,
      page: safePage,
      limit,
      total,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPrevPage: safePage > 1,
      items: paginated,
    },
    { status: 200 }
  );
}