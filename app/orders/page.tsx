"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Download,
  ShoppingBag,
  ArrowLeft,
  Loader2,
  Lock,
  FileText,
  Boxes,
  BadgeCheck,
  Languages,
  CalendarClock,
  Truck,
  MapPin,
  PackageCheck,
  Clock4,
  AlertTriangle,
  Search,
  X,
  RefreshCcw,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Filter,
} from "lucide-react";
import TopBar from "../../components/TopBar";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";

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
    return String(n || 0);
  }
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

type HardcopyStageInfo = {
  key: "preparing" | "dispatch_booked" | "shipped" | "delivered" | "issue";
  title: string;
  description: string;
  timeline: string;
};

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
      "Your hardcopy order is under active preparation. Handwriting, checking and packing usually complete within 2 business days.",
    timeline:
      "After dispatch, delivery usually takes 3–5 business days depending on location.",
  };
}

type DownloadResp =
  | { ok: true; url: string; expiresIn: number }
  | {
      ok: false;
      status?: "processing" | "not_ready" | string;
      availability?: string;
      message?: string;
      paidAt?: string;
      etaAt?: string;
      remainingSeconds?: number;
    };

type OrderComboItem = {
  title?: string;
  subtitle?: string;
};

type OrderItem = {
  productId: string;
  itemType?: "product" | "combo";
  isBuilderCombo?: boolean;

  title?: string;
  category?: string;
  price?: number;
  quantity?: number;

  comboSlug?: string;
  comboCategorySlug?: string;
  comboBadge?: string;
  comboSaveLabel?: string;
  comboMediumLabel?: string;
  comboSessionLabel?: string;
  comboItems?: OrderComboItem[];

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

type ShippingAddress = {
  address?: string;
  pincode?: string;
  city?: string;
  state?: string;
};

type Order = {
  _id: string;
  orderRef?: string;
  status?: string;
  totalAmount?: number;
  walletUsedAmount?: number;
  orderValue?: number;
  currency?: string;
  createdAt?: string;
  paidAt?: string | null;
  expiresAt?: string | null;
  hasPhysicalItem?: boolean;
  shipping?: ShippingAddress | null;
  shiprocket?: ShiprocketSummary | null;
  items?: OrderItem[];
};

type OrdersResponse = {
  ok?: boolean;
  orders?: Order[];
  summary?: {
    orders?: number;
    totalValue?: number;
    walletUsedAmount?: number;
    digitalCount?: number;
    hardcopyCount?: number;
    comboCount?: number;
  };
  pagination?: {
    page?: number;
    limit?: number;
    totalOrders?: number;
    totalPages?: number;
    hasPrev?: boolean;
    hasNext?: boolean;
  };
  filters?: {
    q?: string;
    type?: string;
  };
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

type TypeFilter = "all" | "digital" | "hardcopy" | "combo";

function StatusPill({ status }: { status: string }) {
  const s = safeStr(status).toLowerCase();
  const base =
    "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold border";

  if (s === "paid") {
    return (
      <span className={`${base} bg-emerald-50 border-emerald-200 text-emerald-800`}>
        <BadgeCheck size={14} />
        PAID
      </span>
    );
  }

  if (s === "pending") {
    return (
      <span className={`${base} bg-amber-50 border-amber-200 text-amber-800`}>
        <Clock4 size={14} />
        PENDING
      </span>
    );
  }

  if (s === "failed") {
    return (
      <span className={`${base} bg-rose-50 border-rose-200 text-rose-700`}>
        <AlertTriangle size={14} />
        FAILED
      </span>
    );
  }

  return (
    <span className={`${base} bg-slate-50 border-slate-200 text-slate-700`}>
      {s.toUpperCase() || "ORDER"}
    </span>
  );
}

function AvailabilityPill({ availability }: { availability?: string }) {
  const a = normalizeAvailability(availability);

  if (a === "on_demand") {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold border bg-violet-50 border-violet-200 text-violet-800">
        <Clock4 size={14} />
        ON DEMAND
      </span>
    );
  }

  if (a === "want_to_buy") {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold border bg-amber-50 border-amber-200 text-amber-800">
        <AlertTriangle size={14} />
        NOT READY
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold border bg-blue-50 border-blue-200 text-blue-800">
      <Download size={14} />
      READY
    </span>
  );
}

function ShipmentPill({ status }: { status?: string }) {
  const normalized = normalizeShipmentStatus(status);

  if (normalized === "delivered") {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold border bg-emerald-50 border-emerald-200 text-emerald-800">
        <PackageCheck size={14} />
        DELIVERED
      </span>
    );
  }

  if (normalized === "shipped") {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold border bg-blue-50 border-blue-200 text-blue-800">
        <Truck size={14} />
        SHIPPED
      </span>
    );
  }

  if (normalized === "issue") {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold border bg-rose-50 border-rose-200 text-rose-700">
        <AlertTriangle size={14} />
        ISSUE
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold border bg-amber-50 border-amber-200 text-amber-800">
      <Clock4 size={14} />
      PREPARING
    </span>
  );
}

