type AnalyticsCartItem = {
  id?: string;
  title?: string;
  category?: string;
  price?: number;
  quantity?: number;
  itemType?: string;
  comboSlug?: string;
  comboCategorySlug?: string;
};

type AttributionSnapshot = {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
  referrer: string;
  referrer_host: string;
  landing_path: string;
  landing_url: string;
  source_bucket: string;
  detected_source: string;
  is_direct: boolean;
  captured_at: string;
};

type StoredAttribution = {
  firstTouch: AttributionSnapshot | null;
  lastTouch: AttributionSnapshot | null;
};

type PageViewPayload = {
  page_path?: string;
  page_location?: string;
  page_title?: string;
};

type PurchaseItem = {
  item_id?: string;
  item_name?: string;
  item_category?: string;
  item_variant?: string;
  price?: number;
  quantity?: number;
};

type PurchasePayload = {
  transaction_id: string;
  value: number;
  currency?: string;
  items?: PurchaseItem[];
  coupon?: string;
};

declare global {
  interface Window {
    dataLayer: any[];
    gtag?: (...args: any[]) => void;
  }
}

const ATTRIBUTION_STORAGE_KEY = "isp_attribution_store_v1";
const ATTRIBUTION_COOKIE_KEY = "isp_attr_v1";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function canUseBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function getHostname(input: string) {
  try {
    if (!input) return "";
    return new URL(input).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function includesAny(haystack: string, needles: string[]) {
  const s = safeStr(haystack).toLowerCase();
  return needles.some((needle) => s.includes(needle));
}

function detectSourceBucket(utmSource: string, referrerHost: string) {
  const src = safeStr(utmSource).toLowerCase();
  const ref = safeStr(referrerHost).toLowerCase();
  const basis = src || ref;

  if (!basis) {
    return { source_bucket: "direct", detected_source: "direct", is_direct: true };
  }

  if (includesAny(basis, ["google", "gsearch"])) {
    return { source_bucket: "google", detected_source: src || ref, is_direct: false };
  }

  if (includesAny(basis, ["youtube", "youtu.be"])) {
    return { source_bucket: "youtube", detected_source: src || ref, is_direct: false };
  }

  if (includesAny(basis, ["instagram", "ig"])) {
    return { source_bucket: "instagram", detected_source: src || ref, is_direct: false };
  }

  if (includesAny(basis, ["whatsapp", "wa.me"])) {
    return { source_bucket: "whatsapp", detected_source: src || ref, is_direct: false };
  }

  if (includesAny(basis, ["facebook", "fb", "m.facebook"])) {
    return { source_bucket: "facebook", detected_source: src || ref, is_direct: false };
  }

  if (ref) {
    return { source_bucket: "referral", detected_source: ref, is_direct: false };
  }

  return { source_bucket: "other", detected_source: src || ref || "other", is_direct: false };
}

function readStoredAttribution(): StoredAttribution {
  if (!canUseBrowser()) return { firstTouch: null, lastTouch: null };

  try {
    const raw = localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return { firstTouch: null, lastTouch: null };
    const parsed = JSON.parse(raw);
    return {
      firstTouch: parsed?.firstTouch || null,
      lastTouch: parsed?.lastTouch || null,
    };
  } catch {
    return { firstTouch: null, lastTouch: null };
  }
}

function writeStoredAttribution(value: StoredAttribution) {
  if (!canUseBrowser()) return;

  try {
    localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(value));
  } catch {}

  try {
    const encoded = encodeURIComponent(JSON.stringify(value));
    document.cookie = `${ATTRIBUTION_COOKIE_KEY}=${encoded}; path=/; max-age=${60 * 60 * 24 * 90}; samesite=lax`;
  } catch {}
}

function makeAttributionSnapshot(): AttributionSnapshot | null {
  if (!canUseBrowser()) return null;

  const url = new URL(window.location.href);
  const referrer = safeStr(document.referrer);
  const referrerHost = getHostname(referrer);

  const utm_source = safeStr(url.searchParams.get("utm_source"));
  const utm_medium = safeStr(url.searchParams.get("utm_medium"));
  const utm_campaign = safeStr(url.searchParams.get("utm_campaign"));
  const utm_term = safeStr(url.searchParams.get("utm_term"));
  const utm_content = safeStr(url.searchParams.get("utm_content"));

  const detected = detectSourceBucket(utm_source, referrerHost);

  return {
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    referrer,
    referrer_host: referrerHost,
    landing_path: safeStr(url.pathname),
    landing_url: safeStr(url.href),
    source_bucket: detected.source_bucket,
    detected_source: detected.detected_source,
    is_direct: detected.is_direct,
    captured_at: new Date().toISOString(),
  };
}

export function captureAttributionFromBrowser() {
  const snapshot = makeAttributionSnapshot();
  if (!snapshot) return null;

  const existing = readStoredAttribution();

  const hasSignal = Boolean(
    snapshot.utm_source ||
      snapshot.utm_medium ||
      snapshot.utm_campaign ||
      snapshot.utm_term ||
      snapshot.utm_content ||
      snapshot.referrer_host
  );

  const next: StoredAttribution = {
    firstTouch: existing.firstTouch || snapshot,
    lastTouch: hasSignal ? snapshot : existing.lastTouch || snapshot,
  };

  writeStoredAttribution(next);
  return next;
}

function getAttributionForEvent() {
  const store = captureAttributionFromBrowser() || readStoredAttribution();
  const firstTouch = store.firstTouch;
  const lastTouch = store.lastTouch;

  return {
    traffic_source_bucket: safeStr(lastTouch?.source_bucket || firstTouch?.source_bucket || "direct"),
    traffic_detected_source: safeStr(
      lastTouch?.detected_source || firstTouch?.detected_source || "direct"
    ),
    traffic_utm_source: safeStr(lastTouch?.utm_source || firstTouch?.utm_source),
    traffic_utm_medium: safeStr(lastTouch?.utm_medium || firstTouch?.utm_medium),
    traffic_utm_campaign: safeStr(lastTouch?.utm_campaign || firstTouch?.utm_campaign),
    traffic_referrer_host: safeStr(lastTouch?.referrer_host || firstTouch?.referrer_host),
  };
}

function pushToDataLayer(eventName: string, payload: Record<string, any>) {
  if (!canUseBrowser()) return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: eventName,
    ...payload,
  });
}

