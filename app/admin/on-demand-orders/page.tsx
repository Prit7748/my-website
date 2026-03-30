"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCcw,
  Search,
  Package,
  Eye,
  Trash2,
  Loader2,
  Mail,
  Phone,
  Clock3,
  Users,
  Layers3,
} from "lucide-react";

type RowItem = {
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  joinedAt?: string | null;
  totalPurchasedProducts: number;
  totalOnDemandProducts: number;
  latestAt?: string | null;
  distinctOnDemandProducts: number;
};

type ApiResponse = {
  ok: boolean;
  items: RowItem[];
  stats?: {
    totalUsers?: number;
    totalOnDemandProducts?: number;
  };
};

function formatDateTime(x?: string | null) {
  if (!x) return "-";
  try {
    return new Date(x).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(x);
  }
}

export default function AdminOnDemandOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [deletingUserId, setDeletingUserId] = useState("");
  const [items, setItems] = useState<RowItem[]>([]);
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalOnDemandProducts: 0,
  });

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("q", search.trim());

      const res = await fetch(`/api/admin/on-demand-orders?${qs.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data: ApiResponse = await res.json();

      if (!res.ok) {
        alert((data as any)?.error || "Failed to load");
        setItems([]);
        setStats({ totalUsers: 0, totalOnDemandProducts: 0 });
        return;
      }

      setItems(Array.isArray(data?.items) ? data.items : []);
      setStats({
        totalUsers: Number(data?.stats?.totalUsers || 0),
        totalOnDemandProducts: Number(data?.stats?.totalOnDemandProducts || 0),
      });
    } catch {
      alert("Failed to load");
      setItems([]);
      setStats({ totalUsers: 0, totalOnDemandProducts: 0 });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(item: RowItem) {
    const ok = window.confirm(
      `Kya aap "${item.userName || "this user"}" ke sab current on-demand products delete karna chahte hain?\n\nYe action ke baad:\n1) Admin pending list se demand remove ho jayegi\n2) Customer dashboard/orders se bhi ye on-demand products hat jayenge\n3) Agar kisi paid order me sirf yehi on-demand items honge to wo order refunded status me chala jayega`
    );

    if (!ok) return;

    try {
      setDeletingUserId(item.userId);

      const res = await fetch(`/api/admin/on-demand-orders/${item.userId}`, {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data?.error || "Delete failed");
        return;
      }

      alert(
        `Delete successful.\n\nAffected Orders: ${Number(
          data?.summary?.affectedOrders || 0
        )}\nRemoved On-Demand Products: ${Number(
          data?.summary?.removedOnDemandProducts || 0
        )}`
      );

      await load();
    } catch {
      alert("Delete failed");
    } finally {
      setDeletingUserId("");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => items, [items]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="max-w-[1700px] mx-auto px-4 py-4 md:py-5">
        <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-gradient-to-r from-white to-slate-50 px-5 py-5 md:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700 shadow-sm">
                  <Package size={24} />
                </div>

                <div>
                  <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
                    On Demand Orders
                  </h1>
                  <p className="mt-1 text-sm md:text-[15px] font-medium text-slate-600">
                    Paid orders containing active coming-soon / on-demand products
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                    <Users size={14} />
                    Total Users
                  </div>
                  <div className="mt-2 text-2xl font-extrabold text-slate-900">
                    {stats.totalUsers}
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-amber-700">
                    <Layers3 size={14} />
                    On Demand Products
                  </div>
                  <div className="mt-2 text-2xl font-extrabold text-amber-900">
                    {stats.totalOnDemandProducts}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-200 bg-white px-5 py-4 md:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <ArrowLeft size={16} />
                  Back
                </Link>

                <button
                  onClick={load}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <RefreshCcw size={16} />
                  Refresh
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") load();
                    }}
                    placeholder="Search by name, email, phone"
                    className="w-[320px] max-w-[88vw] rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-slate-800 outline-none transition focus:border-amber-500"
                  />
                </div>

                <button
                  onClick={load}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-slate-800"
                >
                  <Search size={15} />
                  Search
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-5">
            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-sm font-semibold text-slate-600">
                Loading on demand orders...
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center">
                <div className="text-xl font-extrabold text-slate-900">
                  No on demand orders found
                </div>
                <div className="mt-2 text-sm font-medium text-slate-600">
                  Abhi koi paid on-demand order pending nahi hai.
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-slate-50">
                      <tr className="text-left">
                        <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-slate-600">
                          Sr.
                        </th>
                        <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-slate-600">
                          Customer
                        </th>
                        <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-slate-600">
                          Mobile
                        </th>
                        <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-slate-600">
                          Purchased
                        </th>
                        <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-slate-600">
                          On Demand
                        </th>
                        <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-slate-600">
                          Latest
                        </th>
                        <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-slate-600">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.map((item, idx) => {
                        const deleting = deletingUserId === item.userId;

                        return (
                          <tr
                            key={item.userId}
                            className="border-t border-slate-200 align-top transition hover:bg-slate-50/70"
                          >
                            <td className="px-4 py-3 text-sm font-bold text-slate-700">
                              {idx + 1}
                            </td>

                            <td className="px-4 py-3 min-w-[280px]">
                              <div className="text-sm font-extrabold text-slate-900">
                                {item.userName || "No Name"}
                              </div>

                              <div className="mt-1 flex items-center gap-2 text-xs font-medium text-slate-500 break-all">
                                <Mail size={13} />
                                {item.userEmail || "-"}
                              </div>
                            </td>

                            <td className="px-4 py-3 min-w-[170px]">
                              <div className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                                <Phone size={14} />
                                {item.userPhone || "-"}
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <span className="inline-flex h-9 min-w-[44px] items-center justify-center rounded-xl bg-blue-600 px-3 text-sm font-extrabold text-white">
                                {item.totalPurchasedProducts}
                              </span>
                            </td>

                            <td className="px-4 py-3 min-w-[180px]">
                              <div className="flex flex-col gap-2">
                                <span className="inline-flex h-9 w-fit min-w-[44px] items-center justify-center rounded-xl bg-amber-500 px-3 text-sm font-extrabold text-white">
                                  {item.totalOnDemandProducts}
                                </span>

                                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                  Distinct: {item.distinctOnDemandProducts}
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3 min-w-[180px]">
                              <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                                <Clock3 size={14} />
                                {formatDateTime(item.latestAt)}
                              </div>
                            </td>

                            <td className="px-4 py-3 min-w-[260px]">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Link
                                  href={`/admin/on-demand-orders/${item.userId}`}
                                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                                >
                                  <Eye size={15} />
                                  View / Upload
                                </Link>

                                <button
                                  type="button"
                                  disabled={deleting}
                                  onClick={() => handleDelete(item)}
                                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3.5 py-2 text-sm font-bold text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {deleting ? (
                                    <Loader2 size={15} className="animate-spin" />
                                  ) : (
                                    <Trash2 size={15} />
                                  )}
                                  {deleting ? "Deleting..." : "Delete Demand"}
                                </button>
                              </div>
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
        </div>
      </div>
    </main>
  );
}