import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import Order from "@/models/Order";
import Product from "@/models/Product";
import Course from "@/models/Course";

export const runtime = "nodejs";

const IST_OFFSET_MINUTES = 330;
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;
const MAX_SECTION_ROWS = 100;

type BucketGroupBy = "day" | "week" | "month" | "year";
type DateFieldMode = "createdAt" | "paidAt";

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

function safeArr(x: any) {
  return Array.isArray(x) ? x : [];
}

function normalizeStatus(input: any) {
  const v = safeStr(input).toLowerCase();
  if (["paid", "pending", "failed", "refunded", "cancelled", "all"].includes(v)) {
    return v;
  }
  return "paid";
}

function normalizeGroupBy(input: any): BucketGroupBy {
  const v = safeStr(input).toLowerCase();
  if (v === "week") return "week";
  if (v === "month") return "month";
  if (v === "year") return "year";
  return "day";
}

function normalizeDateField(input: any, status: string): DateFieldMode {
  const v = safeStr(input);
  if (v === "createdAt" || v === "paidAt") {
    if (status === "paid") return v;
    if (status !== "paid" && v === "paidAt") return "createdAt";
    return v;
  }
  return status === "paid" ? "paidAt" : "createdAt";
}

function isObjectIdLike(value: string) {
  return /^[a-f\d]{24}$/i.test(safeStr(value));
}

function categoryLabelFromComboSlug(slug: string) {
  const s = safeStr(slug).toLowerCase();
  if (s === "solved-assignments") return "Solved Assignments Combo";
  if (s === "question-papers") return "Question Papers (PYQ) Combo";
  if (s === "guess-papers") return "Guess Papers Combo";
  if (s === "ebooks-notes") return "eBooks/Notes Combo";
  if (s === "handwritten-pdfs") return "Handwritten PDFs Combo";
  if (s === "handwritten-hardcopy") return "Handwritten Hardcopy (Delivery) Combo";
  if (s === "projects-synopsis") return "Projects & Synopsis Combo";
  return "Combo";
}

