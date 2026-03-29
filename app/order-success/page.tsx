"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle,
  Download,
  Home,
  ArrowRight,
  FileText,
  Mail,
  Loader2,
  Clock4,
  ShieldCheck,
  MessageCircle,
  BadgeCheck,
  Sparkles,
  RefreshCcw,
  PhoneCall,
  Boxes,
  Languages,
  CalendarClock,
  Truck,
  PackageCheck,
  MapPin,
  AlertTriangle,
  X,
} from "lucide-react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { trackPurchase } from "../../lib/analytics";

type ComboSnapshotItem = {
  title?: string;
  subtitle?: string;
};

type OrderItem = {
  productId: string;
  itemType?: "product" | "combo";
  isBuilderCombo?: boolean;

  title: string;
  category: string;
  price: number;
  quantity?: number;

  comboSlug?: string;
  comboCategorySlug?: string;
  comboBadge?: string;
  comboSaveLabel?: string;
  comboMediumLabel?: string;
  comboSessionLabel?: string;
  comboItems?: ComboSnapshotItem[];

  isPhysical?: boolean;
  currentAvailability?: string;
  deliverWithinMinutes?: number;
  onDemandNote?: string;

  shiprocketStatus?: string;
  shiprocketMessage?: string;
  shiprocketOrderId?: string;
  shiprocketShipmentId?: string;
  shiprocketAwbCode?: string;
  shiprocketCourierName?: string;
};

type ShippingAddress = {
  address?: string;
  pincode?: string;
  city?: string;
  state?: string;
};

type ShiprocketSummary = {
  enabled?: boolean;
  status?: string;
  message?: string;
  shiprocketOrderId?: string;
  shipmentId?: string;
  awbCode?: string;
  courierName?: string;
  syncedAt?: string;
};

type OrderShape = {
  _id?: string;
  orderRef?: string;
  status?: string;
  paidAt?: string | null;
  expiresAt?: string | null;
  totalAmount?: number;
  currency?: string;
  hasPhysicalItem?: boolean;
  shipping?: ShippingAddress | null;
  shiprocket?: ShiprocketSummary | null;
  items?: OrderItem[];
};

type DownloadResp =
  | { ok: true; url: string; expiresIn: number }
  | {
      ok: false;
      status: "processing" | "not_ready" | string;
      availability?: string;
      message?: string;
      paidAt?: string;
      etaAt?: string;
      remainingSeconds?: number;
    };

type ProcessingState = {
  title: string;
  message: string;
  remainingSeconds?: number;
  etaAt?: string;
  availability?: string;
};

type TrackingState = {
  orderRef: string;
  itemTitle: string;
  itemCategory: string;
  paidAt?: string | null;
  shipping?: ShippingAddress | null;
  shipmentStatus: string;
  shipmentStatusLabel: string;
  shipmentMessage: string;
  awbCode: string;
  courierName: string;
  shiprocketOrderId: string;
  shipmentId: string;
  syncedAt: string;
};

type HardcopyStageInfo = {
  key: "preparing" | "dispatch_booked" | "shipped" | "delivered" | "issue";
  title: string;
  description: string;
  timeline: string;
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function money(n: number) {
  try {
    return new Intl.NumberFormat("en-IN").format(Number(n || 0));
  } catch {
    return String(n);
  }
}

function secToClock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;

  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("en-IN");
  } catch {
    return d;
  }
}

