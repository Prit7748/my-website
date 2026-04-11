"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BadgeCheck,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Filter,
  MapPin,
  Package,
  Pencil,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Truck,
  X,
} from "lucide-react";

import TopBar from "@/components/TopBar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingButtons from "@/components/FloatingButtons";
import ProductCard from "@/components/ProductCard";
import { productHref } from "@/lib/productHref";

const CATEGORY_LABEL = "Handwritten Hardcopy (Delivery)";
const PAGE_PATH = "/handwritten-hardcopy";
const PAGE_URL = "https://istudentsportal.com/handwritten-hardcopy";

const INTEGRITY_NOTE =
  "We do not provide illegal or cheating services. We only convert the content, outline, points, or data shared by the student into a neat handwritten format and deliver it. The final academic submission remains the student’s responsibility.";

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

type Meta = {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
};

type DropdownItem = {
  value: string;
  label: string;
  searchText?: string;
};

type HandwrittenHardcopyClientProps = {
  initialSearchParam?: string;
  initialCourseParam?: string;
  initialSessionParam?: string;
  initialLanguageParam?: string;
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

function buildHardcopyQueryKey(input: {
  selectedCourse: string[];
  selectedSession: string[];
  selectedLang: string[];
  search: string;
  page: number;
}) {
  const params = new URLSearchParams();

  params.set("page", String(Math.max(1, Number(input.page || 1))));
  params.set("limit", "12");
  params.set("includeFacets", "0");
  params.set("sort", "latest");
  params.set("category", CATEGORY_LABEL);

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

function humanJoin(values: string[]) {
  const arr = values.filter(Boolean);
  if (!arr.length) return "";
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
  return `${arr.slice(0, -1).join(", ")}, and ${arr[arr.length - 1]}`;
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

function SamplesButtonTile({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-[26px] border border-slate-200 bg-gradient-to-br from-blue-700 via-indigo-700 to-cyan-600 p-5 text-white shadow-[0_18px_50px_rgba(37,99,235,0.28)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(37,99,235,0.34)]"
    >
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-cyan-300/20 blur-2xl" />

      <div className="relative flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
          <Pencil size={20} />
        </div>

        <div className="min-w-0">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-blue-100/90">
            Handwriting preview
          </div>
          <div className="mt-1 text-xl font-extrabold leading-tight text-white">
            View Handwriting Samples
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-blue-50/90">
            See sample handwritten pages before choosing your hardcopy product.
          </p>
        </div>
      </div>

      <div className="relative mt-5 inline-flex items-center rounded-xl bg-white px-4 py-2 text-sm font-extrabold text-slate-900 transition group-hover:bg-blue-50">
        Open Samples →
      </div>
    </Link>
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
                      ? 'Type "A" / "T" for codes, or search the full code'
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
  selectedSession,
  selectedLang,
  selectedCourse,
  onClearAll,
  onRemoveSearch,
  onRemoveSession,
  onRemoveLang,
  onRemoveCourse,
}: {
  appliedSearch: string;
  activeFiltersCount: number;
  selectedSession: string[];
  selectedLang: string[];
  selectedCourse: string[];
  onClearAll: () => void;
  onRemoveSearch: () => void;
  onRemoveSession: (v: string) => void;
  onRemoveLang: (v: string) => void;
  onRemoveCourse: (v: string) => void;
}) {
  const hasAny = !!(appliedSearch || activeFiltersCount);

  return (
    <div className={`${hasAny ? "" : "opacity-60"} transition`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs font-extrabold text-slate-900">Selected filters</div>
        {hasAny ? (
          <button
            onClick={onClearAll}
            className="text-[11px] font-extrabold text-slate-700 hover:text-blue-700"
            type="button"
          >
            Clear all
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
  optionSets: {
    sessions: DropdownItem[];
    langs: DropdownItem[];
    courses: DropdownItem[];
  };
  activeFiltersCount: number;
  searchInput: string;
  onSearchInputChange: (v: string) => void;
  onSearchClear: () => void;
  onSearchApply: () => void;
  showSuggest: boolean;
  setShowSuggest: (v: boolean) => void;
  suggestLoading: boolean;
  suggestions: ApiProductCard[];
  selectedSession: string[];
  selectedLang: string[];
  selectedCourse: string[];
  setSelectedSession: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedLang: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedCourse: React.Dispatch<React.SetStateAction<string[]>>;
  appliedSearch: string;
  onClearAll: () => void;
  syncUrl: (partial: {
    search?: string;
    course?: string[];
    session?: string[];
    language?: string[];
    page?: number;
  }) => void;
};

function FiltersPanel({
  showSearch = true,
  optionSets,
  activeFiltersCount,
  searchInput,
  onSearchInputChange,
  onSearchClear,
  onSearchApply,
  showSuggest,
  setShowSuggest,
  suggestLoading,
  suggestions,
  selectedSession,
  selectedLang,
  selectedCourse,
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
    <div className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-50/80 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      <div className="border-b border-slate-200/70 bg-gradient-to-r from-slate-50 via-blue-50/70 to-cyan-50/60 px-4 py-4 md:px-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-lg">
              <SlidersHorizontal size={18} />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[15px] font-extrabold text-slate-900">
                  Search & filters
                </div>
                {activeFiltersCount ? (
                  <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-extrabold text-blue-700">
                    {activeFiltersCount} active
                  </span>
                ) : null}
              </div>

              <div className="mt-1 text-[12px] font-semibold text-slate-600 md:text-[13px]">
                Find the exact handwritten hardcopy by subject code, course, session, and medium.
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 md:gap-4">
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
            placeholder='Type "A" / "T" or search the full code'
            searchable
            alphaJump
            maxRender={250}
          />
        </div>

        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-3">
          <ActiveChips
            appliedSearch={appliedSearch}
            activeFiltersCount={activeFiltersCount}
            selectedSession={selectedSession}
            selectedLang={selectedLang}
            selectedCourse={selectedCourse}
            onClearAll={onClearAll}
            onRemoveSearch={() => syncUrl({ search: "", page: 1 })}
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

export default function HandwrittenHardcopyClient({
  initialSearchParam = "",
  initialCourseParam = "",
  initialSessionParam = "",
  initialLanguageParam = "",
  initialPageParam = "1",
  initialProducts = [],
  initialMeta = null,
  initialQueryKey = "",
}: HandwrittenHardcopyClientProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const spKey = sp.toString();

  const initialResolvedRef = useRef<{
    search: string;
    course: string[];
    session: string[];
    lang: string[];
    page: number;
  } | null>(null);

  if (!initialResolvedRef.current) {
    initialResolvedRef.current = {
      search: safeStr(initialSearchParam || sp.get("search")),
      course: parseCsvParam(safeStr(initialCourseParam || sp.get("course"))).map(toUpper),
      session: parseCsvParam(safeStr(initialSessionParam || sp.get("session"))),
      lang: parseCsvParam(safeStr(initialLanguageParam || sp.get("language"))),
      page: Math.max(1, Number(initialPageParam || sp.get("page") || "1") || 1),
    };
  }

  const initialUrlSearch = initialResolvedRef.current.search;
  const initialUrlCourse = initialResolvedRef.current.course;
  const initialUrlSession = initialResolvedRef.current.session;
  const initialUrlLang = initialResolvedRef.current.lang;
  const initialUrlPage = initialResolvedRef.current.page;

  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [searchInput, setSearchInput] = useState(initialUrlSearch);
  const [appliedSearch, setAppliedSearch] = useState(initialUrlSearch);

  const [selectedCourse, setSelectedCourse] = useState<string[]>(initialUrlCourse);
  const [selectedSession, setSelectedSession] = useState<string[]>(initialUrlSession);
  const [selectedLang, setSelectedLang] = useState<string[]>(initialUrlLang);

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
  const lastSeenUrlSearchRef = useRef(initialUrlSearch);

  useEffect(() => {
    document.body.style.overflow = isFilterOpen ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isFilterOpen]);

  function syncUrl(partial: {
    search?: string;
    course?: string[];
    session?: string[];
    language?: string[];
    page?: number;
  }) {
    const params = new URLSearchParams(spKey);

    const nextSearch =
      partial.search !== undefined
        ? partial.search
        : safeStr(params.get("search"));

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

    const nextPage =
      partial.page !== undefined
        ? partial.page
        : Math.max(1, Number(params.get("page") || "1") || 1);

    if (partial.search !== undefined) {
      pendingUrlSearchRef.current = nextSearch;
    }

    params.delete("category");
    params.delete("sort");

    if (nextSearch) params.set("search", nextSearch);
    else params.delete("search");

    if (nextCourse.length) params.set("course", nextCourse.join(","));
    else params.delete("course");

    if (nextSession.length) params.set("session", nextSession.join(","));
    else params.delete("session");

    if (nextLang.length) params.set("language", nextLang.join(","));
    else params.delete("language");

    if (nextPage > 1) params.set("page", String(nextPage));
    else params.delete("page");

    router.replace(`${PAGE_PATH}${params.toString() ? `?${params.toString()}` : ""}`, {
      scroll: false,
    });
  }

  useEffect(() => {
    const urlParams = new URLSearchParams(spKey);

    const categoryValues = parseCsvParam(safeStr(urlParams.get("category")));
    const hasOtherCategory =
      categoryValues.length > 0 &&
      (categoryValues.length > 1 || categoryValues.some((x) => x !== CATEGORY_LABEL));

    if (hasOtherCategory) {
      router.replace(`/products?${urlParams.toString()}`);
      return;
    }

    const urlSearch = safeStr(urlParams.get("search"));
    const urlCourse = parseCsvParam(safeStr(urlParams.get("course"))).map(toUpper);
    const urlSession = parseCsvParam(safeStr(urlParams.get("session")));
    const urlLang = parseCsvParam(safeStr(urlParams.get("language")));
    const urlPage = Math.max(1, Number(urlParams.get("page") || "1") || 1);

    if (!didInitialUrlSyncRef.current) {
      didInitialUrlSyncRef.current = true;

      const sameSearch = urlSearch === initialUrlSearch;
      const sameCourse = sameStringArray(urlCourse, initialUrlCourse);
      const sameSession = sameStringArray(urlSession, initialUrlSession);
      const sameLang = sameStringArray(urlLang, initialUrlLang);
      const samePage = urlPage === initialUrlPage;

      if (sameSearch && sameCourse && sameSession && sameLang && samePage) {
        return;
      }
    }

    const isOwnSearchSync =
      pendingUrlSearchRef.current !== null &&
      urlSearch === pendingUrlSearchRef.current;

    if (isOwnSearchSync) {
      pendingUrlSearchRef.current = null;
    }

    if (urlSearch !== lastSeenUrlSearchRef.current) {
      lastSeenUrlSearchRef.current = urlSearch;
      setSearchInput(urlSearch);
      setAppliedSearch(urlSearch);
    }

    setSelectedCourse((prev) => (sameStringArray(prev, urlCourse) ? prev : urlCourse));
    setSelectedSession((prev) => (sameStringArray(prev, urlSession) ? prev : urlSession));
    setSelectedLang((prev) => (sameStringArray(prev, urlLang) ? prev : urlLang));
    setMeta((prev) => (prev.page === urlPage ? prev : { ...prev, page: urlPage }));
  }, [
    spKey,
    router,
    initialUrlSearch,
    initialUrlCourse,
    initialUrlSession,
    initialUrlLang,
    initialUrlPage,
  ]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setFiltersLoading(true);

      try {
        const productsParams = new URLSearchParams();
        productsParams.set("category", CATEGORY_LABEL);
        productsParams.set("includeFacets", "1");
        productsParams.set("page", "1");
        productsParams.set("limit", "1");
        productsParams.set("sort", "latest");

        const coursesParams = new URLSearchParams();
        coursesParams.set("category", CATEGORY_LABEL);
        coursesParams.set("limit", "1000");

        const sessionsParams = new URLSearchParams();
        sessionsParams.set("category", CATEGORY_LABEL);
        sessionsParams.set("limit", "1000");

        const [productsRes, coursesRes, sessionsRes] = await Promise.allSettled([
          fetch(`/api/products?${productsParams.toString()}`, { cache: "no-store" }),
          fetch(`/api/courses?${coursesParams.toString()}`, { cache: "no-store" }),
          fetch(`/api/sessions?${sessionsParams.toString()}`, { cache: "no-store" }),
        ]);

        if (cancelled) return;

        let facetCoursesDetailed: Array<{ code: string; title: string }> = [];
        let facetSessionsRaw: string[] = [];
        let facetLanguagesRaw: string[] = [];

        if (productsRes.status === "fulfilled") {
          try {
            const data: ApiProductsResponse = await productsRes.value.json();
            facetCoursesDetailed = safeArr(data?.facets?.coursesDetailed).map((item) => ({
              code: toUpper(safeStr(item?.code)),
              title: safeStr(item?.title),
            }));
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
        if (!facetCoursesDetailed.length && coursesRes.status === "fulfilled") {
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
        if (!facetSessionsRaw.length && sessionsRes.status === "fulfilled") {
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
        const courseSource = facetCoursesDetailed.length ? facetCoursesDetailed : courseApiItems;

        for (const item of courseSource) {
          const code = toUpper(item.code);
          if (!code) continue;

          const title = safeStr(item.title);
          const label = title ? `${code} — ${title}` : code;

          mergedCourseMap.set(code, {
            value: code,
            label,
            searchText: `${code} ${title}`,
          });
        }

        const nextCourses = normalizeDropdownItems(
          Array.from(mergedCourseMap.values()).sort((a, b) => sortAlphaNumeric(a.value, b.value))
        );

        const nextSessions = uniq([...(facetSessionsRaw.length ? facetSessionsRaw : sessionApiItems)])
          .filter(Boolean)
          .sort((a, b) => sortAlphaNumeric(b, a));

        const nextLangs = sortLanguages(uniq(facetLanguagesRaw).filter(Boolean));

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
  }, []);

  const queryKey = useMemo(() => {
    return buildHardcopyQueryKey({
      selectedCourse: selectedCourse.map(toUpper),
      selectedSession,
      selectedLang,
      search: appliedSearch,
      page: meta.page,
    });
  }, [selectedCourse, selectedSession, selectedLang, appliedSearch, meta.page]);

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
  }, [queryKey, initialQueryKey]);

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
        params.set("category", CATEGORY_LABEL);

        if (selectedCourse.length) params.set("course", selectedCourse.map(toUpper).join(","));
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
  }, [searchInput, selectedCourse, selectedSession, selectedLang]);

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
    const sessionItems = normalizeDropdownItems(
      uniq([...facetSessions, ...selectedSession])
        .filter(Boolean)
        .sort((a, b) => sortAlphaNumeric(b, a))
        .map((value) => ({
          value,
          label: value,
          searchText: value,
        }))
    );

    const langItems = normalizeDropdownItems(
      sortLanguages(uniq([...facetLangs, ...selectedLang]).filter(Boolean)).map((value) => ({
        value,
        label: value,
        searchText: value,
      }))
    );

    const courseMap = new Map<string, DropdownItem>();
    for (const item of facetCourses) {
      courseMap.set(item.value, item);
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
      sessions: sessionItems,
      langs: langItems,
      courses: courseItems,
    };
  }, [facetCourses, facetSessions, facetLangs, selectedCourse, selectedSession, selectedLang]);

  const activeFiltersCount =
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
    setSelectedCourse([]);
    setSelectedSession([]);
    setSelectedLang([]);
    setSuggestions([]);
    setShowSuggest(false);

    syncUrl({
      search: "",
      course: [],
      session: [],
      language: [],
      page: 1,
    });
  };

  const quickSessions = useMemo(
    () => optionSets.sessions.slice(0, 3).map((x) => x.value),
    [optionSets.sessions]
  );

  const quickLangs = useMemo(
    () => optionSets.langs.slice(0, 3).map((x) => x.value),
    [optionSets.langs]
  );

  const resultSummary = useMemo(() => {
    const parts: string[] = [];

    if (appliedSearch) parts.push(`subject or keyword “${appliedSearch}”`);
    if (selectedCourse.length) parts.push(`course ${humanJoin(selectedCourse.slice(0, 3))}`);
    if (selectedSession.length) parts.push(`session ${humanJoin(selectedSession.slice(0, 2))}`);
    if (selectedLang.length) parts.push(`medium ${humanJoin(selectedLang.slice(0, 2))}`);

    if (!parts.length) {
      return "Browse handwritten hardcopy products by subject code, course, session, and medium.";
    }

    return `Showing results for ${parts.join(", ")}.`;
  }, [appliedSearch, selectedCourse, selectedSession, selectedLang]);

  const studentGuideParagraph = useMemo(() => {
    if (appliedSearch || selectedCourse.length || selectedSession.length || selectedLang.length) {
      return "Start with the exact subject code or title whenever possible, then match the course, session, and medium. This reduces mismatch and helps you reach the most relevant handwritten hardcopy product with fewer unnecessary clicks.";
    }

    return "Students usually search hardcopy material in a practical order: subject code or title first, then course, then session, then medium. This page follows the same pattern so browsing feels simpler and product matching feels more reliable.";
  }, [appliedSearch, selectedCourse.length, selectedSession.length, selectedLang.length]);

  const faqJsonLd = useMemo(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "How do I find the correct handwritten hardcopy product on this page?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Search the subject code or title first, then narrow the results using course, session, and medium filters. That is usually the fastest and safest method.",
          },
        },
        {
          "@type": "Question",
          name: "Can I preview handwriting samples before choosing a product?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Use the handwriting samples button tile near the top section to open the sample page quickly.",
          },
        },
        {
          "@type": "Question",
          name: "Why should I match the session and medium before ordering?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Matching the correct session and medium helps students select more relevant handwritten hardcopy material and reduces mismatch.",
          },
        },
        {
          "@type": "Question",
          name: "Does this page represent illegal or cheating services?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. The page includes an academic integrity note, and the student remains responsible for final academic submission.",
          },
        },
      ],
    };

    return JSON.stringify(schema);
  }, []);

  const collectionJsonLd = useMemo(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Handwritten Hardcopy Delivery",
      url: PAGE_URL,
      description:
        "Browse handwritten hardcopy products by subject code, course, session, and medium.",
      isPartOf: {
        "@type": "WebSite",
        name: "iStudentsPortal",
        url: "https://istudentsportal.com",
      },
      breadcrumb: {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: "https://istudentsportal.com",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Handwritten Hardcopy Delivery",
            item: PAGE_URL,
          },
        ],
      },
      numberOfItems: Number(meta.total || items.length || 0),
    };

    return JSON.stringify(schema);
  }, [meta.total, items.length]);

  return (
    <main className="min-h-screen font-sans text-slate-800 bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: collectionJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />

      <style jsx global>{`
        @keyframes floaty {
          0% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(0, -10px, 0);
          }
          100% {
            transform: translate3d(0, 0, 0);
          }
        }
        @keyframes shimmer {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        .isp-grid {
          background-image: radial-gradient(
            circle at 1px 1px,
            rgba(15, 23, 42, 0.07) 1px,
            transparent 0
          );
          background-size: 22px 22px;
        }
        .isp-floaty {
          animation: floaty 6s ease-in-out infinite;
        }
        .isp-shimmer {
          background-size: 200% 200%;
          animation: shimmer 10s ease-in-out infinite;
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
          <span className="text-blue-700 font-extrabold">{CATEGORY_LABEL}</span>
        </div>
      </div>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-[#f7f9ff]" />
        <div className="absolute inset-0 isp-grid opacity-60" />
        <div className="absolute -top-28 -left-28 h-[320px] w-[320px] rounded-full blur-3xl opacity-25 bg-gradient-to-br from-blue-500 via-indigo-500 to-cyan-400 isp-floaty" />
        <div className="absolute -bottom-36 -right-24 h-[380px] w-[380px] rounded-full blur-3xl opacity-20 bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-400 isp-floaty" />

        <div className="relative max-w-[1600px] mx-auto px-4 py-7 md:py-12">
          <div className="overflow-hidden rounded-[34px] border border-slate-200 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white shadow-[0_22px_80px_rgba(15,23,42,0.22)]">
            <div className="grid gap-6 px-5 py-6 md:px-7 md:py-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] lg:items-start">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-blue-100">
                  <Sparkles size={14} /> Handwritten + delivered to your address
                </div>

                <h1 className="mt-4 text-[28px] leading-tight md:text-5xl font-extrabold text-white">
                  Handwritten Hardcopy Delivery for IGNOU Students
                </h1>

                <p className="mt-3 max-w-3xl text-sm md:text-base font-medium leading-7 text-blue-50/90">
                  Real handwritten pages, neatly packed and delivered across India. Search by subject code,
                  course, session, and medium to find the right handwritten hardcopy faster.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-white text-[11px] md:text-sm font-extrabold">
                    {CATEGORY_LABEL}
                  </span>
                  {selectedCourse.length ? (
                    <span className="px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-white/95 text-[11px] md:text-sm font-bold">
                      Course: {selectedCourse.join(", ")}
                    </span>
                  ) : null}
                  {selectedSession.length ? (
                    <span className="px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-white/95 text-[11px] md:text-sm font-bold">
                      Session: {selectedSession.join(", ")}
                    </span>
                  ) : null}
                  {appliedSearch ? (
                    <span className="px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-white/95 text-[11px] md:text-sm font-bold">
                      Search: {appliedSearch}
                    </span>
                  ) : null}
                </div>

                <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { i: <Pencil size={16} className="text-blue-700" />, t: "Handwritten Pages" },
                    { i: <Package size={16} className="text-indigo-700" />, t: "Safe Packing" },
                    { i: <Truck size={16} className="text-cyan-700" />, t: "Fast Dispatch" },
                    { i: <MapPin size={16} className="text-violet-700" />, t: "All India Delivery" },
                  ].map((x) => (
                    <div
                      key={x.t}
                      className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur px-3 py-2 flex items-center gap-2"
                    >
                      <div className="rounded-xl bg-white px-2 py-2">{x.i}</div>
                      <div className="text-[11px] md:text-xs font-extrabold text-white">
                        {x.t}
                      </div>
                    </div>
                  ))}
                </div>

                {(quickSessions.length || quickLangs.length) && (
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {quickSessions.map((session) => {
                      const active = selectedSession.includes(session);
                      return (
                        <button
                          key={session}
                          type="button"
                          onClick={() => {
                            const next = active ? [] : [session];
                            setSelectedSession(next);
                            syncUrl({ session: next, page: 1 });
                          }}
                          className={`rounded-full px-3 py-2 text-[11px] font-extrabold transition ${
                            active
                              ? "bg-white text-slate-900 shadow-lg"
                              : "border border-white/15 bg-white/10 text-white hover:bg-white/15"
                          }`}
                        >
                          {session}
                        </button>
                      );
                    })}

                    {quickLangs.map((lang) => {
                      const active = selectedLang.includes(lang);
                      return (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => {
                            const next = active ? [] : [lang];
                            setSelectedLang(next);
                            syncUrl({ language: next, page: 1 });
                          }}
                          className={`rounded-full px-3 py-2 text-[11px] font-extrabold transition ${
                            active
                              ? "bg-cyan-300 text-slate-900 shadow-lg"
                              : "border border-white/15 bg-white/10 text-white hover:bg-white/15"
                          }`}
                        >
                          {lang}
                        </button>
                      );
                    })}

                    {(appliedSearch || activeFiltersCount) && (
                      <button
                        type="button"
                        onClick={handleClearAll}
                        className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-extrabold text-white/90 transition hover:bg-white/10"
                      >
                        Reset filters
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid gap-3">
                <SamplesButtonTile href="/handwriting-samples" />

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                      <BadgeCheck className="text-emerald-300" size={18} />
                      <div className="text-xs">
                        <div className="font-extrabold text-white">Readable handwriting</div>
                        <div className="font-bold text-blue-100/80">Better visual presentation</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                      <Truck className="text-cyan-300" size={18} />
                      <div className="text-xs">
                        <div className="font-extrabold text-white">Quick dispatch</div>
                        <div className="font-bold text-blue-100/80">Fast order flow</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 text-indigo-300" size={18} />
                    <div>
                      <div className="text-[11px] font-extrabold uppercase tracking-wide text-blue-100/90">
                        Academic integrity
                      </div>
                      <div className="mt-2 text-sm font-bold leading-6 text-white/95">
                        This page is presented with a clear integrity note. Students remain responsible for final submission.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-emerald-300/25 bg-emerald-400/10 p-4 text-sm font-semibold leading-6 text-emerald-50">
                  Match the correct <span className="font-extrabold text-white">course</span>,{" "}
                  <span className="font-extrabold text-white">session</span>, and{" "}
                  <span className="font-extrabold text-white">medium</span> before opening a handwritten hardcopy product page.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-[2] bg-white pb-2">
        <div className="max-w-[1600px] mx-auto px-4">
          <div className="-mt-1 md:mt-0">
            <div className="hidden lg:block">
              <FiltersPanel
                showSearch
                optionSets={optionSets}
                activeFiltersCount={activeFiltersCount}
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
                selectedSession={selectedSession}
                selectedLang={selectedLang}
                selectedCourse={selectedCourse}
                setSelectedSession={setSelectedSession}
                setSelectedLang={setSelectedLang}
                setSelectedCourse={setSelectedCourse}
                appliedSearch={appliedSearch}
                onClearAll={handleClearAll}
                syncUrl={syncUrl}
              />
            </div>

            <div className="space-y-3 lg:hidden">
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
                className="w-full rounded-2xl bg-blue-600 text-white font-extrabold py-3.5 shadow-lg active:scale-[0.99] transition flex items-center justify-center gap-2"
                type="button"
              >
                <Filter size={18} /> Open Filters
                {activeFiltersCount ? ` (${activeFiltersCount})` : ""}
              </button>

              {(appliedSearch || activeFiltersCount) ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/90 px-4 py-3">
                  <ActiveChips
                    appliedSearch={appliedSearch}
                    activeFiltersCount={activeFiltersCount}
                    selectedSession={selectedSession}
                    selectedLang={selectedLang}
                    selectedCourse={selectedCourse}
                    onClearAll={handleClearAll}
                    onRemoveSearch={() => {
                      setSearchInput("");
                      setAppliedSearch("");
                      syncUrl({ search: "", page: 1 });
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
            optionSets={optionSets}
            activeFiltersCount={activeFiltersCount}
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
            selectedSession={selectedSession}
            selectedLang={selectedLang}
            selectedCourse={selectedCourse}
            setSelectedSession={setSelectedSession}
            setSelectedLang={setSelectedLang}
            setSelectedCourse={setSelectedCourse}
            appliedSearch={appliedSearch}
            onClearAll={handleClearAll}
            syncUrl={syncUrl}
          />
        </div>
      </div>

      <section className="bg-[#f7f9ff] py-8 md:py-10 border-t border-gray-100">
        <div className="max-w-[1600px] mx-auto px-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur p-4">
              <div className="text-[12px] font-extrabold text-slate-800">
                Academic Integrity Note
              </div>
              <div className="mt-1 text-[12px] text-slate-600 font-semibold leading-relaxed">
                {INTEGRITY_NOTE}
              </div>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4">
              <div className="text-[12px] font-extrabold text-blue-800">Delivery & packing</div>
              <div className="mt-1 text-[12px] text-blue-900/80 font-semibold leading-relaxed">
                Safe packing, fast dispatch, and delivery across India. Delivery time may vary by location and workload.
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[28px] border border-slate-200 bg-white px-4 py-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)] md:px-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-sm font-extrabold uppercase tracking-wide text-blue-700">
                  {CATEGORY_LABEL}
                </div>
                <h2 className="mt-1 text-xl font-extrabold text-slate-900 md:text-2xl">
                  Find the right handwritten hardcopy faster
                </h2>
                <div className="mt-1 text-sm font-semibold text-slate-600">{resultSummary}</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left md:min-w-[260px]">
                <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                  Current status
                </div>
                <div className="mt-1 text-base font-extrabold text-slate-900">
                  {loading || filtersLoading ? "Loading…" : countText}
                </div>
                <div className="mt-1 text-[12px] font-semibold leading-5 text-slate-600">
                  Check the subject code, course, session, and medium before moving to product details.
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5">
            {loading ? (
              <ProductsGridSkeleton />
            ) : items.length === 0 ? (
              <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
                <div className="max-w-2xl">
                  <div className="text-lg font-extrabold text-slate-900">No products found</div>
                  <div className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                    Try a different subject code, remove a filter, or switch the session or medium to broaden the results.
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                      Search tip
                    </div>
                    <div className="mt-2 text-sm font-bold text-slate-900">
                      Try the exact subject code first
                    </div>
                    <p className="mt-2 text-[13px] font-medium leading-6 text-slate-600">
                      Codes like BEGC 101, BPSC 134, or MTE 01 usually return the cleanest hardcopy match.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                      Filter tip
                    </div>
                    <div className="mt-2 text-sm font-bold text-slate-900">
                      Remove one filter at a time
                    </div>
                    <p className="mt-2 text-[13px] font-medium leading-6 text-slate-600">
                      Sometimes the wrong session or medium filter blocks otherwise relevant handwritten hardcopy matches.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                      Reset
                    </div>
                    <div className="mt-2 text-sm font-bold text-slate-900">
                      Start again with a clean view
                    </div>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-blue-700"
                    >
                      Clear all filters
                    </button>
                  </div>
                </div>

                {similarCodes.length ? (
                  <div className="mt-6">
                    <div className="text-sm font-extrabold text-slate-900">
                      Try these code patterns
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {similarCodes.map((v) => (
                        <button
                          key={v}
                          onClick={() => setSearchInput(v)}
                          className="rounded-full border border-gray-200 px-3 py-1.5 text-[11px] font-extrabold text-slate-700 hover:bg-gray-50"
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

      <section className="bg-white border-t border-gray-100">
        <div className="max-w-[1600px] mx-auto px-4 py-10 md:py-12 space-y-6">
          <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <div className="grid gap-6 p-5 md:p-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:items-start">
              <div>
                <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-blue-700">
                  Student guide
                </div>

                <h2 className="mt-4 text-2xl font-extrabold leading-tight text-slate-900 md:text-3xl">
                  How to select the right handwritten hardcopy before ordering
                </h2>

                <p className="mt-3 text-sm font-medium leading-7 text-slate-700 md:text-[15px]">
                  {studentGuideParagraph}
                </p>

                <p className="mt-3 text-sm font-medium leading-7 text-slate-700 md:text-[15px]">
                  The usual safe order is simple: search the subject code or title first, then confirm the course,
                  then match the session, then check the medium, and only after that open the final product page.
                  This is especially useful on larger catalogues where many product names can look similar.
                </p>

                <p className="mt-3 text-sm font-medium leading-7 text-slate-700 md:text-[15px]">
                  Students who prefer physical reading, margin marking, and page-by-page revision often like hardcopy
                  material more than only digital browsing. That is why this page keeps the top portion compact for quick
                  discovery and uses the lower section to explain the practical checks that matter before ordering.
                </p>
              </div>

              <div className="grid gap-3">
                <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-2">
                    <Pencil className="mt-0.5 text-indigo-600" size={18} />
                    <div>
                      <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                        Preview first
                      </div>
                      <div className="mt-2 text-base font-extrabold text-slate-900">
                        Check handwriting samples before ordering
                      </div>
                      <p className="mt-2 text-[13px] font-medium leading-6 text-slate-600">
                        The samples button gives a faster preview flow without crowding the hero area.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-2">
                    <BadgeCheck className="mt-0.5 text-emerald-600" size={18} />
                    <div>
                      <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                        Before opening any product
                      </div>
                      <div className="mt-2 text-base font-extrabold text-slate-900">
                        Match course, session, and medium
                      </div>
                      <p className="mt-2 text-[13px] font-medium leading-6 text-slate-600">
                        These checks reduce mismatch and help students pick the correct hardcopy faster.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-blue-200 bg-blue-50/70 p-4 shadow-sm">
                  <div className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 text-blue-700" size={18} />
                    <div>
                      <div className="text-[11px] font-extrabold uppercase tracking-wide text-blue-700">
                        Current view
                      </div>
                      <div className="mt-2 text-base font-extrabold text-slate-900">{countText}</div>
                      <p className="mt-2 text-[13px] font-medium leading-6 text-slate-700">
                        {resultSummary}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)] md:p-6">
              <h3 className="text-xl font-extrabold text-slate-900">
                What to check before ordering handwritten hardcopy
              </h3>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-extrabold text-slate-900">1. Search the subject code or title</div>
                  <p className="mt-1 text-[14px] font-medium leading-6 text-slate-600">
                    Exact codes and titles usually bring cleaner matches than broad keyword browsing.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-extrabold text-slate-900">2. Match the correct course</div>
                  <p className="mt-1 text-[14px] font-medium leading-6 text-slate-600">
                    Course matching matters because similar subject names can exist across different programmes.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-extrabold text-slate-900">3. Confirm the session and medium</div>
                  <p className="mt-1 text-[14px] font-medium leading-6 text-slate-600">
                    Session and medium should be checked before moving to the final product detail page.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-extrabold text-slate-900">4. Review samples and delivery details</div>
                  <p className="mt-1 text-[14px] font-medium leading-6 text-slate-600">
                    Check handwriting style, packing expectations, and delivery note before placing the order.
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)] md:p-6">
              <h3 className="text-xl font-extrabold text-slate-900">
                When students prefer handwritten hardcopy
              </h3>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-extrabold text-slate-900">Physical reading comfort</div>
                  <p className="mt-1 text-[14px] font-medium leading-6 text-slate-600">
                    Many students focus better on paper than long digital scrolling.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-extrabold text-slate-900">Page-by-page revision</div>
                  <p className="mt-1 text-[14px] font-medium leading-6 text-slate-600">
                    Hardcopy material can feel easier for stepwise revision, marking, and quick review.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-extrabold text-slate-900">Visual clarity</div>
                  <p className="mt-1 text-[14px] font-medium leading-6 text-slate-600">
                    Students who like handwritten presentation often prefer it for a more familiar note-like feel.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-extrabold text-slate-900">Cleaner selection flow</div>
                  <p className="mt-1 text-[14px] font-medium leading-6 text-slate-600">
                    Using filters before opening products makes hardcopy browsing faster and more reliable.
                  </p>
                </div>
              </div>
            </article>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)] md:p-6">
            <h2 className="text-2xl font-extrabold text-slate-900">Frequently asked questions</h2>

            <div className="mt-5 divide-y divide-slate-200">
              <details className="group py-4" open>
                <summary className="cursor-pointer list-none pr-8 text-sm font-extrabold text-slate-900 marker:content-none">
                  How do I find the correct handwritten hardcopy product on this page?
                </summary>
                <p className="mt-3 text-[14px] font-medium leading-7 text-slate-600">
                  Search the subject code or title first, then narrow the results using course, session, and medium filters.
                  That is usually the fastest and safest method.
                </p>
              </details>

              <details className="group py-4">
                <summary className="cursor-pointer list-none pr-8 text-sm font-extrabold text-slate-900 marker:content-none">
                  Can I preview handwriting samples before choosing a product?
                </summary>
                <p className="mt-3 text-[14px] font-medium leading-7 text-slate-600">
                  Yes. Use the handwriting samples button tile near the top section to open the sample page quickly.
                </p>
              </details>

              <details className="group py-4">
                <summary className="cursor-pointer list-none pr-8 text-sm font-extrabold text-slate-900 marker:content-none">
                  Why should I match the session and medium before ordering?
                </summary>
                <p className="mt-3 text-[14px] font-medium leading-7 text-slate-600">
                  Matching the correct session and medium helps students select more relevant handwritten hardcopy material and reduces mismatch.
                </p>
              </details>

              <details className="group py-4">
                <summary className="cursor-pointer list-none pr-8 text-sm font-extrabold text-slate-900 marker:content-none">
                  Does this page represent illegal or cheating services?
                </summary>
                <p className="mt-3 text-[14px] font-medium leading-7 text-slate-600">
                  No. The page includes an academic integrity note, and the student remains responsible for final academic submission.
                </p>
              </details>
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)] md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="text-lg font-extrabold text-slate-900">
                  Want to browse everything?
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-600">
                  Explore all categories in one place, including solved assignments, previous year papers, guess papers, ebooks, projects, combo packs, and more.
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

          <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)] md:p-6">
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-6">
              Why choose us?
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { t: "Neat handwriting", d: "Readable, clean formatting for better visual presentation." },
                { t: "Safe packing", d: "Proper packing so the handwritten pages remain protected in transit." },
                { t: "All India delivery", d: "Delivery support across India with fast dispatch handling." },
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

          <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)] md:p-6">
            <div className="flex items-start gap-3">
              <BookOpen className="mt-1 text-blue-700" size={20} />
              <div>
                <div className="text-lg font-extrabold text-slate-900">
                  Hardcopy material for students who prefer physical revision
                </div>
                <p className="mt-2 text-sm font-medium leading-7 text-slate-600">
                  Some students revise better with physical pages, margin marking, and page-by-page reading.
                  This category is designed to help those students find the right handwritten hardcopy faster
                  without making the top of the page feel overloaded.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <FloatingButtons />
    </main>
  );
}