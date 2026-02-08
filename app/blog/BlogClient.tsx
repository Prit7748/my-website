// ✅ FILE: app/blog/BlogClient.tsx
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
  TrendingUp,
  BookOpen,
  Bell,
  Zap,
  Search,
  X,
  ArrowLeft,
  ArrowRight,
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

function safeStr(x: any) {
  return String(x || "").trim();
}

function fmtDate(d?: string | null) {
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", { 
      year: "numeric", 
      month: "short", 
      day: "2-digit" 
    }).format(new Date(d));
  } catch {
    return d;
  }
}

function readingTimeFromExcerpt(excerpt?: string) {
  const text = safeStr(excerpt);
  if (!text) return "2 min read";
  const words = text.split(/\s+/).filter(Boolean).length;
  const mins = Math.max(2, Math.ceil(words / 80));
  return `${mins} min read`;
}

export default function BlogClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlTag = safeStr(searchParams.get("tag"));
  const urlSearch = safeStr(searchParams.get("search"));
  const urlPage = Math.max(1, Number(searchParams.get("page") || 1));

  const [loading, setLoading] = useState(true);
  const [blogs, setBlogs] = useState<BlogCard[]>([]);
  const [featured, setFeatured] = useState<BlogCard | null>(null);

  const [searchInput, setSearchInput] = useState(urlSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch);

  const limit = 9;

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil((blogs?.length || 0) / limit));
  }, [blogs?.length]);

  const GlobalStyles = () => (
    <style>{`
      @keyframes shimmer {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      .isp-shimmer {
        background-size: 200% 200%;
        animation: shimmer 10s ease-in-out infinite;
      }
      .no-scrollbar::-webkit-scrollbar { display: none; }
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    `}</style>
  );

  const categories = useMemo(
    () => [
      { name: "All Posts", icon: Zap, tag: "" },
      { name: "Exam Tips & Tricks", icon: TrendingUp, tag: "exam" },
      { name: "IGNOU News & Updates", icon: Bell, tag: "news" },
      { name: "Study Guides & Notes", icon: BookOpen, tag: "guide" },
    ],
    []
  );

  const setUrl = (next: { tag?: string; search?: string; page?: number }) => {
    const params = new URLSearchParams(searchParams.toString());

    if (safeStr(next.tag)) params.set("tag", safeStr(next.tag));
    else params.delete("tag");

    if (safeStr(next.search)) params.set("search", safeStr(next.search));
    else params.delete("search");

    if (next.page && next.page > 1) params.set("page", String(next.page));
    else params.delete("page");

    const qs = params.toString();
    router.replace(`/blog${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 450);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (debouncedSearch === urlSearch) return;
    setUrl({ tag: urlTag, search: debouncedSearch, page: 1 });
  }, [debouncedSearch, urlSearch, urlTag]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const q = new URLSearchParams();
        q.set("limit", "60");
        if (urlTag) q.set("tag", urlTag);

        const res = await fetch(`/api/blogs?${q.toString()}`, { cache: "no-store" });
        const data = await res.json();
        const list: BlogCard[] = Array.isArray(data?.blogs) ? data.blogs : [];

        if (cancelled) return;

        const qSearch = safeStr(urlSearch).toLowerCase();
        const filtered = qSearch
          ? list.filter((b) => {
              const t = safeStr(b.title).toLowerCase();
              const e = safeStr(b.excerpt).toLowerCase();
              const tags = Array.isArray(b.tags) ? b.tags.join(" ").toLowerCase() : "";
              return t.includes(qSearch) || e.includes(qSearch) || tags.includes(qSearch);
            })
          : list;

        setBlogs(filtered);
        setFeatured(filtered[0] || null);
      } catch {
        setBlogs([]);
        setFeatured(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [urlTag, urlSearch]);

  const page = Math.min(urlPage, totalPages);
  const pageItems = useMemo(() => {
    const start = (page - 1) * limit;
    const end = start + limit;
    const list = Array.isArray(blogs) ? blogs : [];
    const grid = featured ? list.filter((x) => x.slug !== featured.slug) : list;
    return grid.slice(start, end);
  }, [blogs, featured, page]);

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <main className="min-h-screen bg-gray-50 font-sans text-slate-800">
      <GlobalStyles />
      <TopBar />
      <Navbar />

      {/* ================= HERO / FEATURED ================= */}
      <section className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 py-14 md:py-16 text-white">
        <div className="max-w-[1200px] mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-8 items-stretch rounded-3xl overflow-hidden bg-white/10 backdrop-blur-sm border border-white/10 p-2">
            <div className="w-full lg:w-1/2 relative rounded-2xl overflow-hidden min-h-[260px]">
              {featured?.coverUrl ? (
                <img
                  src={featured.coverUrl}
                  alt={featured.title}
                  className="w-full h-full object-cover hover:scale-105 transition duration-500"
                />
              ) : (
                <div className="w-full h-full bg-white/10 flex items-center justify-center">
                  <div className="opacity-60"><Zap size={42} /></div>
                </div>
              )}
              <div className="absolute top-4 left-4 bg-blue-600 text-white text-xs font-extrabold px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-lg">
                <Zap size={14} /> Featured
              </div>
            </div>

            <div className="w-full lg:w-1/2 p-4 md:p-8 flex flex-col justify-center">
              <div className="flex items-center gap-4 text-blue-200 text-sm mb-4">
                <span className="flex items-center gap-1"><Calendar size={14} /> {fmtDate(featured?.publishedAt) || "Updated"}</span>
                <span className="flex items-center gap-1"><Clock size={14} /> {readingTimeFromExcerpt(featured?.excerpt)}</span>
              </div>
              <h1 className="text-2xl md:text-4xl font-extrabold mb-4 leading-tight">{featured?.title || "IGNOU Blog — Tips, News & Guides"}</h1>
              <p className="text-blue-100 text-base md:text-lg mb-6 line-clamp-3">
                {featured?.excerpt || "Practical strategies, latest updates, and student-friendly guides."}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href={featured?.slug ? `/blog/${featured.slug}` : "/blog"} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-extrabold transition inline-flex items-center justify-center gap-2">
                  Read Full Article <ChevronRight size={18} />
                </Link>
              </div>
              <div className="mt-6 rounded-2xl border border-white/15 bg-white/10 backdrop-blur p-3">
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/15 bg-white/10">
                  <Search size={18} className="text-white/60" />
                  <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search keywords..."
                    className="w-full bg-transparent outline-none text-sm font-semibold text-white placeholder:text-white/50"
                  />
                  {searchInput && (
                    <button onClick={() => setSearchInput("")} className="text-white/70"><X size={16} /></button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= CATEGORY FILTER ================= */}
      <section className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-[1200px] mx-auto px-4 py-4 overflow-x-auto no-scrollbar flex gap-3">
          {categories.map((cat) => {
            const isActive = safeStr(urlTag) === safeStr(cat.tag);
            const Icon = cat.icon;
            return (
              <button
                key={cat.name}
                onClick={() => setUrl({ tag: cat.tag, search: urlSearch, page: 1 })}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-extrabold whitespace-nowrap transition ${
                  isActive ? "bg-slate-900 text-white shadow-md" : "bg-gray-100 text-slate-600 hover:bg-gray-200"
                }`}
              >
                <Icon size={16} /> {cat.name}
              </button>
            );
          })}
        </div>
      </section>

      {/* ================= POSTS GRID ================= */}
      <section className="py-14">
        <div className="max-w-[1200px] mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900">Latest Articles</h2>
            {(urlTag || urlSearch) && (
              <button onClick={() => { setSearchInput(""); setUrl({ tag: "", search: "", page: 1 }); }} className="inline-flex items-center gap-2 border px-4 py-2 rounded-2xl text-sm font-extrabold">
                <X size={16} /> Clear
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-6 font-extrabold">Loading blogs...</div>
          ) : blogs.length === 0 ? (
            <div className="p-8 border rounded-3xl bg-white">No posts found.</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                {pageItems.map((post) => (
                  <article key={post.slug} className="bg-white rounded-3xl border border-gray-200 overflow-hidden hover:shadow-xl transition flex flex-col h-full group">
                    <div className="h-48 bg-slate-50 relative overflow-hidden">
                      {post.coverUrl ? (
                        <img src={post.coverUrl} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                      ) : (
                        <div className="flex h-full items-center justify-center opacity-30"><Tag size={48} /></div>
                      )}
                    </div>
                    <div className="p-6 flex flex-col flex-1">
                      <div className="text-xs text-gray-400 mb-3 flex gap-3">
                        <span className="flex items-center gap-1"><Calendar size={12} /> {fmtDate(post.publishedAt)}</span>
                        <span className="flex items-center gap-1"><Clock size={12} /> {readingTimeFromExcerpt(post.excerpt)}</span>
                      </div>
                      <h3 className="text-xl font-extrabold mb-3 line-clamp-2"><Link href={`/blog/${post.slug}`}>{post.title}</Link></h3>
                      <p className="text-sm text-slate-600 mb-6 line-clamp-3 flex-1">{post.excerpt}</p>
                      <Link href={`/blog/${post.slug}`} className="text-sm font-extrabold text-blue-600 flex items-center gap-1">
                        Read More <ChevronRight size={16} />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>

              {/* Pagination */}
              <div className="mt-10 flex items-center justify-between">
                <button disabled={!canPrev} onClick={() => setUrl({ tag: urlTag, search: urlSearch, page: page - 1 })} className="px-4 py-2 border rounded-2xl disabled:opacity-50">Prev</button>
                <div className="font-extrabold">Page {page} / {totalPages}</div>
                <button disabled={!canNext} onClick={() => setUrl({ tag: urlTag, search: urlSearch, page: page + 1 })} className="px-4 py-2 border rounded-2xl disabled:opacity-50">Next</button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ================= CTA (WhatsApp) ================= */}
      <section className="bg-gradient-to-r from-emerald-600 to-green-700 py-16 text-center text-white">
        <div className="max-w-[900px] mx-auto px-4">
          <h2 className="text-3xl font-extrabold mb-4">Need help with IGNOU Assignments?</h2>
          <a
            href={`https://wa.me/917496865680?text=${encodeURIComponent("Hi! I want help related to IGNOU assignments.")}`}
            target="_blank" rel="noreferrer"
            className="inline-flex items-center bg-slate-900 text-white px-8 py-4 rounded-2xl font-extrabold"
          >
            Chat on WhatsApp →
          </a>
        </div>
      </section>

      <Footer />
    </main>
  );
}