"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  RotateCcw,
  Save,
  SlidersHorizontal,
  GripVertical,
  Eye,
  EyeOff,
  Undo2,
} from "lucide-react";
import {
  ADMIN_DASHBOARD_TILE_STORAGE_KEY,
  ADMIN_DASHBOARD_TILES,
  getAdminDashboardTileDisplayTitle,
  getAdminDashboardTilesInOrder,
  getDefaultAdminDashboardTileSettings,
  normalizeAdminDashboardTileSettings,
  type AdminDashboardTileKey,
  type AdminDashboardTileSettings,
} from "@/lib/adminDashboardTiles";

type EditorRow = {
  key: AdminDashboardTileKey;
  defaultTitle: string;
  customTitle: string;
  description: string;
  position: number;
  hidden: boolean;
  fixedLast: boolean;
};

function buildRowsFromSettings(settings: AdminDashboardTileSettings): EditorRow[] {
  const rank = new Map<AdminDashboardTileKey, number>();
  settings.order.forEach((key, index) => rank.set(key, index));

  return ADMIN_DASHBOARD_TILES.map((tile, index) => ({
    key: tile.key,
    defaultTitle: tile.defaultTitle,
    customTitle: String(settings.labelOverrides[tile.key] ?? ""),
    description: tile.description,
    position: (rank.get(tile.key) ?? index) + 1,
    hidden: settings.hiddenKeys.includes(tile.key),
    fixedLast: !!tile.fixedLast,
  }));
}

function buildSettingsFromRows(rows: EditorRow[]): AdminDashboardTileSettings {
  const defaultOrder = getDefaultAdminDashboardTileSettings().order;
  const defaultRank = new Map<AdminDashboardTileKey, number>();
  defaultOrder.forEach((key, index) => defaultRank.set(key, index));

  const normalRows = rows.filter((row) => !row.fixedLast);
  const fixedLastRows = rows.filter((row) => row.fixedLast);

  const sortedNormal = [...normalRows].sort((a, b) => {
    const aPos = Math.max(1, Math.trunc(Number(a.position) || 1));
    const bPos = Math.max(1, Math.trunc(Number(b.position) || 1));
    if (aPos !== bPos) return aPos - bPos;
    return (defaultRank.get(a.key) ?? 999) - (defaultRank.get(b.key) ?? 999);
  });

  const sortedFixedLast = [...fixedLastRows].sort((a, b) => {
    return (defaultRank.get(a.key) ?? 999) - (defaultRank.get(b.key) ?? 999);
  });

  const order = [...sortedNormal, ...sortedFixedLast].map((row) => row.key);

  const hiddenKeys = rows
    .filter((row) => row.hidden)
    .map((row) => row.key);

  const labelOverrides: Partial<Record<AdminDashboardTileKey, string>> = {};
  for (const row of rows) {
    const value = String(row.customTitle || "").trim();
    if (!value) continue;
    if (value === row.defaultTitle) continue;
    labelOverrides[row.key] = value;
  }

  return normalizeAdminDashboardTileSettings({
    order,
    hiddenKeys,
    labelOverrides,
  });
}

