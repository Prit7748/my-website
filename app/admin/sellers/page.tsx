"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  Search,
  X,
  Users,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Mail,
  Phone,
  Wallet,
  Gem,
  PauseCircle,
  Ban,
  ShieldCheck,
  StickyNote,
  Filter,
} from "lucide-react";

type SellerReseller = {
  isReseller?: boolean;
  status?: string;
  planCode?: string;
  planName?: string;
  walletBalance?: number;
  walletTotalRecharged?: number;
  walletTotalUsed?: number;
  walletTotalDiscountSaved?: number;
  sellerBenefitsActive?: boolean;
  minimumActiveWalletBalance?: number;
  notes?: string;
};

type SellerRow = {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  reseller?: SellerReseller;
};

type Stats = {
  totalSellerAccounts: number;
  activeCount: number;
  inactiveCount: number;
  pausedCount: number;
  blockedCount: number;
  totalWalletBalance: number;
  totalRecharge: number;
  totalUsed: number;
  totalSaved: number;
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function shortUserId(id: string) {
  const v = safeStr(id);
  if (v.length <= 18) return v;
  return `${v.slice(0, 10)}...${v.slice(-6)}`;
}

function formatDate(input?: string | null) {
  if (!input) return "—";
  try {
    return new Date(input).toLocaleDateString("en-IN");
  } catch {
    return "—";
  }
}

function planTheme(codeOrName: string) {
  const c = safeStr(codeOrName).toLowerCase();
  if (c.includes("basic")) return "bg-green-50 text-green-700 border-green-200";
  if (c.includes("standard")) return "bg-orange-50 text-orange-700 border-orange-200";
  if (c.includes("premium")) return "bg-violet-50 text-violet-700 border-violet-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function statusTheme(status: string) {
  const s = safeStr(status).toLowerCase();
  if (s === "active") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "paused") return "bg-amber-50 text-amber-700 border-amber-200";
  if (s === "blocked") return "bg-red-50 text-red-700 border-red-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

export default function AdminSellersPage() {
  const [items, setItems] = useState<SellerRow[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalSellerAccounts: 0,
    activeCount: 0,
    inactiveCount: 0,
    pausedCount: 0,
    blockedCount: 0,
    totalWalletBalance: 0,
    totalRecharge: 0,
    totalUsed: 0,
    totalSaved: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(24);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1, limit: 24 });

  const [toast, setToast] = useState<{ show: boolean; ok: boolean; text: string }>({
    show: false,
    ok: true,
    text: "",
  });
  const toastT = useRef<any>(null);

  function showToast(text: string, ok: boolean) {
    if (toastT.current) clearTimeout(toastT.current);
    setToast({ show: true, ok, text });
    toastT.current = setTimeout(() => setToast((p) => ({ ...p, show: false })), 1800);
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (safeStr(q)) params.set("q", safeStr(q));
      if (status !== "all") params.set("status", status);
      if (plan !== "all") params.set("plan", plan);

      const res = await fetch(`/api/admin/sellers?${params.toString()}`, {
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to load sellers");

      setItems(Array.isArray(data?.items) ? data.items : []);
      setStats({
        totalSellerAccounts: safeNum(data?.stats?.totalSellerAccounts, 0),
        activeCount: safeNum(data?.stats?.activeCount, 0),
        inactiveCount: safeNum(data?.stats?.inactiveCount, 0),
        pausedCount: safeNum(data?.stats?.pausedCount, 0),
        blockedCount: safeNum(data?.stats?.blockedCount, 0),
        totalWalletBalance: safeNum(data?.stats?.totalWalletBalance, 0),
        totalRecharge: safeNum(data?.stats?.totalRecharge, 0),
        totalUsed: safeNum(data?.stats?.totalUsed, 0),
        totalSaved: safeNum(data?.stats?.totalSaved, 0),
      });
      setMeta({
        total: safeNum(data?.pagination?.total, 0),
        page: safeNum(data?.pagination?.page, 1),
        totalPages: safeNum(data?.pagination?.totalPages, 1),
        limit: safeNum(data?.pagination?.limit, limit),
      });
      setSelectedIds([]);
    } catch (e: any) {
      setError(e?.message || "Failed to load sellers");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [page, limit, status, plan]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      load();
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const selectedEmails = useMemo(() => {
    return items
      .filter((x) => selectedIds.includes(x._id))
      .map((x) => safeStr(x.email))
      .filter(Boolean);
  }, [items, selectedIds]);

  const selectedPhones = useMemo(() => {
    return items
      .filter((x) => selectedIds.includes(x._id))
      .map((x) => safeStr(x.phone))
      .filter(Boolean);
  }, [items, selectedIds]);

  const pages = useMemo(() => {
    const totalPages = meta.totalPages || 1;
    const cur = meta.page || 1;
    const windowSize = 2;

    const set = new Set<number>();
    set.add(1);
    set.add(totalPages);

    for (let i = cur - windowSize; i <= cur + windowSize; i++) {
      if (i >= 1 && i <= totalPages) set.add(i);
    }

    return Array.from(set).sort((a, b) => a - b);
  }, [meta.page, meta.totalPages]);

  async function copyText(value: string, okText: string) {
    try {
      await navigator.clipboard.writeText(value);
      showToast(okText, true);
    } catch {
      showToast("Copy failed", false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleSelectAllCurrentPage() {
    const currentIds = items.map((x) => x._id);
    const allSelected = currentIds.length > 0 && currentIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !currentIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...currentIds])));
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div
        className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[9999] transition-all duration-300 ${
          toast.show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
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
                <Users className="text-indigo-500" />
                Sellers Accounts
              </div>
              <div className="text-sm text-slate-500 mt-1">
                Dedicated seller records page for active, inactive, paused, and blocked seller accounts.
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={load}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 transition font-semibold shadow-sm text-slate-700"
              >
                <RefreshCw size={18} className="text-indigo-400" />
                Refresh
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

          <div className="mt-6 grid grid-cols-2 lg:grid-cols-5 xl:grid-cols-9 gap-3">
            <StatCard label="Total Sellers" value={stats.totalSellerAccounts} />
            <StatCard label="Active" value={stats.activeCount} />
            <StatCard label="Inactive" value={stats.inactiveCount} />
            <StatCard label="Paused" value={stats.pausedCount} />
            <StatCard label="Blocked" value={stats.blockedCount} />
            <StatCard label="Wallet" value={`₹${stats.totalWalletBalance}`} />
            <StatCard label="Recharge" value={`₹${stats.totalRecharge}`} />
            <StatCard label="Used" value={`₹${stats.totalUsed}`} />
            <StatCard label="Saved" value={`₹${stats.totalSaved}`} />
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_180px_180px_140px] gap-3 items-center">
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 focus-within:border-indigo-300 transition-colors min-w-0">
              <Search size={18} className="text-indigo-400 shrink-0" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search seller by name / email / phone / plan / status / notes..."
                className="w-full outline-none text-sm font-semibold bg-transparent text-slate-800 placeholder:text-indigo-300"
              />
              {q ? (
                <button
                  onClick={() => setQ("")}
                  className="h-9 w-9 rounded-xl hover:bg-indigo-100/60 flex items-center justify-center text-indigo-400 shrink-0"
                >
                  <X size={18} />
                </button>
              ) : null}
            </div>

            <select
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
              className="h-11 px-3 rounded-2xl border border-slate-200 bg-white text-sm font-extrabold text-slate-700 outline-none focus:border-indigo-300"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="paused">Paused</option>
              <option value="blocked">Blocked</option>
            </select>

            <select
              value={plan}
              onChange={(e) => {
                setPage(1);
                setPlan(e.target.value);
              }}
              className="h-11 px-3 rounded-2xl border border-slate-200 bg-white text-sm font-extrabold text-slate-700 outline-none focus:border-indigo-300"
            >
              <option value="all">All Plans</option>
              <option value="basic">Basic</option>
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
            </select>

            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="h-11 px-3 rounded-2xl border border-slate-200 bg-white text-sm font-extrabold text-slate-700 outline-none focus:border-indigo-300"
            >
              <option value={12}>12 / page</option>
              <option value={24}>24 / page</option>
              <option value={48}>48 / page</option>
              <option value={96}>96 / page</option>
            </select>
          </div>

          <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Filter size={16} className="text-blue-700" />
                  Selection tools for future seller notifications
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-600">
                  Current page se sellers select karke emails ya phone numbers ek click me copy kar sakte ho.
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={toggleSelectAllCurrentPage}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-extrabold text-slate-700"
                >
                  Select Current Page
                </button>

                <button
                  onClick={() => copyText(selectedEmails.join(", "), "Selected emails copied")}
                  disabled={selectedEmails.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-extrabold text-slate-700 disabled:opacity-50"
                >
                  <Mail size={16} />
                  Copy Emails ({selectedEmails.length})
                </button>

                <button
                  onClick={() => copyText(selectedPhones.join(", "), "Selected phones copied")}
                  disabled={selectedPhones.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-extrabold text-slate-700 disabled:opacity-50"
                >
                  <Phone size={16} />
                  Copy Phones ({selectedPhones.length})
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="rounded-2xl border border-indigo-50 bg-indigo-50/60 p-5 text-sm text-indigo-700 font-bold">
                Loading seller accounts...
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 font-semibold">
                No seller accounts found.
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((u) => {
                  const reseller = u.reseller || {};
                  const sellerStatus = safeStr(reseller.status || "inactive");
                  const sellerPlan = safeStr(reseller.planName || reseller.planCode || "No Plan");
                  const walletBalance = safeNum(reseller.walletBalance, 0);
                  const isSelected = selectedIds.includes(u._id);

                  return (
                    <div
                      key={u._id}
                      className={`rounded-[24px] border p-4 md:p-5 shadow-sm transition-all ${
                        isSelected
                          ? "border-indigo-300 bg-indigo-50/30"
                          : "border-slate-200 bg-white hover:border-indigo-200 hover:shadow-md"
                      }`}
                    >
                      <div className="flex flex-col xl:flex-row xl:items-start gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-3 min-w-0">
                            <label className="mt-2 shrink-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(u._id)}
                                className="h-4 w-4 accent-indigo-600"
                              />
                            </label>

                            <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                              <Users size={24} className="text-indigo-500" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-base md:text-lg font-extrabold text-slate-900 truncate">
                                  {safeStr(u.name) || "Unnamed Seller"}
                                </div>

                                <span
                                  className={`inline-flex items-center rounded-xl border px-3 py-1 text-[11px] font-extrabold ${statusTheme(
                                    sellerStatus
                                  )}`}
                                >
                                  {sellerStatus.toUpperCase()}
                                </span>

                                <span
                                  className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1 text-[11px] font-extrabold ${planTheme(
                                    sellerPlan
                                  )}`}
                                >
                                  <Gem size={13} />
                                  {sellerPlan}
                                </span>

                                <span
                                  className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1 text-[11px] font-extrabold ${
                                    reseller?.sellerBenefitsActive
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : "bg-slate-50 text-slate-600 border-slate-200"
                                  }`}
                                >
                                  {reseller?.sellerBenefitsActive ? (
                                    <ShieldCheck size={13} />
                                  ) : (
                                    <AlertTriangle size={13} />
                                  )}
                                  {reseller?.sellerBenefitsActive ? "Benefits Active" : "Benefits Inactive"}
                                </span>
                              </div>

                              <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => copyText(u._id, "User ID copied")}
                                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-[11px] font-extrabold text-slate-700 transition"
                                  title={u._id}
                                >
                                  <Copy size={13} className="text-slate-500" />
                                  {shortUserId(u._id)}
                                </button>

                                <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-600">
                                  Joined: {formatDate(u.createdAt)}
                                </span>

                                <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-600">
                                  Updated: {formatDate(u.updatedAt)}
                                </span>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <InfoChip icon={<Mail size={14} />} text={safeStr(u.email) || "No email"} />
                                <InfoChip icon={<Phone size={14} />} text={safeStr(u.phone) || "No phone"} />
                                <InfoChip icon={<Wallet size={14} />} text={`Wallet: ₹${walletBalance}`} />
                                <InfoChip icon={<Gem size={14} />} text={`Recharge: ₹${safeNum(reseller.walletTotalRecharged, 0)}`} />
                                <InfoChip icon={<PauseCircle size={14} />} text={`Used: ₹${safeNum(reseller.walletTotalUsed, 0)}`} />
                                <InfoChip icon={<ShieldCheck size={14} />} text={`Saved: ₹${safeNum(reseller.walletTotalDiscountSaved, 0)}`} />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="xl:w-[360px]">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                            <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">
                              Seller Snapshot
                            </div>

                            <Row label="Plan Code" value={safeStr(reseller.planCode || "—")} />
                            <Row label="Plan Name" value={safeStr(reseller.planName || "—")} />
                            <Row label="Min Active Wallet" value={`₹${safeNum(reseller.minimumActiveWalletBalance, 10)}`} />

                            {safeStr(reseller.notes) ? (
                              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                                <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-amber-700">
                                  <StickyNote size={14} />
                                  Internal Note
                                </div>
                                <div className="mt-2 text-sm font-semibold text-slate-700">
                                  {safeStr(reseller.notes)}
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-500">
                                No internal note saved for this seller.
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => copyText(safeStr(u.email), "Email copied")}
                                disabled={!safeStr(u.email)}
                                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-extrabold text-slate-700 disabled:opacity-50"
                              >
                                <Mail size={14} />
                                Copy Email
                              </button>

                              <button
                                onClick={() => copyText(safeStr(u.phone), "Phone copied")}
                                disabled={!safeStr(u.phone)}
                                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-extrabold text-slate-700 disabled:opacity-50"
                              >
                                <Phone size={14} />
                                Copy Phone
                              </button>

                              <Link
                                href="/admin/users"
                                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-extrabold text-slate-700"
                              >
                                <Users size={14} />
                                Open User Panel
                              </Link>

                              <button
                                onClick={() => copyText(u._id, "Seller user ID copied")}
                                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-extrabold text-slate-700"
                              >
                                <Copy size={14} />
                                Copy User ID
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-[12px] text-slate-400 font-semibold">
              Ye page future seller notifications, offers, ya outreach ke liye seller records ko alag se manage karne me help karega.
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                disabled={meta.page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-extrabold text-sm text-slate-600 disabled:opacity-50"
              >
                Prev
              </button>

              {pages.map((p, idx) => {
                const prev = pages[idx - 1];
                const showDots = idx > 0 && prev !== undefined && p - prev > 1;

                return (
                  <div key={p} className="flex items-center gap-2">
                    {showDots ? <span className="px-2 text-slate-300 font-extrabold">…</span> : null}
                    <button
                      disabled={loading}
                      onClick={() => setPage(p)}
                      className={`h-10 min-w-[40px] px-3 rounded-xl border text-sm font-extrabold transition ${
                        p === meta.page
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {p}
                    </button>
                  </div>
                );
              })}

              <button
                disabled={meta.page >= meta.totalPages || loading}
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-extrabold text-sm text-slate-600 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-xl font-black text-slate-900">{value}</div>
    </div>
  );
}

function InfoChip({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-bold text-slate-700 min-w-0 max-w-full">
      <span className="text-slate-500 shrink-0">{icon}</span>
      <span className="truncate">{text}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="text-sm font-bold text-slate-800 text-right">{value}</div>
    </div>
  );
}