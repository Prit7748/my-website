"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FolderKanban,
  PlusCircle,
  Pencil,
  Trash2,
  Save,
  X,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

type Category = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  isActive?: boolean;
  sortOrder?: number;
  createdAt?: string;
};

function safeStr(x: any) {
  return String(x || "").trim();
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

export default function AdminBlogCategoriesPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState("");

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    seoTitle: "",
    seoDescription: "",
    sortOrder: 0,
  });

  const isEditing = !!editId;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/blog-categories?admin=1", {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      setItems(Array.isArray(data?.categories) ? data.categories : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const sorted = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => {
      const ao = Number(a.sortOrder || 0);
      const bo = Number(b.sortOrder || 0);
      if (ao !== bo) return ao - bo;
      const ad = new Date(a.createdAt || 0).getTime();
      const bd = new Date(b.createdAt || 0).getTime();
      return bd - ad;
    });
    return arr;
  }, [items]);

  function resetForm() {
    setForm({
      name: "",
      slug: "",
      description: "",
      seoTitle: "",
      seoDescription: "",
      sortOrder: 0,
    });
    setEditId("");
    setCreating(false);
  }

  function startCreate() {
    resetForm();
    setCreating(true);
  }

  function startEdit(cat: Category) {
    setError("");
    setCreating(false);
    setEditId(cat._id);
    setForm({
      name: safeStr(cat.name),
      slug: safeStr(cat.slug),
      description: safeStr(cat.description),
      seoTitle: safeStr(cat.seoTitle),
      seoDescription: safeStr(cat.seoDescription),
      sortOrder: Number(cat.sortOrder || 0),
    });
  }

  async function submitCreate() {
    setError("");
    const payload = {
      name: safeStr(form.name),
      slug: slugify(form.slug || form.name),
      description: safeStr(form.description),
      seoTitle: safeStr(form.seoTitle),
      seoDescription: safeStr(form.seoDescription),
      sortOrder: Number(form.sortOrder || 0),
    };

    if (!payload.name) {
      setError("Category name required");
      return;
    }

    try {
      const res = await fetch("/api/blog-categories", {
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
    }
  }

  async function submitEdit() {
    setError("");
    if (!editId) return;

    const payload: any = {
      name: safeStr(form.name),
      slug: slugify(form.slug || form.name),
      description: safeStr(form.description),
      seoTitle: safeStr(form.seoTitle),
      seoDescription: safeStr(form.seoDescription),
      sortOrder: Number(form.sortOrder || 0),
    };

    if (!payload.name) {
      setError("Category name required");
      return;
    }

    try {
      const res = await fetch(`/api/blog-categories/${editId}`, {
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
    }
  }

  async function toggleActive(cat: Category) {
    setError("");
    try {
      const res = await fetch(`/api/blog-categories/${cat._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: !cat.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Toggle failed");
      await load();
    } catch (e: any) {
      setError(e?.message || "Toggle failed");
    }
  }

  async function remove(cat: Category) {
    const ok = confirm(`Delete category "${cat.name}"?`);
    if (!ok) return;
    setError("");
    try {
      const res = await fetch(`/api/blog-categories/${cat._id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      await load();
    } catch (e: any) {
      setError(e?.message || "Delete failed");
    }
  }

  return (
    <main className="p-6 bg-white min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FolderKanban className="text-slate-600" />
              Blog Categories
            </h1>
            <p className="text-slate-500">
              Add / edit / enable-disable categories (SEO ready)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/blogs"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
            >
              <ArrowLeft size={18} />
              Back
            </Link>

            <button
              onClick={startCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-bold shadow-sm"
            >
              <PlusCircle size={18} />
              New Category
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Form Section */}
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 shadow-sm">
            <div className="font-extrabold text-lg flex items-center justify-between">
              <span>
                {isEditing
                  ? "Edit Category"
                  : creating
                  ? "Create Category"
                  : "Category Form"}
              </span>
              {creating || isEditing ? (
                <button
                  onClick={resetForm}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
                >
                  <X size={18} />
                  Cancel
                </button>
              ) : null}
            </div>

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
                  placeholder="e.g. Solved Assignments"
                />
              </label>

              <label className="text-sm font-semibold">
                Slug
                <input
                  value={form.slug}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, slug: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 bg-white"
                  placeholder="e.g. solved-assignments"
                />
              </label>

              <label className="text-sm font-semibold">
                Sort Order (smallest first)
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      sortOrder: Number(e.target.value || 0),
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 bg-white"
                />
              </label>

              <label className="text-sm font-semibold">
                Short Description (optional)
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, description: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 bg-white min-h-[90px]"
                  placeholder="Internal description"
                />
              </label>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="font-extrabold">SEO (Recommended)</div>
                <label className="text-sm font-semibold block mt-3">
                  SEO Title
                  <input
                    value={form.seoTitle}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, seoTitle: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 bg-white"
                    placeholder="Title for category page"
                  />
                </label>
                <label className="text-sm font-semibold block mt-3">
                  SEO Description
                  <textarea
                    value={form.seoDescription}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        seoDescription: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 bg-white min-h-[90px]"
                    placeholder="Meta description"
                  />
                </label>
              </div>

              {creating || isEditing ? (
                <button
                  onClick={isEditing ? submitEdit : submitCreate}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-bold shadow-sm"
                >
                  <Save size={18} />
                  {isEditing ? "Save Changes" : "Create Category"}
                </button>
              ) : (
                <div className="text-sm text-slate-600">
                  Click <b>New Category</b> or <b>Edit</b> to start.
                </div>
              )}
            </div>
          </div>

          {/* List Section */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="font-extrabold text-lg flex items-center justify-between">
              <span>All Categories</span>
              <button
                onClick={load}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="mt-4 text-sm text-slate-600">Loading...</div>
            ) : sorted.length ? (
              <div className="mt-4 space-y-3">
                {sorted.map((c) => (
                  <div
                    key={c._id}
                    className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-extrabold truncate">{c.name}</div>
                        <div className="text-xs text-slate-600 mt-1 truncate">
                          /{c.slug} • order: {Number(c.sortOrder || 0)}
                        </div>
                        <div className="text-xs mt-2">
                          <span
                            className={`inline-flex px-2 py-1 rounded-lg font-semibold ${
                              c.isActive
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-200 text-gray-600"
                            }`}
                          >
                            {c.isActive ? "Active" : "Disabled"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleActive(c)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
                          title="Toggle active"
                        >
                          {c.isActive ? (
                            <ToggleRight size={18} />
                          ) : (
                            <ToggleLeft size={18} />
                          )}
                        </button>

                        <button
                          onClick={() => startEdit(c)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
                          title="Edit"
                        >
                          <Pencil size={18} />
                        </button>

                        <button
                          onClick={() => remove(c)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-red-50 border border-gray-200 transition font-semibold shadow-sm"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-600">
                No categories yet.
              </div>
            )}

            <div className="mt-6 text-xs text-slate-500">
              Tip: sortOrder small rakhoge to category top par aayegi.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}