export default function DashboardTileOrderPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EditorRow[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          router.push("/login");
          return;
        }
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
      setRows(buildRowsFromSettings(normalized));
      window.localStorage.setItem(
        ADMIN_DASHBOARD_TILE_STORAGE_KEY,
        JSON.stringify(normalized)
      );
    } catch {
      const defaults = getDefaultAdminDashboardTileSettings();
      setRows(buildRowsFromSettings(defaults));
      window.localStorage.setItem(
        ADMIN_DASHBOARD_TILE_STORAGE_KEY,
        JSON.stringify(defaults)
      );
    }
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 1800);
    return () => clearTimeout(t);
  }, [msg]);

  const liveSettings = useMemo(() => {
    return buildSettingsFromRows(rows);
  }, [rows]);

  const previewVisibleTiles = useMemo(() => {
    return getAdminDashboardTilesInOrder(liveSettings);
  }, [liveSettings]);

  const hiddenRows = useMemo(() => {
    return rows.filter((row) => row.hidden);
  }, [rows]);

  function updatePosition(key: AdminDashboardTileKey, value: string) {
    const num = Math.max(1, Math.trunc(Number(value || 1) || 1));
    setRows((prev) =>
      prev.map((row) =>
        row.key === key ? { ...row, position: num } : row
      )
    );
  }

  function updateCustomTitle(key: AdminDashboardTileKey, value: string) {
    setRows((prev) =>
      prev.map((row) =>
        row.key === key ? { ...row, customTitle: value } : row
      )
    );
  }

  function toggleHidden(key: AdminDashboardTileKey) {
    setRows((prev) =>
      prev.map((row) =>
        row.key === key ? { ...row, hidden: !row.hidden } : row
      )
    );
  }

  function resetSingleName(key: AdminDashboardTileKey) {
    setRows((prev) =>
      prev.map((row) =>
        row.key === key ? { ...row, customTitle: "" } : row
      )
    );
  }

  function handleSave() {
    if (typeof window === "undefined") return;

    const normalized = buildSettingsFromRows(rows);
    window.localStorage.setItem(
      ADMIN_DASHBOARD_TILE_STORAGE_KEY,
      JSON.stringify(normalized)
    );
    setRows(buildRowsFromSettings(normalized));
    setMsg("Dashboard tile settings saved");
  }

  function handleResetNames() {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        customTitle: "",
      }))
    );
    setMsg("Custom UI names restored to original");
  }

  function handleResetAll() {
    if (typeof window === "undefined") return;

    const defaults = getDefaultAdminDashboardTileSettings();
    window.localStorage.setItem(
      ADMIN_DASHBOARD_TILE_STORAGE_KEY,
      JSON.stringify(defaults)
    );
    setRows(buildRowsFromSettings(defaults));
    setMsg("Default tile settings restored");
  }

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-2xl font-extrabold flex items-center gap-2">
                <SlidersHorizontal className="text-slate-700" />
                Dashboard Tile Control
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Change UI names, set order numbers, and hide or unhide tiles.
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

              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-semibold shadow-sm"
              >
                <Save size={18} />
                Save Settings
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Only the dashboard UI name changes here. Actual routes, actual page names,
            and backend logic remain unchanged. Hidden tiles disappear from the admin
            panel, but they can still be opened directly from their URL.
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
            <div className="mt-6 grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-lg font-extrabold text-slate-900 mb-4">
                  Tile Controls
                </div>

                <div className="space-y-3">
                  {rows.map((row) => (
                    <div
                      key={row.key}
                      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-11 w-11 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                          <GripVertical size={18} className="text-slate-600" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="font-extrabold text-slate-900">
                            {row.defaultTitle}
                          </div>
                          <div className="text-xs text-slate-600 mt-1">
                            {row.description}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            Key: {row.key}
                          </div>

                          <div className="mt-3 grid md:grid-cols-[110px_1fr_auto_auto] gap-3 items-end">
                            <div>
                              <label className="block text-[11px] font-extrabold uppercase tracking-wide text-slate-500 mb-1">
                                Position
                              </label>
                              <input
                                type="number"
                                min={1}
                                disabled={row.fixedLast}
                                value={row.fixedLast ? "" : row.position}
                                onChange={(e) =>
                                  updatePosition(row.key, e.target.value)
                                }
                                placeholder={row.fixedLast ? "Last" : "1"}
                                className={`w-full h-11 rounded-xl border border-gray-200 px-3 outline-none bg-white font-bold text-slate-900 ${
                                  row.fixedLast ? "cursor-not-allowed text-slate-400 bg-slate-50" : "focus:border-slate-400"
                                }`}
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-extrabold uppercase tracking-wide text-slate-500 mb-1">
                                UI Name
                              </label>
                              <input
                                type="text"
                                value={row.customTitle}
                                onChange={(e) =>
                                  updateCustomTitle(row.key, e.target.value)
                                }
                                placeholder={row.defaultTitle}
                                className="w-full h-11 rounded-xl border border-gray-200 px-3 outline-none focus:border-slate-400 bg-white font-semibold text-slate-900"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => resetSingleName(row.key)}
                              className="h-11 px-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition font-semibold text-slate-700"
                            >
                              Reset Name
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleHidden(row.key)}
                              className={`h-11 px-4 rounded-xl transition font-semibold ${
                                row.hidden
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                  : "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                              }`}
                            >
                              {row.hidden ? (
                                <span className="inline-flex items-center gap-2">
                                  <Eye size={16} />
                                  Unhide
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-2">
                                  <EyeOff size={16} />
                                  Hide
                                </span>
                              )}
                            </button>
                          </div>

                          {row.fixedLast ? (
                            <div className="mt-2 text-[11px] font-semibold text-indigo-700">
                              This tile stays at the last position whenever it is visible.
                            </div>
                          ) : null}

                          {row.hidden ? (
                            <div className="mt-2 text-[11px] font-semibold text-red-600">
                              Hidden from admin panel. It can still be opened directly by URL.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="text-lg font-extrabold text-slate-900 mb-4">
                    Visible Preview
                  </div>

                  <div className="space-y-3">
                    {previewVisibleTiles.map((tile, index) => (
                      <div
                        key={tile.key}
                        className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-extrabold text-slate-900">
                              {index + 1}.{" "}
                              {getAdminDashboardTileDisplayTitle(tile.key, liveSettings)}
                            </div>
                            <div className="text-xs text-slate-600 mt-1">
                              {tile.description}
                            </div>
                          </div>

                          {tile.fixedLast ? (
                            <div className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold bg-indigo-50 border border-indigo-200 text-indigo-700 shrink-0">
                              Fixed Last
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}

                    {previewVisibleTiles.length === 0 ? (
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-slate-600 text-center">
                        No visible tiles right now.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="text-lg font-extrabold text-slate-900 mb-4">
                    Hidden Tiles
                  </div>

                  <div className="space-y-3">
                    {hiddenRows.map((row) => (
                      <div
                        key={row.key}
                        className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3"
                      >
                        <div className="font-extrabold text-red-900">
                          {row.customTitle.trim() || row.defaultTitle}
                        </div>
                        <div className="text-xs text-red-700 mt-1">
                          URL remains active: {ADMIN_DASHBOARD_TILES.find((x) => x.key === row.key)?.href || "-"}
                        </div>
                      </div>
                    ))}

                    {hiddenRows.length === 0 ? (
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-slate-600 text-center">
                        No hidden tiles.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <div className="font-extrabold text-blue-900">
                    Advanced behavior included
                  </div>
                  <div className="text-sm text-blue-800 mt-2 leading-relaxed">
                    New tiles added later in the shared registry will automatically
                    appear here. You can then assign a number, rename the UI label,
                    or hide them whenever needed.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}