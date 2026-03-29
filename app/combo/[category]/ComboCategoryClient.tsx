"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Search,
  X,
  Sparkles,
  CheckCircle2,
  FileText,
  PenTool,
  Truck,
  BookOpen,
  Lightbulb,
  Layers3,
  FolderKanban,
  Lock,
  ArrowRight,
  BadgeCheck,
  Wand2,
  Boxes,
  Package2,
  ShoppingBag,
  ScanSearch,
  ShieldCheck,
  Clock3,
  Tags,
  ListChecks,
  CalendarClock,
  Languages,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import TopBar from "@/components/TopBar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingButtons from "@/components/FloatingButtons";
import ComboBundleCard from "@/components/combo/ComboBundleCard";
import MakeOwnComboCta from "@/components/combo/MakeOwnComboCta";
import { mapComboRecordToCardData, type ComboApiRecord } from "@/lib/comboData";

type ComboCategoryConfig = {
  slug: string;
  title: string;
  shortTitle: string;
  seoTitle: string;
  description: string;
  badge: string;
  type: "generic" | "pyq" | "hardcopy" | "inactive";
  icon: any;
  tone: string;
  accent: string;
  makeOwnComboText: string;
  heroNote: string;
  searchPlaceholder: string;
  bullets: string[];
};

type ComboApiResponse = {
  ok?: boolean;
  combos?: ComboApiRecord[];
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
  error?: string;
  message?: string;
};

type PublicCategorySetting = {
  id?: string;
  categorySlug?: string;
  categoryLabel?: string;
  isActive?: boolean;
  variant?: string;
  comboEnabled?: boolean;
  autoGenerationEnabled?: boolean;
  manualCombosEnabled?: boolean;
  makeOwnComboEnabled?: boolean;
  defaultComboKind?: string;
  defaultMinProductsRequired?: number;
  defaultMaxProductsAllowed?: number;
  discountType?: string;
  discountValue?: number;
  sameCategoryOnly?: boolean;
  sameSubjectOnly?: boolean;
  sameMediumOnly?: boolean;
  useLatestSessionsOnly?: boolean;
  latestProductCount?: number;
  ui?: {
    title?: string;
    shortTitle?: string;
    badge?: string;
    heroNote?: string;
    searchPlaceholder?: string;
    makeOwnComboText?: string;
  };
  sortOrder?: number;
};

type PublicCategorySettingResponse = {
  ok?: boolean;
  settings?: PublicCategorySetting[];
  count?: number;
  error?: string;
};

function safeText(x: any) {
  return String(x ?? "").trim();
}

