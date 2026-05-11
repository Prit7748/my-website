"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  X,
  FileText,
  PenTool,
  Truck,
  BookOpen,
  Lightbulb,
  FolderKanban,
  Layers3,
  Lock,
  ArrowRight,
  ChevronRight,
  Sparkles,
  Package,
  ScrollText,
  NotebookPen,
  LibraryBig,
  Boxes,
} from "lucide-react";

import TopBar from "@/components/TopBar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingButtons from "@/components/FloatingButtons";

type ComboTile = {
  title: string;
  comboLabel: string;
  description: string;
  href?: string;
  badge: string;
  status: "active" | "inactive" | "expand";
  icon: any;
  tone: {
    card: string;
    icon: string;
    badge: string;
    glow: string;
    mesh: string;
  };
  deco: any[];
};

function safeText(x: any) {
  return String(x ?? "").trim();
}

function SearchOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  const runSearch = () => {
    const q = safeText(query);
    if (!q) return;
    window.location.href = `/products?search=${encodeURIComponent(q)}`;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/55 backdrop-blur-sm flex items-start justify-center pt-20 px-4">
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
            placeholder="Search by subject code, title, medium, or session..."
            className="flex-1 h-11 outline-none text-base md:text-lg text-slate-800 placeholder:text-gray-400"
          />

          <button
            onClick={runSearch}
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
          <p className="text-sm font-semibold text-slate-600 leading-relaxed">
            Use search to quickly find relevant study material by code, title,
            language, or session.
          </p>
        </div>
      </div>

      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}

function DecorativeIcons({
  icons,
  className = "",
}: {
  icons: any[];
  className?: string;
}) {
  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`}>
      {icons.map((Icon, i) => (
        <div
          key={i}
          className={`absolute text-slate-900/10 ${
            i === 0
              ? "top-3 right-4"
              : i === 1
              ? "bottom-4 right-12"
              : i === 2
              ? "bottom-8 left-4"
              : "top-12 left-8"
          }`}
        >
          <Icon size={i === 0 ? 30 : i === 1 ? 24 : i === 2 ? 22 : 18} />
        </div>
      ))}
    </div>
  );
}

function ActiveTile({
  tile,
}: {
  tile: ComboTile;
}) {
  const Icon = tile.icon;

  return (
    <Link
      href={tile.href || "/combo"}
      className={`group relative rounded-[24px] md:rounded-[28px] border overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 ${tile.tone.card}`}
    >
      <div className={`absolute inset-0 ${tile.tone.mesh}`} />
      <div
        className={`absolute -top-12 -right-10 h-32 w-32 md:h-36 md:w-36 rounded-full blur-3xl ${tile.tone.glow}`}
      />
      <DecorativeIcons icons={tile.deco} />

      <div className="relative p-4 md:p-6 min-h-[178px] sm:min-h-[205px] md:min-h-[280px] flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div
            className={`h-12 w-12 md:h-16 md:w-16 rounded-[18px] md:rounded-[22px] border shadow-sm flex items-center justify-center ${tile.tone.icon}`}
          >
            <Icon size={22} className="md:w-[30px] md:h-[30px]" />
          </div>

          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] md:text-[11px] font-extrabold border shadow-sm ${tile.tone.badge}`}
          >
            {tile.badge}
          </span>
        </div>

        <div className="mt-3 md:mt-5">
          <div className="text-[11px] md:text-[14px] font-black uppercase tracking-[0.16em] text-slate-600">
            {tile.comboLabel}
          </div>

          <h2 className="mt-1.5 md:mt-2 text-[19px] md:text-[28px] leading-[1.08] font-black text-slate-900 group-hover:text-blue-800 transition">
            {tile.title}
          </h2>
        </div>

        <p className="mt-2 md:mt-3 text-[12px] md:text-[15px] font-semibold text-slate-700 leading-relaxed max-w-full md:max-w-[92%] line-clamp-2 md:line-clamp-none">
          {tile.description}
        </p>

        <div className="mt-auto pt-3 md:pt-6">
          <div className="inline-flex items-center gap-1.5 md:gap-2 rounded-xl md:rounded-2xl px-3 py-2 md:px-4 md:py-3 bg-white/90 backdrop-blur border border-white/80 text-blue-700 font-black text-[12px] md:text-sm shadow-sm group-hover:bg-white">
            Explore
            <ArrowRight
              size={15}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </div>
        </div>
      </div>
    </Link>
  );
}

