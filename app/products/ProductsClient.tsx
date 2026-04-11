"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import TopBar from "@/components/TopBar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingButtons from "@/components/FloatingButtons";
import ProductCard from "@/components/ProductCard";
import { productHref } from "@/lib/productHref";

type ApiProductCard = {
  _id?: string;
  title: string;
  slug: string;
  category?: string;
  courseCodes?: string[];
  courseTitles?: string[];
  session?: string;
  language?: string;
  price: number;
  oldPrice?: number | null;
  images?: string[];
  thumbUrl?: string;
  quickUrl?: string;
  thumbnailUrl?: string;
  isDigital?: boolean;
  availability?: string;
  rawAvailability?: string;
  canPurchase?: boolean;
  deliverWithinMinutes?: number;
  onDemandNote?: string;
  rawDeliverWithinMinutes?: number;
  rawOnDemandNote?: string;
  onDemandTimingSource?: string;
  onDemandMatchedCourseCode?: string;
  onDemandMatchedRuleId?: string;
  onDemandMatchedRuleType?: string;
  subjectCode?: string;
  subjectTitle?: string;
  subjectTitleHi?: string;
  subjectTitleEn?: string;
  pdfUrl?: string;
  isActive?: boolean;
};

type Meta = {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
};

type ApiProductsResponse = {
  products: ApiProductCard[];
  pagination?: { total?: number; page?: number; totalPages?: number; limit?: number };
  meta?: { total?: number; page?: number; totalPages?: number; limit?: number };
  facets?: {
    courses?: string[];
    coursesDetailed?: Array<{ code?: string; title?: string }>;
    sessions?: string[];
    sessionsDetailed?: Array<{
      name?: string;
      slug?: string;
      categories?: string[];
      sortOrder?: number;
    }>;
    languages?: string[];
  };
};

type ApiCoursesResponse = {
  courses?: Array<{ code?: string; title?: string }>;
  meta?: { total?: number };
};

type ApiSessionsResponse = {
  sessions?: Array<{
    name?: string;
    slug?: string;
    categories?: string[];
    sortOrder?: number;
  }>;
  meta?: { total?: number };
};

type SortKey = "latest" | "price_asc" | "price_desc";

type DropdownItem = {
  value: string;
  label: string;
  searchText?: string;
};

type ProductsClientProps = {
  initialSearchParam?: string;
  initialCategoryParam?: string;
  initialCourseParam?: string;
  initialSessionParam?: string;
  initialLanguageParam?: string;
  initialSortParam?: string;
  initialPageParam?: string;
  initialProducts?: ApiProductCard[];
  initialMeta?: Meta | null;
  initialQueryKey?: string;
};

function safeStr(x: unknown) {
  return String(x ?? "").trim();
}

