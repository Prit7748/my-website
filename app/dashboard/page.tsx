"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import TopBar from "../../components/TopBar";
import {
  LogOut,
  UserCircle2,
  ShieldCheck,
  Mail,
  IdCard,
  CalendarDays,
  ArrowRight,
  ShoppingBag,
  BookOpen,
  FileText,
  LifeBuoy,
  LayoutDashboard,
  FolderOpen,
  Receipt,
  X,
  Grid3X3,
  KeyRound,
  Eye,
  EyeOff,
  Download,
  Clock4,
  BadgeCheck,
  Loader2,
  TimerReset,
  Sparkles,
  RefreshCcw,
  AlertTriangle,
  MessageCircle,
  PhoneCall,
  CheckCircle2,
  Search,
  ChevronLeft,
  ChevronRight,
  Truck,
  PackageCheck,
  MapPin,
} from "lucide-react";

import ResellerOverviewSection from "@/components/dashboard/ResellerOverviewSection";

type User = {
  _id?: string;
  id?: string;
  name?: string;
  email: string;
  role: string;
  createdAt?: string;
  reseller?: {
    isReseller?: boolean;
    status?: string;
    planCode?: "" | "basic" | "standard" | "premium";
    planName?: string;
    walletBalance?: number;
    walletTotalRecharged?: number;
    walletTotalUsed?: number;
    walletTotalDiscountSaved?: number;
  };
};

type Category = {
  title: string;
  desc: string;
  href: string;
  icon: any;
};

type PurchasedItem = {
  orderId: string;
  status: "pending" | "paid" | "failed" | "refunded" | "cancelled" | string;
  currency: string;
  paidAt: string | null;
  expiresAt: string | null;
  productId: string;
  title: string;
  category: string;
  price: number;
  currentAvailability?: "available" | "on_demand" | "want_to_buy" | string;
  deliverWithinMinutes?: number;
  onDemandNote?: string;

  shiprocketStatus?: string;
  shiprocketMessage?: string;
  shiprocketOrderId?: string;
  shiprocketShipmentId?: string;
  shiprocketAwbCode?: string;
  shiprocketCourierName?: string;
  shiprocketSyncedAt?: string;

  shippingAddress?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPincode?: string;
};

type PurchasedListResponse = {
  ok: boolean;
  items: PurchasedItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  q?: string;
};

type DownloadResp =
  | { ok: true; url: string; expiresIn: number }
  | {
      ok: false;
      status: "processing" | "not_ready" | string;
      availability?: "on_demand" | "want_to_buy" | "available" | string;
      message?: string;
      paidAt?: string;
      etaAt?: string;
      remainingSeconds?: number;
    };

