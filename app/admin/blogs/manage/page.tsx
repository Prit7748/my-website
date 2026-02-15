// ✅ UPDATE FILE: app/admin/blogs/manage/page.tsx
// (Only changes: add categories fetch + dropdown + payload categoryId)
// Aapka file bahut lamba hai, isliye main yaha "COMPLETE REPLACE" de raha hu (safe).
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  PlusCircle,
  Search,
  RefreshCw,
  Trash2,
  Pencil,
  Eye,
  Save,
  X,
  ToggleLeft,
  ToggleRight,
  Calendar,
  Link2,
  FolderKanban,
} from "lucide-react";

type BlogRow = {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  coverUrl?: string;
  tags?: string[];
  authorName?: string;
  isPublished?: boolean;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  categoryId?: string | null; // ✅
};

type CatOpt = { _id: string; name: string; slug: string; isActive: boolean; sortOrder: number };

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
function fmtDate(d?: string | null) {
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", { year: "numeric", month: "short", day: "2-digit" }).format(new Date(d));
  } catch {
    return d;
  }
}
function joinTags(tags: any) {
  const arr = Array.isArray(tags) ? tags : [];
  return arr.filter(Boolean).join(", ");
}

export default function AdminManageBlogsPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<BlogRow[]>([]);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [only, setOnly] = useState<"" | "published" | "draft">("");

  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editId, setEditId] = useState<string>("");

  // ✅ categories list for dropdown
  const [cats, setCats] = useState<CatOpt[]>([]);

  const [form, setForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    coverUrl: "",
    youtubeUrl: "",
    tagsCsv: "",
    authorName: "IGNOU Students Portal",
    isPublished: false,
    publishedAt: "",
    contentHtml: "",
    categoryId: "", // ✅
  });

  async function loadCats() {
    try {
      const res = await fetch("/api/admin/blog-categories?only=active", { credentials: "include" });
      const data = await res.json();
      const list: CatOpt[] = Array.isArray(data?.categories) ? data.categories : [];
      setCats(list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
    } catch {
      setCats([]);
    }
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams();
      if (safeStr(search)) q.set("search", safeStr(search));
      if (only) q.set("only", only);

      const res = await fetch(`/api/admin/blogs?${q.toString()}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load blogs");
      setItems(Array.isArray(data?.blogs) ? data.blogs : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadCats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = safeStr(search).toLowerCase();
    if (!s) return items;
    return items.filter((b) => {
      const t = safeStr(b.title).toLowerCase();
      const sl = safeStr(b.slug).toLowerCase();
      const ex = safeStr(b.excerpt).toLowerCase();
      const tg = Array.isArray(b.tags) ? b.tags.join(" ").toLowerCase() : "";
      return t.includes(s) || sl.includes(s) || ex.includes(s) || tg.includes(s);
    });
  }, [items, search]);

  function resetForm() {
    setForm({
      title: "",
      slug: "",
      excerpt: "",
      coverUrl: "",
      youtubeUrl: "",
      tagsCsv: "",
      authorName: "IGNOU Students Portal",
      isPublished: false,
      publishedAt: "",
      contentHtml: "",
      categoryId: "",
    });
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
      const res = await fetch(`/api/admin/blogs/${id}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load blog");

      const b = data?.blog || {};
      setEditId(id);
      setForm({
        title: safeStr(b.title),
        slug: safeStr(b.slug),
        excerpt: safeStr(b.excerpt),
        coverUrl: safeStr(b.coverUrl),
        youtubeUrl: safeStr(b.youtubeUrl),
        tagsCsv: joinTags(b.tags),
        authorName: safeStr(b.authorName) || "IGNOU Students Portal",
        isPublished: Boolean(b.isPublished),
        publishedAt: b.publishedAt ? new Date(b.publishedAt).toISOString().slice(0, 16) : "",
        contentHtml: String(b.contentHtml || ""),
        categoryId: safeStr(b.categoryId || ""),
      });
      setMode("edit");
    } catch (e: any) {
      setError(e?.message || "Failed to load blog");
    } finally {
      setBusy(false);
    }
  }

  async function submitCreate() {
    setError("");
    setBusy(true);
    try {
      const payload = {
        title: safeStr(form.title),
        slug: slugify(form.slug || form.title),
        excerpt: safeStr(form.excerpt),
        coverUrl: safeStr(form.coverUrl),
        youtubeUrl: safeStr(form.youtubeUrl),
        tags: safeStr(form.tagsCsv),
        authorName: safeStr(form.authorName) || "IGNOU Students Portal",
        isPublished: Boolean(form.isPublished),
        publishedAt: form.isPublished ? (form.publishedAt ? new Date(form.publishedAt).toISOString() : undefined) : null,
        contentHtml: String(form.contentHtml || ""),
        categoryId: safeStr(form.categoryId) || null, // ✅
      };

      if (!payload.title) throw new Error("Title is required");

      const res = await fetch("/api/admin/blogs", {
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
    setError("");
    if (!editId) return;
    setBusy(true);
    try {
      const payload: any = {
        title: safeStr(form.title),
        slug: slugify(form.slug || form.title),
        excerpt: safeStr(form.excerpt),
        coverUrl: safeStr(form.coverUrl),
        youtubeUrl: safeStr(form.youtubeUrl),
        tags: safeStr(form.tagsCsv),
        authorName: safeStr(form.authorName) || "IGNOU Students Portal",
        contentHtml: String(form.contentHtml || ""),
        isPublished: Boolean(form.isPublished),
        categoryId: safeStr(form.categoryId) || null, // ✅
      };

      if (payload.isPublished) payload.publishedAt = form.publishedAt ? new Date(form.publishedAt).toISOString() : undefined;
      else payload.publishedAt = null;

      if (!payload.title) throw new Error("Title is required");

      const res = await fetch(`/api/admin/blogs/${editId}`, {
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

  async function togglePublish(row: BlogRow) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/blogs/${row._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isPublished: !row.isPublished }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Publish toggle failed");
      await load();
    } catch (e: any) {
      setError(e?.message || "Publish toggle failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: BlogRow) {
    const ok = confirm(`Delete blog "${row.title}"?`);
    if (!ok) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/blogs/${row._id}`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      await load();
    } catch (e: any) {
      setError(e?.message || "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  const catNameById = useMemo(() => {
    const map = new Map<string, string>();
    cats.forEach((c) => map.set(String(c._id), c.name));
    return map;
  }, [cats]);

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-2xl font-extrabold flex items-center gap-2">
                <FileText className="text-slate-700" />
                Manage Blogs
              </div>
              <div className="text-sm text-slate-600 mt-1">Create / edit / publish blog posts (admin)</div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/admin/blogs/categories"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <FolderKanban size={18} /> Categories
              </Link>

              <button
                onClick={() => {
                  load();
                  loadCats();
                }}
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
                New Blog
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
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                  <div className="flex items-center gap-2 w-full md:w-[60%]">
                    <Search className="text-slate-600" size={18} />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search title, slug, tags..."
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 bg-white"
                    />
                  </div>

                  <select
                    value={only}
                    onChange={(e) => setOnly(e.target.value as any)}
                    className="rounded-xl border border-gray-300 px-3 py-2 bg-white font-semibold"
                  >
                    <option value="">All</option>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
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
                  <span>Blogs</span>
                  <span className="text-xs text-slate-500 font-semibold">{filtered.length} items</span>
                </div>

                {loading ? (
                  <div className="p-4 text-sm text-slate-600 bg-white">Loading...</div>
                ) : filtered.length ? (
                  <div className="divide-y bg-white">
                    {filtered.map((b) => (
                      <div key={b._id} className="p-4 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-extrabold text-slate-900 truncate">{b.title}</div>
                          <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1">
                              <Link2 size={12} /> /blog/{b.slug}
                            </span>
                            <span
                              className={`inline-flex px-2 py-1 rounded-lg font-semibold ${
                                b.isPublished ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"
                              }`}
                            >
                              {b.isPublished ? "Published" : "Draft"}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Calendar size={12} /> {b.isPublished ? fmtDate(b.publishedAt) : fmtDate(b.updatedAt)}
                            </span>
                            {b.categoryId ? (
                              <span className="inline-flex px-2 py-1 rounded-lg font-semibold bg-blue-50 text-blue-700">
                                {catNameById.get(String(b.categoryId)) || "Category"}
                              </span>
                            ) : null}
                          </div>

                          {safeStr(b.excerpt) ? (
                            <div className="text-xs text-slate-600 mt-2 line-clamp-2">{safeStr(b.excerpt)}</div>
                          ) : null}
                          {Array.isArray(b.tags) && b.tags.length ? (
                            <div className="mt-2 text-[11px] text-slate-500 font-semibold line-clamp-1">
                              Tags: {b.tags.join(", ")}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={`/blog/${b.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
                            title="Preview"
                          >
                            <Eye size={16} />
                          </a>

                          <button
                            onClick={() => togglePublish(b)}
                            disabled={busy}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm disabled:opacity-50"
                            title="Toggle publish"
                          >
                            {b.isPublished ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                          </button>

                          <button
                            onClick={() => startEdit(b._id)}
                            disabled={busy}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm disabled:opacity-50"
                            title="Edit"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            onClick={() => remove(b)}
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
                  <div className="p-4 text-sm text-slate-600 bg-white">No blogs found.</div>
                )}
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="font-extrabold text-lg flex items-center justify-between">
                  <span>{mode === "edit" ? "Edit Blog" : mode === "create" ? "Create Blog" : "Blog Form"}</span>
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
                  <div className="mt-3 text-sm text-slate-600">Click <b>New Blog</b> or <b>Edit</b> to start.</div>
                ) : (
                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <label className="text-sm font-semibold">
                      Category (optional)
                      <select
                        value={form.categoryId}
                        onChange={(e) => setForm((s) => ({ ...s, categoryId: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 bg-white font-semibold"
                      >
                        <option value="">— None —</option>
                        {cats.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm font-semibold">
                      Title
                      <input
                        value={form.title}
                        onChange={(e) =>
                          setForm((s) => {
                            const title = e.target.value;
                            const autoSlug = slugify(title);
                            return { ...s, title, slug: s.slug ? s.slug : autoSlug };
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 bg-white"
                      />
                    </label>

                    <label className="text-sm font-semibold">
                      Slug (URL)
                      <input
                        value={form.slug}
                        onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 bg-white"
                      />
                      <div className="mt-1 text-xs text-slate-500">
                        Preview URL: <span className="font-bold">/blog/{slugify(form.slug || form.title)}</span>
                      </div>
                    </label>

                    <label className="text-sm font-semibold">
                      Excerpt (SEO summary)
                      <textarea
                        value={form.excerpt}
                        onChange={(e) => setForm((s) => ({ ...s, excerpt: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 bg-white min-h-[90px]"
                      />
                    </label>

                    <label className="text-sm font-semibold">
                      Cover Image URL
                      <input
                        value={form.coverUrl}
                        onChange={(e) => setForm((s) => ({ ...s, coverUrl: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 bg-white"
                      />
                    </label>

                    <label className="text-sm font-semibold">
                      YouTube URL (optional)
                      <input
                        value={form.youtubeUrl}
                        onChange={(e) => setForm((s) => ({ ...s, youtubeUrl: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 bg-white"
                      />
                    </label>

                    <label className="text-sm font-semibold">
                      Tags (comma separated)
                      <input
                        value={form.tagsCsv}
                        onChange={(e) => setForm((s) => ({ ...s, tagsCsv: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 bg-white"
                      />
                    </label>

                    <label className="text-sm font-semibold">
                      Author Name
                      <input
                        value={form.authorName}
                        onChange={(e) => setForm((s) => ({ ...s, authorName: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 bg-white"
                      />
                    </label>

                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-extrabold text-sm">Publish</div>
                          <div className="text-xs text-slate-600">Draft or Published</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setForm((s) => ({ ...s, isPublished: !s.isPublished }))}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
                        >
                          {form.isPublished ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                          {form.isPublished ? "Published" : "Draft"}
                        </button>
                      </div>

                      {form.isPublished ? (
                        <label className="text-sm font-semibold block mt-3">
                          Published Date/Time (optional)
                          <input
                            type="datetime-local"
                            value={form.publishedAt}
                            onChange={(e) => setForm((s) => ({ ...s, publishedAt: e.target.value }))}
                            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 bg-white"
                          />
                        </label>
                      ) : null}
                    </div>

                    <label className="text-sm font-semibold">
                      Content HTML
                      <textarea
                        value={form.contentHtml}
                        onChange={(e) => setForm((s) => ({ ...s, contentHtml: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 bg-white min-h-[220px] font-mono text-[12px]"
                      />
                      <div className="mt-1 text-xs text-slate-500">HTML paste karo (markdown nahi).</div>
                    </label>

                    <div className="flex gap-2">
                      <button
                        onClick={mode === "edit" ? submitEdit : submitCreate}
                        disabled={busy}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-bold shadow-sm disabled:opacity-50"
                      >
                        <Save size={18} />
                        {mode === "edit" ? "Save Changes" : "Create Blog"}
                      </button>

                      <a
                        href={`/blog/${slugify(form.slug || form.title)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold shadow-sm"
                        title="Preview"
                      >
                        <Eye size={18} />
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="font-extrabold text-sm">Quick</div>
                <ul className="mt-2 text-xs text-slate-600 space-y-1 list-disc pl-5">
                  <li>Categories manage: /admin/blogs/categories</li>
                  <li>Blog create/edit me category select karo</li>
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