function TonePill({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] md:text-xs font-extrabold border ${className}`}
    >
      {children}
    </span>
  );
}

function SearchOverlay({
  open,
  onClose,
  categoryTitle,
  initialValue,
  categorySlug,
}: {
  open: boolean;
  onClose: () => void;
  categoryTitle: string;
  initialValue: string;
  categorySlug: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialValue);

  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  const runSearch = (raw?: string) => {
    const q = safeText(raw ?? query);
    onClose();

    if (!q) {
      router.replace(`/combo/${encodeURIComponent(categorySlug)}`, {
        scroll: false,
      });
      return;
    }

    router.replace(
      `/combo/${encodeURIComponent(categorySlug)}?search=${encodeURIComponent(
        q
      )}`,
      { scroll: false }
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/55 backdrop-blur-sm flex items-start justify-center pt-20 px-4">
      <div className="w-full max-w-2xl rounded-[28px] border border-gray-100 bg-white shadow-2xl overflow-hidden">
        <div className="p-4 md:p-5 border-b border-gray-100 flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center">
            <Search size={19} />
          </div>

          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runSearch();
            }}
            type="text"
            placeholder={`Search in ${categoryTitle} combos...`}
            className="flex-1 h-11 outline-none text-base md:text-lg text-slate-800 placeholder:text-gray-400"
          />

          <button
            onClick={() => runSearch()}
            className="hidden sm:inline-flex h-11 px-6 rounded-2xl bg-[#1E40AF] text-white font-extrabold items-center justify-center hover:bg-blue-800 transition"
            type="button"
          >
            Search
          </button>

          <button
            onClick={onClose}
            className="h-11 w-11 rounded-2xl hover:bg-gray-100 text-gray-600 transition flex items-center justify-center"
            aria-label="Close search"
            type="button"
          >
            <X size={19} />
          </button>
        </div>

        <div className="p-5 bg-gray-50">
          <div className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">
            Search Tips
          </div>
          <p className="text-sm font-semibold text-slate-600 mt-2 leading-relaxed">
            Search by subject code, title, medium, session, or course code to
            narrow down the available combo packs in this category.
          </p>
        </div>
      </div>

      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}

function PaginationBar({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);

  for (let i = start; i <= end; i += 1) pages.push(i);

  return (
    <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-[24px] border border-gray-200 bg-white px-4 py-4 shadow-sm">
      <div className="text-sm font-extrabold text-slate-700">
        Page <span className="text-blue-700">{page}</span> of{" "}
        <span className="text-slate-900">{totalPages}</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-center">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronsLeft size={16} />
          Prev
        </button>

        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={`h-10 min-w-[40px] rounded-xl px-3 text-sm font-extrabold transition ${
              p === page
                ? "bg-[#1E40AF] text-white shadow"
                : "border border-gray-200 bg-white text-slate-700 hover:bg-gray-50"
            }`}
          >
            {p}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
}

const CATEGORY_CONFIGS: ComboCategoryConfig[] = [
  {
    slug: "solved-assignments",
    title: "Solved Assignments Combos",
    shortTitle: "Solved Assignments",
    seoTitle: "IGNOU Solved Assignments Combo Packs",
    description:
      "Explore combo packs designed for solved assignments with faster browsing, better selection, and stronger value in one place.",
    badge: "Popular Combo Category",
    type: "generic",
    icon: FileText,
    tone: "bg-blue-50 text-blue-700 border-blue-100",
    accent: "bg-gradient-to-br from-blue-100 via-indigo-50 to-cyan-50",
    makeOwnComboText:
      "Create a custom solved assignments combo from eligible products in this category.",
    heroNote:
      "Explore saved combo packs for solved assignments in one dedicated section.",
    searchPlaceholder:
      "Search by subject code, assignment title, medium, or session...",
    bullets: [
      "Curated combo packs",
      "Category-focused selection",
      "Faster bundle discovery",
    ],
  },
  {
    slug: "question-papers",
    title: "PYQ Combos",
    shortTitle: "PYQs",
    seoTitle: "IGNOU PYQ 3-Year and 5-Year Combo Packs",
    description:
      "Browse Previous Year Paper combo packs built for quick exam preparation, focused revision, and better session-wise selection.",
    badge: "Special Combo Rules",
    type: "pyq",
    icon: BookOpen,
    tone: "bg-emerald-50 text-emerald-700 border-emerald-100",
    accent: "bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-50",
    makeOwnComboText:
      "Create a custom PYQ combo from eligible products in this category.",
    heroNote:
      "Explore previous year paper combo packs with a dedicated browsing experience.",
    searchPlaceholder:
      "Search by subject code, medium, session, or PYQ title...",
    bullets: [
      "Exam-focused combo packs",
      "Session-aware discovery",
      "Streamlined bundle browsing",
    ],
  },
  {
    slug: "guess-papers",
    title: "Guess Papers Combos",
    shortTitle: "Guess Papers",
    seoTitle: "IGNOU Guess Papers Combo Bundles",
    description:
      "Browse combo bundles for guess papers designed to simplify preparation and help you find related material faster.",
    badge: "Exam Combo Zone",
    type: "generic",
    icon: Lightbulb,
    tone: "bg-amber-50 text-amber-700 border-amber-100",
    accent: "bg-gradient-to-br from-amber-100 via-yellow-50 to-orange-50",
    makeOwnComboText:
      "Create a custom guess papers combo from eligible products in this category.",
    heroNote:
      "Find guess paper combo packs in one focused exam-preparation section.",
    searchPlaceholder:
      "Search by guess paper title, subject code, or medium...",
    bullets: [
      "Exam-ready bundles",
      "Focused category selection",
      "Quick combo discovery",
    ],
  },
  {
    slug: "ebooks-notes",
    title: "Ebooks / Notes Combos",
    shortTitle: "Ebooks/Notes",
    seoTitle: "IGNOU Ebooks and Notes Combo Packs",
    description:
      "Explore digital combo packs for ebooks and notes with a clean browsing experience and easy bundle comparison.",
    badge: "Digital Combo Packs",
    type: "generic",
    icon: Layers3,
    tone: "bg-cyan-50 text-cyan-700 border-cyan-100",
    accent: "bg-gradient-to-br from-cyan-100 via-sky-50 to-blue-50",
    makeOwnComboText:
      "Create a custom ebooks or notes combo from eligible products in this category.",
    heroNote:
      "Explore digital combo packs for notes and ebooks in one organized space.",
    searchPlaceholder:
      "Search by ebook title, note topic, subject code, or medium...",
    bullets: [
      "Digital bundle selection",
      "Easy combo comparison",
      "Clean discovery layout",
    ],
  },
  {
    slug: "handwritten-pdfs",
    title: "Handwritten PDFs Combos",
    shortTitle: "Handwritten PDFs",
    seoTitle: "IGNOU Handwritten PDF Combo Packs",
    description:
      "Browse handwritten PDF combo packs with a clean digital-first layout and easy access to bundled study material.",
    badge: "Handwritten Digital Bundles",
    type: "generic",
    icon: PenTool,
    tone: "bg-violet-50 text-violet-700 border-violet-100",
    accent: "bg-gradient-to-br from-violet-100 via-fuchsia-50 to-pink-50",
    makeOwnComboText:
      "Create a custom handwritten PDF combo from eligible products in this category.",
    heroNote:
      "Explore handwritten PDF combo packs in a dedicated digital bundle section.",
    searchPlaceholder:
      "Search by handwritten PDF title, subject code, or medium...",
    bullets: [
      "Digital handwritten combos",
      "Focused bundle display",
      "Easy product scanning",
    ],
  },
  {
    slug: "handwritten-hardcopy",
    title: "Handwritten Hardcopy Delivery Combos",
    shortTitle: "Handwritten Hardcopy",
    seoTitle: "IGNOU Handwritten Hardcopy Delivery Combo Packs",
    description:
      "Explore handwritten hardcopy combo packs with a delivery-focused experience, clearer trust signals, and better product grouping.",
    badge: "Physical Delivery Combo Packs",
    type: "hardcopy",
    icon: Truck,
    tone: "bg-orange-50 text-orange-700 border-orange-100",
    accent: "bg-gradient-to-br from-orange-100 via-amber-50 to-yellow-50",
    makeOwnComboText:
      "Create a custom handwritten hardcopy combo from eligible products in this category.",
    heroNote:
      "Explore delivery-ready handwritten combo packs in one focused section.",
    searchPlaceholder:
      "Search by subject code, hardcopy combo title, medium, or session...",
    bullets: [
      "Delivery-focused combos",
      "Physical product clarity",
      "Better bundle browsing",
    ],
  },
  {
    slug: "projects-synopsis",
    title: "Project & Synopsis Combos",
    shortTitle: "Project & Synopsis",
    seoTitle: "IGNOU Project and Synopsis Combo Packs",
    description: "This combo category is currently unavailable.",
    badge: "Unavailable",
    type: "inactive",
    icon: FolderKanban,
    tone: "bg-slate-100 text-slate-600 border-slate-200",
    accent: "bg-gradient-to-br from-slate-100 via-gray-50 to-zinc-50",
    makeOwnComboText: "This category is currently unavailable.",
    heroNote: "This section is not active right now.",
    searchPlaceholder: "Search is unavailable for this category",
    bullets: ["Currently unavailable", "Reserved category space", "Coming later"],
  },
];

const ITEMS_PER_PAGE = 20;

export default function ComboCategoryClient({
  categorySlug,
  initialSearchParam = "",
}: {
  categorySlug: string;
  initialSearchParam?: string;
}) {
  const router = useRouter();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(initialSearchParam);
  const [currentPage, setCurrentPage] = useState(1);

  const [loadingCombos, setLoadingCombos] = useState(false);
  const [comboError, setComboError] = useState("");
  const [comboRecords, setComboRecords] = useState<ComboApiRecord[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loadingSetting, setLoadingSetting] = useState(false);
  const [publicSetting, setPublicSetting] =
    useState<PublicCategorySetting | null>(null);

  const config = useMemo(() => {
    return (
      CATEGORY_CONFIGS.find((x) => x.slug === safeText(categorySlug)) ||
      CATEGORY_CONFIGS.find((x) => x.slug === "solved-assignments")!
    );
  }, [categorySlug]);

  useEffect(() => {
    setSearchInput(initialSearchParam);
    setCurrentPage(1);
  }, [initialSearchParam, categorySlug]);

  const Icon = config.icon;
  const isInactive = config.type === "inactive";
  const isPyq = config.type === "pyq";
  const isHardcopy = config.type === "hardcopy";

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoadingSetting(true);

        const res = await fetch(
          `/api/combo-category-settings?categorySlug=${encodeURIComponent(
            config.slug
          )}`,
          { cache: "no-store" }
        );

        const data: PublicCategorySettingResponse = await res
          .json()
          .catch(() => ({}));

        if (!res.ok) {
          if (!active) return;
          setPublicSetting(null);
          return;
        }

        const first = Array.isArray(data?.settings) ? data.settings[0] : null;
        if (!active) return;
        setPublicSetting(first || null);
      } catch {
        if (!active) return;
        setPublicSetting(null);
      } finally {
        if (active) setLoadingSetting(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [config.slug]);

  useEffect(() => {
    if (isInactive) {
      setComboRecords([]);
      setLoadingCombos(false);
      setComboError("");
      setTotalItems(0);
      setTotalPages(1);
      return;
    }

    let active = true;

    (async () => {
      try {
        setLoadingCombos(true);
        setComboError("");

        const params = new URLSearchParams();
        params.set("category", config.slug);
        params.set("page", String(currentPage));
        params.set("limit", String(ITEMS_PER_PAGE));

        if (safeText(initialSearchParam)) {
          params.set("search", safeText(initialSearchParam));
        }

        const res = await fetch(`/api/combos?${params.toString()}`, {
          cache: "no-store",
        });

        const data: ComboApiResponse = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || data?.message || "Failed to load combos");
        }

        if (!active) return;

        const apiCombos = Array.isArray(data?.combos) ? data.combos : [];
        const apiPagination = data?.pagination || {};

        setComboRecords(apiCombos);
        setTotalItems(Number(apiPagination?.total || 0));
        setTotalPages(Math.max(1, Number(apiPagination?.totalPages || 1)));
        setComboError("");
      } catch (e: any) {
        if (!active) return;
        setComboError(e?.message || "Failed to load combos");
        setComboRecords([]);
        setTotalItems(0);
        setTotalPages(1);
      } finally {
        if (active) setLoadingCombos(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [config.slug, initialSearchParam, isInactive, currentPage]);

  const runInlineSearch = (raw?: string) => {
    if (isInactive) return;

    const q = safeText(raw ?? searchInput);

    if (!q) {
      router.replace(`/combo/${encodeURIComponent(config.slug)}`, {
        scroll: false,
      });
      return;
    }

    router.replace(
      `/combo/${encodeURIComponent(config.slug)}?search=${encodeURIComponent(q)}`,
      { scroll: false }
    );
  };

  const builderEnabled = useMemo(() => {
    if (isInactive) return false;
    if (!publicSetting) return false;
    if (!publicSetting.isActive) return false;
    if (!publicSetting.comboEnabled) return false;
    return !!publicSetting.makeOwnComboEnabled;
  }, [isInactive, publicSetting]);

  const effectiveTitle = useMemo(() => {
    return safeText(publicSetting?.ui?.title) || config.title;
  }, [publicSetting, config.title]);

  const effectiveBadge = useMemo(() => {
    return safeText(publicSetting?.ui?.badge) || config.badge;
  }, [publicSetting, config.badge]);

  const builderTitle = "Create Your Own Combo";

  const builderDescription = useMemo(() => {
    return safeText(publicSetting?.ui?.makeOwnComboText) || config.makeOwnComboText;
  }, [publicSetting, config.makeOwnComboText]);

  const effectiveSearchPlaceholder = useMemo(() => {
    return (
      safeText(publicSetting?.ui?.searchPlaceholder) || config.searchPlaceholder
    );
  }, [publicSetting, config.searchPlaceholder]);

  const effectiveHeroNote = useMemo(() => {
    return safeText(publicSetting?.ui?.heroNote) || config.heroNote;
  }, [publicSetting, config.heroNote]);

  const builderNote = useMemo(() => {
    if (loadingSetting) return "Checking combo builder options...";
    if (!publicSetting)
      return "Custom combo options are not available for this category right now.";

    const min = Number(publicSetting.defaultMinProductsRequired || 0);
    const max = Number(publicSetting.defaultMaxProductsAllowed || 0);
    const sameCategory = publicSetting.sameCategoryOnly
      ? "same category only"
      : "mixed category rules may apply";

    if (min > 0 && max > 0) {
      return `Select between ${min} and ${max} products • ${sameCategory}.`;
    }

    if (min > 0) {
      return `Minimum ${min} products required • ${sameCategory}.`;
    }

    return `Available products will follow the current combo rules for this category.`;
  }, [loadingSetting, publicSetting]);

  return (
    <main className="min-h-screen font-sans text-slate-800 bg-white">
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

      <SearchOverlay
        open={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        categoryTitle={config.shortTitle}
        initialValue={initialSearchParam}
        categorySlug={config.slug}
      />

      <div className="bg-white border-b border-gray-100">
        <div className="max-w-[1600px] mx-auto px-4 py-3 text-[13px] text-gray-500 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <Link href="/" className="hover:text-blue-700 font-semibold">
            Home
          </Link>
          <ChevronRight size={14} className="text-gray-300" />
          <Link href="/combo" className="hover:text-blue-700 font-semibold">
            Combo
          </Link>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="text-blue-700 font-extrabold">{config.shortTitle}</span>
        </div>
      </div>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-[#f7f9ff]" />
        <div className="absolute inset-0 isp-grid opacity-60" />
        <div className="absolute -top-28 -left-28 h-[320px] w-[320px] rounded-full blur-3xl opacity-25 bg-gradient-to-br from-blue-500 via-indigo-500 to-cyan-400 isp-floaty" />
        <div className="absolute -bottom-36 -right-24 h-[380px] w-[380px] rounded-full blur-3xl opacity-20 bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-400 isp-floaty" />

        <div className="relative max-w-[1600px] mx-auto px-4 py-6 md:py-12">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-5 md:gap-8 items-start">
            <div className="min-w-0">
              <div
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-extrabold border ${config.tone}`}
              >
                <Sparkles size={14} />
                {effectiveBadge}
              </div>

              <h1 className="mt-3 text-[26px] leading-tight md:text-5xl font-extrabold text-slate-900">
                {effectiveTitle}
              </h1>

              <p className="mt-3 text-sm md:text-lg font-medium text-slate-600 max-w-3xl leading-relaxed">
                {config.description}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <TonePill className="bg-white/90 text-slate-700 border-gray-200 shadow-sm">
                  {config.seoTitle}
                </TonePill>
                <TonePill className="bg-emerald-50 text-emerald-700 border-emerald-100 shadow-sm">
                  {ITEMS_PER_PAGE} combos per page
                </TonePill>
                {builderEnabled ? (
                  <TonePill className="bg-violet-50 text-violet-700 border-violet-100 shadow-sm">
                    Custom combo available
                  </TonePill>
                ) : null}
                {isPyq ? (
                  <TonePill className="bg-emerald-50 text-emerald-700 border-emerald-100 shadow-sm">
                    Previous year paper bundles
                  </TonePill>
                ) : null}
                {isHardcopy ? (
                  <TonePill className="bg-orange-50 text-orange-700 border-orange-100 shadow-sm">
                    Delivery-focused bundles
                  </TonePill>
                ) : null}
                {isInactive ? (
                  <TonePill className="bg-slate-100 text-slate-600 border-slate-200 shadow-sm">
                    Category unavailable
                  </TonePill>
                ) : null}
              </div>

              {!isInactive ? (
                <div className="mt-5 md:mt-6 rounded-[24px] md:rounded-[28px] border border-gray-200 bg-white/90 backdrop-blur shadow-xl p-3 md:p-4">
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0 px-3 py-3 rounded-2xl border border-gray-200 bg-white">
                      <div className="h-11 w-11 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center shrink-0">
                        <ScanSearch size={20} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                          Search Combos
                        </div>
                        <input
                          value={searchInput}
                          onChange={(e) => setSearchInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") runInlineSearch();
                          }}
                          placeholder={effectiveSearchPlaceholder}
                          className="w-full mt-1 bg-transparent outline-none text-sm md:text-base font-semibold text-slate-800 placeholder:text-gray-400"
                        />
                      </div>

                      {searchInput ? (
                        <button
                          onClick={() => {
                            setSearchInput("");
                            router.replace(`/combo/${encodeURIComponent(config.slug)}`, {
                              scroll: false,
                            });
                          }}
                          className="h-9 w-9 rounded-xl hover:bg-gray-100 text-gray-500 flex items-center justify-center transition shrink-0"
                          type="button"
                          aria-label="Clear search"
                        >
                          <X size={16} />
                        </button>
                      ) : null}
                    </div>

                    <div className="flex gap-2 md:shrink-0">
                      <button
                        onClick={() => runInlineSearch()}
                        className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#1E40AF] text-white font-extrabold hover:bg-blue-800 transition shadow-lg"
                        type="button"
                      >
                        <Search size={18} />
                        Search
                      </button>

                      <button
                        onClick={() => setIsSearchOpen(true)}
                        className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-gray-200 bg-white text-slate-800 font-extrabold hover:bg-gray-50 transition"
                        type="button"
                      >
                        Advanced
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 hidden sm:flex flex-wrap gap-2">
                    {["Subject Code", "Session", "Medium", "Title", "Course Code"].map(
                      (x) => (
                        <span
                          key={x}
                          className="px-3 py-1 rounded-full bg-gray-50 border border-gray-200 text-[11px] font-extrabold text-slate-600"
                        >
                          {x}
                        </span>
                      )
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-200 text-slate-500 font-extrabold">
                  <Lock size={18} />
                  Search is currently unavailable
                </div>
              )}

              <div className="hidden md:grid mt-6 grid-cols-3 gap-3">
                {config.bullets.map((x, i) => (
                  <div
                    key={`${x}-${i}`}
                    className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-sm p-4"
                  >
                    <div className="flex items-start gap-3">
                      <CheckCircle2
                        className="text-emerald-600 mt-0.5"
                        size={18}
                      />
                      <div className="text-sm font-extrabold text-slate-900 leading-snug">
                        {x}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="min-w-0">
              <div className="hidden md:grid grid-cols-2 gap-3 mb-3">
                <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-sm p-4">
                  <div className="flex items-center gap-2">
                    <Package2 className="text-blue-600" size={18} />
                    <div className="text-xs">
                      <div className="font-extrabold text-slate-900">
                        Curated Bundles
                      </div>
                      <div className="font-bold text-gray-500">
                        One dedicated category view
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-sm p-4">
                  <div className="flex items-center gap-2">
                    <Tags className="text-emerald-600" size={18} />
                    <div className="text-xs">
                      <div className="font-extrabold text-slate-900">
                        Better Value
                      </div>
                      <div className="font-bold text-gray-500">
                        Combo-first product discovery
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-sm p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="text-indigo-600" size={18} />
                    <div className="text-xs">
                      <div className="font-extrabold text-slate-900">
                        Clean Selection
                      </div>
                      <div className="font-bold text-gray-500">
                        Focused browsing experience
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-sm p-4">
                  <div className="flex items-center gap-2">
                    <Clock3 className="text-orange-600" size={18} />
                    <div className="text-xs">
                      <div className="font-extrabold text-slate-900">
                        Fast Scanning
                      </div>
                      <div className="font-bold text-gray-500">
                        Easy-to-compare combo cards
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={`rounded-[26px] md:rounded-[30px] border border-gray-200 shadow-xl overflow-hidden ${config.accent}`}
              >
                <div className="p-4 md:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="h-14 w-14 md:h-16 md:w-16 rounded-[20px] md:rounded-[22px] bg-white/85 backdrop-blur border border-white/90 shadow-sm flex items-center justify-center shrink-0">
                      <Icon size={28} className="text-slate-800" />
                    </div>

                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-3 py-1 text-[10px] md:text-[11px] font-extrabold shadow">
                      <Wand2 size={12} />
                      COMBO COLLECTION
                    </span>
                  </div>

                  <div className="mt-4 md:mt-5 rounded-[22px] md:rounded-[24px] bg-white/88 backdrop-blur border border-white/80 shadow-sm p-4">
                    <div className="text-[15px] md:text-sm font-extrabold text-slate-900 leading-relaxed">
                      {effectiveHeroNote}
                    </div>
                    <div className="hidden md:block mt-2 text-xs font-bold text-slate-600 leading-relaxed">
                      Browse compact combo cards, compare bundle details, and
                      open the full combo page for pricing, included products,
                      and checkout-ready information.
                    </div>
                  </div>

                  <div className="hidden md:grid mt-4 grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white/88 backdrop-blur border border-white/80 px-4 py-4 shadow-sm">
                      <div className="text-[11px] font-extrabold text-slate-500 uppercase">
                        Layout Focus
                      </div>
                      <div className="mt-1 text-sm font-extrabold text-slate-900">
                        Faster combo discovery
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/88 backdrop-blur border border-white/80 px-4 py-4 shadow-sm">
                      <div className="text-[11px] font-extrabold text-slate-500 uppercase">
                        Detail View
                      </div>
                      <div className="mt-1 text-sm font-extrabold text-slate-900">
                        Full combo information
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Link
                      href="/combo"
                      className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-800 hover:text-blue-700 transition"
                    >
                      Back to all combo categories
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {!isInactive ? (
            <div className="hidden md:block mt-7 rounded-[28px] border border-gray-200 bg-white/85 backdrop-blur shadow-sm p-5">
              <div className="text-base font-extrabold text-slate-900">
                {config.seoTitle}
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-600 leading-relaxed">
                This page is designed for combo discovery, easier comparison,
                and faster access to bundled study material within this category.
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="bg-[#f7f9ff] py-8 md:py-10 border-t border-gray-100">
        <div className="max-w-[1600px] mx-auto px-4">
          {!isInactive ? (
            <>
              <div className="mb-5 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900">
                    {isPyq ? "Featured PYQ Combo Packs" : "Featured Combo Packs"}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    Explore available combo bundles in this category.
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-full bg-white border border-gray-200 px-4 py-2 text-xs font-extrabold text-slate-700 shadow-sm">
                  <ShoppingBag size={15} />
                  {totalItems} total bundles
                </div>
              </div>

              {loadingCombos ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm font-extrabold text-slate-600">
                  Loading combo bundles...
                </div>
              ) : comboError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
                  <div className="text-base font-extrabold text-red-700">
                    Unable to load combos
                  </div>
                  <div className="mt-1 text-sm font-semibold text-red-600">
                    {comboError}
                  </div>
                </div>
              ) : comboRecords.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
                  <div className="text-base font-extrabold text-slate-900">
                    No combo packs available right now
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-600">
                    Please check back later or explore another combo category.
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    {comboRecords.map((combo, index) => {
                      const mapped = mapComboRecordToCardData(combo);
                      if (!mapped) return null;

                      return (
                        <ComboBundleCard
                          key={combo.id || `${combo.title}-${index}`}
                          data={mapped}
                        />
                      );
                    })}
                  </div>

                  <PaginationBar
                    page={currentPage}
                    totalPages={totalPages}
                    onPageChange={(page) => {
                      if (page < 1 || page > totalPages || page === currentPage)
                        return;
                      setCurrentPage(page);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  />
                </>
              )}

              <div className="mt-8">
                <MakeOwnComboCta
                  title={builderTitle}
                  description={builderDescription}
                  buttonText="Open Builder"
                  disabled={!builderEnabled}
                  href={`/combo/${encodeURIComponent(config.slug)}/builder`}
                  note={builderNote}
                />
              </div>

              <div className="mt-5">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-start gap-3">
                      <ListChecks className="text-emerald-600 mt-0.5" size={18} />
                      <div className="text-sm font-extrabold text-slate-900 leading-relaxed">
                        Minimum{" "}
                        {Number(publicSetting?.defaultMinProductsRequired || 0) || 0}{" "}
                        products required
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-start gap-3">
                      <Boxes className="text-blue-600 mt-0.5" size={18} />
                      <div className="text-sm font-extrabold text-slate-900 leading-relaxed">
                        {publicSetting?.sameCategoryOnly
                          ? "Eligible products from the same category only"
                          : "Bundle rules may vary by category settings"}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-start gap-3">
                      {isPyq ? (
                        <Languages className="text-amber-600 mt-0.5" size={18} />
                      ) : isHardcopy ? (
                        <CalendarClock className="text-orange-600 mt-0.5" size={18} />
                      ) : (
                        <CheckCircle2 className="text-emerald-600 mt-0.5" size={18} />
                      )}
                      <div className="text-sm font-extrabold text-slate-900 leading-relaxed">
                        Combo rules for this category are applied automatically
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-[28px] border border-gray-200 bg-white shadow-sm p-8 text-center">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center">
                <Lock size={28} />
              </div>
              <h2 className="mt-4 text-2xl font-extrabold text-slate-900">
                This combo category is currently unavailable
              </h2>
              <p className="mt-2 text-sm font-semibold text-slate-600 max-w-2xl mx-auto leading-relaxed">
                This section is not active right now. Please explore other combo
                categories available on the site.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="bg-white border-t border-gray-100 pt-10 md:pt-12">
        <div className="max-w-[1600px] mx-auto px-4">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="min-w-0">
                <div className="text-lg md:text-xl font-extrabold text-slate-900">
                  A cleaner combo browsing experience
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-600 leading-relaxed">
                  Browse combo packs, compare bundles faster, and open full
                  combo pages for product details, pricing, and checkout-ready
                  information.
                </div>
              </div>

              <Link
                href="/combo"
                className="inline-flex items-center justify-center px-5 py-3 rounded-2xl bg-[#1E40AF] text-white font-extrabold hover:bg-blue-800 transition"
              >
                Back to Combo Categories →
              </Link>
            </div>
          </div>

          <div className="mt-10 md:mt-12">
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-6">
              Why combo pages are easier to use
            </h2>

            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  t: "Clear combo-first layout",
                  d: "Each page is focused on bundled products, making selection simpler and more organized.",
                },
                {
                  t: "Faster search and scanning",
                  d: "Search by code, title, medium, or session to reach the most relevant combo packs quickly.",
                },
                {
                  t: "Easy custom combo access",
                  d: "Where enabled, the builder option makes it easier to create a category-based custom combo.",
                },
              ].map((x) => (
                <div
                  key={x.t}
                  className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5"
                >
                  <div className="flex items-start gap-3">
                    <BadgeCheck className="text-emerald-600 mt-0.5" size={18} />
                    <div>
                      <div className="font-extrabold text-slate-900">{x.t}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-600 leading-relaxed">
                        {x.d}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <FloatingButtons />
    </main>
  );
}