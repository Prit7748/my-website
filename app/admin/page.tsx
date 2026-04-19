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
  FileSpreadsheet,
  BellRing,
} from "lucide-react";
import {
  ADMIN_DASHBOARD_TILE_STORAGE_KEY,
  ADMIN_DASHBOARD_TILE_SYNC_EVENT,
  getAdminDashboardTileDisplayTitle,
  getAdminDashboardTilesInOrder,
  getDefaultAdminDashboardTileSettings,
  normalizeAdminDashboardTileSettings,
  type AdminDashboardTileConfig,
  type AdminDashboardTileKey,
  type AdminDashboardTileSettings,
  type AdminDashboardTileTone,
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

type ToneClasses = {
  wrap: string;
  icon: string;
  title: string;
};

type NonDefaultTone = Exclude<AdminDashboardTileTone, "default">;

const TONE_CLASSES: Record<NonDefaultTone, ToneClasses> = {
  gray: {
    wrap: "border-gray-200 bg-gray-50",
    icon: "text-slate-700",
    title: "text-slate-900",
  },
  blue: {
    wrap: "border-blue-200 bg-blue-50",
    icon: "text-blue-700",
    title: "text-blue-900",
  },
  cyan: {
    wrap: "border-cyan-200 bg-cyan-50",
    icon: "text-cyan-700",
    title: "text-cyan-900",
  },
  violet: {
    wrap: "border-violet-200 bg-violet-50",
    icon: "text-violet-700",
    title: "text-violet-900",
  },
  emerald: {
    wrap: "border-emerald-200 bg-emerald-50",
    icon: "text-emerald-700",
    title: "text-emerald-900",
  },
  amber: {
    wrap: "border-amber-200 bg-amber-50",
    icon: "text-amber-700",
    title: "text-amber-900",
  },
  red: {
    wrap: "border-red-200 bg-red-50",
    icon: "text-red-700",
    title: "text-red-900",
  },
  rose: {
    wrap: "border-rose-200 bg-rose-50",
    icon: "text-rose-700",
    title: "text-rose-900",
  },
  sky: {
    wrap: "border-sky-200 bg-sky-50",
    icon: "text-sky-700",
    title: "text-sky-900",
  },
  indigo: {
    wrap: "border-indigo-200 bg-indigo-50",
    icon: "text-indigo-700",
    title: "text-indigo-900",
  },
  fuchsia: {
    wrap: "border-fuchsia-200 bg-fuchsia-50",
    icon: "text-fuchsia-700",
    title: "text-fuchsia-900",
  },
};

const DEFAULT_TILE_TONES: Record<AdminDashboardTileKey, NonDefaultTone> = {
  products: "gray",
  "bulk-product-details": "violet",
  "bulk-product-images": "cyan",
  combos: "violet",
  "want-to-buy": "blue",
  "on-demand-orders": "amber",
  orders: "gray",
  "order-reports": "emerald",
  analytics: "fuchsia",
  blogs: "gray",
  "admin-management": "gray",
  "site-settings": "gray",
  notifications: "amber",
  subjects: "gray",
  courses: "gray",
  users: "gray",
  sessions: "gray",
  lalita: "rose",
  "official-papers": "sky",
  "product-pricing": "emerald",
  "on-demand-timing-rules": "indigo",
  "dashboard-tile-order": "indigo",
};

function readStoredTileSettings(): AdminDashboardTileSettings {
  if (typeof window === "undefined") {
    return getDefaultAdminDashboardTileSettings();
  }

  try {
    const raw = window.localStorage.getItem(ADMIN_DASHBOARD_TILE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const normalized = normalizeAdminDashboardTileSettings(parsed);
    window.localStorage.setItem(
      ADMIN_DASHBOARD_TILE_STORAGE_KEY,
      JSON.stringify(normalized)
    );
    return normalized;
  } catch {
    const defaults = getDefaultAdminDashboardTileSettings();
    window.localStorage.setItem(
      ADMIN_DASHBOARD_TILE_STORAGE_KEY,
      JSON.stringify(defaults)
    );
    return defaults;
  }
}

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
    setTileSettings(readStoredTileSettings());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncTiles = () => {
      setTileSettings(readStoredTileSettings());
    };

    const onFocus = () => syncTiles();
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === ADMIN_DASHBOARD_TILE_STORAGE_KEY) {
        syncTiles();
      }
    };
    const onCustom = () => syncTiles();

    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    window.addEventListener(
      ADMIN_DASHBOARD_TILE_SYNC_EVENT,
      onCustom as EventListener
    );

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        ADMIN_DASHBOARD_TILE_SYNC_EVENT,
        onCustom as EventListener
      );
    };
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
        // ignore
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

  function getResolvedTone(key: AdminDashboardTileKey): NonDefaultTone {
    const override = tileSettings.colorOverrides?.[key];
    if (override && override !== "default") {
      return override as NonDefaultTone;
    }
    return DEFAULT_TILE_TONES[key] || "gray";
  }

  function getToneClasses(key: AdminDashboardTileKey) {
    return TONE_CLASSES[getResolvedTone(key)];
  }

  function renderBasicTile(
    tile: AdminDashboardTileConfig,
    href: string,
    Icon: any,
    description: string
  ) {
    const tone = getToneClasses(tile.key);

    return (
      <Link
        key={tile.key}
        href={href}
        className={`rounded-2xl border hover:bg-white transition p-5 shadow-sm ${tone.wrap}`}
      >
        <div className="flex items-center gap-3">
          <Icon className={tone.icon} />
          <div>
            <div className={`font-extrabold ${tone.title}`}>{getTitle(tile.key)}</div>
            <div className="text-xs text-slate-600 mt-1">{description}</div>
          </div>
        </div>
      </Link>
    );
  }

  function renderTile(tile: AdminDashboardTileConfig) {
    if (tile.key === "products") {
      return renderBasicTile(tile, "/admin/products", Package, "Add / edit products");
    }

    if (tile.key === "bulk-product-details") {
      return renderBasicTile(
        tile,
        "/admin/products/bulk/details",
        FileSpreadsheet,
        "Static template + CSV/Excel row-wise merge upload"
      );
    }

    if (tile.key === "bulk-product-images") {
      return renderBasicTile(
        tile,
        "/admin/products/bulk/bulk-images",
        ImageIcon,
        "ZIP upload + category-wise missing image report"
      );
    }

    if (tile.key === "combos") {
      return renderBasicTile(
        tile,
        "/admin/combos",
        Boxes,
        "Manage combo rules, bundles & SEO"
      );
    }

    if (tile.key === "want-to-buy") {
      return renderBasicTile(
        tile,
        "/admin/want-to-buy",
        ShoppingCart,
        "Product demand enquiries"
      );
    }

    if (tile.key === "on-demand-orders") {
      const customTone = tileSettings.colorOverrides?.[tile.key];
      const customActive = Boolean(customTone && customTone !== "default");
      const tone = customActive ? TONE_CLASSES[customTone as NonDefaultTone] : null;

      return (
        <Link
          key={tile.key}
          href="/admin/on-demand-orders"
          className={`rounded-2xl transition p-5 shadow-sm relative overflow-hidden ${
            customActive
              ? `${tone?.wrap} hover:bg-white`
              : `${onDemandTileTone.wrap} ${emergencyClass}`
          }`}
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
              className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-sm ${
                customActive ? "bg-white/80" : onDemandTileTone.iconWrap
              }`}
            >
              <Package
                className={
                  customActive
                    ? `${tone?.icon} ${hasOnDemandEmergency ? "isp-siren" : ""}`
                    : hasOnDemandEmergency
                    ? "isp-siren"
                    : ""
                }
              />
            </div>

            <div className="min-w-0 flex-1">
              <div
                className={`font-extrabold ${
                  customActive ? tone?.title : onDemandTileTone.title
                }`}
              >
                {getTitle(tile.key)}
              </div>
              <div
                className={`text-xs mt-1 ${
                  customActive ? "text-slate-600" : onDemandTileTone.sub
                }`}
              >
                {odLoading
                  ? "Loading pending uploads..."
                  : hasOnDemandEmergency
                  ? "Urgent: upload pending user products"
                  : "No pending on demand uploads"}
              </div>

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                    customActive
                      ? "bg-white text-slate-700 border border-gray-200"
                      : onDemandTileTone.badge
                  }`}
                >
                  {odLoading ? "..." : `${onDemandProducts} pending`}
                </span>

                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold bg-white/90 text-slate-700 border border-gray-200">
                  {odLoading ? "..." : `${onDemandUsers} users`}
                </span>
              </div>
            </div>
          </div>

          {!customActive && hasOnDemandEmergency ? (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-red-500 via-red-700 to-red-500" />
          ) : null}
        </Link>
      );
    }

    if (tile.key === "orders") {
      return renderBasicTile(tile, "/admin/orders", ClipboardList, "View payments & delivery");
    }

    if (tile.key === "order-reports") {
      return renderBasicTile(
        tile,
        "/admin/order-reports",
        BarChart3,
        "Revenue, products sold, trends & analytics"
      );
    }

    if (tile.key === "analytics") {
      return renderBasicTile(
        tile,
        "/admin/analytics",
        TrendingUp,
        "SEO, source buckets, UTM, referrers & attribution report"
      );
    }

    if (tile.key === "blogs") {
      return renderBasicTile(
        tile,
        "/admin/blogs",
        FileText,
        "Manage blog categories & posts"
      );
    }

    if (tile.key === "admin-management") {
      const tone = getToneClasses(tile.key);

      return (
        <div
          key={tile.key}
          className={`rounded-2xl border p-5 shadow-sm ${tone.wrap}`}
        >
          <div className="flex items-center gap-3">
            <Users className={tone.icon} />
            <div className="min-w-0">
              <div className={`font-extrabold ${tone.title}`}>{getTitle(tile.key)}</div>
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
      return renderBasicTile(
        tile,
        "/admin/site-settings",
        Settings,
        "Hero, FAQ, Social links, Testimonials"
      );
    }

    if (tile.key === "notifications") {
      return renderBasicTile(
        tile,
        "/admin/notifications",
        BellRing,
        "Post-upload sync tasks, alerts, pending admin actions"
      );
    }

    if (tile.key === "subjects") {
      return renderBasicTile(
        tile,
        "/admin/subjects",
        BookOpen,
        "Codes + Titles (Excel upload)"
      );
    }

    if (tile.key === "courses") {
      return renderBasicTile(
        tile,
        "/admin/courses",
        GraduationCap,
        "Codes + Title (single title)"
      );
    }

    if (tile.key === "users") {
      return renderBasicTile(
        tile,
        "/admin/users",
        UserCircle2,
        "Customers list + order count"
      );
    }

    if (tile.key === "sessions") {
      return renderBasicTile(
        tile,
        "/admin/sessions",
        CalendarDays,
        "Smart sessions by category"
      );
    }

    if (tile.key === "lalita") {
      return renderBasicTile(
        tile,
        "/admin/Lalita",
        FileArchive,
        "Hidden secure bulk PDF upload page"
      );
    }

    if (tile.key === "official-papers") {
      return renderBasicTile(
        tile,
        "/admin/official-papers",
        FolderOpen,
        "Upload official / unsolved papers by SKU"
      );
    }

    if (tile.key === "product-pricing") {
      return renderBasicTile(
        tile,
        "/admin/product-pricing",
        IndianRupee,
        "Category + course pricing rules & product overrides"
      );
    }

    if (tile.key === "on-demand-timing-rules") {
      return renderBasicTile(
        tile,
        "/admin/on-demand-timing-rules",
        Clock3,
        "Category default + course-wise timer configuration"
      );
    }

    if (tile.key === "dashboard-tile-order") {
      return renderBasicTile(
        tile,
        "/admin/dashboard-tile-order",
        SlidersHorizontal,
        "Set tile order, names, and visibility"
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
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Note: Users page me “Login” button abhi placeholder hai (inactive). Future me activate karenge.
          </div>
        </div>
      </div>
    </main>
  );
}