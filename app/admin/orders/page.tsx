"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Search,
  RefreshCcw,
  ArrowRight,
  Loader2,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Filter,
  Download,
} from "lucide-react";

type ComboSnapshotItem = {
  title?: string;
  subtitle?: string;
};

type AdminOrderItem = {
  productId?: string;
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
  comboItems?: ComboSnapshotItem[];
};

type AdminOrder = {
  _id?: string;
  orderRef?: string;
  userId?: string;
  userEmail?: string;

  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;

  status?: string;
  totalAmount?: number;
  currency?: string;
  paymentGateway?: string;
  paymentId?: string;
  createdAt?: string;
  paidAt?: string | null;

  customer?: any;
  shipping?: any;
  items?: AdminOrderItem[];
  meta?: any;
};

type OrdersResponse = {
  ok?: boolean;
  orders?: AdminOrder[];
  filters?: {
    q?: string;
    status?: string;
    paymentGateway?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
  };
  summary?: {
    totalOrders?: number;
    totalRevenue?: number;
    pageOrders?: number;
  };
  pagination?: {
    page?: number;
    limit?: number;
    totalOrders?: number;
    totalPages?: number;
    hasPrev?: boolean;
    hasNext?: boolean;
  };
  error?: string;
};

type TypeFilter = "all" | "product" | "saved_combo" | "builder_combo" | "combo";

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

function isComboItem(item: any) {
  return safeStr(item?.itemType).toLowerCase() === "combo";
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("en-IN");
  } catch {
    return String(v);
  }
}

function toInputDate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildLast30DaysRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);

  return {
    startDate: toInputDate(start),
    endDate: toInputDate(end),
  };
}

function getStatusLabel(status: string) {
  const s = safeStr(status).toLowerCase();
  if (s === "paid") return "Completed";
  if (s === "pending") return "Pending";
  if (s === "failed") return "Failed";
  if (s === "refunded") return "Refunded";
  if (s === "cancelled") return "Cancelled";
  return s || "Unknown";
}

function getStatusClass(status: string) {
  const s = safeStr(status).toLowerCase();
  if (s === "paid") return "bg-emerald-600 text-white";
  if (s === "pending") return "bg-amber-500 text-white";
  if (s === "failed") return "bg-rose-600 text-white";
  if (s === "refunded") return "bg-violet-600 text-white";
  if (s === "cancelled") return "bg-slate-700 text-white";
  return "bg-slate-500 text-white";
}

function getPaymentLabel(paymentGateway: string) {
  const p = safeStr(paymentGateway).toLowerCase();
  if (p === "razorpay") return "Razorpay";
  if (p === "wallet") return "Wallet";
  return paymentGateway || "Unknown";
}

function getPaymentClass(paymentGateway: string) {
  const p = safeStr(paymentGateway).toLowerCase();
  if (p === "razorpay") return "bg-blue-600 text-white";
  if (p === "wallet") return "bg-violet-600 text-white";
  return "bg-slate-600 text-white";
}

function csvEscape(value: any) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
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

