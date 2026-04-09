"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  ChevronRight,
  Clock,
  Filter,
  Hash,
  Layers,
  Search,
  Sparkles,
  Tag,
  X,
  Zap,
} from "lucide-react";

import TopBar from "@/components/TopBar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

type BlogCard = {
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
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  categoryId?: string | null;
};

type CategoryRow = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
};

type BlogsApiResponse = {
  blogs?: BlogCard[];
  total?: number;
  page?: number;
  totalPages?: number;
  limit?: number;
};

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
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

function readingTimeFromText(text?: string) {
  const raw = safeStr(text);
  if (!raw) return "2 min read";
  const words = raw.split(/\s+/).filter(Boolean).length;
  const mins = Math.max(2, Math.ceil(words / 120));
  return `${mins} min read`;
}

function imageAlt(blog?: BlogCard | null) {
  if (!blog) return "Blog cover image";
  return safeStr(blog.coverAlt) || safeStr(blog.title) || "Blog cover image";
}

export default function BlogClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlTag = safeStr(searchParams.get("tag"));
  const urlCategory = safeStr(searchParams.get("category"));
  const urlSearch = safeStr(searchParams.get("search"));
  const urlSort =
    safeStr(searchParams.get("sort")).toLowerCase() === "oldest"
      ? "oldest"
      : "newest";
  const urlPage = Math.max(1, Number(searchParams.get("page") || 1));

  const [searchInput, setSearchInput] = useState(urlSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [featured, setFeatured] = useState<BlogCard | null>(null);
  const [gridBlogs, setGridBlogs] = useState<BlogCard[]>([]);
  const [totalGridItems, setTotalGridItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [catLoading, setCatLoading] = useState(false);

  const pageSize = 9;

  function setUrl(next: {
    tag?: string;
    category?: string;
    search?: string;
    sort?: "newest" | "oldest";
    page?: number;
  }) {
    const params = new URLSearchParams(searchParams.toString());

    const nextTag = safeStr(next.tag);
    const nextCategory = safeStr(next.category);
    const nextSearch = safeStr(next.search);
    const nextSort = next.sort || urlSort;

    if (nextTag) params.set("tag", nextTag);
    else params.delete("tag");

    if (nextCategory) params.set("category", nextCategory);
    else params.delete("category");

    if (nextSearch) params.set("search", nextSearch);
    else params.delete("search");

    if (nextSort !== "newest") params.set("sort", nextSort);
    else params.delete("sort");

    if (next.page && next.page > 1) params.set("page", String(next.page));
    else params.delete("page");

    const qs = params.toString();
    router.replace(`/blog${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 400);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (debouncedSearch === urlSearch) return;
    setUrl({
      tag: urlTag,
      category: urlCategory,
      search: debouncedSearch,
      sort: urlSort,
      page: 1,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      setCatLoading(true);
      try {
        const res = await fetch("/api/blog-categories?only=active", {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to load categories");

        if (!cancelled) {
          const list = Array.isArray(data?.categories) ? data.categories : [];
          setCategories(
            list
              .filter((item: CategoryRow) => safeStr(item.slug))
              .sort(
                (a: CategoryRow, b: CategoryRow) =>
                  Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
              )
          );
        }
      } catch {
        if (!cancelled) setCategories([]);
      } finally {
        if (!cancelled) setCatLoading(false);
      }
    }

    loadCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadBlogs() {
      setLoading(true);
      setError("");

      try {
        const featuredParams = new URLSearchParams();
        featuredParams.set("limit", "1");
        featuredParams.set("page", "1");
        featuredParams.set("sort", urlSort);

        if (urlTag) featuredParams.set("tag", urlTag);
        if (urlCategory) featuredParams.set("categorySlug", urlCategory);
        if (urlSearch) featuredParams.set("search", urlSearch);

        const featuredRes = await fetch(`/api/blogs?${featuredParams.toString()}`, {
          cache: "no-store",
        });
        const featuredData: BlogsApiResponse = await featuredRes
          .json()
          .catch(() => ({}));

        if (!featuredRes.ok) {
          throw new Error((featuredData as any)?.error || "Failed to load blogs");
        }

        const featuredBlog =
          Array.isArray(featuredData.blogs) && featuredData.blogs.length
            ? featuredData.blogs[0]
            : null;

        const overallTotal = Number(featuredData.total || 0);
        const gridTotal = Math.max(0, overallTotal - (featuredBlog ? 1 : 0));
        const gridTotalPages = Math.max(1, Math.ceil(gridTotal / pageSize));

        const effectivePage = Math.min(urlPage, gridTotalPages);

        const gridParams = new URLSearchParams();
        gridParams.set("limit", String(pageSize));
        gridParams.set("page", String(effectivePage));
        gridParams.set("sort", urlSort);

        if (urlTag) gridParams.set("tag", urlTag);
        if (urlCategory) gridParams.set("categorySlug", urlCategory);
        if (urlSearch) gridParams.set("search", urlSearch);
        if (featuredBlog?.slug) gridParams.set("exclude", featuredBlog.slug);

        const gridRes = await fetch(`/api/blogs?${gridParams.toString()}`, {
          cache: "no-store",
        });
        const gridData: BlogsApiResponse = await gridRes.json().catch(() => ({}));

        if (!gridRes.ok) {
          throw new Error((gridData as any)?.error || "Failed to load blog grid");
        }

        if (cancelled) return;

        setFeatured(featuredBlog);
        setGridBlogs(Array.isArray(gridData.blogs) ? gridData.blogs : []);
        setTotalGridItems(gridTotal);
        setTotalPages(gridTotalPages);

        if (urlPage > gridTotalPages && gridTotalPages >= 1) {
          setUrl({
            tag: urlTag,
            category: urlCategory,
            search: urlSearch,
            sort: urlSort,
            page: gridTotalPages,
          });
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Failed to load blogs");
        setFeatured(null);
        setGridBlogs([]);
        setTotalGridItems(0);
        setTotalPages(1);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadBlogs();

    return () => {
      cancelled = true;
    };
  }, [urlTag, urlCategory, urlSearch, urlSort, urlPage]);

  const visibleCategories = useMemo(() => {
    return [
      { name: "All Posts", slug: "" },
      ...categories
        .filter((item) => item.isActive !== false)
        .map((item) => ({
          name: safeStr(item.name) || safeStr(item.slug),
          slug: safeStr(item.slug),
        })),
    ];
  }, [categories]);

  const activeCategoryLabel = useMemo(() => {
    if (!urlCategory) return "All Posts";
    const found = visibleCategories.find((item) => item.slug === urlCategory);
    return found?.name || urlCategory;
  }, [urlCategory, visibleCategories]);

  const popularTags = useMemo(() => {
    const map = new Map<string, number>();
    const source = [...(featured ? [featured] : []), ...gridBlogs];

    source.forEach((blog) => {
      (Array.isArray(blog.tags) ? blog.tags : []).forEach((tag) => {
        const key = safeStr(tag).toLowerCase();
        if (!key) return;
        map.set(key, (map.get(key) || 0) + 1);
      });
    });

    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([tag, count]) => ({ tag, count }));
  }, [featured, gridBlogs]);

  const canPrev = urlPage > 1;
  const canNext = urlPage < totalPages;
  const hasActiveFilters = Boolean(urlCategory || urlTag || urlSearch || urlSort !== "newest");

  function clearAll() {
    setSearchInput("");
    setUrl({
      tag: "",
      category: "",
      search: "",
      sort: "newest",
      page: 1,
    });
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <TopBar />
      <Navbar />

      <section className="bg-[radial-gradient(900px_420px_at_15%_0%,rgba(99,102,241,.10),transparent_60%),radial-gradient(850px_420px_at_90%_10%,rgba(16,185,129,.10),transparent_62%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_55%,#f8fafc_100%)] pt-10 pb-10 md:pt-12 md:pb-14">
        <div className="mx-auto max-w-[1200px] px-4">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-stretch">
            <div className="lg:col-span-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-800 shadow-sm">
                <Sparkles size={14} className="text-blue-700" />
                Student-friendly. Practical. Updated.
              </div>

              <h1 className="mt-4 text-3xl font-extrabold leading-tight text-slate-900 md:text-5xl">
                IGNOU Blog: Tips, Updates & Smart Guides
              </h1>

              <p className="mt-3 font-semibold leading-relaxed text-slate-600">
                Assignments, exams, submissions, formats, official updates and study strategies —
                sab kuchh clear aur practical tarike se.
              </p>

              <div className="mt-6 rounded-[26px] border border-slate-200 bg-white/80 p-3 shadow-sm backdrop-blur">
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <Search size={18} className="text-slate-400" />
                  <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search: assignment, submission, exam form..."
                    className="w-full bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                  />
                  {searchInput ? (
                    <button
                      onClick={() => setSearchInput("")}
                      className="text-slate-500 transition hover:text-slate-800"
                      aria-label="Clear search"
                    >
                      <X size={18} />
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <div className="flex flex-1 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex shrink-0 items-center gap-2 text-xs font-extrabold text-slate-700">
                      <Filter size={14} className="text-slate-500" />
                      Sort
                    </div>

                    <select
                      value={urlSort}
                      onChange={(e) =>
                        setUrl({
                          tag: urlTag,
                          category: urlCategory,
                          search: urlSearch,
                          sort: e.target.value as "newest" | "oldest",
                          page: 1,
                        })
                      }
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-800 outline-none"
                    >
                      <option value="newest">Newest first</option>
                      <option value="oldest">Oldest first</option>
                    </select>
                  </div>

                  <button
                    onClick={clearAll}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-extrabold text-slate-800 shadow-sm transition hover:bg-slate-50"
                  >
                    Clear Filters
                  </button>
                </div>

                {hasActiveFilters ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-extrabold text-white">
                      Active filters
                    </span>

                    {urlCategory ? (
                      <button
                        onClick={() =>
                          setUrl({
                            tag: urlTag,
                            category: "",
                            search: urlSearch,
                            sort: urlSort,
                            page: 1,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-800 hover:bg-blue-100"
                      >
                        Category: {activeCategoryLabel}
                        <X size={12} />
                      </button>
                    ) : null}

                    {urlTag ? (
                      <button
                        onClick={() =>
                          setUrl({
                            tag: "",
                            category: urlCategory,
                            search: urlSearch,
                            sort: urlSort,
                            page: 1,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100"
                      >
                        Tag: #{urlTag}
                        <X size={12} />
                      </button>
                    ) : null}

                    {urlSearch ? (
                      <button
                        onClick={() =>
                          setUrl({
                            tag: urlTag,
                            category: urlCategory,
                            search: "",
                            sort: urlSort,
                            page: 1,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100"
                      >
                        Search: {urlSearch}
                        <X size={12} />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="px-5 pt-5 md:px-7 md:pt-7">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 font-extrabold text-slate-900">
                      <Zap size={18} className="text-blue-700" />
                      Featured Article
                    </div>
                    <div className="text-xs font-semibold text-slate-500">
                      {featured?.publishedAt
                        ? `Updated ${formatDate(featured.publishedAt)}`
                        : "Latest"}
                    </div>
                  </div>
                </div>

                <div className="p-5 pt-4 md:p-7 md:pt-5">
                  <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                    <div className="relative h-[220px] overflow-hidden bg-white md:h-[260px]">
                      {featured?.coverUrl ? (
                        <img
                          src={featured.coverUrl}
                          alt={imageAlt(featured)}
                          className="h-full w-full object-cover transition duration-500 hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300">
                          <Tag size={42} />
                        </div>
                      )}

                      <div className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-lg">
                        <Zap size={14} />
                        Featured
                      </div>
                    </div>

                    <div className="bg-white px-5 py-5 md:px-6">
                      <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={14} />
                          {formatDate(featured?.publishedAt) || "Updated"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock size={14} />
                          {readingTimeFromText(
                            featured?.metaDescription || featured?.excerpt
                          )}
                        </span>
                        {Array.isArray(featured?.tags) && featured?.tags.length ? (
                          <span className="inline-flex items-center gap-1">
                            <Hash size={14} />
                            {featured.tags.slice(0, 3).join(", ")}
                          </span>
                        ) : null}
                      </div>

                      <h2 className="mt-3 line-clamp-2 text-xl font-extrabold leading-snug text-slate-900 md:text-2xl">
                        {featured?.title || "IGNOU Blog — Tips, News & Guides"}
                      </h2>

                      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-relaxed text-slate-600">
                        {safeStr(featured?.metaDescription) ||
                          safeStr(featured?.excerpt) ||
                          "Practical strategies, latest updates, and student-friendly guides."}
                      </p>

                      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <Link
                          href={featured?.slug ? `/blog/${featured.slug}` : "/blog"}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 font-extrabold text-white transition hover:bg-slate-950"
                        >
                          Read Full Article
                          <ChevronRight size={18} />
                        </Link>

                        <Link
                          href="/products"
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-extrabold text-slate-900 transition hover:bg-slate-50"
                        >
                          Browse Study Materials
                          <ChevronRight size={18} />
                        </Link>
                      </div>
                    </div>
                  </div>

                  {popularTags.length ? (
                    <div className="mt-5">
                      <div className="mb-2 flex items-center gap-2 text-xs font-extrabold text-slate-700">
                        <Hash size={14} className="text-slate-500" />
                        Popular tags
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {popularTags.map((item) => {
                          const active = urlTag === item.tag;
                          return (
                            <button
                              key={item.tag}
                              onClick={() =>
                                setUrl({
                                  tag: item.tag,
                                  category: urlCategory,
                                  search: urlSearch,
                                  sort: urlSort,
                                  page: 1,
                                })
                              }
                              className={cn(
                                "shrink-0 rounded-full border px-4 py-2 text-xs font-extrabold shadow-sm transition",
                                active
                                  ? "border-emerald-200 bg-emerald-100 text-emerald-900"
                                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                              )}
                              title={`${item.count} posts`}
                            >
                              #{item.tag}
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

          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  <Layers size={16} className="text-blue-700" />
                  Browse by Categories
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-500">
                  Category select karke related IGNOU blog posts jaldi filter karo.
                </div>
              </div>

              {catLoading ? (
                <div className="text-[11px] font-semibold text-slate-500">
                  Loading categories…
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-wrap md:overflow-visible">
              {visibleCategories.map((category) => {
                const active = urlCategory === category.slug;
                return (
                  <button
                    key={`${category.name}-${category.slug}`}
                    onClick={() =>
                      setUrl({
                        tag: urlTag,
                        category: category.slug,
                        search: urlSearch,
                        sort: urlSort,
                        page: 1,
                      })
                    }
                    className={cn(
                      "shrink-0 rounded-full border px-4 py-2 text-xs font-extrabold shadow-sm transition md:shrink",
                      active
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                    )}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm md:flex-row md:items-center md:justify-between md:px-7">
            <div className="font-extrabold text-slate-900">
              Latest Articles{" "}
              <span className="text-sm font-semibold text-slate-500">
                ({totalGridItems} results
                {urlCategory ? ` • category: ${activeCategoryLabel}` : ""}
                {urlTag ? ` • tag: ${urlTag}` : ""}
                {urlSearch ? ` • search: "${urlSearch}"` : ""})
              </span>
            </div>

            <div className="flex items-center gap-2">
              {hasActiveFilters ? (
                <button
                  onClick={clearAll}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold transition hover:bg-slate-50"
                >
                  <X size={16} />
                  Clear
                </button>
              ) : null}

              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold transition hover:bg-slate-50"
              >
                <ArrowLeft size={16} />
                Home
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-14">
        <div className="mx-auto max-w-[1200px] px-4">
          {error ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-5 font-semibold text-red-800">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="grid grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white"
                >
                  <div className="h-48 animate-pulse bg-slate-100" />
                  <div className="p-6">
                    <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                    <div className="mt-3 h-4 w-full animate-pulse rounded bg-slate-100" />
                    <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-slate-100" />
                    <div className="mt-5 h-10 w-32 animate-pulse rounded-2xl bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : gridBlogs.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8">
              <div className="text-2xl font-extrabold text-slate-900">
                No posts found
              </div>
              <div className="mt-2 font-semibold text-slate-600">
                Try changing category, tag, or removing search keywords.
              </div>
              <div className="mt-5">
                <button
                  onClick={clearAll}
                  className="rounded-2xl bg-slate-900 px-6 py-3 font-extrabold text-white transition hover:bg-slate-950"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-3">
                {gridBlogs.map((post) => (
                  <article
                    key={post.slug}
                    className="group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white transition hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="relative h-48 overflow-hidden bg-slate-50">
                      {post.coverUrl ? (
                        <img
                          src={post.coverUrl}
                          alt={imageAlt(post)}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-slate-300">
                          <Tag size={48} />
                        </div>
                      )}

                      {Array.isArray(post.tags) && post.tags.length ? (
                        <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
                          {post.tags.slice(0, 2).map((tag) => (
                            <button
                              key={tag}
                              onClick={(e) => {
                                e.preventDefault();
                                setUrl({
                                  tag: safeStr(tag),
                                  category: urlCategory,
                                  search: urlSearch,
                                  sort: urlSort,
                                  page: 1,
                                });
                              }}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-[11px] font-extrabold text-slate-900 shadow-sm transition hover:bg-white"
                              title={`Filter by ${tag}`}
                            >
                              <Hash size={12} />
                              {tag}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-1 flex-col p-6">
                      <div className="mb-3 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDate(post.publishedAt)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} />
                          {readingTimeFromText(post.metaDescription || post.excerpt)}
                        </span>
                      </div>

                      <h3 className="mb-2 line-clamp-2 text-xl font-extrabold leading-snug text-slate-900">
                        <Link
                          href={`/blog/${post.slug}`}
                          className="transition hover:text-blue-700"
                        >
                          {post.title}
                        </Link>
                      </h3>

                      <p className="mb-5 line-clamp-3 flex-1 text-sm font-semibold leading-relaxed text-slate-600">
                        {safeStr(post.metaDescription) ||
                          safeStr(post.excerpt) ||
                          "Read this guide for clear steps and student-friendly tips."}
                      </p>

                      <div className="flex items-center justify-between gap-3">
                        <Link
                          href={`/blog/${post.slug}`}
                          className="inline-flex items-center gap-2 text-sm font-extrabold text-blue-700 transition hover:text-blue-800"
                        >
                          Read More
                          <ChevronRight size={16} />
                        </Link>

                        <Link
                          href={`/blog/${post.slug}`}
                          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold transition hover:bg-slate-50"
                        >
                          Open
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-10 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm md:flex-row md:items-center md:justify-between md:px-7">
                <div className="font-extrabold text-slate-900">
                  Page <span className="text-blue-700">{Math.min(urlPage, totalPages)}</span> / {totalPages}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={!canPrev}
                    onClick={() =>
                      setUrl({
                        tag: urlTag,
                        category: urlCategory,
                        search: urlSearch,
                        sort: urlSort,
                        page: urlPage - 1,
                      })
                    }
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    <ArrowLeft size={16} />
                    Prev
                  </button>

                  <button
                    disabled={!canNext}
                    onClick={() =>
                      setUrl({
                        tag: urlTag,
                        category: urlCategory,
                        search: urlSearch,
                        sort: urlSort,
                        page: urlPage + 1,
                      })
                    }
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto max-w-[1200px] px-4">
          <div className="overflow-hidden rounded-[32px] border border-emerald-200 bg-[radial-gradient(900px_500px_at_10%_0%,rgba(16,185,129,.20),transparent),radial-gradient(700px_450px_at_90%_20%,rgba(37,99,235,.14),transparent)]">
            <div className="flex flex-col items-start justify-between gap-6 p-7 md:p-10 lg:flex-row lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-extrabold text-emerald-900">
                  <Sparkles size={14} />
                  Fast help for students
                </div>
                <div className="mt-3 text-2xl font-extrabold text-slate-900 md:text-3xl">
                  Need help with IGNOU Assignments or Submission?
                </div>
                <div className="mt-2 font-semibold leading-relaxed text-slate-600">
                  Message us on WhatsApp — format, cover page, submission steps,
                  study material guidance sab me quick help milegi.
                </div>
              </div>

              <a
                href={`https://wa.me/917496865680?text=${encodeURIComponent(
                  "Hi! I need help related to IGNOU assignments/submission. Please guide me."
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full rounded-2xl bg-slate-900 px-7 py-4 text-center font-extrabold text-white transition hover:bg-slate-950 lg:w-auto"
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