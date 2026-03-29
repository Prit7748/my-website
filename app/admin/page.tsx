"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Users,
  Package,
  ClipboardList,
  ArrowRight,
  FileText,
  Settings,
  BookOpen,
  GraduationCap,
  UserCircle2,
  CalendarDays,
  Power,
  ShoppingCart,
  Siren,
  Boxes,
  SlidersHorizontal,
  FileArchive,
  IndianRupee,
  FolderOpen,
  ImageIcon,
  BarChart3,
  TrendingUp,
  Clock3,
} from "lucide-react";
import {
  ADMIN_DASHBOARD_TILE_STORAGE_KEY,
  getAdminDashboardTileDisplayTitle,
  getAdminDashboardTilesInOrder,
  getDefaultAdminDashboardTileSettings,
  normalizeAdminDashboardTileSettings,
  type AdminDashboardTileConfig,
  type AdminDashboardTileSettings,
} from "@/lib/adminDashboardTiles";

type ComingSoonToggleState = {
  enabled: boolean;
  note?: string;
  updatedAt?: string;
};

type OnDemandStatsResponse = {
  ok?: boolean;
  items?: any[];
  stats?: {
    totalUsers?: number;
    totalOnDemandProducts?: number;
  };
};

export default function AdminPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("");

  const [csLoading, setCsLoading] = useState(true);
  const [csSaving, setCsSaving] = useState(false);
  const [comingSoonEnabled, setComingSoonEnabled] = useState(true);
  const [csMsg, setCsMsg] = useState("");

  const [odLoading, setOdLoading] = useState(true);
  const [onDemandUsers, setOnDemandUsers] = useState(0);
  const [onDemandProducts, setOnDemandProducts] = useState(0);

  const [tileSettings, setTileSettings] = useState<AdminDashboardTileSettings>(
    getDefaultAdminDashboardTileSettings()
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        setRole((data?.user?.role || "").toString());
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(
        ADMIN_DASHBOARD_TILE_STORAGE_KEY
      );
      const parsed = raw ? JSON.parse(raw) : {};
      const normalized = normalizeAdminDashboardTileSettings(parsed);
      setTileSettings(normalized);
      window.localStorage.setItem(
        ADMIN_DASHBOARD_TILE_STORAGE_KEY,
        JSON.stringify(normalized)
      );
    } catch {
      const defaults = getDefaultAdminDashboardTileSettings();
      setTileSettings(defaults);
      window.localStorage.setItem(
        ADMIN_DASHBOARD_TILE_STORAGE_KEY,
        JSON.stringify(defaults)
      );
    }
  }, []);

  useEffect(() => {
    const onFocus = () => {
      try {
        const raw = window.localStorage.getItem(
          ADMIN_DASHBOARD_TILE_STORAGE_KEY
        );
        const parsed = raw ? JSON.parse(raw) : {};
        setTileSettings(normalizeAdminDashboardTileSettings(parsed));
      } catch {}
    };

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/site-settings/coming-soon", {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          const cfg: ComingSoonToggleState = data?.config || { enabled: true };
          setComingSoonEnabled(Boolean(cfg.enabled));
        }
      } catch {
      } finally {
        setCsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/on-demand-orders", {
          credentials: "include",
          cache: "no-store",
        });

        const data: OnDemandStatsResponse = await res.json().catch(
          () => ({} as any)
        );

        if (res.ok) {
          setOnDemandUsers(Number(data?.stats?.totalUsers || 0));
          setOnDemandProducts(Number(data?.stats?.totalOnDemandProducts || 0));
        } else {
          setOnDemandUsers(0);
          setOnDemandProducts(0);
        }
      } catch {
        setOnDemandUsers(0);
        setOnDemandProducts(0);
      } finally {
        setOdLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!csMsg) return;
    const t = setTimeout(() => setCsMsg(""), 1800);
    return () => clearTimeout(t);
  }, [csMsg]);

  async function handleToggleComingSoon() {
    if (csSaving || csLoading) return;

    const next = !comingSoonEnabled;
    setCsSaving(true);
    setComingSoonEnabled(next);

    try {
      const res = await fetch("/api/admin/site-settings/coming-soon", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled: next }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setComingSoonEnabled(!next);
        setCsMsg(data?.error || "Failed to update toggle");
        return;
      }

      setComingSoonEnabled(Boolean(data?.config?.enabled ?? next));
      setCsMsg(next ? "Coming Soon is ON" : "Coming Soon is OFF");
    } catch {
      setComingSoonEnabled(!next);
      setCsMsg("Network error");
    } finally {
      setCsSaving(false);
    }
  }

  const isMaster = role === "master_admin";

  const hasOnDemandEmergency = onDemandProducts > 0;

  const onDemandTileTone = useMemo(() => {
    if (onDemandProducts <= 0) {
      return {
        wrap: "border-amber-200 bg-amber-50 hover:bg-white",
        iconWrap: "bg-amber-100 text-amber-700",
        title: "text-amber-900",
        badge: "bg-white text-amber-800 border border-amber-200",
        sub: "text-slate-600",
      };
    }

    if (onDemandProducts === 1) {
      return {
        wrap: "border-red-300 bg-red-50 hover:bg-red-50",
        iconWrap: "bg-red-100 text-red-700",
        title: "text-red-900",
        badge: "bg-red-600 text-white border border-red-600",
        sub: "text-red-800",
      };
    }

    if (onDemandProducts === 2) {
      return {
        wrap: "border-red-400 bg-red-100 hover:bg-red-100",
        iconWrap: "bg-red-200 text-red-800",
        title: "text-red-950",
        badge: "bg-red-700 text-white border border-red-700",
        sub: "text-red-900",
      };
    }

    return {
      wrap: "border-red-500 bg-red-200 hover:bg-red-200",
      iconWrap: "bg-red-700 text-white",
      title: "text-red-950",
      badge: "bg-red-900 text-white border border-red-900",
      sub: "text-red-950",
    };
  }, [onDemandProducts]);

  const emergencyClass = useMemo(() => {
    if (onDemandProducts <= 0) return "";
    if (onDemandProducts === 1) return "isp-alert-low";
    if (onDemandProducts === 2) return "isp-alert-mid";
    return "isp-alert-high";
  }, [onDemandProducts]);

  const orderedTiles = useMemo(() => {
    return getAdminDashboardTilesInOrder(tileSettings);
  }, [tileSettings]);

  function getTitle(key: AdminDashboardTileConfig["key"]) {
    return getAdminDashboardTileDisplayTitle(key, tileSettings);
  }

  function renderTile(tile: AdminDashboardTileConfig) {
    if (tile.key === "products") {
      return (
        <Link
          key={tile.key}
          href="/admin/products"
          className="rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white transition p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <Package className="text-slate-700" />
            <div>
              <div className="font-extrabold">{getTitle(tile.key)}</div>
              <div className="text-xs text-slate-600 mt-1">
                Add / edit products
              </div>
            </div>
          </div>
        </Link>
      );
    }

    if (tile.key === "bulk-product-images") {
      return (
        <Link
          key={tile.key}
          href="/admin/products/bulk/bulk-images"
          className="rounded-2xl border border-cyan-200 bg-cyan-50 hover:bg-white transition p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <ImageIcon className="text-cyan-700" />
            <div>
              <div className="font-extrabold text-cyan-900">
                {getTitle(tile.key)}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                ZIP upload + category-wise missing image report
              </div>
            </div>
          </div>
        </Link>
      );
    }

    if (tile.key === "combos") {
      return (
        <Link
          key={tile.key}
          href="/admin/combos"
          className="rounded-2xl border border-violet-200 bg-violet-50 hover:bg-white transition p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <Boxes className="text-violet-700" />
            <div>
              <div className="font-extrabold text-violet-900">
                {getTitle(tile.key)}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                Manage combo rules, bundles & SEO
              </div>
            </div>
          </div>
        </Link>
      );
    }

    if (tile.key === "want-to-buy") {
      return (
        <Link
          key={tile.key}
          href="/admin/want-to-buy"
          className="rounded-2xl border border-blue-200 bg-blue-50 hover:bg-white transition p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <ShoppingCart className="text-blue-700" />
            <div>
              <div className="font-extrabold text-blue-900">
                {getTitle(tile.key)}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                Product demand enquiries
              </div>
            </div>
          </div>
        </Link>
      );
    }

    if (tile.key === "on-demand-orders") {
      return (
        <Link
          key={tile.key}
          href="/admin/on-demand-orders"
          className={`rounded-2xl transition p-5 shadow-sm relative overflow-hidden ${onDemandTileTone.wrap} ${emergencyClass}`}
          title={
            hasOnDemandEmergency
              ? `${onDemandProducts} pending on demand product request(s)`
              : "On Demand orders"
          }
        >
          {hasOnDemandEmergency ? (
            <div className="absolute top-2 right-2">
              <div className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold bg-white/90 text-red-700 border border-red-200 shadow-sm">
                <Siren size={12} className="isp-siren" />
                USER WAITING
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <div
              className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-sm ${onDemandTileTone.iconWrap}`}
            >
              <Package className={hasOnDemandEmergency ? "isp-siren" : ""} />
            </div>

            <div className="min-w-0 flex-1">
              <div className={`font-extrabold ${onDemandTileTone.title}`}>
                {getTitle(tile.key)}
              </div>
              <div className={`text-xs mt-1 ${onDemandTileTone.sub}`}>
                {odLoading
                  ? "Loading pending uploads..."
                  : hasOnDemandEmergency
                  ? "Urgent: upload pending user products"
                  : "No pending on demand uploads"}
              </div>

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold ${onDemandTileTone.badge}`}
                >
                  {odLoading ? "..." : `${onDemandProducts} pending`}
                </span>

                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold bg-white/90 text-slate-700 border border-gray-200">
                  {odLoading ? "..." : `${onDemandUsers} users`}
                </span>
              </div>
            </div>
          </div>

          {hasOnDemandEmergency ? (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-red-500 via-red-700 to-red-500" />
          ) : null}
        </Link>
      );
    }

    if (tile.key === "orders") {
      return (
        <Link
          key={tile.key}
          href="/admin/orders"
          className="rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white transition p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <ClipboardList className="text-slate-700" />
            <div>
              <div className="font-extrabold">{getTitle(tile.key)}</div>
              <div className="text-xs text-slate-600 mt-1">
                View payments & delivery
              </div>
            </div>
          </div>
        </Link>
      );
    }

    if (tile.key === "order-reports") {
      return (
        <Link
          key={tile.key}
          href="/admin/order-reports"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 hover:bg-white transition p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <BarChart3 className="text-emerald-700" />
            <div>
              <div className="font-extrabold text-emerald-900">
                {getTitle(tile.key)}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                Revenue, products sold, trends & analytics
              </div>
            </div>
          </div>
        </Link>
      );
    }

    if (tile.key === "analytics") {
      return (
        <Link
          key={tile.key}
          href="/admin/analytics"
          className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 hover:bg-white transition p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <TrendingUp className="text-fuchsia-700" />
            <div>
              <div className="font-extrabold text-fuchsia-900">
                {getTitle(tile.key)}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                SEO, source buckets, UTM, referrers & attribution report
              </div>
            </div>
          </div>
        </Link>
      );
    }

    if (tile.key === "blogs") {
      return (
        <Link
          key={tile.key}
          href="/admin/blogs"
          className="rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white transition p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <FileText className="text-slate-700" />
            <div>
              <div className="font-extrabold">{getTitle(tile.key)}</div>
              <div className="text-xs text-slate-600 mt-1">
                Manage blog categories & posts
              </div>
            </div>
          </div>
        </Link>
      );
    }

    if (tile.key === "admin-management") {
      return (
        <div
          key={tile.key}
          className="rounded-2xl border border-gray-200 bg-gray-50 p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <Users className="text-slate-700" />
            <div className="min-w-0">
              <div className="font-extrabold">{getTitle(tile.key)}</div>
              <div className="text-xs text-slate-600 mt-1">
                {isMaster
                  ? "Create / delete Co-Admins (Master only)"
                  : "Only Master can manage admins"}
              </div>
            </div>
          </div>

          <div className="mt-4">
            {isMaster ? (
              <Link
                href="/admin/admins"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-bold shadow-sm"
              >
                Manage Admins <ArrowRight size={18} />
              </Link>
            ) : (
              <button
                disabled
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-200 text-gray-500 font-bold cursor-not-allowed"
              >
                Master Only
              </button>
            )}
          </div>
        </div>
      );
    }

    if (tile.key === "site-settings") {
      return (
        <Link
          key={tile.key}
          href="/admin/site-settings"
          className="rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white transition p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <Settings className="text-slate-700" />
            <div>
              <div className="font-extrabold">{getTitle(tile.key)}</div>
              <div className="text-xs text-slate-600 mt-1">
                Hero, FAQ, Social links, Testimonials
              </div>
            </div>
          </div>
        </Link>
      );
    }

    if (tile.key === "subjects") {
      return (
        <Link
          key={tile.key}
          href="/admin/subjects"
          className="rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white transition p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <BookOpen className="text-slate-700" />
            <div>
              <div className="font-extrabold">{getTitle(tile.key)}</div>
              <div className="text-xs text-slate-600 mt-1">
                Codes + Titles (Excel upload)
              </div>
            </div>
          </div>
        </Link>
      );
    }

    if (tile.key === "courses") {
      return (
        <Link
          key={tile.key}
          href="/admin/courses"
          className="rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white transition p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <GraduationCap className="text-slate-700" />
            <div>
              <div className="font-extrabold">{getTitle(tile.key)}</div>
              <div className="text-xs text-slate-600 mt-1">
                Codes + Title (single title)
              </div>
            </div>
          </div>
        </Link>
      );
    }

    if (tile.key === "users") {
      return (
        <Link
          key={tile.key}
          href="/admin/users"
          className="rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white transition p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <UserCircle2 className="text-slate-700" />
            <div>
              <div className="font-extrabold">{getTitle(tile.key)}</div>
              <div className="text-xs text-slate-600 mt-1">
                Customers list + order count
              </div>
            </div>
          </div>
        </Link>
      );
    }

    if (tile.key === "sessions") {
      return (
        <Link
          key={tile.key}
          href="/admin/sessions"
          className="rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white transition p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <CalendarDays className="text-slate-700" />
            <div>
              <div className="font-extrabold">{getTitle(tile.key)}</div>
              <div className="text-xs text-slate-600 mt-1">
                Smart sessions by category
              </div>
            </div>
          </div>
        </Link>
      );
    }

    if (tile.key === "lalita") {
      return (
        <Link
          key={tile.key}
          href="/admin/Lalita"
          className="rounded-2xl border border-rose-200 bg-rose-50 hover:bg-white transition p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <FileArchive className="text-rose-700" />
            <div>
              <div className="font-extrabold text-rose-900">
                {getTitle(tile.key)}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                Hidden secure bulk PDF upload page
              </div>
            </div>
          </div>
        </Link>
      );
    }

    if (tile.key === "official-papers") {
      return (
        <Link
          key={tile.key}
          href="/admin/official-papers"
          className="rounded-2xl border border-sky-200 bg-sky-50 hover:bg-white transition p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <FolderOpen className="text-sky-700" />
            <div>
              <div className="font-extrabold text-sky-900">
                {getTitle(tile.key)}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                Upload official / unsolved papers by SKU
              </div>
            </div>
          </div>
        </Link>
      );
    }

    if (tile.key === "dashboard-tile-order") {
      return (
        <Link
          key={tile.key}
          href="/admin/dashboard-tile-order"
          className="rounded-2xl border border-indigo-200 bg-indigo-50 hover:bg-white transition p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <SlidersHorizontal className="text-indigo-700" />
            <div>
              <div className="font-extrabold text-indigo-900">
                {getTitle(tile.key)}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                Set tile order, names, and visibility
              </div>
            </div>
          </div>
        </Link>
      );
    }

    return null;
  }

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <style>{`
        @keyframes ispPulseLow {
          0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.35); transform: translateY(0); }
          50% { box-shadow: 0 0 0 10px rgba(239,68,68,0.00); transform: translateY(-1px); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.00); transform: translateY(0); }
        }
        @keyframes ispPulseMid {
          0% { box-shadow: 0 0 0 0 rgba(220,38,38,0.42); transform: translateY(0) scale(1); }
          50% { box-shadow: 0 0 0 16px rgba(220,38,38,0.00); transform: translateY(-2px) scale(1.01); }
          100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.00); transform: translateY(0) scale(1); }
        }
        @keyframes ispPulseHigh {
          0% { box-shadow: 0 0 0 0 rgba(185,28,28,0.55), 0 0 0 0 rgba(248,113,113,0.45); transform: translateY(0) scale(1); }
          30% { box-shadow: 0 0 0 12px rgba(185,28,28,0.00), 0 0 0 24px rgba(248,113,113,0.00); transform: translateY(-3px) scale(1.015); }
          60% { box-shadow: 0 0 0 0 rgba(185,28,28,0.00), 0 0 0 0 rgba(248,113,113,0.00); transform: translateY(0) scale(1); }
          100% { box-shadow: 0 0 0 0 rgba(185,28,28,0.00), 0 0 0 0 rgba(248,113,113,0.00); transform: translateY(0) scale(1); }
        }

        .isp-alert-low { animation: ispPulseLow 1.8s ease-in-out infinite; }
        .isp-alert-mid { animation: ispPulseMid 1.35s ease-in-out infinite; }
        .isp-alert-high { animation: ispPulseHigh 0.95s ease-in-out infinite; }

        @keyframes ispSirenBlink {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: .55; transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1); }
        }
        .isp-siren { animation: ispSirenBlink 0.9s ease-in-out infinite; }
      `}</style>

      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-2xl font-extrabold flex items-center gap-2">
                <ShieldCheck className="text-slate-700" />
                Admin Panel
              </div>
              <div className="text-sm text-slate-600 mt-1">
                {loading
                  ? "Loading..."
                  : isMaster
                  ? "Master Admin Access"
                  : "Co-Admin Access"}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="hidden sm:block">
                    <div className="text-[11px] uppercase tracking-wide font-bold text-slate-500">
                      On Demand Orders
                    </div>
                    <div className="text-xs text-slate-600">
                      {csLoading
                        ? "Loading..."
                        : comingSoonEnabled
                        ? "Users can pay for On Demand products"
                        : "Coming Soon behaves like Out of Stock"}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleComingSoon}
                    disabled={csLoading || csSaving}
                    aria-label={`Coming Soon is ${
                      comingSoonEnabled ? "On" : "Off"
                    }`}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white font-extrabold shadow-sm transition disabled:opacity-60 ${
                      comingSoonEnabled
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                    title={
                      comingSoonEnabled
                        ? "Click to turn OFF (Coming Soon -> Out of Stock behavior)"
                        : "Click to turn ON (Normal Coming Soon behavior)"
                    }
                  >
                    <Power size={16} />
                    {csSaving ? "Saving..." : comingSoonEnabled ? "ON" : "OFF"}
                  </button>
                </div>

                {csMsg && (
                  <div className="mt-2 text-xs font-semibold text-slate-700">
                    {csMsg}
                  </div>
                )}
              </div>

              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                Back to Dashboard <ArrowRight size={18} />
              </Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            {orderedTiles.map((tile) => renderTile(tile))}

            <Link
              href="/admin/product-pricing"
              className="rounded-2xl border border-emerald-200 bg-emerald-50 hover:bg-white transition p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <IndianRupee className="text-emerald-700" />
                <div>
                  <div className="font-extrabold text-emerald-900">
                    Product Pricing
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Category + course pricing rules & product overrides
                  </div>
                </div>
              </div>
            </Link>

            <Link
              href="/admin/on-demand-timing-rules"
              className="rounded-2xl border border-indigo-200 bg-indigo-50 hover:bg-white transition p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Clock3 className="text-indigo-700" />
                <div>
                  <div className="font-extrabold text-indigo-900">
                    On Demand Timing Rules
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Category default + course-wise timer configuration
                  </div>
                </div>
              </div>
            </Link>
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Note: Users page me “Login” button abhi placeholder hai (inactive). Future me activate karenge.
          </div>
        </div>
      </div>
    </main>
  );
}