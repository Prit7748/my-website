"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  RefreshCcw,
  TrendingUp,
  Search,
  Globe,
  Share2,
  Link2,
  CalendarDays,
  ShoppingCart,
  IndianRupee,
  ShieldCheck,
  AlertCircle,
  Youtube,
  MessageCircle,
  Facebook,
  Instagram,
  ExternalLink,
} from "lucide-react";

type SourceBucketRow = {
  sourceBucket: string;
  orderCount: number;
  revenue: number;
  orderSharePct: number;
  revenueSharePct: number;
};

type DetectedSourceRow = {
  detectedSource: string;
  orderCount: number;
  revenue: number;
  orderSharePct: number;
  revenueSharePct: number;
};

type UtmSourceRow = {
  utmSource: string;
  orderCount: number;
  revenue: number;
  orderSharePct: number;
  revenueSharePct: number;
};

type UtmMediumRow = {
  utmMedium: string;
  orderCount: number;
  revenue: number;
  orderSharePct: number;
  revenueSharePct: number;
};

type UtmCampaignRow = {
  utmCampaign: string;
  orderCount: number;
  revenue: number;
  orderSharePct: number;
  revenueSharePct: number;
};

type ReferrerRow = {
  referrerHost: string;
  orderCount: number;
  revenue: number;
  orderSharePct: number;
  revenueSharePct: number;
};

type DailyTrendRow = {
  day: string;
  orderCount: number;
  revenue: number;
};

type RecentOrderRow = {
  orderId: string;
  orderRef: string;
  paidAt: string | null;
  totalAmount: number;
  sourceBucket: string;
  detectedSource: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  referrerHost: string;
  hasAnalytics: boolean;
  itemCount: number;
};

type AnalyticsResponse = {
  ok?: boolean;
  error?: string;
  details?: string;
  range?: {
    days: number;
    since: string;
    until: string;
  };
  overview?: {
    totalOrders: number;
    totalRevenue: number;
    attributedOrders: number;
    unattributedOrders: number;
  };
  insights?: {
    topSourceBucket: string;
    topSourceOrders: number;
    topSourceRevenue: number;
    attributionCoveragePct: number;
    directOrders: number;
    googleOrders: number;
    youtubeOrders: number;
    instagramOrders: number;
    whatsappOrders: number;
    facebookOrders: number;
    referralOrders: number;
    otherOrders: number;
  };
  sourceBuckets?: SourceBucketRow[];
  detectedSources?: DetectedSourceRow[];
  utmSources?: UtmSourceRow[];
  utmMediums?: UtmMediumRow[];
  utmCampaigns?: UtmCampaignRow[];
  referrers?: ReferrerRow[];
  dailyTrend?: DailyTrendRow[];
  recentOrders?: RecentOrderRow[];
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function money(n: number) {
  try {
    return new Intl.NumberFormat("en-IN").format(Number(n || 0));
  } catch {
    return String(n);
  }
}

function pct(n: number) {
  return `${safeNum(n, 0).toFixed(2)}%`;
}

function fmtDateTime(v?: string | null) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("en-IN");
  } catch {
    return String(v);
  }
}

function fmtDateOnly(v?: string | null) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(v);
  }
}

function sourceLabel(v: string) {
  const s = safeStr(v).toLowerCase();
  if (!s) return "Unknown";
  if (s === "google") return "Google";
  if (s === "youtube") return "YouTube";
  if (s === "instagram") return "Instagram";
  if (s === "whatsapp") return "WhatsApp";
  if (s === "facebook") return "Facebook";
  if (s === "direct") return "Direct";
  if (s === "referral") return "Referral";
  if (s === "other") return "Other";
  if (s === "unknown") return "Unknown";
  return s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function bucketBadgeClass(v: string) {
  const s = safeStr(v).toLowerCase();
  if (s === "google") return "bg-blue-50 text-blue-700 border-blue-200";
  if (s === "youtube") return "bg-rose-50 text-rose-700 border-rose-200";
  if (s === "instagram") return "bg-pink-50 text-pink-700 border-pink-200";
  if (s === "whatsapp") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "facebook") return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (s === "direct") return "bg-slate-100 text-slate-700 border-slate-200";
  if (s === "referral") return "bg-amber-50 text-amber-700 border-amber-200";
  if (s === "other") return "bg-violet-50 text-violet-700 border-violet-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
}

