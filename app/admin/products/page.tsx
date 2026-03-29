"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  RefreshCcw,
  ArrowLeft,
  Pencil,
  Copy,
  Trash2,
  ExternalLink,
  Layers3,
  Search,
  Package2,
  CheckCircle2,
  XCircle,
  Clock3,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type Product = {
  _id: string;
  title: string;
  sku: string;
  slug: string;
  category: string;
  subjectCode: string;
  session: string;
  language: string;
  price: number;
  isActive: boolean;
  availability?: "available" | "on_demand" | "want_to_buy" | string;
  createdAt?: string;
  deletedAt?: string | null;
};

type SortKey =
  | "latest"
  | "oldest"
  | "title_asc"
  | "title_desc"
  | "price_low"
  | "price_high"
  | "sku_asc"
  | "active_first"
  | "availability";

function formatDate(input?: string | null) {
  if (!input) return "-";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-IN");
}

function safeAvailabilityLabel(input?: string) {
  const v = String(input || "").trim().toLowerCase();
  if (v === "available") return "Available";
  if (v === "on_demand") return "On Demand";
  if (v === "want_to_buy") return "Want to Buy";
  return "Unknown";
}

function availabilityBadgeClass(input?: string) {
  const v = String(input || "").trim().toLowerCase();
  if (v === "available") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (v === "on_demand") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  if (v === "want_to_buy") {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }
  return "bg-slate-50 text-slate-700 border-slate-200";
}