function isComboItem(item: any) {
  return safeStr(item?.itemType).toLowerCase() === "combo";
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

function normalizeShipmentStatus(input: any) {
  const s = safeStr(input).toLowerCase();

  if (!s) return "processing";
  if (s.includes("delivered") || s.includes("complete")) return "delivered";
  if (
    s.includes("shipped") ||
    s.includes("in transit") ||
    s.includes("in_transit") ||
    s.includes("pickup") ||
    s.includes("awb") ||
    s.includes("manifested")
  ) {
    return "shipped";
  }
  if (
    s.includes("rto") ||
    s.includes("cancel") ||
    s.includes("failed") ||
    s.includes("undeliver")
  ) {
    return "issue";
  }
  if (
    s.includes("new") ||
    s.includes("created") ||
    s.includes("processing") ||
    s.includes("packed") ||
    s.includes("confirmed")
  ) {
    return "processing";
  }

  return "processing";
}

function hasDispatchDetails(args: {
  awbCode?: any;
  courierName?: any;
  shipmentId?: any;
  shiprocketOrderId?: any;
}) {
  return Boolean(
    safeStr(args?.awbCode) ||
      safeStr(args?.courierName) ||
      safeStr(args?.shipmentId) ||
      safeStr(args?.shiprocketOrderId)
  );
}

function getHardcopyStage(args: {
  status?: any;
  awbCode?: any;
  courierName?: any;
  shipmentId?: any;
  shiprocketOrderId?: any;
}): HardcopyStageInfo {
  const normalized = normalizeShipmentStatus(args?.status);
  const dispatchLive = hasDispatchDetails(args);

  if (normalized === "delivered") {
    return {
      key: "delivered",
      title: "Delivered successfully",
      description:
        "Your hardcopy order has been delivered successfully. Thank you for your purchase.",
      timeline: "Delivery completed.",
    };
  }

  if (normalized === "shipped") {
    return {
      key: "shipped",
      title: "Shipped and on the way",
      description:
        "Your parcel has been dispatched. Delivery usually takes 3–5 business days depending on location.",
      timeline: "Courier tracking is active.",
    };
  }

  if (normalized === "issue") {
    return {
      key: "issue",
      title: "Shipment update needs attention",
      description:
        "There is a shipment issue or a courier-side update pending. Please refresh again or contact support if this status remains unchanged.",
      timeline: "Support can help if needed.",
    };
  }

  if (dispatchLive) {
    return {
      key: "dispatch_booked",
      title: "Dispatch is being activated",
      description:
        "Your handwritten material is ready for dispatch processing. Courier assignment and shipment details are being updated.",
      timeline: "AWB and courier details will appear shortly.",
    };
  }

  return {
    key: "preparing",
    title: "Writing and preparation have started",
    description:
      "Your handwritten material is under preparation. Writing, checking and packing usually complete within 2 business days.",
    timeline:
      "After dispatch, delivery usually takes 3–5 business days depending on location.",
  };
}

function ShipmentPill({ status }: { status?: string }) {
  const normalized = normalizeShipmentStatus(status);

  if (normalized === "delivered") {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-extrabold border bg-emerald-50 border-emerald-200 text-emerald-800">
        <PackageCheck size={14} />
        DELIVERED
      </span>
    );
  }

  if (normalized === "shipped") {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-extrabold border bg-blue-50 border-blue-200 text-blue-800">
        <Truck size={14} />
        SHIPPED
      </span>
    );
  }

  if (normalized === "issue") {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-extrabold border bg-rose-50 border-rose-200 text-rose-700">
        <AlertTriangle size={14} />
        ISSUE
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-extrabold border bg-amber-50 border-amber-200 text-amber-800">
      <Clock4 size={14} />
      PREPARING
      </span>
    );
}

