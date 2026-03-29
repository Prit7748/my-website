"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCcw,
  ShoppingCart,
  Search,
  FolderOpen,
  Pencil,
  ExternalLink,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type RowItem = {
  productId: string;
  uniqueProductId: string;
  productName: string;
  productSlug: string;
  category: string;
  totalEnquiries: number;
  uniqueCustomers: number;
  pending: number;
  latestAt?: string | null;
};

type ApiResponse = {
  ok: boolean;
  items: RowItem[];
  stats?: {
    totalProducts?: number;
    totalEnquiries?: number;
  };
};

type SortKey =
  | "enquiries_desc"
  | "latest_desc"
  | "latest_asc"
  | "customers_desc"
  | "name_asc";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

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

function categoryToPublicPath(category: string, slug: string) {
  const c = safeStr(category).toLowerCase();

  if (c === "solved assignments") return `/solved-assignments/${slug}`;
  if (c === "handwritten pdfs") return `/handwritten-pdfs/${slug}`;
  if (c === "handwritten hardcopy (delivery)") return `/handwritten-hardcopy/${slug}`;
  if (c === "question papers (pyq)") return `/question-papers/${slug}`;
  if (c === "guess papers") return `/guess-papers/${slug}`;
  if (c === "ebooks/notes") return `/ebooks/${slug}`;
  if (c === "projects & synopsis") return `/projects/${slug}`;
  if (c === "combo") return `/combo/${slug}`;

  return `/products/${slug}`;
}

