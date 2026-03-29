"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Download,
  FolderSearch,
  ImageIcon,
  ImageOff,
  Layers3,
  RefreshCcw,
  Search,
  CheckCircle2,
  Clock3,
  ShoppingCart,
} from "lucide-react";

type AvailabilityStats = {
  total: number;
  withImages: number;
  withoutImages: number;
};

type AvailabilityKey = "available" | "on_demand" | "want_to_buy";

type ReportRow = {
  category: string;
  totalProducts: number;
  withImages: number;
  withoutImages: number;
  availability: {
    available: AvailabilityStats;
    on_demand: AvailabilityStats;
    want_to_buy: AvailabilityStats;
  };
};

type ReportResponse = {
  ok?: boolean;
  summary?: {
    totalProducts?: number;
    productsWithImages?: number;
    productsWithoutImages?: number;
    totalCategories?: number;
    availability?: {
      available?: AvailabilityStats;
      on_demand?: AvailabilityStats;
      want_to_buy?: AvailabilityStats;
    };
  };
  categories?: ReportRow[];
  imageDetectionRule?: string;
  availabilityRule?: string;
  downloadRule?: string;
  error?: string;
};

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function getFileNameFromDisposition(headerValue: string | null, fallback: string) {
  const raw = safeStr(headerValue);
  if (!raw) return fallback;

  const utfMatch = raw.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]);
    } catch {
      return utfMatch[1];
    }
  }

  const plainMatch = raw.match(/filename="?([^"]+)"?/i);
  if (plainMatch?.[1]) return plainMatch[1];

  return fallback;
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "emerald" | "rose";
}) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "rose"
        ? "bg-rose-100 text-rose-800"
        : "bg-slate-100 text-slate-800";

  return (
    <div className={`inline-flex items-center rounded-xl px-3 py-1.5 text-sm font-extrabold ${toneClass}`}>
      {label}: {value}
    </div>
  );
}

function AvailabilityMiniCard({
  title,
  total,
  withImages,
  withoutImages,
  tone,
}: {
  title: string;
  total: number;
  withImages: number;
  withoutImages: number;
  tone: "green" | "amber" | "rose";
}) {
  const cardClass =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50"
        : "border-rose-200 bg-rose-50";

  const titleClass =
    tone === "green"
      ? "text-emerald-900"
      : tone === "amber"
        ? "text-amber-900"
        : "text-rose-900";

  const textClass =
    tone === "green"
      ? "text-emerald-800"
      : tone === "amber"
        ? "text-amber-800"
        : "text-rose-800";

  return (
    <div className={`rounded-2xl border p-4 ${cardClass}`}>
      <div className={`text-sm font-extrabold ${titleClass}`}>{title}</div>
      <div className={`mt-3 space-y-2 text-sm ${textClass}`}>
        <div>
          Total: <b>{total}</b>
        </div>
        <div>
          Image Attached: <b>{withImages}</b>
        </div>
        <div>
          Image Missing: <b>{withoutImages}</b>
        </div>
      </div>
    </div>
  );
}

