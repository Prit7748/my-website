import Order from "@/models/Order";

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

function normalizePhone(input: any) {
  const digits = safeStr(input).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return digits;
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

function splitName(fullName: any) {
  const text = safeStr(fullName);
  if (!text) return { firstName: "", lastName: "" };

  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: text, lastName: "" };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function slugish(input: any) {
  return safeStr(input)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function formatOrderDate(input: any) {
  const dt = input ? new Date(input) : new Date();
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  const hh = String(dt.getHours()).padStart(2, "0");
  const mi = String(dt.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function getBaseUrl() {
  return safeStr(process.env.SHIPROCKET_BASE_URL || "https://apiv2.shiprocket.in/v1/external").replace(/\/+$/, "");
}

function getPickupLocation() {
  return safeStr(process.env.SHIPROCKET_PICKUP_LOCATION || "Primary");
}

function getDefaultLength() {
  return Math.max(1, safeNum(process.env.SHIPROCKET_DEFAULT_LENGTH_CM, 25));
}

function getDefaultBreadth() {
  return Math.max(1, safeNum(process.env.SHIPROCKET_DEFAULT_BREADTH_CM, 20));
}

function getDefaultHeight() {
  return Math.max(1, safeNum(process.env.SHIPROCKET_DEFAULT_HEIGHT_CM, 4));
}

function getDefaultItemWeight() {
  return Math.max(0.05, safeNum(process.env.SHIPROCKET_DEFAULT_ITEM_WEIGHT_KG, 0.35));
}

function getExtraHeightPerItem() {
  return Math.max(0, safeNum(process.env.SHIPROCKET_EXTRA_HEIGHT_PER_ITEM_CM, 0.5));
}

function isPhysicalOrderItem(item: any) {
  const category = safeStr(item?.category).toLowerCase();
  const comboCategorySlug = safeStr(item?.comboCategorySlug).toLowerCase();
  const title = safeStr(item?.title).toLowerCase();

  return (
    category.includes("handwritten hardcopy") ||
    category.includes("hardcopy") ||
    comboCategorySlug.includes("handwritten-hardcopy") ||
    title.includes("hardcopy") ||
    title.includes("delivery")
  );
}

function getShiprocketConfig() {
  return {
    email: safeStr(process.env.SHIPROCKET_EMAIL),
    password: safeStr(process.env.SHIPROCKET_PASSWORD),
    baseUrl: getBaseUrl(),
    pickupLocation: getPickupLocation(),
  };
}

export function isShiprocketConfigured() {
  const cfg = getShiprocketConfig();
  return Boolean(cfg.email && cfg.password && cfg.baseUrl);
}

const globalForShiprocket = globalThis as typeof globalThis & {
  __shiprocketTokenCache?: {
    token: string;
    expiresAt: number;
  };
};

async function getShiprocketToken() {
  const cfg = getShiprocketConfig();

  if (!cfg.email || !cfg.password) {
    throw new Error("Shiprocket credentials missing.");
  }

  const cache = globalForShiprocket.__shiprocketTokenCache;
  if (cache?.token && cache.expiresAt > Date.now() + 60_000) {
    return cache.token;
  }

  const res = await fetch(`${cfg.baseUrl}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      email: cfg.email,
      password: cfg.password,
    }),
  });

  const data: any = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      safeStr(data?.message || data?.error || "Shiprocket auth failed.")
    );
  }

  const token = safeStr(data?.token);
  if (!token) {
    throw new Error("Shiprocket token missing in auth response.");
  }

  globalForShiprocket.__shiprocketTokenCache = {
    token,
    expiresAt: Date.now() + 8 * 60 * 1000,
  };

  return token;
}

function buildAddress2(shipping: any) {
  return [safeStr(shipping?.areaLocality), safeStr(shipping?.landmark), safeStr(shipping?.postOffice)]
    .filter(Boolean)
    .join(", ")
    .slice(0, 190);
}

function buildPhysicalItems(order: any) {
  return safeArr(order?.items)
    .filter((item: any) => isPhysicalOrderItem(item))
    .map((item: any, idx: number) => {
      const qty = Math.max(1, safeNum(item?.quantity, 1));
      const unitPrice =
        roundMoney(item?.payableUnitPrice || 0) > 0
          ? roundMoney(item?.payableUnitPrice || 0)
          : roundMoney((safeNum(item?.payableAmount, 0) || safeNum(item?.price, 0) * qty) / qty);

      return {
        name: safeStr(item?.title || `Item ${idx + 1}`).slice(0, 190),
        sku: slugish(item?.productId || item?.comboSlug || item?.title || `ITEM-${idx + 1}`),
        units: qty,
        selling_price: unitPrice,
        discount: "",
        tax: "",
        hsn: "",
      };
    })
    .filter((x: any) => x.name && x.units > 0 && x.selling_price >= 0);
}

function buildPackageMetrics(order: any, physicalItems: any[]) {
  const totalUnits = physicalItems.reduce((acc: number, x: any) => acc + Math.max(1, safeNum(x?.units, 1)), 0);
  const itemWeight = getDefaultItemWeight();
  const baseLength = getDefaultLength();
  const baseBreadth = getDefaultBreadth();
  const baseHeight = getDefaultHeight();
  const extraHeight = getExtraHeightPerItem();

  return {
    length: baseLength,
    breadth: baseBreadth,
    height: Math.max(1, roundMoney(baseHeight + Math.max(0, totalUnits - 1) * extraHeight)),
    weight: Math.max(0.05, roundMoney(totalUnits * itemWeight)),
  };
}

export function buildShiprocketOrderPayload(order: any) {
  const shipping = order?.shipping && typeof order.shipping === "object" ? order.shipping : {};
  const customer = order?.customer && typeof order.customer === "object" ? order.customer : {};

  const phone = normalizePhone(customer?.phone || shipping?.phone);
  const email = safeStr(customer?.email || order?.userEmail);
  const fullName = safeStr(customer?.fullName || "Customer");
  const { firstName, lastName } = splitName(fullName);

  const physicalItems = buildPhysicalItems(order);
  if (!physicalItems.length) {
    return null;
  }

  const packageMetrics = buildPackageMetrics(order, physicalItems);

  const subTotal = roundMoney(
    physicalItems.reduce((acc: number, item: any) => {
      return acc + roundMoney(item.selling_price || 0) * Math.max(1, safeNum(item.units, 1));
    }, 0)
  );

  return {
    order_id: safeStr(order?.orderRef || order?._id || ""),
    order_date: formatOrderDate(order?.paidAt || order?.createdAt || new Date()),
    pickup_location: getPickupLocation(),

    billing_customer_name: firstName || fullName,
    billing_last_name: lastName,
    billing_address: safeStr(shipping?.addressLine1 || shipping?.address).slice(0, 190),
    billing_address_2: buildAddress2(shipping),
    billing_city: safeStr(shipping?.city || shipping?.district).slice(0, 100),
    billing_pincode: safeStr(shipping?.pincode).replace(/\D/g, "").slice(0, 6),
    billing_state: safeStr(shipping?.state).slice(0, 100),
    billing_country: safeStr(shipping?.country || "India"),
    billing_email: email,
    billing_phone: phone,

    shipping_is_billing: true,

    order_items: physicalItems,
    payment_method: "Prepaid",
    shipping_charges: 0,
    giftwrap_charges: 0,
    transaction_charges: 0,
    total_discount: 0,
    sub_total: subTotal,

    length: packageMetrics.length,
    breadth: packageMetrics.breadth,
    height: packageMetrics.height,
    weight: packageMetrics.weight,
  };
}

export async function createShiprocketOrder(order: any) {
  if (!isShiprocketConfigured()) {
    return {
      ok: false,
      skipped: true,
      error: "Shiprocket credentials missing.",
      payload: null,
      response: null,
      parsed: null,
    };
  }

  const payload = buildShiprocketOrderPayload(order);
  if (!payload) {
    return {
      ok: false,
      skipped: true,
      error: "No physical items found for Shiprocket sync.",
      payload: null,
      response: null,
      parsed: null,
    };
  }

  const token = await getShiprocketToken();

  const res = await fetch(`${getBaseUrl()}/orders/create/adhoc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  const data: any = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      ok: false,
      skipped: false,
      error: safeStr(data?.message || data?.error || "Shiprocket order create failed."),
      payload,
      response: data,
      parsed: null,
    };
  }

  const node = data?.data && typeof data.data === "object" ? data.data : data;

  const parsed = {
    orderId: safeStr(node?.order_id || node?.orderId),
    shipmentId: safeStr(node?.shipment_id || node?.shipmentId),
    awbCode: safeStr(node?.awb_code || node?.awbCode),
    courierName: safeStr(node?.courier_name || node?.courierName || node?.courier_company_name),
    courierCompanyId: safeStr(node?.courier_company_id || node?.courierCompanyId),
    status: "created",
    pickupLocation: getPickupLocation(),
  };

  return {
    ok: true,
    skipped: false,
    error: "",
    payload,
    response: data,
    parsed,
  };
}

export async function syncShiprocketForOrder(orderId: string) {
  const order: any = await Order.findById(orderId);
  if (!order) {
    return {
      ok: false,
      error: "Order not found.",
    };
  }

  if (!Boolean(order?.meta?.hasPhysicalItem)) {
    order.shiprocket = {
      ...(order.shiprocket && typeof order.shiprocket === "object" ? order.shiprocket : {}),
      status: "not_required",
      error: "",
      lastAttemptAt: new Date(),
    };

    if (typeof order.markModified === "function") {
      order.markModified("shiprocket");
    }
    await order.save();

    return {
      ok: true,
      skipped: true,
      reason: "digital_only",
    };
  }

  const existingOrderId = safeStr(order?.shiprocket?.orderId);
  const existingShipmentId = safeStr(order?.shiprocket?.shipmentId);

  if (existingOrderId || existingShipmentId) {
    return {
      ok: true,
      skipped: true,
      reason: "already_synced",
      shiprocket: order.shiprocket || null,
    };
  }

  const result = await createShiprocketOrder(order);

  order.shiprocket = {
    ...(order.shiprocket && typeof order.shiprocket === "object" ? order.shiprocket : {}),
    status: result.ok ? "created" : result.skipped ? "skipped" : "failed",
    orderId: safeStr(result?.parsed?.orderId),
    shipmentId: safeStr(result?.parsed?.shipmentId),
    awbCode: safeStr(result?.parsed?.awbCode),
    courierName: safeStr(result?.parsed?.courierName),
    courierCompanyId: safeStr(result?.parsed?.courierCompanyId),
    pickupLocation: safeStr(result?.parsed?.pickupLocation || getPickupLocation()),
    requestPayload: result?.payload || null,
    responsePayload: result?.response || null,
    error: safeStr(result?.error),
    lastAttemptAt: new Date(),
    syncedAt: result.ok ? new Date() : null,
  };

  if (typeof order.markModified === "function") {
    order.markModified("shiprocket");
  }

  await order.save();

  return {
    ok: result.ok,
    skipped: result.skipped || false,
    error: safeStr(result?.error),
    shiprocket: order.shiprocket || null,
  };
}