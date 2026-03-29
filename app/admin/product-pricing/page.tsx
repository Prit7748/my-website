"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCcw,
  IndianRupee,
  Save,
  Search,
  Trash2,
  CheckCircle2,
  Layers3,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type ProductItem = {
  _id: string;
  title: string;
  sku: string;
  category: string;
  subjectCode: string;
  courseCodes?: string[];
  courseTitles?: string[];
  session?: string;
  language?: string;
  price?: number;
  oldPrice?: number;
  isActive?: boolean;
  availability?: string;
  updatedAt?: string;
};

type PricingRuleItem = {
  _id: string;
  key: string;
  ruleType: "course_rule" | "product_override";
  category: string;
  courseCode?: string;
  courseTitle?: string;
  productSku?: string;
  productTitleSnapshot?: string;
  price: number;
  oldPrice?: number;
  isActive?: boolean;
  notes?: string;
  updatedBy?: string;
  updatedAt?: string;
  lastAppliedAt?: string | null;
};

type BootstrapResponse = {
  ok?: boolean;
  error?: string;
  categories?: string[];
  sessionOptions?: string[];
  languageOptions?: string[];
  productOverrides?: PricingRuleItem[];
  products?: ProductItem[];
  pagination?: {
    page: number;
    pageSize: number;
    pageSizes: number[];
    totalProducts: number;
    totalPages: number;
  };
};

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function formatDate(input?: string | null) {
  if (!input) return "-";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-IN");
}

