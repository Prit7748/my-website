// ✅ FILE: app/admin/blogs/categories/CategoryClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FolderKanban,
  PlusCircle,
  RefreshCw,
  Search,
  Trash2,
  Pencil,
  Save,
  X,
  ToggleLeft,
  ToggleRight,
  Hash,
  Info,
} from "lucide-react";

type CategoryRow = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}
function slugify(input: string) {
  return safeStr(input)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function CategoryClient() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<CategoryRow[]>([]);

  const [search, setSearch] = useState("");
  const [only, setOnly] = useState<"" | "active" | "inactive">("");

  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editId, setEditId] = useState("");

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    isActive: true,
    sortOrder: 0,
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams();
      if (safeStr(search)) q.set("search", safeStr(search));
      if (only) q.set("only", only);

      const res = await fetch(`/api/admin/blog-categories?${q.toString()}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load categories");
      setItems(Array.isArray(data?.categories) ? data.categories : []);
    } catch (e: any) {
      setItems([]);
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = safeStr(search).toLowerCase();
    if (!s) return items;
    return items.filter((c) => {
      const n = safeStr(c.name).toLowerCase();
      const sl = safeStr(c.slug).toLowerCase();
      const d = safeStr(c.description).toLowerCase();
      return n.includes(s) || sl.includes(s) || d.includes(s);
    });
  }, [items, search]);

  function resetForm() {
    setForm({ name: "", slug: "", description: "", isActive: true, sortOrder: 0 });
    setEditId("");
    setMode("list");
    setError("");
  }

  function startCreate() {
    resetForm();
    setMode("create");
  }

  async function startEdit(id: string) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/blog-categories/${id}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load category");

      const c = data?.category || {};
      setEditId(id);
      setForm({
        name: safeStr(c.name),
        slug: safeStr(c.slug),
        description: safeStr(c.description),
        isActive: Boolean(c.isActive),
        sortOrder: Number(c.sortOrder || 0),
      });
      setMode("edit");
    } catch (e: any) {
      setError(e?.message || "Failed to load category");
    } finally {
      setBusy(false);
    }
  }

  async function submitCreate() {
    setError("");
    setBusy(true);
    try {
      const payload = {
        name: safeStr(form.name),
        slug: slugify(form.slug || form.name),
        description: safeStr(form.description),
        isActive: Boolean(form.isActive),
        sortOrder: Number(form.sortOrder || 0),
      };
      if (!payload.name) throw new Error("Name is required");

      const res = await fetch("/api/admin/blog-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Create failed");

      resetForm();
      await load();
    } catch (e: any) {
      setError(e?.message || "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitEdit() {
    if (!editId) return;
    setError("");
    setBusy(true);
    try {
      const payload = {
        name: safeStr(form.name),
        slug: slugify(form.slug || form.name),
        description: safeStr(form.description),
        isActive: Boolean(form.isActive),
        sortOrder: Number(form.sortOrder || 0),
      };
      if (!payload.name) throw new Error("Name is required");

      const res = await fetch(`/api/admin/blog-categories/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Update failed");

      resetForm();
      await load();
    } catch (e: any) {
      setError(e?.message || "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: CategoryRow) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/blog-categories/${row._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Toggle failed");
      await load();
    } catch (e: any) {
      setError(e?.message || "Toggle failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: CategoryRow) {
    const ok = confirm(`Delete category "${row.name}"?`);
    if (!ok) return;

    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/blog-categories/${row._id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      await load();
    } catch (e: any) {
      setError(e?.message || "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-2xl font-extrabold flex items-center gap-2">
                <FolderKanban className="text-slate-700" />
                Blog Categories
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Create / edit / activate categories (admin)
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={load}
                disabled={loading || busy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm disabled:opacity-50"
              >
                <RefreshCw size={18} />
                Refresh
              </button>

              <button
                onClick={startCreate}
                disabled={busy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-bold shadow-sm disabled:opacity-50"
              >
                <PlusCircle size={18} />
                New Category
              </button>

              <Link
                href="/admin/blogs"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <ArrowLeft size={18} />
                Back
              </Link>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* LEFT: LIST */}
            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                  <div className="flex items-center gap-2 w-full md:w-[60%]">
                    <Search className="text-slate-600" size={18} />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search name, slug, description..."
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 bg-white"
                    />
                  </div>

                  <select
                    value={only}
                    onChange={(e) => setOnly(e.target.value as any)}
                    className="rounded-xl border border-gray-300 px-3 py-2 bg-white font-semibold"
                  >
                    <option value="">All</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>

                  <button
                    onClick={load}
                    disabled={loading || busy}
                    className="rounded-xl border border-gray-300 px-3 py-2 bg-white font-semibold hover:bg-gray-50 disabled:opacity-50"
                  >
                    Apply
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-gray-200 overflow-hidden">
                <div className="bg-white px-4 py-3 font-extrabold flex items-center justify-between">
                  <span>Categories</span>
                  <span className="text-xs text-slate-500 font-semibold">{filtered.length} items</span>
                </div>

                {loading ? (
                  <div className="p-4 text-sm text-slate-600 bg-white">Loading...</div>
                ) : filtered.length ? (
                  <div className="divide-y bg-white">
                    {filtered.map((c) => (
                      <div key={c._id} className="p-4 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-extrabold text-slate-900 truncate">{c.name}</div>
                          <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1">
                              <Hash size={12} /> {c.slug}
                            </span>
                            <span
                              className={`inline-flex px-2 py-1 rounded-lg font-semibold ${
                                c.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"
                              }`}
                            >
                              {c.isActive ? "Active" : "Inactive"}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Info size={12} /> Sort: {Number(c.sortOrder || 0)}
                            </span>
                          </div>

                          {safeStr(c.description) ? (
                            <div className="text-xs text-slate-600 mt-2 line-clamp-2">
                              {safeStr(c.description)}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => toggleActive(c)}
                            disabled={busy}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm disabled:opacity-50"
                            title="Toggle active"
                          >
                            {c.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                          </button>

                          <button
                            onClick={() => startEdit(c._id)}
                            disabled={busy}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm disabled:opacity-50"
                            title="Edit"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            onClick={() => remove(c)}
                            disabled={busy}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-red-50 border border-gray-200 transition font-semibold shadow-sm disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-sm text-slate-600 bg-white">No categories found.</div>
                )}
              </div>
            </div>

            {/* RIGHT: FORM */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="font-extrabold text-lg flex items-center justify-between">
                  <span>
                    {mode === "edit" ? "Edit Category" : mode === "create" ? "Create Category" : "Category Form"}
                  </span>
                  {mode !== "list" ? (
                    <button
                      onClick={resetForm}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
                    >
                      <X size={18} />
                      Cancel
                    </button>
                  ) : null}
                </div>

                {mode === "list" ? (
                  <div className="mt-3 text-sm text-slate-600">
                    Click <b>New Category</b> or <b>Edit</b> to start.
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <label className="text-sm font-semibold">
                      Name
                      <input
                        value={form.name}
                        onChange={(e) =>
                          setForm((s) => {
                            const name = e.target.value;
                            const autoSlug = slugify(name);
                            return { ...s, name, slug: s.slug ? s.slug : autoSlug };
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 bg-white"
                        placeholder="e.g. Exam Tips"
                      />
                    </label>

                    <label className="text-sm font-semibold">
                      Slug (URL key)
                      <input
                        value={form.slug}
                        onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 bg-white"
                        placeholder="e.g. exam-tips"
                      />
                      <div className="mt-1 text-xs text-slate-500">
                        Auto: <span className="font-bold">{slugify(form.slug || form.name)}</span>
                      </div>
                    </label>

                    <label className="text-sm font-semibold">
                      Description
                      <textarea
                        value={form.description}
                        onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 bg-white min-h-[90px]"
                        placeholder="Short description (optional)"
                      />
                    </label>

                    <label className="text-sm font-semibold">
                      Sort Order (number)
                      <input
                        type="number"
                        value={form.sortOrder}
                        onChange={(e) => setForm((s) => ({ ...s, sortOrder: Number(e.target.value || 0) }))}
                        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 bg-white"
                        placeholder="0"
                      />
                      <div className="mt-1 text-xs text-slate-500">
                        Lower number = upar show (0,1,2...)
                      </div>
                    </label>

                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-extrabold text-sm">Status</div>
                          <div className="text-xs text-slate-600">Active / Inactive</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setForm((s) => ({ ...s, isActive: !s.isActive }))}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
                        >
                          {form.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                          {form.isActive ? "Active" : "Inactive"}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={mode === "edit" ? submitEdit : submitCreate}
                      disabled={busy}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-bold shadow-sm disabled:opacity-50"
                    >
                      <Save size={18} />
                      {mode === "edit" ? "Save Changes" : "Create Category"}
                    </button>

                    <div className="text-xs text-slate-500">
                      Tip: Category slug unique hona chahiye.
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="font-extrabold text-sm">Next</div>
                <div className="mt-2 text-xs text-slate-600">
                  Ab categories ban gayi. Next step me: <b>Blog model me categoryId add</b> + Blog create/edit form me category dropdown.
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Note: APIs protected by <b>requireAdmin()</b>.
          </div>
        </div>
      </div>
    </main>
  );
}