export default function AdminOrdersPage() {
  const defaultRange = useMemo(() => buildLast30DaysRange(), []);

  const [loading, setLoading] = useState(true);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [error, setError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentGatewayFilter, setPaymentGatewayFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [perPage, setPerPage] = useState("15");

  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);

  const [summary, setSummary] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    pageOrders: 0,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    totalOrders: 0,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  });

  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);

  async function fetchOrders(args?: {
    nextPage?: number;
    nextSearch?: string;
    nextStatus?: string;
    nextPaymentGateway?: string;
    nextType?: TypeFilter;
    nextPerPage?: string;
    nextStartDate?: string;
    nextEndDate?: string;
  }) {
    const nextPage = Math.max(1, safeNum(args?.nextPage, pagination.page));
    const nextSearch =
      args?.nextSearch !== undefined ? safeStr(args.nextSearch) : appliedSearch;
    const nextStatus =
      args?.nextStatus !== undefined ? safeStr(args.nextStatus) : statusFilter;
    const nextPaymentGateway =
      args?.nextPaymentGateway !== undefined
        ? safeStr(args.nextPaymentGateway)
        : paymentGatewayFilter;
    const nextType =
      args?.nextType !== undefined ? args.nextType : typeFilter;
    const nextPerPage =
      args?.nextPerPage !== undefined ? safeStr(args.nextPerPage) : perPage;
    const nextStartDate =
      args?.nextStartDate !== undefined ? safeStr(args.nextStartDate) : startDate;
    const nextEndDate =
      args?.nextEndDate !== undefined ? safeStr(args.nextEndDate) : endDate;

    try {
      setLoading(true);
      setError("");

      const qs = new URLSearchParams({
        page: String(nextPage),
        limit: nextPerPage || "15",
        q: nextSearch,
        status: nextStatus,
        paymentGateway: nextPaymentGateway,
        type: nextType,
        startDate: nextStartDate,
        endDate: nextEndDate,
      });

      const res = await fetch(`/api/admin/orders?${qs.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });

      const data: OrdersResponse = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load admin orders");
      }

      setOrders(Array.isArray(data?.orders) ? data.orders : []);
      setSummary({
        totalOrders: safeNum(data?.summary?.totalOrders, 0),
        totalRevenue: safeNum(data?.summary?.totalRevenue, 0),
        pageOrders: safeNum(data?.summary?.pageOrders, 0),
      });
      setPagination({
        page: Math.max(1, safeNum(data?.pagination?.page, 1)),
        limit: Math.max(1, safeNum(data?.pagination?.limit, safeNum(nextPerPage, 15))),
        totalOrders: Math.max(0, safeNum(data?.pagination?.totalOrders, 0)),
        totalPages: Math.max(1, safeNum(data?.pagination?.totalPages, 1)),
        hasPrev: Boolean(data?.pagination?.hasPrev),
        hasNext: Boolean(data?.pagination?.hasNext),
      });
    } catch (e: any) {
      setOrders([]);
      setError(e?.message || "Failed to load admin orders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchOrders({
      nextPage: 1,
      nextSearch: "",
      nextStatus: "all",
      nextPaymentGateway: "all",
      nextType: "all",
      nextPerPage: "15",
      nextStartDate: defaultRange.startDate,
      nextEndDate: defaultRange.endDate,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleApplyFilters() {
    const nextSearch = safeStr(searchInput);
    setAppliedSearch(nextSearch);

    void fetchOrders({
      nextPage: 1,
      nextSearch,
      nextStatus: statusFilter,
      nextPaymentGateway: paymentGatewayFilter,
      nextType: typeFilter,
      nextPerPage: perPage,
      nextStartDate: startDate,
      nextEndDate: endDate,
    });
  }

  function handleResetFilters() {
    const range = buildLast30DaysRange();

    setSearchInput("");
    setAppliedSearch("");
    setStatusFilter("all");
    setPaymentGatewayFilter("all");
    setTypeFilter("all");
    setPerPage("15");
    setStartDate(range.startDate);
    setEndDate(range.endDate);

    void fetchOrders({
      nextPage: 1,
      nextSearch: "",
      nextStatus: "all",
      nextPaymentGateway: "all",
      nextType: "all",
      nextPerPage: "15",
      nextStartDate: range.startDate,
      nextEndDate: range.endDate,
    });
  }

  function handlePageChange(nextPage: number) {
    if (nextPage < 1 || nextPage > pagination.totalPages) return;

    void fetchOrders({
      nextPage,
      nextSearch: appliedSearch,
      nextStatus: statusFilter,
      nextPaymentGateway: paymentGatewayFilter,
      nextType: typeFilter,
      nextPerPage: perPage,
      nextStartDate: startDate,
      nextEndDate: endDate,
    });
  }

  async function handleExportCsv() {
    try {
      setExportingCsv(true);

      const allRows: AdminOrder[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const qs = new URLSearchParams({
          page: String(page),
          limit: "100",
          q: appliedSearch,
          status: statusFilter,
          paymentGateway: paymentGatewayFilter,
          type: typeFilter,
          startDate,
          endDate,
        });

        const res = await fetch(`/api/admin/orders?${qs.toString()}`, {
          credentials: "include",
          cache: "no-store",
        });

        const data: OrdersResponse = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "Failed to export CSV");
        }

        const rows = Array.isArray(data?.orders) ? data.orders : [];
        allRows.push(...rows);

        totalPages = Math.max(1, safeNum(data?.pagination?.totalPages, 1));
        page += 1;
      } while (page <= totalPages);

      const lines: string[] = [];
      lines.push(
        [
          "#",
          "Customer",
          "Email",
          "Phone",
          "Total",
          "Payment",
          "Status",
          "Order Date",
          "Order Ref",
          "Payment ID",
        ]
          .map(csvEscape)
          .join(",")
      );

      allRows.forEach((order, index) => {
        lines.push(
          [
            index + 1,
            safeStr(order.customerName),
            safeStr(order.customerEmail) || safeStr(order.userEmail),
            safeStr(order.customerPhone),
            safeNum(order.totalAmount, 0),
            getPaymentLabel(safeStr(order.paymentGateway)),
            getStatusLabel(safeStr(order.status)),
            fmtDate(order.paidAt || order.createdAt),
            safeStr(order.orderRef),
            safeStr(order.paymentId),
          ]
            .map(csvEscape)
            .join(",")
        );
      });

      const blob = new Blob([lines.join("\n")], {
        type: "text/csv;charset=utf-8;",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `admin-orders-${startDate}-to-${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.message || "CSV export failed");
    } finally {
      setExportingCsv(false);
    }
  }

  const pageRevenue = useMemo(() => {
    return orders.reduce((acc, order) => acc + safeNum(order.totalAmount, 0), 0);
  }, [orders]);

  const currentStart = useMemo(() => {
    if (pagination.totalOrders === 0) return 0;
    return (pagination.page - 1) * pagination.limit + 1;
  }, [pagination]);

  const currentEnd = useMemo(() => {
    if (pagination.totalOrders === 0) return 0;
    return Math.min(pagination.page * pagination.limit, pagination.totalOrders);
  }, [pagination]);

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-2xl font-extrabold flex items-center gap-2">
                <ShoppingBag className="text-blue-700" />
                Orders Admin
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Simple informative table view with filters, CSV export and pagination.
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() =>
                  fetchOrders({
                    nextPage: pagination.page,
                    nextSearch: appliedSearch,
                    nextStatus: statusFilter,
                    nextPaymentGateway: paymentGatewayFilter,
                    nextType: typeFilter,
                    nextPerPage: perPage,
                    nextStartDate: startDate,
                    nextEndDate: endDate,
                  })
                }
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <RefreshCcw size={16} />
                Refresh
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                disabled={exportingCsv}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm disabled:opacity-60"
              >
                <Download size={16} />
                {exportingCsv ? "Exporting..." : "Export CSV"}
              </button>

              <Link
                href="/admin/order-reports"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition font-semibold shadow-sm"
              >
                <BarChart3 size={16} />
                Order Reports
              </Link>

              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                Back to Admin <ArrowRight size={18} />
              </Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-xs uppercase font-extrabold text-slate-500">Total Orders</div>
              <div className="mt-2 text-2xl font-extrabold text-slate-900">{summary.totalOrders}</div>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
              <div className="text-xs uppercase font-extrabold text-blue-700">Total Revenue</div>
              <div className="mt-2 text-2xl font-extrabold text-blue-900">₹{money(summary.totalRevenue)}</div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
              <div className="text-xs uppercase font-extrabold text-emerald-700">Current Page Rows</div>
              <div className="mt-2 text-2xl font-extrabold text-emerald-900">{summary.pageOrders}</div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <div className="text-xs uppercase font-extrabold text-amber-700">Current Page Revenue</div>
              <div className="mt-2 text-2xl font-extrabold text-amber-900">₹{money(pageRevenue)}</div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Filter size={16} className="text-slate-600" />
              <div className="font-extrabold text-slate-900">Filters</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <div className="md:col-span-2">
                <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3">
                  <Search size={16} className="text-gray-400" />
                  <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleApplyFilters();
                    }}
                    className="w-full outline-none"
                    placeholder="Search by name, email, phone..."
                  />
                </div>
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none"
              >
                <option value="all">All Status</option>
                <option value="paid">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <select
                value={paymentGatewayFilter}
                onChange={(e) => setPaymentGatewayFilter(e.target.value)}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none"
              >
                <option value="all">All Payment Methods</option>
                <option value="razorpay">Razorpay</option>
                <option value="wallet">Wallet</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none"
              >
                <option value="all">All Order Types</option>
                <option value="product">Product Orders</option>
                <option value="saved_combo">Saved Combo Orders</option>
                <option value="builder_combo">Builder Combo Orders</option>
                <option value="combo">All Combo Orders</option>
              </select>

              <select
                value={perPage}
                onChange={(e) => setPerPage(e.target.value)}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none"
              >
                <option value="15">15 / page</option>
                <option value="25">25 / page</option>
                <option value="50">50 / page</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
              <div>
                <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none"
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
                  className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleApplyFilters}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-950 text-white font-extrabold shadow-sm"
                >
                  Filter
                </button>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 font-bold shadow-sm"
                >
                  <X size={14} />
                  Reset Filters
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-slate-700">
              Showing <span className="font-extrabold">{currentStart}</span> to{" "}
              <span className="font-extrabold">{currentEnd}</span> of{" "}
              <span className="font-extrabold">{pagination.totalOrders}</span> orders
            </div>
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center font-extrabold text-slate-600 flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                Loading orders...
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
                <div className="font-extrabold text-red-700">Unable to load orders</div>
                <div className="mt-1 text-sm font-semibold text-red-600">{error}</div>
              </div>
            ) : orders.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
                <div className="font-extrabold text-slate-900">No orders found</div>
                <div className="mt-1 text-sm font-semibold text-slate-600">
                  Current filters ke hisaab se koi order visible nahi hai.
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide font-extrabold text-slate-500 border-b border-gray-200 whitespace-nowrap">
                          #
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide font-extrabold text-slate-500 border-b border-gray-200 whitespace-nowrap">
                          Customer
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide font-extrabold text-slate-500 border-b border-gray-200 whitespace-nowrap">
                          Email
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide font-extrabold text-slate-500 border-b border-gray-200 whitespace-nowrap">
                          Phone
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide font-extrabold text-slate-500 border-b border-gray-200 whitespace-nowrap">
                          Total
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide font-extrabold text-slate-500 border-b border-gray-200 whitespace-nowrap">
                          Payment
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide font-extrabold text-slate-500 border-b border-gray-200 whitespace-nowrap">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide font-extrabold text-slate-500 border-b border-gray-200 whitespace-nowrap">
                          Order Date
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide font-extrabold text-slate-500 border-b border-gray-200 whitespace-nowrap">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {orders.map((order, index) => {
                        const serial =
                          pagination.totalOrders -
                          ((pagination.page - 1) * pagination.limit + index);

                        return (
                          <tr
                            key={order._id || `${order.orderRef}-${index}`}
                            className="border-b border-gray-100 last:border-b-0"
                          >
                            <td className="px-4 py-3 align-top whitespace-nowrap font-semibold text-slate-900">
                              {serial}
                            </td>

                            <td className="px-4 py-3 align-top whitespace-nowrap">
                              <div className="font-semibold text-slate-900">
                                {safeStr(order.customerName) || "-"}
                              </div>
                            </td>

                            <td className="px-4 py-3 align-top whitespace-nowrap">
                              <div className="text-slate-800">
                                {safeStr(order.customerEmail) || safeStr(order.userEmail) || "-"}
                              </div>
                            </td>

                            <td className="px-4 py-3 align-top whitespace-nowrap">
                              <div className="text-slate-800">
                                {safeStr(order.customerPhone) || "-"}
                              </div>
                            </td>

                            <td className="px-4 py-3 align-top whitespace-nowrap">
                              <div className="font-semibold text-slate-900">
                                ₹{money(safeNum(order.totalAmount, 0))}
                              </div>
                            </td>

                            <td className="px-4 py-3 align-top whitespace-nowrap">
                              <span
                                className={`inline-flex items-center rounded-lg px-3 py-1 text-xs font-extrabold ${getPaymentClass(
                                  safeStr(order.paymentGateway)
                                )}`}
                              >
                                {getPaymentLabel(safeStr(order.paymentGateway))}
                              </span>
                            </td>

                            <td className="px-4 py-3 align-top whitespace-nowrap">
                              <span
                                className={`inline-flex items-center rounded-lg px-3 py-1 text-xs font-extrabold ${getStatusClass(
                                  safeStr(order.status)
                                )}`}
                              >
                                {getStatusLabel(safeStr(order.status))}
                              </span>
                            </td>

                            <td className="px-4 py-3 align-top whitespace-nowrap">
                              {fmtDate(order.paidAt || order.createdAt)}
                            </td>

                            <td className="px-4 py-3 align-top whitespace-nowrap">
                              <button
                                onClick={() => setSelectedOrder(order)}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 font-semibold shadow-sm"
                              >
                                <Eye size={15} />
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <PaginationBar
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      {selectedOrder ? (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSelectedOrder(null)}
          />
          <div className="relative w-full max-w-5xl rounded-3xl bg-white border border-gray-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-extrabold text-slate-900">
                  Order Details
                </div>
                <div className="text-sm text-slate-600 break-all">
                  {safeStr(selectedOrder.orderRef) || safeStr(selectedOrder._id)}
                </div>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="h-10 w-10 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-[11px] uppercase font-extrabold text-slate-500">Customer</div>
                  <div className="mt-1 font-extrabold text-slate-900">
                    {safeStr(selectedOrder.customerName) || "-"}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-[11px] uppercase font-extrabold text-slate-500">Email</div>
                  <div className="mt-1 font-extrabold text-slate-900 break-all">
                    {safeStr(selectedOrder.customerEmail) || safeStr(selectedOrder.userEmail) || "-"}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-[11px] uppercase font-extrabold text-slate-500">Phone</div>
                  <div className="mt-1 font-extrabold text-slate-900">
                    {safeStr(selectedOrder.customerPhone) || "-"}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-[11px] uppercase font-extrabold text-slate-500">Total</div>
                  <div className="mt-1 font-extrabold text-slate-900">
                    ₹{money(safeNum(selectedOrder.totalAmount, 0))}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-[11px] uppercase font-extrabold text-slate-500">Payment</div>
                  <div className="mt-1 font-extrabold text-slate-900">
                    {getPaymentLabel(safeStr(selectedOrder.paymentGateway))}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-[11px] uppercase font-extrabold text-slate-500">Status</div>
                  <div className="mt-1 font-extrabold text-slate-900">
                    {getStatusLabel(safeStr(selectedOrder.status))}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-[11px] uppercase font-extrabold text-slate-500">Order Date</div>
                  <div className="mt-1 font-extrabold text-slate-900">
                    {fmtDate(selectedOrder.paidAt || selectedOrder.createdAt)}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-[11px] uppercase font-extrabold text-slate-500">Payment ID</div>
                  <div className="mt-1 font-extrabold text-slate-900 break-all">
                    {safeStr(selectedOrder.paymentId) || "-"}
                  </div>
                </div>
              </div>

              {selectedOrder?.shipping ? (
                <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-[11px] uppercase font-extrabold text-slate-500">
                    Shipping Address
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-800 leading-6">
                    {[
                      safeStr(selectedOrder.shipping?.address),
                      safeStr(selectedOrder.shipping?.city),
                      safeStr(selectedOrder.shipping?.state),
                      safeStr(selectedOrder.shipping?.pincode),
                    ]
                      .filter(Boolean)
                      .join(", ") || "-"}
                  </div>
                </div>
              ) : null}

              <div className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200 font-extrabold text-slate-900">
                  Order Items
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide font-extrabold text-slate-500 border-b border-gray-200 whitespace-nowrap">
                          Title
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide font-extrabold text-slate-500 border-b border-gray-200 whitespace-nowrap">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide font-extrabold text-slate-500 border-b border-gray-200 whitespace-nowrap">
                          Category
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide font-extrabold text-slate-500 border-b border-gray-200 whitespace-nowrap">
                          Qty
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide font-extrabold text-slate-500 border-b border-gray-200 whitespace-nowrap">
                          Price
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {(Array.isArray(selectedOrder.items) ? selectedOrder.items : []).map(
                        (item, idx) => (
                          <tr
                            key={`${safeStr(item.productId)}-${idx}`}
                            className="border-b border-gray-100 last:border-b-0"
                          >
                            <td className="px-4 py-3 align-top">
                              <div className="font-semibold text-slate-900">
                                {safeStr(item.title) || "Untitled Item"}
                              </div>
                              {Array.isArray(item.comboItems) && item.comboItems.length > 0 ? (
                                <div className="mt-1 text-xs text-slate-500">
                                  Combo items: {item.comboItems.length}
                                </div>
                              ) : null}
                            </td>

                            <td className="px-4 py-3 align-top whitespace-nowrap">
                              {isComboItem(item)
                                ? item.isBuilderCombo
                                  ? "Builder Combo"
                                  : "Saved Combo"
                                : "Product"}
                            </td>

                            <td className="px-4 py-3 align-top whitespace-nowrap">
                              {safeStr(item.category) || safeStr(item.comboCategorySlug) || "-"}
                            </td>

                            <td className="px-4 py-3 align-top whitespace-nowrap">
                              {Math.max(1, safeNum(item.quantity, 1))}
                            </td>

                            <td className="px-4 py-3 align-top whitespace-nowrap font-semibold text-slate-900">
                              ₹{money(safeNum(item.price, 0))}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 bg-white flex items-center justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}