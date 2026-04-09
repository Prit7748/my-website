"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Eye,
  FileText,
  FolderKanban,
  ImagePlus,
  Link2,
  Pencil,
  PlusCircle,
  RefreshCw,
  Save,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Upload,
  X,
} from "lucide-react";

type BlogRow = {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  metaTitle?: string;
  metaDescription?: string;
  coverUrl?: string;
  coverAlt?: string;
  tags?: string[];
  authorName?: string;
  isPublished?: boolean;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  categoryId?: string | null;
};

type CategoryOption = {
  _id: string;
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
};

type FormState = {
  title: string;
  slug: string;
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  coverUrl: string;
  coverAlt: string;
  youtubeUrl: string;
  tagsCsv: string;
  authorName: string;
  isPublished: boolean;
  publishedAt: string;
  contentHtml: string;
  categoryId: string;
};

const INITIAL_FORM: FormState = {
  title: "",
  slug: "",
  excerpt: "",
  metaTitle: "",
  metaDescription: "",
  coverUrl: "",
  coverAlt: "",
  youtubeUrl: "",
  tagsCsv: "",
  authorName: "IGNOU Students Portal",
  isPublished: false,
  publishedAt: "",
  contentHtml: "",
  categoryId: "",
};

function safeStr(value: unknown) {
  return String(value ?? "").trim();
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

function formatDate(value?: string | null) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function joinTags(tags: unknown) {
  const list = Array.isArray(tags) ? tags : [];
  return list.filter(Boolean).join(", ");
}

function countChars(value: string, max: number) {
  return `${safeStr(value).length}/${max}`;
}

export default function AdminManageBlogsPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [items, setItems] = useState<BlogRow[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [only, setOnly] = useState<"" | "published" | "draft">("");

  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editId, setEditId] = useState("");

  const [form, setForm] = useState<FormState>(INITIAL_FORM);

  async function loadCategories() {
    try {
      const res = await fetch("/api/admin/blog-categories?only=active", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      const list: CategoryOption[] = Array.isArray(data?.categories)
        ? data.categories
        : [];
      setCategories(
        list.sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
      );
    } catch {
      setCategories([]);
    }
  }

  async function loadBlogs() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (safeStr(search)) params.set("search", safeStr(search));
      if (only) params.set("only", only);

      const res = await fetch(`/api/admin/blogs?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load blogs");
      }

      setItems(Array.isArray(data?.blogs) ? data.blogs : []);
    } catch (e: any) {
      setItems([]);
      setError(e?.message || "Failed to load blogs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBlogs();
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((category) => {
      map.set(String(category._id), safeStr(category.name));
    });
    return map;
  }, [categories]);

  const filteredItems = useMemo(() => {
    const q = safeStr(search).toLowerCase();
    if (!q) return items;

    return items.filter((item) => {
      const haystack = [
        safeStr(item.title),
        safeStr(item.slug),
        safeStr(item.excerpt),
        safeStr(item.metaTitle),
        safeStr(item.metaDescription),
        Array.isArray(item.tags) ? item.tags.join(" ") : "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [items, search]);

  function resetForm() {
    setForm(INITIAL_FORM);
    setEditId("");
    setMode("list");
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function startCreate() {
    setForm(INITIAL_FORM);
    setEditId("");
    setMode("create");
    setError("");
  }

  async function startEdit(id: string) {
    setBusy(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/blogs/${id}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load blog");
      }

      const blog = data?.blog || {};

      setEditId(id);
      setForm({
        title: safeStr(blog.title),
        slug: safeStr(blog.slug),
        excerpt: safeStr(blog.excerpt),
        metaTitle: safeStr(blog.metaTitle),
        metaDescription: safeStr(blog.metaDescription),
        coverUrl: safeStr(blog.coverUrl),
        coverAlt: safeStr(blog.coverAlt),
        youtubeUrl: safeStr(blog.youtubeUrl),
        tagsCsv: joinTags(blog.tags),
        authorName: safeStr(blog.authorName) || "IGNOU Students Portal",
        isPublished: Boolean(blog.isPublished),
        publishedAt: blog.publishedAt
          ? new Date(blog.publishedAt).toISOString().slice(0, 16)
          : "",
        contentHtml: String(blog.contentHtml || ""),
        categoryId: safeStr(blog.categoryId),
      });
      setMode("edit");
    } catch (e: any) {
      setError(e?.message || "Failed to load blog");
    } finally {
      setBusy(false);
    }
  }

  function buildPayload() {
    return {
      title: safeStr(form.title),
      slug: slugify(form.slug || form.title),
      excerpt: safeStr(form.excerpt),
      metaTitle: safeStr(form.metaTitle),
      metaDescription: safeStr(form.metaDescription),
      coverUrl: safeStr(form.coverUrl),
      coverAlt: safeStr(form.coverAlt),
      youtubeUrl: safeStr(form.youtubeUrl),
      tags: safeStr(form.tagsCsv),
      authorName: safeStr(form.authorName) || "IGNOU Students Portal",
      isPublished: Boolean(form.isPublished),
      publishedAt: form.isPublished
        ? form.publishedAt
          ? new Date(form.publishedAt).toISOString()
          : undefined
        : null,
      contentHtml: String(form.contentHtml || ""),
      categoryId: safeStr(form.categoryId) || null,
    };
  }

  async function submitCreate() {
    setBusy(true);
    setError("");

    try {
      const payload = buildPayload();
      if (!payload.title) {
        throw new Error("Title is required");
      }

      const res = await fetch("/api/admin/blogs", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Create failed");
      }

      resetForm();
      await loadBlogs();
    } catch (e: any) {
      setError(e?.message || "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitEdit() {
    if (!editId) return;

    setBusy(true);
    setError("");

    try {
      const payload = buildPayload();
      if (!payload.title) {
        throw new Error("Title is required");
      }

      const res = await fetch(`/api/admin/blogs/${editId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Update failed");
      }

      resetForm();
      await loadBlogs();
    } catch (e: any) {
      setError(e?.message || "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish(row: BlogRow) {
    setBusy(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/blogs/${row._id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !row.isPublished }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Publish toggle failed");
      }

      await loadBlogs();
    } catch (e: any) {
      setError(e?.message || "Publish toggle failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeBlog(row: BlogRow) {
    const ok = confirm(`Delete blog "${row.title}"?`);
    if (!ok) return;

    setBusy(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/blogs/${row._id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Delete failed");
      }

      await loadBlogs();
    } catch (e: any) {
      setError(e?.message || "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleImageUpload(file: File) {
    setUploadingImage(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", "image");
      formData.append("destination", "blogs");

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Image upload failed");
      }

      const imageUrl = safeStr(data?.url || data?.src);
      if (!imageUrl) {
        throw new Error("Uploaded image URL not returned");
      }

      setForm((prev) => ({
        ...prev,
        coverUrl: imageUrl,
        coverAlt: prev.coverAlt || safeStr(prev.title),
      }));
    } catch (e: any) {
      setError(e?.message || "Image upload failed");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  const previewSlug = slugify(form.slug || form.title);
  const previewUrl = `/blog/${previewSlug}`;

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-2xl font-extrabold">
                <FileText className="text-slate-700" />
                Manage Blogs
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Create, edit, publish, and optimize blog posts safely.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin/blogs/categories"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 font-semibold shadow-sm transition hover:bg-gray-50"
              >
                <FolderKanban size={18} />
                Categories
              </Link>

              <button
                onClick={() => {
                  loadBlogs();
                  loadCategories();
                }}
                disabled={loading || busy || uploadingImage}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 font-semibold shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw size={18} />
                Refresh
              </button>

              <button
                onClick={startCreate}
                disabled={busy || uploadingImage}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 font-bold text-white shadow-sm transition hover:bg-slate-950 disabled:opacity-50"
              >
                <PlusCircle size={18} />
                New Blog
              </button>

              <Link
                href="/admin/blogs"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 font-semibold shadow-sm transition hover:bg-gray-50"
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

          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex w-full items-center gap-2 md:w-[60%]">
                    <Search className="text-slate-600" size={18} />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search title, slug, excerpt, meta..."
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2"
                    />
                  </div>

                  <select
                    value={only}
                    onChange={(e) => setOnly(e.target.value as "" | "published" | "draft")}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 font-semibold"
                  >
                    <option value="">All</option>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>

                  <button
                    onClick={loadBlogs}
                    disabled={loading || busy || uploadingImage}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 font-semibold hover:bg-gray-50 disabled:opacity-50"
                  >
                    Apply
                  </button>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200">
                <div className="flex items-center justify-between bg-white px-4 py-3 font-extrabold">
                  <span>Blogs</span>
                  <span className="text-xs font-semibold text-slate-500">
                    {filteredItems.length} items
                  </span>
                </div>

                {loading ? (
                  <div className="bg-white p-4 text-sm text-slate-600">Loading...</div>
                ) : filteredItems.length ? (
                  <div className="divide-y bg-white">
                    {filteredItems.map((blog) => (
                      <div
                        key={blog._id}
                        className="flex items-start justify-between gap-4 p-4"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-extrabold text-slate-900">
                            {blog.title}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                            <span className="inline-flex items-center gap-1">
                              <Link2 size={12} />
                              /blog/{blog.slug}
                            </span>

                            <span
                              className={`inline-flex rounded-lg px-2 py-1 font-semibold ${
                                blog.isPublished
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-200 text-gray-700"
                              }`}
                            >
                              {blog.isPublished ? "Published" : "Draft"}
                            </span>

                            <span className="inline-flex items-center gap-1">
                              <Calendar size={12} />
                              {blog.isPublished
                                ? formatDate(blog.publishedAt)
                                : formatDate(blog.updatedAt)}
                            </span>

                            {blog.categoryId ? (
                              <span className="inline-flex rounded-lg bg-blue-50 px-2 py-1 font-semibold text-blue-700">
                                {categoryNameById.get(String(blog.categoryId)) || "Category"}
                              </span>
                            ) : null}
                          </div>

                          {safeStr(blog.excerpt) ? (
                            <div className="mt-2 line-clamp-2 text-xs text-slate-600">
                              {safeStr(blog.excerpt)}
                            </div>
                          ) : null}

                          {safeStr(blog.metaTitle) || safeStr(blog.metaDescription) ? (
                            <div className="mt-2 line-clamp-2 text-[11px] text-slate-500">
                              SEO: {safeStr(blog.metaTitle) || blog.title}
                              {safeStr(blog.metaDescription)
                                ? ` • ${safeStr(blog.metaDescription)}`
                                : ""}
                            </div>
                          ) : null}

                          {Array.isArray(blog.tags) && blog.tags.length ? (
                            <div className="mt-2 line-clamp-1 text-[11px] font-semibold text-slate-500">
                              Tags: {blog.tags.join(", ")}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <a
                            href={`/blog/${blog.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 font-semibold shadow-sm transition hover:bg-gray-50"
                            title="Preview"
                          >
                            <Eye size={16} />
                          </a>

                          <button
                            onClick={() => togglePublish(blog)}
                            disabled={busy || uploadingImage}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 font-semibold shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
                            title="Toggle publish"
                          >
                            {blog.isPublished ? (
                              <ToggleRight size={18} />
                            ) : (
                              <ToggleLeft size={18} />
                            )}
                          </button>

                          <button
                            onClick={() => startEdit(blog._id)}
                            disabled={busy || uploadingImage}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 font-semibold shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
                            title="Edit"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            onClick={() => removeBlog(blog)}
                            disabled={busy || uploadingImage}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 font-semibold shadow-sm transition hover:bg-red-50 disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white p-4 text-sm text-slate-600">
                    No blogs found.
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between text-lg font-extrabold">
                  <span>
                    {mode === "edit"
                      ? "Edit Blog"
                      : mode === "create"
                      ? "Create Blog"
                      : "Blog Form"}
                  </span>

                  {mode !== "list" ? (
                    <button
                      onClick={resetForm}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 font-semibold shadow-sm transition hover:bg-gray-50"
                    >
                      <X size={18} />
                      Cancel
                    </button>
                  ) : null}
                </div>

                {mode === "list" ? (
                  <div className="mt-3 text-sm text-slate-600">
                    Click <b>New Blog</b> or <b>Edit</b> to start.
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-1 gap-4">
                    <label className="text-sm font-semibold">
                      Category (optional)
                      <select
                        value={form.categoryId}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, categoryId: e.target.value }))
                        }
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 font-semibold"
                      >
                        <option value="">— None —</option>
                        {categories.map((category) => (
                          <option key={category._id} value={category._id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm font-semibold">
                      Title
                      <input
                        value={form.title}
                        onChange={(e) =>
                          setForm((prev) => {
                            const title = e.target.value;
                            return {
                              ...prev,
                              title,
                              slug: prev.slug ? prev.slug : slugify(title),
                              coverAlt: prev.coverAlt ? prev.coverAlt : title,
                            };
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2"
                      />
                    </label>

                    <label className="text-sm font-semibold">
                      Slug (URL)
                      <input
                        value={form.slug}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, slug: e.target.value }))
                        }
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2"
                      />
                      <div className="mt-1 text-xs text-slate-500">
                        Preview URL:{" "}
                        <span className="font-bold">{previewUrl}</span>
                      </div>
                    </label>

                    <label className="text-sm font-semibold">
                      Excerpt / Short Summary
                      <textarea
                        value={form.excerpt}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, excerpt: e.target.value }))
                        }
                        className="mt-1 min-h-[90px] w-full rounded-xl border border-gray-300 bg-white px-3 py-2"
                      />
                      <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                        <span>
                          On-page summary. Empty chhodoge to content se auto summary ban sakti hai.
                        </span>
                        <span>{countChars(form.excerpt, 220)}</span>
                      </div>
                    </label>

                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                      <div className="text-sm font-extrabold text-slate-900">
                        SEO Fields
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        Meta Title aur Meta Description optional hain. Empty rehne par
                        Title aur Excerpt/content fallback use hoga.
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-4">
                        <label className="text-sm font-semibold">
                          Meta Title (optional)
                          <input
                            value={form.metaTitle}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                metaTitle: e.target.value,
                              }))
                            }
                            className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2"
                          />
                          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                            <span>Recommended concise SEO title.</span>
                            <span>{countChars(form.metaTitle, 70)}</span>
                          </div>
                        </label>

                        <label className="text-sm font-semibold">
                          Meta Description (optional)
                          <textarea
                            value={form.metaDescription}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                metaDescription: e.target.value,
                              }))
                            }
                            className="mt-1 min-h-[90px] w-full rounded-xl border border-gray-300 bg-white px-3 py-2"
                          />
                          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                            <span>Recommended search snippet summary.</span>
                            <span>{countChars(form.metaDescription, 170)}</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-extrabold text-slate-900">
                            Cover Image
                          </div>
                          <div className="text-xs text-slate-600">
                            URL paste karo ya direct image upload karo.
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={busy || uploadingImage}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
                          >
                            {uploadingImage ? <Upload size={16} /> : <ImagePlus size={16} />}
                            {uploadingImage ? "Uploading..." : "Upload Image"}
                          </button>
                        </div>
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/avif"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file);
                        }}
                      />

                      <label className="mt-3 block text-sm font-semibold">
                        Cover Image URL
                        <input
                          value={form.coverUrl}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, coverUrl: e.target.value }))
                          }
                          className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2"
                        />
                      </label>

                      <label className="mt-3 block text-sm font-semibold">
                        Cover Alt Text (optional)
                        <input
                          value={form.coverAlt}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, coverAlt: e.target.value }))
                          }
                          className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2"
                        />
                      </label>

                      {safeStr(form.coverUrl) ? (
                        <div className="mt-3 overflow-hidden rounded-2xl border border-gray-200 bg-white">
                          <img
                            src={form.coverUrl}
                            alt={safeStr(form.coverAlt) || safeStr(form.title) || "Blog cover"}
                            className="h-48 w-full object-cover"
                          />
                        </div>
                      ) : null}
                    </div>

                    <label className="text-sm font-semibold">
                      YouTube URL (optional)
                      <input
                        value={form.youtubeUrl}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, youtubeUrl: e.target.value }))
                        }
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2"
                      />
                    </label>

                    <label className="text-sm font-semibold">
                      Tags (comma separated)
                      <input
                        value={form.tagsCsv}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, tagsCsv: e.target.value }))
                        }
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2"
                      />
                    </label>

                    <label className="text-sm font-semibold">
                      Author Name
                      <input
                        value={form.authorName}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, authorName: e.target.value }))
                        }
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2"
                      />
                    </label>

                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-extrabold">Publish</div>
                          <div className="text-xs text-slate-600">
                            Draft or Published
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              isPublished: !prev.isPublished,
                            }))
                          }
                          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 font-semibold shadow-sm transition hover:bg-gray-50"
                        >
                          {form.isPublished ? (
                            <ToggleRight size={18} />
                          ) : (
                            <ToggleLeft size={18} />
                          )}
                          {form.isPublished ? "Published" : "Draft"}
                        </button>
                      </div>

                      {form.isPublished ? (
                        <label className="mt-3 block text-sm font-semibold">
                          Published Date/Time (optional)
                          <input
                            type="datetime-local"
                            value={form.publishedAt}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                publishedAt: e.target.value,
                              }))
                            }
                            className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2"
                          />
                        </label>
                      ) : null}
                    </div>

                    <label className="text-sm font-semibold">
                      Content HTML
                      <textarea
                        value={form.contentHtml}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, contentHtml: e.target.value }))
                        }
                        className="mt-1 min-h-[240px] w-full rounded-xl border border-gray-300 bg-white px-3 py-2 font-mono text-[12px]"
                      />
                      <div className="mt-1 text-xs text-slate-500">
                        Clean semantic HTML use karo. Headings, paragraphs, lists, tables SEO ke liye useful hote hain.
                      </div>
                    </label>

                    <div className="flex gap-2">
                      <button
                        onClick={mode === "edit" ? submitEdit : submitCreate}
                        disabled={busy || uploadingImage}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 font-bold text-white shadow-sm transition hover:bg-slate-950 disabled:opacity-50"
                      >
                        <Save size={18} />
                        {mode === "edit" ? "Save Changes" : "Create Blog"}
                      </button>

                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 font-bold shadow-sm transition hover:bg-gray-50"
                        title="Preview"
                      >
                        <Eye size={18} />
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-extrabold">Notes</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
                  <li>Title = page heading.</li>
                  <li>Excerpt = short summary / fallback snippet.</li>
                  <li>Meta Title & Meta Description = optional SEO override.</li>
                  <li>Image URL aur direct image upload dono support hain.</li>
                  <li>Content HTML abhi intentionally retained hai for safe compatibility.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Note: APIs are protected by <b>requireAdmin()</b>.
          </div>
        </div>
      </div>
    </main>
  );
}