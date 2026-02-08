"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingButtons from "@/components/FloatingButtons";
import { Search, X, ChevronRight, BookOpen, Sparkles } from "lucide-react";

type CourseItem = { code: string; title?: string; count?: number };
type ApiResp = { courses: CourseItem[]; meta?: { total?: number } };

function safeStr(x: any) {
  return String(x || "").trim();
}

export default function CoursesPage() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");

  // debounce
  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput.trim()), 450);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", "400");
        if (q) params.set("search", q);

        const res = await fetch(`/api/courses?${params.toString()}`, { cache: "no-store" });
        const data: ApiResp = await res.json();
        if (cancelled) return;

        setCourses(Array.isArray(data?.courses) ? data.courses : []);
      } catch {
        if (!cancelled) setCourses([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q]);

  const total = useMemo(() => courses.length, [courses]);

  return (
    <main className="min-h-screen font-sans text-slate-800 bg-white">
      <style>{`
        @keyframes floaty { 0%{transform:translate3d(0,0,0)} 50%{transform:translate3d(0,-10px,0)} 100%{transform:translate3d(0,0,0)} }
        .isp-grid{background-image:radial-gradient(circle at 1px 1px, rgba(15,23,42,.07) 1px, transparent 0); background-size:22px 22px;}
        .isp-floaty{animation: floaty 6s ease-in-out infinite;}
      `}</style>

      <TopBar />
      <Navbar />

      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-[1600px] mx-auto px-4 py-3 text-[13px] text-gray-500 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <Link href="/" className="hover:text-blue-700 font-semibold">
            Home
          </Link>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="text-blue-700 font-extrabold">All Courses</span>
        </div>
      </div>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-[#f7f9ff]" />
        <div className="absolute inset-0 isp-grid opacity-60" />
        <div className="absolute -top-28 -left-28 h-[320px] w-[320px] rounded-full blur-3xl opacity-25 bg-gradient-to-br from-blue-500 via-indigo-500 to-cyan-400 isp-floaty" />
        <div className="absolute -bottom-36 -right-24 h-[380px] w-[380px] rounded-full blur-3xl opacity-20 bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-400 isp-floaty" />

        <div className="relative max-w-[1600px] mx-auto px-4 py-10 md:py-14">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-extrabold text-blue-700">
              <Sparkles size={14} /> Course-wise browsing (fast)
            </div>

            <h1 className="mt-3 text-[28px] leading-tight md:text-5xl font-extrabold text-slate-900">
              View All Courses
            </h1>

            <p className="mt-2 text-sm md:text-lg font-medium text-slate-600">
              Search by course code (e.g., <b>BEGS183</b>, <b>MPA036</b>, <b>MMT008</b>) and open related products instantly.
            </p>

            {/* Search */}
            <div className="mt-6 w-full rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-sm p-3">
              <div className="text-[11px] font-extrabold text-slate-700 uppercase mb-2">Search courses</div>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-white">
                <Search size={18} className="text-gray-400" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Type course code… (MPA036, BEGS183...)"
                  className="w-full outline-none text-sm font-semibold text-slate-800 placeholder:text-gray-400"
                />
                {searchInput ? (
                  <button
                    onClick={() => setSearchInput("")}
                    className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500"
                    aria-label="Clear search"
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>
              <div className="mt-2 text-[11px] text-slate-500 font-semibold">
                Total courses found: <span className="text-blue-700">{loading ? "Loading..." : total}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LIST */}
      <section className="bg-[#f7f9ff] py-8 md:py-10 border-t border-gray-100">
        <div className="max-w-[1600px] mx-auto px-4">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
            {loading ? (
              <div className="rounded-2xl border border-gray-200 bg-slate-50 p-6 font-extrabold text-slate-700">
                Loading courses...
              </div>
            ) : courses.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-slate-50 p-6">
                <div className="text-lg font-extrabold text-slate-900">No courses found</div>
                <div className="mt-1 text-sm font-semibold text-slate-600">
                  Try a different course code.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {courses.map((c) => {
                  const code = safeStr(c.code);
                  const count = Number(c.count || 0);
                  const href = `/products?course=${encodeURIComponent(code)}`; // ✅ opens filtered products list
                  return (
                    <Link
                      key={code}
                      href={href}
                      className="rounded-2xl border border-gray-200 bg-white hover:bg-slate-50 transition p-4 shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-slate-900">{code}</div>
                          <div className="mt-1 text-[11px] text-slate-600 font-semibold line-clamp-2">
                            {safeStr(c.title) ? safeStr(c.title) : "View related products"}
                          </div>
                        </div>
                        <div className="text-blue-700">
                          <BookOpen size={18} />
                        </div>
                      </div>
                      <div className="mt-3 text-[11px] font-extrabold text-slate-700">
                        {count > 0 ? `${count} products` : "Browse"}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <Footer />
      <FloatingButtons />
    </main>
  );
}