function BucketIcon({ bucket }: { bucket: string }) {
  const s = safeStr(bucket).toLowerCase();

  if (s === "google") return <Search size={15} />;
  if (s === "youtube") return <Youtube size={15} />;
  if (s === "instagram") return <Instagram size={15} />;
  if (s === "whatsapp") return <MessageCircle size={15} />;
  if (s === "facebook") return <Facebook size={15} />;
  if (s === "referral") return <ExternalLink size={15} />;
  if (s === "direct") return <Globe size={15} />;
  return <Share2 size={15} />;
}

function SectionCard({
  title,
  subtitle,
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white">
        <div>
          <h2 className="text-base md:text-lg font-extrabold text-slate-900">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-xs md:text-sm font-semibold text-slate-500">{subtitle}</p>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [top, setTop] = useState(8);
  const [recent, setRecent] = useState(15);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [data, setData] = useState<AnalyticsResponse | null>(null);

  const loadAnalytics = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      try {
        if (mode === "initial") setLoading(true);
        if (mode === "refresh") setRefreshing(true);
        setError("");

        const qs = new URLSearchParams({
          days: String(days),
          top: String(top),
          recent: String(recent),
        });

        const res = await fetch(`/api/admin/analytics?${qs.toString()}`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const json: AnalyticsResponse = await res.json().catch(() => ({}));

        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || json?.details || "Failed to load analytics");
        }

        setData(json);
      } catch (e: any) {
        setData(null);
        setError(e?.message || "Failed to load analytics");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [days, top, recent]
  );

  useEffect(() => {
    loadAnalytics("initial");
  }, [loadAnalytics]);

  const overview = data?.overview || {
    totalOrders: 0,
    totalRevenue: 0,
    attributedOrders: 0,
    unattributedOrders: 0,
  };

  const insights = data?.insights || {
    topSourceBucket: "unknown",
    topSourceOrders: 0,
    topSourceRevenue: 0,
    attributionCoveragePct: 0,
    directOrders: 0,
    googleOrders: 0,
    youtubeOrders: 0,
    instagramOrders: 0,
    whatsappOrders: 0,
    facebookOrders: 0,
    referralOrders: 0,
    otherOrders: 0,
  };

  const sourceBuckets = data?.sourceBuckets || [];
  const detectedSources = data?.detectedSources || [];
  const utmSources = data?.utmSources || [];
  const utmMediums = data?.utmMediums || [];
  const utmCampaigns = data?.utmCampaigns || [];
  const referrers = data?.referrers || [];
  const dailyTrend = data?.dailyTrend || [];
  const recentOrders = data?.recentOrders || [];

  const maxDailyOrders = useMemo(() => {
    return dailyTrend.reduce((m, x) => Math.max(m, safeNum(x.orderCount, 0)), 0);
  }, [dailyTrend]);

  const performanceCards = [
    {
      title: "Total Paid Orders",
      value: overview.totalOrders,
      icon: ShoppingCart,
      tone: "bg-blue-50 text-blue-700 border-blue-200",
    },
    {
      title: "Total Revenue",
      value: `₹${money(overview.totalRevenue)}`,
      icon: IndianRupee,
      tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    {
      title: "Attributed Orders",
      value: overview.attributedOrders,
      icon: ShieldCheck,
      tone: "bg-violet-50 text-violet-700 border-violet-200",
    },
    {
      title: "Attribution Coverage",
      value: pct(insights.attributionCoveragePct),
      icon: TrendingUp,
      tone: "bg-amber-50 text-amber-700 border-amber-200",
    },
  ];

  const channelCards = [
    { key: "google", label: "Google", value: insights.googleOrders },
    { key: "youtube", label: "YouTube", value: insights.youtubeOrders },
    { key: "instagram", label: "Instagram", value: insights.instagramOrders },
    { key: "whatsapp", label: "WhatsApp", value: insights.whatsappOrders },
    { key: "facebook", label: "Facebook", value: insights.facebookOrders },
    { key: "direct", label: "Direct", value: insights.directOrders },
    { key: "referral", label: "Referral", value: insights.referralOrders },
    { key: "other", label: "Other", value: insights.otherOrders },
  ];

  return (
    <main className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-[1600px] mx-auto px-4 py-6 md:py-8 space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-sm font-extrabold text-blue-700 hover:underline"
            >
              <ArrowLeft size={16} />
              Back to Admin
            </Link>
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <div className="h-12 w-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                <BarChart3 size={22} />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">
                  SEO / Source Analytics
                </h1>
                <p className="mt-1 text-sm md:text-base font-semibold text-slate-500">
                  Order attribution report for direct, Google, YouTube, Instagram, WhatsApp, Facebook, referral and other channels.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div>
              <label className="block text-[11px] uppercase tracking-wide font-extrabold text-slate-500 mb-1">
                Days
              </label>
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-500"
              >
                <option value={7}>7 days</option>
                <option value={15}>15 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
                <option value={180}>180 days</option>
                <option value={365}>365 days</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wide font-extrabold text-slate-500 mb-1">
                Top Rows
              </label>
              <select
                value={top}
                onChange={(e) => setTop(Number(e.target.value))}
                className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-500"
              >
                <option value={5}>Top 5</option>
                <option value={8}>Top 8</option>
                <option value={10}>Top 10</option>
                <option value={15}>Top 15</option>
                <option value={20}>Top 20</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wide font-extrabold text-slate-500 mb-1">
                Recent Orders
              </label>
              <select
                value={recent}
                onChange={(e) => setRecent(Number(e.target.value))}
                className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-500"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
              </select>
            </div>

            <button
              onClick={() => loadAnalytics("refresh")}
              disabled={refreshing}
              className={`inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl text-sm font-extrabold transition ${
                refreshing
                  ? "bg-blue-400 text-white cursor-wait"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              <RefreshCcw size={16} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {data?.range ? (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900 flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="inline-flex items-center gap-2">
              <CalendarDays size={16} />
              Window: {data.range.days} days
            </span>
            <span>From: {fmtDateOnly(data.range.since)}</span>
            <span>To: {fmtDateOnly(data.range.until)}</span>
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="text-lg font-extrabold text-slate-900">Loading analytics...</div>
            <div className="mt-2 text-sm font-semibold text-slate-500">
              Please wait while the report is being prepared.
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="text-rose-700 mt-0.5">
                <AlertCircle size={20} />
              </div>
              <div>
                <div className="text-lg font-extrabold text-rose-900">Analytics load failed</div>
                <div className="mt-1 text-sm font-semibold text-rose-800">{error}</div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {performanceCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.title}
                    className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-wide font-extrabold text-slate-500">
                          {card.title}
                        </div>
                        <div className="mt-3 text-2xl md:text-3xl font-extrabold text-slate-900">
                          {card.value}
                        </div>
                      </div>
                      <div
                        className={`h-11 w-11 rounded-2xl border flex items-center justify-center ${card.tone}`}
                      >
                        <Icon size={20} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-8 space-y-6">
                <SectionCard
                  title="Orders by Source Bucket"
                  subtitle="This is the main channel summary for paid orders."
                >
                  {sourceBuckets.length === 0 ? (
                    <div className="text-sm font-semibold text-slate-500">No source data found yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px]">
                        <thead>
                          <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                            <th className="pb-3 pr-4 font-extrabold">Source</th>
                            <th className="pb-3 pr-4 font-extrabold">Orders</th>
                            <th className="pb-3 pr-4 font-extrabold">Order Share</th>
                            <th className="pb-3 pr-4 font-extrabold">Revenue</th>
                            <th className="pb-3 pr-4 font-extrabold">Revenue Share</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sourceBuckets.map((row) => (
                            <tr key={row.sourceBucket} className="border-t border-gray-100">
                              <td className="py-3 pr-4">
                                <span
                                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-extrabold ${bucketBadgeClass(
                                    row.sourceBucket
                                  )}`}
                                >
                                  <BucketIcon bucket={row.sourceBucket} />
                                  {sourceLabel(row.sourceBucket)}
                                </span>
                              </td>
                              <td className="py-3 pr-4 text-sm font-extrabold text-slate-900">
                                {row.orderCount}
                              </td>
                              <td className="py-3 pr-4 text-sm font-bold text-slate-700">
                                {pct(row.orderSharePct)}
                              </td>
                              <td className="py-3 pr-4 text-sm font-extrabold text-emerald-700">
                                ₹{money(row.revenue)}
                              </td>
                              <td className="py-3 pr-4 text-sm font-bold text-slate-700">
                                {pct(row.revenueSharePct)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>

                <SectionCard
                  title="Daily Paid Orders Trend"
                  subtitle="Simple day-wise order movement for the selected range."
                >
                  {dailyTrend.length === 0 ? (
                    <div className="text-sm font-semibold text-slate-500">No daily trend found yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {dailyTrend.map((row) => {
                        const width =
                          maxDailyOrders > 0
                            ? Math.max(4, Math.round((row.orderCount / maxDailyOrders) * 100))
                            : 0;

                        return (
                          <div key={row.day} className="grid grid-cols-12 gap-3 items-center">
                            <div className="col-span-12 sm:col-span-2 text-xs font-extrabold text-slate-600">
                              {fmtDateOnly(row.day)}
                            </div>

                            <div className="col-span-12 sm:col-span-7">
                              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-3 rounded-full bg-blue-600"
                                  style={{ width: `${width}%` }}
                                />
                              </div>
                            </div>

                            <div className="col-span-6 sm:col-span-1 text-sm font-extrabold text-slate-900">
                              {row.orderCount}
                            </div>

                            <div className="col-span-6 sm:col-span-2 text-right text-sm font-bold text-emerald-700">
                              ₹{money(row.revenue)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionCard>

                <SectionCard
                  title="Recent Attributed Orders"
                  subtitle="Quick check of latest paid orders and their source details."
                >
                  {recentOrders.length === 0 ? (
                    <div className="text-sm font-semibold text-slate-500">No recent orders found yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1100px]">
                        <thead>
                          <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                            <th className="pb-3 pr-4 font-extrabold">Order</th>
                            <th className="pb-3 pr-4 font-extrabold">Paid At</th>
                            <th className="pb-3 pr-4 font-extrabold">Amount</th>
                            <th className="pb-3 pr-4 font-extrabold">Source Bucket</th>
                            <th className="pb-3 pr-4 font-extrabold">Detected Source</th>
                            <th className="pb-3 pr-4 font-extrabold">UTM Source</th>
                            <th className="pb-3 pr-4 font-extrabold">UTM Medium</th>
                            <th className="pb-3 pr-4 font-extrabold">UTM Campaign</th>
                            <th className="pb-3 pr-4 font-extrabold">Referrer</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentOrders.map((row) => (
                            <tr key={row.orderId} className="border-t border-gray-100 align-top">
                              <td className="py-3 pr-4">
                                <div className="text-sm font-extrabold text-slate-900">
                                  {safeStr(row.orderRef) || row.orderId.slice(-8)}
                                </div>
                                <div className="mt-1 text-xs font-semibold text-slate-500">
                                  Items: {row.itemCount}
                                </div>
                              </td>
                              <td className="py-3 pr-4 text-sm font-semibold text-slate-700">
                                {fmtDateTime(row.paidAt)}
                              </td>
                              <td className="py-3 pr-4 text-sm font-extrabold text-emerald-700">
                                ₹{money(row.totalAmount)}
                              </td>
                              <td className="py-3 pr-4">
                                <span
                                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-extrabold ${bucketBadgeClass(
                                    row.sourceBucket
                                  )}`}
                                >
                                  <BucketIcon bucket={row.sourceBucket} />
                                  {sourceLabel(row.sourceBucket)}
                                </span>
                              </td>
                              <td className="py-3 pr-4 text-sm font-semibold text-slate-700">
                                {safeStr(row.detectedSource) || "—"}
                              </td>
                              <td className="py-3 pr-4 text-sm font-semibold text-slate-700">
                                {safeStr(row.utmSource) || "—"}
                              </td>
                              <td className="py-3 pr-4 text-sm font-semibold text-slate-700">
                                {safeStr(row.utmMedium) || "—"}
                              </td>
                              <td className="py-3 pr-4 text-sm font-semibold text-slate-700">
                                {safeStr(row.utmCampaign) || "—"}
                              </td>
                              <td className="py-3 pr-4 text-sm font-semibold text-slate-700">
                                {safeStr(row.referrerHost) || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>
              </div>

              <div className="xl:col-span-4 space-y-6">
                <SectionCard
                  title="Strategic Insights"
                  subtitle="Fast reading points for business decisions."
                >
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                      <div className="text-xs uppercase tracking-wide font-extrabold text-blue-700">
                        Top Source
                      </div>
                      <div className="mt-1 text-lg font-extrabold text-slate-900">
                        {sourceLabel(insights.topSourceBucket)}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-700">
                        Orders: <span className="font-extrabold">{insights.topSourceOrders}</span>
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-700">
                        Revenue: <span className="font-extrabold text-emerald-700">₹{money(insights.topSourceRevenue)}</span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                      <div className="text-xs uppercase tracking-wide font-extrabold text-violet-700">
                        Attribution Coverage
                      </div>
                      <div className="mt-1 text-lg font-extrabold text-slate-900">
                        {pct(insights.attributionCoveragePct)}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-700">
                        Attributed: <span className="font-extrabold">{overview.attributedOrders}</span>
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-700">
                        Unattributed: <span className="font-extrabold">{overview.unattributedOrders}</span>
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Channel Snapshot"
                  subtitle="Quick comparison across major traffic buckets."
                >
                  <div className="grid grid-cols-2 gap-3">
                    {channelCards.map((row) => (
                      <div
                        key={row.key}
                        className="rounded-2xl border border-gray-200 bg-slate-50 p-3"
                      >
                        <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">
                          {row.label}
                        </div>
                        <div className="mt-2 text-xl font-extrabold text-slate-900">
                          {row.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard
                  title="Detected Sources"
                  subtitle="Secondary source naming summary."
                >
                  {detectedSources.length === 0 ? (
                    <div className="text-sm font-semibold text-slate-500">No detected source rows yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {detectedSources.map((row) => (
                        <div key={row.detectedSource} className="rounded-2xl border border-gray-200 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-extrabold text-slate-900">
                                {sourceLabel(row.detectedSource)}
                              </div>
                              <div className="mt-1 text-xs font-semibold text-slate-500">
                                Orders {row.orderCount} • Revenue ₹{money(row.revenue)}
                              </div>
                            </div>
                            <div className="text-xs font-extrabold text-blue-700">
                              {pct(row.orderSharePct)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <SectionCard
                title="UTM Sources"
                subtitle="Marketing source names coming from campaigns."
                right={<Search size={16} className="text-blue-600" />}
              >
                {utmSources.length === 0 ? (
                  <div className="text-sm font-semibold text-slate-500">No UTM source data found.</div>
                ) : (
                  <div className="space-y-3">
                    {utmSources.map((row) => (
                      <div key={row.utmSource} className="rounded-2xl border border-gray-200 p-3">
                        <div className="text-sm font-extrabold text-slate-900 break-all">{row.utmSource}</div>
                        <div className="mt-1 text-xs font-semibold text-slate-500">
                          Orders {row.orderCount} • Revenue ₹{money(row.revenue)} • Share {pct(row.orderSharePct)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard
                title="UTM Mediums"
                subtitle="Campaign medium like cpc, social, organic, referral, etc."
                right={<Share2 size={16} className="text-violet-600" />}
              >
                {utmMediums.length === 0 ? (
                  <div className="text-sm font-semibold text-slate-500">No UTM medium data found.</div>
                ) : (
                  <div className="space-y-3">
                    {utmMediums.map((row) => (
                      <div key={row.utmMedium} className="rounded-2xl border border-gray-200 p-3">
                        <div className="text-sm font-extrabold text-slate-900 break-all">{row.utmMedium}</div>
                        <div className="mt-1 text-xs font-semibold text-slate-500">
                          Orders {row.orderCount} • Revenue ₹{money(row.revenue)} • Share {pct(row.orderSharePct)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard
                title="UTM Campaigns"
                subtitle="Specific named campaigns you are running."
                right={<TrendingUp size={16} className="text-emerald-600" />}
              >
                {utmCampaigns.length === 0 ? (
                  <div className="text-sm font-semibold text-slate-500">No UTM campaign data found.</div>
                ) : (
                  <div className="space-y-3">
                    {utmCampaigns.map((row) => (
                      <div key={row.utmCampaign} className="rounded-2xl border border-gray-200 p-3">
                        <div className="text-sm font-extrabold text-slate-900 break-all">{row.utmCampaign}</div>
                        <div className="mt-1 text-xs font-semibold text-slate-500">
                          Orders {row.orderCount} • Revenue ₹{money(row.revenue)} • Share {pct(row.orderSharePct)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>

            <SectionCard
              title="Top Referrer Hosts"
              subtitle="Useful for checking which external websites or apps are referring buyers."
              right={<Link2 size={16} className="text-amber-600" />}
            >
              {referrers.length === 0 ? (
                <div className="text-sm font-semibold text-slate-500">No referrer host data found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px]">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                        <th className="pb-3 pr-4 font-extrabold">Referrer Host</th>
                        <th className="pb-3 pr-4 font-extrabold">Orders</th>
                        <th className="pb-3 pr-4 font-extrabold">Order Share</th>
                        <th className="pb-3 pr-4 font-extrabold">Revenue</th>
                        <th className="pb-3 pr-4 font-extrabold">Revenue Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referrers.map((row) => (
                        <tr key={row.referrerHost} className="border-t border-gray-100">
                          <td className="py-3 pr-4 text-sm font-extrabold text-slate-900 break-all">
                            {row.referrerHost}
                          </td>
                          <td className="py-3 pr-4 text-sm font-extrabold text-slate-900">
                            {row.orderCount}
                          </td>
                          <td className="py-3 pr-4 text-sm font-bold text-slate-700">
                            {pct(row.orderSharePct)}
                          </td>
                          <td className="py-3 pr-4 text-sm font-extrabold text-emerald-700">
                            ₹{money(row.revenue)}
                          </td>
                          <td className="py-3 pr-4 text-sm font-bold text-slate-700">
                            {pct(row.revenueSharePct)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </>
        )}
      </div>
    </main>
  );
}
