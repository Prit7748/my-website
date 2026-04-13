"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Plus,
  RefreshCcw,
  ArrowLeft,
  Pencil,
  Copy,
  Trash2,
  ExternalLink,
  Search,
  Package2,
  CheckCircle2,
  XCircle,
  Clock3,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  BarChart3,
  X,
  FileText,
} from "lucide-react";

type Product = {
  _id: string;
  title: string;
  sku: string;
  slug: string;
  category: string;
  subjectCode: string;
  session: string;
  session6?: string;
  language: string;
  lang3?: string;
  courseCodes?: string[];
  price: number;
  isActive: boolean;
  availability?: "available" | "on_demand" | "want_to_buy" | string;
  createdAt?: string;
  deletedAt?: string | null;
  thumbnailUrl?: string;
  quickUrl?: string;
  pages?: number;
  pdfKey?: string;
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

type CategoryCount = {
  category: string;
  count: number;
};

type SessionOption = {
  _id: string;
  name: string;
  slug: string;
};

type CourseOption = {
  _id: string;
  code: string;
  title: string;
};

type ProductsApiResponse = {
  ok?: boolean;
  error?: string;
  products?: Product[];
  filters?: {
    trash?: boolean;
    q?: string;
    category?: string;
    availability?: string;
    isActive?: string;
    session?: string;
    courseCode?: string;
    language?: string;
    sortBy?: SortKey;
  };
  filterOptions?: {
    sessions?: SessionOption[];
    courses?: CourseOption[];
    languages?: string[];
  };
  pagination?: {
    page: number;
    limit: number;
    skip: number;
    totalPages: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
  };
  totals?: {
    filtered: number;
    currentPage: number;
    allProducts: number;
    activeProducts: number;
    inactiveProducts: number;
    availableProducts: number;
    availablePdfCount: number;
    onDemandByCategory: CategoryCount[];
    wantToBuyByCategory: CategoryCount[];
    trashCount: number;
  };
};

const CATEGORY_OPTIONS = [
  "Solved Assignments",
  "Question Papers (PYQ)",
  "Handwritten PDFs",
  "Ebooks",
  "projects",
  "Guess Papers",
  "Handwritten Hardcopy (Delivery)",
];

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
  if (v === "available") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (v === "on_demand") return "bg-amber-50 text-amber-700 border-amber-200";
  if (v === "want_to_buy") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

export default function AdminProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [busyId, setBusyId] = useState<string>("");
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sessionFilter, setSessionFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("latest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [reloadKey, setReloadKey] = useState(0);
  const [overviewOpen, setOverviewOpen] = useState(false);

  const [sessionOptions, setSessionOptions] = useState<SessionOption[]>([]);
  const [courseOptions, setCourseOptions] = useState<CourseOption[]>([]);
  const [languageOptions, setLanguageOptions] = useState<string[]>([]);

  const [totalFiltered, setTotalFiltered] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [trashCount, setTrashCount] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    availableProducts: 0,
    availablePdfCount: 0,
    onDemandByCategory: [] as CategoryCount[],
    wantToBuyByCategory: [] as CategoryCount[],
  });

  const requestSeq = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 350);

    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearch,
    categoryFilter,
    availabilityFilter,
    activeFilter,
    sessionFilter,
    courseFilter,
    languageFilter,
    sortBy,
    pageSize,
  ]);

  useEffect(() => {
    const seq = ++requestSeq.current;
    const controller = new AbortController();

    async function load() {
      if (loading) {
        setError("");
      } else {
        setFetching(true);
        setError("");
      }

      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(pageSize));
        params.set("sortBy", sortBy);

        if (debouncedSearch) params.set("q", debouncedSearch);
        if (categoryFilter.trim()) params.set("category", categoryFilter.trim());
        if (availabilityFilter !== "all") params.set("availability", availabilityFilter);
        if (activeFilter === "active") params.set("isActive", "true");
        if (activeFilter === "inactive") params.set("isActive", "false");
        if (sessionFilter.trim()) params.set("session", sessionFilter.trim());
        if (courseFilter.trim()) params.set("courseCode", courseFilter.trim());
        if (languageFilter.trim()) params.set("language", languageFilter.trim());

        const res = await fetch(`/api/admin/products?${params.toString()}`, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });

        const data: ProductsApiResponse = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load products");
        }

        if (seq !== requestSeq.current) return;

        const nextItems = Array.isArray(data?.products) ? data.products : [];
        const nextPagination = data?.pagination;
        const nextTotals = data?.totals;
        const nextFilterOptions = data?.filterOptions;

        const nextTotalPages = Math.max(1, Number(nextPagination?.totalPages || 1));

        if (page > nextTotalPages) {
          setPage(nextTotalPages);
          return;
        }

        setItems(nextItems);
        setTotalFiltered(Number(nextTotals?.filtered || 0));
        setTotalPages(nextTotalPages);
        setTrashCount(Number(nextTotals?.trashCount || 0));
        setStats({
          total: Number(nextTotals?.allProducts || 0),
          active: Number(nextTotals?.activeProducts || 0),
          inactive: Number(nextTotals?.inactiveProducts || 0),
          availableProducts: Number(nextTotals?.availableProducts || 0),
          availablePdfCount: Number(nextTotals?.availablePdfCount || 0),
          onDemandByCategory: Array.isArray(nextTotals?.onDemandByCategory)
            ? nextTotals.onDemandByCategory
            : [],
          wantToBuyByCategory: Array.isArray(nextTotals?.wantToBuyByCategory)
            ? nextTotals.wantToBuyByCategory
            : [],
        });

        setSessionOptions(
          Array.isArray(nextFilterOptions?.sessions) ? nextFilterOptions.sessions : []
        );
        setCourseOptions(
          Array.isArray(nextFilterOptions?.courses) ? nextFilterOptions.courses : []
        );
        setLanguageOptions(
          Array.isArray(nextFilterOptions?.languages) ? nextFilterOptions.languages : []
        );
      } catch (e: any) {
        if (controller.signal.aborted) return;
        if (seq !== requestSeq.current) return;

        setError(e?.message || "Failed to load products");
        setItems([]);
        setTotalFiltered(0);
        setTotalPages(1);
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
          setFetching(false);
        }
      }
    }

    load();

    return () => controller.abort();
  }, [
    page,
    pageSize,
    debouncedSearch,
    categoryFilter,
    availabilityFilter,
    activeFilter,
    sessionFilter,
    courseFilter,
    languageFilter,
    sortBy,
    reloadKey,
    loading,
  ]);

  async function reload() {
    setReloadKey((x) => x + 1);
  }

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setCategoryFilter("");
    setAvailabilityFilter("all");
    setActiveFilter("all");
    setSessionFilter("");
    setCourseFilter("");
    setLanguageFilter("");
    setSortBy("latest");
    setPage(1);
  }

  async function softDelete(id: string) {
    const ok = window.confirm("Move this product to Trash? (You can restore later)");
    if (!ok) return;

    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert((data as any)?.error || "Delete failed");
        return;
      }

      if (items.length === 1 && page > 1) {
        setPage((p) => Math.max(1, p - 1));
      } else {
        await reload();
      }
    } finally {
      setBusyId("");
    }
  }

  async function duplicate(id: string) {
    const ok = window.confirm("Duplicate this product? A new draft copy will be created.");
    if (!ok) return;

    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/products/${id}?action=duplicate`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert((data as any)?.error || "Duplicate failed");
        return;
      }

      await reload();

      if ((data as any)?.product?.sku) {
        window.alert(`Duplicated! New SKU: ${(data as any).product.sku}`);
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
        window.alert((data as any)?.error || "Status update failed");
        return;
      }

      await reload();
    } finally {
      setBusyId("");
    }
  }

  const startItem = useMemo(() => {
    if (!totalFiltered) return 0;
    return (page - 1) * pageSize + 1;
  }, [page, pageSize, totalFiltered]);

  const endItem = useMemo(() => {
    if (!totalFiltered) return 0;
    return Math.min(page * pageSize, totalFiltered);
  }, [page, pageSize, totalFiltered]);

  const visiblePages = useMemo(() => {
    return Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => {
      if (totalPages <= 7) return true;
      if (p === 1 || p === totalPages) return true;
      return Math.abs(p - page) <= 1;
    });
  }, [page, totalPages]);

  const trashBadge = useMemo(() => {
    if (!trashCount) return null;
    return (
      <span className="ml-2 inline-flex items-center justify-center min-w-[22px] h-[22px] px-2 rounded-full bg-rose-100 text-rose-700 text-xs font-extrabold border border-rose-200">
        {trashCount}
      </span>
    );
  }, [trashCount]);

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
                type="button"
                onClick={() => setOverviewOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-bold shadow-sm"
              >
                <BarChart3 size={18} />
                Overview
              </button>

              <button
                onClick={reload}
                disabled={fetching}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm disabled:opacity-60"
              >
                {fetching ? <LoaderCircle size={18} className="animate-spin" /> : <RefreshCcw size={18} />}
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
                href="/admin/products/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold shadow-sm"
              >
                <Plus size={18} />
                Add New
              </Link>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_repeat(7,minmax(0,1fr))] gap-3">
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
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none"
              >
                <option value="">All Categories</option>
                {CATEGORY_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                value={sessionFilter}
                onChange={(e) => setSessionFilter(e.target.value)}
                className="px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none"
              >
                <option value="">All Sessions</option>
                {sessionOptions.map((item) => (
                  <option key={item._id} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>

              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none"
              >
                <option value="">All Courses</option>
                {courseOptions.map((item) => (
                  <option key={item._id} value={item.code}>
                    {item.code}{item.title ? ` — ${item.title}` : ""}
                  </option>
                ))}
              </select>

              <select
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value)}
                className="px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none"
              >
                <option value="">All Medium</option>
                {languageOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

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
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 flex-wrap text-sm">
              <div className="text-slate-600 font-semibold">
                Filtered Results: <b>{totalFiltered}</b>
                {debouncedSearch ? (
                  <>
                    {" "}
                    for <span className="text-slate-900">“{debouncedSearch}”</span>
                  </>
                ) : null}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={String(pageSize)}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none text-sm font-semibold"
                >
                  <option value="25">25 / page</option>
                  <option value="50">50 / page</option>
                  <option value="100">100 / page</option>
                  <option value="200">200 / page</option>
                </select>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
                >
                  <X size={16} />
                  Clear Filters
                </button>

                {fetching ? (
                  <div className="inline-flex items-center gap-2 text-slate-500 font-semibold">
                    <LoaderCircle size={16} className="animate-spin" />
                    Updating results...
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-slate-600 font-semibold">
                Loading products...
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700 font-semibold">
                {error}
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-slate-600 text-center font-semibold">
                No products found.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((p) => {
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
                              <div className="font-extrabold text-[17px] leading-snug break-words">
                                {p.title}
                              </div>

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

                              {Array.isArray(p.courseCodes) && p.courseCodes.length > 0 ? (
                                <div className="mt-1 text-xs text-slate-500 break-words">
                                  Courses: <b>{p.courseCodes.join(", ")}</b>
                                </div>
                              ) : null}

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
                      Showing <b>{startItem}</b> to <b>{endItem}</b> of <b>{totalFiltered}</b> filtered results
                      <span className="text-slate-400"> • </span>
                      Total products: <b>{stats.total}</b>
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

                      {visiblePages.map((p, idx, arr) => {
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
            Admin products page is now using server-side search, sorting, counts, pagination, and dynamic filter options.
          </div>
        </div>
      </div>

      {overviewOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm px-4 py-6 overflow-y-auto">
          <div className="max-w-5xl mx-auto rounded-3xl bg-white border border-gray-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 bg-slate-50 flex items-center justify-between gap-4">
              <div>
                <div className="text-xl font-extrabold flex items-center gap-2">
                  <BarChart3 size={22} />
                  Products Overview
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Available PDFs count is based on live PDF Vault uploads, not product availability.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOverviewOpen(false)}
                className="h-10 w-10 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 flex items-center justify-center shadow-sm"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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

                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-blue-700 uppercase tracking-wide">Available PDFs</div>
                      <div className="mt-2 text-2xl font-extrabold text-blue-700">{stats.availablePdfCount}</div>
                    </div>
                    <FileText size={24} className="text-blue-700" />
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="rounded-2xl border border-amber-200 bg-white overflow-hidden">
                  <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
                    <div className="text-sm font-extrabold text-amber-800">
                      Category-wise On Demand Products
                    </div>
                  </div>

                  <div className="p-4">
                    {stats.onDemandByCategory.length === 0 ? (
                      <div className="text-sm text-slate-500 font-semibold">No On Demand products found.</div>
                    ) : (
                      <div className="space-y-2">
                        {stats.onDemandByCategory.map((row) => (
                          <div
                            key={`on-demand-${row.category}`}
                            className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2"
                          >
                            <div className="text-sm font-bold text-slate-800 break-words">{row.category}</div>
                            <div className="text-sm font-extrabold text-amber-800">{row.count}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-rose-200 bg-white overflow-hidden">
                  <div className="px-4 py-3 bg-rose-50 border-b border-rose-200">
                    <div className="text-sm font-extrabold text-rose-800">
                      Category-wise Want to Buy Products
                    </div>
                  </div>

                  <div className="p-4">
                    {stats.wantToBuyByCategory.length === 0 ? (
                      <div className="text-sm text-slate-500 font-semibold">No Want to Buy products found.</div>
                    ) : (
                      <div className="space-y-2">
                        {stats.wantToBuyByCategory.map((row) => (
                          <div
                            key={`want-to-buy-${row.category}`}
                            className="flex items-center justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2"
                          >
                            <div className="text-sm font-bold text-slate-800 break-words">{row.category}</div>
                            <div className="text-sm font-extrabold text-rose-800">{row.count}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 text-xs text-slate-500">
                Note: Physical hardcopy products are excluded from category-wise On Demand and Want to Buy breakdown.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}