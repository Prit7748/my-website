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
import ProductGrid from "@/components/solved-assignments/ProductGrid";
import Pagination from "@/components/solved-assignments/Pagination";

type Meta = { total: number; page: number; totalPages: number; limit: number };

export type CategoryShellConfig = {
  basePath: string;
  pageTitle: string;
  pageDesc: string;
  defaultSelectedCats: string[];
  breadcrumbLabel: string;
  themeBg?: string;
  whyPoints?: string[];
};

function parseCsv(value: string | null) {
  return (value || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function sameStringArray(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export default function CategoryShell({ config }: { config: CategoryShellConfig }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();

  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const initialSelectedCat = parseCsv(searchParams.get("category"));
  const initialSelectedCourse = parseCsv(searchParams.get("course"));
  const initialSelectedSession = parseCsv(searchParams.get("session"));
  const initialSelectedLanguage = parseCsv(searchParams.get("language"));
  const initialPage = Math.max(1, Number(searchParams.get("page") || "1") || 1);

  const [meta, setMeta] = useState<Meta>({
    total: 0,
    page: initialPage,
    totalPages: 1,
    limit: 12,
  });

  const [selectedCat, setSelectedCat] = useState<string[]>(
    initialSelectedCat.length ? initialSelectedCat : config.defaultSelectedCats
  );
  const [selectedCourse, setSelectedCourse] = useState<string[]>(initialSelectedCourse);
  const [selectedSession, setSelectedSession] = useState<string[]>(initialSelectedSession);
  const [selectedLanguage, setSelectedLanguage] = useState<string[]>(initialSelectedLanguage);

  const syncUrl = (partial?: {
    category?: string[];
    course?: string[];
    session?: string[];
    language?: string[];
    page?: number;
  }) => {
    const params = new URLSearchParams(searchKey);

    const nextCat = partial?.category ?? selectedCat;
    const nextCourse = partial?.course ?? selectedCourse;
    const nextSession = partial?.session ?? selectedSession;
    const nextLanguage = partial?.language ?? selectedLanguage;
    const nextPage = partial?.page ?? 1;

    if (nextCat.length) params.set("category", nextCat.join(","));
    else params.delete("category");

    if (nextCourse.length) params.set("course", nextCourse.join(","));
    else params.delete("course");

    if (nextSession.length) params.set("session", nextSession.join(","));
    else params.delete("session");

    if (nextLanguage.length) params.set("language", nextLanguage.join(","));
    else params.delete("language");

    if (nextPage > 1) params.set("page", String(nextPage));
    else params.delete("page");

    params.delete("sort");

    const qs = params.toString();
    router.replace(`${config.basePath}${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const handleToggleCategory = (cat: string) => {
    const next = selectedCat.includes(cat)
      ? selectedCat.filter((c) => c !== cat)
      : [...selectedCat, cat];

    setSelectedCat(next);
    syncUrl({
      category: next,
      page: 1,
    });
  };

  useEffect(() => {
    const urlCat = parseCsv(searchParams.get("category"));
    const urlCourse = parseCsv(searchParams.get("course"));
    const urlSession = parseCsv(searchParams.get("session"));
    const urlLanguage = parseCsv(searchParams.get("language"));
    const urlPage = Math.max(1, Number(searchParams.get("page") || "1") || 1);

    const nextCat = urlCat.length ? urlCat : config.defaultSelectedCats;

    setSelectedCat((prev) => (sameStringArray(prev, nextCat) ? prev : nextCat));
    setSelectedCourse((prev) => (sameStringArray(prev, urlCourse) ? prev : urlCourse));
    setSelectedSession((prev) => (sameStringArray(prev, urlSession) ? prev : urlSession));
    setSelectedLanguage((prev) => (sameStringArray(prev, urlLanguage) ? prev : urlLanguage));
    setMeta((prev) => (prev.page === urlPage ? prev : { ...prev, page: urlPage }));
  }, [searchParams, config.defaultSelectedCats]);

  const breadcrumbText = useMemo(() => {
    if (selectedCat.length === 0) return "All Products";
    if (selectedCat.length === 1) return selectedCat[0];
    return "Multiple Filters";
  }, [selectedCat]);

  useEffect(() => {
    document.body.style.overflow = isFilterOpen ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isFilterOpen]);

  const why = config.whyPoints?.length
    ? config.whyPoints
    : ["100% Correct Answers", "Instant PDF Download", "Fast Support"];

  return (
    <main className="min-h-screen font-sans bg-white text-slate-800">
      <TopBar />
      <Navbar />

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

      <section className="bg-white py-10 border-b border-gray-100">
        <div className="max-w-[1600px] mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            {config.pageTitle}
          </h1>
          <p className="text-gray-600 text-base md:text-lg leading-relaxed max-w-4xl">
            {config.pageDesc}
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {selectedCat.map((c) => (
              <span
                key={c}
                className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-semibold"
              >
                {c}
              </span>
            ))}

            {selectedCourse.map((c) => (
              <span
                key={`course-${c}`}
                className="px-3 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200 font-semibold"
              >
                Course: {c}
              </span>
            ))}

            {selectedSession.map((s) => (
              <span
                key={`session-${s}`}
                className="px-3 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200 font-semibold"
              >
                Session: {s}
              </span>
            ))}

            {selectedLanguage.map((l) => (
              <span
                key={`language-${l}`}
                className="px-3 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200 font-semibold"
              >
                Medium: {l}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className={`${config.themeBg || "bg-[#fff5f6]"} py-10 md:py-12`}>
        <div className="max-w-[1600px] mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-8 items-start relative">
            <div className="hidden lg:block w-[360px] flex-shrink-0 self-start z-30">
              <FilterSidebar
                className="border border-gray-200 rounded-xl shadow-sm"
                selectedCat={selectedCat}
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
                selectedCat={selectedCat}
                onToggleCategory={handleToggleCategory}
              />
            </div>

            <div className="flex-1 w-full min-w-0">
              <div className="lg:hidden mb-6 sticky top-20 z-20">
                <button
                  onClick={() => setIsFilterOpen(true)}
                  className="w-full bg-white border border-blue-200 text-blue-700 font-bold py-4 px-5 rounded-xl shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-blue-50 text-base"
                  type="button"
                >
                  <Filter size={20} /> Open Filters
                </button>
              </div>

              <div className="mb-5 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-[14px] text-gray-600 font-medium">
                  {meta.total
                    ? `Showing ${(meta.page - 1) * meta.limit + 1} - ${Math.min(
                        meta.page * meta.limit,
                        meta.total
                      )} of ${meta.total} results`
                    : "No results"}
                </p>
              </div>

              <ProductGrid selectedCat={selectedCat} onMeta={setMeta} />
              <Pagination page={meta.page} totalPages={meta.totalPages} />
            </div>
          </div>
        </div>
      </section>

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