function getTodayIstDateString() {
  const shifted = new Date(Date.now() + IST_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDefaultStartDateString() {
  const shifted = new Date(Date.now() + IST_OFFSET_MS);
  shifted.setUTCDate(shifted.getUTCDate() - 29);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

function istDateStartToUtc(dateStr: string) {
  const p = parseDateInput(dateStr);
  if (!p) return null;
  return new Date(Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0, 0) - IST_OFFSET_MS);
}

function istDateEndExclusiveToUtc(dateStr: string) {
  const p = parseDateInput(dateStr);
  if (!p) return null;
  return new Date(Date.UTC(p.year, p.month - 1, p.day + 1, 0, 0, 0, 0) - IST_OFFSET_MS);
}

function toIstShiftedDate(date: Date) {
  return new Date(date.getTime() + IST_OFFSET_MS);
}

function formatIstDay(date: Date) {
  const shifted = toIstShiftedDate(date);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatIstMonth(date: Date) {
  const shifted = toIstShiftedDate(date);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatIstYear(date: Date) {
  const shifted = toIstShiftedDate(date);
  return String(shifted.getUTCFullYear());
}

function addDaysToYmd(ymd: string, days: number) {
  const p = parseDateInput(ymd);
  if (!p) return ymd;
  const dt = new Date(Date.UTC(p.year, p.month - 1, p.day));
  dt.setUTCDate(dt.getUTCDate() + days);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getWeekBucket(date: Date) {
  const shifted = toIstShiftedDate(date);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  const pseudoUtcMidnight = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  const dow = pseudoUtcMidnight.getUTCDay();
  const diffToMonday = (dow + 6) % 7;

  const weekStart = new Date(pseudoUtcMidnight);
  weekStart.setUTCDate(weekStart.getUTCDate() - diffToMonday);

  const startY = weekStart.getUTCFullYear();
  const startM = String(weekStart.getUTCMonth() + 1).padStart(2, "0");
  const startD = String(weekStart.getUTCDate()).padStart(2, "0");
  const startLabel = `${startY}-${startM}-${startD}`;
  const endLabel = addDaysToYmd(startLabel, 6);

  return {
    key: startLabel,
    label: `${startLabel} to ${endLabel}`,
    sortKey: startLabel,
  };
}

function getTrendBucket(date: Date, groupBy: BucketGroupBy) {
  if (groupBy === "year") {
    const label = formatIstYear(date);
    return { key: label, label, sortKey: label };
  }

  if (groupBy === "month") {
    const label = formatIstMonth(date);
    return { key: label, label, sortKey: label };
  }

  if (groupBy === "week") {
    return getWeekBucket(date);
  }

  const label = formatIstDay(date);
  return { key: label, label, sortKey: label };
}

function getActualWalletUsed(order: any) {
  const actual = roundMoney(order?.meta?.pricing?.actualWalletDebit);
  if (actual > 0) return actual;
  return roundMoney(order?.walletDebitAmount || 0);
}

function getRealizedOrderRevenue(order: any) {
  const gatewayAmount = roundMoney(order?.payableAmount ?? order?.totalAmount ?? 0);
  const walletUsed = getActualWalletUsed(order);
  return roundMoney(gatewayAmount + walletUsed);
}

function getRealizedItemRevenue(item: any) {
  const payable = roundMoney(item?.payableAmount || 0);
  const wallet = roundMoney(item?.walletDebitAmount || 0);
  return roundMoney(payable + wallet);
}

function getPromoDiscount(order: any) {
  return roundMoney(order?.meta?.pricing?.promoDiscountAmount || 0);
}

function getHardcopyRevenue(order: any) {
  const hardcopySubtotal = roundMoney(order?.hardcopySubtotalAmount || 0);
  const deliveryApplied =
    roundMoney(order?.meta?.pricing?.deliveryChargeAppliedAmount || 0) > 0
      ? roundMoney(order?.meta?.pricing?.deliveryChargeAppliedAmount || 0)
      : roundMoney(order?.deliveryChargeAmount || 0);

  return roundMoney(hardcopySubtotal + deliveryApplied);
}

function isComboItem(item: any) {
  return safeStr(item?.itemType).toLowerCase() === "combo";
}

function getCategoryLabelForItem(item: any) {
  if (isComboItem(item)) {
    return categoryLabelFromComboSlug(safeStr(item?.comboCategorySlug));
  }
  return safeStr(item?.category) || "Uncategorized";
}

function getStateFromOrder(order: any) {
  const shipping = order?.shipping && typeof order.shipping === "object" ? order.shipping : {};
  const customer = order?.customer && typeof order.customer === "object" ? order.customer : {};

  return (
    safeStr(shipping?.state) ||
    safeStr(shipping?.State) ||
    safeStr(customer?.state) ||
    safeStr(customer?.State) ||
    ""
  );
}

function getCityFromOrder(order: any) {
  const shipping = order?.shipping && typeof order.shipping === "object" ? order.shipping : {};
  const customer = order?.customer && typeof order.customer === "object" ? order.customer : {};

  return (
    safeStr(shipping?.city) ||
    safeStr(shipping?.City) ||
    safeStr(customer?.city) ||
    safeStr(customer?.City) ||
    ""
  );
}

function pushMapStat(
  store: Map<string, any>,
  key: string,
  patch: {
    label?: string;
    revenue?: number;
    quantity?: number;
    orderId?: string;
    extra?: string;
  }
) {
  const id = safeStr(key);
  if (!id) return;

  const prev = store.get(id) || {
    key: id,
    label: patch.label || id,
    revenue: 0,
    quantity: 0,
    ordersSet: new Set<string>(),
    extra: patch.extra || "",
  };

  prev.label = patch.label || prev.label || id;
  prev.revenue = roundMoney(prev.revenue + roundMoney(patch.revenue || 0));
  prev.quantity = safeNum(prev.quantity, 0) + safeNum(patch.quantity, 0);
  prev.extra = patch.extra || prev.extra || "";

  if (patch.orderId) {
    prev.ordersSet.add(String(patch.orderId));
  }

  store.set(id, prev);
}

function finalizeStatsArray(store: Map<string, any>, limit = MAX_SECTION_ROWS) {
  return Array.from(store.values())
    .map((x) => ({
      key: String(x.key || ""),
      label: String(x.label || ""),
      revenue: roundMoney(x.revenue || 0),
      quantity: safeNum(x.quantity, 0),
      orders: x.ordersSet instanceof Set ? x.ordersSet.size : 0,
      extra: String(x.extra || ""),
    }))
    .sort((a, b) => {
      if (b.revenue !== a.revenue) return b.revenue - a.revenue;
      if (b.quantity !== a.quantity) return b.quantity - a.quantity;
      return a.label.localeCompare(b.label);
    })
    .slice(0, limit);
}

function createInsight(title: string, value: string, description: string, tone: "slate" | "emerald" | "blue" | "violet" | "amber" = "slate") {
  return { title, value, description, tone };
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  await dbConnect();

  const url = new URL(req.url);
  const status = normalizeStatus(url.searchParams.get("status"));
  const groupBy = normalizeGroupBy(url.searchParams.get("groupBy"));
  const dateField = normalizeDateField(url.searchParams.get("dateField"), status);

  const startDate = safeStr(url.searchParams.get("startDate")) || getDefaultStartDateString();
  const endDate = safeStr(url.searchParams.get("endDate")) || getTodayIstDateString();

  const startUtc = istDateStartToUtc(startDate);
  const endUtcExclusive = istDateEndExclusiveToUtc(endDate);

  if (!startUtc || !endUtcExclusive) {
    return NextResponse.json({ error: "Invalid startDate or endDate" }, { status: 400 });
  }

  if (startUtc.getTime() >= endUtcExclusive.getTime()) {
    return NextResponse.json(
      { error: "startDate must be before or equal to endDate" },
      { status: 400 }
    );
  }

  const createdRangeQuery = {
    createdAt: {
      $gte: startUtc,
      $lt: endUtcExclusive,
    },
  };

  const filteredQuery: Record<string, any> = {
    [dateField]: {
      $gte: startUtc,
      $lt: endUtcExclusive,
    },
  };

  if (status !== "all") {
    filteredQuery.status = status;
  }

  const selectFields =
    "_id userId userEmail status totalAmount payableAmount walletDebitAmount hardcopySubtotalAmount deliveryChargeAmount paymentGateway paymentId createdAt paidAt coupon shipping customer meta items";

  const [allOrdersInCreatedRange, filteredOrders] = await Promise.all([
    Order.find(createdRangeQuery).select(selectFields).lean(),
    Order.find(filteredQuery).select(selectFields).lean(),
  ]);

  const directProductIds = Array.from(
    new Set(
      filteredOrders
        .flatMap((order: any) => safeArr(order?.items))
        .filter((item: any) => !isComboItem(item))
        .map((item: any) => safeStr(item?.productId))
        .filter((id: string) => isObjectIdLike(id))
    )
  );

  const productDocs: any[] = directProductIds.length
    ? await Product.find({ _id: { $in: directProductIds } })
        .select("_id title subjectCode category courseCodes courseTitles")
        .lean()
    : [];

  const productMap = new Map<string, any>();
  for (const p of productDocs) {
    productMap.set(String(p._id), p);
  }

  const allCourseCodes = Array.from(
    new Set(
      productDocs.flatMap((p: any) =>
        safeArr(p?.courseCodes).map((x: any) => safeStr(x).toUpperCase())
      )
    )
  );

  const courseDocs: any[] = allCourseCodes.length
    ? await Course.find({ code: { $in: allCourseCodes } })
        .select("code title")
        .lean()
    : [];

  const courseTitleMap = new Map<string, string>();
  for (const c of courseDocs) {
    courseTitleMap.set(safeStr(c?.code).toUpperCase(), safeStr(c?.title));
  }

  let realizedRevenue = 0;
  let totalOrders = 0;
  let totalItemsSold = 0;
  let promoDiscountTotal = 0;
  let walletUsedTotal = 0;
  let hardcopyRevenue = 0;
  let comboRevenue = 0;

  const uniqueCustomers = new Set<string>();

  const trendMap = new Map<
    string,
    { key: string; label: string; sortKey: string; revenue: number; orders: number; itemsSold: number }
  >();

  const categoryMap = new Map<string, any>();
  const courseMap = new Map<string, any>();
  const productMapStats = new Map<string, any>();
  const comboMap = new Map<string, any>();
  const customerMap = new Map<string, any>();
  const stateMap = new Map<string, any>();
  const cityMap = new Map<string, any>();
  const paymentMap = new Map<string, any>();
  const ordersPerCustomerMap = new Map<string, number>();

  for (const order of filteredOrders) {
    const orderId = safeStr(order?._id);
    const orderRevenue = getRealizedOrderRevenue(order);
    const walletUsed = getActualWalletUsed(order);
    const orderPromoDiscount = getPromoDiscount(order);
    const orderHardcopyRevenue = getHardcopyRevenue(order);

    realizedRevenue = roundMoney(realizedRevenue + orderRevenue);
    totalOrders += 1;
    promoDiscountTotal = roundMoney(promoDiscountTotal + orderPromoDiscount);
    walletUsedTotal = roundMoney(walletUsedTotal + walletUsed);
    hardcopyRevenue = roundMoney(hardcopyRevenue + orderHardcopyRevenue);

    const customerKey =
      safeStr(order?.userId) || safeStr(order?.userEmail) || safeStr(order?._id);

    if (customerKey) {
      uniqueCustomers.add(customerKey);
      ordersPerCustomerMap.set(customerKey, safeNum(ordersPerCustomerMap.get(customerKey), 0) + 1);
    }

    const items = safeArr(order?.items);
    const itemsSoldForOrder = items.reduce((acc: number, item: any) => {
      return acc + Math.max(1, Math.trunc(safeNum(item?.quantity, 1)));
    }, 0);

    totalItemsSold += itemsSoldForOrder;

    const orderDateRaw = order?.[dateField] || order?.createdAt || order?.paidAt;

    if (orderDateRaw) {
      const orderDate = new Date(orderDateRaw);
      const bucket = getTrendBucket(orderDate, groupBy);
      const prev = trendMap.get(bucket.key) || {
        key: bucket.key,
        label: bucket.label,
        sortKey: bucket.sortKey,
        revenue: 0,
        orders: 0,
        itemsSold: 0,
      };

      prev.revenue = roundMoney(prev.revenue + orderRevenue);
      prev.orders += 1;
      prev.itemsSold += itemsSoldForOrder;
      trendMap.set(bucket.key, prev);
    }

    const gatewayLabel = safeStr(order?.paymentGateway) || "unknown";
    const pgPrev = paymentMap.get(gatewayLabel) || {
      gateway: gatewayLabel,
      orders: 0,
      revenue: 0,
    };
    pgPrev.orders += 1;
    pgPrev.revenue = roundMoney(pgPrev.revenue + orderRevenue);
    paymentMap.set(gatewayLabel, pgPrev);

    const customerLabel = safeStr(order?.userEmail) || safeStr(order?.userId) || "Unknown User";
    const customerPrev = customerMap.get(customerKey) || {
      key: customerKey,
      label: customerLabel,
      revenue: 0,
      orders: 0,
      itemsSold: 0,
    };
    customerPrev.revenue = roundMoney(customerPrev.revenue + orderRevenue);
    customerPrev.orders += 1;
    customerPrev.itemsSold += itemsSoldForOrder;
    customerMap.set(customerKey, customerPrev);

    const state = getStateFromOrder(order);
    if (state) {
      const prev = stateMap.get(state.toLowerCase()) || {
        key: state.toLowerCase(),
        label: state,
        revenue: 0,
        orders: 0,
      };
      prev.revenue = roundMoney(prev.revenue + orderRevenue);
      prev.orders += 1;
      stateMap.set(state.toLowerCase(), prev);
    }

    const city = getCityFromOrder(order);
    if (city) {
      const prev = cityMap.get(city.toLowerCase()) || {
        key: city.toLowerCase(),
        label: city,
        revenue: 0,
        orders: 0,
      };
      prev.revenue = roundMoney(prev.revenue + orderRevenue);
      prev.orders += 1;
      cityMap.set(city.toLowerCase(), prev);
    }

    for (const item of items) {
      const qty = Math.max(1, Math.trunc(safeNum(item?.quantity, 1)));
      const lineRevenue = getRealizedItemRevenue(item);

      pushMapStat(categoryMap, getCategoryLabelForItem(item), {
        label: getCategoryLabelForItem(item),
        revenue: lineRevenue,
        quantity: qty,
        orderId,
      });

      if (isComboItem(item)) {
        comboRevenue = roundMoney(comboRevenue + lineRevenue);

        const comboSlug = safeStr(item?.comboSlug);
        const comboCategorySlug = safeStr(item?.comboCategorySlug);
        const comboType = item?.isBuilderCombo ? "Builder Combo" : "Saved Combo";

        const comboKey =
          comboSlug
            ? `saved:${comboSlug}`
            : `builder:${comboCategorySlug}:${safeStr(item?.title)}`;

        const comboLabel = safeStr(item?.title) || comboType;
        const comboExtra = comboCategorySlug
          ? `${comboType} • ${categoryLabelFromComboSlug(comboCategorySlug)}`
          : comboType;

        pushMapStat(comboMap, comboKey, {
          label: comboLabel,
          revenue: lineRevenue,
          quantity: qty,
          orderId,
          extra: comboExtra,
        });

        continue;
      }

      const productId = safeStr(item?.productId);
      const linkedProduct = productMap.get(productId);

      const productLabel =
        safeStr(linkedProduct?.title) || safeStr(item?.title) || "Untitled Product";

      const productExtraParts = [
        safeStr(linkedProduct?.subjectCode),
        safeStr(linkedProduct?.category || item?.category),
      ].filter(Boolean);

      pushMapStat(productMapStats, productId || productLabel, {
        label: productLabel,
        revenue: lineRevenue,
        quantity: qty,
        orderId,
        extra: productExtraParts.join(" • "),
      });

      const courseCodes = Array.from(
        new Set(
          safeArr(linkedProduct?.courseCodes).map((x: any) => safeStr(x).toUpperCase())
        )
      );

      if (courseCodes.length === 0) {
        pushMapStat(courseMap, "UNMAPPED", {
          label: "Unmapped Course",
          revenue: lineRevenue,
          quantity: qty,
          orderId,
          extra: "Product has no linked course code",
        });
      } else {
        for (const code of courseCodes) {
          const title = safeStr(courseTitleMap.get(code));
          pushMapStat(courseMap, code, {
            label: title ? `${code} - ${title}` : code,
            revenue: lineRevenue,
            quantity: qty,
            orderId,
            extra: title || "",
          });
        }
      }
    }
  }

  const statusMap = new Map<string, { status: string; orders: number; revenue: number }>();
  for (const order of allOrdersInCreatedRange) {
    const key = safeStr(order?.status).toLowerCase() || "unknown";
    const prev = statusMap.get(key) || {
      status: key,
      orders: 0,
      revenue: 0,
    };
    prev.orders += 1;
    prev.revenue = roundMoney(prev.revenue + getRealizedOrderRevenue(order));
    statusMap.set(key, prev);
  }

  const trend = Array.from(trendMap.values())
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map((x) => ({
      label: x.label,
      revenue: roundMoney(x.revenue),
      orders: x.orders,
      itemsSold: x.itemsSold,
    }));

  const categoryStats = finalizeStatsArray(categoryMap, MAX_SECTION_ROWS);
  const courseStats = finalizeStatsArray(courseMap, MAX_SECTION_ROWS);
  const productStats = finalizeStatsArray(productMapStats, MAX_SECTION_ROWS);
  const comboStats = finalizeStatsArray(comboMap, MAX_SECTION_ROWS);

  const customerStats = Array.from(customerMap.values())
    .map((x) => ({
      key: String(x.key || ""),
      label: String(x.label || ""),
      revenue: roundMoney(x.revenue || 0),
      orders: safeNum(x.orders, 0),
      itemsSold: safeNum(x.itemsSold, 0),
    }))
    .sort((a, b) => {
      if (b.revenue !== a.revenue) return b.revenue - a.revenue;
      if (b.orders !== a.orders) return b.orders - a.orders;
      return a.label.localeCompare(b.label);
    })
    .slice(0, MAX_SECTION_ROWS);

  const geoStateStats = Array.from(stateMap.values())
    .map((x) => ({
      key: String(x.key || ""),
      label: String(x.label || ""),
      revenue: roundMoney(x.revenue || 0),
      orders: safeNum(x.orders, 0),
    }))
    .sort((a, b) => {
      if (b.revenue !== a.revenue) return b.revenue - a.revenue;
      return b.orders - a.orders;
    })
    .slice(0, MAX_SECTION_ROWS);

  const geoCityStats = Array.from(cityMap.values())
    .map((x) => ({
      key: String(x.key || ""),
      label: String(x.label || ""),
      revenue: roundMoney(x.revenue || 0),
      orders: safeNum(x.orders, 0),
    }))
    .sort((a, b) => {
      if (b.revenue !== a.revenue) return b.revenue - a.revenue;
      return b.orders - a.orders;
    })
    .slice(0, MAX_SECTION_ROWS);

  const paymentGatewaySummary = Array.from(paymentMap.values())
    .map((x) => ({
      gateway: String(x.gateway || "unknown"),
      orders: safeNum(x.orders, 0),
      revenue: roundMoney(x.revenue || 0),
    }))
    .sort((a, b) => {
      if (b.revenue !== a.revenue) return b.revenue - a.revenue;
      return b.orders - a.orders;
    });

  const statusSummary = Array.from(statusMap.values())
    .map((x) => ({
      status: String(x.status || "unknown"),
      orders: safeNum(x.orders, 0),
      revenue: roundMoney(x.revenue || 0),
    }))
    .sort((a, b) => b.orders - a.orders);

  const averageOrderValue = totalOrders > 0 ? roundMoney(realizedRevenue / totalOrders) : 0;
  const averageItemsPerOrder = totalOrders > 0 ? roundMoney(totalItemsSold / totalOrders) : 0;
  const digitalRevenue = roundMoney(Math.max(0, realizedRevenue - hardcopyRevenue));

  const repeatCustomers = Array.from(ordersPerCustomerMap.values()).filter((count) => count > 1).length;
  const repeatCustomerRate =
    uniqueCustomers.size > 0 ? roundMoney((repeatCustomers / uniqueCustomers.size) * 100) : 0;
  const walletSharePct =
    realizedRevenue > 0 ? roundMoney((walletUsedTotal / realizedRevenue) * 100) : 0;
  const promoSharePct =
    realizedRevenue > 0 ? roundMoney((promoDiscountTotal / realizedRevenue) * 100) : 0;
  const hardcopySharePct =
    realizedRevenue > 0 ? roundMoney((hardcopyRevenue / realizedRevenue) * 100) : 0;
  const comboSharePct =
    realizedRevenue > 0 ? roundMoney((comboRevenue / realizedRevenue) * 100) : 0;

  const insights = [
    createInsight(
      "Top Revenue Category",
      categoryStats[0]?.label || "—",
      categoryStats[0]
        ? `${roundMoney(categoryStats[0].revenue)} INR revenue`
        : "No category data for selected filters",
      "emerald"
    ),
    createInsight(
      "Top Direct Product",
      productStats[0]?.label || "—",
      productStats[0]
        ? `${roundMoney(productStats[0].revenue)} INR from direct product sales`
        : "No direct product sales in selected filters",
      "blue"
    ),
    createInsight(
      "Top Direct Course",
      courseStats[0]?.label || "—",
      courseStats[0]
        ? `${roundMoney(courseStats[0].revenue)} INR from course-linked product sales`
        : "No course-linked direct product sales in selected filters",
      "violet"
    ),
    createInsight(
      "Repeat Customers",
      `${repeatCustomers}`,
      `${repeatCustomerRate}% of unique customers placed more than one order in this filtered range`,
      "amber"
    ),
    createInsight(
      "Revenue Mix",
      `Hardcopy ${hardcopySharePct}%`,
      `Combo ${comboSharePct}% • Wallet ${walletSharePct}% • Promo discount ${promoSharePct}%`,
      "slate"
    ),
    createInsight(
      "Buying Density",
      `${averageItemsPerOrder}`,
      `Average items per order. Average order value is ${averageOrderValue} INR`,
      "slate"
    ),
  ];

  const notes = [
    "Realized Revenue me gateway amount ke saath wallet-used amount bhi include hai, taaki sales value under-report na ho.",
    "Course Wise aur Product Wise sections direct product orders par based hain.",
    "Saved Combo aur Builder Combo ko separate combo analytics bucket me dikhaya gaya hai.",
    "Multi-course mapped products ek se zyada course buckets me visible ho sakte hain.",
    `Heavy tables ko page side par See More / Show Less se manageable rakha gaya hai. API abhi har section ka top ${MAX_SECTION_ROWS} rows return karta hai.`,
  ];

  return NextResponse.json(
    {
      ok: true,
      generatedAt: new Date().toISOString(),
      filters: {
        startDate,
        endDate,
        status,
        groupBy,
        dateField,
      },
      summary: {
        realizedRevenue: roundMoney(realizedRevenue),
        totalOrders,
        totalItemsSold,
        averageOrderValue,
        averageItemsPerOrder,
        uniqueCustomers: uniqueCustomers.size,
        repeatCustomers,
        repeatCustomerRate,
        promoDiscountTotal: roundMoney(promoDiscountTotal),
        walletUsedTotal: roundMoney(walletUsedTotal),
        hardcopyRevenue: roundMoney(hardcopyRevenue),
        comboRevenue: roundMoney(comboRevenue),
        digitalRevenue: roundMoney(digitalRevenue),
      },
      sectionMeta: {
        category: { totalRows: categoryMap.size, returnedRows: categoryStats.length },
        course: { totalRows: courseMap.size, returnedRows: courseStats.length },
        product: { totalRows: productMapStats.size, returnedRows: productStats.length },
        combo: { totalRows: comboMap.size, returnedRows: comboStats.length },
        customer: { totalRows: customerMap.size, returnedRows: customerStats.length },
        trend: { totalRows: trendMap.size, returnedRows: trend.length },
        state: { totalRows: stateMap.size, returnedRows: geoStateStats.length },
        city: { totalRows: cityMap.size, returnedRows: geoCityStats.length },
      },
      insights,
      trend,
      categoryStats,
      courseStats,
      productStats,
      comboStats,
      customerStats,
      geoStateStats,
      geoCityStats,
      statusSummary,
      paymentGatewaySummary,
      notes,
    },
    { status: 200 }
  );
}