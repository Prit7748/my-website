"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Download,
  FileSpreadsheet,
  Loader2,
  Package,
  RefreshCcw,
  ShoppingBag,
  Tag,
  Users,
  Wallet,
} from "lucide-react";

type TrendRow = {
  label: string;
  revenue: number;
  orders: number;
  itemsSold: number;
};

type BasicStatRow = {
  key: string;
  label: string;
  revenue: number;
  quantity: number;
  orders: number;
  extra?: string;
};

type StatusRow = {
  status: string;
  orders: number;
  revenue: number;
};

type PaymentRow = {
  gateway: string;
  orders: number;
  revenue: number;
};

type CustomerRow = {
  key: string;
  label: string;
  revenue: number;
  orders: number;
  itemsSold: number;
};

type GeoRow = {
  key: string;
  label: string;
  revenue: number;
  orders: number;
};

type InsightCard = {
  title: string;
  value: string;
  description: string;
  tone?: "slate" | "emerald" | "blue" | "violet" | "amber";
};

type SectionMeta = {
  totalRows?: number;
  returnedRows?: number;
};

type ReportsResponse = {
  ok?: boolean;
  generatedAt?: string;
  filters?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    groupBy?: string;
    dateField?: string;
  };
  summary?: {
    realizedRevenue?: number;
    totalOrders?: number;
    totalItemsSold?: number;
    averageOrderValue?: number;
    averageItemsPerOrder?: number;
    uniqueCustomers?: number;
    repeatCustomers?: number;
    repeatCustomerRate?: number;
    promoDiscountTotal?: number;
    walletUsedTotal?: number;
    hardcopyRevenue?: number;
    comboRevenue?: number;
    digitalRevenue?: number;
  };
  sectionMeta?: {
    category?: SectionMeta;
    course?: SectionMeta;
    product?: SectionMeta;
    combo?: SectionMeta;
    customer?: SectionMeta;
    trend?: SectionMeta;
    state?: SectionMeta;
    city?: SectionMeta;
  };
  insights?: InsightCard[];
  trend?: TrendRow[];
  categoryStats?: BasicStatRow[];
  courseStats?: BasicStatRow[];
  productStats?: BasicStatRow[];
  comboStats?: BasicStatRow[];
  customerStats?: CustomerRow[];
  geoStateStats?: GeoRow[];
  geoCityStats?: GeoRow[];
  statusSummary?: StatusRow[];
  paymentGatewaySummary?: PaymentRow[];
  notes?: string[];
  error?: string;
};

function formatMoney(value: number) {
  try {
    return `₹${new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 2,
    }).format(Number(value || 0))}`;
  } catch {
    return `₹${Number(value || 0)}`;
  }
}

function formatCount(value: number) {
  try {
    return new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    return String(value || 0);
  }
}

function toInputDate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildLastNDaysRange(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return {
    startDate: toInputDate(start),
    endDate: toInputDate(end),
  };
}

function buildThisMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    startDate: toInputDate(start),
    endDate: toInputDate(now),
  };
}

function buildThisYearRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return {
    startDate: toInputDate(start),
    endDate: toInputDate(now),
  };
}

function SummaryStatCard({
  title,
  value,
  icon,
  tone = "slate",
}: {
  title: string;
  value: string;
  icon: ReactNode;
  tone?: "slate" | "emerald" | "blue" | "violet" | "amber";
}) {
  const styles =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "blue"
      ? "border-blue-200 bg-blue-50 text-blue-900"
      : tone === "violet"
      ? "border-violet-200 bg-violet-50 text-violet-900"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-gray-200 bg-gray-50 text-slate-900";

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${styles}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide font-extrabold opacity-70">
            {title}
          </div>
          <div className="mt-2 text-xl font-extrabold">{value}</div>
        </div>
        <div className="opacity-80">{icon}</div>
      </div>
    </div>
  );
}