function PaginationBar({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);

  for (let i = start; i <= end; i += 1) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap mt-6">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 font-bold shadow-sm disabled:opacity-50"
      >
        <ChevronLeft size={16} />
        Previous
      </button>

      <div className="flex items-center gap-2 flex-wrap">
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`h-10 min-w-[40px] px-3 rounded-xl border font-extrabold shadow-sm ${
              p === page
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-800 border-gray-200"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 font-bold shadow-sm disabled:opacity-50"
      >
        Next
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

export default function OrdersPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [err, setErr] = useState("");
  const [downloadingPid, setDownloadingPid] = useState("");
  const [processingMsg, setProcessingMsg] = useState<ProcessingState | null>(null);
  const [tracking, setTracking] = useState<TrackingState | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [page, setPage] = useState(1);

  const [summary, setSummary] = useState({
    orders: 0,
    totalValue: 0,
    walletUsedAmount: 0,
    digitalCount: 0,
    hardcopyCount: 0,
    comboCount: 0,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 8,
    totalOrders: 0,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  });

  const [expandedComboKeys, setExpandedComboKeys] = useState<Record<string, boolean>>({});

  const DOWNLOAD_API = "/api/products/download";

  async function fetchOrders(args?: {
    nextPage?: number;
    nextSearch?: string;
    nextType?: TypeFilter;
  }) {
    const targetPage = Math.max(1, safeNum(args?.nextPage, page));
    const targetSearch = safeStr(
      args?.nextSearch !== undefined ? args.nextSearch : appliedSearch
    );
    const targetType = (args?.nextType || typeFilter) as TypeFilter;

    try {
      setErr("");

      const qs = new URLSearchParams({
        page: String(targetPage),
        limit: "8",
        q: targetSearch,
        type: targetType,
      });

      const r = await fetch(`/api/orders/my?${qs.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });

      const d: OrdersResponse = await r.json().catch(() => ({}));

      if (!r.ok) {
        if (r.status === 401 || r.status === 403) {
          setErr((d as any)?.error || "Login required to view orders.");
          setOrders([]);
          return;
        }

        setErr((d as any)?.error || "Orders load failed");
        setOrders([]);
        return;
      }

      setOrders(Array.isArray(d?.orders) ? d.orders : []);
      setSummary({
        orders: safeNum(d?.summary?.orders, 0),
        totalValue: safeNum(d?.summary?.totalValue, 0),
        walletUsedAmount: safeNum(d?.summary?.walletUsedAmount, 0),
        digitalCount: safeNum(d?.summary?.digitalCount, 0),
        hardcopyCount: safeNum(d?.summary?.hardcopyCount, 0),
        comboCount: safeNum(d?.summary?.comboCount, 0),
      });
      setPagination({
        page: Math.max(1, safeNum(d?.pagination?.page, 1)),
        limit: Math.max(1, safeNum(d?.pagination?.limit, 8)),
        totalOrders: Math.max(0, safeNum(d?.pagination?.totalOrders, 0)),
        totalPages: Math.max(1, safeNum(d?.pagination?.totalPages, 1)),
        hasPrev: Boolean(d?.pagination?.hasPrev),
        hasNext: Boolean(d?.pagination?.hasNext),
      });
      setErr("");
    } catch {
      setErr("Orders load failed.");
      setOrders([]);
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchOrders({ nextPage: 1, nextSearch: "", nextType: "all" });
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleApplyFilters() {
    const nextSearch = safeStr(searchInput);
    setAppliedSearch(nextSearch);
    setPage(1);
    setLoading(true);
    void fetchOrders({ nextPage: 1, nextSearch, nextType: typeFilter }).finally(() =>
      setLoading(false)
    );
  }

  function handleTypeChange(nextType: TypeFilter) {
    setTypeFilter(nextType);
    setPage(1);
    setLoading(true);
    void fetchOrders({
      nextPage: 1,
      nextSearch: appliedSearch,
      nextType,
    }).finally(() => setLoading(false));
  }

  function handleResetFilters() {
    setSearchInput("");
    setAppliedSearch("");
    setTypeFilter("all");
    setPage(1);
    setLoading(true);
    void fetchOrders({
      nextPage: 1,
      nextSearch: "",
      nextType: "all",
    }).finally(() => setLoading(false));
  }

  function handlePageChange(nextPage: number) {
    if (nextPage < 1 || nextPage > pagination.totalPages) return;
    setPage(nextPage);
    setLoading(true);
    void fetchOrders({
      nextPage,
      nextSearch: appliedSearch,
      nextType: typeFilter,
    }).finally(() => setLoading(false));
  }

  const currentStart = useMemo(() => {
    if (pagination.totalOrders === 0) return 0;
    return (pagination.page - 1) * pagination.limit + 1;
  }, [pagination]);

  const currentEnd = useMemo(() => {
    if (pagination.totalOrders === 0) return 0;
    return Math.min(pagination.page * pagination.limit, pagination.totalOrders);
  }, [pagination]);

  const download = async (item: OrderItem) => {
    const productId = safeStr(item?.productId);
    if (!productId) return;

    setDownloadingPid(productId);

    try {
      const r = await fetch(
        `${DOWNLOAD_API}?productId=${encodeURIComponent(productId)}&download=1`,
        {
          cache: "no-store",
          credentials: "include",
        }
      );

      const d: DownloadResp = await r.json().catch(() => ({} as any));

      if (r.ok && (d as any)?.ok && (d as any)?.url) {
        window.open((d as any).url, "_blank", "noopener,noreferrer");
        return;
      }

      setProcessingMsg({
        title: safeStr(item?.title) || "Your Material",
        message:
          safeStr((d as any)?.message) ||
          "Your product is being prepared. Please check again after some time.",
        remainingSeconds: safeNum((d as any)?.remainingSeconds, 0),
        etaAt: safeStr((d as any)?.etaAt),
        availability: safeStr((d as any)?.availability || item?.currentAvailability),
      });
    } catch {
      alert("Download request failed. Please try again.");
    } finally {
      setDownloadingPid("");
    }
  };

  function openTracking(order: Order, item: OrderItem) {
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
      <TopBar />
      <Navbar />

      <div className="max-w-[1200px] mx-auto px-4 py-8 md:py-12">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 flex items-center gap-3">
              <ShoppingBag className="text-blue-600" /> My Orders
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Digital downloads, combo snapshots aur hardcopy order progress ek hi simple page me.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setLoading(true);
                void fetchOrders({
                  nextPage: pagination.page,
                  nextSearch: appliedSearch,
                  nextType: typeFilter,
                }).finally(() => setLoading(false));
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold shadow-sm"
            >
              <RefreshCcw size={18} />
              Refresh
            </button>

            <Link
              href="/products"
              className="inline-flex items-center gap-2 font-bold text-blue-600 hover:text-blue-800"
            >
              <ArrowLeft size={18} /> Continue Shopping
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs uppercase font-bold text-slate-500">Orders</div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">{summary.orders}</div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <div className="text-xs uppercase font-bold text-emerald-700">Order Value</div>
            <div className="mt-2 text-2xl font-extrabold text-emerald-900">
              ₹{money(summary.totalValue)}
            </div>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <div className="text-xs uppercase font-bold text-blue-700">Digital Items</div>
            <div className="mt-2 text-2xl font-extrabold text-blue-900">{summary.digitalCount}</div>
          </div>

          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
            <div className="text-xs uppercase font-bold text-orange-700">Hardcopy Items</div>
            <div className="mt-2 text-2xl font-extrabold text-orange-900">{summary.hardcopyCount}</div>
          </div>

          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm">
            <div className="text-xs uppercase font-bold text-indigo-700">Combo Items</div>
            <div className="mt-2 text-2xl font-extrabold text-indigo-900">{summary.comboCount}</div>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={16} className="text-slate-600" />
            <div className="font-extrabold text-slate-900">Search & Filters</div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleApplyFilters();
                }}
                placeholder="Search by title, order id, category, AWB, courier"
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-blue-500 focus:bg-white transition font-medium"
              />
            </div>

            <button
              onClick={handleApplyFilters}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-950 text-white font-extrabold"
            >
              <Search size={16} />
              Apply
            </button>

            <button
              onClick={handleResetFilters}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 font-extrabold"
            >
              <X size={16} />
              Reset
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { key: "all", label: "All Orders" },
              { key: "digital", label: "Digital" },
              { key: "hardcopy", label: "Hardcopy" },
              { key: "combo", label: "Combo" },
            ].map((x) => (
              <button
                key={x.key}
                onClick={() => handleTypeChange(x.key as TypeFilter)}
                className={`px-3 py-2 rounded-full text-sm font-extrabold border transition ${
                  typeFilter === x.key
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm font-semibold text-slate-700">
              Showing <span className="font-extrabold">{currentStart}</span> to{" "}
              <span className="font-extrabold">{currentEnd}</span> of{" "}
              <span className="font-extrabold">{pagination.totalOrders}</span> orders
            </div>

            {summary.walletUsedAmount > 0 ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 text-violet-800 border border-violet-200 text-xs font-extrabold">
                <CreditCard size={14} />
                Wallet used: ₹{money(summary.walletUsedAmount)}
              </div>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex items-center gap-3 text-slate-700 font-bold">
            <Loader2 className="animate-spin" size={18} /> Loading orders...
          </div>
        ) : err ? (
          <div className="bg-red-50 rounded-2xl border border-red-200 p-6 shadow-sm text-red-700 font-bold">
            {err}
            <div className="mt-2 text-sm font-semibold text-red-700/80">
              Please sign in first if you want to view your order history.
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center shadow-sm">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 text-blue-600 mb-4">
              <Lock />
            </div>
            <div className="text-xl font-extrabold text-slate-900">No orders found</div>
            <div className="text-sm text-slate-600 mt-2">
              Current search/filter ke hisaab se koi order nahi mila.
            </div>
            <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-white border border-gray-200 font-extrabold hover:bg-gray-50"
              >
                Clear Filters
              </button>
              <Link
                href="/products"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-blue-600 text-white font-extrabold hover:bg-blue-700 transition"
              >
                Explore Products
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-5">
              {orders.map((o) => {
                const orderItems = Array.isArray(o.items) ? o.items : [];
                const hasPhysical =
                  Boolean(o?.hasPhysicalItem) || orderItems.some((it) => Boolean(it?.isPhysical));

                const orderStage = getHardcopyStage({
                  status: o?.shiprocket?.status,
                  awbCode: o?.shiprocket?.awbCode,
                  courierName: o?.shiprocket?.courierName,
                  shipmentId: o?.shiprocket?.shipmentId,
                  shiprocketOrderId: o?.shiprocket?.shiprocketOrderId,
                });

                return (
                  <div
                    key={o._id}
                    className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden"
                  >
                    <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:flex-wrap sm:items-start sm:justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-slate-500 uppercase">Order</div>
                        <div className="font-extrabold text-slate-900 break-all">
                          {safeStr(o.orderRef || o._id)}
                        </div>
                        <div className="text-xs text-slate-600 mt-1 font-semibold leading-5">
                          Paid: {fmtDate(o.paidAt)} {o.createdAt ? `• Created: ${fmtDate(o.createdAt)}` : ""}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <StatusPill status={safeStr(o.status) || "paid"} />
                          {hasPhysical ? <ShipmentPill status={safeStr(o?.shiprocket?.status)} /> : null}
                        </div>
                      </div>

                      <div className="text-left sm:text-right min-w-[180px]">
                        <div className="text-xs font-extrabold text-slate-500 uppercase">
                          Total Value
                        </div>
                        <div className="text-2xl font-extrabold text-slate-900">
                          ₹{money(Number(o.orderValue ?? o.totalAmount ?? 0))}
                        </div>
                        <div className="text-xs text-slate-600 font-semibold mt-1">
                          {safeStr(o.currency || "INR")}
                          {safeNum(o.walletUsedAmount, 0) > 0
                            ? ` • Wallet ₹${money(safeNum(o.walletUsedAmount, 0))}`
                            : ""}
                        </div>
                      </div>
                    </div>

                    {hasPhysical ? (
                      <div className="px-4 sm:px-5 pt-4 sm:pt-5">
                        <div className="rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-white p-4">
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                                <Truck size={16} />
                                Hardcopy Order Progress
                              </div>
                              <div className="mt-2 text-base font-extrabold text-slate-900">
                                {orderStage.title}
                              </div>
                              <div className="mt-2 text-sm font-semibold text-slate-700 leading-6">
                                {orderStage.description}
                              </div>
                              <div className="mt-2 text-xs font-extrabold uppercase tracking-wide text-orange-700">
                                {orderStage.timeline}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              <ShipmentPill status={safeStr(o?.shiprocket?.status)} />
                              {safeStr(o?.shiprocket?.awbCode) ? (
                                <span className="inline-flex items-center rounded-full bg-white border border-gray-200 px-3 py-1.5 text-xs font-extrabold text-slate-700">
                                  AWB: {safeStr(o?.shiprocket?.awbCode)}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="rounded-xl bg-white border border-gray-200 p-3">
                              <div className="text-[11px] uppercase font-extrabold text-slate-500">
                                Step 1
                              </div>
                              <div className="mt-1 text-sm font-extrabold text-slate-900">
                                Payment Confirmed
                              </div>
                              <div className="mt-1 text-xs font-semibold text-slate-600 leading-5">
                                Your order is safely recorded and linked to your account.
                              </div>
                            </div>

                            <div className="rounded-xl bg-white border border-gray-200 p-3">
                              <div className="text-[11px] uppercase font-extrabold text-slate-500">
                                Step 2
                              </div>
                              <div className="mt-1 text-sm font-extrabold text-slate-900">
                                Writing and Packing
                              </div>
                              <div className="mt-1 text-xs font-semibold text-slate-600 leading-5">
                                Preparation usually completes within 2 business days.
                              </div>
                            </div>

                            <div className="rounded-xl bg-white border border-gray-200 p-3">
                              <div className="text-[11px] uppercase font-extrabold text-slate-500">
                                Step 3
                              </div>
                              <div className="mt-1 text-sm font-extrabold text-slate-900">
                                Delivery After Dispatch
                              </div>
                              <div className="mt-1 text-xs font-semibold text-slate-600 leading-5">
                                Delivery usually takes 3–5 business days after dispatch.
                              </div>
                            </div>
                          </div>

                          {(safeStr(o?.shiprocket?.courierName) ||
                            safeStr(o?.shiprocket?.shiprocketOrderId) ||
                            safeStr(o?.shiprocket?.shipmentId)) && (
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="rounded-xl bg-white border border-gray-200 p-3">
                                <div className="text-[11px] uppercase font-extrabold text-slate-500">
                                  Courier
                                </div>
                                <div className="mt-1 text-sm font-extrabold text-slate-900 break-words">
                                  {safeStr(o?.shiprocket?.courierName) || "Will appear after dispatch"}
                                </div>
                              </div>

                              <div className="rounded-xl bg-white border border-gray-200 p-3">
                                <div className="text-[11px] uppercase font-extrabold text-slate-500">
                                  Shiprocket Order ID
                                </div>
                                <div className="mt-1 text-sm font-extrabold text-slate-900 break-all">
                                  {safeStr(o?.shiprocket?.shiprocketOrderId) || "Will appear after dispatch"}
                                </div>
                              </div>

                              <div className="rounded-xl bg-white border border-gray-200 p-3">
                                <div className="text-[11px] uppercase font-extrabold text-slate-500">
                                  Shipment ID
                                </div>
                                <div className="mt-1 text-sm font-extrabold text-slate-900 break-all">
                                  {safeStr(o?.shiprocket?.shipmentId) || "Will appear after dispatch"}
                                </div>
                              </div>
                            </div>
                          )}

                          {o?.shipping ? (
                            <div className="mt-4 rounded-xl bg-white border border-gray-200 p-3">
                              <div className="text-[11px] uppercase font-extrabold text-slate-500 flex items-center gap-2">
                                <MapPin size={13} />
                                Delivery Address
                              </div>
                              <div className="mt-1 text-sm font-semibold text-slate-800 leading-6">
                                {[safeStr(o.shipping?.address), safeStr(o.shipping?.city), safeStr(o.shipping?.state), safeStr(o.shipping?.pincode)]
                                  .filter(Boolean)
                                  .join(", ") || "—"}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    <div className="p-4 sm:p-5">
                      <div className="text-sm font-extrabold text-slate-900 flex items-center gap-2 mb-3">
                        <FileText size={16} className="text-blue-600" />
                        Items
                      </div>

                      <div className="space-y-3">
                        {orderItems.map((it, idx) => {
                          const combo = isComboItem(it);
                          const isPhysical = Boolean(it?.isPhysical);
                          const availability = normalizeAvailability(it?.currentAvailability);
                          const onDemand = availability === "on_demand";
                          const notReady = availability === "want_to_buy";

                          const itemStage = getHardcopyStage({
                            status: it?.shiprocketStatus || o?.shiprocket?.status,
                            awbCode: it?.shiprocketAwbCode || o?.shiprocket?.awbCode,
                            courierName: it?.shiprocketCourierName || o?.shiprocket?.courierName,
                            shipmentId: it?.shiprocketShipmentId || o?.shiprocket?.shipmentId,
                            shiprocketOrderId: it?.shiprocketOrderId || o?.shiprocket?.shiprocketOrderId,
                          });

                          const comboKey = `${safeStr(o._id)}-${safeStr(it.productId)}-${idx}`;
                          const comboItems = Array.isArray(it?.comboItems) ? it.comboItems : [];
                          const expanded = Boolean(expandedComboKeys[comboKey]);
                          const visibleComboItems = expanded ? comboItems : comboItems.slice(0, 4);

                          return (
                            <div
                              key={`${safeStr(it.productId)}-${idx}`}
                              className="rounded-2xl border border-gray-100 bg-gray-50 p-3 sm:p-4"
                            >
                              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                <div className="min-w-0 w-full">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="text-[11px] sm:text-xs font-bold text-blue-700 uppercase">
                                      {combo ? "Combo" : safeStr(it.category) || "Product"}
                                    </div>

                                    {combo ? (
                                      <span className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 text-[10px] sm:text-[11px] font-extrabold">
                                        {it.isBuilderCombo ? "Builder Combo" : "Saved Combo"}
                                      </span>
                                    ) : null}

                                    {safeStr(it.comboBadge) ? (
                                      <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 text-[10px] sm:text-[11px] font-extrabold">
                                        <BadgeCheck size={12} className="mr-1" />
                                        {safeStr(it.comboBadge)}
                                      </span>
                                    ) : null}

                                    {!combo && isPhysical ? (
                                      <span className="inline-flex items-center rounded-full bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1 text-[10px] sm:text-[11px] font-extrabold">
                                        <Truck size={12} className="mr-1" />
                                        Hardcopy
                                      </span>
                                    ) : null}

                                    {!combo && !isPhysical ? (
                                      <AvailabilityPill availability={availability} />
                                    ) : null}

                                    {!combo && isPhysical ? (
                                      <ShipmentPill
                                        status={safeStr(it?.shiprocketStatus || o?.shiprocket?.status)}
                                      />
                                    ) : null}
                                  </div>

                                  <div className="mt-2 font-extrabold text-slate-900 text-lg leading-7 break-words">
                                    {safeStr(it.title) || "Product"}
                                  </div>

                                  <div className="text-xs sm:text-sm text-slate-600 mt-1 font-semibold">
                                    Qty: {Math.max(1, safeNum(it.quantity, 1))} • ₹{money(safeNum(it.price, 0))}
                                  </div>

                                  {combo ? (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {safeStr(it.comboMediumLabel) ? (
                                        <span className="inline-flex items-center rounded-full bg-white border border-gray-200 px-2.5 py-1 text-[10px] sm:text-[11px] font-extrabold text-slate-700">
                                          <Languages size={12} className="mr-1" />
                                          {safeStr(it.comboMediumLabel)}
                                        </span>
                                      ) : null}

                                      {safeStr(it.comboSessionLabel) ? (
                                        <span className="inline-flex items-center rounded-full bg-white border border-gray-200 px-2.5 py-1 text-[10px] sm:text-[11px] font-extrabold text-slate-700">
                                          <CalendarClock size={12} className="mr-1" />
                                          {safeStr(it.comboSessionLabel)}
                                        </span>
                                      ) : null}

                                      {safeStr(it.comboSaveLabel) ? (
                                        <span className="inline-flex items-center rounded-full bg-orange-50 border border-orange-200 px-2.5 py-1 text-[10px] sm:text-[11px] font-extrabold text-orange-700">
                                          {safeStr(it.comboSaveLabel)}
                                        </span>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  {!combo && isPhysical ? (
                                    <div className="mt-3 rounded-2xl border border-orange-200 bg-orange-50 p-3 sm:p-4">
                                      <div className="text-sm sm:text-base font-extrabold text-orange-900 leading-6">
                                        {itemStage.title}
                                      </div>

                                      <div className="mt-2 text-xs sm:text-sm text-orange-800 font-semibold leading-6">
                                        {itemStage.description}
                                      </div>

                                      <div className="mt-3 rounded-xl border border-orange-200 bg-white px-3 py-3">
                                        <div className="text-[11px] uppercase font-extrabold tracking-wide text-orange-700">
                                          Delivery Flow
                                        </div>
                                        <div className="mt-1 text-xs sm:text-sm font-semibold text-slate-700 leading-6">
                                          Preparation usually completes within 2 business days. Delivery usually takes 3–5 business days after dispatch.
                                        </div>
                                      </div>

                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {safeStr(it?.shiprocketCourierName || o?.shiprocket?.courierName) ? (
                                          <span className="inline-flex items-center rounded-full bg-white border border-orange-200 px-2.5 py-1 text-[10px] sm:text-[11px] font-extrabold text-orange-800">
                                            Courier: {safeStr(it?.shiprocketCourierName || o?.shiprocket?.courierName)}
                                          </span>
                                        ) : null}

                                        {safeStr(it?.shiprocketAwbCode || o?.shiprocket?.awbCode) ? (
                                          <span className="inline-flex items-center rounded-full bg-white border border-orange-200 px-2.5 py-1 text-[10px] sm:text-[11px] font-extrabold text-orange-800">
                                            AWB: {safeStr(it?.shiprocketAwbCode || o?.shiprocket?.awbCode)}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                  ) : null}

                                  {!combo && onDemand ? (
                                    <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50 p-3 text-xs sm:text-sm font-semibold text-violet-800 leading-6">
                                      {safeStr(it.onDemandNote) ||
                                        `Your PDF is being prepared and usually gets delivered within ${Math.max(
                                          1,
                                          safeNum(it.deliverWithinMinutes, 20)
                                        )} minutes after payment.`}
                                    </div>
                                  ) : null}

                                  {!combo && notReady ? (
                                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs sm:text-sm font-semibold text-amber-800 leading-6">
                                      This material is not linked yet. Once uploaded, download will become active automatically.
                                    </div>
                                  ) : null}

                                  {combo && comboItems.length > 0 ? (
                                    <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-3">
                                      <div className="flex items-center gap-2 text-[11px] uppercase font-extrabold tracking-wide text-indigo-700">
                                        <Boxes size={13} />
                                        Included Combo Items
                                      </div>

                                      <div className="mt-2 space-y-2">
                                        {visibleComboItems.map((comboItem, comboIdx) => (
                                          <div
                                            key={`${safeStr(comboItem?.title)}-${comboIdx}`}
                                            className="rounded-xl border border-indigo-100 bg-white px-3 py-2"
                                          >
                                            <div className="text-sm font-extrabold text-slate-900 break-words">
                                              {safeStr(comboItem?.title) || "Untitled Item"}
                                            </div>
                                            {safeStr(comboItem?.subtitle) ? (
                                              <div className="mt-0.5 text-xs font-semibold text-slate-600 break-words">
                                                {safeStr(comboItem?.subtitle)}
                                              </div>
                                            ) : null}
                                          </div>
                                        ))}
                                      </div>

                                      {comboItems.length > 4 ? (
                                        <div className="mt-3">
                                          <button
                                            onClick={() =>
                                              setExpandedComboKeys((prev) => ({
                                                ...prev,
                                                [comboKey]: !prev[comboKey],
                                              }))
                                            }
                                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-indigo-200 text-indigo-700 font-extrabold text-sm"
                                          >
                                            {expanded ? "Show Less" : `See More (${comboItems.length - 4} more)`}
                                          </button>
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>

                                <div className="w-full md:w-auto md:min-w-[170px]">
                                  {combo ? (
                                    <div className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-500 font-extrabold">
                                      Combo Order
                                    </div>
                                  ) : isPhysical ? (
                                    <button
                                      onClick={() => openTracking(o, it)}
                                      className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-orange-600 text-white font-extrabold hover:bg-orange-700 transition"
                                    >
                                      <Truck size={16} />
                                      Track Order
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => download(it)}
                                      disabled={downloadingPid === safeStr(it.productId)}
                                      className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 text-white font-extrabold hover:bg-blue-700 transition disabled:opacity-60"
                                    >
                                      {downloadingPid === safeStr(it.productId) ? (
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

                      <div className="mt-4 text-[11px] text-slate-500 font-semibold leading-5">
                        Digital items can be downloaded here. Hardcopy items show preparation first, and dispatch tracking becomes live after shipment activation.
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <PaginationBar
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </div>

      {processingMsg ? (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setProcessingMsg(null)} />
          <div className="relative w-full max-w-xl rounded-3xl bg-white border border-gray-200 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-extrabold">Product Preparation Status</div>
                <div className="text-sm text-slate-600">{processingMsg.title}</div>
              </div>
              <button
                onClick={() => setProcessingMsg(null)}
                className="h-10 w-10 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white flex items-center justify-center"
              >
                <X />
              </button>
            </div>

            <div className="p-5">
              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                <div className="text-sm font-extrabold text-violet-900">Please wait a little</div>
                <div className="mt-2 text-sm text-violet-800 font-semibold leading-6">
                  {processingMsg.message}
                </div>

                {safeNum(processingMsg.remainingSeconds, 0) > 0 ? (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white border border-violet-200 p-3">
                      <div className="text-[11px] uppercase font-extrabold text-violet-700">
                        Remaining Seconds
                      </div>
                      <div className="mt-1 text-2xl font-extrabold text-violet-900">
                        {safeNum(processingMsg.remainingSeconds, 0)}
                      </div>
                    </div>

                    <div className="rounded-xl bg-white border border-violet-200 p-3">
                      <div className="text-[11px] uppercase font-extrabold text-violet-700">
                        ETA
                      </div>
                      <div className="mt-1 text-sm font-extrabold text-slate-900">
                        {processingMsg.etaAt ? fmtDate(processingMsg.etaAt) : "Shortly"}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setProcessingMsg(null)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white font-bold"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tracking ? (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setTracking(null)} />
          <div className="relative w-full max-w-2xl rounded-3xl bg-white border border-gray-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-extrabold">Track Hardcopy Order</div>
                <div className="text-sm text-slate-600 break-words">{tracking.itemTitle}</div>
              </div>
              <button
                onClick={() => setTracking(null)}
                className="h-10 w-10 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white flex items-center justify-center"
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
                  <div className="mt-1 text-sm font-extrabold text-slate-900">
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
                <div className="mt-2 text-sm text-slate-700 font-semibold leading-6">
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
                onClick={() => {
                  setTracking(null);
                  setLoading(true);
                  void fetchOrders({
                    nextPage: pagination.page,
                    nextSearch: appliedSearch,
                    nextType: typeFilter,
                  }).finally(() => setLoading(false));
                }}
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