// ✅ UPDATED (FIXED + IMPROVED): app/blog/BlogClient.tsx
// Fixes your broken ``` code-fences inside TSX + adds dynamic categories (from API) with safe fallback

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import TopBar from "@/components/TopBar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

import {
  Calendar,
  Clock,
  ChevronRight,
  Tag,
  Zap,
  Search,
  X,
  ArrowLeft,
  ArrowRight,
  Filter,
  Hash,
  Sparkles,
  Layers,
} from "lucide-react";

type BlogCard = {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  coverUrl?: string;
  tags?: string[];
  publishedAt?: string | null;
};

type CategoryRow = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function fmtDate(d?: string | null) {
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(new Date(d));
  } catch {
    return d || "";
  }
}

function readingTimeFromText(text?: string) {
  const t = safeStr(text);
  if (!t) return "2 min read";
  const words = t.split(/\s+/).filter(Boolean).length;
  const mins = Math.max(2, Math.ceil(words / 90));
  return `${mins} min read`;
}

function cn(...a: Array<string | false | undefined | null>) {
  return a.filter(Boolean).join(" ");
}

export default function BlogClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL params (keeping your existing behavior)
  const urlTag = safeStr(searchParams.get("tag"));
  const urlSearch = safeStr(searchParams.get("search"));
  const urlSort = (safeStr(searchParams.get("sort")) || "newest") as "newest" | "oldest";
  const urlPage = Math.max(1, Number(searchParams.get("page") || 1));

  const [loading, setLoading] = useState(true);
  const [blogs, setBlogs] = useState<BlogCard[]>([]);
  const [featured, setFeatured] = useState<BlogCard | null>(null);
  const [error, setError] = useState("");

  const [searchInput, setSearchInput] = useState(urlSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch);

  // ✅ Blog categories (dynamic)
  const [catLoading, setCatLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [catError, setCatError] = useState("");

  const pageSize = 9;

  const GlobalStyles = () => (
    <style>{`
      .no-scrollbar::-webkit-scrollbar { display: none; }
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

      .card-hover { transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease; }
      .card-hover:hover { transform: translateY(-4px); box-shadow: 0 18px 36px rgba(15,23,42,.10); border-color: rgba(148,163,184,.55); }

      .soft-ring:focus { outline: none; box-shadow: 0 0 0 4px rgba(59,130,246,.18); }

      .page-bg {
        background:
          radial-gradient(900px 420px at 15% 0%, rgba(99,102,241,.10), transparent 60%),
          radial-gradient(850px 420px at 90% 10%, rgba(16,185,129,.10), transparent 62%),
          linear-gradient(180deg, #f8fafc 0%, #ffffff 40%, #f8fafc 100%);
      }

      .hero-bg {
        background:
          radial-gradient(900px 520px at 18% 0%, rgba(59,130,246,.14), transparent 60%),
          radial-gradient(900px 520px at 85% 10%, rgba(16,185,129,.12), transparent 62%),
          linear-gradient(180deg, #f8fafc 0%, #f1f5f9 55%, #f8fafc 100%);
      }

      .controls-panel {
        background: rgba(255,255,255,.78);
        border: 1px solid rgba(226,232,240,.95);
        box-shadow: 0 18px 40px rgba(15,23,42,.08);
        backdrop-filter: blur(10px);
      }

      .control-surface {
        background: rgba(248,250,252,.92);
        border: 1px solid rgba(226,232,240,.95);
      }

      .nice-select {
        background: rgba(255,255,255,.95);
        border: 1px solid rgba(226,232,240,.95);
      }

      .nice-select option { color: #0f172a; }
    `}</style>
  );

  // ✅ Fallback curated buttons if API not available
  const fallbackCurated = useMemo(
    () => [
      { name: "All Posts", tag: "", icon: Zap },
      { name: "Exam Tips", tag: "exam", icon: Sparkles },
      { name: "IGNOU Updates", tag: "news", icon: Zap },
      { name: "Study Guides", tag: "guide", icon: Layers },
    ],
    []
  );

  // ✅ Build category buttons:
  // - If categories API returns list => show it
  // - else use fallbackCurated
  const categoryButtons = useMemo(() => {
    const activeCats = (categories || []).filter((c) => c && c.slug && (c.isActive ?? true));
    if (!activeCats.length) return fallbackCurated;

    // Always prepend "All Posts"
    return [
      { name: "All Posts", tag: "", icon: Zap },
      ...activeCats
        .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
        .map((c) => ({
          name: safeStr(c.name) || safeStr(c.slug),
          tag: safeStr(c.slug),
          icon: Layers,
        })),
    ];
  }, [categories, fallbackCurated]);

  const setUrl = (next: { tag?: string; search?: string; page?: number; sort?: "newest" | "oldest" }) => {
    const params = new URLSearchParams(searchParams.toString());

    const t = safeStr(next.tag);
    const s = safeStr(next.search);
    const sort = (next.sort || urlSort) as "newest" | "oldest";

    if (t) params.set("tag", t);
    else params.delete("tag");

    if (s) params.set("search", s);
    else params.delete("search");

    if (sort && sort !== "newest") params.set("sort", sort);
    else params.delete("sort");

    if (next.page && next.page > 1) params.set("page", String(next.page));
    else params.delete("page");

    const qs = params.toString();
    router.replace(`/blog${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  // ✅ debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 450);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ✅ sync search into URL
  useEffect(() => {
    if (debouncedSearch === urlSearch) return;
    setUrl({ tag: urlTag, search: debouncedSearch, page: 1, sort: urlSort });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // ✅ Load categories (public)
  // Note: If you do NOT have a public route yet, this will just fail silently and fallback buttons will be used.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setCatLoading(true);
      setCatError("");
      try {
        const res = await fetch(`/api/blog-categories?only=active`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to load categories");
        const list = Array.isArray(data?.categories) ? data.categories : [];
        if (!cancelled) setCategories(list);
      } catch (e: any) {
        if (!cancelled) {
          setCatError(e?.message || "Failed to load categories");
          setCategories([]);
        }
      } finally {
        if (!cancelled) setCatLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ✅ Load blogs (your existing behavior)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const q = new URLSearchParams();
        q.set("limit", "120");
        if (urlTag) q.set("tag", urlTag);

        const res = await fetch(`/api/blogs?${q.toString()}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load blogs");

        const list: BlogCard[] = Array.isArray(data?.blogs) ? data.blogs : [];
        if (cancelled) return;

        const qSearch = safeStr(urlSearch).toLowerCase();
        let filtered = qSearch
          ? list.filter((b) => {
              const t = safeStr(b.title).toLowerCase();
              const e = safeStr(b.excerpt).toLowerCase();
              const tags = Array.isArray(b.tags) ? b.tags.join(" ").toLowerCase() : "";
              return t.includes(qSearch) || e.includes(qSearch) || tags.includes(qSearch);
            })
          : list;

        filtered = [...filtered].sort((a, b) => {
          const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
          const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
          return urlSort === "oldest" ? da - db : db - da;
        });

        const f = filtered[0] || null;
        setFeatured(f);
        setBlogs(filtered);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Failed to load blogs");
        setBlogs([]);
        setFeatured(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [urlTag, urlSearch, urlSort]);

  const allTags = useMemo(() => {
    const map = new Map<string, number>();
    (blogs || []).forEach((b) => {
      (Array.isArray(b.tags) ? b.tags : []).forEach((t) => {
        const key = safeStr(t).toLowerCase();
        if (!key) return;
        map.set(key, (map.get(key) || 0) + 1);
      });
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }))
      .slice(0, 18);
  }, [blogs]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil((blogs?.length || 0) / pageSize)), [blogs?.length]);
  const page = Math.min(urlPage, totalPages);

  const gridItems = useMemo(() => {
    const list = Array.isArray(blogs) ? blogs : [];
    const withoutFeatured = featured ? list.filter((x) => x.slug !== featured.slug) : list;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return withoutFeatured.slice(start, end);
  }, [blogs, featured, page]);

  const canPrev = page > 1;
  const canNext = page < totalPages;

  const clearAll = () => {
    setSearchInput("");
    setUrl({ tag: "", search: "", page: 1, sort: "newest" });
  };

  return (
    <main className="min-h-screen page-bg font-sans text-slate-800">
      <GlobalStyles />
      <TopBar />
      <Navbar />

      {/* ✅ HERO */}
      <section className="hero-bg pt-10 md:pt-12 pb-10 md:pb-14">
        <div className="max-w-[1200px] mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
            {/* Left */}
            <div className="lg:w-[44%]">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-800 font-extrabold text-xs shadow-sm">
                <Sparkles size={14} className="text-blue-700" /> Student-friendly. Practical. Updated.
              </div>

              <h1 className="mt-4 text-3xl md:text-5xl font-extrabold text-slate-900 leading-tight">
                IGNOU Blog: Tips, Updates & Smart Guides
              </h1>

              <p className="mt-3 text-slate-600 font-semibold leading-relaxed">
                Assignments, exams, submissions, formats — everything explained clearly so students can act fast and score better.
              </p>

              {/* Controls */}
              <div className="mt-6 rounded-[26px] controls-panel p-3">
                <div className="flex items-center gap-2 px-4 py-3 rounded-2xl control-surface">
                  <Search size={18} className="text-slate-400" />
                  <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search: assignment cover page, submission, viva, result..."
                    className="w-full bg-transparent outline-none text-sm font-semibold text-slate-800 placeholder:text-slate-400"
                  />
                  {searchInput ? (
                    <button
                      onClick={() => setSearchInput("")}
                      className="text-slate-500 hover:text-slate-800 transition"
                      aria-label="Clear search"
                    >
                      <X size={18} />
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 rounded-2xl control-surface px-4 py-3 flex items-center justify-between gap-3">
                    <div className="text-xs font-extrabold text-slate-700 flex items-center gap-2 shrink-0">
                      <Filter size={14} className="text-slate-500" /> Sort
                    </div>

                    <select
                      value={urlSort}
                      onChange={(e) =>
                        setUrl({ tag: urlTag, search: urlSearch, page: 1, sort: e.target.value as any })
                      }
                      className="soft-ring nice-select rounded-xl px-3 py-2 text-slate-800 font-extrabold text-sm outline-none"
                      aria-label="Sort posts"
                    >
                      <option value="newest">Newest first</option>
                      <option value="oldest">Oldest first</option>
                    </select>
                  </div>

                  <button
                    onClick={clearAll}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-extrabold text-slate-800 hover:bg-slate-50 transition shadow-sm"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>

              {/* ✅ Category buttons (dynamic) */}
              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-extrabold text-slate-700 flex items-center gap-2">
                    <Layers size={14} className="text-slate-500" /> Categories
                  </div>
                  {catLoading ? (
                    <div className="text-[11px] text-slate-500 font-semibold">Loading…</div>
                  ) : catError ? (
                    <div className="text-[11px] text-slate-500 font-semibold">Using fallback</div>
                  ) : null}
                </div>

                <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {categoryButtons.map((cat) => {
                    const Icon = cat.icon;
                    const active = safeStr(urlTag) === safeStr(cat.tag);
                    return (
                      <button
                        key={`${cat.name}-${cat.tag}`}
                        onClick={() => setUrl({ tag: cat.tag, search: urlSearch, page: 1, sort: urlSort })}
                        className={cn(
                          "shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-extrabold border transition shadow-sm",
                          active
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        <Icon size={14} /> {cat.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: Featured */}
            <div className="lg:w-[56%]">
              <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 md:px-7 pt-5 md:pt-7">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-slate-900 font-extrabold flex items-center gap-2">
                      <Zap size={18} className="text-blue-700" /> Featured Article
                    </div>
                    <div className="text-slate-500 text-xs font-semibold">
                      {featured?.publishedAt ? `Updated ${fmtDate(featured.publishedAt)}` : "Latest"}
                    </div>
                  </div>
                </div>

                <div className="p-5 md:p-7 pt-4 md:pt-5">
                  <div className="rounded-3xl overflow-hidden border border-slate-200 bg-slate-50">
                    <div className="relative h-[220px] md:h-[260px] bg-white overflow-hidden">
                      {featured?.coverUrl ? (
                        <img
                          src={featured.coverUrl}
                          alt={featured.title}
                          className="w-full h-full object-cover hover:scale-105 transition duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <Tag size={42} />
                        </div>
                      )}
                      <div className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-full bg-blue-600 text-white text-xs font-extrabold px-3 py-1.5 shadow-lg">
                        <Zap size={14} /> Featured
                      </div>
                    </div>

                    <div className="bg-white px-5 md:px-6 py-5">
                      <div className="flex flex-wrap items-center gap-3 text-slate-600 text-xs font-semibold">
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={14} /> {fmtDate(featured?.publishedAt) || "Updated"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock size={14} /> {readingTimeFromText(featured?.excerpt)}
                        </span>
                        {Array.isArray(featured?.tags) && featured.tags.length ? (
                          <span className="inline-flex items-center gap-1">
                            <Hash size={14} /> {featured.tags.slice(0, 3).join(", ")}
                          </span>
                        ) : null}
                      </div>

                      <h2 className="mt-3 text-slate-900 text-xl md:text-2xl font-extrabold leading-snug line-clamp-2">
                        {featured?.title || "IGNOU Blog — Tips, News & Guides"}
                      </h2>

                      <p className="mt-2 text-slate-600 text-sm font-semibold leading-relaxed line-clamp-2">
                        {featured?.excerpt || "Practical strategies, latest updates, and student-friendly guides."}
                      </p>

                      <div className="mt-4 flex flex-col sm:flex-row gap-3">
                        <Link
                          href={featured?.slug ? `/blog/${featured.slug}` : "/blog"}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 text-white px-5 py-3 font-extrabold hover:bg-slate-950 transition"
                        >
                          Read Full Article <ChevronRight size={18} />
                        </Link>

                        <Link
                          href="/products"
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-slate-900 px-5 py-3 font-extrabold hover:bg-slate-50 transition"
                        >
                          Browse Study Materials <ChevronRight size={18} />
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Popular tags */}
                  {allTags.length ? (
                    <div className="mt-5">
                      <div className="text-slate-700 text-xs font-extrabold mb-2 flex items-center gap-2">
                        <Hash size={14} className="text-slate-500" /> Popular tags
                      </div>
                      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        {allTags.map((t) => {
                          const active = urlTag === t.tag;
                          return (
                            <button
                              key={t.tag}
                              onClick={() => setUrl({ tag: t.tag, search: urlSearch, page: 1, sort: urlSort })}
                              className={cn(
                                "shrink-0 rounded-full px-4 py-2 text-xs font-extrabold border transition shadow-sm",
                                active
                                  ? "bg-emerald-100 text-emerald-900 border-emerald-200"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                              )}
                              title={`${t.count} posts`}
                            >
                              #{t.tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Results bar */}
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white shadow-sm px-5 md:px-7 py-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="font-extrabold text-slate-900">
              Latest Articles{" "}
              <span className="text-slate-500 text-sm font-semibold">
                ({blogs.length} results{urlTag ? ` • tag: ${urlTag}` : ""}{urlSearch ? ` • search: "${urlSearch}"` : ""})
              </span>
            </div>

            <div className="flex items-center gap-2">
              {urlTag || urlSearch || urlSort !== "newest" ? (
                <button
                  onClick={clearAll}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 font-extrabold text-sm hover:bg-slate-50 transition"
                >
                  <X size={16} /> Clear
                </button>
              ) : null}

              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 font-extrabold text-sm hover:bg-slate-50 transition"
              >
                <ArrowLeft size={16} /> Home
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* GRID */}
      <section className="py-12 md:py-14">
        <div className="max-w-[1200px] mx-auto px-4">
          {error ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-800 font-semibold">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
                  <div className="h-48 bg-slate-100 animate-pulse" />
                  <div className="p-6">
                    <div className="h-3 w-2/3 bg-slate-100 animate-pulse rounded" />
                    <div className="mt-3 h-4 w-full bg-slate-100 animate-pulse rounded" />
                    <div className="mt-2 h-4 w-5/6 bg-slate-100 animate-pulse rounded" />
                    <div className="mt-5 h-10 w-32 bg-slate-100 animate-pulse rounded-2xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : blogs.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8">
              <div className="text-2xl font-extrabold text-slate-900">No posts found</div>
              <div className="mt-2 text-slate-600 font-semibold">
                Try changing tag, removing search keywords, or clear filters.
              </div>
              <div className="mt-5">
                <button
                  onClick={clearAll}
                  className="rounded-2xl bg-slate-900 text-white px-6 py-3 font-extrabold hover:bg-slate-950 transition"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                {gridItems.map((post) => (
                  <article
                    key={post.slug}
                    className="bg-white rounded-3xl border border-slate-200 overflow-hidden card-hover flex flex-col h-full group"
                  >
                    <div className="h-48 bg-slate-50 relative overflow-hidden">
                      {post.coverUrl ? (
                        <img
                          src={post.coverUrl}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-slate-300">
                          <Tag size={48} />
                        </div>
                      )}

                      {Array.isArray(post.tags) && post.tags.length ? (
                        <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
                          {post.tags.slice(0, 2).map((t) => (
                            <button
                              key={t}
                              onClick={(e) => {
                                e.preventDefault();
                                setUrl({ tag: safeStr(t), search: urlSearch, page: 1, sort: urlSort });
                              }}
                              className="inline-flex items-center gap-1 rounded-full bg-white/95 text-slate-900 px-3 py-1.5 text-[11px] font-extrabold border border-slate-200 hover:bg-white transition shadow-sm"
                              title={`Filter by ${t}`}
                            >
                              <Hash size={12} /> {t}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="p-6 flex flex-col flex-1">
                      <div className="text-xs text-slate-500 mb-3 flex flex-wrap gap-3 font-semibold">
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={12} /> {fmtDate(post.publishedAt)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} /> {readingTimeFromText(post.excerpt)}
                        </span>
                      </div>

                      <h3 className="text-xl font-extrabold text-slate-900 mb-2 leading-snug line-clamp-2">
                        <Link href={`/blog/${post.slug}`} className="hover:text-blue-700 transition">
                          {post.title}
                        </Link>
                      </h3>

                      <p className="text-sm text-slate-600 font-semibold leading-relaxed mb-5 line-clamp-3 flex-1">
                        {safeStr(post.excerpt) || "Read this guide for clear steps and student-friendly tips."}
                      </p>

                      <div className="flex items-center justify-between gap-3">
                        <Link
                          href={`/blog/${post.slug}`}
                          className="inline-flex items-center gap-2 text-sm font-extrabold text-blue-700 hover:text-blue-800 transition"
                        >
                          Read More <ChevronRight size={16} />
                        </Link>

                        <Link
                          href={`/blog/${post.slug}`}
                          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 font-extrabold text-sm hover:bg-slate-50 transition"
                        >
                          Open
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {/* Pagination */}
              <div className="mt-10 rounded-3xl border border-slate-200 bg-white px-5 md:px-7 py-5 flex flex-col md:flex-row gap-4 md:items-center md:justify-between shadow-sm">
                <div className="font-extrabold text-slate-900">
                  Page <span className="text-blue-700">{page}</span> / {totalPages}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={!canPrev}
                    onClick={() => setUrl({ tag: urlTag, search: urlSearch, page: page - 1, sort: urlSort })}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 bg-white font-extrabold text-sm hover:bg-slate-50 transition disabled:opacity-50"
                  >
                    <ArrowLeft size={16} /> Prev
                  </button>

                  <button
                    disabled={!canNext}
                    onClick={() => setUrl({ tag: urlTag, search: urlSearch, page: page + 1, sort: urlSort })}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 bg-white font-extrabold text-sm hover:bg-slate-50 transition disabled:opacity-50"
                  >
                    Next <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-14">
        <div className="max-w-[1200px] mx-auto px-4">
          <div className="rounded-[32px] overflow-hidden border border-emerald-200 bg-[radial-gradient(900px_500px_at_10%_0%,rgba(16,185,129,.20),transparent),radial-gradient(700px_450px_at_90%_20%,rgba(37,99,235,.14),transparent)]">
            <div className="p-7 md:p-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-4 py-2 text-emerald-900 font-extrabold text-xs">
                  <Sparkles size={14} /> Fast help for students
                </div>
                <div className="mt-3 text-2xl md:text-3xl font-extrabold text-slate-900">
                  Need help with IGNOU Assignments or Submission?
                </div>
                <div className="mt-2 text-slate-600 font-semibold leading-relaxed">
                  Message us on WhatsApp — we’ll guide you quickly (format, cover page, submission steps).
                </div>
              </div>

              <a
                href={`https://wa.me/917496865680?text=${encodeURIComponent(
                  "Hi! I need help related to IGNOU assignments/submission. Please guide me."
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 text-white px-7 py-4 font-extrabold hover:bg-slate-950 transition w-full lg:w-auto"
              >
                Chat on WhatsApp →
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