function InsightToneClass(tone?: string) {
  if (tone === "emerald") return "border-emerald-200 bg-emerald-50";
  if (tone === "blue") return "border-blue-200 bg-blue-50";
  if (tone === "violet") return "border-violet-200 bg-violet-50";
  if (tone === "amber") return "border-amber-200 bg-amber-50";
  return "border-gray-200 bg-gray-50";
}

function InsightGrid({ insights }: { insights: InsightCard[] }) {
  if (!insights.length) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {insights.map((insight, idx) => (
        <div
          key={`${insight.title}-${idx}`}
          className={`rounded-2xl border p-5 shadow-sm ${InsightToneClass(insight.tone)}`}
        >
          <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">
            {insight.title}
          </div>
          <div className="mt-2 text-lg font-extrabold text-slate-900">
            {insight.value}
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-700 leading-6">
            {insight.description}
          </div>
        </div>
      ))}
    </div>
  );
}

function DataTable({
  title,
  subtitle,
  columns,
  rows,
  emptyText = "No data found",
  visibleCount = 10,
  onToggle,
  totalRows = 0,
  returnedRows = 0,
}: {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: ReactNode[][];
  emptyText?: string;
  visibleCount?: number;
  onToggle?: () => void;
  totalRows?: number;
  returnedRows?: number;
}) {
  const visibleRows = rows.slice(0, visibleCount);
  const hasMoreInLoadedData = rows.length > visibleCount;
  const isExpanded = rows.length > 0 && visibleCount >= rows.length;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="p-5 border-b border-gray-200">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="font-extrabold text-slate-900">{title}</div>
            {subtitle ? (
              <div className="text-xs text-slate-600 mt-1">{subtitle}</div>
            ) : null}
          </div>

          {rows.length > 0 ? (
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
              Showing {Math.min(visibleRows.length, rows.length)} of {rows.length}
              {totalRows > returnedRows ? ` loaded top ${returnedRows} / total ${totalRows}` : ""}
            </div>
          ) : null}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-6 text-sm font-semibold text-slate-500">{emptyText}</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-[11px] uppercase tracking-wide font-extrabold text-slate-500 border-b border-gray-200 whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100 last:border-b-0">
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className="px-4 py-3 align-top text-slate-800 whitespace-nowrap"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMoreInLoadedData || (rows.length > 10 && isExpanded) ? (
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs font-semibold text-slate-600">
                Large sections ko simple rakhne ke liye default me top rows hi dikhaye ja rahe hain.
              </div>
              <button
                type="button"
                onClick={onToggle}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 font-extrabold text-slate-800 shadow-sm"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp size={16} />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown size={16} />
                    See More
                  </>
                )}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function csvEscape(value: any) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export default function AdminOrderReportsPage() {
  const defaultRange = useMemo(() => buildLastNDaysRange(30), []);

  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [status, setStatus] = useState("paid");
  const [groupBy, setGroupBy] = useState("day");
  const [dateField, setDateField] = useState("paidAt");

  const [loading, setLoading] = useState(true);
  const [exportingJson, setExportingJson] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<ReportsResponse | null>(null);

  const [visibleRows, setVisibleRows] = useState({
    trend: 12,
    category: 10,
    course: 10,
    product: 10,
    combo: 10,
    customer: 10,
    state: 10,
    city: 10,
  });

  async function fetchReports() {
    try {
      setLoading(true);
      setError("");

      const qs = new URLSearchParams({
        startDate,
        endDate,
        status,
        groupBy,
        dateField,
      });

      const res = await fetch(`/api/admin/order-reports?${qs.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });

      const json: ReportsResponse = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load order reports");
      }

      setData(json);
      setVisibleRows({
        trend: 12,
        category: 10,
        course: 10,
        product: 10,
        combo: 10,
        customer: 10,
        state: 10,
        city: 10,
      });
    } catch (e: any) {
      setData(null);
      setError(e?.message || "Failed to load order reports");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status === "paid" && dateField !== "paidAt" && dateField !== "createdAt") {
      setDateField("paidAt");
    }
    if (status !== "paid" && dateField === "paidAt") {
      setDateField("createdAt");
    }
  }, [status, dateField]);

  function applyQuickRange(type: "7d" | "30d" | "month" | "year") {
    if (type === "7d") {
      const x = buildLastNDaysRange(7);
      setStartDate(x.startDate);
      setEndDate(x.endDate);
      return;
    }

    if (type === "30d") {
      const x = buildLastNDaysRange(30);
      setStartDate(x.startDate);
      setEndDate(x.endDate);
      return;
    }

    if (type === "month") {
      const x = buildThisMonthRange();
      setStartDate(x.startDate);
      setEndDate(x.endDate);
      return;
    }

    const x = buildThisYearRange();
    setStartDate(x.startDate);
    setEndDate(x.endDate);
  }

  async function handleExportJson() {
    if (!data) return;

    try {
      setExportingJson(true);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `order-reports-${startDate}-to-${endDate}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExportingJson(false);
    }
  }

  async function handleExportCsv() {
    if (!data) return;

    try {
      setExportingCsv(true);

      const lines: string[] = [];

      lines.push(["SECTION", "LABEL", "VALUE1", "VALUE2", "VALUE3", "VALUE4"].map(csvEscape).join(","));

      const summary = data.summary || {};
      const summaryRows = [
        ["Summary", "Realized Revenue", summary.realizedRevenue ?? 0, "", "", ""],
        ["Summary", "Total Orders", summary.totalOrders ?? 0, "", "", ""],
        ["Summary", "Items Sold", summary.totalItemsSold ?? 0, "", "", ""],
        ["Summary", "Average Order Value", summary.averageOrderValue ?? 0, "", "", ""],
        ["Summary", "Average Items Per Order", summary.averageItemsPerOrder ?? 0, "", "", ""],
        ["Summary", "Unique Customers", summary.uniqueCustomers ?? 0, "", "", ""],
        ["Summary", "Repeat Customers", summary.repeatCustomers ?? 0, "", "", ""],
        ["Summary", "Promo Discount Total", summary.promoDiscountTotal ?? 0, "", "", ""],
        ["Summary", "Wallet Used Total", summary.walletUsedTotal ?? 0, "", "", ""],
        ["Summary", "Hardcopy Revenue", summary.hardcopyRevenue ?? 0, "", "", ""],
        ["Summary", "Combo Revenue", summary.comboRevenue ?? 0, "", "", ""],
        ["Summary", "Digital Revenue", summary.digitalRevenue ?? 0, "", "", ""],
      ];

      for (const row of summaryRows) {
        lines.push(row.map(csvEscape).join(","));
      }

      const pushRows = (section: string, rows: any[], mapper: (row: any) => any[]) => {
        for (const row of rows) {
          lines.push([section, ...mapper(row)].map(csvEscape).join(","));
        }
      };

      pushRows("Trend", data.trend || [], (row) => [
        row.label,
        row.revenue,
        row.orders,
        row.itemsSold,
        "",
      ]);

      pushRows("Category", data.categoryStats || [], (row) => [
        row.label,
        row.revenue,
        row.quantity,
        row.orders,
        row.extra || "",
      ]);

      pushRows("Course", data.courseStats || [], (row) => [
        row.label,
        row.revenue,
        row.quantity,
        row.orders,
        row.extra || "",
      ]);

      pushRows("Product", data.productStats || [], (row) => [
        row.label,
        row.revenue,
        row.quantity,
        row.orders,
        row.extra || "",
      ]);

      pushRows("Combo", data.comboStats || [], (row) => [
        row.label,
        row.revenue,
        row.quantity,
        row.orders,
        row.extra || "",
      ]);

      pushRows("Customer", data.customerStats || [], (row) => [
        row.label,
        row.revenue,
        row.orders,
        row.itemsSold,
        "",
      ]);

      pushRows("State", data.geoStateStats || [], (row) => [
        row.label,
        row.revenue,
        row.orders,
        "",
        "",
      ]);

      pushRows("City", data.geoCityStats || [], (row) => [
        row.label,
        row.revenue,
        row.orders,
        "",
        "",
      ]);

      pushRows("Status", data.statusSummary || [], (row) => [
        row.status,
        row.revenue,
        row.orders,
        "",
        "",
      ]);

      pushRows("Payment Gateway", data.paymentGatewaySummary || [], (row) => [
        row.gateway,
        row.revenue,
        row.orders,
        "",
        "",
      ]);

      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `order-reports-${startDate}-to-${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExportingCsv(false);
    }
  }

  function toggleVisibleRows(section: keyof typeof visibleRows, totalLoaded: number, collapsedCount: number) {
    setVisibleRows((prev) => ({
      ...prev,
      [section]: prev[section] >= totalLoaded ? collapsedCount : totalLoaded,
    }));
  }

  const summary = data?.summary || {};
  const sectionMeta = data?.sectionMeta || {};

  const trendRows = (data?.trend || []).map((row) => [
    <span className="font-bold text-slate-900" key={`label-${row.label}`}>
      {row.label}
    </span>,
    <span key={`rev-${row.label}`}>{formatMoney(row.revenue)}</span>,
    <span key={`ord-${row.label}`}>{formatCount(row.orders)}</span>,
    <span key={`itm-${row.label}`}>{formatCount(row.itemsSold)}</span>,
  ]);

  const categoryRows = (data?.categoryStats || []).map((row) => [
    <span className="font-bold text-slate-900" key={`cat-${row.key}`}>
      {row.label}
    </span>,
    <span key={`cat-rev-${row.key}`}>{formatMoney(row.revenue)}</span>,
    <span key={`cat-qty-${row.key}`}>{formatCount(row.quantity)}</span>,
    <span key={`cat-ord-${row.key}`}>{formatCount(row.orders)}</span>,
  ]);

  const courseRows = (data?.courseStats || []).map((row) => [
    <div key={`course-${row.key}`}>
      <div className="font-bold text-slate-900">{row.label}</div>
      {row.extra ? (
        <div className="text-xs text-slate-500 mt-0.5">{row.extra}</div>
      ) : null}
    </div>,
    <span key={`course-rev-${row.key}`}>{formatMoney(row.revenue)}</span>,
    <span key={`course-qty-${row.key}`}>{formatCount(row.quantity)}</span>,
    <span key={`course-ord-${row.key}`}>{formatCount(row.orders)}</span>,
  ]);

  const productRows = (data?.productStats || []).map((row) => [
    <div key={`prod-${row.key}`}>
      <div className="font-bold text-slate-900">{row.label}</div>
      {row.extra ? (
        <div className="text-xs text-slate-500 mt-0.5">{row.extra}</div>
      ) : null}
    </div>,
    <span key={`prod-rev-${row.key}`}>{formatMoney(row.revenue)}</span>,
    <span key={`prod-qty-${row.key}`}>{formatCount(row.quantity)}</span>,
    <span key={`prod-ord-${row.key}`}>{formatCount(row.orders)}</span>,
  ]);

  const comboRows = (data?.comboStats || []).map((row) => [
    <div key={`combo-${row.key}`}>
      <div className="font-bold text-slate-900">{row.label}</div>
      {row.extra ? (
        <div className="text-xs text-slate-500 mt-0.5">{row.extra}</div>
      ) : null}
    </div>,
    <span key={`combo-rev-${row.key}`}>{formatMoney(row.revenue)}</span>,
    <span key={`combo-qty-${row.key}`}>{formatCount(row.quantity)}</span>,
    <span key={`combo-ord-${row.key}`}>{formatCount(row.orders)}</span>,
  ]);

  const customerRows = (data?.customerStats || []).map((row) => [
    <span className="font-bold text-slate-900" key={`cust-${row.key}`}>
      {row.label}
    </span>,
    <span key={`cust-rev-${row.key}`}>{formatMoney(row.revenue)}</span>,
    <span key={`cust-ord-${row.key}`}>{formatCount(row.orders)}</span>,
    <span key={`cust-item-${row.key}`}>{formatCount(row.itemsSold)}</span>,
  ]);

  const stateRows = (data?.geoStateStats || []).map((row) => [
    <span className="font-bold text-slate-900" key={`state-${row.key}`}>
      {row.label}
    </span>,
    <span key={`state-rev-${row.key}`}>{formatMoney(row.revenue)}</span>,
    <span key={`state-ord-${row.key}`}>{formatCount(row.orders)}</span>,
  ]);

  const cityRows = (data?.geoCityStats || []).map((row) => [
    <span className="font-bold text-slate-900" key={`city-${row.key}`}>
      {row.label}
    </span>,
    <span key={`city-rev-${row.key}`}>{formatMoney(row.revenue)}</span>,
    <span key={`city-ord-${row.key}`}>{formatCount(row.orders)}</span>,
  ]);

  const statusRows = (data?.statusSummary || []).map((row) => [
    <span className="font-bold text-slate-900" key={`st-${row.status}`}>
      {row.status}
    </span>,
    <span key={`st-ord-${row.status}`}>{formatCount(row.orders)}</span>,
    <span key={`st-rev-${row.status}`}>{formatMoney(row.revenue)}</span>,
  ]);

  const paymentRows = (data?.paymentGatewaySummary || []).map((row) => [
    <span className="font-bold text-slate-900" key={`pg-${row.gateway}`}>
      {row.gateway}
    </span>,
    <span key={`pg-ord-${row.gateway}`}>{formatCount(row.orders)}</span>,
    <span key={`pg-rev-${row.gateway}`}>{formatMoney(row.revenue)}</span>,
  ]);

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-2xl font-extrabold flex items-center gap-2">
                <BarChart3 className="text-emerald-700" />
                Order Reports
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Revenue, trends, combo analytics, customers, delivery geography aur business insight cards.
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={fetchReports}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <RefreshCcw size={16} />
                Refresh
              </button>

              <button
                type="button"
                onClick={handleExportJson}
                disabled={!data || exportingJson}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm disabled:opacity-60"
              >
                <Download size={16} />
                {exportingJson ? "Exporting..." : "Export JSON"}
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                disabled={!data || exportingCsv}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm disabled:opacity-60"
              >
                <FileSpreadsheet size={16} />
                {exportingCsv ? "Exporting..." : "Export CSV"}
              </button>

              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                Back to Admin <ArrowRight size={18} />
              </Link>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="font-extrabold text-amber-900">Accuracy Note</div>
            <div className="mt-1 text-sm font-semibold text-amber-800 leading-relaxed">
              Product-wise aur Course-wise analytics is version me <b>direct product orders</b> ke liye accurate hain.
              Saved combo aur builder combo ke internal product/course breakup ko intentionally separate rakha gaya hai
              taaki wrong report generate na ho.
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <div>
                <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none"
                >
                  <option value="paid">Paid Only</option>
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                  Group By
                </label>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none"
                >
                  <option value="day">Day Wise</option>
                  <option value="week">Week Wise</option>
                  <option value="month">Month Wise</option>
                  <option value="year">Year Wise</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                  Date Field
                </label>
                <select
                  value={dateField}
                  onChange={(e) => setDateField(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none"
                >
                  {status === "paid" ? (
                    <>
                      <option value="paidAt">Paid Date</option>
                      <option value="createdAt">Created Date</option>
                    </>
                  ) : (
                    <option value="createdAt">Created Date</option>
                  )}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={fetchReports}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-extrabold shadow-sm"
                >
                  <CalendarDays size={16} />
                  Apply Filters
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyQuickRange("7d")}
                className="px-3 py-1.5 rounded-full border border-gray-200 bg-white text-sm font-bold hover:bg-gray-50"
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => applyQuickRange("30d")}
                className="px-3 py-1.5 rounded-full border border-gray-200 bg-white text-sm font-bold hover:bg-gray-50"
              >
                Last 30 Days
              </button>
              <button
                type="button"
                onClick={() => applyQuickRange("month")}
                className="px-3 py-1.5 rounded-full border border-gray-200 bg-white text-sm font-bold hover:bg-gray-50"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => applyQuickRange("year")}
                className="px-3 py-1.5 rounded-full border border-gray-200 bg-white text-sm font-bold hover:bg-gray-50"
              >
                This Year
              </button>
            </div>
          </div>

          {loading ? (
            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 text-center font-extrabold text-slate-600 flex items-center justify-center gap-2">
              <Loader2 size={18} className="animate-spin" />
              Loading reports...
            </div>
          ) : error ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
              <div className="font-extrabold text-red-700">Unable to load reports</div>
              <div className="mt-1 text-sm font-semibold text-red-600">{error}</div>
            </div>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                <SummaryStatCard
                  title="Realized Revenue"
                  value={formatMoney(summary.realizedRevenue || 0)}
                  icon={<CreditCard className="text-emerald-700" />}
                  tone="emerald"
                />
                <SummaryStatCard
                  title="Total Orders"
                  value={formatCount(summary.totalOrders || 0)}
                  icon={<ShoppingBag className="text-blue-700" />}
                  tone="blue"
                />
                <SummaryStatCard
                  title="Items Sold"
                  value={formatCount(summary.totalItemsSold || 0)}
                  icon={<Package className="text-violet-700" />}
                  tone="violet"
                />
                <SummaryStatCard
                  title="Avg Order Value"
                  value={formatMoney(summary.averageOrderValue || 0)}
                  icon={<CheckCircle2 className="text-slate-700" />}
                />
                <SummaryStatCard
                  title="Unique Customers"
                  value={formatCount(summary.uniqueCustomers || 0)}
                  icon={<Users className="text-amber-700" />}
                  tone="amber"
                />
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                <SummaryStatCard
                  title="Promo Discount"
                  value={formatMoney(summary.promoDiscountTotal || 0)}
                  icon={<Tag className="text-blue-700" />}
                  tone="blue"
                />
                <SummaryStatCard
                  title="Wallet Used"
                  value={formatMoney(summary.walletUsedTotal || 0)}
                  icon={<Wallet className="text-violet-700" />}
                  tone="violet"
                />
                <SummaryStatCard
                  title="Hardcopy Revenue"
                  value={formatMoney(summary.hardcopyRevenue || 0)}
                  icon={<Package className="text-amber-700" />}
                  tone="amber"
                />
                <SummaryStatCard
                  title="Combo Revenue"
                  value={formatMoney(summary.comboRevenue || 0)}
                  icon={<BarChart3 className="text-emerald-700" />}
                  tone="emerald"
                />
                <SummaryStatCard
                  title="Digital Revenue"
                  value={formatMoney(summary.digitalRevenue || 0)}
                  icon={<CreditCard className="text-slate-700" />}
                />
              </div>

              <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <div className="font-extrabold text-slate-900 mb-4">Business Insight Cards</div>
                <InsightGrid insights={data?.insights || []} />
              </div>

              <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
                <DataTable
                  title="Trend Report"
                  subtitle={`Selected grouping: ${groupBy}. Large trend data ko भी manageable rakhne ke liye See More diya gaya hai.`}
                  columns={["Bucket", "Revenue", "Orders", "Items Sold"]}
                  rows={trendRows}
                  visibleCount={visibleRows.trend}
                  onToggle={() => toggleVisibleRows("trend", trendRows.length, 12)}
                  totalRows={sectionMeta?.trend?.totalRows || 0}
                  returnedRows={sectionMeta?.trend?.returnedRows || 0}
                />

                <div className="space-y-6">
                  <DataTable
                    title="Status Overview"
                    subtitle="Selected created-date range ka status mix."
                    columns={["Status", "Orders", "Revenue"]}
                    rows={statusRows}
                    visibleCount={statusRows.length}
                    totalRows={statusRows.length}
                    returnedRows={statusRows.length}
                  />

                  <DataTable
                    title="Payment Gateways"
                    subtitle="Filtered orders ka gateway-wise performance."
                    columns={["Gateway", "Orders", "Revenue"]}
                    rows={paymentRows}
                    visibleCount={paymentRows.length}
                    totalRows={paymentRows.length}
                    returnedRows={paymentRows.length}
                  />
                </div>
              </div>

              <div className="mt-6">
                <DataTable
                  title="Category Wise Report"
                  subtitle="Direct products + combo category buckets."
                  columns={["Category", "Revenue", "Products Sold", "Orders"]}
                  rows={categoryRows}
                  visibleCount={visibleRows.category}
                  onToggle={() => toggleVisibleRows("category", categoryRows.length, 10)}
                  totalRows={sectionMeta?.category?.totalRows || 0}
                  returnedRows={sectionMeta?.category?.returnedRows || 0}
                />
              </div>

              <div className="mt-6">
                <DataTable
                  title="Course Wise Report"
                  subtitle="Direct product orders only. Multi-course mapped products multiple course buckets me aa sakte hain."
                  columns={["Course", "Revenue", "Products Sold", "Orders"]}
                  rows={courseRows}
                  visibleCount={visibleRows.course}
                  onToggle={() => toggleVisibleRows("course", courseRows.length, 10)}
                  totalRows={sectionMeta?.course?.totalRows || 0}
                  returnedRows={sectionMeta?.course?.returnedRows || 0}
                />
              </div>

              <div className="mt-6">
                <DataTable
                  title="Product Wise Report"
                  subtitle="Direct product orders only."
                  columns={["Product", "Revenue", "Times Sold", "Orders"]}
                  rows={productRows}
                  visibleCount={visibleRows.product}
                  onToggle={() => toggleVisibleRows("product", productRows.length, 10)}
                  totalRows={sectionMeta?.product?.totalRows || 0}
                  returnedRows={sectionMeta?.product?.returnedRows || 0}
                />
              </div>

              <div className="mt-6">
                <DataTable
                  title="Combo Analytics"
                  subtitle="Saved combo aur builder combo ko separate business bucket ki tarah track kiya gaya hai."
                  columns={["Combo", "Revenue", "Times Sold", "Orders"]}
                  rows={comboRows}
                  visibleCount={visibleRows.combo}
                  onToggle={() => toggleVisibleRows("combo", comboRows.length, 10)}
                  totalRows={sectionMeta?.combo?.totalRows || 0}
                  returnedRows={sectionMeta?.combo?.returnedRows || 0}
                />
              </div>

              <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
                <DataTable
                  title="Top Customers"
                  subtitle="Filtered range ke highest value customers."
                  columns={["Customer", "Revenue", "Orders", "Items Sold"]}
                  rows={customerRows}
                  visibleCount={visibleRows.customer}
                  onToggle={() => toggleVisibleRows("customer", customerRows.length, 10)}
                  totalRows={sectionMeta?.customer?.totalRows || 0}
                  returnedRows={sectionMeta?.customer?.returnedRows || 0}
                />

                <div className="space-y-6">
                  <DataTable
                    title="State Wise Delivery"
                    subtitle="Shipping state ke basis par."
                    columns={["State", "Revenue", "Orders"]}
                    rows={stateRows}
                    visibleCount={visibleRows.state}
                    onToggle={() => toggleVisibleRows("state", stateRows.length, 10)}
                    totalRows={sectionMeta?.state?.totalRows || 0}
                    returnedRows={sectionMeta?.state?.returnedRows || 0}
                  />

                  <DataTable
                    title="City Wise Delivery"
                    subtitle="Shipping city ke basis par."
                    columns={["City", "Revenue", "Orders"]}
                    rows={cityRows}
                    visibleCount={visibleRows.city}
                    onToggle={() => toggleVisibleRows("city", cityRows.length, 10)}
                    totalRows={sectionMeta?.city?.totalRows || 0}
                    returnedRows={sectionMeta?.city?.returnedRows || 0}
                  />
                </div>
              </div>

              {Array.isArray(data?.notes) && data.notes.length > 0 ? (
                <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
                  <div className="font-extrabold text-blue-900">System Notes</div>
                  <div className="mt-3 space-y-2">
                    {data.notes.map((note, idx) => (
                      <div key={idx} className="text-sm font-semibold text-blue-800">
                        • {note}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </main>
  );
}