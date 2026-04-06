"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";

import TopBar from "@/components/TopBar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingButtons from "@/components/FloatingButtons";
import ProductCard from "@/components/ProductCard";

import {
  Search,
  Filter,
  ChevronRight,
  X,
  Sparkles,
  ShieldCheck,
  Zap,
  BadgeCheck,
  SlidersHorizontal,
  Check,
  ChevronDown,
} from "lucide-react";

// --- TYPES ---
type ApiProductCard = {
  title: string;
  slug: string;
  category?: string;
  courseCodes?: string[];
  session?: string;
  language?: string;
  price: number;
  oldPrice?: number | null;
  images?: string[];
  thumbUrl?: string;
  quickUrl?: string;
  isDigital?: boolean;
};

type ApiProductsResponse = {
  products: ApiProductCard[];
  pagination?: { total?: number; page?: number; totalPages?: number; limit?: number };
  meta?: { total?: number; page?: number; totalPages?: number; limit?: number };
};

type SortKey = "latest" | "price_asc" | "price_desc";

type ProductsClientProps = {
  initialSearchParam?: string;
  initialCategoryParam?: string;
  initialCourseParam?: string;
  initialSessionParam?: string;
  initialLanguageParam?: string;
  initialSortParam?: string;
  initialPageParam?: string;
};

// --- HELPERS ---
function safeStr(x: any) {
  return String(x || "").trim();
}
function safeArr<T = any>(x: any): T[] {
  return Array.isArray(x) ? x : [];
}
function parseCsvParam(v: string) {
  return safeStr(v)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}
function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}
function toUpper(s: string) {
  return safeStr(s).toUpperCase();
}
function isAlpha1(s: string) {
  return /^[A-Z]$/.test(s);
}
function isHardcopyCategory(category?: string) {
  return safeStr(category).toLowerCase() === "handwritten hardcopy (delivery)".toLowerCase();
}

// ✅ Normalize query (search assist)
function normalizeQuery(raw: string) {
  const s = safeStr(raw).toUpperCase();
  const cleaned = s.replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const compact = cleaned.replace(/\s+/g, "");
  return { cleaned, compact };
}

// ✅ Extract subject code variants
function extractSubjectCodeVariants(raw: string) {
  const { compact } = normalizeQuery(raw);
  const m1 = compact.match(/([A-Z]{2,6})(\d{2,4})/);
  if (!m1) return { code: "", variants: [] as string[] };

  const letters = m1[1];
  const digits = m1[2];

  const digitsNoLeading = String(Number(digits));
  const pad3 = digitsNoLeading.padStart(3, "0");

  const variants = Array.from(
    new Set([
      `${letters}${digits}`,
      `${letters}${digitsNoLeading}`,
      `${letters}-${digits}`,
      `${letters}-${digitsNoLeading}`,
      `${letters} ${digits}`,
      `${letters} ${digitsNoLeading}`,
      `${letters}${pad3}`,
      `${letters}-${pad3}`,
      `${letters} ${pad3}`,
    ])
  );

  return { code: `${letters}${pad3}`, variants };
}