function escapeCsv(value: any) {
  const s = String(value ?? "");
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export default function AdminWantToBuyPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RowItem[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<SortKey>("enquiries_desc");
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalEnquiries: 0,
  });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("q", search.trim());
      if (status) qs.set("status", status);

      const res = await fetch(`/api/admin/want-to-buy?${qs.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });

      const data: ApiResponse = await res.json();
      if (!res.ok) {
        alert((data as any)?.error || "Failed to load");
        setItems([]);
        setStats({ totalProducts: 0, totalEnquiries: 0 });
        return;
      }

      setItems(Array.isArray(data?.items) ? data.items : []);
      setStats({
        totalProducts: Number(data?.stats?.totalProducts || 0),
        totalEnquiries: Number(data?.stats?.totalEnquiries || 0),
      });
    } catch {
      alert("Failed to load");
      setItems([]);
      setStats({ totalProducts: 0, totalEnquiries: 0 });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    setPage(1);
  }, [search, status, sort, pageSize]);

  const filteredItems = useMemo(() => {
    const arr = [...items];

    arr.sort((a, b) => {
      if (sort === "enquiries_desc") {
        const byDemand = Number(b.totalEnquiries || 0) - Number(a.totalEnquiries || 0);
        if (byDemand !== 0) return byDemand;
        return new Date(b.latestAt || 0).getTime() - new Date(a.latestAt || 0).getTime();
      }

      if (sort === "latest_desc") {
        return new Date(b.latestAt || 0).getTime() - new Date(a.latestAt || 0).getTime();
      }

      if (sort === "latest_asc") {
        return new Date(a.latestAt || 0).getTime() - new Date(b.latestAt || 0).getTime();
      }

      if (sort === "customers_desc") {
        const byCustomers = Number(b.uniqueCustomers || 0) - Number(a.uniqueCustomers || 0);
        if (byCustomers !== 0) return byCustomers;
        return Number(b.totalEnquiries || 0) - Number(a.totalEnquiries || 0);
      }

      if (sort === "name_asc") {
        return safeStr(a.productName).localeCompare(safeStr(b.productName));
      }

      return 0;
    });

    return arr;
  }, [items, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pagedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, safePage, pageSize]);

  function exportCsv() {
    const headers = [
      "#",
      "Product Name",
      "Unique Product ID",
      "Product Slug",
      "Category",
      "Total Enquiries",
      "Unique Customers",
      "Latest",
      "Public URL",
    ];

    const rows = filteredItems.map((item, idx) => [
      idx + 1,
      item.productName,
      item.uniqueProductId,
      item.productSlug,
      item.category,
      item.totalEnquiries,
      item.uniqueCustomers,
      formatDateTime(item.latestAt),
      `${window.location.origin}${categoryToPublicPath(item.category, item.productSlug)}`,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `want-to-buy-enquiries-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div className="max-w-[1900px] mx-auto px-4 py-3">
        <div className="rounded-[28px] bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-7 border-b border-gray-200 bg-gradient-to-r from-white to-slate-50">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 shadow-sm">
                  <ShoppingCart size={28} />
                </div>
                <div>
                  <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight">
                    Product Want to Buy Enquiries
                  </h1>
                  <p className="mt-2 text-sm md:text-xl text-slate-600">
                    Product-wise demand tracking for unavailable products
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <div className="min-w-[150px] rounded-3xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
                  <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                    Total Products
                  </div>
                  <div className="mt-2 text-4xl font-extrabold text-slate-900">
                    {stats.totalProducts}
                  </div>
                </div>

                <div className="min-w-[180px] rounded-3xl border border-blue-600 bg-blue-600 px-5 py-4 shadow-sm">
                  <div className="text-[11px] font-extrabold uppercase tracking-wide text-blue-100">
                    Total Enquiries
                  </div>
                  <div className="mt-2 text-4xl font-extrabold text-white">
                    {stats.totalEnquiries}
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

                <button
                  onClick={exportCsv}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold shadow-sm"
                >
                  <Download size={18} />
                  Export CSV
                </button>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by product name, slug, SKU"
                    className="w-[340px] max-w-[90vw] pl-11 pr-4 py-3 rounded-2xl border border-gray-200 outline-none focus:border-blue-500 bg-white text-slate-800 font-medium"
                  />
                </div>

                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="px-4 py-3 rounded-2xl border border-gray-200 bg-white outline-none focus:border-blue-500 font-bold"
                >
                  <option value="">All Status</option>
                  <option value="new">Pending</option>
                  <option value="contacted">Contacted</option>
                  <option value="closed">Closed</option>
                </select>

                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="px-4 py-3 rounded-2xl border border-gray-200 bg-white outline-none focus:border-blue-500 font-bold"
                >
                  <option value="enquiries_desc">Sort: Total Enquiries</option>
                  <option value="latest_desc">Sort: Latest Enquiries First</option>
                  <option value="latest_asc">Sort: Oldest Enquiries First</option>
                  <option value="customers_desc">Sort: Unique Customers</option>
                  <option value="name_asc">Sort: Product Name A-Z</option>
                </select>

                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-4 py-3 rounded-2xl border border-gray-200 bg-white outline-none focus:border-blue-500 font-bold"
                >
                  <option value={10}>10 / page</option>
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>

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
                Loading enquiries...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
                <div className="text-2xl font-extrabold text-slate-900">No enquiries found</div>
                <div className="mt-2 text-slate-600 font-semibold">
                  Search/filter change karke dobara check karo.
                </div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-3xl border border-gray-200">
                  <table className="min-w-full">
                    <thead className="bg-slate-50">
                      <tr className="text-left">
                        <th className="px-5 py-4 text-lg font-extrabold text-slate-900">#</th>
                        <th className="px-5 py-4 text-lg font-extrabold text-slate-900">Product Name</th>
                        <th className="px-5 py-4 text-lg font-extrabold text-slate-900">Unique Product ID</th>
                        <th className="px-5 py-4 text-lg font-extrabold text-slate-900">Total Enquiries</th>
                        <th className="px-5 py-4 text-lg font-extrabold text-slate-900">Unique Customers</th>
                        <th className="px-5 py-4 text-lg font-extrabold text-slate-900">Latest</th>
                        <th className="px-5 py-4 text-lg font-extrabold text-slate-900">Actions</th>
                      </tr>
                    </thead>

                    <tbody className="bg-white">
                      {pagedItems.map((item, idx) => {
                        const publicHref = categoryToPublicPath(item.category, item.productSlug);
                        const serial = (safePage - 1) * pageSize + idx + 1;

                        return (
                          <tr key={item.productId} className="border-t border-gray-200 align-top">
                            <td className="px-5 py-5 text-lg font-bold text-slate-800">
                              {serial}
                            </td>

                            <td className="px-5 py-5 min-w-[340px]">
                              <div className="text-[16px] font-extrabold text-blue-700 leading-snug">
                                {item.productName}
                              </div>
                              <div className="mt-2 text-sm text-slate-500 break-all">
                                {item.productSlug}
                              </div>
                            </td>

                            <td className="px-5 py-5 min-w-[220px]">
                              <div className="text-[16px] font-mono font-bold text-rose-600 break-all">
                                {item.uniqueProductId}
                              </div>
                            </td>

                            <td className="px-5 py-5">
                              <span className="inline-flex min-w-[34px] h-[40px] items-center justify-center rounded-2xl bg-blue-600 text-white px-4 text-lg font-extrabold">
                                {item.totalEnquiries}
                              </span>
                            </td>

                            <td className="px-5 py-5 text-lg font-bold text-slate-800">
                              {item.uniqueCustomers}
                            </td>

                            <td className="px-5 py-5 min-w-[190px] text-[15px] font-bold text-slate-700">
                              {formatDateTime(item.latestAt)}
                            </td>

                            <td className="px-5 py-5 min-w-[420px]">
                              <div className="flex items-center gap-3 flex-wrap">
                                <Link
                                  href={`/admin/want-to-buy/${item.productId}`}
                                  className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold shadow-sm"
                                >
                                  <FolderOpen size={17} />
                                  View Enquiries
                                </Link>

                                <Link
                                  href={`/admin/products/new?id=${encodeURIComponent(item.productId)}`}
                                  className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold shadow-sm"
                                >
                                  <Pencil size={17} />
                                  Edit Product
                                </Link>

                                <Link
                                  href={publicHref}
                                  target="_blank"
                                  className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold shadow-sm"
                                >
                                  <ExternalLink size={17} />
                                  Open
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 flex items-center justify-between gap-4 flex-wrap">
                  <div className="text-sm text-slate-600 font-semibold">
                    Showing <span className="font-extrabold">{pagedItems.length}</span> of{" "}
                    <span className="font-extrabold">{filteredItems.length}</span> products
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={safePage <= 1}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={16} />
                      Prev
                    </button>

                    <div className="px-4 py-2 rounded-xl bg-slate-900 text-white font-extrabold text-sm">
                      Page {safePage} / {totalPages}
                    </div>

                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage >= totalPages}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="mt-6 text-sm text-slate-500">
              Next step: product available hote hi auto resolve + email workflow.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}