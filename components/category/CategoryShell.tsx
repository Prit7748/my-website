"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Filter, Check } from "lucide-react";

import TopBar from "@/components/TopBar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingButtons from "@/components/FloatingButtons";

import FilterSidebar from "@/components/solved-assignments/FilterSidebar";
import SortBar from "@/components/solved-assignments/SortBar";
import ProductGrid from "@/components/solved-assignments/ProductGrid";
import Pagination from "@/components/solved-assignments/Pagination";

type Meta = { total: number; page: number; totalPages: number; limit: number };

export type CategoryShellConfig = {
  basePath: string; // e.g. "/solved-assignments"
  pageTitle: string; // H1
  pageDesc: string; // short intro
  defaultSelectedCats: string[]; // fallback if url has no category
  breadcrumbLabel: string; // breadcrumb second level label
  themeBg?: string; // tailwind bg class for product section
  whyPoints?: string[]; // small points in "Why Choose Us?"
};

export default function CategoryShell({ config }: { config: CategoryShellConfig }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [meta, setMeta] = useState<Meta>({
    total: 0,
    page: 1,
    totalPages: 1,
    limit: 24,
  });

  // URL values
  const urlCategory = searchParams.get("category");
  const urlCourse = searchParams.get("course") || "";
  const urlSession = searchParams.get("session") || "";

  // Selected
  const [selectedCat, setSelectedCat] = useState<string[]>(
    urlCategory ? urlCategory.split(",").filter(Boolean) : config.defaultSelectedCats
  );
  const [selectedCourse, setSelectedCourse] = useState<string>(urlCourse);
  const [selectedSession, setSelectedSession] = useState<string>(urlSession);

  const syncUrl = (nextCat: string[], nextCourse: string, nextSession: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (nextCat.length > 0) params.set("category", nextCat.join(","));
    else params.delete("category");

    if (nextCourse) params.set("course", nextCourse);
    else params.delete("course");

    if (nextSession) params.set("session", nextSession);
    else params.delete("session");

    // reset page on filter change
    params.delete("page");

    const qs = params.toString();
    router.replace(`${config.basePath}${qs ? `?${qs}` : ""}`);
  };

  const handleToggleCategory = (cat: string) => {
    const next = selectedCat.includes(cat) ? selectedCat.filter((c) => c !== cat) : [...selectedCat, cat];
    setSelectedCat(next);
    syncUrl(next, selectedCourse, selectedSession);
  };

  // Back/forward sync
  useEffect(() => {
    const c = searchParams.get("category");
    const course = searchParams.get("course") || "";
    const session = searchParams.get("session") || "";

    setSelectedCat(c ? c.split(",").filter(Boolean) : config.defaultSelectedCats);
    setSelectedCourse(course);
    setSelectedSession(session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const breadcrumbText = useMemo(() => {
    return selectedCat.length > 0
      ? selectedCat.length === 1
        ? selectedCat[0]
        : "Multiple Filters"
      : "All Products";
  }, [selectedCat]);

  useEffect(() => {
    if (isFilterOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";
  }, [isFilterOpen]);

  const why = config.whyPoints?.length
    ? config.whyPoints
    : ["100% Correct Answers", "Instant PDF Download", "Fast Support"];

  return (
    <main className="min-h-screen font-sans bg-white text-slate-800">
      <TopBar />
      <Navbar />

      {/* Breadcrumb */}
      <div className="h-[45px] bg-gray-50 border-b border-gray-200 flex items-center">
        <div className="max-w-[1600px] mx-auto px-4 w-full text-[14px] text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis">
          <Link href="/" className="hover:text-blue-600">
            Home
          </Link>{" "}
          /{" "}
          <Link href={config.basePath} className="hover:text-blue-600 mx-1">
            {config.breadcrumbLabel}
          </Link>{" "}
          /{" "}
          <span className="text-gray-900 font-medium ml-1 text-blue-700">{breadcrumbText}</span>
        </div>
      </div>

      {/* Hero */}
      <section className="bg-white py-10 border-b border-gray-100">
        <div className="max-w-[1600px] mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">{config.pageTitle}</h1>
          <p className="text-gray-600 text-base md:text-lg leading-relaxed max-w-4xl">{config.pageDesc}</p>

          {/* Active chips */}
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {selectedCat.map((c) => (
              <span
                key={c}
                className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-semibold"
              >
                {c}
              </span>
            ))}
            {selectedCourse && (
              <span className="px-3 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200 font-semibold">
                Course: {selectedCourse}
              </span>
            )}
            {selectedSession && (
              <span className="px-3 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200 font-semibold">
                Session: {selectedSession}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Products */}
      <section className={`${config.themeBg || "bg-[#fff5f6]"} py-10 md:py-12`}>
        <div className="max-w-[1600px] mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-8 items-start relative">
            {/* Desktop Sidebar */}
            <div className="hidden lg:block w-[360px] flex-shrink-0 self-start z-30">
              <FilterSidebar
                className="border border-gray-200 rounded-xl shadow-sm"
                selectedCat={selectedCat}
                onToggleCategory={handleToggleCategory}
              />
            </div>

            {/* Mobile Sidebar overlay */}
            {isFilterOpen && (
              <div
                className="lg:hidden fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm animate-fade-in"
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
                selectedCat={selectedCat}
                onToggleCategory={handleToggleCategory}
              />
            </div>

            {/* Right content */}
            <div className="flex-1 w-full min-w-0">
              <div className="lg:hidden mb-6 sticky top-20 z-20">
                <button
                  onClick={() => setIsFilterOpen(true)}
                  className="w-full bg-white border border-blue-200 text-blue-700 font-bold py-4 px-5 rounded-xl shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-blue-50 text-base"
                >
                  <Filter size={20} /> Filter & Sort Products
                </button>
              </div>

              <SortBar total={meta.total} page={meta.page} limit={meta.limit} />
              <ProductGrid selectedCat={selectedCat} onMeta={setMeta} />
              <Pagination page={meta.page} totalPages={meta.totalPages} />
            </div>
          </div>
        </div>
      </section>

      {/* Why section */}
      <section className="bg-white py-16 border-t border-gray-100">
        <div className="max-w-[1600px] mx-auto px-4">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">Why Choose Us?</h2>
          <div className="grid md:grid-cols-2 gap-8 text-gray-600 text-base leading-relaxed">
            <ul className="space-y-3">
              {why.map((t) => (
                <li key={t} className="flex gap-3">
                  <Check size={20} className="text-green-500 mt-1" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className={`h-[40px] ${config.themeBg || "bg-[#fff5f6]"} border-t border-gray-100`} />
      <Footer />
      <FloatingButtons />
    </main>
  );
}