function safeArr<T = any>(x: unknown): T[] {
  return Array.isArray(x) ? (x as T[]) : [];
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

function sameStringArray(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function isHardcopyCategory(category?: string) {
  return (
    safeStr(category).toLowerCase() ===
    "handwritten hardcopy (delivery)".toLowerCase()
  );
}

function normalizeQuery(raw: string) {
  const s = safeStr(raw).toUpperCase();
  const cleaned = s.replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const compact = cleaned.replace(/\s+/g, "");
  return { cleaned, compact };
}

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

function buildProductsQueryKey(input: {
  selectedCat: string[];
  selectedCourse: string[];
  selectedSession: string[];
  selectedLang: string[];
  search: string;
  sort: SortKey;
  page: number;
}) {
  const params = new URLSearchParams();

  params.set("page", String(Math.max(1, Number(input.page || 1))));
  params.set("limit", "12");
  params.set("includeFacets", "0");

  const apiSort =
    input.sort === "latest"
      ? "latest"
      : input.sort === "price_asc"
        ? "price_asc"
        : "price_desc";

  params.set("sort", apiSort);

  if (input.selectedCat.length) params.set("category", input.selectedCat.join(","));
  if (input.selectedCourse.length) params.set("course", input.selectedCourse.join(","));
  if (input.selectedSession.length) params.set("session", input.selectedSession.join(","));
  if (input.selectedLang.length) params.set("language", input.selectedLang.join(","));

  if (input.search) {
    const { cleaned } = normalizeQuery(input.search);
    const { variants } = extractSubjectCodeVariants(input.search);
    const extra = variants.slice(0, 6).join(" ");
    const finalSearch = extra ? `${cleaned} ${extra}` : cleaned;
    params.set("search", finalSearch);
  }

  return params.toString();
}

function sortAlphaNumeric(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function sortLanguages(values: string[]) {
  const preferredOrder = [
    "English",
    "Hindi",
    "Urdu",
    "Sanskrit",
    "Bengali",
    "Punjabi",
    "Marathi",
    "Gujarati",
    "Tamil",
    "Telugu",
    "Kannada",
    "Malayalam",
    "Odia",
    "Assamese",
  ];

  const rank = new Map<string, number>();
  preferredOrder.forEach((v, i) => rank.set(v.toLowerCase(), i));

  return [...values].sort((a, b) => {
    const ra = rank.has(a.toLowerCase()) ? rank.get(a.toLowerCase())! : 999;
    const rb = rank.has(b.toLowerCase()) ? rank.get(b.toLowerCase())! : 999;
    if (ra !== rb) return ra - rb;
    return sortAlphaNumeric(a, b);
  });
}

function normalizeDropdownItems(items: DropdownItem[]) {
  const seen = new Set<string>();
  const out: DropdownItem[] = [];

  for (const item of items) {
    const value = safeStr(item.value);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push({
      value,
      label: safeStr(item.label) || value,
      searchText: safeStr(item.searchText) || `${safeStr(item.label)} ${value}`,
    });
  }

  return out;
}

function ProductsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm animate-pulse"
        >
          <div className="aspect-[3/4] bg-gray-200" />
          <div className="p-3">
            <div className="mb-2 h-3 w-20 rounded bg-gray-200" />
            <div className="mb-2 h-4 w-full rounded bg-gray-200" />
            <div className="mb-3 h-4 w-4/5 rounded bg-gray-200" />
            <div className="h-5 w-24 rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

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
  const [pos, setPos] = useState({ top: 0, left: 0, w: width });

  useEffect(() => {
    if (!open || !anchorEl || typeof window === "undefined") return;

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
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onRequestClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onRequestClose]);

  if (typeof window === "undefined" || !open || !anchorEl) return null;

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
  items: DropdownItem[];
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
    const t = window.setTimeout(() => searchRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [open]);

  const itemMap = useMemo(() => {
    const map = new Map<string, DropdownItem>();
    for (const item of items) {
      map.set(item.value, item);
    }
    return map;
  }, [items]);

  const selectedPreview = useMemo(() => {
    if (!selected.length) return "";
    const first = selected
      .slice(0, 2)
      .map((v) => itemMap.get(v)?.label || v)
      .join(", ");
    return selected.length <= 2 ? first : `${first} +${selected.length - 2}`;
  }, [selected, itemMap]);

  const filtered = useMemo(() => {
    const all = items || [];
    if (!searchable || !q.trim()) return all;

    const qq = toUpper(q.trim());
    if (alphaJump && isAlpha1(qq)) {
      return all.filter((x) => toUpper(x.value).startsWith(qq));
    }

    return all.filter((x) => {
      const hay = toUpper(`${x.label} ${x.searchText || ""} ${x.value}`);
      return hay.includes(qq);
    });
  }, [items, q, searchable, alphaJump]);

  const renderList = useMemo(() => filtered.slice(0, maxRender), [filtered, maxRender]);

  const alphaLetters = useMemo(() => {
    if (!alphaJump) return [];
    const set = new Set<string>();

    for (const it of items) {
      const u = toUpper(it.value);
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
        className={`flex h-[58px] w-full items-center justify-between gap-3 rounded-[22px] border bg-white px-4 transition-all duration-200 ${
          open
            ? "border-blue-300 shadow-[0_0_0_3px_rgba(59,130,246,0.08)]"
            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
        }`}
        type="button"
      >
        <div className="min-w-0 text-left">
          <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
            {label}
          </div>
          <div className="mt-0.5 truncate text-[12px] font-bold text-slate-800">
            {selected.length
              ? `${selected.length} selected • ${selectedPreview}`
              : placeholder || "Select"}
          </div>
        </div>

        <ChevronDown
          size={17}
          className={`flex-shrink-0 text-slate-500 transition ${
            open ? "rotate-180 text-blue-700" : ""
          }`}
        />
      </button>

      <PortalDropdown
        open={open}
        anchorEl={anchorRef.current}
        width={390}
        onRequestClose={() => setOpen(false)}
      >
        <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/60 px-4 py-3">
            <div className="text-xs font-extrabold text-slate-900">
              {label} (multi-select)
            </div>

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
            <div className="border-b border-slate-100 p-3">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 hover:border-slate-300">
                <Search size={16} className="text-slate-400" />
                <input
                  ref={searchRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={
                    alphaJump
                      ? 'Type "A" / "T" for codes, or search full code'
                      : "Search options"
                  }
                  className="w-full text-xs font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                />
                {q ? (
                  <button
                    onClick={() => setQ("")}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
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
                      className={`h-7 rounded-lg border px-2 text-[11px] font-extrabold transition ${
                        toUpper(q) === ch
                          ? "border-blue-600 bg-blue-50 text-blue-800"
                          : "border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                      type="button"
                    >
                      {ch}
                    </button>
                  ))}

                  <button
                    onClick={() => setQ("")}
                    className="h-7 rounded-lg border border-slate-200 px-3 text-[11px] font-extrabold text-slate-700 hover:bg-slate-50"
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
              renderList.map((item) => {
                const active = selected.includes(item.value);
                return (
                  <button
                    key={item.value}
                    onClick={() => onToggle(item.value)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs font-extrabold transition ${
                      active
                        ? "bg-blue-50 text-blue-800"
                        : "text-slate-800 hover:bg-slate-50"
                    }`}
                    type="button"
                    title={item.label}
                  >
                    <span className="truncate">{item.label}</span>
                    {active ? <Check size={16} className="text-blue-700" /> : null}
                  </button>
                );
              })
            ) : (
              <div className="p-3 text-xs font-semibold text-slate-600">
                No options available right now.
              </div>
            )}
          </div>
        </div>
      </PortalDropdown>
    </div>
  );
}

type SearchBoxProps = {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
  onApply: () => void;
  showSuggest: boolean;
  setShowSuggest: (v: boolean) => void;
  suggestLoading: boolean;
  suggestions: ApiProductCard[];
  size?: "large" | "medium";
};

function SearchBox({
  value,
  onChange,
  onClear,
  onApply,
  showSuggest,
  setShowSuggest,
  suggestLoading,
  suggestions,
  size = "large",
}: SearchBoxProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const isLarge = size === "large";

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setShowSuggest(false);
      }
    };

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [setShowSuggest]);

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className={`flex items-center gap-3 rounded-[24px] border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 ${
          isLarge ? "px-4 py-4 md:px-5 md:py-5" : "px-3 py-3"
        }`}
      >
        <Search
          size={isLarge ? 22 : 18}
          className="flex-shrink-0 text-slate-400"
        />

        <input
          value={value}
          onFocus={() => {
            if (value.trim()) setShowSuggest(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onApply();
            }
          }}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggest(true);
          }}
          placeholder="Search by subject code, title, or course code"
          className={`w-full bg-transparent font-semibold text-slate-900 outline-none placeholder:text-slate-400 ${
            isLarge ? "text-base md:text-lg" : "text-sm"
          }`}
        />

        {value ? (
          <button
            onClick={onClear}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
            type="button"
            aria-label="Clear search"
          >
            <X size={18} />
          </button>
        ) : null}

        <button
          onClick={onApply}
          className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-blue-700"
          type="button"
        >
          Search
        </button>
      </div>

      {showSuggest ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[80] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
            {suggestLoading ? "Searching…" : "Suggestions"}
          </div>

          <div className="max-h-[340px] overflow-auto">
            {suggestLoading ? (
              <div className="p-4 text-sm font-semibold text-slate-600">
                Loading suggestions…
              </div>
            ) : suggestions.length ? (
              suggestions.map((p) => {
                const href = productHref({
                  slug: safeStr(p.slug),
                  category: safeStr(p.category),
                });

                return (
                  <Link
                    key={`${p.slug}-${p.category || "product"}`}
                    href={href}
                    onClick={() => setShowSuggest(false)}
                    className="block border-b border-slate-100 px-4 py-3 transition last:border-b-0 hover:bg-slate-50"
                  >
                    <div className="text-sm font-extrabold text-slate-900">
                      {safeStr(p.title) || "Untitled Product"}
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-slate-500">
                      {[safeStr(p.category), safeStr(p.session), safeStr(p.language)]
                        .filter(Boolean)
                        .join(" • ")}
                    </div>
                  </Link>
                );
              })
            ) : value.trim() ? (
              <div className="p-4 text-sm font-semibold text-slate-600">
                No matching suggestions found.
              </div>
            ) : (
              <div className="p-4 text-sm font-semibold text-slate-600">
                Type something to search.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ActiveChips({
  appliedSearch,
  activeFiltersCount,
  selectedCat,
  selectedSession,
  selectedLang,
  selectedCourse,
  onClearAll,
  onRemoveSearch,
  onRemoveCat,
  onRemoveSession,
  onRemoveLang,
  onRemoveCourse,
}: {
  appliedSearch: string;
  activeFiltersCount: number;
  selectedCat: string[];
  selectedSession: string[];
  selectedLang: string[];
  selectedCourse: string[];
  onClearAll: () => void;
  onRemoveSearch: () => void;
  onRemoveCat: (v: string) => void;
  onRemoveSession: (v: string) => void;
  onRemoveLang: (v: string) => void;
  onRemoveCourse: (v: string) => void;
}) {
  const hasAny = !!(appliedSearch || activeFiltersCount);

  return (
    <div className={`${hasAny ? "" : "opacity-60"} transition`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs font-extrabold text-slate-900">Selected</div>
        {hasAny ? (
          <button
            onClick={onClearAll}
            className="text-[11px] font-extrabold text-slate-700 hover:text-blue-700"
            type="button"
          >
            Clear All
          </button>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {appliedSearch ? (
          <button
            onClick={onRemoveSearch}
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-extrabold text-slate-700 transition hover:shadow-sm"
            type="button"
          >
            <span className="max-w-[220px] truncate">{`Search: ${appliedSearch}`}</span>
            <span className="text-slate-400">×</span>
          </button>
        ) : null}

        {selectedCat.map((v) => (
          <button
            key={`cat:${v}`}
            onClick={() => onRemoveCat(v)}
            className="flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-extrabold text-blue-800 transition hover:shadow-sm"
            type="button"
          >
            <span className="max-w-[220px] truncate">{`Category: ${v}`}</span>
            <span className="text-slate-400">×</span>
          </button>
        ))}

        {selectedSession.map((v) => (
          <button
            key={`sess:${v}`}
            onClick={() => onRemoveSession(v)}
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-extrabold text-slate-700 transition hover:shadow-sm"
            type="button"
          >
            <span className="max-w-[220px] truncate">{`Session: ${v}`}</span>
            <span className="text-slate-400">×</span>
          </button>
        ))}

        {selectedLang.map((v) => (
          <button
            key={`lang:${v}`}
            onClick={() => onRemoveLang(v)}
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-extrabold text-slate-700 transition hover:shadow-sm"
            type="button"
          >
            <span className="max-w-[220px] truncate">{`Medium: ${v}`}</span>
            <span className="text-slate-400">×</span>
          </button>
        ))}

        {selectedCourse.map((v) => (
          <button
            key={`course:${v}`}
            onClick={() => onRemoveCourse(v)}
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-extrabold text-slate-700 transition hover:shadow-sm"
            type="button"
          >
            <span className="max-w-[220px] truncate">{`Course: ${v}`}</span>
            <span className="text-slate-400">×</span>
          </button>
        ))}

        {!hasAny ? (
          <div className="text-[11px] font-semibold text-slate-600">
            No filters selected yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}

type FiltersPanelProps = {
  showSearch?: boolean;
  activeFiltersCount: number;
  optionSets: {
    cats: DropdownItem[];
    sessions: DropdownItem[];
    langs: DropdownItem[];
    courses: DropdownItem[];
  };
  searchInput: string;
  onSearchInputChange: (v: string) => void;
  onSearchClear: () => void;
  onSearchApply: () => void;
  showSuggest: boolean;
  setShowSuggest: (v: boolean) => void;
  suggestLoading: boolean;
  suggestions: ApiProductCard[];
  selectedCat: string[];
  selectedSession: string[];
  selectedLang: string[];
  selectedCourse: string[];
  setSelectedCat: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedSession: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedLang: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedCourse: React.Dispatch<React.SetStateAction<string[]>>;
  appliedSearch: string;
  onClearAll: () => void;
  syncUrl: (partial: {
    search?: string;
    category?: string[];
    course?: string[];
    session?: string[];
    language?: string[];
    sort?: SortKey;
    page?: number;
  }) => void;
};

function FiltersPanel({
  showSearch = true,
  activeFiltersCount,
  optionSets,
  searchInput,
  onSearchInputChange,
  onSearchClear,
  onSearchApply,
  showSuggest,
  setShowSuggest,
  suggestLoading,
  suggestions,
  selectedCat,
  selectedSession,
  selectedLang,
  selectedCourse,
  setSelectedCat,
  setSelectedSession,
  setSelectedLang,
  setSelectedCourse,
  appliedSearch,
  onClearAll,
  syncUrl,
}: FiltersPanelProps) {
  const toggleInArray = (arr: string[], v: string) => {
    const x = safeStr(v);
    if (!x) return arr;
    return arr.includes(x) ? arr.filter((k) => k !== x) : [...arr, x];
  };

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-50/80 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
      <div className="border-b border-slate-200/70 bg-gradient-to-r from-slate-50 via-blue-50/60 to-cyan-50/60 px-4 py-4 md:px-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-lg">
              <SlidersHorizontal size={18} />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[15px] font-extrabold text-slate-900">
                  Search & Filters
                </div>
                {activeFiltersCount ? (
                  <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-extrabold text-blue-700">
                    {activeFiltersCount} active
                  </span>
                ) : null}
              </div>

              <div className="mt-1 text-[12px] font-semibold text-slate-600 md:text-[13px]">
                Session, course, medium aur category ko combine karke exact result find kijiye.
              </div>
            </div>
          </div>

          {showSearch ? (
            <SearchBox
              value={searchInput}
              onChange={onSearchInputChange}
              onClear={onSearchClear}
              onApply={onSearchApply}
              showSuggest={showSuggest}
              setShowSuggest={setShowSuggest}
              suggestLoading={suggestLoading}
              suggestions={suggestions}
              size="large"
            />
          ) : null}
        </div>
      </div>

      <div className="p-4 md:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 md:gap-4">
          <MultiSelectDropdown
            label="Category"
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
            placeholder="Select category"
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
            placeholder="Select session"
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
            items={optionSets.courses}
            selected={selectedCourse.map((x) => toUpper(x))}
            onToggle={(v) => {
              const next = toggleInArray(
                selectedCourse.map((x) => toUpper(x)),
                toUpper(v)
              );
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

        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-3">
          <ActiveChips
            appliedSearch={appliedSearch}
            activeFiltersCount={activeFiltersCount}
            selectedCat={selectedCat}
            selectedSession={selectedSession}
            selectedLang={selectedLang}
            selectedCourse={selectedCourse}
            onClearAll={onClearAll}
            onRemoveSearch={() => syncUrl({ search: "", page: 1 })}
            onRemoveCat={(v) => {
              const next = selectedCat.filter((x) => x !== v);
              setSelectedCat(next);
              syncUrl({ category: next, page: 1 });
            }}
            onRemoveSession={(v) => {
              const next = selectedSession.filter((x) => x !== v);
              setSelectedSession(next);
              syncUrl({ session: next, page: 1 });
            }}
            onRemoveLang={(v) => {
              const next = selectedLang.filter((x) => x !== v);
              setSelectedLang(next);
              syncUrl({ language: next, page: 1 });
            }}
            onRemoveCourse={(v) => {
              const next = selectedCourse.filter((x) => x !== v);
              setSelectedCourse(next);
              syncUrl({ course: next, page: 1 });
            }}
          />
        </div>
      </div>
    </div>
  );
}

function SortSelect({
  sort,
  onChange,
}: {
  sort: SortKey;
  onChange: (v: SortKey) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-xs font-extrabold text-slate-700">Sort by</div>
      <select
        value={sort}
        onChange={(e) => onChange((e.target.value as SortKey) || "latest")}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none hover:border-slate-300"
      >
        <option value="latest">Newest First</option>
        <option value="price_asc">Price: Low to High</option>
        <option value="price_desc">Price: High to Low</option>
      </select>
    </div>
  );
}

export default function ProductsClient({
  initialSearchParam = "",
  initialCategoryParam = "",
  initialCourseParam = "",
  initialSessionParam = "",
  initialLanguageParam = "",
  initialSortParam = "latest",
  initialPageParam = "1",
  initialProducts = [],
  initialMeta = null,
  initialQueryKey = "",
}: ProductsClientProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const spKey = sp.toString();

  const initialUrlSearch = safeStr(initialSearchParam);
  const initialUrlCategory = parseCsvParam(safeStr(initialCategoryParam));
  const initialUrlCourse = parseCsvParam(safeStr(initialCourseParam)).map(toUpper);
  const initialUrlSession = parseCsvParam(safeStr(initialSessionParam));
  const initialUrlLang = parseCsvParam(safeStr(initialLanguageParam));
  const initialUrlSort = (safeStr(initialSortParam) as SortKey) || "latest";
  const initialUrlPage = Math.max(1, Number(initialPageParam || "1") || 1);

  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [searchInput, setSearchInput] = useState(initialUrlSearch);
  const [appliedSearch, setAppliedSearch] = useState(initialUrlSearch);

  const [selectedCat, setSelectedCat] = useState<string[]>(initialUrlCategory);
  const [selectedCourse, setSelectedCourse] = useState<string[]>(initialUrlCourse);
  const [selectedSession, setSelectedSession] = useState<string[]>(initialUrlSession);
  const [selectedLang, setSelectedLang] = useState<string[]>(initialUrlLang);
  const [sort, setSort] = useState<SortKey>(initialUrlSort || "latest");

  const [loading, setLoading] = useState(!(Array.isArray(initialProducts) && initialMeta));
  const [items, setItems] = useState<ApiProductCard[]>(
    Array.isArray(initialProducts) ? initialProducts : []
  );
  const [meta, setMeta] = useState<Meta>(
    initialMeta || {
      total: 0,
      page: initialUrlPage,
      totalPages: 1,
      limit: 12,
    }
  );

  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ApiProductCard[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);

  const [facetCourses, setFacetCourses] = useState<DropdownItem[]>([]);
  const [facetSessions, setFacetSessions] = useState<string[]>([]);
  const [facetLangs, setFacetLangs] = useState<string[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(true);

  const didInitialUrlSyncRef = useRef(false);
  const skipFirstFetchRef = useRef(
    !!initialQueryKey && Array.isArray(initialProducts) && !!initialMeta
  );
  const pendingUrlSearchRef = useRef<string | null>(null);

  const cacheRef = useRef({
    categories: new Set<string>(),
    courses: new Set<string>(),
    sessions: new Set<string>(),
    languages: new Set<string>(),
  });

  const defaultCategoryFallback = [
    "Solved Assignments",
    "Question Papers (PYQ)",
    "Handwritten PDFs",
    "Ebooks",
    "projects",
    "Guess Papers",
    "Combo",
    "Handwritten Hardcopy (Delivery)",
  ];

  const defaultLanguageFallback = ["Hindi", "English", "Urdu"];
  const defaultSessionFallback = ["2025-2026"];

  useEffect(() => {
    const seed = Array.isArray(initialProducts) ? initialProducts : [];

    for (const p of seed) {
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
  }, [initialProducts]);

  useEffect(() => {
    document.body.style.overflow = isFilterOpen ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isFilterOpen]);

  function syncUrl(partial: {
    search?: string;
    category?: string[];
    course?: string[];
    session?: string[];
    language?: string[];
    sort?: SortKey;
    page?: number;
  }) {
    const params = new URLSearchParams(spKey);

    const nextSearch =
      partial.search !== undefined
        ? partial.search
        : safeStr(params.get("search"));

    const nextCat =
      partial.category !== undefined
        ? partial.category
        : parseCsvParam(safeStr(params.get("category")));

    const nextCourse =
      partial.course !== undefined
        ? partial.course.map(toUpper)
        : parseCsvParam(safeStr(params.get("course"))).map(toUpper);

    const nextSession =
      partial.session !== undefined
        ? partial.session
        : parseCsvParam(safeStr(params.get("session")));

    const nextLang =
      partial.language !== undefined
        ? partial.language
        : parseCsvParam(safeStr(params.get("language")));

    const nextSort =
      partial.sort !== undefined
        ? partial.sort
        : ((safeStr(params.get("sort")) as SortKey) || "latest");

    const nextPage =
      partial.page !== undefined
        ? partial.page
        : Math.max(1, Number(params.get("page") || "1") || 1);

    if (partial.search !== undefined) {
      pendingUrlSearchRef.current = nextSearch;
    }

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

    if (nextPage > 1) params.set("page", String(nextPage));
    else params.delete("page");

    router.replace(`/products${params.toString() ? `?${params.toString()}` : ""}`, {
      scroll: false,
    });
  }

  useEffect(() => {
    const urlParams = new URLSearchParams(spKey);

    const urlSearch = safeStr(urlParams.get("search"));
    const urlCategory = parseCsvParam(safeStr(urlParams.get("category")));
    const urlCourse = parseCsvParam(safeStr(urlParams.get("course"))).map(toUpper);
    const urlSession = parseCsvParam(safeStr(urlParams.get("session")));
    const urlLang = parseCsvParam(safeStr(urlParams.get("language")));
    const urlSort = (safeStr(urlParams.get("sort")) as SortKey) || "latest";
    const urlPage = Math.max(1, Number(urlParams.get("page") || "1") || 1);

    if (!didInitialUrlSyncRef.current) {
      didInitialUrlSyncRef.current = true;

      const sameSearch = urlSearch === initialUrlSearch;
      const sameCat = sameStringArray(urlCategory, initialUrlCategory);
      const sameCourse = sameStringArray(urlCourse, initialUrlCourse);
      const sameSession = sameStringArray(urlSession, initialUrlSession);
      const sameLang = sameStringArray(urlLang, initialUrlLang);
      const sameSort = urlSort === initialUrlSort;
      const samePage = urlPage === initialUrlPage;

      if (
        sameSearch &&
        sameCat &&
        sameCourse &&
        sameSession &&
        sameLang &&
        sameSort &&
        samePage
      ) {
        return;
      }
    }

    const isOwnSearchSync =
      pendingUrlSearchRef.current !== null &&
      urlSearch === pendingUrlSearchRef.current;

    if (isOwnSearchSync) {
      pendingUrlSearchRef.current = null;
    }

    setSearchInput((prev) => (prev === urlSearch ? prev : urlSearch));
    setAppliedSearch((prev) => (prev === urlSearch ? prev : urlSearch));

    setSelectedCat((prev) =>
      sameStringArray(prev, urlCategory) ? prev : urlCategory
    );
    setSelectedCourse((prev) =>
      sameStringArray(prev, urlCourse) ? prev : urlCourse
    );
    setSelectedSession((prev) =>
      sameStringArray(prev, urlSession) ? prev : urlSession
    );
    setSelectedLang((prev) =>
      sameStringArray(prev, urlLang) ? prev : urlLang
    );
    setSort((prev) => (prev === urlSort ? prev : urlSort));
    setMeta((prev) => (prev.page === urlPage ? prev : { ...prev, page: urlPage }));

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spKey]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setFiltersLoading(true);

      try {
        const categoryKey = selectedCat.join(",");

        const productsParams = new URLSearchParams();
        productsParams.set("includeFacets", "1");
        productsParams.set("page", "1");
        productsParams.set("limit", "1");
        productsParams.set("sort", "latest");
        if (categoryKey) productsParams.set("category", categoryKey);

        const coursesParams = new URLSearchParams();
        coursesParams.set("limit", "1000");
        if (categoryKey) coursesParams.set("category", categoryKey);

        const sessionsParams = new URLSearchParams();
        sessionsParams.set("limit", "1000");
        if (categoryKey) sessionsParams.set("category", categoryKey);

        const [productsRes, coursesRes, sessionsRes] = await Promise.allSettled([
          fetch(`/api/products?${productsParams.toString()}`, { cache: "no-store" }),
          fetch(`/api/courses?${coursesParams.toString()}`, { cache: "no-store" }),
          fetch(`/api/sessions?${sessionsParams.toString()}`, { cache: "no-store" }),
        ]);

        if (cancelled) return;

        let facetCoursesDetailed: Array<{ code: string; title: string }> = [];
        let facetCoursesRaw: string[] = [];
        let facetSessionsRaw: string[] = [];
        let facetLanguagesRaw: string[] = [];

        if (productsRes.status === "fulfilled") {
          try {
            const data: ApiProductsResponse = await productsRes.value.json();

            facetCoursesDetailed = safeArr(data?.facets?.coursesDetailed).map((item) => ({
              code: toUpper(safeStr(item?.code)),
              title: safeStr(item?.title),
            }));

            facetCoursesRaw = safeArr(data?.facets?.courses)
              .map((x) => toUpper(safeStr(x)))
              .filter(Boolean);

            facetSessionsRaw = safeArr(data?.facets?.sessions)
              .map((x) => safeStr(x))
              .filter(Boolean);

            facetLanguagesRaw = safeArr(data?.facets?.languages)
              .map((x) => safeStr(x))
              .filter(Boolean);
          } catch {
            // ignore
          }
        }

        let courseApiItems: Array<{ code: string; title: string }> = [];
        if (coursesRes.status === "fulfilled") {
          try {
            const data: ApiCoursesResponse = await coursesRes.value.json();
            courseApiItems = safeArr(data?.courses).map((item) => ({
              code: toUpper(safeStr(item?.code)),
              title: safeStr(item?.title),
            }));
          } catch {
            // ignore
          }
        }

        let sessionApiItems: string[] = [];
        if (sessionsRes.status === "fulfilled") {
          try {
            const data: ApiSessionsResponse = await sessionsRes.value.json();
            sessionApiItems = safeArr(data?.sessions)
              .map((item) => safeStr(item?.name))
              .filter(Boolean);
          } catch {
            // ignore
          }
        }

        const mergedCourseMap = new Map<string, DropdownItem>();

        for (const item of [...courseApiItems, ...facetCoursesDetailed]) {
          const code = toUpper(item.code);
          if (!code) continue;

          const title = safeStr(item.title);
          const nextItem: DropdownItem = {
            value: code,
            label: title ? `${code} — ${title}` : code,
            searchText: `${code} ${title}`,
          };

          const prev = mergedCourseMap.get(code);
          if (!prev) {
            mergedCourseMap.set(code, nextItem);
            continue;
          }

          if (!safeStr(prev.label).includes("—") && title) {
            mergedCourseMap.set(code, nextItem);
          }
        }

        for (const code of facetCoursesRaw) {
          const key = toUpper(code);
          if (!key || mergedCourseMap.has(key)) continue;
          mergedCourseMap.set(key, {
            value: key,
            label: key,
            searchText: key,
          });
        }

        const nextCourses = normalizeDropdownItems(
          Array.from(mergedCourseMap.values()).sort((a, b) => sortAlphaNumeric(a.value, b.value))
        );

        const nextSessions = uniq([...facetSessionsRaw, ...sessionApiItems])
          .filter(Boolean)
          .sort((a, b) => sortAlphaNumeric(b, a));

        const nextLangs = sortLanguages(uniq(facetLanguagesRaw).filter(Boolean));

        nextCourses.forEach((item) => cacheRef.current.courses.add(item.value));
        nextSessions.forEach((item) => cacheRef.current.sessions.add(item));
        nextLangs.forEach((item) => cacheRef.current.languages.add(item));

        setFacetCourses(nextCourses);
        setFacetSessions(nextSessions);
        setFacetLangs(nextLangs);
      } catch {
        if (!cancelled) {
          setFacetCourses([]);
          setFacetSessions([]);
          setFacetLangs([]);
        }
      } finally {
        if (!cancelled) setFiltersLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedCat]);

  const queryKey = useMemo(() => {
    return buildProductsQueryKey({
      selectedCat,
      selectedCourse,
      selectedSession,
      selectedLang,
      search: appliedSearch,
      sort,
      page: meta.page,
    });
  }, [selectedCat, selectedCourse, selectedSession, selectedLang, appliedSearch, sort, meta.page]);

  useEffect(() => {
    let cancelled = false;

    if (skipFirstFetchRef.current && initialQueryKey === queryKey) {
      skipFirstFetchRef.current = false;
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);

      try {
        const res = await fetch(`/api/products?${queryKey}`, {
          cache: "no-store",
        });
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
          setMeta((m) => ({
            ...m,
            total: 0,
            totalPages: 1,
            limit: 12,
          }));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [queryKey, initialQueryKey, selectedCat, selectedCourse, selectedSession, selectedLang]);

  useEffect(() => {
    if (!searchInput.trim()) {
      setSuggestions([]);
      setShowSuggest(false);
      return;
    }

    let cancelled = false;

    const t = window.setTimeout(async () => {
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

        const res = await fetch(`/api/products?${params.toString()}`, {
          cache: "no-store",
        });
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
      window.clearTimeout(t);
    };
  }, [searchInput, selectedCat, selectedCourse, selectedSession, selectedLang]);

  const countText = useMemo(() => {
    if (loading) return "Loading…";
    if (meta.total) return `${meta.total} results`;
    return `${items.length} results`;
  }, [loading, meta.total, items.length]);

  const similarCodes = useMemo(() => {
    if (loading) return [];
    if (items.length > 0) return [];
    if (!appliedSearch) return [];
    const { variants } = extractSubjectCodeVariants(appliedSearch);
    return variants.slice(0, 8);
  }, [items.length, loading, appliedSearch]);

  const optionSets = useMemo(() => {
    const catItems = normalizeDropdownItems(
      uniq([
        ...defaultCategoryFallback,
        ...Array.from(cacheRef.current.categories),
        ...selectedCat,
      ])
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({
          value,
          label: value,
          searchText: value,
        }))
    );

    const sessionItems = normalizeDropdownItems(
      uniq([
        ...defaultSessionFallback,
        ...facetSessions,
        ...Array.from(cacheRef.current.sessions),
        ...selectedSession,
      ])
        .filter(Boolean)
        .sort((a, b) => sortAlphaNumeric(b, a))
        .map((value) => ({
          value,
          label: value,
          searchText: value,
        }))
    );

    const langItems = normalizeDropdownItems(
      sortLanguages(
        uniq([
          ...defaultLanguageFallback,
          ...facetLangs,
          ...Array.from(cacheRef.current.languages),
          ...selectedLang,
        ]).filter(Boolean)
      ).map((value) => ({
        value,
        label: value,
        searchText: value,
      }))
    );

    const courseMap = new Map<string, DropdownItem>();

    for (const item of facetCourses) {
      courseMap.set(item.value, item);
    }

    for (const code of Array.from(cacheRef.current.courses)) {
      const key = toUpper(code);
      if (!key || courseMap.has(key)) continue;
      courseMap.set(key, {
        value: key,
        label: key,
        searchText: key,
      });
    }

    for (const code of selectedCourse.map(toUpper)) {
      if (!courseMap.has(code)) {
        courseMap.set(code, {
          value: code,
          label: code,
          searchText: code,
        });
      }
    }

    const courseItems = normalizeDropdownItems(
      Array.from(courseMap.values()).sort((a, b) => sortAlphaNumeric(a.value, b.value))
    );

    return {
      cats: catItems,
      sessions: sessionItems,
      langs: langItems,
      courses: courseItems,
    };
  }, [selectedCat, selectedSession, selectedLang, selectedCourse, facetCourses, facetSessions, facetLangs]);

  const activeFiltersCount =
    (selectedCat.length ? 1 : 0) +
    (selectedCourse.length ? 1 : 0) +
    (selectedSession.length ? 1 : 0) +
    (selectedLang.length ? 1 : 0);

  const handleApplySearch = () => {
    const next = searchInput.trim();
    setAppliedSearch(next);
    setShowSuggest(false);
    syncUrl({ search: next, page: 1 });
  };

  const handleClearAll = () => {
    setSearchInput("");
    setAppliedSearch("");
    setSelectedCat([]);
    setSelectedCourse([]);
    setSelectedSession([]);
    setSelectedLang([]);
    setSuggestions([]);
    setShowSuggest(false);
    setSort("latest");

    syncUrl({
      search: "",
      category: [],
      course: [],
      session: [],
      language: [],
      sort: "latest",
      page: 1,
    });
  };

  return (
    <main className="min-h-screen bg-white font-sans text-slate-800">
      <TopBar />
      <Navbar />

      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center gap-2 overflow-x-auto whitespace-nowrap px-4 py-3 text-[13px] text-gray-500">
          <Link href="/" className="font-semibold hover:text-blue-700">
            Home
          </Link>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="font-extrabold text-blue-700">All Products</span>
        </div>
      </div>

      <section className="bg-white">
        <div className="mx-auto max-w-[1600px] px-4 py-6 md:py-8">
          <div className="max-w-4xl">
            <h1 className="text-[28px] font-extrabold leading-tight text-slate-900 md:text-5xl">
              All IGNOU Products
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-600 md:text-base">
              Search your product quickly using subject code, course, session, and medium filters.
            </p>
          </div>

          <div className="mt-5 hidden lg:block">
            <FiltersPanel
              showSearch
              activeFiltersCount={activeFiltersCount}
              optionSets={optionSets}
              searchInput={searchInput}
              onSearchInputChange={setSearchInput}
              onSearchClear={() => {
                setSearchInput("");
                setSuggestions([]);
                setShowSuggest(false);
              }}
              onSearchApply={handleApplySearch}
              showSuggest={showSuggest}
              setShowSuggest={setShowSuggest}
              suggestLoading={suggestLoading}
              suggestions={suggestions}
              selectedCat={selectedCat}
              selectedSession={selectedSession}
              selectedLang={selectedLang}
              selectedCourse={selectedCourse}
              setSelectedCat={setSelectedCat}
              setSelectedSession={setSelectedSession}
              setSelectedLang={setSelectedLang}
              setSelectedCourse={setSelectedCourse}
              appliedSearch={appliedSearch}
              onClearAll={handleClearAll}
              syncUrl={syncUrl}
            />
          </div>

          <div className="mt-5 space-y-3 lg:hidden">
            <SearchBox
              value={searchInput}
              onChange={setSearchInput}
              onClear={() => {
                setSearchInput("");
                setSuggestions([]);
                setShowSuggest(false);
              }}
              onApply={handleApplySearch}
              showSuggest={showSuggest}
              setShowSuggest={setShowSuggest}
              suggestLoading={suggestLoading}
              suggestions={suggestions}
              size="large"
            />

            <button
              onClick={() => setIsFilterOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 font-extrabold text-white shadow-lg transition active:scale-[0.99]"
              type="button"
            >
              <Filter size={18} /> Open Filters
              {activeFiltersCount ? ` (${activeFiltersCount})` : ""}
            </button>

            {(appliedSearch || activeFiltersCount) ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-3">
                <ActiveChips
                  appliedSearch={appliedSearch}
                  activeFiltersCount={activeFiltersCount}
                  selectedCat={selectedCat}
                  selectedSession={selectedSession}
                  selectedLang={selectedLang}
                  selectedCourse={selectedCourse}
                  onClearAll={handleClearAll}
                  onRemoveSearch={() => {
                    setSearchInput("");
                    setAppliedSearch("");
                    syncUrl({ search: "", page: 1 });
                  }}
                  onRemoveCat={(v) => {
                    const next = selectedCat.filter((x) => x !== v);
                    setSelectedCat(next);
                    syncUrl({ category: next, page: 1 });
                  }}
                  onRemoveSession={(v) => {
                    const next = selectedSession.filter((x) => x !== v);
                    setSelectedSession(next);
                    syncUrl({ session: next, page: 1 });
                  }}
                  onRemoveLang={(v) => {
                    const next = selectedLang.filter((x) => x !== v);
                    setSelectedLang(next);
                    syncUrl({ language: next, page: 1 });
                  }}
                  onRemoveCourse={(v) => {
                    const next = selectedCourse.filter((x) => x !== v);
                    setSelectedCourse(next);
                    syncUrl({ course: next, page: 1 });
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {isFilterOpen ? (
        <div
          className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsFilterOpen(false)}
        />
      ) : null}

      <div
        className={`fixed left-0 top-0 z-[1000] h-full w-[90%] max-w-[440px] bg-white shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          isFilterOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <div className="text-sm font-extrabold text-slate-900">Filters</div>
          <button
            onClick={() => setIsFilterOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50"
            aria-label="Close"
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <div className="h-[calc(100%-73px)] overflow-y-auto p-4">
          <FiltersPanel
            showSearch={false}
            activeFiltersCount={activeFiltersCount}
            optionSets={optionSets}
            searchInput={searchInput}
            onSearchInputChange={setSearchInput}
            onSearchClear={() => {
              setSearchInput("");
              setSuggestions([]);
              setShowSuggest(false);
            }}
            onSearchApply={handleApplySearch}
            showSuggest={showSuggest}
            setShowSuggest={setShowSuggest}
            suggestLoading={suggestLoading}
            suggestions={suggestions}
            selectedCat={selectedCat}
            selectedSession={selectedSession}
            selectedLang={selectedLang}
            selectedCourse={selectedCourse}
            setSelectedCat={setSelectedCat}
            setSelectedSession={setSelectedSession}
            setSelectedLang={setSelectedLang}
            setSelectedCourse={setSelectedCourse}
            appliedSearch={appliedSearch}
            onClearAll={handleClearAll}
            syncUrl={syncUrl}
          />
        </div>
      </div>

      <section className="bg-white pb-16">
        <div className="mx-auto max-w-[1600px] px-4">
          <div className="flex flex-col gap-3 border-b border-gray-100 py-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-extrabold text-slate-900">All Products</div>
              <div className="mt-1 text-xs font-semibold text-slate-500">
                {loading || filtersLoading ? "Loading…" : countText}
              </div>
            </div>

            <SortSelect
              sort={sort}
              onChange={(v) => {
                setSort(v);
                syncUrl({ sort: v, page: 1 });
              }}
            />
          </div>

          <div className="mt-5">
            {loading ? (
              <ProductsGridSkeleton />
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="text-lg font-extrabold text-slate-900">No products found</div>
                <div className="mt-1 text-sm font-semibold text-slate-600">
                  Try changing filters or search with course/subject code.
                </div>

                {similarCodes.length ? (
                  <div className="mt-4">
                    <div className="text-sm font-extrabold text-slate-900">
                      Try these code patterns
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {similarCodes.map((v) => (
                        <button
                          key={v}
                          onClick={() => setSearchInput(v)}
                          className="rounded-full border border-gray-200 px-3 py-1 text-[11px] font-extrabold text-slate-700 hover:bg-gray-50"
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
              <div className="products-results-grid grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
                {items.map((p) => (
                  <div
                    key={`${p.slug}-${p.category || "product"}`}
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
                className={`rounded-xl border px-4 py-2 text-xs font-extrabold ${
                  meta.page <= 1
                    ? "border-gray-200 bg-gray-100 text-gray-400"
                    : "border-gray-200 bg-white text-slate-800 hover:bg-gray-50"
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
                className={`rounded-xl border px-4 py-2 text-xs font-extrabold ${
                  meta.page >= meta.totalPages
                    ? "border-gray-200 bg-gray-100 text-gray-400"
                    : "border-gray-200 bg-white text-slate-800 hover:bg-gray-50"
                }`}
                type="button"
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <Footer />
      <FloatingButtons />
    </main>
  );
}