export default function BulkImagesReportPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingKey, setDownloadingKey] = useState("");
  const [search, setSearch] = useState("");

  const [data, setData] = useState<ReportResponse>({
    summary: {
      totalProducts: 0,
      productsWithImages: 0,
      productsWithoutImages: 0,
      totalCategories: 0,
      availability: {
        available: { total: 0, withImages: 0, withoutImages: 0 },
        on_demand: { total: 0, withImages: 0, withoutImages: 0 },
        want_to_buy: { total: 0, withImages: 0, withoutImages: 0 },
      },
    },
    categories: [],
    imageDetectionRule: "",
    availabilityRule: "",
    downloadRule: "",
  });

  async function loadReport(silent = false) {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await fetch("/api/admin/products/bulk-images/report", {
        credentials: "include",
        cache: "no-store",
      });

      const json: ReportResponse = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        alert(json?.error || "Report load failed");
        return;
      }

      setData({
        summary: {
          totalProducts: safeNum(json.summary?.totalProducts),
          productsWithImages: safeNum(json.summary?.productsWithImages),
          productsWithoutImages: safeNum(json.summary?.productsWithoutImages),
          totalCategories: safeNum(json.summary?.totalCategories),
          availability: {
            available: {
              total: safeNum(json.summary?.availability?.available?.total),
              withImages: safeNum(json.summary?.availability?.available?.withImages),
              withoutImages: safeNum(json.summary?.availability?.available?.withoutImages),
            },
            on_demand: {
              total: safeNum(json.summary?.availability?.on_demand?.total),
              withImages: safeNum(json.summary?.availability?.on_demand?.withImages),
              withoutImages: safeNum(json.summary?.availability?.on_demand?.withoutImages),
            },
            want_to_buy: {
              total: safeNum(json.summary?.availability?.want_to_buy?.total),
              withImages: safeNum(json.summary?.availability?.want_to_buy?.withImages),
              withoutImages: safeNum(json.summary?.availability?.want_to_buy?.withoutImages),
            },
          },
        },
        categories: Array.isArray(json.categories) ? json.categories : [],
        imageDetectionRule: safeStr(json.imageDetectionRule),
        availabilityRule: safeStr(json.availabilityRule),
        downloadRule: safeStr(json.downloadRule),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function downloadMissingSkuExcel(category: string, availability: AvailabilityKey) {
    if (!safeStr(category)) return;

    const key = `${category}__${availability}`;
    setDownloadingKey(key);

    try {
      const res = await fetch(
        `/api/admin/products/bulk-images/report?download=1&category=${encodeURIComponent(category)}&availability=${encodeURIComponent(availability)}`,
        {
          credentials: "include",
          cache: "no-store",
        }
      );

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert((json as any)?.error || "Download failed");
        return;
      }

      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);

      const fileName = getFileNameFromDisposition(
        res.headers.get("content-disposition"),
        "missing-product-images.xlsx"
      );

      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloadingKey("");
    }
  }

  useEffect(() => {
    void loadReport(false);
  }, []);

  const filteredRows = useMemo(() => {
    const q = safeStr(search).toLowerCase();
    const rows = Array.isArray(data.categories) ? data.categories : [];

    if (!q) return rows;

    return rows.filter((row) => safeStr(row.category).toLowerCase().includes(q));
  }, [data.categories, search]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-slate-700 font-bold">
        Loading product image report...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-extrabold text-blue-800">
                <BarChart3 size={14} />
                Product Images Report
              </div>

              <h1 className="text-2xl font-extrabold mt-3">
                Category-wise Product Image + Availability Status
              </h1>

              <p className="text-sm text-slate-600 mt-1">
                Yahan category wise total products, image attached products, image missing products,
                aur availability breakdown bhi show ho raha hai.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href="/admin/products/bulk/bulk-images"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <ArrowLeft size={18} />
                Back to Bulk Images
              </Link>

              <button
                type="button"
                onClick={() => loadReport(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm disabled:opacity-60"
              >
                <RefreshCcw size={18} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
                  <Layers3 size={20} />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Total Products
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900">
                    {safeNum(data.summary?.totalProducts)}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
                  <ImageIcon size={20} />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                    With Images
                  </div>
                  <div className="text-2xl font-extrabold text-emerald-900">
                    {safeNum(data.summary?.productsWithImages)}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center">
                  <ImageOff size={20} />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-rose-700">
                    Missing Images
                  </div>
                  <div className="text-2xl font-extrabold text-rose-900">
                    {safeNum(data.summary?.productsWithoutImages)}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
                  <FolderSearch size={20} />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-blue-700">
                    Categories
                  </div>
                  <div className="text-2xl font-extrabold text-blue-900">
                    {safeNum(data.summary?.totalCategories)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-emerald-900 font-extrabold">
                <CheckCircle2 size={18} />
                Available
              </div>
              <div className="mt-3 text-sm text-emerald-800 space-y-2">
                <div>
                  Total: <b>{safeNum(data.summary?.availability?.available?.total)}</b>
                </div>
                <div>
                  Image Attached: <b>{safeNum(data.summary?.availability?.available?.withImages)}</b>
                </div>
                <div>
                  Image Missing: <b>{safeNum(data.summary?.availability?.available?.withoutImages)}</b>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-amber-900 font-extrabold">
                <Clock3 size={18} />
                On Demand
              </div>
              <div className="mt-3 text-sm text-amber-800 space-y-2">
                <div>
                  Total: <b>{safeNum(data.summary?.availability?.on_demand?.total)}</b>
                </div>
                <div>
                  Image Attached: <b>{safeNum(data.summary?.availability?.on_demand?.withImages)}</b>
                </div>
                <div>
                  Image Missing: <b>{safeNum(data.summary?.availability?.on_demand?.withoutImages)}</b>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="flex items-center gap-2 text-rose-900 font-extrabold">
                <ShoppingCart size={18} />
                Want To Buy
              </div>
              <div className="mt-3 text-sm text-rose-800 space-y-2">
                <div>
                  Total: <b>{safeNum(data.summary?.availability?.want_to_buy?.total)}</b>
                </div>
                <div>
                  Image Attached: <b>{safeNum(data.summary?.availability?.want_to_buy?.withImages)}</b>
                </div>
                <div>
                  Image Missing: <b>{safeNum(data.summary?.availability?.want_to_buy?.withoutImages)}</b>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-extrabold text-amber-900">Image Detection Rule</div>
              <div className="text-sm text-amber-800 mt-2 leading-6">
                {safeStr(data.imageDetectionRule) ||
                  "Product ko image-attached tab maana gaya hai jab images array me image ho ya thumbnail/quick URL available ho."}
              </div>
            </div>

            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
              <div className="text-sm font-extrabold text-violet-900">Availability Logic</div>
              <div className="text-sm text-violet-800 mt-2 leading-6">
                {safeStr(data.availabilityRule) ||
                  "Availability breakdown me available, on_demand aur want_to_buy tino states alag-alag count ki gayi hain."}
              </div>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <div className="text-sm font-extrabold text-blue-900">Download Logic</div>
              <div className="text-sm text-blue-800 mt-2 leading-6">
                {safeStr(data.downloadRule) ||
                  "Har availability state ke missing-image SKU IDs alag Excel me download hongi."}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-extrabold text-slate-900">
                  Category-wise Detailed Report
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Har category me available, on-demand aur want-to-buy ki missing SKU list alag download hogi.
                </div>
              </div>

              <div className="relative w-full sm:w-[320px]">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search category..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white outline-none focus:border-blue-500 transition text-sm font-medium"
                />
              </div>
            </div>

            {filteredRows.length === 0 ? (
              <div className="p-8 text-slate-600 font-bold">
                {safeStr(search)
                  ? "Search ke according koi category nahi mili."
                  : "Abhi report me koi category available nahi hai."}
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {filteredRows.map((row) => {
                  const availableKey = `${row.category}__available`;
                  const onDemandKey = `${row.category}__on_demand`;
                  const wantToBuyKey = `${row.category}__want_to_buy`;

                  return (
                    <div
                      key={row.category}
                      className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                          <div className="text-lg font-extrabold text-slate-900 break-words">
                            {row.category}
                          </div>

                          <div className="mt-3 flex items-center gap-2 flex-wrap">
                            <StatPill label="Total" value={safeNum(row.totalProducts)} tone="slate" />
                            <StatPill label="Image Attached" value={safeNum(row.withImages)} tone="emerald" />
                            <StatPill label="Image Missing" value={safeNum(row.withoutImages)} tone="rose" />
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <AvailabilityMiniCard
                          title="Available"
                          total={safeNum(row.availability?.available?.total)}
                          withImages={safeNum(row.availability?.available?.withImages)}
                          withoutImages={safeNum(row.availability?.available?.withoutImages)}
                          tone="green"
                        />

                        <AvailabilityMiniCard
                          title="On Demand"
                          total={safeNum(row.availability?.on_demand?.total)}
                          withImages={safeNum(row.availability?.on_demand?.withImages)}
                          withoutImages={safeNum(row.availability?.on_demand?.withoutImages)}
                          tone="amber"
                        />

                        <AvailabilityMiniCard
                          title="Want To Buy"
                          total={safeNum(row.availability?.want_to_buy?.total)}
                          withImages={safeNum(row.availability?.want_to_buy?.withImages)}
                          withoutImages={safeNum(row.availability?.want_to_buy?.withoutImages)}
                          tone="rose"
                        />
                      </div>

                      <div className="mt-5 flex items-center gap-3 flex-wrap">
                        <button
                          type="button"
                          onClick={() => downloadMissingSkuExcel(row.category, "available")}
                          disabled={
                            safeNum(row.availability?.available?.withoutImages) <= 0 ||
                            Boolean(downloadingKey)
                          }
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold shadow-sm disabled:opacity-50"
                        >
                          <Download size={16} />
                          {downloadingKey === availableKey
                            ? "Downloading..."
                            : "Download Available SKU"}
                        </button>

                        <button
                          type="button"
                          onClick={() => downloadMissingSkuExcel(row.category, "on_demand")}
                          disabled={
                            safeNum(row.availability?.on_demand?.withoutImages) <= 0 ||
                            Boolean(downloadingKey)
                          }
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-extrabold shadow-sm disabled:opacity-50"
                        >
                          <Download size={16} />
                          {downloadingKey === onDemandKey
                            ? "Downloading..."
                            : "Download On Demand SKU"}
                        </button>

                        <button
                          type="button"
                          onClick={() => downloadMissingSkuExcel(row.category, "want_to_buy")}
                          disabled={
                            safeNum(row.availability?.want_to_buy?.withoutImages) <= 0 ||
                            Boolean(downloadingKey)
                          }
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-extrabold shadow-sm disabled:opacity-50"
                        >
                          <Download size={16} />
                          {downloadingKey === wantToBuyKey
                            ? "Downloading..."
                            : "Download Want To Buy SKU"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}