function InactiveTile({
  tile,
}: {
  tile: ComboTile;
}) {
  const Icon = tile.icon;

  return (
    <div
      className={`group relative rounded-[24px] md:rounded-[28px] border overflow-hidden shadow-sm ${tile.tone.card}`}
    >
      <div className={`absolute inset-0 ${tile.tone.mesh}`} />
      <DecorativeIcons icons={tile.deco} />

      <div className="relative p-4 md:p-6 min-h-[178px] sm:min-h-[205px] md:min-h-[280px] flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div
            className={`h-12 w-12 md:h-16 md:w-16 rounded-[18px] md:rounded-[22px] border shadow-sm flex items-center justify-center ${tile.tone.icon}`}
          >
            <Icon size={22} className="md:w-[30px] md:h-[30px]" />
          </div>

          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] md:text-[11px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200 shadow-sm">
            <Lock size={11} />
            {tile.badge}
          </span>
        </div>

        <div className="mt-3 md:mt-5">
          <div className="text-[11px] md:text-[14px] font-black uppercase tracking-[0.16em] text-slate-500">
            {tile.comboLabel}
          </div>

          <h2 className="mt-1.5 md:mt-2 text-[19px] md:text-[28px] leading-[1.08] font-black text-slate-800">
            {tile.title}
          </h2>
        </div>

        <p className="mt-2 md:mt-3 text-[12px] md:text-[15px] font-semibold text-slate-600 leading-relaxed max-w-full md:max-w-[92%] line-clamp-2 md:line-clamp-none">
          {tile.description}
        </p>

        <div className="mt-auto pt-3 md:pt-6">
          <div className="inline-flex items-center gap-1.5 rounded-xl md:rounded-2xl px-3 py-2 md:px-4 md:py-3 bg-white/90 backdrop-blur border border-white/80 text-slate-500 font-black text-[12px] md:text-sm shadow-sm">
            Unavailable
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpandTile({
  tile,
  open,
  onToggle,
}: {
  tile: ComboTile;
  open: boolean;
  onToggle: () => void;
}) {
  const Icon = tile.icon;

  return (
    <div
      className={`group relative rounded-[24px] md:rounded-[28px] border overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300 ${tile.tone.card}`}
    >
      <div className={`absolute inset-0 ${tile.tone.mesh}`} />
      <div
        className={`absolute -top-12 -right-10 h-32 w-32 md:h-36 md:w-36 rounded-full blur-3xl ${tile.tone.glow}`}
      />
      <DecorativeIcons icons={tile.deco} />

      <div className="relative p-4 md:p-6 min-h-[178px] sm:min-h-[205px] md:min-h-[280px] flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div
            className={`h-12 w-12 md:h-16 md:w-16 rounded-[18px] md:rounded-[22px] border shadow-sm flex items-center justify-center ${tile.tone.icon}`}
          >
            <Icon size={22} className="md:w-[30px] md:h-[30px]" />
          </div>

          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] md:text-[11px] font-extrabold border shadow-sm ${tile.tone.badge}`}
          >
            {tile.badge}
          </span>
        </div>

        <div className="mt-3 md:mt-5">
          <div className="text-[11px] md:text-[14px] font-black uppercase tracking-[0.16em] text-slate-600">
            {tile.comboLabel}
          </div>

          <h2 className="mt-1.5 md:mt-2 text-[19px] md:text-[28px] leading-[1.08] font-black text-slate-900">
            {tile.title}
          </h2>
        </div>

        <p className="mt-2 md:mt-3 text-[12px] md:text-[15px] font-semibold text-slate-700 leading-relaxed max-w-full md:max-w-[92%] line-clamp-2 md:line-clamp-none">
          {tile.description}
        </p>

        <div className="mt-auto pt-3 md:pt-6">
          <button
            onClick={onToggle}
            className="inline-flex items-center gap-1.5 md:gap-2 rounded-xl md:rounded-2xl px-3 py-2 md:px-4 md:py-3 bg-white/90 backdrop-blur border border-white/80 text-violet-700 font-black text-[12px] md:text-sm shadow-sm hover:bg-white transition"
            type="button"
          >
            {open ? "Hide" : "Options"}
            <ArrowRight
              size={15}
              className={`transition-transform duration-300 ${
                open ? "rotate-90" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {open && (
        <div className="relative border-t border-white/70 bg-white/55 backdrop-blur px-4 pb-4 pt-2">
          <div className="grid gap-3">
            <Link
              href="/combo/handwritten-pdfs"
              className="group/sub rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm hover:shadow-md hover:border-blue-200 hover:bg-blue-50 transition"
            >
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center shrink-0">
                  <FileText size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-600">
                    Combo
                  </div>
                  <div className="mt-1 text-base font-black text-slate-900 group-hover/sub:text-blue-700 transition">
                    Handwritten PDFs
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-600 leading-relaxed">
                    Explore digital handwritten combo packs.
                  </div>
                </div>
              </div>
            </Link>

            <Link
              href="/combo/handwritten-hardcopy"
              className="group/sub rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm hover:shadow-md hover:border-orange-200 hover:bg-orange-50 transition"
            >
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-xl bg-orange-50 text-orange-700 border border-orange-100 flex items-center justify-center shrink-0">
                  <Truck size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-600">
                    Combo
                  </div>
                  <div className="mt-1 text-base font-black text-slate-900 group-hover/sub:text-orange-700 transition">
                    Handwritten Hardcopy Delivery
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-600 leading-relaxed">
                    Explore physical handwritten combo packs with delivery.
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComboPage() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showHandwrittenSubcats, setShowHandwrittenSubcats] = useState(false);

  const tiles: ComboTile[] = useMemo(
    () => [
      {
        title: "Solved Assignments",
        comboLabel: "Combo",
        description:
          "Browse curated solved assignment bundles for faster selection and better value.",
        href: "/combo/solved-assignments",
        badge: "Most Popular",
        status: "active",
        icon: FileText,
        tone: {
          card:
            "bg-gradient-to-br from-blue-50 via-white to-cyan-50 border-blue-100",
          icon: "bg-white text-blue-700 border-blue-100",
          badge: "bg-blue-100 text-blue-700 border-blue-200",
          glow: "bg-blue-300/40",
          mesh:
            "bg-[radial-gradient(circle_at_1px_1px,rgba(37,99,235,0.08)_1px,transparent_0)] bg-[length:20px_20px]",
        },
        deco: [ScrollText, NotebookPen, Package],
      },
      {
        title: "Handwritten Assignments",
        comboLabel: "Combo",
        description:
          "Choose between handwritten PDF bundles and hardcopy delivery bundles.",
        badge: "2 Formats",
        status: "expand",
        icon: PenTool,
        tone: {
          card:
            "bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 border-violet-100",
          icon: "bg-white text-violet-700 border-violet-100",
          badge: "bg-violet-100 text-violet-700 border-violet-200",
          glow: "bg-violet-300/40",
          mesh:
            "bg-[radial-gradient(circle_at_1px_1px,rgba(139,92,246,0.08)_1px,transparent_0)] bg-[length:20px_20px]",
        },
        deco: [NotebookPen, FileText, Boxes],
      },
      {
        title: "PYQs",
        comboLabel: "Combo",
        description:
          "Explore dedicated 3-Year and 5-Year Previous Year Paper combo formats.",
        href: "/combo/question-papers",
        badge: "Exam Focus",
        status: "active",
        icon: BookOpen,
        tone: {
          card:
            "bg-gradient-to-br from-emerald-50 via-white to-teal-50 border-emerald-100",
          icon: "bg-white text-emerald-700 border-emerald-100",
          badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
          glow: "bg-emerald-300/40",
          mesh:
            "bg-[radial-gradient(circle_at_1px_1px,rgba(5,150,105,0.08)_1px,transparent_0)] bg-[length:20px_20px]",
        },
        deco: [BookOpen, LibraryBig, Package],
      },
      {
        title: "Guess Papers",
        comboLabel: "Combo",
        description:
          "Find focused exam bundles designed to simplify revision and preparation.",
        href: "/combo/guess-papers",
        badge: "High Demand",
        status: "active",
        icon: Lightbulb,
        tone: {
          card:
            "bg-gradient-to-br from-amber-50 via-white to-yellow-50 border-amber-100",
          icon: "bg-white text-amber-700 border-amber-100",
          badge: "bg-amber-100 text-amber-700 border-amber-200",
          glow: "bg-amber-300/40",
          mesh:
            "bg-[radial-gradient(circle_at_1px_1px,rgba(217,119,6,0.08)_1px,transparent_0)] bg-[length:20px_20px]",
        },
        deco: [Lightbulb, ScrollText, Package],
      },
      {
        title: "Ebooks / Notes",
        comboLabel: "Combo",
        description:
          "Browse digital combo packs for ebooks and notes in one organized space.",
        href: "/combo/ebooks-notes",
        badge: "Digital",
        status: "active",
        icon: Layers3,
        tone: {
          card:
            "bg-gradient-to-br from-cyan-50 via-white to-sky-50 border-cyan-100",
          icon: "bg-white text-cyan-700 border-cyan-100",
          badge: "bg-cyan-100 text-cyan-700 border-cyan-200",
          glow: "bg-cyan-300/40",
          mesh:
            "bg-[radial-gradient(circle_at_1px_1px,rgba(8,145,178,0.08)_1px,transparent_0)] bg-[length:20px_20px]",
        },
        deco: [Layers3, LibraryBig, Package],
      },
      {
        title: "Project & Synopsis",
        comboLabel: "Combo",
        description:
          "This category is currently unavailable and will be activated later.",
        badge: "Unavailable",
        status: "inactive",
        icon: FolderKanban,
        tone: {
          card:
            "bg-gradient-to-br from-slate-50 via-white to-gray-50 border-slate-200",
          icon: "bg-white text-slate-600 border-slate-200",
          badge: "bg-slate-100 text-slate-600 border-slate-200",
          glow: "bg-slate-300/30",
          mesh:
            "bg-[radial-gradient(circle_at_1px_1px,rgba(100,116,139,0.08)_1px,transparent_0)] bg-[length:20px_20px]",
        },
        deco: [FolderKanban, Package, Sparkles],
      },
    ],
    []
  );

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
        .isp-grid {
          background-image: radial-gradient(
            circle at 1px 1px,
            rgba(15, 23, 42, 0.05) 1px,
            transparent 0
          );
          background-size: 24px 24px;
        }
        .isp-floaty {
          animation: floaty 7s ease-in-out infinite;
        }
      `}</style>

      <TopBar />
      <Navbar />

      <SearchOverlay
        open={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />

      <div className="bg-white border-b border-gray-100">
        <div className="max-w-[1600px] mx-auto px-4 py-3 text-[13px] text-gray-500 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <Link href="/" className="hover:text-blue-700 font-semibold">
            Home
          </Link>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="text-blue-700 font-extrabold">Combo</span>
        </div>
      </div>

      <section className="relative overflow-hidden min-h-[calc(100vh-180px)]">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-[#f8fbff]" />
        <div className="absolute inset-0 isp-grid opacity-70" />
        <div className="absolute -top-28 -left-28 h-[320px] w-[320px] rounded-full blur-3xl opacity-15 bg-gradient-to-br from-blue-500 via-indigo-500 to-cyan-400 isp-floaty" />
        <div className="absolute -bottom-36 -right-24 h-[380px] w-[380px] rounded-full blur-3xl opacity-10 bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-400 isp-floaty" />

        <div className="relative max-w-[1600px] mx-auto px-4 py-8 md:py-10">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-4xl font-black tracking-tight text-slate-900">
                Combo Categories
              </h1>
              <p className="mt-1 text-sm md:text-[15px] font-semibold text-slate-600">
                Choose a category to explore its dedicated combo collection.
              </p>
            </div>

            <button
              onClick={() => setIsSearchOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-slate-800 font-extrabold hover:bg-gray-50 transition shadow-sm"
              type="button"
            >
              <Search size={16} />
              Search
            </button>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
            {tiles.map((tile) => {
              if (tile.status === "expand") {
                return (
                  <ExpandTile
                    key={tile.title}
                    tile={tile}
                    open={showHandwrittenSubcats}
                    onToggle={() => setShowHandwrittenSubcats((prev) => !prev)}
                  />
                );
              }

              if (tile.status === "inactive") {
                return <InactiveTile key={tile.title} tile={tile} />;
              }

              return <ActiveTile key={tile.title} tile={tile} />;
            })}
          </div>
        </div>
      </section>

      <Footer />
      <FloatingButtons />
    </main>
  );
}