/** ✅ Portal dropdown so it NEVER hides behind products */
function PortalDropdown({
  open,
  anchorEl,
  width = 360,
  children,
  onRequestClose,
}: {
  open: boolean;
  anchorEl: HTMLElement | null;
  width?: number;
  children: React.ReactNode;
  onRequestClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, w: width });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !anchorEl) return;

    const update = () => {
      const r = anchorEl.getBoundingClientRect();
      const vw = window.innerWidth;
      const desiredW = Math.min(width, Math.max(280, vw - 24));
      const left = Math.min(Math.max(12, r.left), vw - desiredW - 12);
      const top = r.bottom + 8;
      setPos({ top, left, w: desiredW });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, anchorEl, width]);

  useEffect(() => {
    if (!open) return;
    const onKey_queries = (e: KeyboardEvent) => {
      if (e.key === "Escape") onRequestClose();
    };
    document.addEventListener("keydown", onKey_queries);
    return () => document.removeEventListener("keydown", onKey_queries);
  }, [open, onRequestClose]);

  if (!mounted || !open || !anchorEl) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999]" onMouseDown={onRequestClose}>
      <div
        className="absolute"
        style={{ top: pos.top, left: pos.left, width: pos.w }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

/** ✅ Industrial dropdown multi-select with internal search + big-list friendly behavior (Course) */
function MultiSelectDropdown({
  label,
  items,
  selected,
  onToggle,
  onClear,
  placeholder,
  searchable = true,
  alphaJump = false,
  maxRender = 250,
}: {
  label: string;
  items: string[];
  selected: string[];
  onToggle: (v: string) => void;
  onClear: () => void;
  placeholder?: string;
  searchable?: boolean;
  alphaJump?: boolean;
  maxRender?: number;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setQ("");
      return;
    }
    const t = setTimeout(() => searchRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  const selectedPreview = useMemo(() => {
    if (!selected.length) return "";
    const first = selected.slice(0, 2).join(", ");
    return selected.length <= 2 ? first : `${first} +${selected.length - 2}`;
  }, [selected]);

  const filtered = useMemo(() => {
    const all = items || [];
    if (!searchable || !q.trim()) return all;

    const qq = toUpper(q.trim());
    if (alphaJump && isAlpha1(qq)) return all.filter((x) => toUpper(x).startsWith(qq));
    return all.filter((x) => toUpper(x).includes(qq));
  }, [items, q, searchable, alphaJump]);

  const renderList = useMemo(() => filtered.slice(0, maxRender), [filtered, maxRender]);

  const alphaLetters = useMemo(() => {
    if (!alphaJump) return [];
    const set = new Set<string>();
    for (const it of items) {
      const u = toUpper(it);
      const ch = u.charAt(0);
      if (ch && /^[A-Z]$/.test(ch)) set.add(ch);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [alphaJump, items]);

  return (
    <div className="relative">
      <button
        ref={anchorRef}
        onClick={() => setOpen((s) => !s)}
        className={`w-full h-[58px] px-4 rounded-[22px] border bg-white flex items-center justify-between gap-3 transition-all duration-200 ${
          open
            ? "border-blue-300 shadow-[0_0_0_3px_rgba(59,130,246,0.08)]"
            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
        }`}
        type="button"
      >
        <div className="min-w-0 text-left">
          <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{label}</div>
          <div className="text-[12px] font-bold text-slate-800 truncate mt-0.5">
            {selected.length ? `${selected.length} selected • ${selectedPreview}` : placeholder || "Select"}
          </div>
        </div>
        <ChevronDown
          size={17}
          className={`text-slate-500 flex-shrink-0 transition ${open ? "rotate-180 text-blue-700" : ""}`}
        />
      </button>

      <PortalDropdown
        open={open}
        anchorEl={anchorRef.current}
        width={380}
        onRequestClose={() => setOpen(false)}
      >
        <div className="rounded-[24px] border border-slate-200 bg-white shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/60 flex items-center justify-between gap-3">
            <div className="text-xs font-extrabold text-slate-900">{label} (multi-select)</div>
            <button
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              className="text-[11px] font-extrabold text-slate-700 hover:text-blue-700"
              type="button"
            >
              Clear
            </button>
          </div>

          {searchable ? (
            <div className="p-3 border-b border-slate-100">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:border-slate-300">
                <Search size={16} className="text-slate-400" />
                <input
                  ref={searchRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={alphaJump ? 'Type "A" / "T" for codes, or search full code…' : "Search options…"}
                  className="w-full outline-none text-xs font-semibold text-slate-800 placeholder:text-slate-400"
                />
                {q ? (
                  <button
                    onClick={() => setQ("")}
                    className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
                    type="button"
                    aria-label="Clear dropdown search"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>

              {alphaJump && alphaLetters.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {alphaLetters.slice(0, 26).map((ch) => (
                    <button
                      key={ch}
                      onClick={() => setQ(ch)}
                      className={`h-7 px-2 rounded-lg border text-[11px] font-extrabold transition ${
                        toUpper(q) === ch
                          ? "border-blue-600 bg-blue-50 text-blue-800"
                          : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                      type="button"
                    >
                      {ch}
                    </button>
                  ))}
                  <button
                    onClick={() => setQ("")}
                    className="h-7 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-[11px] font-extrabold text-slate-700"
                    type="button"
                  >
                    All
                  </button>
                </div>
              ) : null}

              <div className="mt-2 text-[11px] font-semibold text-slate-600">
                {filtered.length ? (
                  <>
                    Showing <span className="font-extrabold">{renderList.length}</span>
                    {filtered.length > renderList.length ? (
                      <>
                        {" "}
                        of <span className="font-extrabold">{filtered.length}</span> (refine search)
                      </>
                    ) : null}
                  </>
                ) : (
                  "No matches. Try another keyword."
                )}
              </div>
            </div>
          ) : null}

          <div className="max-h-[360px] overflow-auto p-2">
            {renderList.length ? (
              renderList.map((v) => {
                const active = selected.includes(v);
                return (
                  <button
                    key={v}
                    onClick={() => onToggle(v)}
                    className={`w-full px-3 py-2 rounded-xl text-left text-xs font-extrabold flex items-center justify-between gap-2 transition ${
                      active ? "bg-blue-50 text-blue-800" : "hover:bg-slate-50 text-slate-800"
                    }`}
                    type="button"
                  >
                    <span className="truncate">{v}</span>
                    {active ? <Check size={16} className="text-blue-700" /> : null}
                  </button>
                );
              })
            ) : (
              <div className="p-3 text-xs font-semibold text-slate-600">No options available right now.</div>
            )}
          </div>
        </div>
      </PortalDropdown>
    </div>
  );
}

function SelectedChip({
  text,
  onRemove,
  tone = "blue",
}: {
  text: string;
  onRemove: () => void;
  tone?: "blue" | "gray";
}) {
  const base =
    tone === "blue" ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-700";
  return (
    <button
      onClick={onRemove}
      className={`px-3 py-1 rounded-full border ${base} hover:shadow-sm transition text-[11px] font-extrabold flex items-center gap-2`}
      type="button"
      title="Remove"
    >
      <span className="truncate max-w-[220px]">{text}</span>
      <span className="text-slate-400">×</span>
    </button>
  );
}

function ProductsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden animate-pulse"
        >
          <div className="aspect-[3/4] bg-gray-200" />
          <div className="p-3">
            <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-full mb-2" />
            <div className="h-4 bg-gray-200 rounded w-4/5 mb-3" />
            <div className="h-5 bg-gray-200 rounded w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ✅ MAIN COMPONENT
export default function ProductsClient({
  initialSearchParam = "",
  initialCategoryParam = "",
  initialCourseParam = "",
  initialSessionParam = "",
  initialLanguageParam = "",
  initialSortParam = "latest",
  initialPageParam = "1",
}: ProductsClientProps) {
  const router = useRouter();
  const sp = useSearchParams();

  const didHydrateSyncRef = useRef(false);

  const initialUrlSearch = safeStr(initialSearchParam);
  const initialUrlCategory = parseCsvParam(safeStr(initialCategoryParam));
  const initialUrlCourse = parseCsvParam(safeStr(initialCourseParam));
  const initialUrlSession = parseCsvParam(safeStr(initialSessionParam));
  const initialUrlLang = parseCsvParam(safeStr(initialLanguageParam));
  const initialUrlSort = (safeStr(initialSortParam) as SortKey) || "latest";
  const initialUrlPage = Number(initialPageParam || "1") || 1;

  const urlSearch = safeStr(sp.get("search"));
  const urlCategory = parseCsvParam(safeStr(sp.get("category")));
  const urlCourse = parseCsvParam(safeStr(sp.get("course")));
  const urlSession = parseCsvParam(safeStr(sp.get("session")));
  const urlLang = parseCsvParam(safeStr(sp.get("language")));
  const urlSort = (safeStr(sp.get("sort")) as SortKey) || "latest";
  const urlPage = Number(sp.get("page") || "1") || 1;

  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [searchInput, setSearchInput] = useState(initialUrlSearch);
  const [search, setSearch] = useState(initialUrlSearch);

  const [selectedCat, setSelectedCat] = useState<string[]>(initialUrlCategory);
  const [selectedCourse, setSelectedCourse] = useState<string[]>(initialUrlCourse);
  const [selectedSession, setSelectedSession] = useState<string[]>(initialUrlSession);
  const [selectedLang, setSelectedLang] = useState<string[]>(initialUrlLang);

  const [sort, setSort] = useState<SortKey>(initialUrlSort || "latest");

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ApiProductCard[]>([]);
  const [meta, setMeta] = useState({
    total: 0,
    page: Math.max(1, initialUrlPage),
    totalPages: 1,
    limit: 12,
  });

  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ApiProductCard[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const suggestBoxRef = useRef<HTMLDivElement | null>(null);

  const cacheRef = useRef({
    categories: new Set<string>(),
    courses: new Set<string>(),
    sessions: new Set<string>(),
    languages: new Set<string>(),
  });

  const defaultCategoryFallback = [
    "Solved Assignments",
    "Handwritten PDFs",
    "Handwritten Hardcopy (Delivery)",
    "Question Papers (PYQ)",
    "Guess Papers",
    "eBooks/Notes",
    "Projects & Synopsis",
    "Combo",
  ];
  const defaultLanguageFallback = ["Hindi", "English", "Urdu"];
  const defaultSessionFallback = ["2025-2026", "2024-2025", "2023-2024"];

  useEffect(() => {
    if (isFilterOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isFilterOpen]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!suggestBoxRef.current) return;
      if (!suggestBoxRef.current.contains(e.target as any)) setShowSuggest(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = searchInput.trim();
      if (next === search) return;
      setSearch(next);
      syncUrl({ search: next, page: 1 });
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!didHydrateSyncRef.current) {
      didHydrateSyncRef.current = true;

      const sameSearch = urlSearch === initialUrlSearch;
      const sameCat = JSON.stringify(urlCategory) === JSON.stringify(initialUrlCategory);
      const sameCourse = JSON.stringify(urlCourse) === JSON.stringify(initialUrlCourse);
      const sameSession = JSON.stringify(urlSession) === JSON.stringify(initialUrlSession);
      const sameLang = JSON.stringify(urlLang) === JSON.stringify(initialUrlLang);
      const sameSort = urlSort === initialUrlSort;
      const samePage = (urlPage || 1) === (initialUrlPage || 1);

      if (sameSearch && sameCat && sameCourse && sameSession && sameLang && sameSort && samePage) {
        return;
      }
    }

    setSearchInput(urlSearch);
    setSearch(urlSearch);

    setSelectedCat(urlCategory);
    setSelectedCourse(urlCourse);
    setSelectedSession(urlSession);
    setSelectedLang(urlLang);

    setSort((urlSort as SortKey) || "latest");

    setMeta((m) => ({ ...m, page: urlPage || 1 }));
  }, [sp]);

  function syncUrl(partial: {
    search?: string;
    category?: string[];
    course?: string[];
    session?: string[];
    language?: string[];
    sort?: SortKey;
    page?: number;
  }) {
    const params = new URLSearchParams(sp.toString());

    const nextSearch = partial.search !== undefined ? partial.search : safeStr(params.get("search"));
    const nextCat = partial.category !== undefined ? partial.category : parseCsvParam(safeStr(params.get("category")));
    const nextCourse = partial.course !== undefined ? partial.course : parseCsvParam(safeStr(params.get("course")));
    const nextSession =
      partial.session !== undefined ? partial.session : parseCsvParam(safeStr(params.get("session")));
    const nextLang =
      partial.language !== undefined ? partial.language : parseCsvParam(safeStr(params.get("language")));
    const nextSort = partial.sort !== undefined ? partial.sort : ((safeStr(params.get("sort")) as SortKey) || "latest");
    const nextPage = partial.page !== undefined ? partial.page : Number(params.get("page") || "1") || 1;

    if (nextSearch) params.set("search", nextSearch);
    else params.delete("search");

    if (nextCat.length) params.set("category", nextCat.join(","));
    else params.delete("category");

    if (nextCourse.length) params.set("course", nextCourse.join(","));
    else params.delete("course");

    if (nextSession.length) params.set("session", nextSession.join(","));
    else params.delete("session");

    if (nextLang.length) params.set("language", nextLang.join(","));
    else params.delete("language");

    if (nextSort && nextSort !== "latest") params.set("sort", nextSort);
    else params.delete("sort");

    if (nextPage && nextPage > 1) params.set("page", String(nextPage));
    else params.delete("page");

    router.replace(`/products${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
  }

  const toggleInArray = (arr: string[], v: string) => {
    const x = safeStr(v);
    if (!x) return arr;
    return arr.includes(x) ? arr.filter((k) => k !== x) : [...arr, x];
  };

  const clearAll = () => {
    setSearchInput("");
    setSearch("");
    setSelectedCat([]);
    setSelectedCourse([]);
    setSelectedSession([]);
    setSelectedLang([]);
    setSuggestions([]);
    setShowSuggest(false);
    setSort("latest");
    syncUrl({ search: "", category: [], course: [], session: [], language: [], sort: "latest", page: 1 });
  };

  const activeFiltersCount =
    (selectedCat.length ? 1 : 0) +
    (selectedCourse.length ? 1 : 0) +
    (selectedSession.length ? 1 : 0) +
    (selectedLang.length ? 1 : 0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(meta.page || 1));
        params.set("limit", "12");
        params.set("includeFacets", "0");

        const apiSort = sort === "latest" ? "latest" : sort === "price_asc" ? "price_asc" : "price_desc";
        params.set("sort", apiSort);

        if (selectedCat.length) params.set("category", selectedCat.join(","));
        if (selectedCourse.length) params.set("course", selectedCourse.join(","));
        if (selectedSession.length) params.set("session", selectedSession.join(","));
        if (selectedLang.length) params.set("language", selectedLang.join(","));

        if (search) {
          const { cleaned } = normalizeQuery(search);
          const { variants } = extractSubjectCodeVariants(search);
          const extra = variants.slice(0, 6).join(" ");
          const finalSearch = extra ? `${cleaned} ${extra}` : cleaned;
          params.set("search", finalSearch);
        }

        const res = await fetch(`/api/products?${params.toString()}`, { cache: "no-store" });
        const data: ApiProductsResponse = await res.json();
        if (cancelled) return;

        const list = Array.isArray(data?.products) ? data.products : [];
        setItems(list);

        for (const p of list) {
          const c = safeStr(p.category);
          if (c) cacheRef.current.categories.add(c);

          for (const cc of safeArr<string>(p.courseCodes)) {
            const k = toUpper(cc);
            if (k) cacheRef.current.courses.add(k);
          }

          const s = safeStr(p.session);
          if (s) cacheRef.current.sessions.add(s);

          const l = safeStr(p.language);
          if (l) cacheRef.current.languages.add(l);
        }

        selectedCat.forEach((x) => cacheRef.current.categories.add(x));
        selectedCourse.forEach((x) => cacheRef.current.courses.add(toUpper(x)));
        selectedSession.forEach((x) => cacheRef.current.sessions.add(x));
        selectedLang.forEach((x) => cacheRef.current.languages.add(x));

        const m = data?.pagination || data?.meta || {};
        setMeta((old) => ({
          ...old,
          total: Number(m.total || list.length || 0),
          totalPages: Number(m.totalPages || 1),
          limit: 12,
          page: Number(m.page || old.page || 1),
        }));
      } catch {
        if (!cancelled) {
          setItems([]);
          setMeta((m) => ({ ...m, total: 0, totalPages: 1, limit: 12 }));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    selectedCat.join(","),
    selectedCourse.join(","),
    selectedSession.join(","),
    selectedLang.join(","),
    search,
    sort,
    meta.page,
  ]);

  useEffect(() => {
    if (!searchInput.trim()) {
      setSuggestions([]);
      setShowSuggest(false);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      setSuggestLoading(true);
      try {
        const q = searchInput.trim();
        const { cleaned } = normalizeQuery(q);
        const { variants } = extractSubjectCodeVariants(q);

        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("limit", "8");
        params.set("sort", "latest");
        params.set("includeFacets", "0");

        if (selectedCat.length) params.set("category", selectedCat.join(","));
        if (selectedCourse.length) params.set("course", selectedCourse.join(","));
        if (selectedSession.length) params.set("session", selectedSession.join(","));
        if (selectedLang.length) params.set("language", selectedLang.join(","));

        const extra = variants.slice(0, 6).join(" ");
        params.set("search", extra ? `${cleaned} ${extra}` : cleaned);

        const res = await fetch(`/api/products?${params.toString()}`, { cache: "no-store" });
        const data: ApiProductsResponse = await res.json();
        if (cancelled) return;

        const list = Array.isArray(data?.products) ? data.products : [];
        setSuggestions(list);
        setShowSuggest(true);

        for (const p of list) {
          const c = safeStr(p.category);
          if (c) cacheRef.current.categories.add(c);
          for (const cc of safeArr<string>(p.courseCodes)) {
            const k = toUpper(cc);
            if (k) cacheRef.current.courses.add(k);
          }
          const s = safeStr(p.session);
          if (s) cacheRef.current.sessions.add(s);
          const l = safeStr(p.language);
          if (l) cacheRef.current.languages.add(l);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
          setShowSuggest(true);
        }
      } finally {
        if (!cancelled) setSuggestLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [searchInput, selectedCat.join(","), selectedCourse.join(","), selectedSession.join(","), selectedLang.join(",")]);

  const countText = useMemo(() => {
    if (loading) return "Loading…";
    if (meta.total) return `${meta.total} results`;
    return `${items.length} results`;
  }, [loading, meta.total, items.length]);

  const similarCodes = useMemo(() => {
    if (loading) return [];
    if (items.length > 0) return [];
    if (!search) return [];
    const { variants } = extractSubjectCodeVariants(search);
    return variants.slice(0, 8);
  }, [items.length, loading, search]);

  const optionSets = useMemo(() => {
    const cats = uniq([
      ...defaultCategoryFallback,
      ...Array.from(cacheRef.current.categories),
      ...selectedCat,
    ]).filter(Boolean);

    const sessions = uniq([
      ...defaultSessionFallback,
      ...Array.from(cacheRef.current.sessions),
      ...selectedSession,
    ]).filter(Boolean);

    const langs = uniq([
      ...defaultLanguageFallback,
      ...Array.from(cacheRef.current.languages),
      ...selectedLang,
    ]).filter(Boolean);

    const courses = uniq([
      ...Array.from(cacheRef.current.courses),
      ...selectedCourse.map((x) => toUpper(x)),
    ])
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    cats.sort((a, b) => a.localeCompare(b));
    sessions.sort((a, b) => b.localeCompare(a));
    langs.sort((a, b) => a.localeCompare(b));

    return { cats, sessions, langs, courses };
  }, [selectedCat, selectedSession, selectedLang, selectedCourse]);

  const SelectedChipsRow = ({ inDrawer = false }: { inDrawer?: boolean }) => {
    const hasAny = !!(search || activeFiltersCount);
    return (
      <div className={`${inDrawer ? "mt-3" : "mt-0"} ${hasAny ? "" : "opacity-60"} transition`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs font-extrabold text-slate-900">Selected</div>
          {hasAny ? (
            <button
              onClick={clearAll}
              className="text-[11px] font-extrabold text-slate-700 hover:text-blue-700"
              type="button"
            >
              Clear All
            </button>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {search ? (
            <SelectedChip
              text={`Search: ${search}`}
              tone="gray"
              onRemove={() => {
                setSearchInput("");
                setShowSuggest(false);
                syncUrl({ search: "", page: 1 });
              }}
            />
          ) : null}

          {selectedCat.map((v) => (
            <SelectedChip
              key={`cat:${v}`}
              text={`Category: ${v}`}
              onRemove={() => {
                const next = selectedCat.filter((x) => x !== v);
                setSelectedCat(next);
                syncUrl({ category: next, page: 1 });
              }}
            />
          ))}

          {selectedSession.map((v) => (
            <SelectedChip
              key={`sess:${v}`}
              text={`Session: ${v}`}
              tone="gray"
              onRemove={() => {
                const next = selectedSession.filter((x) => x !== v);
                setSelectedSession(next);
                syncUrl({ session: next, page: 1 });
              }}
            />
          ))}

          {selectedLang.map((v) => (
            <SelectedChip
              key={`lang:${v}`}
              text={`Medium: ${v}`}
              tone="gray"
              onRemove={() => {
                const next = selectedLang.filter((x) => x !== v);
                setSelectedLang(next);
                syncUrl({ language: next, page: 1 });
              }}
            />
          ))}

          {selectedCourse.map((v) => (
            <SelectedChip
              key={`course:${v}`}
              text={`Course: ${v}`}
              tone="gray"
              onRemove={() => {
                const next = selectedCourse.filter((x) => x !== v);
                setSelectedCourse(next);
                syncUrl({ course: next, page: 1 });
              }}
            />
          ))}

          {!hasAny ? <div className="text-[11px] font-semibold text-slate-600">No filters selected yet.</div> : null}
        </div>
      </div>
    );
  };

  const FiltersPanel = ({ compact = false }: { compact?: boolean }) => (
    <div
      className={`${
        compact ? "" : "mt-4"
      } rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-50/80 shadow-[0_12px_40px_rgba(15,23,42,0.06)] overflow-hidden`}
    >
      <div className="border-b border-slate-200/70 bg-gradient-to-r from-slate-50 via-blue-50/60 to-cyan-50/60 px-4 md:px-5 py-4">
        <div className="flex items-start md:items-center justify-between gap-3 flex-col md:flex-row">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-lg flex items-center justify-center flex-shrink-0">
              <SlidersHorizontal size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-[15px] font-extrabold text-slate-900">Smart Filters</div>
                {activeFiltersCount ? (
                  <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-extrabold text-blue-700">
                    {activeFiltersCount} active
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-500">
                    Optional
                  </span>
                )}
              </div>
              <div className="mt-1 text-[12px] md:text-[13px] font-semibold text-slate-600">
                Category, session, medium aur course code combine karke exact product dhoondhiye.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
          <MultiSelectDropdown
            label="Categories"
            items={optionSets.cats}
            selected={selectedCat}
            onToggle={(v) => {
              const next = toggleInArray(selectedCat, v);
              setSelectedCat(next);
              syncUrl({ category: next, page: 1 });
            }}
            onClear={() => {
              setSelectedCat([]);
              syncUrl({ category: [], page: 1 });
            }}
            placeholder="Select categories"
            searchable
          />

          <MultiSelectDropdown
            label="Session"
            items={optionSets.sessions}
            selected={selectedSession}
            onToggle={(v) => {
              const next = toggleInArray(selectedSession, v);
              setSelectedSession(next);
              syncUrl({ session: next, page: 1 });
            }}
            onClear={() => {
              setSelectedSession([]);
              syncUrl({ session: [], page: 1 });
            }}
            placeholder="Select sessions"
            searchable
          />

          <MultiSelectDropdown
            label="Medium"
            items={optionSets.langs}
            selected={selectedLang}
            onToggle={(v) => {
              const next = toggleInArray(selectedLang, v);
              setSelectedLang(next);
              syncUrl({ language: next, page: 1 });
            }}
            onClear={() => {
              setSelectedLang([]);
              syncUrl({ language: [], page: 1 });
            }}
            placeholder="Select medium"
            searchable
          />

          <MultiSelectDropdown
            label="Course"
            items={optionSets.courses.slice(0, 8000)}
            selected={selectedCourse.map((x) => toUpper(x))}
            onToggle={(v) => {
              const next = toggleInArray(selectedCourse.map((x) => toUpper(x)), toUpper(v));
              setSelectedCourse(next);
              syncUrl({ course: next, page: 1 });
            }}
            onClear={() => {
              setSelectedCourse([]);
              syncUrl({ course: [], page: 1 });
            }}
            placeholder='Type "A" / "T" or search full code'
            searchable
            alphaJump
            maxRender={250}
          />
        </div>

        {!compact ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-3">
            <SelectedChipsRow />
          </div>
        ) : null}
      </div>
    </div>
  );

  const SortSelect = () => (
    <div className="flex items-center gap-2">
      <div className="text-xs font-extrabold text-slate-700">Sort by</div>
      <select
        value={sort}
        onChange={(e) => {
          const v = (e.target.value as SortKey) || "latest";
          setSort(v);
          syncUrl({ sort: v, page: 1 });
        }}
        className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-extrabold text-slate-900 outline-none hover:border-slate-300 shadow-sm"
      >
        <option value="latest">Newest First</option>
        <option value="price_asc">Price: Low to High</option>
        <option value="price_desc">Price: High to Low</option>
      </select>
    </div>
  );

  return (
    <main className="min-h-screen font-sans text-slate-800 bg-white">
      <style>{`
        @keyframes floaty { 0%{transform:translate3d(0,0,0)} 50%{transform:translate3d(0,-10px,0)} 100%{transform:translate3d(0,0,0)} }
        @keyframes shimmer { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        .isp-grid { background-image: radial-gradient(circle at 1px 1px, rgba(15,23,42,0.07) 1px, transparent 0); background-size: 22px 22px; }
        .isp-floaty { animation: floaty 6s ease-in-out infinite; }
        .isp-shimmer { background-size:200% 200%; animation: shimmer 10s ease-in-out infinite; }

        .products-results-grid > .hardcopy-product-card-wrap :is(
          .absolute.top-2.left-2,
          .absolute.top-2.right-2,
          .absolute.top-3.left-3,
          .absolute.top-3.right-3,
          .absolute.left-2.top-2,
          .absolute.right-2.top-2,
          .absolute.left-3.top-3,
          .absolute.right-3.top-3
        ) {
          display: none !important;
        }
      `}</style>

      <TopBar />
      <Navbar />

      <div className="bg-white border-b border-gray-100">
        <div className="max-w-[1600px] mx-auto px-4 py-3 text-[13px] text-gray-500 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <Link href="/" className="hover:text-blue-700 font-semibold">
            Home
          </Link>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="text-blue-700 font-extrabold">All Products</span>
        </div>
      </div>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-[#f7f9ff]" />
        <div className="absolute inset-0 isp-grid opacity-60" />
        <div className="absolute -top-28 -left-28 h-[320px] w-[320px] rounded-full blur-3xl opacity-25 bg-gradient-to-br from-blue-500 via-indigo-500 to-cyan-400 isp-floaty" />
        <div className="absolute -bottom-36 -right-24 h-[380px] w-[380px] rounded-full blur-3xl opacity-20 bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-400 isp-floaty" />

        <div className="relative max-w-[1600px] mx-auto px-4 py-7 md:py-10">
          <div className="flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-10">
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-extrabold text-blue-700">
                <Sparkles size={14} /> Smart Search + Filters (Course/Session/Medium/Category)
              </div>

              <h1 className="mt-3 text-[28px] leading-tight md:text-5xl font-extrabold text-slate-900">
                All IGNOU Products
              </h1>

              <p className="mt-2 text-sm md:text-lg font-medium text-slate-600 max-w-3xl">
                Explore updated IGNOU solved assignments, study material, PYQ, guess papers, projects and notes—use the
                search and filters below to find the exact match.
              </p>
            </div>

            <div className="hidden lg:block w-[420px]">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-sm p-4">
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="text-green-600" size={18} />
                    <div className="text-xs">
                      <div className="font-extrabold text-slate-900">Verified Content</div>
                      <div className="font-bold text-gray-500">Quality checked</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-sm p-4">
                  <div className="flex items-center gap-2">
                    <Zap className="text-blue-600" size={18} />
                    <div className="text-xs">
                      <div className="font-extrabold text-slate-900">Fast Support</div>
                      <div className="font-bold text-gray-500">Quick help</div>
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
                  <div className="text-sm font-extrabold">Result Summary</div>
                  <div className="mt-1 text-xs font-bold opacity-90">{countText}</div>
                </div>
                <div className="p-5 text-xs font-semibold text-slate-600 leading-relaxed">
                  Use search + filters together for fastest results. Course dropdown supports A/T… quick filtering.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#f8fbff_0%,#f5f8ff_48%,#ffffff_100%)] py-6 md:py-8 border-t border-slate-100">
        <div className="max-w-[1600px] mx-auto px-4">
          <div className="relative rounded-[30px] border border-slate-200/80 bg-white/90 backdrop-blur shadow-[0_20px_60px_rgba(15,23,42,0.07)] overflow-hidden">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_28%),radial-gradient(circle_at_left,rgba(6,182,212,0.08),transparent_22%)]" />

            <div className="relative p-4 md:p-5 lg:p-6">
              <div className="flex items-start lg:items-center justify-between gap-4 flex-col lg:flex-row">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-extrabold text-blue-700">
                    <Sparkles size={13} />
                    Smart Product Discovery
                  </div>

                  <div className="mt-3 flex items-center gap-3 flex-wrap">
                    <h2 className="text-[20px] md:text-[24px] font-extrabold tracking-tight text-slate-900">
                      Browse All Products
                    </h2>
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-extrabold text-slate-700 shadow-sm">
                      {countText}
                    </span>
                  </div>

                  <p className="mt-2 text-sm md:text-[15px] font-medium text-slate-600 max-w-3xl">
                    Search by code, title, session aur medium. Filters ko mix karke exact result jaldi paaiye.
                  </p>
                </div>

                <div className="w-full lg:w-auto flex items-center gap-3 justify-between lg:justify-end">
                  <div className="hidden md:flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-extrabold text-emerald-700">
                    <BadgeCheck size={15} />
                    Updated products
                  </div>
                  <SortSelect />
                </div>
              </div>

              <div ref={suggestBoxRef} className="mt-5 relative">
                <div className="group flex items-center gap-3 px-4 md:px-5 py-3.5 md:py-4 rounded-[24px] border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)] hover:border-blue-300 focus-within:border-blue-300 focus-within:shadow-[0_10px_30px_rgba(59,130,246,0.10)] focus-within:ring-0 transition-all duration-300">
                  <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-md flex items-center justify-center flex-shrink-0">
                    <Search size={18} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <input
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onFocus={() => searchInput.trim() && setShowSuggest(true)}
                      placeholder='Search example: "MPA036 2025-2026 Hindi solved assignment"'
                      className="w-full bg-transparent outline-none border-0 ring-0 focus:outline-none focus:ring-0 text-sm md:text-[17px] font-semibold text-slate-800 placeholder:text-slate-400"
                    />
                  </div>

                  {searchInput ? (
                    <button
                      onClick={() => {
                        setSearchInput("");
                        setShowSuggest(false);
                      }}
                      className="h-10 w-10 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 transition"
                      aria-label="Clear search"
                      type="button"
                    >
                      <X size={18} />
                    </button>
                  ) : null}

                  <button
                    onClick={() => setIsFilterOpen(true)}
                    className="lg:hidden inline-flex items-center justify-center h-11 px-4 rounded-2xl bg-slate-900 text-white font-extrabold text-xs shadow-md"
                    type="button"
                  >
                    <Filter size={16} className="mr-2" /> Filters
                  </button>
                </div>

                {showSuggest ? (
                  <div className="absolute z-40 mt-2 w-full rounded-[24px] border border-slate-200 bg-white shadow-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                      <div className="text-xs font-extrabold text-slate-900">
                        {suggestLoading ? "Searching…" : suggestions.length ? "Top matches" : "No quick matches"}
                      </div>
                      <div className="mt-1 text-[11px] font-semibold text-slate-600">
                        Press Enter or click a product to open it.
                      </div>
                    </div>

                    {suggestions.length ? (
                      <div className="max-h-[360px] overflow-auto">
                        {suggestions.map((p) => (
                          <Link
                            key={p.slug}
                            href={`/${(p.category || "products").toString().toLowerCase().includes("solved") ? "solved-assignments" : "products"}/${p.slug}`}
                            className="block px-4 py-3 hover:bg-slate-50 border-b border-slate-50"
                            onClick={() => setShowSuggest(false)}
                          >
                            <div className="text-sm font-extrabold text-slate-900 line-clamp-1">{p.title}</div>
                            <div className="mt-1 text-[11px] font-bold text-slate-600">
                              {safeStr(p.category) ? safeStr(p.category) : "Product"}
                              {safeStr(p.session) ? ` • ${safeStr(p.session)}` : ""}
                              {safeStr(p.language) ? ` • ${safeStr(p.language)}` : ""}
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4">
                        <div className="text-sm font-extrabold text-slate-900">Try these patterns</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {extractSubjectCodeVariants(searchInput).variants.slice(0, 8).map((v) => (
                            <button
                              key={v}
                              onClick={() => {
                                setSearchInput(v);
                                setShowSuggest(false);
                              }}
                              className="rounded-full border border-slate-200 hover:bg-slate-50 px-3 py-1 text-[11px] font-extrabold text-slate-700"
                              type="button"
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="hidden lg:block mt-4">
                <FiltersPanel />
              </div>

              <div className="lg:hidden mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
                Use the <span className="font-extrabold text-slate-900">Filters</span> button to open search + filters together.
              </div>
            </div>
          </div>

          <div className="mt-5">
            {loading ? (
              <ProductsGridSkeleton />
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
                <div className="text-lg font-extrabold text-slate-900">No products found</div>
                <div className="mt-1 text-sm font-semibold text-slate-600">
                  Try changing filters or search with course/subject code.
                </div>

                {similarCodes.length ? (
                  <div className="mt-4">
                    <div className="text-sm font-extrabold text-slate-900">Try these code patterns</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {similarCodes.map((v) => (
                        <button
                          key={v}
                          onClick={() => setSearchInput(v)}
                          className="rounded-full border border-gray-200 hover:bg-gray-50 px-3 py-1 text-[11px] font-extrabold text-slate-700"
                          type="button"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="products-results-grid grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {items.map((p) => (
                  <div
                    key={p.slug}
                    className={isHardcopyCategory(p.category) ? "hardcopy-product-card-wrap" : ""}
                    data-product-category={safeStr(p.category)}
                  >
                    <ProductCard product={p as any} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {!loading && meta.totalPages > 1 ? (
            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                disabled={meta.page <= 1}
                onClick={() => {
                  const next = Math.max(1, meta.page - 1);
                  setMeta((m) => ({ ...m, page: next }));
                  syncUrl({ page: next });
                }}
                className={`px-4 py-2 rounded-xl border text-xs font-extrabold ${
                  meta.page <= 1
                    ? "border-gray-200 text-gray-400 bg-gray-100"
                    : "border-gray-200 bg-white hover:bg-gray-50 text-slate-800"
                }`}
                type="button"
              >
                Prev
              </button>

              <div className="text-xs font-extrabold text-slate-700">
                Page {meta.page} / {meta.totalPages}
              </div>

              <button
                disabled={meta.page >= meta.totalPages}
                onClick={() => {
                  const next = Math.min(meta.totalPages, meta.page + 1);
                  setMeta((m) => ({ ...m, page: next }));
                  syncUrl({ page: next });
                }}
                className={`px-4 py-2 rounded-xl border text-xs font-extrabold ${
                  meta.page >= meta.totalPages
                    ? "border-gray-200 text-gray-400 bg-gray-100"
                    : "border-gray-200 bg-white hover:bg-gray-50 text-slate-800"
                }`}
                type="button"
              >
                Next
              </button>
            </div>
          ) : null}

          <div className="mt-10 rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
            <h2 className="text-lg md:text-xl font-extrabold text-slate-900">
              Find the right IGNOU material in seconds (Course • Session • Medium)
            </h2>
            <p className="mt-2 text-sm font-semibold text-slate-600 leading-relaxed">
              This page helps you discover IGNOU solved assignments, study notes, PYQ, guess papers and project material
              by applying multiple filters together. Use course codes, select the relevant session, and choose your
              medium to get the best match quickly.
            </p>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-gray-200 bg-slate-50 p-4">
                <div className="text-sm font-extrabold text-slate-900">Popular categories</div>
                <ul className="mt-2 text-sm font-semibold text-slate-700 list-disc pl-5 space-y-1">
                  <li>IGNOU Solved Assignments (Latest session wise)</li>
                  <li>Previous Year Question Papers (PYQ)</li>
                  <li>Guess Papers & Important Questions</li>
                  <li>Project / Synopsis / Viva material</li>
                  <li>Study Notes, eBooks & Unit-wise guides</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-slate-50 p-4">
                <div className="text-sm font-extrabold text-slate-900">How to search better</div>
                <ul className="mt-2 text-sm font-semibold text-slate-700 list-disc pl-5 space-y-1">
                  <li>Search using course or subject code (example: MPA-036, BEGS-183)</li>
                  <li>Select the latest session (example: 2025–2026)</li>
                  <li>Choose medium (Hindi / English / Urdu) for accurate results</li>
                  <li>Use multiple categories when you want combo-type results</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-gray-200 p-5">
              <div className="text-sm font-extrabold text-slate-900">FAQ</div>
              <div className="mt-3 space-y-4">
                <div>
                  <div className="text-sm font-extrabold text-slate-800">
                    Can I select multiple sessions or mediums together?
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-600">
                    Yes. This page supports multi-select for session and medium—use it when you want to compare or see
                    all available options.
                  </div>
                </div>
                <div>
                  <div className="text-sm font-extrabold text-slate-800">
                    I typed a code in a different format, will it still match?
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-600">
                    Yes. Search assists common code variations (like hyphen/space/leading zeros) to increase match
                    chances.
                  </div>
                </div>
                <div>
                  <div className="text-sm font-extrabold text-slate-800">What if no products are found?</div>
                  <div className="mt-1 text-sm font-semibold text-slate-600">
                    Try removing one filter, switching session/medium, or use the suggested code patterns shown on “No
                    results” screen.
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 text-[12px] font-semibold text-slate-500 leading-relaxed">
              Keywords: IGNOU solved assignments, IGNOU study material, IGNOU PYQ, IGNOU guess paper, IGNOU project
              guide, session wise assignment, medium wise material, course code wise search.
            </div>
          </div>
        </div>
      </section>

      {isFilterOpen ? (
        <div
          className="lg:hidden fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm"
          onClick={() => setIsFilterOpen(false)}
        />
      ) : null}
      <div
        className={`lg:hidden fixed top-0 left-0 z-[1000] h-full w-[90%] max-w-[440px] bg-white shadow-2xl transition-transform duration-300 ease-out ${
          isFilterOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="text-sm font-extrabold text-slate-900">Search & Filters</div>
          <button
            onClick={() => setIsFilterOpen(false)}
            className="h-9 w-9 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center"
            aria-label="Close"
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-gray-200 bg-white shadow-sm hover:border-slate-300">
            <Search size={18} className="text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder='Search: "MPA036 2025-2026 Hindi"'
              className="w-full outline-none text-sm font-semibold text-slate-800 placeholder:text-gray-400"
            />
            {searchInput ? (
              <button
                onClick={() => setSearchInput("")}
                className="h-9 w-9 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500"
                aria-label="Clear search"
                type="button"
              >
                <X size={18} />
              </button>
            ) : null}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm font-extrabold text-slate-900">Sort</div>
            <SortSelect />
          </div>

          <div className="mt-4">
            <FiltersPanel compact />
          </div>

          <SelectedChipsRow inDrawer />

          <button
            onClick={() => setIsFilterOpen(false)}
            className="mt-5 w-full h-11 rounded-2xl bg-slate-900 text-white font-extrabold text-sm"
            type="button"
          >
            Apply & Close
          </button>
        </div>
      </div>

      <Footer />
      <FloatingButtons />
    </main>
  );
}