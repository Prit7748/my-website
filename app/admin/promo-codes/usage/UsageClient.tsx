"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, BarChart3, RefreshCcw, Search } from "lucide-react";

type UsageItem = {
  _id: string;
  code: string;
  title?: string;
  userEmail?: string;
  orderRef?: string;
  orderStatus?: string;
  discountAmount?: number;
  appliedOnAmount?: number;
  currency?: string;
  redeemedAt?: string;
  paymentGateway?: string;
};

type UsageResponse = {
  ok?: boolean;
  items?: UsageItem[];
  total?: number;
  page?: number;
  totalPages?: number;
  summary?: {
    totalDiscount?: number;
    totalAppliedOnAmount?: number;
    usageCount?: number;
  };
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function money(x: any) {
  const n = Number(x || 0);
  return Number.isFinite(n) ? n.toLocaleString("en-IN") : "0";
}

function fmtDate(input?: string) {
  if (!input) return "—";
  try {
    return new Date(input).toLocaleString("en-IN");
  } catch {
    return input;
  }
}

async function apiFetch(url: string) {
  const res = await fetch(url, {
    credentials: "include",
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || "Request failed");
  }
  return data;
}

export default function UsageClient() {
  const sp = useSearchParams();

  const [items, setItems] = useState<UsageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [orderRef, setOrderRef] = useState("");
  const [summary, setSummary] = useState({
    totalDiscount: 0,
    totalAppliedOnAmount: 0,
    usageCount: 0,
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    setCode(safeStr(sp.get("code")).toUpperCase());
  }, [sp]);

  async function load() {
    setLoading(true);
    setMessage("");

    try {
      const qs = new URLSearchParams();
      if (safeStr(code)) qs.set("code", safeStr(code).toUpperCase());
      if (safeStr(userEmail)) qs.set("userEmail", safeStr(userEmail));
      if (safeStr(orderRef)) qs.set("orderRef", safeStr(orderRef));

      const data: UsageResponse = await apiFetch(
        `/api/admin/promo-codes/usage?${qs.toString()}`
      );

      setItems(Array.isArray(data?.items) ? data.items : []);
      setSummary({
        totalDiscount: Number(data?.summary?.totalDiscount || 0),
        totalAppliedOnAmount: Number(data?.summary?.totalAppliedOnAmount || 0),
        usageCount: Number(data?.summary?.usageCount || 0),
      });
    } catch (e: any) {
      setItems([]);
      setSummary({
        totalDiscount: 0,
        totalAppliedOnAmount: 0,
        usageCount: 0,
      });
      setMessage(e?.message || "Failed to load usage data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-2xl font-extrabold">
                <BarChart3 className="text-slate-700" />
                Promo Code Usage
              </div>
              <div className="mt-1 text-sm text-slate-600">
                See which customer used which code, on which order, and how
                much discount was applied.
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/promo-codes"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-slate-950"
              >
                Back to Promo Codes
              </Link>

              <Link
                href="/admin/site-settings"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 font-semibold shadow-sm transition hover:bg-gray-50"
              >
                <ArrowLeft size={18} />
                Site Settings
              </Link>
            </div>
          </div>

          {message ? (
            <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900">
              {message}
            </div>
          ) : null}

          <div className="mt-6 rounded-3xl border border-gray-200 bg-gray-50 p-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Promo code"
                  className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-9 pr-3 text-sm font-bold uppercase"
                />
              </div>

              <input
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="Customer email"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm"
              />

              <input
                value={orderRef}
                onChange={(e) => setOrderRef(e.target.value)}
                placeholder="Order ref"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm"
              />

              <button
                onClick={() => void load()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-extrabold text-white shadow-sm transition hover:bg-slate-950"
              >
                <RefreshCcw size={18} />
                Refresh
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-xs font-bold uppercase text-slate-500">
                  Usage Count
                </div>
                <div className="mt-2 text-3xl font-extrabold text-slate-900">
                  {summary.usageCount}
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="text-xs font-bold uppercase text-emerald-700">
                  Total Discount
                </div>
                <div className="mt-2 text-3xl font-extrabold text-emerald-900">
                  ₹{money(summary.totalDiscount)}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-xs font-bold uppercase text-slate-500">
                  Applied On Amount
                </div>
                <div className="mt-2 text-3xl font-extrabold text-slate-900">
                  ₹{money(summary.totalAppliedOnAmount)}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-5">
            <div className="text-lg font-extrabold">Usage Records</div>
            <div className="mt-1 text-xs text-slate-600">Latest usages first.</div>

            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm font-semibold text-slate-600">
                  Loading usage data...
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm font-semibold text-slate-600">
                  No usage data found.
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item._id}
                    className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-extrabold text-white">
                            {safeStr(item.code)}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-extrabold text-slate-700">
                            {safeStr(item.orderStatus || "pending").toUpperCase()}
                          </span>
                        </div>

                        <div className="mt-2 font-extrabold text-slate-900">
                          {safeStr(item.title) || "Promo Usage"}
                        </div>

                        <div className="mt-1 text-sm text-slate-600">
                          Customer: <b>{safeStr(item.userEmail) || "—"}</b>
                        </div>

                        <div className="mt-1 text-sm text-slate-600">
                          Order Ref: <b>{safeStr(item.orderRef) || "—"}</b>
                        </div>

                        <div className="mt-1 text-sm text-slate-600">
                          Redeemed At: <b>{fmtDate(item.redeemedAt)}</b>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-bold uppercase text-slate-500">
                          Discount
                        </div>
                        <div className="text-2xl font-extrabold text-emerald-700">
                          ₹{money(item.discountAmount)}
                        </div>
                        <div className="mt-2 text-xs font-bold text-slate-500">
                          Applied On ₹{money(item.appliedOnAmount)}
                        </div>
                        <div className="mt-1 text-xs font-semibold text-slate-500">
                          {safeStr(item.paymentGateway || "—")}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}