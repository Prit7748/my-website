"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  Search,
  X,
  UserCircle2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  PauseCircle,
  Ban,
  Trash2,
  Gem,
  Copy,
  PlusCircle,
  MinusCircle,
  Save,
  StickyNote,
  Eye,
  Filter,
  ChevronLeft,
  ChevronRight,
  Download,
  CalendarDays,
} from "lucide-react";

type ResellerSnap = {
  isReseller?: boolean;
  status?: string;
  planCode?: string;
  planName?: string;
  walletBalance?: number;
  walletTotalRecharged?: number;
  walletTotalUsed?: number;
  walletTotalDiscountSaved?: number;
  notes?: string;
};

type UserRow = {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  userType?: string;
  userTypeLabel?: string;
  orderCount?: number;
  totalPaidOrders?: number;
  totalProductsOrdered?: number;
  totalPaidAmount?: number;
  createdAt?: string;
  updatedAt?: string;
  reseller?: ResellerSnap;
};

type ListResp = {
  items: UserRow[];
  filters?: {
    q?: string;
    userType?: string;
    sellerStatus?: string;
    joinedFrom?: string;
    joinedTo?: string;
  };
  pagination: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
};

type UserTypeFilter = "all" | "student" | "seller" | "co_admin" | "admin";
type SellerStatusFilter = "all" | "active" | "paused" | "blocked" | "inactive";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function money(n: number) {
  try {
    return new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 2,
    }).format(Number(n || 0));
  } catch {
    return String(n || 0);
  }
}

function shortUserId(id: string) {
  const v = safeStr(id);
  if (v.length <= 16) return v;
  return `${v.slice(0, 10)}...${v.slice(-6)}`;
}

function planTheme(codeOrName: string) {
  const c = safeStr(codeOrName).toLowerCase();
  if (c.includes("basic")) return "bg-green-50 text-green-700 border-green-200";
  if (c.includes("standard")) return "bg-orange-50 text-orange-700 border-orange-200";
  if (c.includes("premium")) return "bg-violet-50 text-violet-700 border-violet-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function sellerStatusTheme(status: string) {
  const s = safeStr(status).toLowerCase();
  if (s === "active") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "paused") return "bg-amber-50 text-amber-700 border-amber-200";
  if (s === "blocked") return "bg-red-50 text-red-700 border-red-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

function userTypeTheme(userType: string) {
  const t = safeStr(userType).toLowerCase();
  if (t === "seller") return "bg-violet-100 text-violet-800 border-violet-300";
  if (t === "admin") return "bg-rose-100 text-rose-800 border-rose-300";
  if (t === "co_admin") return "bg-blue-100 text-blue-800 border-blue-300";
  return "bg-slate-100 text-slate-700 border-slate-300";
}

function fmtDate(input?: string) {
  if (!input) return "—";
  try {
    return new Date(input).toLocaleDateString("en-IN");
  } catch {
    return "—";
  }
}

function csvEscape(value: any) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsv(rows: Record<string, any>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(",")),
  ];
  return lines.join("\n");
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