export default function ProductPricingPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState<string[]>([]);
  const [sessionOptions, setSessionOptions] = useState<string[]>([]);
  const [languageOptions, setLanguageOptions] = useState<string[]>([]);
  const [productOverrides, setProductOverrides] = useState<PricingRuleItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);

  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error" | "info">("info");

  const [filters, setFilters] = useState({
    q: "",
    productCategory: "",
    productSession: "",
    productLanguage: "",
    page: 1,
    pageSize: 25,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    pageSizes: [25, 50, 100],
    totalProducts: 0,
    totalPages: 1,
  });

  const [overrideForm, setOverrideForm] = useState({
    price: "",
    oldPrice: "",
    notes: "",
    isActive: true,
    applyToExisting: true,
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  async function loadData(custom?: Partial<typeof filters>) {
    setLoading(true);
    try {
      const finalFilters = { ...filters, ...(custom || {}) };
      const qs = new URLSearchParams();

      if (finalFilters.q.trim()) qs.set("q", finalFilters.q.trim());
      if (finalFilters.productCategory.trim()) qs.set("productCategory", finalFilters.productCategory.trim());
      if (finalFilters.productSession.trim()) qs.set("productSession", finalFilters.productSession.trim());
      if (finalFilters.productLanguage.trim()) qs.set("productLanguage", finalFilters.productLanguage.trim());

      qs.set("page", String(finalFilters.page || 1));
      qs.set("pageSize", String(finalFilters.pageSize || 25));

      const res = await fetch(`/api/admin/product-pricing?${qs.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });

      const data = (await res.json()) as BootstrapResponse;

      if (!res.ok || !data?.ok) {
        setMsg(data?.error || "Failed to load pricing data");
        setMsgType("error");
        return;
      }

      setCategories(Array.isArray(data.categories) ? data.categories : []);
      setSessionOptions(Array.isArray(data.sessionOptions) ? data.sessionOptions : []);
      setLanguageOptions(Array.isArray(data.languageOptions) ? data.languageOptions : []);
      setProductOverrides(Array.isArray(data.productOverrides) ? data.productOverrides : []);
      setProducts(Array.isArray(data.products) ? data.products : []);
      setSelectedIds([]);

      if (data.pagination) {
        setPagination({
          page: Number(data.pagination.page || 1),
          pageSize: Number(data.pagination.pageSize || 25),
          pageSizes: Array.isArray(data.pagination.pageSizes) ? data.pagination.pageSizes : [25, 50, 100],
          totalProducts: Number(data.pagination.totalProducts || 0),
          totalPages: Number(data.pagination.totalPages || 1),
        });
      }
    } catch (e: any) {
      setMsg(e?.message || "Failed to load pricing data");
      setMsgType("error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedProducts = useMemo(() => {
    const set = new Set(selectedIds);
    return products.filter((p) => set.has(p._id));
  }, [products, selectedIds]);

  const allVisibleSelected = useMemo(() => {
    return products.length > 0 && products.every((p) => selectedIds.includes(p._id));
  }, [products, selectedIds]);

  async function saveBatchOverrides() {
    if (!selectedIds.length) {
      alert("Pehle products select karo.");
      return;
    }
    if (safeNum(overrideForm.price, 0) <= 0) {
      alert("Valid override price required hai.");
      return;
    }

    setSaving(true);
    setMsg("");

    try {
      const res = await fetch("/api/admin/product-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "batch_product_override",
          productIds: selectedIds,
          price: Number(overrideForm.price),
          oldPrice: Number(overrideForm.oldPrice || 0),
          notes: overrideForm.notes,
          isActive: overrideForm.isActive,
          applyToExisting: overrideForm.applyToExisting,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg((data as any)?.error || "Failed to save product overrides");
        setMsgType("error");
        return;
      }

      setMsg((data as any)?.message || "Product overrides saved.");
      setMsgType("success");
      await loadData();
    } catch (e: any) {
      setMsg(e?.message || "Failed to save product overrides");
      setMsgType("error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRule(ruleId: string) {
    const ok = confirm("Kya aap is pricing rule ko delete karna chahte ho?");
    if (!ok) return;

    setSaving(true);
    setMsg("");

    try {
      const res = await fetch("/api/admin/product-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "delete_rule",
          ruleId,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg((data as any)?.error || "Failed to delete rule");
        setMsgType("error");
        return;
      }

      setMsg((data as any)?.message || "Rule deleted successfully.");
      setMsgType("success");
      await loadData();
    } catch (e: any) {
      setMsg(e?.message || "Failed to delete rule");
      setMsgType("error");
    } finally {
      setSaving(false);
    }
  }

  function goToPage(nextPage: number) {
    const safePage = Math.min(Math.max(nextPage, 1), pagination.totalPages || 1);
    const nextFilters = { ...filters, page: safePage };
    setFilters(nextFilters);
    loadData(nextFilters);
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-2xl font-extrabold flex items-center gap-2">
                <IndianRupee size={24} />
                Product Pricing
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Yahan sirf product overrides aur filtered product pricing results manage honge.
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href="/admin/product-pricing/course-rules"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition font-semibold shadow-sm"
              >
                Course Price Rules Page
              </Link>

              <button
                onClick={() => loadData()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <RefreshCcw size={18} />
                Refresh
              </button>

              <Link
                href="/admin/products"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <ArrowLeft size={18} />
                Back to Products
              </Link>
            </div>
          </div>

          {msg ? (
            <div
              className={`mt-5 rounded-2xl border p-4 text-sm font-semibold ${
                msgType === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : msgType === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : "border-blue-200 bg-blue-50 text-blue-800"
              }`}
            >
              {msg}
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 leading-6">
            <div className="inline-flex items-start gap-2">
              <ShieldAlert size={18} className="mt-0.5 shrink-0" />
              <div>
                Course-based pricing rules ko alag sub page par shift kar diya gaya hai, taki yeh page short aur manageable rahe.
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-extrabold mb-4">Selected Product Override (Batch Save)</div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 leading-6">
              Yahan se aap selected products par unique pricing override laga sakte ho.
              <br />
              Iska use tab karo jab same category + course ke andar bhi kuch specific products ka price alag rakhna ho.
            </div>

            <div className="mt-4 text-sm font-bold">
              Selected Products: <span className="text-slate-900">{selectedIds.length}</span>
            </div>

            <div className="mt-2 text-xs text-slate-500">
              {selectedProducts.slice(0, 5).map((p) => p.sku).join(", ")}
              {selectedProducts.length > 5 ? " ..." : ""}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Override Price</label>
                <input
                  value={overrideForm.price}
                  onChange={(e) => setOverrideForm((p) => ({ ...p, price: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 outline-none"
                  placeholder="59"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Override Old Price</label>
                <input
                  value={overrideForm.oldPrice}
                  onChange={(e) => setOverrideForm((p) => ({ ...p, oldPrice: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 outline-none"
                  placeholder="99"
                />
              </div>
            </div>

            <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">Note</label>
            <textarea
              value={overrideForm.notes}
              onChange={(e) => setOverrideForm((p) => ({ ...p, notes: e.target.value }))}
              className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 outline-none min-h-[90px]"
              placeholder="Optional internal note for these selected products"
            />

            <div className="flex items-center gap-3 mt-4">
              <input
                type="checkbox"
                checked={overrideForm.isActive}
                onChange={(e) => setOverrideForm((p) => ({ ...p, isActive: e.target.checked }))}
                className="h-4 w-4"
              />
              <div className="font-bold text-sm">Override Active</div>
            </div>

            <div className="flex items-center gap-3 mt-3">
              <input
                type="checkbox"
                checked={overrideForm.applyToExisting}
                onChange={(e) => setOverrideForm((p) => ({ ...p, applyToExisting: e.target.checked }))}
                className="h-4 w-4"
              />
              <div className="font-bold text-sm">Apply price on selected products now</div>
            </div>

            <button
              type="button"
              onClick={saveBatchOverrides}
              disabled={saving || !selectedIds.length}
              className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold disabled:opacity-60"
            >
              <Layers3 size={18} />
              {saving ? "Saving..." : "Save Selected Overrides"}
            </button>
          </div>

          <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <div className="text-sm font-extrabold mb-4">Filter Products</div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_1fr_1fr_1fr_160px_auto] gap-3">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={filters.q}
                  onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
                  placeholder="Search by title, SKU, subject, session..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white outline-none"
                />
              </div>

              <select
                value={filters.productCategory}
                onChange={(e) => setFilters((p) => ({ ...p, productCategory: e.target.value }))}
                className="px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={filters.productSession}
                onChange={(e) => setFilters((p) => ({ ...p, productSession: e.target.value }))}
                className="px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none"
              >
                <option value="">All Sessions</option>
                {sessionOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                value={filters.productLanguage}
                onChange={(e) => setFilters((p) => ({ ...p, productLanguage: e.target.value }))}
                className="px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none"
              >
                <option value="">All Languages</option>
                {languageOptions.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>

              <select
                value={filters.pageSize}
                onChange={(e) => setFilters((p) => ({ ...p, pageSize: Number(e.target.value), page: 1 }))}
                className="px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none"
              >
                {(pagination.pageSizes || [25, 50, 100]).map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  const next = { ...filters, page: 1 };
                  setFilters(next);
                  loadData(next);
                }}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-950 text-white font-bold"
              >
                <Search size={16} />
                Search
              </button>
            </div>

            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  const next = {
                    q: "",
                    productCategory: "",
                    productSession: "",
                    productLanguage: "",
                    page: 1,
                    pageSize: filters.pageSize,
                  };
                  setFilters(next);
                  loadData(next);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 font-bold"
              >
                Clear Filters
              </button>

              <button
                type="button"
                onClick={() => {
                  if (allVisibleSelected) {
                    setSelectedIds([]);
                  } else {
                    setSelectedIds(products.map((p) => p._id));
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 font-bold"
              >
                <CheckCircle2 size={16} />
                {allVisibleSelected ? "Unselect Visible" : "Select Visible"}
              </button>

              <div className="text-sm text-slate-600 font-semibold">
                Total matched products: <b>{pagination.totalProducts}</b>
              </div>
            </div>

            <div className="mt-5 overflow-auto">
              <table className="min-w-full text-sm border border-gray-200 rounded-xl overflow-hidden bg-white">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 border-b">Select</th>
                    <th className="text-left px-3 py-2 border-b">Title</th>
                    <th className="text-left px-3 py-2 border-b">SKU</th>
                    <th className="text-left px-3 py-2 border-b">Category</th>
                    <th className="text-left px-3 py-2 border-b">Session</th>
                    <th className="text-left px-3 py-2 border-b">Language</th>
                    <th className="text-left px-3 py-2 border-b">Course</th>
                    <th className="text-left px-3 py-2 border-b">Current Price</th>
                    <th className="text-left px-3 py-2 border-b">Old Price</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                        Loading products...
                      </td>
                    </tr>
                  ) : products.length ? (
                    products.map((p) => {
                      const checked = selectedIds.includes(p._id);
                      return (
                        <tr key={p._id} className="border-b last:border-b-0 align-top">
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedIds((prev) => Array.from(new Set([...prev, p._id])));
                                } else {
                                  setSelectedIds((prev) => prev.filter((x) => x !== p._id));
                                }
                              }}
                              className="h-4 w-4"
                            />
                          </td>
                          <td className="px-3 py-2 min-w-[260px]">{p.title}</td>
                          <td className="px-3 py-2 font-semibold">{p.sku}</td>
                          <td className="px-3 py-2">{p.category}</td>
                          <td className="px-3 py-2">{p.session || "-"}</td>
                          <td className="px-3 py-2">{p.language || "-"}</td>
                          <td className="px-3 py-2">{Array.isArray(p.courseCodes) ? p.courseCodes.join(", ") : "-"}</td>
                          <td className="px-3 py-2 font-bold">₹{safeNum(p.price, 0)}</td>
                          <td className="px-3 py-2">₹{safeNum(p.oldPrice, 0)}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                        No matching products found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm text-slate-600">
                Page <b>{pagination.page}</b> of <b>{pagination.totalPages}</b>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => goToPage(pagination.page - 1)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 font-bold disabled:opacity-50"
                >
                  <ChevronLeft size={16} />
                  Prev
                </button>

                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => goToPage(pagination.page + 1)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 font-bold disabled:opacity-50"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-extrabold mb-4">Saved Product Overrides</div>

            <div className="overflow-auto">
              <table className="min-w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 border-b">Product</th>
                    <th className="text-left px-3 py-2 border-b">SKU</th>
                    <th className="text-left px-3 py-2 border-b">Price</th>
                    <th className="text-left px-3 py-2 border-b">Old</th>
                    <th className="text-left px-3 py-2 border-b">Updated</th>
                    <th className="text-left px-3 py-2 border-b">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {productOverrides.length ? (
                    productOverrides.map((r) => (
                      <tr key={r._id} className="border-b last:border-b-0">
                        <td className="px-3 py-2 min-w-[220px]">{r.productTitleSnapshot || "-"}</td>
                        <td className="px-3 py-2 font-semibold">{r.productSku || "-"}</td>
                        <td className="px-3 py-2 font-bold">₹{safeNum(r.price, 0)}</td>
                        <td className="px-3 py-2">₹{safeNum(r.oldPrice, 0)}</td>
                        <td className="px-3 py-2 text-xs">
                          {formatDate(r.updatedAt)}
                          <div className="text-slate-400 mt-1">Applied: {formatDate(r.lastAppliedAt)}</div>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => deleteRule(r._id)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-rose-50 border border-gray-200 font-bold"
                          >
                            <Trash2 size={15} />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No product override rules found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 leading-6">
            Ab yeh page short aur practical hai:
            <br />
            <b>Course price rules</b> alag sub page par chali gayi hain.
            <br />
            <b>Product results</b> me paging + Category + Session + Language filters aa gaye hain.
          </div>
        </div>
      </div>
    </main>
  );
}