export default function AdminProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>("");
  const [trashCount, setTrashCount] = useState<number>(0);

  const [search, setSearch] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("latest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/products?limit=500", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as any)?.error || "Failed to load products");
        return;
      }

      const list = ((data as any)?.products || []) as Product[];
      setItems(list.filter((p) => !p.deletedAt));

      const resTrash = await fetch("/api/admin/products?trash=1&limit=500", {
        credentials: "include",
        cache: "no-store",
      });
      const dataTrash = await resTrash.json().catch(() => ({}));
      if (resTrash.ok) {
        const t = (((dataTrash as any)?.products || []) as Product[]).filter((p) => p.deletedAt);
        setTrashCount(t.length);
      } else {
        setTrashCount(0);
      }
    } finally {
      setLoading(false);
    }
  }

  async function softDelete(id: string) {
    const ok = confirm("Move this product to Trash? (You can restore later)");
    if (!ok) return;

    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as any)?.error || "Delete failed");
        return;
      }
      await load();
    } finally {
      setBusyId("");
    }
  }

  async function duplicate(id: string) {
    const ok = confirm("Duplicate this product? A new draft copy will be created.");
    if (!ok) return;

    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/products/${id}?action=duplicate`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as any)?.error || "Duplicate failed");
        return;
      }
      await load();
      if ((data as any)?.product?.sku) {
        alert(`Duplicated! New SKU: ${(data as any).product.sku}`);
      }
    } finally {
      setBusyId("");
    }
  }

  async function toggleActive(product: Product) {
    setBusyId(product._id);
    try {
      const res = await fetch(`/api/admin/products/${product._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          isActive: !product.isActive,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as any)?.error || "Status update failed");
        return;
      }

      setItems((prev) =>
        prev.map((p) =>
          p._id === product._id ? { ...p, isActive: !product.isActive } : p
        )
      );
    } finally {
      setBusyId("");
    }
  }

  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((x) => x.isActive).length;
    const inactive = total - active;
    const available = items.filter((x) => String(x.availability || "") === "available").length;

    return { total, active, inactive, available };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    let list = [...items];

    if (q) {
      list = list.filter((p) => {
        const hay =
          `${p.title} ${p.sku} ${p.category} ${p.subjectCode} ${p.session} ${p.language} ${p.availability || ""}`.toLowerCase();
        return hay.includes(q);
      });
    }

    if (availabilityFilter !== "all") {
      list = list.filter((p) => String(p.availability || "") === availabilityFilter);
    }

    if (activeFilter === "active") {
      list = list.filter((p) => p.isActive);
    } else if (activeFilter === "inactive") {
      list = list.filter((p) => !p.isActive);
    }

    list.sort((a, b) => {
      if (sortBy === "latest") {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      }
      if (sortBy === "title_asc") {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === "title_desc") {
        return b.title.localeCompare(a.title);
      }
      if (sortBy === "price_low") {
        return Number(a.price || 0) - Number(b.price || 0);
      }
      if (sortBy === "price_high") {
        return Number(b.price || 0) - Number(a.price || 0);
      }
      if (sortBy === "sku_asc") {
        return String(a.sku || "").localeCompare(String(b.sku || ""));
      }
      if (sortBy === "active_first") {
        if (a.isActive === b.isActive) return a.title.localeCompare(b.title);
        return a.isActive ? -1 : 1;
      }
      if (sortBy === "availability") {
        return safeAvailabilityLabel(a.availability).localeCompare(safeAvailabilityLabel(b.availability));
      }
      return 0;
    });

    return list;
  }, [items, search, availabilityFilter, activeFilter, sortBy]);

  const totalPages = useMemo(() => {
    const total = Math.ceil(filteredItems.length / pageSize);
    return total > 0 ? total : 1;
  }, [filteredItems.length, pageSize]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  const startItem = filteredItems.length ? (page - 1) * pageSize + 1 : 0;
  const endItem = Math.min(page * pageSize, filteredItems.length);

  const trashBadge = useMemo(() => {
    if (!trashCount) return null;
    return (
      <span className="ml-2 inline-flex items-center justify-center min-w-[22px] h-[22px] px-2 rounded-full bg-rose-100 text-rose-700 text-xs font-extrabold border border-rose-200">
        {trashCount}
      </span>
    );
  }, [trashCount]);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, availabilityFilter, activeFilter, sortBy, pageSize]);

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-2xl font-extrabold">Products</div>
              <div className="text-sm text-slate-600 mt-1">
                Industrial product management dashboard
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={load}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <RefreshCcw size={18} />
                Refresh
              </button>

              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <ArrowLeft size={18} />
                Back
              </Link>

              <Link
                href="/admin/products/trash"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-rose-50 border border-gray-200 transition font-semibold shadow-sm"
                title="Open Trash (deleted products)"
              >
                <Trash2 size={18} />
                Trash
                {trashBadge}
              </Link>

              <Link
                href="/admin/products/bulk"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition font-bold shadow-sm"
              >
                <Layers3 size={18} />
                Bulk Upload
              </Link>

              <Link
                href="/admin/products/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-bold shadow-sm"
              >
                <Plus size={18} />
                Add New
              </Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Total Products</div>
              <div className="mt-2 text-2xl font-extrabold">{stats.total}</div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Active</div>
              <div className="mt-2 text-2xl font-extrabold text-emerald-700">{stats.active}</div>
            </div>

            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="text-xs font-bold text-rose-700 uppercase tracking-wide">Inactive</div>
              <div className="mt-2 text-2xl font-extrabold text-rose-700">{stats.inactive}</div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs font-bold text-amber-700 uppercase tracking-wide">Available PDFs</div>
              <div className="mt-2 text-2xl font-extrabold text-amber-700">{stats.available}</div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] gap-3">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title, SKU, subject, session, category, language..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white outline-none focus:border-blue-500"
                />
              </div>

              <select
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
                className="px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none"
              >
                <option value="all">All Availability</option>
                <option value="available">Available</option>
                <option value="on_demand">On Demand</option>
                <option value="want_to_buy">Want to Buy</option>
              </select>

              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value)}
                className="px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none"
              >
                <option value="all">All Status</option>
                <option value="active">Only Active</option>
                <option value="inactive">Only Inactive</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none"
              >
                <option value="latest">Latest First</option>
                <option value="oldest">Oldest First</option>
                <option value="title_asc">Title A-Z</option>
                <option value="title_desc">Title Z-A</option>
                <option value="price_low">Price Low-High</option>
                <option value="price_high">Price High-Low</option>
                <option value="sku_asc">SKU A-Z</option>
                <option value="active_first">Active First</option>
                <option value="availability">Availability</option>
              </select>

              <select
                value={String(pageSize)}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none"
              >
                <option value="25">25 / page</option>
                <option value="50">50 / page</option>
                <option value="100">100 / page</option>
                <option value="200">200 / page</option>
              </select>
            </div>
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-slate-600 font-semibold">
                Loading products...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-slate-600 text-center font-semibold">
                No products found.
              </div>
            ) : (
              <div className="space-y-3">
                {pagedItems.map((p) => {
                  const isBusy = busyId === p._id;
                  const isActive = Boolean(p.isActive);
                  const availabilityText = safeAvailabilityLabel(p.availability);

                  return (
                    <div
                      key={p._id}
                      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition"
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-3 flex-wrap">
                            <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                              <Package2 size={22} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="font-extrabold text-[17px] leading-snug break-words">{p.title}</div>

                              <div className="mt-2 flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                                  SKU: {p.sku}
                                </span>

                                <span
                                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${availabilityBadgeClass(
                                    p.availability
                                  )}`}
                                >
                                  {availabilityText}
                                </span>

                                <span
                                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${
                                    isActive
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : "bg-rose-50 text-rose-700 border-rose-200"
                                  }`}
                                >
                                  {isActive ? (
                                    <>
                                      <CheckCircle2 size={14} className="mr-1" />
                                      Active
                                    </>
                                  ) : (
                                    <>
                                      <XCircle size={14} className="mr-1" />
                                      Inactive
                                    </>
                                  )}
                                </span>
                              </div>

                              <div className="mt-3 text-sm text-slate-700 break-words">
                                <b>Subject:</b> {p.subjectCode} &nbsp; | &nbsp; <b>Session:</b> {p.session}
                                &nbsp; | &nbsp; <b>Language:</b> {p.language}
                              </div>

                              <div className="mt-1 text-sm text-slate-600 break-words">
                                <b>Category:</b> {p.category} &nbsp; | &nbsp; <b>Price:</b> ₹{Number(p.price || 0)}
                              </div>

                              <div className="mt-1 text-xs text-slate-500">
                                Created: {formatDate(p.createdAt)}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="w-full xl:w-auto flex flex-col items-stretch xl:items-end gap-3">
                          <div
                            className={`rounded-2xl border px-4 py-3 min-w-[220px] ${
                              isActive
                                ? "border-emerald-200 bg-emerald-50"
                                : "border-rose-200 bg-rose-50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-extrabold text-slate-800">Live Status</div>

                              <button
                                type="button"
                                onClick={() => toggleActive(p)}
                                disabled={isBusy}
                                className={`relative inline-flex h-8 w-16 items-center rounded-full transition disabled:opacity-60 ${
                                  isActive ? "bg-emerald-600" : "bg-rose-500"
                                }`}
                                title={isActive ? "Turn Off" : "Turn On"}
                              >
                                <span
                                  className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
                                    isActive ? "translate-x-9" : "translate-x-1"
                                  }`}
                                />
                              </button>
                            </div>

                            <div className={`mt-2 text-xs font-bold ${isActive ? "text-emerald-700" : "text-rose-700"}`}>
                              {isBusy ? "Updating..." : isActive ? "Currently Active / Visible" : "Currently Inactive"}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            <Link
                              href={`/admin/products/new?id=${encodeURIComponent(p._id)}`}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold"
                              title="Edit"
                            >
                              <Pencil size={16} />
                              Edit
                            </Link>

                            <button
                              onClick={() => duplicate(p._id)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold disabled:opacity-60"
                              title="Duplicate"
                            >
                              <Copy size={16} />
                              {isBusy ? "Working..." : "Duplicate"}
                            </button>

                            <button
                              onClick={() => softDelete(p._id)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-rose-50 border border-gray-200 transition font-bold disabled:opacity-60"
                              title="Move to Trash"
                            >
                              <Trash2 size={16} />
                              Trash
                            </button>

                            <Link
                              href={`/product/${p.slug}`}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold"
                              title="Open public page"
                            >
                              <ExternalLink size={16} />
                              Open
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="text-sm text-slate-600 font-semibold">
                      Showing <b>{startItem}</b> to <b>{endItem}</b> of <b>{filteredItems.length}</b> results
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-gray-50 text-sm font-bold disabled:opacity-50"
                      >
                        <ChevronLeft size={16} />
                        Previous
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => {
                          if (totalPages <= 7) return true;
                          if (p === 1 || p === totalPages) return true;
                          return Math.abs(p - page) <= 1;
                        })
                        .map((p, idx, arr) => {
                          const prev = arr[idx - 1];
                          const showGap = idx > 0 && prev && p - prev > 1;

                          return (
                            <div key={`page-${p}`} className="flex items-center gap-2">
                              {showGap ? <span className="text-slate-400 px-1">...</span> : null}
                              <button
                                type="button"
                                onClick={() => setPage(p)}
                                className={`min-w-[42px] px-3 py-2 rounded-xl text-sm font-bold border ${
                                  p === page
                                    ? "bg-slate-900 text-white border-slate-900"
                                    : "bg-white hover:bg-gray-50 border-slate-200 text-slate-700"
                                }`}
                              >
                                {p}
                              </button>
                            </div>
                          );
                        })}

                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-gray-50 text-sm font-bold disabled:opacity-50"
                      >
                        Next
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 text-xs text-slate-500 flex items-center gap-2">
            <Clock3 size={14} />
            Next recommended upgrade: server-side search, sorting, and pagination for very large product volume.
          </div>
        </div>
      </div>
    </main>
  );
}