type TrackingModalState = {
  orderId: string;
  title: string;
  category: string;
  paidAt?: string | null;
  shipmentStatus?: string;
  shipmentMessage?: string;
  courierName?: string;
  awbCode?: string;
  shiprocketOrderId?: string;
  shipmentId?: string;
  syncedAt?: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPincode?: string;
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

function money(n: number) {
  try {
    return new Intl.NumberFormat("en-IN").format(Number(n || 0));
  } catch {
    return String(n);
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

function fmtShort(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN");
  } catch {
    return d;
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
  return "processing";
}

function isHardcopyLike(item: PurchasedItem) {
  const c = safeStr(item?.category).toLowerCase();
  const t = safeStr(item?.title).toLowerCase();
  return c.includes("hardcopy") || c.includes("delivery") || t.includes("hardcopy");
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
      "Your hardcopy order is under active preparation. Handwriting, checking and packing usually complete within 2 business days.",
    timeline:
      "After dispatch, delivery usually takes 3–5 business days depending on location.",
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyLogout, setBusyLogout] = useState(false);

  const [moreOpen, setMoreOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);

  const [pwdLoading, setPwdLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [pwdForm, setPwdForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [purchasedLoading, setPurchasedLoading] = useState(false);
  const [purchased, setPurchased] = useState<PurchasedItem[]>([]);
  const [purchasedTotal, setPurchasedTotal] = useState(0);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<PurchasedItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historySearchInput, setHistorySearchInput] = useState("");

  const [downloadingPid, setDownloadingPid] = useState<string>("");

  const [processingOpen, setProcessingOpen] = useState(false);
  const [processing, setProcessing] = useState<{
    title: string;
    message: string;
    availability: string;
    etaAt?: string;
    remainingSeconds: number;
    paidAt?: string;
  } | null>(null);

  const [trackingOpen, setTrackingOpen] = useState(false);
  const [tracking, setTracking] = useState<TrackingModalState | null>(null);

  const siteName = safeStr(process.env.NEXT_PUBLIC_SITE_NAME) || "our website";
  const whatsappLink =
    safeStr(process.env.NEXT_PUBLIC_WHATSAPP_LINK) ||
    "https://wa.me/917496865680";
  const supportEmail =
    safeStr(process.env.NEXT_PUBLIC_SUPPORT_EMAIL) ||
    safeStr(user?.email) ||
    "support@istudentsportal.com";

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        setUser(data.user);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function fetchPurchasedList(args: { limit: number; page: number; q?: string }) {
    const qs = new URLSearchParams();
    qs.set("limit", String(args.limit));
    qs.set("page", String(args.page));
    if (safeStr(args.q)) qs.set("q", safeStr(args.q));

    const res = await fetch(`/api/orders/mine?${qs.toString()}`, {
      credentials: "include",
      cache: "no-store",
    });

    const data: PurchasedListResponse = await res.json().catch(() => ({
      ok: false,
      items: [],
      total: 0,
      page: 1,
      pageSize: args.limit,
      totalPages: 1,
    }));

    if (!res.ok || !data?.ok) {
      throw new Error("Failed to load purchases");
    }

    return data;
  }

  async function reloadPurchased() {
    setPurchasedLoading(true);
    try {
      const data = await fetchPurchasedList({ limit: 10, page: 1 });
      setPurchased(Array.isArray(data?.items) ? data.items : []);
      setPurchasedTotal(Number(data?.total || 0));
    } catch {
      setPurchased([]);
      setPurchasedTotal(0);
    } finally {
      setPurchasedLoading(false);
    }
  }

  async function loadHistory(page = 1, q = historySearchInput) {
    setHistoryLoading(true);
    try {
      const data = await fetchPurchasedList({ limit: 20, page, q });
      setHistoryItems(Array.isArray(data?.items) ? data.items : []);
      setHistoryTotal(Number(data?.total || 0));
      setHistoryPage(Number(data?.page || 1));
      setHistoryTotalPages(Number(data?.totalPages || 1));
    } catch {
      setHistoryItems([]);
      setHistoryTotal(0);
      setHistoryPage(1);
      setHistoryTotalPages(1);
    } finally {
      setHistoryLoading(false);
    }
  }

  function openHistoryModal() {
    setHistorySearchInput("");
    setHistoryPage(1);
    setHistoryOpen(true);
  }

  useEffect(() => {
    if (loading) return;
    void reloadPurchased();
  }, [loading]);

  useEffect(() => {
    if (!historyOpen) return;

    const timer = setTimeout(() => {
      void loadHistory(historyPage, historySearchInput);
    }, 250);

    return () => clearTimeout(timer);
  }, [historyOpen, historyPage, historySearchInput]);

  useEffect(() => {
    if (!processingOpen || !processing) return;
    const t = setInterval(() => {
      setProcessing((p) => {
        if (!p) return p;
        return { ...p, remainingSeconds: Math.max(0, (p.remainingSeconds || 0) - 1) };
      });
    }, 1000);
    return () => clearInterval(t);
  }, [processingOpen, processing?.remainingSeconds]);

  async function logout() {
    setBusyLogout(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      router.push("/login");
      router.refresh();
    } finally {
      setBusyLogout(false);
    }
  }

  const categories: Category[] = useMemo(
    () => [
      { title: "Solved Assignments", desc: "Direct access to solved PDFs.", href: "/solved-assignments", icon: FileText },
      { title: "Ebooks", desc: "Your ebooks & downloads.", href: "/ebooks", icon: BookOpen },
      { title: "Handwritten PDFs", desc: "Notes & handwritten solutions.", href: "/handwritten-pdfs", icon: FolderOpen },
      { title: "Question Papers", desc: "Previous year papers.", href: "/question-papers", icon: ShoppingBag },
      { title: "Guess Papers", desc: "Important guess papers.", href: "/guess-papers", icon: FileText },
      { title: "Combo", desc: "Bundle products & packs.", href: "/combo", icon: Grid3X3 },
      { title: "Handwritten Hardcopy", desc: "Physical handwritten copies.", href: "/handwritten-hardcopy", icon: Truck },
      { title: "projects", desc: "projects reports & files.", href: "/projects", icon: FolderOpen },
    ],
    []
  );

  const primaryCards = categories.slice(0, 4);
  const extraCards = categories.slice(4);

  const displayId = user?._id || user?.id || "-";
  const displayName = user?.name || "Student";
  const joined = user?.createdAt ? new Date(user.createdAt).toLocaleString("en-IN") : "—";
  const role = (user?.role || "user").toLowerCase();

  const processingIsOnDemand = normalizeAvailability(processing?.availability) === "on_demand";
  const processingCountdownEnded = Number(processing?.remainingSeconds || 0) <= 0;

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

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();

    if (!pwdForm.currentPassword || !pwdForm.newPassword || !pwdForm.confirmPassword) {
      alert("Please fill all fields.");
      return;
    }
    if (pwdForm.newPassword.length < 6) {
      alert("New password must be at least 6 characters.");
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      alert("New password and confirm password do not match.");
      return;
    }

    setPwdLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword: pwdForm.currentPassword,
          newPassword: pwdForm.newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || "Password change failed");
        return;
      }

      alert("Password changed successfully ✅");
      setPwdForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPwdOpen(false);
    } catch {
      alert("Server error. Try again.");
    } finally {
      setPwdLoading(false);
    }
  }

  async function handleDownload(item: PurchasedItem) {
    const pid = safeStr(item.productId);
    if (!pid) return;

    setDownloadingPid(pid);
    try {
      const res = await fetch(`/api/products/download?productId=${encodeURIComponent(pid)}&download=1`, {
        credentials: "include",
        cache: "no-store",
      });

      const data: DownloadResp = await res.json().catch(() => ({} as any));

      if (res.ok && (data as any)?.ok && (data as any)?.url) {
        window.open((data as any).url, "_blank", "noopener,noreferrer");
        return;
      }

      const status = safeStr((data as any)?.status) || "not_ready";
      const availability =
        normalizeAvailability((data as any)?.availability) ||
        normalizeAvailability(item.currentAvailability) ||
        "available";

      let msg =
        safeStr((data as any)?.message) ||
        "Your purchase is confirmed. Please try again shortly.";

      if (availability === "on_demand" && !safeStr((data as any)?.message)) {
        msg =
          safeStr(item.onDemandNote) ||
          "Your material is being prepared. It will be available in your dashboard shortly after upload.";
      }

      const remainingSeconds = Number((data as any)?.remainingSeconds ?? 0);
      const etaAt = safeStr((data as any)?.etaAt);

      setProcessing({
        title: safeStr(item.title) || "Your Material",
        message: msg,
        availability,
        etaAt: etaAt || undefined,
        remainingSeconds: Number.isFinite(remainingSeconds) ? remainingSeconds : 0,
        paidAt: safeStr((data as any)?.paidAt || item.paidAt || ""),
      });

      setProcessingOpen(true);

      if (status === "processing" && availability === "on_demand") {
        setTimeout(() => {
          void reloadPurchased();
          if (historyOpen) {
            void loadHistory(historyPage, historySearchInput);
          }
        }, 1200);
      }
    } catch {
      alert("Download request failed. Please try again.");
    } finally {
      setDownloadingPid("");
    }
  }

  function openTracking(item: PurchasedItem) {
    const stage = getHardcopyStage({
      status: item.shiprocketStatus,
      awbCode: item.shiprocketAwbCode,
      courierName: item.shiprocketCourierName,
      shipmentId: item.shiprocketShipmentId,
      shiprocketOrderId: item.shiprocketOrderId,
    });

    setTracking({
      orderId: safeStr(item.orderId),
      title: safeStr(item.title),
      category: safeStr(item.category),
      paidAt: item.paidAt,
      shipmentStatus: safeStr(item.shiprocketStatus),
      shipmentMessage:
        safeStr(item.shiprocketMessage) ||
        stage.description,
      courierName: safeStr(item.shiprocketCourierName),
      awbCode: safeStr(item.shiprocketAwbCode),
      shiprocketOrderId: safeStr(item.shiprocketOrderId),
      shipmentId: safeStr(item.shiprocketShipmentId),
      syncedAt: safeStr(item.shiprocketSyncedAt),
      shippingAddress: safeStr(item.shippingAddress),
      shippingCity: safeStr(item.shippingCity),
      shippingState: safeStr(item.shippingState),
      shippingPincode: safeStr(item.shippingPincode),
    });
    setTrackingOpen(true);
  }

  function CategoryCard({ c, small }: { c: Category; small?: boolean }) {
    const Icon = c.icon;
    return (
      <Link
        href={c.href}
        className={`group rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white transition p-4 shadow-sm ${
          small ? "p-4" : ""
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="h-10 w-10 rounded-2xl bg-white border border-gray-200 flex items-center justify-center">
            <Icon className="text-slate-700" size={20} />
          </div>
          <ArrowRight className="opacity-50 group-hover:opacity-100 transition" size={18} />
        </div>
        <div className="mt-3 font-extrabold">{c.title}</div>
        <div className="text-xs text-slate-600 mt-1">{c.desc}</div>
      </Link>
    );
  }

  function StatusPill({ status }: { status: string }) {
    const s = safeStr(status).toLowerCase();
    const base = "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold border";
    if (s === "paid") {
      return (
        <span className={`${base} bg-emerald-50 border-emerald-200 text-emerald-800`}>
          <BadgeCheck size={14} /> PAID
        </span>
      );
    }
    if (s === "pending") {
      return (
        <span className={`${base} bg-amber-50 border-amber-200 text-amber-800`}>
          <Clock4 size={14} /> PENDING
        </span>
      );
    }
    if (s === "failed") {
      return (
        <span className={`${base} bg-red-50 border-red-200 text-red-700`}>
          <X size={14} /> FAILED
        </span>
      );
    }
    return <span className={`${base} bg-slate-50 border-slate-200 text-slate-700`}>{s.toUpperCase()}</span>;
  }

  function AvailabilityPill({ availability }: { availability?: string }) {
    const a = normalizeAvailability(availability);
    if (a === "on_demand") {
      return (
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold border bg-violet-50 border-violet-200 text-violet-800">
          <TimerReset size={14} />
          ON DEMAND
        </span>
      );
    }
    if (a === "want_to_buy") {
      return (
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold border bg-amber-50 border-amber-200 text-amber-800">
          <Clock4 size={14} />
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
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold border bg-orange-50 border-orange-200 text-orange-800">
        <Clock4 size={14} />
        PREPARING
      </span>
    );
  }

  function PurchasedCard({ it, compact = false }: { it: PurchasedItem; compact?: boolean }) {
    const availability = normalizeAvailability(it.currentAvailability);
    const isOnDemand = availability === "on_demand";
    const isWaiting = availability === "want_to_buy";
    const isHardcopy = isHardcopyLike(it);
    const etaMinutes = Math.max(1, Number(it.deliverWithinMinutes || 20));

    const hardcopyStage = getHardcopyStage({
      status: it.shiprocketStatus,
      awbCode: it.shiprocketAwbCode,
      courierName: it.shiprocketCourierName,
      shipmentId: it.shiprocketShipmentId,
      shiprocketOrderId: it.shiprocketOrderId,
    });

    return (
      <div
        className={`rounded-2xl bg-white border p-4 shadow-sm ${
          isHardcopy
            ? "border-orange-200"
            : isOnDemand
            ? "border-violet-200"
            : isWaiting
            ? "border-amber-200"
            : "border-gray-200"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-extrabold text-slate-900 line-clamp-2">
              {safeStr(it.title) || "Purchased Item"}
            </div>
            <div className="mt-1 text-xs font-bold text-slate-600">
              {safeStr(it.category) || "Product"} • ₹{money(Number(it.price || 0))} • Bought: {fmtShort(it.paidAt)}
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <StatusPill status={it.status} />
              {isHardcopy ? (
                <ShipmentPill status={it.shiprocketStatus} />
              ) : (
                <AvailabilityPill availability={availability} />
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 text-xs text-slate-500 font-semibold">
          Access till: <b className="text-slate-700">{fmtShort(it.expiresAt)}</b>
        </div>

        {isHardcopy ? (
          <div className="mt-3 rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-white p-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
                <Truck size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-orange-900">
                  {hardcopyStage.title}
                </div>
                <div className="text-xs text-orange-800 font-semibold mt-1 leading-5">
                  {hardcopyStage.description}
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="rounded-xl border border-orange-200 bg-white px-3 py-2">
                <div className="text-[11px] uppercase font-extrabold tracking-wide text-orange-700">
                  Stage 1
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-700 leading-5">
                  Payment confirmed
                </div>
              </div>

              <div className="rounded-xl border border-orange-200 bg-white px-3 py-2">
                <div className="text-[11px] uppercase font-extrabold tracking-wide text-orange-700">
                  Stage 2
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-700 leading-5">
                  Writing and packing within 2 business days
                </div>
              </div>

              <div className="rounded-xl border border-orange-200 bg-white px-3 py-2">
                <div className="text-[11px] uppercase font-extrabold tracking-wide text-orange-700">
                  Stage 3
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-700 leading-5">
                  Delivery in 3–5 business days after dispatch
                </div>
              </div>
            </div>

            {(safeStr(it.shiprocketCourierName) || safeStr(it.shiprocketAwbCode)) ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {safeStr(it.shiprocketCourierName) ? (
                  <span className="inline-flex items-center rounded-full bg-white border border-orange-200 px-2.5 py-1 text-[11px] font-extrabold text-orange-800">
                    Courier: {safeStr(it.shiprocketCourierName)}
                  </span>
                ) : null}

                {safeStr(it.shiprocketAwbCode) ? (
                  <span className="inline-flex items-center rounded-full bg-white border border-orange-200 px-2.5 py-1 text-[11px] font-extrabold text-orange-800">
                    AWB: {safeStr(it.shiprocketAwbCode)}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {isOnDemand && !isHardcopy ? (
          <div className="mt-3 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-white p-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                <Sparkles size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-violet-900">
                  On-demand delivery in progress
                </div>
                <div className="text-xs text-violet-800 font-semibold mt-1 leading-5">
                  {safeStr(it.onDemandNote) ||
                    `Your PDF is being prepared and is usually delivered within ${etaMinutes} minutes after payment.`}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {isWaiting && !isHardcopy ? (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800 leading-5">
            This material is not linked yet. Once it is uploaded, download will become active automatically.
          </div>
        ) : null}

        {!isOnDemand && !isWaiting && !isHardcopy ? (
          <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <div className="text-sm font-extrabold text-emerald-900">
                  Ready for instant access
                </div>
                <div className="text-xs text-emerald-800 font-semibold mt-1 leading-5">
                  Your file is already linked and can be downloaded immediately.
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className={`mt-4 flex items-center ${compact ? "justify-between" : "gap-2"} flex-wrap`}>
          {isHardcopy ? (
            <button
              onClick={() => openTracking(it)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 text-white font-extrabold hover:bg-orange-700 transition"
            >
              <Truck size={18} />
              Track Hardcopy
            </button>
          ) : (
            <button
              disabled={safeStr(it.status).toLowerCase() !== "paid" || downloadingPid === it.productId}
              onClick={() => handleDownload(it)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white transition font-extrabold disabled:opacity-60 ${
                isOnDemand
                  ? "bg-violet-700 hover:bg-violet-800"
                  : "bg-slate-900 hover:bg-slate-950"
              }`}
            >
              {downloadingPid === it.productId ? (
                <Loader2 className="animate-spin" size={18} />
              ) : isOnDemand ? (
                <TimerReset size={18} />
              ) : (
                <Download size={18} />
              )}
              {isOnDemand ? "Track PDF" : "Download"}
            </button>
          )}

          <div className="text-xs text-slate-500 font-semibold">
            Order: <span className="font-bold text-slate-700">{safeStr(it.orderId).slice(-8)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <TopBar />
      <Navbar />

      <div className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute top-10 right-0 h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 pt-10 pb-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                <LayoutDashboard className="text-slate-700" />
              </div>
              <div>
                <div className="text-2xl md:text-3xl font-extrabold tracking-tight">Dashboard</div>
                <div className="mt-1 text-slate-600">Manage your account, orders, downloads, and hardcopy tracking.</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <ArrowRight className="rotate-180" size={18} />
                Back to Home
              </Link>

              <button
                onClick={logout}
                disabled={busyLogout}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 transition font-bold text-white shadow-sm"
              >
                <LogOut size={18} />
                {busyLogout ? "Logging out..." : "Logout"}
              </button>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
              <div className="text-xs uppercase font-bold text-slate-500">Account</div>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center">
                  <UserCircle2 className="text-slate-700" />
                </div>
                <div className="min-w-0">
                  <div className="font-extrabold truncate">{loading ? "Loading..." : displayName}</div>
                  <div className="text-sm text-slate-600 truncate">{loading ? "—" : user?.email}</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
              <div className="text-xs uppercase font-bold text-slate-500">Role</div>
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-bold">
                <ShieldCheck size={16} />
                {loading ? "—" : role.toUpperCase()}
              </div>
              <div className="mt-2 text-sm text-slate-600">
                {role === "admin" ? "You have admin access." : "Standard student access."}
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
              <div className="text-xs uppercase font-bold text-slate-500">Joined</div>
              <div className="mt-3 flex items-center gap-2 font-bold">
                <CalendarDays size={18} className="text-slate-500" />
                <span className="text-slate-900">{loading ? "Loading..." : joined}</span>
              </div>
              <div className="mt-2 text-sm text-slate-600">Keep your profile updated for smooth support.</div>
            </div>
          </div>

          <ResellerOverviewSection user={user} loading={loading} />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-12">
        <div className="mt-2 rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-lg font-extrabold flex items-center gap-2">
                <Receipt className="text-slate-700" size={20} />
                Your Orders
              </div>
              <div className="text-sm text-slate-600 mt-1">
                The latest 10 purchased items appear here. Digital downloads and hardcopy order progress are both available from this section.
              </div>
            </div>

            <div className="flex items-center gap-2">
              {extraCards.length > 0 ? (
                <button
                  onClick={() => setMoreOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
                >
                  <Grid3X3 size={18} />
                  More
                </button>
              ) : null}

              <Link
                href="/orders"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-semibold shadow-sm"
              >
                View Orders
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-extrabold text-slate-900">Purchased Items</div>
                <div className="text-xs text-slate-600 font-semibold mt-1">
                  Your latest 10 purchased products appear here. Use See More for full history and search.
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {purchasedTotal > 10 ? (
                  <button
                    onClick={openHistoryModal}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-bold shadow-sm"
                  >
                    See More
                    <ArrowRight size={17} />
                  </button>
                ) : null}

                <button
                  onClick={reloadPurchased}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold shadow-sm"
                >
                  {purchasedLoading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCcw size={18} />}
                  Refresh
                </button>
              </div>
            </div>

            {purchasedLoading ? (
              <div className="mt-4 text-sm font-semibold text-slate-600">Loading purchases...</div>
            ) : purchased.length === 0 ? (
              <div className="mt-4 text-sm font-semibold text-slate-600">
                No purchases found yet. Once you pay, your items will appear here.
              </div>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {purchased.map((it) => (
                    <PurchasedCard key={`${it.orderId}-${it.productId}`} it={it} />
                  ))}
                </div>

                {purchasedTotal > 10 ? (
                  <div className="mt-4 flex items-center justify-center">
                    <button
                      onClick={openHistoryModal}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-extrabold shadow-sm"
                    >
                      See More Purchased Products
                      <ArrowRight size={18} />
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-4">
            {primaryCards.map((c) => (
              <CategoryCard key={c.href} c={c} />
            ))}
          </div>

          <div className="mt-5 rounded-2xl bg-gray-50 border border-gray-200 p-4">
            <div className="text-xs font-bold uppercase text-slate-500">Note</div>
            <div className="mt-1 text-sm text-slate-700">
              Hardcopy orders now show a preparation-first progress experience so customers understand that writing, checking and packing begin before dispatch tracking becomes active.
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-3xl bg-white border border-gray-200 overflow-hidden shadow-sm">
            <div className="p-7 md:p-8">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-lg md:text-xl font-extrabold">Profile Details</div>
                  <div className="text-sm text-slate-600 mt-1">Update your profile settings.</div>
                </div>

                <button
                  onClick={() => setPwdOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold shadow-sm"
                >
                  <KeyRound size={18} />
                  Change Password
                </button>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl bg-gray-50 border border-gray-200 p-5">
                  <div className="flex items-center gap-2 text-xs uppercase font-bold text-slate-500">
                    <Mail size={16} />
                    Email
                  </div>
                  <div className="mt-2 font-semibold break-all">{loading ? "Loading..." : user?.email || "-"}</div>
                </div>

                <div className="rounded-2xl bg-gray-50 border border-gray-200 p-5">
                  <div className="flex items-center gap-2 text-xs uppercase font-bold text-slate-500">
                    <IdCard size={16} />
                    User ID
                  </div>
                  <div className="mt-2 font-semibold break-all">{loading ? "Loading..." : displayId}</div>
                </div>

                <div className="rounded-2xl bg-gray-50 border border-gray-200 p-5 md:col-span-2">
                  <div className="flex items-center gap-2 text-xs uppercase font-bold text-slate-500">
                    <UserCircle2 size={16} />
                    Name
                  </div>
                  <div className="mt-2 font-semibold">{loading ? "Loading..." : displayName}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white border border-gray-200 overflow-hidden shadow-sm">
            <div className="p-7">
              <div className="text-lg font-extrabold">Support</div>
              <div className="text-sm text-slate-600 mt-1">Need help? We’re here.</div>

              <div className="mt-5 space-y-3">
                <Link
                  href="/contact"
                  className="group block rounded-2xl bg-gray-50 border border-gray-200 p-4 hover:bg-white transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <LifeBuoy className="text-slate-700" size={20} />
                      <div>
                        <div className="font-bold">Contact Support</div>
                        <div className="text-xs text-slate-600 mt-1">Questions? Message us.</div>
                      </div>
                    </div>
                    <ArrowRight size={18} className="opacity-50 group-hover:opacity-100 transition" />
                  </div>
                </Link>

                <Link
                  href="/refund-policy"
                  className="group block rounded-2xl bg-gray-50 border border-gray-200 p-4 hover:bg-white transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="text-slate-700" size={20} />
                      <div>
                        <div className="font-bold">Refund Policy</div>
                        <div className="text-xs text-slate-600 mt-1">Read refund rules.</div>
                      </div>
                    </div>
                    <ArrowRight size={18} className="opacity-50 group-hover:opacity-100 transition" />
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {historyOpen ? (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setHistoryOpen(false)} />
          <div className="relative w-full max-w-6xl rounded-3xl bg-white border border-gray-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-extrabold">All Purchased Products</div>
                <div className="text-sm text-slate-600">
                  Search your downloads and browse all purchased items with pagination.
                </div>
              </div>
              <button
                onClick={() => setHistoryOpen(false)}
                className="h-10 w-10 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white flex items-center justify-center"
              >
                <X />
              </button>
            </div>

            <div className="p-5 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[240px]">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={historySearchInput}
                    onChange={(e) => {
                      setHistorySearchInput(e.target.value);
                      setHistoryPage(1);
                    }}
                    placeholder="Search by product name, category, order id"
                    className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-200 outline-none focus:border-slate-500 bg-white text-slate-800 font-medium"
                  />
                </div>

                <button
                  onClick={() => void loadHistory(historyPage, historySearchInput)}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold shadow-sm"
                >
                  {historyLoading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCcw size={18} />}
                  Refresh
                </button>
              </div>

              <div className="mt-3 text-sm text-slate-600 font-semibold">
                Total results: <b>{historyTotal}</b> • Page <b>{historyPage}</b> of <b>{historyTotalPages}</b>
              </div>
            </div>

            <div className="p-5 overflow-y-auto">
              {historyLoading ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-slate-600 font-semibold">
                  Loading purchased products...
                </div>
              ) : historyItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
                  <div className="text-xl font-extrabold text-slate-900">No purchased products found</div>
                  <div className="mt-2 text-sm text-slate-600 font-semibold">
                    Try changing your search and refresh again.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {historyItems.map((it) => (
                    <PurchasedCard key={`${it.orderId}-${it.productId}-history`} it={it} compact />
                  ))}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-200 bg-white">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm text-slate-600 font-semibold">
                  Showing page <b>{historyPage}</b> of <b>{historyTotalPages}</b>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    disabled={historyPage <= 1 || historyLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-bold disabled:opacity-50"
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>

                  <div className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-extrabold">
                    {historyPage}
                  </div>

                  <button
                    onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                    disabled={historyPage >= historyTotalPages || historyLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-bold disabled:opacity-50"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {processingOpen && processing ? (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setProcessingOpen(false)}
          />
          <div className="relative w-full max-w-2xl rounded-3xl bg-white border border-gray-200 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <div className="text-lg font-extrabold">
                  {processingIsOnDemand ? "Preparing Your On-Demand PDF" : "Preparing Your PDF"}
                </div>
                <div className="text-sm text-slate-600">{processing.title}</div>
              </div>
              <button
                onClick={() => setProcessingOpen(false)}
                className="h-10 w-10 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white flex items-center justify-center"
              >
                <X />
              </button>
            </div>

            <div className="p-5">
              <div
                className={`rounded-2xl p-4 shadow-sm border ${
                  processingIsOnDemand
                    ? "border-violet-200 bg-gradient-to-r from-violet-50 to-white"
                    : "border-emerald-100 bg-gradient-to-r from-emerald-50 to-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`rounded-xl p-2 ${
                      processingIsOnDemand
                        ? "bg-violet-100 text-violet-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    <Clock4 size={18} />
                  </div>

                  <div className="flex-1">
                    <div className="text-base font-extrabold text-slate-900">
                      {processingIsOnDemand
                        ? "Your material is being prepared"
                        : "Your PDF is not ready yet"}
                    </div>

                    <div className="mt-1 text-sm text-slate-700 font-semibold leading-relaxed">
                      {processing.message}
                    </div>

                    {processingIsOnDemand ? (
                      <>
                        {!processingCountdownEnded ? (
                          <>
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="rounded-2xl bg-white border border-violet-200 px-4 py-3">
                                <div className="text-[11px] uppercase tracking-wide font-extrabold text-violet-700">
                                  Live Countdown
                                </div>
                                <div className="mt-1 text-2xl font-extrabold text-violet-900">
                                  {secToClock(processing.remainingSeconds || 0)}
                                </div>
                              </div>

                              <div className="rounded-2xl bg-white border border-violet-200 px-4 py-3">
                                <div className="text-[11px] uppercase tracking-wide font-extrabold text-violet-700">
                                  Expected Delivery Time
                                </div>
                                <div className="mt-1 text-sm font-extrabold text-slate-900">
                                  {processing.etaAt ? fmtDate(processing.etaAt) : "Calculating..."}
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
                              <div className="text-sm font-extrabold text-violet-900">
                                What happens next?
                              </div>
                              <div className="mt-2 text-xs text-violet-800 font-semibold leading-6">
                                1. Our team uploads your PDF.
                                <br />
                                2. Your order remains safely linked to your account.
                                <br />
                                3. A product-ready message is sent to your email.
                                <br />
                                4. Your dashboard download starts working as soon as upload is completed.
                              </div>
                            </div>

                            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
                              <div className="flex items-start gap-3">
                                <div className="rounded-xl bg-blue-100 text-blue-700 p-2">
                                  <Mail size={16} />
                                </div>
                                <div>
                                  <div className="text-sm font-extrabold text-blue-900">
                                    Email confirmation will also be sent
                                  </div>
                                  <div className="mt-1 text-xs text-blue-800 font-semibold leading-6">
                                    As soon as your on-demand product is uploaded, the ready link will also be sent to your registered email so you can access it easily later.
                                  </div>
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                              <div className="flex items-start gap-3">
                                <div className="rounded-xl bg-amber-100 text-amber-700 p-2">
                                  <AlertTriangle size={18} />
                                </div>
                                <div>
                                  <div className="text-base font-extrabold text-amber-900">
                                    Your file is taking a little longer than expected
                                  </div>
                                  <div className="mt-1 text-sm text-amber-800 font-semibold leading-6">
                                    Please do not worry. Your payment is safe, your order is confirmed, and our team has already been notified. We are still preparing your product and it will be uploaded as soon as possible.
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <a
                                href={whatsappLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-extrabold px-4 py-3 transition"
                              >
                                <MessageCircle size={18} />
                                WhatsApp Support
                              </a>

                              <Link
                                href="/contact"
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 text-slate-800 font-extrabold px-4 py-3 transition"
                              >
                                <PhoneCall size={18} />
                                Contact Support
                              </Link>
                            </div>

                            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                              <div className="text-sm font-extrabold text-slate-900">
                                Why you can still trust this order
                              </div>
                              <div className="mt-2 text-xs text-slate-700 font-semibold leading-6">
                                • Your payment has already been verified successfully.
                                <br />
                                • Your order remains linked to your account on {siteName}.
                                <br />
                                • Your access period will remain available after delivery.
                                <br />
                                • A ready notification can also be sent to your registered email:{" "}
                                <b>{supportEmail}</b>
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    ) : null}

                    {!processingIsOnDemand ? (
                      <div className="mt-4 text-xs text-slate-500 font-semibold">
                        Tip: Close this popup and try again after some time. Your order is safe and linked to your account.
                      </div>
                    ) : (
                      <div className="mt-4 text-xs text-slate-500 font-semibold">
                        Tip: You can safely close this popup anytime. Your order remains saved in your dashboard and becomes downloadable automatically after upload.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setProcessingOpen(false);
                    void reloadPurchased();
                    if (historyOpen) {
                      void loadHistory(historyPage, historySearchInput);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {trackingOpen && tracking ? (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setTrackingOpen(false)} />
          <div className="relative w-full max-w-2xl rounded-3xl bg-white border border-gray-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-extrabold">Track Hardcopy Order</div>
                <div className="text-sm text-slate-600 break-words">{tracking.title}</div>
              </div>
              <button
                onClick={() => setTrackingOpen(false)}
                className="h-10 w-10 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white flex items-center justify-center"
              >
                <X />
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              <div className="rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-white p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-sm font-extrabold text-orange-900">Order Status</div>
                    <div className="mt-1 text-lg font-extrabold text-slate-900">
                      {trackingStage?.title || "Writing and preparation have started"}
                    </div>
                  </div>
                  <ShipmentPill status={tracking.shipmentStatus} />
                </div>

                <div className="mt-3 text-sm text-orange-800 font-semibold leading-6">
                  {trackingStage?.description ||
                    tracking.shipmentMessage ||
                    "Your hardcopy order is confirmed. Shipment status will keep updating here."}
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
                    {tracking.orderId || "—"}
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
                  {[
                    safeStr(tracking.shippingAddress),
                    safeStr(tracking.shippingCity),
                    safeStr(tracking.shippingState),
                    safeStr(tracking.shippingPincode),
                  ]
                    .filter(Boolean)
                    .join(", ") || "Address not available yet"}
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
                  <br />
                  • Last sync: {tracking.syncedAt ? fmtDate(tracking.syncedAt) : "Pending"}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 bg-white flex items-center justify-end gap-2">
              <button
                onClick={() => setTrackingOpen(false)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold"
              >
                Close
              </button>

              <button
                onClick={() => {
                  setTrackingOpen(false);
                  void reloadPurchased();
                  if (historyOpen) {
                    void loadHistory(historyPage, historySearchInput);
                  }
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

      {moreOpen ? (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} />
          <div className="relative w-full max-w-4xl rounded-3xl bg-white border border-gray-200 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <div className="text-lg font-extrabold">More Categories</div>
                <div className="text-sm text-slate-600">Choose a section to open.</div>
              </div>
              <button
                onClick={() => setMoreOpen(false)}
                className="h-10 w-10 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white flex items-center justify-center"
              >
                <X />
              </button>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {extraCards.map((c) => (
                  <CategoryCard key={c.href} c={c} small />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {pwdOpen ? (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !pwdLoading && setPwdOpen(false)} />
          <div className="relative w-full max-w-lg rounded-3xl bg-white border border-gray-200 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <div className="text-lg font-extrabold">Change Password</div>
                <div className="text-sm text-slate-600">Use a strong password (min 6 characters).</div>
              </div>
              <button
                onClick={() => !pwdLoading && setPwdOpen(false)}
                className="h-10 w-10 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white flex items-center justify-center"
              >
                <X />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Current Password</label>
                <input
                  type={showPwd ? "text" : "password"}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-blue-500 transition font-medium"
                  value={pwdForm.currentPassword}
                  onChange={(e) => setPwdForm((p) => ({ ...p, currentPassword: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">New Password</label>
                <input
                  type={showPwd ? "text" : "password"}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-blue-500 transition font-medium"
                  value={pwdForm.newPassword}
                  onChange={(e) => setPwdForm((p) => ({ ...p, newPassword: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Confirm New Password</label>
                <input
                  type={showPwd ? "text" : "password"}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-blue-500 transition font-medium"
                  value={pwdForm.confirmPassword}
                  onChange={(e) => setPwdForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold"
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  {showPwd ? "Hide" : "Show"}
                </button>

                <button
                  disabled={pwdLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-bold disabled:opacity-60"
                >
                  <KeyRound size={18} />
                  {pwdLoading ? "Updating..." : "Update Password"}
                </button>
              </div>

              <div className="text-xs text-slate-500">
                Password update request will be processed through the backend route.
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <Footer />
    </main>
  );
}