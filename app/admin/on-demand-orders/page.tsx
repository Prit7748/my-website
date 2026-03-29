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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => items, [items]);

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div className="max-w-[1800px] mx-auto px-4 py-4">
        <div className="rounded-[28px] bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-7 border-b border-gray-200 bg-gradient-to-r from-white to-slate-50">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 shadow-sm">
                  <Package size={28} />
                </div>
                <div>
                  <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight">
                    On Demand Orders
                  </h1>
                  <p className="mt-2 text-sm md:text-xl text-slate-600">
                    Paid orders containing Coming Soon products
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <div className="min-w-[150px] rounded-3xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
                  <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                    Total Users
                  </div>
                  <div className="mt-2 text-4xl font-extrabold text-slate-900">
                    {stats.totalUsers}
                  </div>
                </div>

                <div className="min-w-[200px] rounded-3xl border border-amber-500 bg-amber-500 px-5 py-4 shadow-sm">
                  <div className="text-[11px] font-extrabold uppercase tracking-wide text-amber-100">
                    Total On Demand Products
                  </div>
                  <div className="mt-2 text-4xl font-extrabold text-white">
                    {stats.totalOnDemandProducts}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold shadow-sm"
                >
                  <ArrowLeft size={18} />
                  Back
                </Link>

                <button
                  onClick={load}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold shadow-sm"
                >
                  <RefreshCcw size={18} />
                  Refresh
                </button>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, email, phone"
                    className="w-[320px] max-w-[90vw] pl-11 pr-4 py-3 rounded-2xl border border-gray-200 outline-none focus:border-amber-500 bg-white text-slate-800 font-medium"
                  />
                </div>

                <button
                  onClick={load}
                  className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold shadow-sm"
                >
                  Search
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="rounded-3xl border border-gray-200 bg-gray-50 p-8 text-slate-600 font-semibold">
                Loading on demand orders...
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
                <div className="text-2xl font-extrabold text-slate-900">No on demand orders found</div>
                <div className="mt-2 text-slate-600 font-semibold">
                  Abhi koi paid coming soon order pending nahi hai.
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-3xl border border-gray-200">
                <table className="min-w-full">
                  <thead className="bg-slate-50">
                    <tr className="text-left">
                      <th className="px-5 py-4 text-lg font-extrabold text-slate-900">Sr.</th>
                      <th className="px-5 py-4 text-lg font-extrabold text-slate-900">User Name</th>
                      <th className="px-5 py-4 text-lg font-extrabold text-slate-900">User Mobile Number</th>
                      <th className="px-5 py-4 text-lg font-extrabold text-slate-900">Total No. of Products Purchased</th>
                      <th className="px-5 py-4 text-lg font-extrabold text-slate-900">Total No. of On Demand Products</th>
                      <th className="px-5 py-4 text-lg font-extrabold text-slate-900">Latest</th>
                      <th className="px-5 py-4 text-lg font-extrabold text-slate-900">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="bg-white">
                    {rows.map((item, idx) => (
                      <tr key={item.userId} className="border-t border-gray-200 align-top">
                        <td className="px-5 py-5 text-lg font-bold text-slate-800">
                          {idx + 1}
                        </td>

                        <td className="px-5 py-5 min-w-[260px]">
                          <div className="text-[16px] font-extrabold text-slate-900">
                            {item.userName}
                          </div>
                          <div className="mt-1 text-sm text-slate-500 break-all">
                            {item.userEmail}
                          </div>
                        </td>

                        <td className="px-5 py-5 text-[16px] font-bold text-slate-800 min-w-[180px]">
                          {item.userPhone}
                        </td>

                        <td className="px-5 py-5">
                          <span className="inline-flex min-w-[34px] h-[40px] items-center justify-center rounded-2xl bg-blue-600 text-white px-4 text-lg font-extrabold">
                            {item.totalPurchasedProducts}
                          </span>
                        </td>

                        <td className="px-5 py-5">
                          <span className="inline-flex min-w-[34px] h-[40px] items-center justify-center rounded-2xl bg-amber-500 text-white px-4 text-lg font-extrabold">
                            {item.totalOnDemandProducts}
                          </span>
                        </td>

                        <td className="px-5 py-5 min-w-[200px] text-[15px] font-bold text-slate-700">
                          {formatDateTime(item.latestAt)}
                        </td>

                        <td className="px-5 py-5 min-w-[280px]">
                          <div className="flex items-center gap-3 flex-wrap">
                            <Link
                              href={`/admin/on-demand-orders/${item.userId}`}
                              className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold shadow-sm"
                            >
                              <Eye size={17} />
                              View / Upload
                            </Link>

                            <button
                              type="button"
                              className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-red-50 border border-gray-200 transition font-bold shadow-sm"
                              onClick={() => alert("Delete order action next step me add karenge.")}
                            >
                              <Trash2 size={17} />
                              Delete Order
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6 text-sm text-slate-500">
              Next step: detail page se direct upload workflow + same uploaded product ko sab users ke on-demand records se auto remove karna.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}