export default function AdminUsersPage() {
  const [items, setItems] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [userTypeFilter, setUserTypeFilter] = useState<UserTypeFilter>("all");
  const [sellerStatusFilter, setSellerStatusFilter] =
    useState<SellerStatusFilter>("all");

  const [joinedFrom, setJoinedFrom] = useState("");
  const [joinedTo, setJoinedTo] = useState("");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);

  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    totalPages: 1,
    limit: 15,
  });

  const [busyKey, setBusyKey] = useState("");
  const [exporting, setExporting] = useState(false);

  const [walletAmounts, setWalletAmounts] = useState<Record<string, string>>({});
  const [walletNotes, setWalletNotes] = useState<Record<string, string>>({});
  const [walletPlanCodes, setWalletPlanCodes] = useState<Record<string, string>>(
    {}
  );

  const [selectedUserId, setSelectedUserId] = useState("");

  const [toast, setToast] = useState<{
    show: boolean;
    ok: boolean;
    text: string;
  }>({
    show: false,
    ok: true,
    text: "",
  });

  const toastT = useRef<any>(null);

  function showToast(text: string, ok: boolean) {
    if (toastT.current) clearTimeout(toastT.current);
    setToast({ show: true, ok, text });
    toastT.current = setTimeout(
      () => setToast((p) => ({ ...p, show: false })),
      1800
    );
  }

  const selectedUser = useMemo(() => {
    return items.find((u) => u._id === selectedUserId) || null;
  }, [items, selectedUserId]);

  async function load(args?: {
    nextPage?: number;
    nextLimit?: number;
    nextSearch?: string;
    nextUserType?: UserTypeFilter;
    nextSellerStatus?: SellerStatusFilter;
    nextJoinedFrom?: string;
    nextJoinedTo?: string;
  }) {
    const nextPage = Math.max(1, safeNum(args?.nextPage, page));
    const nextLimit = Math.max(10, safeNum(args?.nextLimit, limit));
    const nextSearch =
      args?.nextSearch !== undefined ? safeStr(args.nextSearch) : appliedSearch;
    const nextUserType =
      args?.nextUserType !== undefined ? args.nextUserType : userTypeFilter;
    const nextSellerStatus =
      args?.nextSellerStatus !== undefined
        ? args.nextSellerStatus
        : sellerStatusFilter;
    const nextJoinedFrom =
      args?.nextJoinedFrom !== undefined ? args.nextJoinedFrom : joinedFrom;
    const nextJoinedTo =
      args?.nextJoinedTo !== undefined ? args.nextJoinedTo : joinedTo;

    setError("");
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("limit", String(nextLimit));
      if (safeStr(nextSearch)) params.set("q", safeStr(nextSearch));
      params.set("userType", nextUserType);
      params.set("sellerStatus", nextSellerStatus);
      if (safeStr(nextJoinedFrom)) params.set("joinedFrom", nextJoinedFrom);
      if (safeStr(nextJoinedTo)) params.set("joinedTo", nextJoinedTo);

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });

      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load users");
      }

      const typed = data as ListResp;
      const nextItems = Array.isArray(typed.items) ? typed.items : [];
      setItems(nextItems);

      setWalletNotes((prev) => {
        const next = { ...prev };
        for (const u of nextItems) {
          if (next[u._id] === undefined) {
            next[u._id] = safeStr(u?.reseller?.notes);
          }
        }
        return next;
      });

      setWalletPlanCodes((prev) => {
        const next = { ...prev };
        for (const u of nextItems) {
          if (!next[u._id]) {
            next[u._id] =
              safeStr(u?.reseller?.planCode || "basic").toLowerCase() || "basic";
          }
        }
        return next;
      });

      const p = typed.pagination || {
        total: 0,
        page: 1,
        totalPages: 1,
        limit: nextLimit,
      };

      setMeta({
        total: Number(p.total || 0),
        page: Number(p.page || 1),
        totalPages: Number(p.totalPages || 1),
        limit: Number(p.limit || nextLimit),
      });

      setPage(Number(p.page || 1));
      setLimit(Number(p.limit || nextLimit));
    } catch (e: any) {
      setError(e?.message || "Failed to load users");
      setItems([]);
      setMeta({ total: 0, page: 1, totalPages: 1, limit: nextLimit });
    } finally {
      setLoading(false);
    }
  }

  async function exportCsv() {
    try {
      setExporting(true);

      const params = new URLSearchParams();
      params.set("exportAll", "1");
      params.set("limit", "5000");
      if (safeStr(appliedSearch)) params.set("q", safeStr(appliedSearch));
      params.set("userType", userTypeFilter);
      params.set("sellerStatus", sellerStatusFilter);
      if (safeStr(joinedFrom)) params.set("joinedFrom", joinedFrom);
      if (safeStr(joinedTo)) params.set("joinedTo", joinedTo);

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });

      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};

      if (!res.ok) {
        throw new Error(data?.error || "CSV export failed");
      }

      const allItems: UserRow[] = Array.isArray(data?.items) ? data.items : [];

      const csvRows = allItems.map((u, idx) => ({
        Serial: idx + 1,
        Name: safeStr(u.name),
        Email: safeStr(u.email),
        Phone: safeStr(u.phone),
        Role: safeStr(u.userTypeLabel || "Student"),
        Paid_Orders: safeNum(u.totalPaidOrders, 0),
        Products_Ordered: safeNum(u.totalProductsOrdered, 0),
        Total_Paid: safeNum(u.totalPaidAmount, 0),
        Seller_Status: safeStr(u?.reseller?.status),
        Seller_Plan: safeStr(u?.reseller?.planName || u?.reseller?.planCode),
        Wallet_Balance: safeNum(u?.reseller?.walletBalance, 0),
        Wallet_Recharged: safeNum(u?.reseller?.walletTotalRecharged, 0),
        Wallet_Used: safeNum(u?.reseller?.walletTotalUsed, 0),
        Wallet_Saved: safeNum(u?.reseller?.walletTotalDiscountSaved, 0),
        Joined_Date: safeStr(u.createdAt ? fmtDate(u.createdAt) : ""),
        User_ID: safeStr(u._id),
        Seller_Note: safeStr(u?.reseller?.notes),
      }));

      const csv = buildCsv(csvRows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "admin-users-export.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      showToast("CSV exported successfully", true);
    } catch (e: any) {
      showToast(e?.message || "CSV export failed", false);
    } finally {
      setExporting(false);
    }
  }

  async function updateSeller(userId: string, action: string) {
    setBusyKey(`${userId}:${action}`);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId, action }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to update seller status");

      showToast(data?.message || "Updated", true);

      await load({
        nextPage: meta.page,
        nextLimit: meta.limit,
        nextSearch: appliedSearch,
        nextUserType: userTypeFilter,
        nextSellerStatus: sellerStatusFilter,
        nextJoinedFrom: joinedFrom,
        nextJoinedTo: joinedTo,
      });
    } catch (e: any) {
      showToast(e?.message || "Failed to update", false);
    } finally {
      setBusyKey("");
    }
  }

  async function saveSellerNote(userId: string) {
    setBusyKey(`${userId}:save_seller_note`);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          userId,
          action: "save_seller_note",
          note: safeStr(walletNotes[userId]),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to save seller note");

      showToast(data?.message || "Seller note saved", true);

      await load({
        nextPage: meta.page,
        nextLimit: meta.limit,
        nextSearch: appliedSearch,
        nextUserType: userTypeFilter,
        nextSellerStatus: sellerStatusFilter,
        nextJoinedFrom: joinedFrom,
        nextJoinedTo: joinedTo,
      });
    } catch (e: any) {
      showToast(e?.message || "Failed to save note", false);
    } finally {
      setBusyKey("");
    }
  }

  async function updateWallet(
    userId: string,
    action: "manual_wallet_credit" | "manual_wallet_debit"
  ) {
    setBusyKey(`${userId}:${action}`);
    try {
      const amount = Number(walletAmounts[userId] || 0);

      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          userId,
          action,
          amount,
          note: safeStr(walletNotes[userId]),
          planCode: safeStr(walletPlanCodes[userId] || "basic").toLowerCase(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Wallet update failed");

      showToast(data?.message || "Wallet updated", true);
      setWalletAmounts((prev) => ({ ...prev, [userId]: "" }));

      await load({
        nextPage: meta.page,
        nextLimit: meta.limit,
        nextSearch: appliedSearch,
        nextUserType: userTypeFilter,
        nextSellerStatus: sellerStatusFilter,
        nextJoinedFrom: joinedFrom,
        nextJoinedTo: joinedTo,
      });
    } catch (e: any) {
      showToast(e?.message || "Wallet update failed", false);
    } finally {
      setBusyKey("");
    }
  }

  async function copyUserId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      showToast("User ID copied", true);
    } catch {
      showToast("Copy failed", false);
    }
  }

  useEffect(() => {
    void load({
      nextPage: 1,
      nextLimit: 15,
      nextSearch: "",
      nextUserType: "all",
      nextSellerStatus: "all",
      nextJoinedFrom: "",
      nextJoinedTo: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedUserId && !items.some((u) => u._id === selectedUserId)) {
      setSelectedUserId("");
    }
  }, [items, selectedUserId]);

  function handleApplyFilters() {
    const nextSearch = safeStr(searchInput);
    setAppliedSearch(nextSearch);
    setPage(1);

    void load({
      nextPage: 1,
      nextLimit: limit,
      nextSearch,
      nextUserType: userTypeFilter,
      nextSellerStatus: sellerStatusFilter,
      nextJoinedFrom: joinedFrom,
      nextJoinedTo: joinedTo,
    });
  }

  function handleResetFilters() {
    setSearchInput("");
    setAppliedSearch("");
    setUserTypeFilter("all");
    setSellerStatusFilter("all");
    setJoinedFrom("");
    setJoinedTo("");
    setPage(1);

    void load({
      nextPage: 1,
      nextLimit: limit,
      nextSearch: "",
      nextUserType: "all",
      nextSellerStatus: "all",
      nextJoinedFrom: "",
      nextJoinedTo: "",
    });
  }

  function handlePageChange(nextPage: number) {
    if (nextPage < 1 || nextPage > meta.totalPages) return;

    void load({
      nextPage,
      nextLimit: limit,
      nextSearch: appliedSearch,
      nextUserType: userTypeFilter,
      nextSellerStatus: sellerStatusFilter,
      nextJoinedFrom: joinedFrom,
      nextJoinedTo: joinedTo,
    });
  }

  function handleLimitChange(nextLimit: number) {
    setLimit(nextLimit);
    setPage(1);

    void load({
      nextPage: 1,
      nextLimit,
      nextSearch: appliedSearch,
      nextUserType: userTypeFilter,
      nextSellerStatus: sellerStatusFilter,
      nextJoinedFrom: joinedFrom,
      nextJoinedTo: joinedTo,
    });
  }

  const pageSummary = useMemo(() => {
    const sellerUsers = items.filter((u) => safeStr(u.userType) === "seller").length;
    const studentUsers = items.filter((u) => safeStr(u.userType) === "student").length;
    const adminUsers = items.filter(
      (u) => safeStr(u.userType) === "admin" || safeStr(u.userType) === "co_admin"
    ).length;

    const pagePaidAmount = items.reduce(
      (acc, u) => acc + safeNum(u.totalPaidAmount, 0),
      0
    );

    return {
      sellerUsers,
      studentUsers,
      adminUsers,
      pagePaidAmount,
    };
  }, [items]);

  const currentStart = useMemo(() => {
    if (meta.total === 0) return 0;
    return (meta.page - 1) * meta.limit + 1;
  }, [meta]);

  const currentEnd = useMemo(() => {
    if (meta.total === 0) return 0;
    return Math.min(meta.page * meta.limit, meta.total);
  }, [meta]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div
        className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[9999] transition-all duration-300 ${
          toast.show
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-3 pointer-events-none"
        }`}
      >
        <div
          className={`px-4 py-2 rounded-2xl shadow-lg border text-sm font-extrabold flex items-center gap-2 ${
            toast.ok
              ? "bg-emerald-500 text-white border-emerald-400"
              : "bg-rose-500 text-white border-rose-400"
          }`}
        >
          {toast.ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          {toast.text}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 md:py-10">
        <div className="rounded-[28px] bg-white border border-slate-200 p-5 md:p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="text-2xl font-extrabold flex items-center gap-2 text-indigo-900">
                <UserCircle2 className="text-indigo-500" />
                Users
              </div>
              <div className="text-sm text-slate-500 mt-1">
                Table view me informative user list with seller highlight, popup actions, CSV export and joined date filter.
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() =>
                  load({
                    nextPage: meta.page,
                    nextLimit: limit,
                    nextSearch: appliedSearch,
                    nextUserType: userTypeFilter,
                    nextSellerStatus: sellerStatusFilter,
                    nextJoinedFrom: joinedFrom,
                    nextJoinedTo: joinedTo,
                  })
                }
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 transition font-semibold shadow-sm text-slate-700"
              >
                <RefreshCw size={18} className="text-indigo-400" />
                Refresh
              </button>

              <button
                onClick={exportCsv}
                disabled={exporting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white transition font-semibold shadow-sm"
              >
                {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                {exporting ? "Exporting..." : "Export CSV"}
              </button>

              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 transition font-semibold shadow-sm text-slate-700"
              >
                <ArrowLeft size={18} className="text-slate-400" />
                Back
              </Link>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <SummaryCard title="Total Users" value={String(meta.total)} />
            <SummaryCard
              title="Seller Users (Page)"
              value={String(pageSummary.sellerUsers)}
              tone="premium"
            />
            <SummaryCard
              title="Student Users (Page)"
              value={String(pageSummary.studentUsers)}
              tone="blue"
            />
            <SummaryCard
              title="Total Paid Amount (Page)"
              value={`₹${money(pageSummary.pagePaidAmount)}`}
              tone="emerald"
            />
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Filter size={16} className="text-slate-600" />
              <div className="font-extrabold text-slate-900">Filters</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
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
                value={userTypeFilter}
                onChange={(e) => setUserTypeFilter(e.target.value as UserTypeFilter)}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none"
              >
                <option value="all">All User Types</option>
                <option value="student">Student</option>
                <option value="seller">Seller</option>
                <option value="co_admin">Co Admin</option>
                <option value="admin">Admin</option>
              </select>

              <select
                value={sellerStatusFilter}
                onChange={(e) =>
                  setSellerStatusFilter(e.target.value as SellerStatusFilter)
                }
                className="rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none"
              >
                <option value="all">All Seller Status</option>
                <option value="active">Active Sellers</option>
                <option value="paused">Paused Sellers</option>
                <option value="blocked">Blocked Sellers</option>
                <option value="inactive">Inactive Sellers</option>
              </select>

              <div>
                <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3">
                  <CalendarDays size={16} className="text-gray-400" />
                  <input
                    type="date"
                    value={joinedFrom}
                    onChange={(e) => setJoinedFrom(e.target.value)}
                    className="w-full outline-none bg-transparent"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3">
                  <CalendarDays size={16} className="text-gray-400" />
                  <input
                    type="date"
                    value={joinedTo}
                    onChange={(e) => setJoinedTo(e.target.value)}
                    className="w-full outline-none bg-transparent"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleApplyFilters}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-950 text-white font-extrabold shadow-sm"
              >
                Filter
              </button>
            </div>

            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 font-bold shadow-sm"
              >
                <X size={14} />
                Reset Filters
              </button>

              <select
                value={limit}
                onChange={(e) => handleLimitChange(Number(e.target.value))}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 outline-none font-bold"
              >
                <option value={15}>15 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-slate-700">
              Showing <span className="font-extrabold">{currentStart}</span> to{" "}
              <span className="font-extrabold">{currentEnd}</span> of{" "}
              <span className="font-extrabold">{meta.total}</span> users
            </div>
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="rounded-2xl border border-indigo-50 bg-indigo-50/60 p-5 text-sm text-indigo-700 font-bold flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Loading users...
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 font-semibold">
                No users found.
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
                          User Name
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide font-extrabold text-slate-500 border-b border-gray-200 whitespace-nowrap">
                          Mail ID
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide font-extrabold text-slate-500 border-b border-gray-200 whitespace-nowrap">
                          Phone No.
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide font-extrabold text-slate-500 border-b border-gray-200 whitespace-nowrap">
                          Role
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide font-extrabold text-slate-500 border-b border-gray-200 whitespace-nowrap">
                          Products Ordered
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide font-extrabold text-slate-500 border-b border-gray-200 whitespace-nowrap">
                          Total Paid
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide font-extrabold text-slate-500 border-b border-gray-200 whitespace-nowrap">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {items.map((u, index) => {
                        const serial =
                          meta.total - ((meta.page - 1) * meta.limit + index);

                        const isSeller = safeStr(u.userType) === "seller";
                        const rowClass = isSeller
                          ? "bg-gradient-to-r from-violet-50/80 via-amber-50/70 to-white"
                          : "bg-white";

                        return (
                          <tr
                            key={u._id}
                            className={`border-b border-gray-100 last:border-b-0 ${rowClass}`}
                          >
                            <td className="px-4 py-3 align-top whitespace-nowrap font-semibold text-slate-900">
                              {serial}
                            </td>

                            <td className="px-4 py-3 align-top whitespace-nowrap">
                              <div className="font-semibold text-slate-900">
                                {safeStr(u.name) || "Unnamed User"}
                              </div>
                              {isSeller ? (
                                <div className="mt-1 text-[11px] font-extrabold text-violet-700">
                                  Premium Seller Row
                                </div>
                              ) : null}
                            </td>

                            <td className="px-4 py-3 align-top whitespace-nowrap">
                              <div className="text-slate-800">
                                {safeStr(u.email) || "-"}
                              </div>
                            </td>

                            <td className="px-4 py-3 align-top whitespace-nowrap">
                              <div className="text-slate-800">
                                {safeStr(u.phone) || "-"}
                              </div>
                            </td>

                            <td className="px-4 py-3 align-top whitespace-nowrap">
                              <span
                                className={`inline-flex items-center rounded-lg px-3 py-1 text-xs font-extrabold border ${userTypeTheme(
                                  safeStr(u.userType)
                                )}`}
                              >
                                {safeStr(u.userTypeLabel) || "Student"}
                              </span>
                            </td>

                            <td className="px-4 py-3 align-top whitespace-nowrap">
                              <div className="font-semibold text-slate-900">
                                {safeNum(u.totalProductsOrdered, 0)}
                              </div>
                              <div className="mt-1 text-[11px] text-slate-500 font-semibold">
                                Orders: {safeNum(u.totalPaidOrders, 0)}
                              </div>
                            </td>

                            <td className="px-4 py-3 align-top whitespace-nowrap">
                              <div className="font-semibold text-slate-900">
                                ₹{money(safeNum(u.totalPaidAmount, 0))}
                              </div>
                            </td>

                            <td className="px-4 py-3 align-top whitespace-nowrap">
                              <button
                                onClick={() => setSelectedUserId(u._id)}
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
            page={meta.page}
            totalPages={meta.totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      {selectedUser ? (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSelectedUserId("")}
          />
          <div className="relative w-full max-w-5xl rounded-3xl bg-white border border-gray-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-extrabold text-slate-900">
                  User Details
                </div>
                <div className="text-sm text-slate-600 break-all">
                  {safeStr(selectedUser.name) || "Unnamed User"} • {shortUserId(selectedUser._id)}
                </div>
              </div>

              <button
                onClick={() => setSelectedUserId("")}
                className="h-10 w-10 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <MiniCard title="Name" value={safeStr(selectedUser.name) || "-"} />
                <MiniCard title="Email" value={safeStr(selectedUser.email) || "-"} />
                <MiniCard title="Phone" value={safeStr(selectedUser.phone) || "-"} />
                <MiniCard title="Role" value={safeStr(selectedUser.userTypeLabel) || "Student"} />
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                <MiniCard
                  title="Paid Orders"
                  value={String(safeNum(selectedUser.totalPaidOrders, 0))}
                />
                <MiniCard
                  title="Products Ordered"
                  value={String(safeNum(selectedUser.totalProductsOrdered, 0))}
                />
                <MiniCard
                  title="Total Paid"
                  value={`₹${money(safeNum(selectedUser.totalPaidAmount, 0))}`}
                />
                <MiniCard
                  title="Joined"
                  value={fmtDate(selectedUser.createdAt)}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyUserId(selectedUser._id)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-2 text-xs font-extrabold text-slate-700 transition"
                  title={selectedUser._id}
                >
                  <Copy size={14} />
                  Copy User ID
                </button>

                <span
                  className={`inline-flex items-center rounded-xl border px-3 py-2 text-xs font-extrabold ${userTypeTheme(
                    safeStr(selectedUser.userType)
                  )}`}
                >
                  {safeStr(selectedUser.userTypeLabel) || "Student"}
                </span>

                <span
                  className={`inline-flex items-center rounded-xl border px-3 py-2 text-xs font-extrabold ${sellerStatusTheme(
                    safeStr(selectedUser?.reseller?.status || "inactive")
                  )}`}
                >
                  Seller Status: {safeStr(selectedUser?.reseller?.status || "inactive").toUpperCase()}
                </span>

                <span
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-extrabold ${planTheme(
                    safeStr(
                      selectedUser?.reseller?.planName ||
                        selectedUser?.reseller?.planCode ||
                        "No Plan"
                    )
                  )}`}
                >
                  <Gem size={13} />
                  {safeStr(
                    selectedUser?.reseller?.planName ||
                      selectedUser?.reseller?.planCode ||
                      "No Plan"
                  )}
                </span>
              </div>

              <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500 mb-3">
                    Seller Quick Actions
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <ActionBtn
                      disabled={busyKey !== "" && !busyKey.startsWith(`${selectedUser._id}:activate_`)}
                      onClick={() => updateSeller(selectedUser._id, "activate_basic")}
                      className="border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                    >
                      Basic
                    </ActionBtn>

                    <ActionBtn
                      disabled={busyKey !== "" && !busyKey.startsWith(`${selectedUser._id}:activate_`)}
                      onClick={() => updateSeller(selectedUser._id, "activate_standard")}
                      className="border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                    >
                      Standard
                    </ActionBtn>

                    <ActionBtn
                      disabled={busyKey !== "" && !busyKey.startsWith(`${selectedUser._id}:activate_`)}
                      onClick={() => updateSeller(selectedUser._id, "activate_premium")}
                      className="border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                    >
                      Premium
                    </ActionBtn>

                    <ActionBtn
                      disabled={busyKey !== "" && busyKey !== `${selectedUser._id}:pause_seller`}
                      onClick={() => updateSeller(selectedUser._id, "pause_seller")}
                      className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    >
                      <PauseCircle size={14} />
                      Pause
                    </ActionBtn>

                    <ActionBtn
                      disabled={busyKey !== "" && busyKey !== `${selectedUser._id}:block_seller`}
                      onClick={() => updateSeller(selectedUser._id, "block_seller")}
                      className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                    >
                      <Ban size={14} />
                      Block
                    </ActionBtn>

                    <ActionBtn
                      disabled={busyKey !== "" && busyKey !== `${selectedUser._id}:remove_seller`}
                      onClick={() => updateSeller(selectedUser._id, "remove_seller")}
                      className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                    >
                      <Trash2 size={14} />
                      Remove
                    </ActionBtn>
                  </div>

                  {busyKey.startsWith(`${selectedUser._id}:`) ? (
                    <div className="mt-3 inline-flex items-center gap-2 text-xs font-extrabold text-indigo-600">
                      <Loader2 size={14} className="animate-spin" />
                      Updating...
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500 mb-3">
                    Wallet Snapshot
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <MiniCard
                      title="Wallet Balance"
                      value={`₹${money(safeNum(selectedUser?.reseller?.walletBalance, 0))}`}
                      compact
                    />
                    <MiniCard
                      title="Total Recharged"
                      value={`₹${money(safeNum(selectedUser?.reseller?.walletTotalRecharged, 0))}`}
                      compact
                    />
                    <MiniCard
                      title="Total Used"
                      value={`₹${money(safeNum(selectedUser?.reseller?.walletTotalUsed, 0))}`}
                      compact
                    />
                    <MiniCard
                      title="Total Saved"
                      value={`₹${money(safeNum(selectedUser?.reseller?.walletTotalDiscountSaved, 0))}`}
                      compact
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500 mb-3">
                  Manual Wallet Controls
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500 mb-2">
                        Plan For Manual Credit
                      </div>
                      <select
                        value={
                          walletPlanCodes[selectedUser._id] ||
                          safeStr(selectedUser?.reseller?.planCode || "basic") ||
                          "basic"
                        }
                        onChange={(e) =>
                          setWalletPlanCodes((prev) => ({
                            ...prev,
                            [selectedUser._id]: e.target.value,
                          }))
                        }
                        className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 outline-none focus:border-indigo-300"
                      >
                        <option value="basic">Basic</option>
                        <option value="standard">Standard</option>
                        <option value="premium">Premium</option>
                      </select>
                    </div>

                    <div>
                      <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500 mb-2">
                        Amount
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={walletAmounts[selectedUser._id] ?? ""}
                        onChange={(e) =>
                          setWalletAmounts((prev) => ({
                            ...prev,
                            [selectedUser._id]: e.target.value,
                          }))
                        }
                        placeholder="Enter amount"
                        className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 outline-none focus:border-indigo-300"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500 mb-2">
                      Internal Note
                    </div>
                    <textarea
                      value={walletNotes[selectedUser._id] ?? safeStr(selectedUser?.reseller?.notes)}
                      onChange={(e) =>
                        setWalletNotes((prev) => ({
                          ...prev,
                          [selectedUser._id]: e.target.value,
                        }))
                      }
                      placeholder="Example: Payment received manually and verified by admin"
                      className="w-full min-h-[96px] px-3 py-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 outline-none focus:border-indigo-300"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <ActionBtn
                      disabled={busyKey !== "" && busyKey !== `${selectedUser._id}:manual_wallet_credit`}
                      onClick={() => updateWallet(selectedUser._id, "manual_wallet_credit")}
                      className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    >
                      <PlusCircle size={14} />
                      Add Balance
                    </ActionBtn>

                    <ActionBtn
                      disabled={busyKey !== "" && busyKey !== `${selectedUser._id}:manual_wallet_debit`}
                      onClick={() => updateWallet(selectedUser._id, "manual_wallet_debit")}
                      className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                    >
                      <MinusCircle size={14} />
                      Deduct Balance
                    </ActionBtn>

                    <ActionBtn
                      disabled={busyKey !== "" && busyKey !== `${selectedUser._id}:save_seller_note`}
                      onClick={() => saveSellerNote(selectedUser._id)}
                      className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                    >
                      <Save size={14} />
                      Save Note
                    </ActionBtn>
                  </div>

                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-xs font-semibold text-blue-900">
                    Yahin se वही actions kaam karenge jo pehle main page par available the.
                  </div>
                </div>
              </div>

              {safeStr(walletNotes[selectedUser._id] ?? selectedUser?.reseller?.notes) ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-amber-700">
                    <StickyNote size={14} />
                    Seller Note
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-700">
                    {safeStr(walletNotes[selectedUser._id] ?? selectedUser?.reseller?.notes)}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="p-5 border-t border-gray-200 bg-white flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedUserId("")}
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

function SummaryCard({
  title,
  value,
  tone = "default",
}: {
  title: string;
  value: string;
  tone?: "default" | "premium" | "blue" | "emerald";
}) {
  const style =
    tone === "premium"
      ? "border-violet-200 bg-gradient-to-r from-violet-50 to-amber-50"
      : tone === "blue"
      ? "border-blue-200 bg-blue-50"
      : tone === "emerald"
      ? "border-emerald-200 bg-emerald-50"
      : "border-gray-200 bg-white";

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${style}`}>
      <div className="text-xs uppercase font-extrabold text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-extrabold text-slate-900">{value}</div>
    </div>
  );
}

function MiniCard({
  title,
  value,
  compact = false,
}: {
  title: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-gray-50 ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="text-[11px] uppercase font-extrabold text-slate-500">
        {title}
      </div>
      <div className="mt-1 font-extrabold text-slate-900 break-words">{value}</div>
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  className,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  className: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl border text-xs font-extrabold transition disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}