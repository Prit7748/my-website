"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  RotateCcw,
  Undo2,
  GripVertical,
  Eye,
  EyeOff,
  Package,
  ClipboardList,
  FileText,
  Settings,
  BookOpen,
  GraduationCap,
  UserCircle2,
  CalendarDays,
  ShoppingCart,
  Siren,
  Boxes,
  SlidersHorizontal,
  FileArchive,
  IndianRupee,
  FolderOpen,
  ImageIcon,
  FileSpreadsheet,
  BarChart3,
  TrendingUp,
  Clock3,
  Users,
  Type,
  Palette,
  BellRing,
  Youtube,
} from "lucide-react";
import {
  ADMIN_DASHBOARD_TILE_STORAGE_KEY,
  ADMIN_DASHBOARD_TILE_SYNC_EVENT,
  ADMIN_DASHBOARD_TILES,
  ADMIN_DASHBOARD_TILE_TONE_OPTIONS,
  getAdminDashboardTileDisplayTitle,
  getDefaultAdminDashboardTileSettings,
  normalizeAdminDashboardTileSettings,
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

type EditorRow = {
  key: AdminDashboardTileKey;
  defaultTitle: string;
  customTitle: string;
  description: string;
  hidden: boolean;
  fixedLast: boolean;
  tone: AdminDashboardTileTone;
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
  "bulk-product-details": "indigo",
  "bulk-product-images": "cyan",
  combos: "violet",
  "want-to-buy": "blue",
  "on-demand-orders": "amber",
  orders: "gray",
  "order-reports": "emerald",
  analytics: "fuchsia",
  youtube: "red",
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

function buildRowsFromSettings(settings: AdminDashboardTileSettings): EditorRow[] {
  const order = settings.order.length
    ? settings.order
    : getDefaultAdminDashboardTileSettings().order;

  const metaMap = new Map(ADMIN_DASHBOARD_TILES.map((tile) => [tile.key, tile]));

  const rows: EditorRow[] = [];

  for (const key of order) {
    const tile = metaMap.get(key);
    if (!tile) continue;

    rows.push({
      key: tile.key,
      defaultTitle: tile.defaultTitle,
      customTitle: String(settings.labelOverrides[tile.key] ?? ""),
      description: tile.description,
      hidden: settings.hiddenKeys.includes(tile.key),
      fixedLast: !!tile.fixedLast,
      tone: settings.colorOverrides?.[tile.key] || "default",
    });
  }

  for (const tile of ADMIN_DASHBOARD_TILES) {
    if (rows.some((row) => row.key === tile.key)) continue;

    rows.push({
      key: tile.key,
      defaultTitle: tile.defaultTitle,
      customTitle: String(settings.labelOverrides[tile.key] ?? ""),
      description: tile.description,
      hidden: settings.hiddenKeys.includes(tile.key),
      fixedLast: !!tile.fixedLast,
      tone: settings.colorOverrides?.[tile.key] || "default",
    });
  }

  const normalRows = rows.filter((row) => !row.fixedLast);
  const fixedLastRows = rows.filter((row) => row.fixedLast);

  return [...normalRows, ...fixedLastRows];
}

function buildSettingsFromRows(rows: EditorRow[]): AdminDashboardTileSettings {
  const normalRows = rows.filter((row) => !row.fixedLast);
  const fixedLastRows = rows.filter((row) => row.fixedLast);

  const order = [...normalRows, ...fixedLastRows].map((row) => row.key);
  const hiddenKeys = rows.filter((row) => row.hidden).map((row) => row.key);

  const labelOverrides: Partial<Record<AdminDashboardTileKey, string>> = {};
  const colorOverrides: Partial<Record<AdminDashboardTileKey, AdminDashboardTileTone>> = {};

  for (const row of rows) {
    const label = String(row.customTitle || "").trim();
    if (label && label !== row.defaultTitle) {
      labelOverrides[row.key] = label;
    }

    if (row.tone && row.tone !== "default") {
      colorOverrides[row.key] = row.tone;
    }
  }

  return normalizeAdminDashboardTileSettings({
    order,
    hiddenKeys,
    labelOverrides,
    colorOverrides,
  });
}

function moveRow<T extends { key: string }>(rows: T[], fromKey: string, toKey: string): T[] {
  const fromIndex = rows.findIndex((row) => row.key === fromKey);
  const toIndex = rows.findIndex((row) => row.key === toKey);

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return rows;

  const next = [...rows];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);

  return next;
}

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

function persistTileSettings(rows: EditorRow[]) {
  if (typeof window === "undefined") return;
  const normalized = buildSettingsFromRows(rows);
  window.localStorage.setItem(
    ADMIN_DASHBOARD_TILE_STORAGE_KEY,
    JSON.stringify(normalized)
  );
  window.dispatchEvent(new Event(ADMIN_DASHBOARD_TILE_SYNC_EVENT));
}

export default function DashboardTileOrderPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("");
  const [rows, setRows] = useState<EditorRow[]>([]);
  const [msg, setMsg] = useState("");
  const [draggingKey, setDraggingKey] = useState<AdminDashboardTileKey | null>(null);
  const [dragOverKey, setDragOverKey] = useState<AdminDashboardTileKey | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [odLoading, setOdLoading] = useState(true);
  const [onDemandUsers, setOnDemandUsers] = useState(0);
  const [onDemandProducts, setOnDemandProducts] = useState(0);

  const [csLoading, setCsLoading] = useState(true);
  const [comingSoonEnabled, setComingSoonEnabled] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          router.push("/login");
          return;
        }
        const data = await res.json().catch(() => ({}));
        setRole((data?.user?.role || "").toString());
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    const settings = readStoredTileSettings();
    setRows(buildRowsFromSettings(settings));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persistTileSettings(rows);
  }, [rows, hydrated]);

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
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 1600);
    return () => clearTimeout(t);
  }, [msg]);

  const isMaster = role === "master_admin";
  const hasOnDemandEmergency = onDemandProducts > 0;

  const liveSettings = useMemo(() => {
    return buildSettingsFromRows(rows);
  }, [rows]);

  const visibleCount = useMemo(() => rows.filter((row) => !row.hidden).length, [rows]);
  const hiddenCount = useMemo(() => rows.filter((row) => row.hidden).length, [rows]);

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

  function getDisplayTitle(row: EditorRow) {
    return getAdminDashboardTileDisplayTitle(row.key, liveSettings);
  }

  function updateRows(
    updater: EditorRow[] | ((prev: EditorRow[]) => EditorRow[]),
    message?: string
  ) {
    setRows((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      return next;
    });

    if (message) {
      setMsg(message);
    }
  }

  function updateCustomTitle(key: AdminDashboardTileKey, value: string) {
    updateRows(
      (prev) =>
        prev.map((row) => (row.key === key ? { ...row, customTitle: value } : row)),
      ""
    );
  }

  function updateTone(key: AdminDashboardTileKey, value: string) {
    updateRows(
      (prev) =>
        prev.map((row) =>
          row.key === key
            ? { ...row, tone: (value || "default") as AdminDashboardTileTone }
            : row
        ),
      "Tile colour updated"
    );
  }

  function toggleHidden(key: AdminDashboardTileKey) {
    updateRows(
      (prev) =>
        prev.map((row) => (row.key === key ? { ...row, hidden: !row.hidden } : row)),
      "Tile visibility updated"
    );
  }

  function resetSingleName(key: AdminDashboardTileKey) {
    updateRows(
      (prev) =>
        prev.map((row) => (row.key === key ? { ...row, customTitle: "" } : row)),
      "Tile name restored"
    );
  }

  function handleResetNames() {
    updateRows(
      (prev) => prev.map((row) => ({ ...row, customTitle: "" })),
      "All custom names removed"
    );
  }

  function handleResetAll() {
    const defaults = getDefaultAdminDashboardTileSettings();
    updateRows(buildRowsFromSettings(defaults), "Default layout restored");
  }

  function handleDragStart(key: AdminDashboardTileKey) {
    const row = rows.find((x) => x.key === key);
    if (row?.fixedLast) return;
    setDraggingKey(key);
    setDragOverKey(null);
  }

  function handleDragOver(
    e: React.DragEvent<HTMLDivElement>,
    targetKey: AdminDashboardTileKey
  ) {
    e.preventDefault();
    const targetRow = rows.find((x) => x.key === targetKey);
    if (targetRow?.fixedLast) return;
    if (!draggingKey || draggingKey === targetKey) return;
    setDragOverKey(targetKey);
  }

  function handleDrop(targetKey: AdminDashboardTileKey) {
    if (!draggingKey || draggingKey === targetKey) {
      setDraggingKey(null);
      setDragOverKey(null);
      return;
    }

    const dragRow = rows.find((x) => x.key === draggingKey);
    const targetRow = rows.find((x) => x.key === targetKey);

    if (dragRow?.fixedLast || targetRow?.fixedLast) {
      setDraggingKey(null);
      setDragOverKey(null);
      return;
    }

    updateRows(
      (prev) => moveRow(prev, draggingKey, targetKey),
      "Tile order updated"
    );
    setDraggingKey(null);
    setDragOverKey(null);
  }

  function handleDragEnd() {
    setDraggingKey(null);
    setDragOverKey(null);
  }

  function resolveTone(row: EditorRow): NonDefaultTone {
    if (row.tone && row.tone !== "default") {
      return row.tone as NonDefaultTone;
    }
    return DEFAULT_TILE_TONES[row.key] || "gray";
  }

  function getToneClasses(row: EditorRow) {
    return TONE_CLASSES[resolveTone(row)];
  }

  function renderTileVisual(row: EditorRow) {
    const tone = getToneClasses(row);

    if (row.key === "products") {
      return (
        <div className="flex items-center gap-3">
          <Package className={tone.icon} />
          <div>
            <div className={`font-extrabold ${tone.title}`}>{getDisplayTitle(row)}</div>
            <div className="text-xs text-slate-600 mt-1">Add / edit products</div>
          </div>
        </div>
      );
    }

    if (row.key === "bulk-product-details") {
      return (
        <div className="flex items-center gap-3">
          <FileSpreadsheet className={tone.icon} />
          <div>
            <div className={`font-extrabold ${tone.title}`}>{getDisplayTitle(row)}</div>
            <div className="text-xs text-slate-600 mt-1">
              Bulk details upload + default patterns
            </div>
          </div>
        </div>
      );
    }

    if (row.key === "bulk-product-images") {
      return (
        <div className="flex items-center gap-3">
          <ImageIcon className={tone.icon} />
          <div>
            <div className={`font-extrabold ${tone.title}`}>{getDisplayTitle(row)}</div>
            <div className="text-xs text-slate-600 mt-1">
              ZIP upload + category-wise missing image report
            </div>
          </div>
        </div>
      );
    }

    if (row.key === "combos") {
      return (
        <div className="flex items-center gap-3">
          <Boxes className={tone.icon} />
          <div>
            <div className={`font-extrabold ${tone.title}`}>{getDisplayTitle(row)}</div>
            <div className="text-xs text-slate-600 mt-1">
              Manage combo rules, bundles & SEO
            </div>
          </div>
        </div>
      );
    }

    if (row.key === "want-to-buy") {
      return (
        <div className="flex items-center gap-3">
          <ShoppingCart className={tone.icon} />
          <div>
            <div className={`font-extrabold ${tone.title}`}>{getDisplayTitle(row)}</div>
            <div className="text-xs text-slate-600 mt-1">Product demand enquiries</div>
          </div>
        </div>
      );
    }

    if (row.key === "on-demand-orders") {
      const customActive = row.tone !== "default";
      return (
        <>
          {hasOnDemandEmergency ? (
            <div className="absolute top-2 right-2 z-[2]">
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
                    ? `${tone.icon} ${hasOnDemandEmergency ? "isp-siren" : ""}`
                    : hasOnDemandEmergency
                    ? "isp-siren"
                    : ""
                }
              />
            </div>

            <div className="min-w-0 flex-1">
              <div
                className={`font-extrabold ${
                  customActive ? tone.title : onDemandTileTone.title
                }`}
              >
                {getDisplayTitle(row)}
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
        </>
      );
    }

    if (row.key === "orders") {
      return (
        <div className="flex items-center gap-3">
          <ClipboardList className={tone.icon} />
          <div>
            <div className={`font-extrabold ${tone.title}`}>{getDisplayTitle(row)}</div>
            <div className="text-xs text-slate-600 mt-1">View payments & delivery</div>
          </div>
        </div>
      );
    }

    if (row.key === "order-reports") {
      return (
        <div className="flex items-center gap-3">
          <BarChart3 className={tone.icon} />
          <div>
            <div className={`font-extrabold ${tone.title}`}>{getDisplayTitle(row)}</div>
            <div className="text-xs text-slate-600 mt-1">
              Revenue, products sold, trends & analytics
            </div>
          </div>
        </div>
      );
    }

    if (row.key === "analytics") {
      return (
        <div className="flex items-center gap-3">
          <TrendingUp className={tone.icon} />
          <div>
            <div className={`font-extrabold ${tone.title}`}>{getDisplayTitle(row)}</div>
            <div className="text-xs text-slate-600 mt-1">
              SEO, source buckets, UTM, referrers & attribution report
            </div>
          </div>
        </div>
      );
    }

    if (row.key === "youtube") {
      return (
        <div className="flex items-center gap-3">
          <Youtube className={tone.icon} />
          <div>
            <div className={`font-extrabold ${tone.title}`}>{getDisplayTitle(row)}</div>
            <div className="text-xs text-slate-600 mt-1">
              Generate video title, description, pinned comment & thumbnail
            </div>
          </div>
        </div>
      );
    }

    if (row.key === "blogs") {
      return (
        <div className="flex items-center gap-3">
          <FileText className={tone.icon} />
          <div>
            <div className={`font-extrabold ${tone.title}`}>{getDisplayTitle(row)}</div>
            <div className="text-xs text-slate-600 mt-1">
              Manage blog categories & posts
            </div>
          </div>
        </div>
      );
    }

    if (row.key === "admin-management") {
      return (
        <>
          <div className="flex items-center gap-3">
            <Users className={tone.icon} />
            <div className="min-w-0">
              <div className={`font-extrabold ${tone.title}`}>{getDisplayTitle(row)}</div>
              <div className="text-xs text-slate-600 mt-1">
                {isMaster
                  ? "Create / delete Co-Admins (Master only)"
                  : "Only Master can manage admins"}
              </div>
            </div>
          </div>

          <div className="mt-4">
            {isMaster ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white font-bold shadow-sm">
                Manage Admins
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-200 text-gray-500 font-bold">
                Master Only
              </div>
            )}
          </div>
        </>
      );
    }

    if (row.key === "site-settings") {
      return (
        <div className="flex items-center gap-3">
          <Settings className={tone.icon} />
          <div>
            <div className={`font-extrabold ${tone.title}`}>{getDisplayTitle(row)}</div>
            <div className="text-xs text-slate-600 mt-1">
              Hero, FAQ, Social links, Testimonials
            </div>
          </div>
        </div>
      );
    }

    if (row.key === "notifications") {
      return (
        <div className="flex items-center gap-3">
          <BellRing className={tone.icon} />
          <div>
            <div className={`font-extrabold ${tone.title}`}>{getDisplayTitle(row)}</div>
            <div className="text-xs text-slate-600 mt-1">
              Post-upload sync tasks, alerts, pending admin actions
            </div>
          </div>
        </div>
      );
    }

    if (row.key === "subjects") {
      return (
        <div className="flex items-center gap-3">
          <BookOpen className={tone.icon} />
          <div>
            <div className={`font-extrabold ${tone.title}`}>{getDisplayTitle(row)}</div>
            <div className="text-xs text-slate-600 mt-1">
              Codes + Titles (Excel upload)
            </div>
          </div>
        </div>
      );
    }

    if (row.key === "courses") {
      return (
        <div className="flex items-center gap-3">
          <GraduationCap className={tone.icon} />
          <div>
            <div className={`font-extrabold ${tone.title}`}>{getDisplayTitle(row)}</div>
            <div className="text-xs text-slate-600 mt-1">Codes + Title (single title)</div>
          </div>
        </div>
      );
    }

    if (row.key === "users") {
      return (
        <div className="flex items-center gap-3">
          <UserCircle2 className={tone.icon} />
          <div>
            <div className={`font-extrabold ${tone.title}`}>{getDisplayTitle(row)}</div>
            <div className="text-xs text-slate-600 mt-1">
              Customers list + order count
            </div>
          </div>
        </div>
      );
    }

    if (row.key === "sessions") {
      return (
        <div className="flex items-center gap-3">
          <CalendarDays className={tone.icon} />
          <div>
            <div className={`font-extrabold ${tone.title}`}>{getDisplayTitle(row)}</div>
            <div className="text-xs text-slate-600 mt-1">Smart sessions by category</div>
          </div>
        </div>
      );
    }

    if (row.key === "lalita") {
      return (
        <div className="flex items-center gap-3">
          <FileArchive className={tone.icon} />
          <div>
            <div className={`font-extrabold ${tone.title}`}>{getDisplayTitle(row)}</div>
            <div className="text-xs text-slate-600 mt-1">
              Hidden secure bulk PDF upload page
            </div>
          </div>
        </div>
      );
    }

    if (row.key === "official-papers") {
      return (
        <div className="flex items-center gap-3">
          <FolderOpen className={tone.icon} />
          <div>
            <div className={`font-extrabold ${tone.title}`}>{getDisplayTitle(row)}</div>
            <div className="text-xs text-slate-600 mt-1">
              Upload official / unsolved papers by SKU
            </div>
          </div>
        </div>
      );
    }

    if (row.key === "product-pricing") {
      return (
        <div className="flex items-center gap-3">
          <IndianRupee className={tone.icon} />
          <div>
            <div className={`font-extrabold ${tone.title}`}>{getDisplayTitle(row)}</div>
            <div className="text-xs text-slate-600 mt-1">
              Category + course pricing rules & product overrides
            </div>
          </div>
        </div>
      );
    }

    if (row.key === "on-demand-timing-rules") {
      return (
        <div className="flex items-center gap-3">
          <Clock3 className={tone.icon} />
          <div>
            <div className={`font-extrabold ${tone.title}`}>{getDisplayTitle(row)}</div>
            <div className="text-xs text-slate-600 mt-1">
              Category default + course-wise timer configuration
            </div>
          </div>
        </div>
      );
    }

    if (row.key === "dashboard-tile-order") {
      return (
        <div className="flex items-center gap-3">
          <SlidersHorizontal className={tone.icon} />
          <div>
            <div className={`font-extrabold ${tone.title}`}>{getDisplayTitle(row)}</div>
            <div className="text-xs text-slate-600 mt-1">
              Set tile order, names, and visibility
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3">
        <Package className={tone.icon} />
        <div>
          <div className={`font-extrabold ${tone.title}`}>{getDisplayTitle(row)}</div>
          <div className="text-xs text-slate-600 mt-1">{row.description}</div>
        </div>
      </div>
    );
  }

  function getTileWrapClass(row: EditorRow) {
    if (row.key === "on-demand-orders" && row.tone === "default") {
      return `${onDemandTileTone.wrap} ${emergencyClass}`;
    }
    return getToneClasses(row).wrap;
  }

  function renderEditableTile(row: EditorRow, index: number) {
    const isDragging = draggingKey === row.key;
    const isDragOver = dragOverKey === row.key;

    return (
      <div
        key={row.key}
        draggable={!row.fixedLast}
        onDragStart={() => handleDragStart(row.key)}
        onDragOver={(e) => handleDragOver(e, row.key)}
        onDrop={() => handleDrop(row.key)}
        onDragEnd={handleDragEnd}
        className={`relative rounded-2xl border transition p-5 shadow-sm overflow-hidden ${
          getTileWrapClass(row)
        } ${
          row.hidden ? "opacity-55 saturate-75" : ""
        } ${
          isDragging ? "scale-[0.985] ring-2 ring-slate-300" : ""
        } ${
          isDragOver ? "ring-2 ring-blue-400 ring-offset-2" : ""
        }`}
      >
        <div className="absolute left-3 top-3 z-[2] flex items-center gap-2">
          <div
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold border shadow-sm ${
              row.fixedLast
                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                : "bg-white/90 text-slate-700 border-slate-200"
            }`}
          >
            <GripVertical size={12} />
            {row.fixedLast ? "FIXED LAST" : `DRAG ${index + 1}`}
          </div>

          {row.hidden ? (
            <div className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold border shadow-sm bg-red-50 text-red-700 border-red-200">
              <EyeOff size={12} />
              HIDDEN
            </div>
          ) : null}
        </div>

        <div className="min-h-[112px] pt-7">{renderTileVisual(row)}</div>

        <div className="mt-4 rounded-2xl border border-white/80 bg-white/85 p-3 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
              Live Tile Controls
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {row.fixedLast ? (
                <div className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Always last
                </div>
              ) : null}

              {!csLoading && row.key === "on-demand-orders" ? (
                <div
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold border ${
                    comingSoonEnabled
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
                >
                  Coming Soon: {comingSoonEnabled ? "ON" : "OFF"}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-3">
            <label className="mb-1.5 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
              <Type size={12} />
              Tile UI Name
            </label>

            <input
              type="text"
              value={row.customTitle}
              onChange={(e) => updateCustomTitle(row.key, e.target.value)}
              placeholder={row.defaultTitle}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-400"
            />
          </div>

          <div className="mt-3">
            <label className="mb-1.5 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
              <Palette size={12} />
              Light Colour
            </label>

            <select
              value={row.tone}
              onChange={(e) => updateTone(row.key, e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-400"
            >
              {ADMIN_DASHBOARD_TILE_TONE_OPTIONS.map((tone) => (
                <option key={tone.value} value={tone.value}>
                  {tone.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => toggleHidden(row.key)}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold transition ${
                row.hidden
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
              }`}
            >
              {row.hidden ? <Eye size={15} /> : <EyeOff size={15} />}
              {row.hidden ? "Unhide" : "Hide"}
            </button>

            <button
              type="button"
              onClick={() => resetSingleName(row.key)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <Undo2 size={15} />
              Reset Name
            </button>
          </div>
        </div>
      </div>
    );
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
                <SlidersHorizontal className="text-indigo-700" />
                Dashboard Tile Designer
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Same admin-card design ke saath direct drag, rename, light colour, aur hide/unhide controls.
                Changes automatically admin panel par apply ho jayengi.
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <ArrowLeft size={18} />
                Back to Admin
              </Link>

              <button
                type="button"
                onClick={handleResetNames}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <Undo2 size={18} />
                Reset Names
              </button>

              <button
                type="button"
                onClick={handleResetAll}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <RotateCcw size={18} />
                Reset All
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="text-sm text-indigo-900 font-semibold leading-6">
                Jis card ko upar ya neeche chahiye usko drag kijiye. Card ke andar hi rename, light colour aur hide/unhide options diye gaye hain.
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-extrabold bg-white text-slate-700 border border-slate-200">
                  Visible: {visibleCount}
                </div>
                <div className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-extrabold bg-white text-red-700 border border-red-200">
                  Hidden: {hiddenCount}
                </div>
              </div>
            </div>
          </div>

          {msg ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              {msg}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center font-semibold text-slate-600">
              Loading...
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {rows.map((row, index) => renderEditableTile(row, index))}
            </div>
          )}

          <div className="mt-6 text-xs text-slate-500 leading-6">
            Note: Hidden tile admin panel se disappear ho jayegi, lekin direct URL active rahega.
            Fixed Last tile visible hone par hamesha end me hi rahegi.
          </div>
        </div>
      </div>
    </main>
  );
}