export default function OrderSuccessPage() {
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderShape | null>(null);
  const [downloadingPid, setDownloadingPid] = useState("");
  const [processingMsg, setProcessingMsg] = useState<ProcessingState | null>(null);
  const [tracking, setTracking] = useState<TrackingState | null>(null);

  const WHATSAPP_LINK =
    process.env.NEXT_PUBLIC_WHATSAPP_LINK ||
    "https://wa.me/917496865680?text=Hi%2C%20I%20need%20help%20with%20my%20order.";

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/orders/my", {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setOrder(null);
          return;
        }

        const orders = Array.isArray(data?.orders) ? data.orders : [];
        setOrder(orders[0] || null);
      } catch {
        setOrder(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!order) return;

    const transactionId = safeStr(order.orderRef || order._id);
    if (!transactionId) return;

    const storageKey = `isp_purchase_tracked_v1:${transactionId}`;
    const alreadyTracked = localStorage.getItem(storageKey);
    if (alreadyTracked) return;

    const rawItems = Array.isArray(order.items) ? order.items : [];
    if (!rawItems.length) return;

    trackPurchase({
      transaction_id: transactionId,
      value: safeNum(order.totalAmount, 0),
      currency: safeStr(order.currency || "INR"),
      items: rawItems.map((item) => ({
        item_id: safeStr(item.productId),
        item_name: safeStr(item.title || "Product"),
        item_category: safeStr(item.category || "Product"),
        item_variant:
          safeStr(item.itemType).toLowerCase() === "combo"
            ? safeStr(item.comboSlug || item.comboCategorySlug || "combo")
            : "",
        price: safeNum(item.price, 0),
        quantity: Math.max(1, safeNum(item.quantity, 1)),
      })),
    });

    localStorage.setItem(storageKey, new Date().toISOString());
  }, [order]);

  const items = useMemo(() => {
    return Array.isArray(order?.items) ? order!.items : [];
  }, [order]);

  const digitalItems = useMemo(() => {
    return items.filter((item) => !isComboItem(item) && !Boolean(item?.isPhysical));
  }, [items]);

  const hardcopyItems = useMemo(() => {
    return items.filter((item) => Boolean(item?.isPhysical));
  }, [items]);

  const hasPhysicalOrder = useMemo(() => {
    return Boolean(order?.hasPhysicalItem) || hardcopyItems.length > 0;
  }, [order, hardcopyItems]);

  const shipmentStatus = useMemo(() => {
    return safeStr(order?.shiprocket?.status);
  }, [order]);

  const hardcopyStage = useMemo(() => {
    return getHardcopyStage({
      status: order?.shiprocket?.status,
      awbCode: order?.shiprocket?.awbCode,
      courierName: order?.shiprocket?.courierName,
      shipmentId: order?.shiprocket?.shipmentId,
      shiprocketOrderId: order?.shiprocket?.shiprocketOrderId,
    });
  }, [order]);

  async function handleDownload(productId: string, title: string) {
    const pid = safeStr(productId);
    if (!pid) return;

    setDownloadingPid(pid);
    try {
      const res = await fetch(
        `/api/products/download?productId=${encodeURIComponent(pid)}&download=1`,
        {
          credentials: "include",
          cache: "no-store",
        }
      );

      const data: DownloadResp = await res.json().catch(() => ({} as any));

      if (res.ok && (data as any)?.ok && (data as any)?.url) {
        window.open((data as any).url, "_blank", "noopener,noreferrer");
        return;
      }

      setProcessingMsg({
        title: safeStr(title) || "Your Material",
        message:
          safeStr((data as any)?.message) ||
          "Your file is being prepared. We will make it available shortly.",
        remainingSeconds: Number((data as any)?.remainingSeconds || 0),
        etaAt: safeStr((data as any)?.etaAt || ""),
        availability: safeStr((data as any)?.availability || ""),
      });
    } catch {
      alert("Download request failed. Please try again.");
    } finally {
      setDownloadingPid("");
    }
  }

  function openTracking(item: OrderItem) {
    const orderSr = order?.shiprocket || {};
    const itemShipmentStatus = safeStr(item?.shiprocketStatus || orderSr?.status);

    const stage = getHardcopyStage({
      status: itemShipmentStatus,
      awbCode: item?.shiprocketAwbCode || orderSr?.awbCode,
      courierName: item?.shiprocketCourierName || orderSr?.courierName,
      shipmentId: item?.shiprocketShipmentId || orderSr?.shipmentId,
      shiprocketOrderId: item?.shiprocketOrderId || orderSr?.shiprocketOrderId,
    });

    setTracking({
      orderRef: safeStr(order?.orderRef || order?._id),
      itemTitle: safeStr(item?.title),
      itemCategory: safeStr(item?.category),
      paidAt: order?.paidAt || null,
      shipping: order?.shipping || null,
      shipmentStatus: itemShipmentStatus,
      shipmentStatusLabel: stage.title,
      shipmentMessage: stage.description,
      awbCode: safeStr(item?.shiprocketAwbCode || orderSr?.awbCode),
      courierName: safeStr(item?.shiprocketCourierName || orderSr?.courierName),
      shiprocketOrderId: safeStr(item?.shiprocketOrderId || orderSr?.shiprocketOrderId),
      shipmentId: safeStr(item?.shiprocketShipmentId || orderSr?.shipmentId),
      syncedAt: safeStr(orderSr?.syncedAt),
    });
  }

  const trackingStage = useMemo(() => {
    if (!tracking) return null;
    return getHardcopyStage({
      status: tracking.shipmentStatus,
      awbCode: tracking.awbCode,
      courierName: tracking.courierName,
      shipmentId: tracking.shipmentId,
      shiprocketOrderId: tracking.shiprocketOrderId,
    });
  }, [tracking]);

  return (
    <main className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800">
      <Navbar />

      <div className="max-w-[980px] mx-auto px-4 py-10 md:py-20">
        <div className="bg-white rounded-[28px] shadow-xl border border-gray-100 overflow-hidden text-center relative">
          <div className="h-2.5 bg-gradient-to-r from-green-400 via-emerald-500 to-green-600 w-full absolute top-0 left-0" />

          <div className="p-5 sm:p-8 md:p-12">
            <div className="mb-6 flex justify-center">
              <div className="rounded-full bg-green-50 p-4 ring-8 ring-green-50/60 animate-in zoom-in duration-500">
                <CheckCircle
                  className="text-green-500 w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 drop-shadow-sm"
                  strokeWidth={1.5}
                />
              </div>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-1.5 text-[11px] sm:text-xs font-extrabold text-green-800 mb-4">
              <BadgeCheck size={14} />
              Payment Verified Successfully
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Payment Successful
            </h1>

            <p className="text-slate-500 text-sm sm:text-base md:text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
              {hasPhysicalOrder
                ? "Thank you for your order. Your payment is confirmed, your account access is secure, and work on your hardcopy order has already started."
                : "Thank you for your purchase. Your order has been confirmed securely and your paid products are now linked to your account."}
            </p>

            <div className="inline-block bg-gray-50 border border-gray-200 rounded-full px-4 sm:px-6 py-2 mb-8 max-w-full">
              <span className="text-gray-500 text-xs sm:text-sm">Order ID: </span>
              <span className="font-bold text-slate-800 font-mono text-xs sm:text-sm break-all">
                {loading ? "Loading..." : safeStr(order?.orderRef || order?._id || "—")}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8 text-left">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-center gap-2 text-blue-700 font-extrabold text-sm">
                  <Mail size={16} />
                  Email Updates
                </div>
                <p className="text-xs text-blue-900/80 mt-2 leading-5">
                  Order confirmation and ready-product updates will also reach your registered email.
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-emerald-700 font-extrabold text-sm">
                  <ShieldCheck size={16} />
                  Secure Access
                </div>
                <p className="text-xs text-emerald-900/80 mt-2 leading-5">
                  Your paid products remain securely linked to your account for future access.
                </p>
              </div>

              <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                <div className="flex items-center gap-2 text-violet-700 font-extrabold text-sm">
                  <Sparkles size={16} />
                  On-Demand Processing
                </div>
                <p className="text-xs text-violet-900/80 mt-2 leading-5">
                  For on-demand PDFs, the preparation process starts immediately after payment.
                </p>
              </div>

              <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                <div className="flex items-center gap-2 text-orange-700 font-extrabold text-sm">
                  <Truck size={16} />
                  Hardcopy Preparation
                </div>
                <p className="text-xs text-orange-900/80 mt-2 leading-5">
                  Your handwritten hardcopy is prepared first, then dispatch tracking becomes live.
                </p>
              </div>
            </div>

            {hasPhysicalOrder ? (
              <div className="mb-8 rounded-3xl border border-orange-200 bg-gradient-to-r from-orange-50 to-white p-4 sm:p-6 text-left shadow-sm">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                      <Truck size={20} className="text-orange-600 shrink-0" />
                      Hardcopy Order Progress
                    </div>
                    <div className="mt-2 text-sm sm:text-base font-extrabold text-slate-900">
                      {hardcopyStage.title}
                    </div>
                    <div className="mt-2 text-xs sm:text-sm text-slate-700 font-semibold leading-6">
                      {hardcopyStage.description}
                    </div>
                    <div className="mt-2 text-[11px] sm:text-xs font-extrabold uppercase tracking-wide text-orange-700">
                      {hardcopyStage.timeline}
                    </div>
                  </div>

                  <ShipmentPill status={shipmentStatus} />
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-white border border-gray-200 p-4">
                    <div className="text-[11px] uppercase font-extrabold text-slate-500">
                      Step 1
                    </div>
                    <div className="mt-1 text-sm font-extrabold text-slate-900">
                      Payment Confirmed
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-600 leading-5">
                      Your order has been recorded successfully and is already linked to your account.
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white border border-gray-200 p-4">
                    <div className="text-[11px] uppercase font-extrabold text-slate-500">
                      Step 2
                    </div>
                    <div className="mt-1 text-sm font-extrabold text-slate-900">
                      Writing and Packing
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-600 leading-5">
                      Hardcopy preparation usually completes within 2 business days.
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white border border-gray-200 p-4">
                    <div className="text-[11px] uppercase font-extrabold text-slate-500">
                      Step 3
                    </div>
                    <div className="mt-1 text-sm font-extrabold text-slate-900">
                      Delivery After Dispatch
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-600 leading-5">
                      Delivery usually takes 3–5 business days after dispatch, depending on location.
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl bg-white border border-gray-200 p-3">
                    <div className="text-[11px] uppercase font-extrabold text-slate-500">
                      Courier
                    </div>
                    <div className="mt-1 text-sm font-extrabold text-slate-900 break-words">
                      {safeStr(order?.shiprocket?.courierName) || "Will appear after dispatch"}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white border border-gray-200 p-3">
                    <div className="text-[11px] uppercase font-extrabold text-slate-500">
                      AWB Code
                    </div>
                    <div className="mt-1 text-sm font-extrabold text-slate-900 break-all">
                      {safeStr(order?.shiprocket?.awbCode) || "Will appear after dispatch"}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white border border-gray-200 p-3">
                    <div className="text-[11px] uppercase font-extrabold text-slate-500">
                      Shipment ID
                    </div>
                    <div className="mt-1 text-sm font-extrabold text-slate-900 break-all">
                      {safeStr(order?.shiprocket?.shipmentId) || "Will appear after dispatch"}
                    </div>
                  </div>
                </div>

                {order?.shipping ? (
                  <div className="mt-4 rounded-xl bg-white border border-gray-200 p-4">
                    <div className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <MapPin size={16} />
                      Delivery Address
                    </div>
                    <div className="mt-2 text-sm text-slate-700 font-semibold leading-6 break-words">
                      {[
                        safeStr(order.shipping?.address),
                        safeStr(order.shipping?.city),
                        safeStr(order.shipping?.state),
                        safeStr(order.shipping?.pincode),
                      ]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="bg-[#F8FAFC] border border-dashed border-gray-300 rounded-2xl p-4 sm:p-6 mb-8 text-left">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Download size={20} className="text-blue-600" />
                Your Purchases
              </h3>

              {loading ? (
                <div className="flex items-center gap-2 text-sm text-slate-600 font-semibold">
                  <Loader2 size={18} className="animate-spin" />
                  Loading your latest paid order...
                </div>
              ) : !order || items.length === 0 ? (
                <div className="text-sm text-slate-600 font-semibold">
                  No recent paid order found.
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item, idx) => {
                    const combo = isComboItem(item);
                    const isPhysical = Boolean(item?.isPhysical);
                    const availability = normalizeAvailability(item?.currentAvailability);
                    const onDemand = availability === "on_demand";
                    const notReady = availability === "want_to_buy";

                    const itemHardcopyStage = getHardcopyStage({
                      status: item?.shiprocketStatus || order?.shiprocket?.status,
                      awbCode: item?.shiprocketAwbCode || order?.shiprocket?.awbCode,
                      courierName: item?.shiprocketCourierName || order?.shiprocket?.courierName,
                      shipmentId: item?.shiprocketShipmentId || order?.shiprocket?.shipmentId,
                      shiprocketOrderId:
                        item?.shiprocketOrderId || order?.shiprocket?.shiprocketOrderId,
                    });

                    return (
                      <div
                        key={`${item.productId}-${idx}`}
                        className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm hover:border-blue-300 transition"
                      >
                        <div className="flex flex-col gap-4">
                          <div className="flex items-start gap-4 min-w-0">
                            <div
                              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                                combo
                                  ? "bg-indigo-50 text-indigo-600"
                                  : isPhysical
                                  ? "bg-orange-50 text-orange-600"
                                  : "bg-red-50 text-red-500"
                              }`}
                            >
                              {combo ? (
                                <Boxes size={20} />
                              ) : isPhysical ? (
                                <Truck size={20} />
                              ) : (
                                <FileText size={20} />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-bold text-sm sm:text-base text-slate-800 break-words">
                                  {item.title}
                                </p>

                                {combo ? (
                                  <span className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 text-[11px] font-extrabold">
                                    {item.isBuilderCombo ? "Builder Combo" : "Saved Combo"}
                                  </span>
                                ) : null}

                                {safeStr(item.comboBadge) ? (
                                  <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 text-[11px] font-extrabold">
                                    {safeStr(item.comboBadge)}
                                  </span>
                                ) : null}

                                {!combo && isPhysical ? (
                                  <ShipmentPill
                                    status={safeStr(
                                      item?.shiprocketStatus || order?.shiprocket?.status
                                    )}
                                  />
                                ) : null}
                              </div>

                              <p className="text-xs text-gray-400 mt-1 leading-5">
                                {combo
                                  ? `Combo • ₹${money(item.price)} • Qty ${Number(item.quantity || 1)}`
                                  : isPhysical
                                  ? `${item.category} • ₹${money(item.price)} • Hardcopy Delivery`
                                  : `${item.category} • ₹${money(item.price)} • Secure PDF Access`}
                              </p>

                              {combo ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {safeStr(item.comboMediumLabel) ? (
                                    <span className="inline-flex items-center rounded-full bg-gray-50 text-slate-700 border border-gray-200 px-2.5 py-1 text-[11px] font-extrabold">
                                      <Languages size={12} className="mr-1" />
                                      {safeStr(item.comboMediumLabel)}
                                    </span>
                                  ) : null}

                                  {safeStr(item.comboSessionLabel) ? (
                                    <span className="inline-flex items-center rounded-full bg-gray-50 text-slate-700 border border-gray-200 px-2.5 py-1 text-[11px] font-extrabold">
                                      <CalendarClock size={12} className="mr-1" />
                                      {safeStr(item.comboSessionLabel)}
                                    </span>
                                  ) : null}

                                  {safeStr(item.comboSaveLabel) ? (
                                    <span className="inline-flex items-center rounded-full bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1 text-[11px] font-extrabold">
                                      {safeStr(item.comboSaveLabel)}
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}

                              {!combo && isPhysical ? (
                                <div className="mt-3 rounded-2xl border border-orange-200 bg-orange-50 p-3">
                                  <div className="text-sm font-extrabold text-orange-900">
                                    {itemHardcopyStage.title}
                                  </div>
                                  <div className="mt-1 text-xs text-orange-800 font-semibold leading-6">
                                    {itemHardcopyStage.description}
                                  </div>

                                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div className="rounded-xl border border-orange-200 bg-white p-3">
                                      <div className="text-[11px] uppercase font-extrabold tracking-wide text-orange-700">
                                        Expected dispatch
                                      </div>
                                      <div className="mt-1 text-xs font-semibold text-slate-700 leading-5">
                                        Usually within 2 business days.
                                      </div>
                                    </div>

                                    <div className="rounded-xl border border-orange-200 bg-white p-3">
                                      <div className="text-[11px] uppercase font-extrabold tracking-wide text-orange-700">
                                        Expected delivery
                                      </div>
                                      <div className="mt-1 text-xs font-semibold text-slate-700 leading-5">
                                        Usually 3–5 business days after dispatch.
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {safeStr(
                                      item?.shiprocketCourierName || order?.shiprocket?.courierName
                                    ) ? (
                                      <span className="inline-flex items-center rounded-full bg-white border border-orange-200 px-2.5 py-1 text-[11px] font-extrabold text-orange-800">
                                        Courier:{" "}
                                        {safeStr(
                                          item?.shiprocketCourierName ||
                                            order?.shiprocket?.courierName
                                        )}
                                      </span>
                                    ) : null}

                                    {safeStr(
                                      item?.shiprocketAwbCode || order?.shiprocket?.awbCode
                                    ) ? (
                                      <span className="inline-flex items-center rounded-full bg-white border border-orange-200 px-2.5 py-1 text-[11px] font-extrabold text-orange-800">
                                        AWB:{" "}
                                        {safeStr(
                                          item?.shiprocketAwbCode || order?.shiprocket?.awbCode
                                        )}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              ) : null}

                              {!combo && onDemand ? (
                                <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50 p-3">
                                  <div className="text-sm font-extrabold text-violet-900">
                                    On-demand PDF is being prepared
                                  </div>
                                  <div className="mt-1 text-xs font-semibold text-violet-800 leading-6">
                                    {safeStr(item.onDemandNote) ||
                                      `Your material is usually delivered within ${Math.max(
                                        1,
                                        safeNum(item.deliverWithinMinutes, 20)
                                      )} minutes after payment.`}
                                  </div>
                                </div>
                              ) : null}

                              {!combo && notReady ? (
                                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                                  <div className="text-sm font-extrabold text-amber-900">
                                    Material not ready yet
                                  </div>
                                  <div className="mt-1 text-xs font-semibold text-amber-800 leading-6">
                                    Your order is safe. Download access will become active automatically as soon as the material is linked.
                                  </div>
                                </div>
                              ) : null}

                              {combo && Array.isArray(item.comboItems) && item.comboItems.length > 0 ? (
                                <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-3">
                                  <div className="text-[11px] uppercase font-extrabold tracking-wide text-indigo-700">
                                    Combo Items Snapshot
                                  </div>

                                  <div className="mt-2 space-y-2">
                                    {item.comboItems.slice(0, 5).map((comboItem, comboIdx) => (
                                      <div
                                        key={`${safeStr(comboItem?.title)}-${comboIdx}`}
                                        className="rounded-xl border border-indigo-100 bg-white px-3 py-2"
                                      >
                                        <div className="text-sm font-extrabold text-slate-900">
                                          {safeStr(comboItem?.title) || "Untitled Item"}
                                        </div>
                                        {safeStr(comboItem?.subtitle) ? (
                                          <div className="mt-0.5 text-xs font-semibold text-slate-600">
                                            {safeStr(comboItem?.subtitle)}
                                          </div>
                                        ) : null}
                                      </div>
                                    ))}

                                    {item.comboItems.length > 5 ? (
                                      <div className="text-xs font-extrabold text-indigo-700">
                                        +{item.comboItems.length - 5} more items
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="w-full sm:w-auto sm:self-start">
                            {combo ? (
                              <div className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-500 font-extrabold shadow-sm">
                                Combo Added to Order
                              </div>
                            ) : isPhysical ? (
                              <button
                                onClick={() => openTracking(item)}
                                className="w-full sm:w-auto bg-orange-600 text-white px-4 py-3 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 hover:bg-orange-700 transition shadow-sm"
                              >
                                <Truck size={16} />
                                Track Order
                              </button>
                            ) : (
                              <button
                                onClick={() => handleDownload(item.productId, item.title)}
                                disabled={downloadingPid === item.productId}
                                className="w-full sm:w-auto bg-blue-600 text-white px-4 py-3 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 hover:bg-blue-700 transition disabled:opacity-60 shadow-sm"
                              >
                                {downloadingPid === item.productId ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : (
                                  <Download size={16} />
                                )}
                                Download
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-8 bg-blue-50/60 border border-blue-100 p-4 rounded-2xl">
              <Mail size={16} />
              <span>
                Your paid products are also available inside your dashboard for future access.
              </span>
            </div>

            {processingMsg ? (
              <div className="mb-8 rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 text-left shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Clock4 size={20} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-amber-900 text-lg">
                      Preparing Your Product
                    </div>
                    <div className="text-sm font-bold text-slate-800 mt-1 break-words">
                      {processingMsg.title}
                    </div>
                    <div className="text-sm text-amber-800 mt-3 leading-6">
                      {processingMsg.message}
                    </div>

                    {safeNum(processingMsg.remainingSeconds, 0) > 0 ? (
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-2xl border border-amber-200 bg-white px-4 py-4">
                          <div className="text-xs font-bold uppercase text-amber-700">
                            Estimated Countdown
                          </div>
                          <div className="mt-2 text-3xl font-extrabold text-slate-900 tracking-wide">
                            {secToClock(Number(processingMsg.remainingSeconds || 0))}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-amber-200 bg-white px-4 py-4">
                          <div className="text-xs font-bold uppercase text-amber-700">
                            Expected By
                          </div>
                          <div className="mt-2 text-sm font-extrabold text-slate-900">
                            {processingMsg.etaAt ? fmtDate(processingMsg.etaAt) : "Shortly"}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                        <div className="font-extrabold text-rose-800">
                          Your file is taking a little longer than expected
                        </div>
                        <p className="text-sm text-rose-700 mt-2 leading-6">
                          Please do not worry. Your payment is safe and your order is already recorded.
                          Our team has been notified. Your PDF will be uploaded soon and the ready link
                          will also be sent to your registered email.
                        </p>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <a
                            href={WHATSAPP_LINK}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-extrabold shadow-sm"
                          >
                            <MessageCircle size={16} />
                            WhatsApp Support
                          </a>

                          <Link
                            href="/contact"
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-gray-50 border border-rose-200 text-rose-700 font-extrabold"
                          >
                            <PhoneCall size={16} />
                            Contact Support
                          </Link>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-sm font-extrabold text-slate-900">
                        Important Assurance
                      </div>
                      <ul className="mt-2 text-xs text-slate-600 leading-6 list-disc pl-5">
                        <li>Your payment has already been verified successfully.</li>
                        <li>Your order is securely linked to your account.</li>
                        <li>You can check this product anytime again from your dashboard.</li>
                        <li>Once uploaded, the product becomes downloadable instantly.</li>
                      </ul>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        onClick={() => {
                          const firstDownloadable = digitalItems.find((x) => safeStr(x.productId));
                          if (firstDownloadable?.productId) {
                            handleDownload(firstDownloadable.productId, firstDownloadable.title);
                          }
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-950 text-white font-extrabold shadow-sm"
                      >
                        <RefreshCcw size={16} />
                        Check Again
                      </button>

                      <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-slate-800 font-extrabold"
                      >
                        <ArrowRight size={16} />
                        Open Dashboard
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/"
                className="px-8 py-3.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
              >
                <Home size={18} /> Back to Home
              </Link>

              <Link
                href="/dashboard"
                className="px-8 py-3.5 bg-white text-slate-700 border border-gray-200 rounded-xl font-bold hover:bg-gray-50 transition flex items-center justify-center gap-2"
              >
                Open Dashboard <ArrowRight size={18} />
              </Link>

              <Link
                href="/orders"
                className="px-8 py-3.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-xl font-bold hover:bg-orange-100 transition flex items-center justify-center gap-2"
              >
                <Truck size={18} />
                View Orders
              </Link>
            </div>
          </div>
        </div>
      </div>

      {tracking ? (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setTracking(null)} />
          <div className="relative w-full max-w-2xl rounded-3xl bg-white border border-gray-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-lg font-extrabold">Track Hardcopy Order</div>
                <div className="text-sm text-slate-600 break-words">{tracking.itemTitle}</div>
              </div>
              <button
                onClick={() => setTracking(null)}
                className="h-10 w-10 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white flex items-center justify-center shrink-0"
              >
                <X />
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-sm font-extrabold text-orange-900">Order Status</div>
                    <div className="mt-1 text-lg font-extrabold text-slate-900">
                      {trackingStage?.title || tracking.shipmentStatusLabel}
                    </div>
                  </div>
                  <ShipmentPill status={tracking.shipmentStatus} />
                </div>

                <div className="mt-3 text-sm text-orange-800 font-semibold leading-6">
                  {trackingStage?.description || tracking.shipmentMessage}
                </div>

                <div className="mt-3 rounded-xl border border-orange-200 bg-white p-3">
                  <div className="text-[11px] uppercase font-extrabold tracking-wide text-orange-700">
                    Delivery timeline
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-700 leading-5">
                    {trackingStage?.timeline ||
                      "Preparation usually completes within 2 business days. Delivery usually takes 3–5 business days after dispatch."}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-[11px] uppercase font-extrabold text-slate-500">
                    Order Reference
                  </div>
                  <div className="mt-1 text-sm font-extrabold text-slate-900 break-all">
                    {tracking.orderRef || "—"}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-[11px] uppercase font-extrabold text-slate-500">
                    Purchased On
                  </div>
                  <div className="mt-1 text-sm font-extrabold text-slate-900">
                    {fmtDate(tracking.paidAt)}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-[11px] uppercase font-extrabold text-slate-500">
                    Courier
                  </div>
                  <div className="mt-1 text-sm font-extrabold text-slate-900 break-words">
                    {tracking.courierName || "Will appear after dispatch"}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-[11px] uppercase font-extrabold text-slate-500">
                    AWB Code
                  </div>
                  <div className="mt-1 text-sm font-extrabold text-slate-900 break-all">
                    {tracking.awbCode || "Will appear after dispatch"}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-[11px] uppercase font-extrabold text-slate-500">
                    Shiprocket Order ID
                  </div>
                  <div className="mt-1 text-sm font-extrabold text-slate-900 break-all">
                    {tracking.shiprocketOrderId || "Will appear after dispatch"}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-[11px] uppercase font-extrabold text-slate-500">
                    Shipment ID
                  </div>
                  <div className="mt-1 text-sm font-extrabold text-slate-900 break-all">
                    {tracking.shipmentId || "Will appear after dispatch"}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <MapPin size={16} />
                  Delivery Address
                </div>
                <div className="mt-2 text-sm text-slate-700 font-semibold leading-6 break-words">
                  {tracking.shipping
                    ? [
                        safeStr(tracking.shipping.address),
                        safeStr(tracking.shipping.city),
                        safeStr(tracking.shipping.state),
                        safeStr(tracking.shipping.pincode),
                      ]
                        .filter(Boolean)
                        .join(", ") || "—"
                    : "—"}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <div className="text-sm font-extrabold text-blue-900 flex items-center gap-2">
                  <ShieldCheck size={16} />
                  Trust Information
                </div>
                <div className="mt-2 text-xs text-blue-800 font-semibold leading-6">
                  • Your payment has been verified successfully.
                  <br />
                  • Your hardcopy order is securely linked to your account.
                  <br />
                  • Preparation starts before shipment tracking becomes fully live.
                  <br />
                  • AWB and courier details appear automatically after dispatch.
                  <br />• Last sync: {tracking.syncedAt ? fmtDate(tracking.syncedAt) : "Pending"}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 bg-white flex items-center justify-end gap-2">
              <button
                onClick={() => setTracking(null)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold"
              >
                Close
              </button>

              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-bold"
              >
                <RefreshCcw size={16} />
                Refresh Order Status
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Footer />
    </main>
  );
}