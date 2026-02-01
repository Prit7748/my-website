"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X, Search, Loader2 } from "lucide-react";

interface FilterSidebarProps {
  className?: string;
  closeFilter?: () => void;

  // ✅ existing props (category)
  selectedCat: string[];
  onToggleCategory: (cat: string) => void;
}

/** UI Category Name -> DB slug mapping (आपके Product model के category field के हिसाब से) */
const UI_TO_DB_CATEGORY: Record<string, string> = {
  "Solved Assignments": "solved-assignments",
  "Handwritten PDFs": "handwritten-pdfs",
  "Hardcopy Delivery": "handwritten-hardcopy",
  "Project & Synopsis": "projects",
  "Question Papers (PYQs)": "question-papers",
  "eBooks/Notes": "ebooks",
  "Guess Paper": "guess-papers",
  "Combo": "combo",
};

const categoriesUI = Object.keys(UI_TO_DB_CATEGORY);

export default function FilterSidebar({
  className = "",
  closeFilter,
  selectedCat,
  onToggleCategory,
}: FilterSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL se existing selected values
  const selectedCourseFromUrl = (searchParams.get("course") || "").trim();
  const selectedSessionFromUrl = (searchParams.get("session") || "").trim();

  const [keyword, setKeyword] = useState(searchParams.get("q") || "");
  const [courseSearch, setCourseSearch] = useState("");

  const [selectedCourse, setSelectedCourse] = useState<string>(selectedCourseFromUrl);
  const [selectedSession, setSelectedSession] = useState<string>(selectedSessionFromUrl);

  const [courses, setCourses] = useState<string[]>([]);
  const [sessions, setSessions] = useState<string[]>([]);
  const [loadingFacets, setLoadingFacets] = useState(false);

  // --- SORTING: selected categories top ---
  const sortedCategories = useMemo(() => {
    return [...categoriesUI].sort((a, b) => {
      const isA = selectedCat.includes(a);
      const isB = selectedCat.includes(b);
      return isA === isB ? 0 : isA ? -1 : 1;
    });
  }, [selectedCat]);

  // selected UI categories -> DB slugs (for API facets scope)
  const selectedCategorySlugs = useMemo(() => {
    const slugs = selectedCat
      .map((ui) => UI_TO_DB_CATEGORY[ui])
      .filter(Boolean);
    // fallback: Solved Assignments selected नहीं है तो भी solved-assignments scope दे दें
    return slugs.length ? slugs : ["solved-assignments"];
  }, [selectedCat]);

  // ✅ Facets fetch (courses + sessions) API से
  useEffect(() => {
    let active = true;

    async function loadFacets() {
      try {
        setLoadingFacets(true);
        const qs = new URLSearchParams();
        qs.set("category", selectedCategorySlugs.join(","));
        qs.set("limit", "1"); // facets के लिए data नहीं चाहिए
        qs.set("page", "1");

        const res = await fetch(`/api/products?${qs.toString()}`, {
          method: "GET",
          credentials: "include",
        });
        const data = await res.json();

        if (!active) return;

        const nextCourses = Array.isArray(data?.facets?.courses) ? data.facets.courses : [];
        const nextSessions = Array.isArray(data?.facets?.sessions) ? data.facets.sessions : [];

        setCourses(nextCourses);
        setSessions(nextSessions);
      } catch (e) {
        if (!active) return;
        setCourses([]);
        setSessions([]);
      } finally {
        if (!active) return;
        setLoadingFacets(false);
      }
    }

    loadFacets();
    return () => {
      active = false;
    };
  }, [selectedCategorySlugs]);

  const filteredCourses = useMemo(() => {
    const s = courseSearch.toLowerCase();
    return courses.filter((c) => (c || "").toLowerCase().includes(s));
  }, [courses, courseSearch]);

  // ✅ URL update helper (apply/reset)
  const updateUrl = (next: { course?: string; session?: string; q?: string; resetPage?: boolean }) => {
    const params = new URLSearchParams(searchParams.toString());

    // optional: keyword (future)
    if (typeof next.q === "string") {
      const v = next.q.trim();
      if (v) params.set("q", v);
      else params.delete("q");
    }

    if (typeof next.course === "string") {
      const v = next.course.trim();
      if (v) params.set("course", v);
      else params.delete("course");
    }

    if (typeof next.session === "string") {
      const v = next.session.trim();
      if (v) params.set("session", v);
      else params.delete("session");
    }

    // pagination reset on filter change
    if (next.resetPage) params.delete("page");

    const qs = params.toString();
    router.replace(`/solved-assignments${qs ? `?${qs}` : ""}`);
  };

  const handleApply = () => {
    updateUrl({ course: selectedCourse, session: selectedSession, q: keyword, resetPage: true });
    if (closeFilter) closeFilter();
  };

  const handleReset = () => {
    setKeyword("");
    setCourseSearch("");
    setSelectedCourse("");
    setSelectedSession("");

    // categories reset: सिर्फ "Solved Assignments" रखना है तो ये logic:
    // अगर currently कई categories selected हैं, तो uncheck करके सिर्फ solved assignments रखो
    // NOTE: onToggleCategory से toggle होता है, इसलिए safe approach: जो selected हैं और "Solved Assignments" नहीं हैं उन्हें हटाओ
    selectedCat.forEach((c) => {
      if (c !== "Solved Assignments") onToggleCategory(c);
    });
    if (!selectedCat.includes("Solved Assignments")) onToggleCategory("Solved Assignments");

    updateUrl({ course: "", session: "", q: "", resetPage: true });
    if (closeFilter) closeFilter();
  };

  return (
    <aside className={`bg-white flex flex-col h-full ${className}`}>
      <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 h-full">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
          <h3 className="font-bold text-[20px] text-gray-900">Filters</h3>
          {closeFilter && (
            <button
              onClick={closeFilter}
              className="p-2 bg-gray-100 rounded-full hover:bg-red-50 text-gray-500 hover:text-red-600 transition"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* 1) Search Keyword (future ready; अभी grid API में q नहीं लगा है, लेकिन URL में store होगा) */}
        <div className="mb-6">
          <label className="text-[13px] font-bold text-gray-600 block mb-2 uppercase tracking-wide">
            Search Keyword
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded px-3 py-2.5 pl-9 outline-none focus:border-blue-500 transition"
            />
            <Search size={18} className="absolute left-3 top-3 text-gray-400" />
          </div>
        </div>

        {/* 2) Category */}
        <div className="mb-6">
          <label className="text-[13px] font-bold text-gray-600 block mb-2 uppercase tracking-wide">
            Category
          </label>

          <div className="space-y-1 pr-1 border border-gray-50 rounded p-1" style={{ maxHeight: "220px", overflowY: "auto" }}>
            {sortedCategories.map((cat) => (
              <label
                key={cat}
                className={`flex items-center gap-3 cursor-pointer group select-none p-2 rounded-lg transition-all duration-200 border ${
                  selectedCat.includes(cat)
                    ? "bg-blue-50 border-blue-100 sticky top-0 z-10 shadow-sm"
                    : "border-transparent hover:bg-gray-50"
                }`}
              >
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedCat.includes(cat)}
                    onChange={() => onToggleCategory(cat)}
                    className="peer w-5 h-5 border-gray-300 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
                <span
                  className={`text-[14px] font-medium transition leading-snug ${
                    selectedCat.includes(cat) ? "text-blue-700 font-bold" : "text-gray-700 group-hover:text-blue-700"
                  }`}
                >
                  {cat}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Facets Loading */}
        {loadingFacets && (
          <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="animate-spin" size={16} /> Loading courses & sessions...
          </div>
        )}

        {/* 3) Course (API facets) */}
        <div className="mb-6">
          <label className="text-[13px] font-bold text-gray-600 block mb-2 uppercase tracking-wide">
            Course
          </label>

          <div className="relative mb-2">
            <input
              type="text"
              placeholder="Find course..."
              value={courseSearch}
              onChange={(e) => setCourseSearch(e.target.value)}
              className="w-full text-xs border border-gray-300 rounded px-2 py-2 outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-1 pr-1 border border-gray-50 rounded p-1" style={{ maxHeight: "160px", overflowY: "auto" }}>
            {filteredCourses.length > 0 ? (
              filteredCourses.map((c) => {
                const checked = selectedCourse === c;
                return (
                  <label
                    key={c}
                    className={`flex items-center gap-2 cursor-pointer p-2 rounded transition border ${
                      checked ? "bg-blue-50 border-blue-100" : "border-transparent hover:border-gray-100 hover:bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setSelectedCourse(checked ? "" : c)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600"
                    />
                    <span className={`text-[13px] font-medium ${checked ? "text-blue-700 font-bold" : "text-gray-700"}`}>
                      {c}
                    </span>
                  </label>
                );
              })
            ) : (
              <p className="text-xs text-gray-400 p-2 text-center">No course found</p>
            )}
          </div>
        </div>

        {/* 4) Session (API facets) */}
        <div className="mb-6">
          <label className="text-[13px] font-bold text-gray-600 block mb-2 uppercase tracking-wide">
            Session
          </label>

          <div className="space-y-1 pr-1" style={{ maxHeight: "140px", overflowY: "auto" }}>
            {sessions.length > 0 ? (
              sessions.map((s) => {
                const checked = selectedSession === s;
                return (
                  <label
                    key={s}
                    className={`flex items-center gap-3 cursor-pointer p-2 rounded transition ${
                      checked ? "bg-blue-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setSelectedSession(checked ? "" : s)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600"
                    />
                    <span className={`text-[13px] ${checked ? "text-blue-700 font-bold" : "text-gray-700"}`}>{s}</span>
                  </label>
                );
              })
            ) : (
              <p className="text-xs text-gray-400 p-2 text-center">No sessions found</p>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-auto pt-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={handleApply}
            className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-bold shadow hover:bg-blue-700 transition active:scale-95"
          >
            Apply
          </button>
          <button
            onClick={handleReset}
            className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl text-sm font-bold hover:bg-gray-200 transition"
          >
            Reset
          </button>
        </div>
      </div>
    </aside>
  );
}
