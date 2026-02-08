// ✅ FILE PATH: app/guess-papers/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Filter,
  Check,
  Sparkles,
  ShieldCheck,
  Zap,
  BadgeCheck,
  ChevronRight,
  Search,
  X,
} from "lucide-react";

import TopBar from "@/components/TopBar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingButtons from "@/components/FloatingButtons";

import FilterSidebar from "@/components/solved-assignments/FilterSidebar";
import SortBar from "@/components/solved-assignments/SortBar";
import ProductGrid from "@/components/solved-assignments/ProductGrid";
import Pagination from "@/components/solved-assignments/Pagination";

// ✅ Category name must match DB exactly
const GUESS = "Guess Papers";

function safeSplitComma(v: string | null) {
  return (v || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function GuessPapersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    totalPages: 1,
    limit: 24,
  });

  const urlCategory = searchParams.get("category");
  const urlCourse = (searchParams.get("course") || "").trim();
  const urlSession = (searchParams.get("session") || "").trim();
  const urlSearch = (searchParams.get("search") || "").trim();

  const [selectedCat, setSelectedCat] = useState<string[]>(
    urlCategory ? safeSplitComma(urlCategory) : [GUESS]
  );

  const [selectedCourse, setSelectedCourse] = useState<string>(urlCourse);
  const [selectedSession, setSelectedSession] = useState<string>(urlSession);

  const [searchInput, setSearchInput] = useState<string>(urlSearch);
  const [search, setSearch] = useState<string>(urlSearch);

  const redirectToProducts = (nextCat: string[]) => {
    const params = new URLSearchParams(searchParams.toString());

    if (nextCat.length > 0) params.set("category", nextCat.join(","));
    else params.delete("category");

    params.delete("page");
    const qs = params.toString();
    router.push(`/products${qs ? `?${qs}` : ""}`);
  };

  const syncGuessUrl = (nextCourse: string, nextSession: string, nextSearch: string) => {
    const params = new URLSearchParams(searchParams.toString());

    params.set("category", GUESS);

    if (nextCourse) params.set("course", nextCourse);
    else params.delete("course");

    if (nextSession) params.set("session", nextSession);
    else params.delete("session");

    if (nextSearch) params.set("search", nextSearch);
    else params.delete("search");

    params.delete("page");

    const qs = params.toString();
    router.replace(`/guess-papers${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const handleToggleCategory = (cat: string) => {
    const current = Array.isArray(selectedCat) ? selectedCat : [GUESS];
    const next = current.includes(cat) ? current.filter((c) => c !== cat) : [...current, cat];
    const normalized = next.length === 0 ? [GUESS] : next;

    const hasOther = normalized.some((c) => c !== GUESS);
    const isMultiple = normalized.length > 1;

    if (hasOther || isMultiple) {
      redirectToProducts(normalized);
      return;
    }

    setSelectedCat([GUESS]);
    syncGuessUrl(selectedCourse, selectedSession, search);
  };

  useEffect(() => {
    const c = safeSplitComma(searchParams.get("category"));
    const course = (searchParams.get("course") || "").trim();
    const session = (searchParams.get("session") || "").trim();
    const qSearch = (searchParams.get("search") || "").trim();

    const hasOther = c.some((x) => x !== GUESS);
    const isMultiple = c.length > 1;

    if (hasOther || isMultiple) {
      const params = new URLSearchParams(searchParams.toString());
      const qs = params.toString();
      router.replace(`/products${qs ? `?${qs}` : ""}`);
      return;
    }

    setSelectedCat([GUESS]);
    setSelectedCourse(course);
    setSelectedSession(session);

    setSearchInput(qSearch);
    setSearch(qSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(() => {
      const q = searchInput.trim();
      if (q === search) return;
      setSearch(q);
      syncGuessUrl(selectedCourse, selectedSession, q);
    }, 500);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const breadcrumbText = useMemo(() => GUESS, []);

  useEffect(() => {
    document.body.style.overflow = isFilterOpen ? "hidden" : "auto";
  }, [isFilterOpen]);

  return (
    <main className="min-h-screen font-sans text-slate-800 bg-white">
      <style jsx global>{`
        @keyframes floaty {
          0% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(0, -10px, 0); }
          100% { transform: translate3d(0, 0, 0); }
        }
        @keyframes shimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .isp-grid {
          background-image: radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.07) 1px, transparent 0);
          background-size: 22px 22px;
        }
        .isp-floaty { animation: floaty 6s ease-in-out infinite; }
        .isp-shimmer { background-size: 200% 200%; animation: shimmer 10s ease-in-out infinite; }
      `}</style>

      <TopBar />
      <Navbar />

      {/* Breadcrumb (clean) */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-[1600px] mx-auto px-4 py-3 text-[13px] text-gray-500 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <Link href="/" className="hover:text-blue-700 font-semibold">Home</Link>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="text-blue-700 font-extrabold">{breadcrumbText}</span>
        </div>
      </div>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-[#f7f9ff]" />
        <div className="absolute inset-0 isp-grid opacity-60" />

        <div className="absolute -top-28 -left-28 h-[320px] w-[320px] rounded-full blur-3xl opacity-25 bg-gradient-to-br from-blue-500 via-indigo-500 to-cyan-400 isp-floaty" />
        <div className="absolute -bottom-36 -right-24 h-[380px] w-[380px] rounded-full blur-3xl opacity-20 bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-400 isp-floaty" />

        <div className="relative max-w-[1600px] mx-auto px-4 py-7 md:py-12">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10">
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-extrabold text-blue-700">
                <Sparkles size={14} /> Updated Guess Papers
              </div>

              <h1 className="mt-3 text-[28px] leading-tight md:text-5xl font-extrabold text-slate-900">
                Guess Papers
              </h1>

              <p className="mt-2 text-sm md:text-lg font-medium text-slate-600 max-w-3xl">
                Select course & session to find the exact Guess Paper. This page is dedicated to Guess Papers only.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-white/85 backdrop-blur border border-blue-100 text-blue-700 text-xs md:text-sm font-extrabold shadow-sm">
                  {GUESS}
                </span>
                {selectedCourse && (
                  <span className="px-3 py-1 rounded-full bg-white/85 backdrop-blur border border-gray-200 text-gray-700 text-xs md:text-sm font-bold shadow-sm">
                    Course: {selectedCourse}
                  </span>
                )}
                {selectedSession && (
                  <span className="px-3 py-1 rounded-full bg-white/85 backdrop-blur border border-gray-200 text-gray-700 text-xs md:text-sm font-bold shadow-sm">
                    Session: {selectedSession}
                  </span>
                )}
              </div>

              {/* MOBILE: Filter + Search */}
              <div className="mt-5 md:hidden space-y-3">
                <button
                  onClick={() => setIsFilterOpen(true)}
                  className="w-full rounded-2xl bg-blue-600 text-white font-extrabold py-3.5 shadow-lg active:scale-[0.99] transition flex items-center justify-center gap-2"
                >
                  <Filter size={18} /> Filter & Sort
                </button>

                <div className="w-full rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-sm p-3">
                  <div className="text-[11px] font-extrabold text-slate-700 uppercase mb-2">Search Guess Papers</div>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-white">
                    <Search size={18} className="text-gray-400" />
                    <input
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Type course code / subject / title…"
                      className="w-full outline-none text-sm font-semibold text-slate-800 placeholder:text-gray-400"
                    />
                    {searchInput && (
                      <button
                        onClick={() => setSearchInput("")}
                        className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500"
                        aria-label="Clear search"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500 font-semibold">
                    You can also use filters for course + session.
                  </div>
                </div>
              </div>
            </div>

            {/* DESKTOP badges */}
            <div className="hidden lg:block w-[420px]">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-sm p-4">
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="text-green-600" size={18} />
                    <div className="text-xs">
                      <div className="font-extrabold text-slate-900">Verified Sets</div>
                      <div className="font-bold text-gray-500">Quality checked</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-sm p-4">
                  <div className="flex items-center gap-2">
                    <Zap className="text-blue-600" size={18} />
                    <div className="text-xs">
                      <div className="font-extrabold text-slate-900">Fast Access</div>
                      <div className="font-bold text-gray-500">Easy download*</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-sm p-4 col-span-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="text-indigo-600" size={18} />
                    <div className="text-xs">
                      <div className="font-extrabold text-slate-900">Secure Checkout</div>
                      <div className="font-bold text-gray-500">Safe payment flow</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="p-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-cyan-600 isp-shimmer text-white">
                  <div className="text-sm font-extrabold">Quick Tip</div>
                  <div className="mt-1 text-xs font-bold opacity-90">
                    Choose Course + Session to find the exact Guess Paper quickly.
                  </div>
                </div>
                <div className="p-5">
                  <div className="text-xs font-extrabold text-slate-900">Best way to find your Guess Paper</div>
                  <div className="mt-2 text-xs font-bold text-gray-600 leading-relaxed">
                    1) Select Category → 2) Choose Course → 3) Pick Session → 4) Sort Latest.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop-only SEO ribbon */}
          <div className="hidden md:block mt-6 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur shadow-sm p-5">
            <div className="text-base font-extrabold text-slate-900">
              Download IGNOU Guess Papers – Session-wise
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-600 leading-relaxed">
              Choose your Course & Session to match the exact Guess Paper. If you want multiple categories (like Ebooks +
              Guess Papers), select them and you’ll be redirected to All Products automatically.
            </div>
            <div className="mt-3">
              <Link
                href="/products"
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 font-extrabold text-sm text-slate-800"
              >
                Browse All Products →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCTS AREA */}
      <section className="bg-[#f7f9ff] py-8 md:py-10 border-t border-gray-100">
        <div className="max-w-[1600px] mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-8 items-start relative">
            <div className="hidden lg:block w-[360px] flex-shrink-0 self-start z-30">
              <FilterSidebar
                className="border border-gray-200 rounded-2xl shadow-sm bg-white"
                selectedCat={[GUESS]}
                onToggleCategory={handleToggleCategory}
              />
            </div>

            {isFilterOpen && (
              <div
                className="lg:hidden fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm"
                onClick={() => setIsFilterOpen(false)}
              />
            )}
            <div
              className={`lg:hidden fixed top-0 left-0 z-[1000] h-full w-[85%] max-w-[360px] bg-white shadow-2xl transition-transform duration-300 ease-out ${
                isFilterOpen ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              <FilterSidebar
                closeFilter={() => setIsFilterOpen(false)}
                selectedCat={[GUESS]}
                onToggleCategory={handleToggleCategory}
              />
            </div>

            <div className="flex-1 w-full min-w-0">
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-3 md:p-4">
                <SortBar total={meta.total} page={meta.page} limit={meta.limit} />
              </div>

              <div className="mt-5">
                <ProductGrid selectedCat={[GUESS]} onMeta={setMeta} />
              </div>

              <div className="mt-6">
                <Pagination page={meta.page} totalPages={meta.totalPages} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* END CTA ABOVE WHY */}
      <section className="bg-white border-t border-gray-100">
        <div className="max-w-[1600px] mx-auto px-4 pt-10">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-lg font-extrabold text-slate-900">Want to browse everything?</div>
              <div className="mt-1 text-sm font-semibold text-slate-600">
                Explore all categories in one place (Ebooks, Projects, Solved Assignments, PYQ, Combo, etc). You can also combine filters there.
              </div>
            </div>
            <Link
              href="/products"
              className="shrink-0 inline-flex items-center justify-center px-5 py-3 rounded-2xl bg-slate-900 text-white font-extrabold hover:bg-slate-800 transition"
            >
              Go to All Products →
            </Link>
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto px-4 py-12 md:py-16">
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-6">Why Choose Us?</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { t: "Exam-focused Guess Papers", d: "High relevance for quick revision." },
              { t: "Quick Download", d: "Download immediately after purchase (where applicable)." },
              { t: "Fast Support", d: "Quick help on order, access and product matching." },
            ].map((x) => (
              <div key={x.t} className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
                <div className="flex items-start gap-3">
                  <Check className="text-green-600 mt-0.5" size={18} />
                  <div>
                    <div className="font-extrabold text-slate-900">{x.t}</div>
                    <div className="mt-1 text-sm font-medium text-slate-600">{x.d}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
      <FloatingButtons />
    </main>
  );
}