export function trackEvent(eventName: string, payload: Record<string, any> = {}) {
  if (!canUseBrowser()) return;

  const enriched = {
    ...payload,
    ...getAttributionForEvent(),
  };

  pushToDataLayer(eventName, enriched);

  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, enriched);
  }
}

export function trackPageView(payload: PageViewPayload = {}) {
  trackEvent("page_view", {
    page_path: safeStr(payload.page_path),
    page_location: safeStr(payload.page_location),
    page_title: safeStr(payload.page_title),
  });
}

function toGaItem(item: AnalyticsCartItem, fallbackQty = 1) {
  return {
    item_id: safeStr(item?.id),
    item_name: safeStr(item?.title || "Product"),
    item_category: safeStr(item?.category || "Product"),
    item_variant:
      safeStr(item?.itemType || "").toLowerCase() === "combo"
        ? safeStr(item?.comboSlug || item?.comboCategorySlug || "combo")
        : "",
    price: safeNum(item?.price, 0),
    quantity: Math.max(1, Math.trunc(safeNum(item?.quantity, fallbackQty))),
  };
}

export function trackAddToCart(item: AnalyticsCartItem) {
  const gaItem = toGaItem(item, 1);

  trackEvent("add_to_cart", {
    currency: "INR",
    value: safeNum(gaItem.price, 0) * safeNum(gaItem.quantity, 1),
    items: [gaItem],
  });
}

export function trackRemoveFromCart(item: AnalyticsCartItem) {
  const gaItem = toGaItem(item, 1);

  trackEvent("remove_from_cart", {
    currency: "INR",
    value: safeNum(gaItem.price, 0) * safeNum(gaItem.quantity, 1),
    items: [gaItem],
  });
}

export function trackSelectItem(item: AnalyticsCartItem, itemListName = "Product Listing") {
  const gaItem = toGaItem(item, 1);

  trackEvent("select_item", {
    item_list_name: safeStr(itemListName),
    items: [gaItem],
  });
}

export function trackViewItem(item: AnalyticsCartItem) {
  const gaItem = toGaItem(item, 1);

  trackEvent("view_item", {
    currency: "INR",
    value: safeNum(gaItem.price, 0),
    items: [gaItem],
  });
}

export function buildCheckoutFingerprint(cart: AnalyticsCartItem[]) {
  return (Array.isArray(cart) ? cart : [])
    .map((item) => {
      const id = safeStr(item?.id);
      const qty = Math.max(1, Math.trunc(safeNum(item?.quantity, 1)));
      return `${id}:${qty}`;
    })
    .filter(Boolean)
    .sort()
    .join("|");
}

export function trackBeginCheckoutFromCart(cart: AnalyticsCartItem[]) {
  const items = (Array.isArray(cart) ? cart : []).map((item) => toGaItem(item, 1));
  const value = items.reduce(
    (acc, item) => acc + safeNum(item.price, 0) * safeNum(item.quantity, 1),
    0
  );

  trackEvent("begin_checkout", {
    currency: "INR",
    value,
    items,
  });
}

export function trackPurchase(payload: PurchasePayload) {
  const items = Array.isArray(payload.items)
    ? payload.items.map((item) => ({
        item_id: safeStr(item?.item_id),
        item_name: safeStr(item?.item_name || "Product"),
        item_category: safeStr(item?.item_category || "Product"),
        item_variant: safeStr(item?.item_variant),
        price: safeNum(item?.price, 0),
        quantity: Math.max(1, Math.trunc(safeNum(item?.quantity, 1))),
      }))
    : [];

  trackEvent("purchase", {
    transaction_id: safeStr(payload.transaction_id),
    value: safeNum(payload.value, 0),
    currency: safeStr(payload.currency || "INR"),
    coupon: safeStr(payload.coupon || ""),
    items,
  });
}