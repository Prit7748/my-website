// ✅ FILE PATH: app/combo/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronRight,
  Sparkles,
  BadgeCheck,
  Zap,
  ShieldCheck,
  Layers,
  Plus,
  Minus,
  Search,
  X,
  Check,
  ArrowRight,
} from "lucide-react";

import TopBar from "@/components/TopBar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingButtons from "@/components/FloatingButtons";

type Product = {
  _id?: string;
  slug?: string;
  title: string;
  price: number;
  oldPrice?: number;
  category?: string;
  course?: string;
  session?: string;
  images?: string[];
  thumbnailUrl?: string;
};

type Combo = {
  id: string;
  type: "auto" | "admin";
  category: string; // same-category rule enforced at creation time
  medium?: string; // optional
  title: string;
  products: Product[];
  createdAt?: string;
};

const COMBO_CATEGORY = "Combo";
const OFF_PCT = 25;

function fileNameOf(path: string) {
  const clean = (path || "").split("?")[0];
  const parts = clean.split("/");
  return (parts[parts.length - 1] || "").toLowerCase();
}
function pickImagesSorted(images?: string[], thumb?: string) {
  const arr = Array.isArray(images) ? [...images] : [];
  const sorted = arr
    .filter((x) => typeof x === "string" && x.trim().length > 0)
    .sort((a, b) => fileNameOf(a).localeCompare(fileNameOf(b), undefined, { numeric: true }));
  const first = sorted[0] || thumb || "";
  return first;
}

function calcComboPrice(products: Product[]) {
  const sum = products.reduce((acc, p) => acc + Number(p.price || 0), 0);
  const offer = Math.round(sum * (1 - OFF_PCT / 100));
  const save = sum - offer;
  return { sum, offer, save };
}

function ComboThumb({ products }: { products: Product[] }) {
  const imgs = products.slice(0, 4).map((p) => pickImagesSorted(p.images, p.thumbnailUrl));
  const hasAny = imgs.some(Boolean);

  return (
    <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-100" />
      <div className="absolute inset-0 opacity-60" style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.10) 1px, transparent 0)",
        backgroundSize: "22px 22px",
      }} />

      {!hasAny ? (
        <div className="absolute inset-0 flex items-center justify-center text-slate-300">
          <Layers size={70} />
        </div>
      ) : (
        <div className="absolute inset-0 p-3 grid grid-cols-2 grid-rows-2 gap-2">
          {imgs.map((src, idx) => (
            <div key={idx} className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
              {src ? (
                <Image
                  src={src}
                  alt="Combo item thumbnail"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                  <Layers size={26} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="absolute top-3 left-3 inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-3 py-1 text-[11px] font-extrabold shadow">
        <Layers size={14} /> COMBO
      </div>
      <div className="absolute top-3 right-3 rounded-full bg-emerald-600 text-white px-3 py-1 text-[11px] font-extrabold shadow">
        EXTRA {OFF_PCT}% OFF
      </div>

      <div className="absolute bottom-3 left-3 right-3">
        <div className="rounded-xl bg-white/90 backdrop-blur border border-gray-200 px-3 py-2 shadow-sm">
          <div className="text-[11px] font-extrabold text-slate-800">Smart bundle thumbnail</div>
          <div className="text-[11px] font-semibold text-slate-600">
            Auto-generated from top purchases OR created by admin.
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-extrabold border transition ${
        active
          ? "bg-blue-600 text-white border-blue-600 shadow"
          : "bg-white text-slate-800 border-gray-200 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

export default function ComboPage() {
  const [tab, setTab] = useState<"auto" | "admin" | "build">("auto");

  const [autoCombos, setAutoCombos] = useState<Combo[]>([]);
  const [adminCombos, setAdminCombos] = useState<Combo[]>([]);
  const [loadingAuto, setLoadingAuto] = useState(false);
  const [loadingAdmin, setLoadingAdmin] = useState(false);

  // Build-your-own combo
  const [builderCategory, setBuilderCategory] = useState<string>("Solved Assignments");
  const [builderSearch, setBuilderSearch] = useState("");
  const [builderProducts, setBuilderProducts] = useState<Product[]>([]);
  const [builderLoading, setBuilderLoading] = useState(false);
  const [selectedMap, setSelectedMap] = useState<Record<string, Product>>({});

  const selectedList = useMemo(() => Object.values(selectedMap), [selectedMap]);
  const builderPricing = useMemo(() => calcComboPrice(selectedList), [selectedList]);

  // --------- DEMO FALLBACK (so page always looks complete) ----------
  const demoProducts: Product[] = useMemo(
    () => [
      {
        title: "BECC-101 Solved Assignment (Jan 2026)",
        price: 99,
        category: "Solved Assignments",
        images: ["/uploads/products/hardcopy-sample-1.jpg"],
      },
      {
        title: "BECC-102 Solved Assignment (Jan 2026)",
        price: 99,
        category: "Solved Assignments",
        images: ["/uploads/products/hardcopy-sample-2.jpg"],
      },
      {
        title: "BECC-103 Solved Assignment (Jan 2026)",
        price: 99,
        category: "Solved Assignments",
        images: ["/uploads/products/hardcopy-sample-1.jpg"],
      },
      {
        title: "BECC-104 Solved Assignment (Jan 2026)",
        price: 129,
        category: "Solved Assignments",
        images: ["/uploads/products/hardcopy-sample-2.jpg"],
      },
    ],
    []
  );

  useEffect(() => {
    // ✅ You can later replace these with your real API endpoints:
    // /api/combos?type=auto   and   /api/combos?type=admin
    // For now: show working, SEO-ready UI with demo fallback.

    setLoadingAuto(true);
    setLoadingAdmin(true);

    // Auto combos (demo)
    const a: Combo[] = [
      {
        id: "auto-1",
        type: "auto",
        category: "Solved Assignments",
        medium: "English",
        title: "BECC-101 + BECC-102 + BECC-103 (Solved Assignments Combo)",
        products: demoProducts.slice(0, 3),
      },
      {
        id: "auto-2",
        type: "auto",
        category: "Solved Assignments",
        medium: "English",
        title: "BECC-101 + BECC-102 + BECC-103 + BECC-104 (Mega Combo)",
        products: demoProducts.slice(0, 4),
      },
    ];

    // Admin combos (demo)
    const b: Combo[] = [
      {
        id: "admin-1",
        type: "admin",
        category: "Question Papers (PYQ)",
        medium: "English",
        title: "PYQ Combo (Top 3 Papers) – Course-wise",
        products: [
          { title: "PYQ – BECC-101 (2020–2025)", price: 79, category: "Question Papers (PYQ)" },
          { title: "PYQ – BECC-102 (2020–2025)", price: 79, category: "Question Papers (PYQ)" },
          { title: "PYQ – BECC-103 (2020–2025)", price: 79, category: "Question Papers (PYQ)" },
        ],
      },
    ];

    const t = setTimeout(() => {
      setAutoCombos(a);
      setAdminCombos(b);
      setLoadingAuto(false);
      setLoadingAdmin(false);
    }, 350);

    return () => clearTimeout(t);
  }, [demoProducts]);

  // Builder: load products for selected category (demo uses /api/products so it will work on your DB if category names match)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setBuilderLoading(true);

        // ✅ We try to fetch real products from your existing API
        const qs = new URLSearchParams();
        qs.set("category", builderCategory);
        qs.set("page", "1");
        qs.set("limit", "48");
        if (builderSearch.trim()) qs.set("search", builderSearch.trim());

        const res = await fetch(`/api/products?${qs.toString()}`, { cache: "no-store" });
        const data = await res.json();
        if (!active) return;

        const list = Array.isArray(data?.products) ? data.products : [];

        // fallback demo if DB returns empty
        setBuilderProducts(list.length ? list : demoProducts.filter((p) => p.category === builderCategory));
      } catch {
        if (!active) return;
        setBuilderProducts(demoProducts.filter((p) => p.category === builderCategory));
      } finally {
        if (!active) return;
        setBuilderLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [builderCategory, builderSearch, demoProducts]);

  const availableCategoriesForBuilder = useMemo(
    () => [
      "Solved Assignments",
      "Question Papers (PYQ)",
      "Guess Papers",
      "eBooks/Notes",
      "projects & Synopsis",
      "Handwritten PDFs",
      "Handwritten Hardcopy (Delivery)",
    ],
    []
  );

  const minBuildCount = 6;
  const canGenerateStudentCombo = selectedList.length >= minBuildCount;

  const togglePick = (p: Product) => {
    const key = String(p._id || p.slug || p.title);
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = p;
      return next;
    });
  };

  const clearBuilder = () => setSelectedMap({});

  const renderComboCard = (c: Combo) => {
    const pricing = calcComboPrice(c.products);
    const itemsCount = c.products.length;

    return (
      <div
        key={c.id}
        className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden hover:shadow-lg transition"
      >
        <div className="p-4">
          <ComboThumb products={c.products} />
        </div>

        <div className="px-5 pb-5">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 text-[11px] font-extrabold">
              <span className={`px-2 py-1 rounded-full ${c.type === "auto" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>
                {c.type === "auto" ? "AUTO-GENERATED" : "ADMIN CURATED"}
              </span>
              <span className="px-2 py-1 rounded-full bg-gray-100 text-slate-700">
                Same-category bundle
              </span>
              <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                {itemsCount} items
              </span>
            </div>
          </div>

          <h3 className="mt-3 text-lg font-extrabold text-slate-900 leading-snug line-clamp-2">
            {c.title}
          </h3>

          <div className="mt-2 text-sm font-semibold text-slate-600">
            Category: <span className="font-extrabold text-slate-800">{c.category}</span>
            {c.medium ? (
              <>
                {" "}• Medium: <span className="font-extrabold text-slate-800">{c.medium}</span>
              </>
            ) : null}
          </div>

          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-xs font-extrabold text-slate-600">Bundle Price</div>
                <div className="mt-1 text-2xl font-extrabold text-blue-700">₹{pricing.offer}</div>
                <div className="mt-1 text-xs font-bold text-slate-500">
                  MRP: <span className="line-through">₹{pricing.sum}</span> • You save <span className="text-emerald-700">₹{pricing.save}</span>
                </div>
              </div>

              <button
                className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 text-white font-extrabold hover:bg-slate-800 transition"
                onClick={() => alert("Next step: create combo checkout flow. (UI ready)")}
              >
                Buy Combo <ArrowRight size={16} />
              </button>
            </div>

            <div className="mt-3 text-[12px] text-slate-600 font-semibold leading-relaxed">
              Extra {OFF_PCT}% off is applied on the combined price. Combo contains only one category (no mixing).
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xs font-extrabold text-slate-900">Included items</div>
            <ul className="mt-2 space-y-2">
              {c.products.map((p, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                  <Check className="text-emerald-600 mt-0.5" size={16} />
                  <span className="font-semibold">
                    {p.title}{" "}
                    <span className="text-slate-500 font-bold">• ₹{p.price}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            <Link
              href="/products?category=combo"
              className="text-sm font-extrabold text-blue-700 hover:text-blue-800"
            >
              View all combos →
            </Link>
            <div className="text-[11px] font-bold text-slate-500">
              SEO: Bundle keywords + course codes in title for better discovery
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen font-sans text-slate-800 bg-white">
      <style jsx global>{`
        @keyframes floaty {
          0% { transform: translate3d(0,0,0); }
          50% { transform: translate3d(0,-10px,0); }
          100% { transform: translate3d(0,0,0); }
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

      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-[1600px] mx-auto px-4 py-3 text-[13px] text-gray-500 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <Link href="/" className="hover:text-blue-700 font-semibold">Home</Link>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="text-blue-700 font-extrabold">Combo Bundles</span>
        </div>
      </div>

      {/* HERO (different look but same premium quality) */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-[#f7f9ff]" />
        <div className="absolute inset-0 isp-grid opacity-60" />
        <div className="absolute -top-28 -left-28 h-[320px] w-[320px] rounded-full blur-3xl opacity-25 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-400 isp-floaty" />
        <div className="absolute -bottom-36 -right-24 h-[380px] w-[380px] rounded-full blur-3xl opacity-20 bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-400 isp-floaty" />

        <div className="relative max-w-[1600px] mx-auto px-4 py-7 md:py-12">
          <div className="flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-12">
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-extrabold text-emerald-700">
                <Sparkles size={14} /> Smart Bundles • Extra {OFF_PCT}% OFF
              </div>

              <h1 className="mt-3 text-[28px] leading-tight md:text-5xl font-extrabold text-slate-900">
                Combo Bundles
              </h1>

              <p className="mt-2 text-sm md:text-lg font-medium text-slate-600 max-w-3xl">
                3 types of combos: <span className="font-extrabold text-slate-800">Auto-generated</span> (from real purchases),
                <span className="font-extrabold text-slate-800"> Admin curated</span> (backend),
                and <span className="font-extrabold text-slate-800">Build your own</span> (student).
                Every combo gives <span className="font-extrabold text-emerald-700">extra {OFF_PCT}% off</span>.
              </p>

              {/* Rules (SEO + clarity) */}
              <div className="mt-5 grid md:grid-cols-3 gap-3">
                {[
                  { t: "Same-category only", d: "No mixing (e.g., PYQ + Hardcopy together not allowed)." },
                  { t: "Auto combos = 3–4 items", d: "System picks top co-bought products." },
                  { t: "Student combo = min 6 items", d: "Build your own bundle in one category." },
                ].map((x) => (
                  <div key={x.t} className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-sm p-4">
                    <div className="text-sm font-extrabold text-slate-900">{x.t}</div>
                    <div className="mt-1 text-xs font-semibold text-slate-600 leading-relaxed">{x.d}</div>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div className="mt-6 flex flex-wrap gap-2">
                <Chip active={tab === "auto"} onClick={() => setTab("auto")}>Automatic Generated Combos</Chip>
                <Chip active={tab === "admin"} onClick={() => setTab("admin")}>Backend Curated Combos</Chip>
                <Chip active={tab === "build"} onClick={() => setTab("build")}>Generate Your Own Combo</Chip>
              </div>
            </div>

            {/* Right badges */}
            <div className="hidden lg:block w-[420px]">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-sm p-4">
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="text-emerald-600" size={18} />
                    <div className="text-xs">
                      <div className="font-extrabold text-slate-900">Better Value</div>
                      <div className="font-bold text-gray-500">Extra {OFF_PCT}% off</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-sm p-4">
                  <div className="flex items-center gap-2">
                    <Zap className="text-blue-600" size={18} />
                    <div className="text-xs">
                      <div className="font-extrabold text-slate-900">Fast Checkout</div>
                      <div className="font-bold text-gray-500">One bundle purchase</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-sm p-4 col-span-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="text-indigo-600" size={18} />
                    <div className="text-xs">
                      <div className="font-extrabold text-slate-900">Same-category rule</div>
                      <div className="font-bold text-gray-500">Cleaner results & better SEO</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="p-4 bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-600 isp-shimmer text-white">
                  <div className="text-sm font-extrabold">How Auto-Combos are created</div>
                  <div className="mt-1 text-xs font-bold opacity-90">
                    System tracks co-purchases (5/10/20+ users) and generates best bundles.
                  </div>
                </div>
                <div className="p-5">
                  <div className="text-xs font-extrabold text-slate-900">Naming rule</div>
                  <div className="mt-2 text-xs font-bold text-gray-600 leading-relaxed">
                    Subject codes + Category + Medium (e.g., BECC-101 + BECC-102 • Solved Assignments • English).
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SEO ribbon (desktop only) */}
          <div className="hidden md:block mt-6 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur shadow-sm p-5">
            <div className="text-base font-extrabold text-slate-900">
              IGNOU Combo Bundles: Save more with smart course-wise packs
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-600 leading-relaxed">
              Choose a combo for your category (Solved Assignments / PYQ / Guess Papers / Ebooks etc). Every bundle applies extra {OFF_PCT}% off on the combined price.
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                href="/products?category=combo"
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 font-extrabold text-sm text-slate-800"
              >
                Browse All Combos →
              </Link>
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

      {/* CONTENT */}
      <section className="bg-[#f7f9ff] py-8 md:py-10 border-t border-gray-100">
        <div className="max-w-[1600px] mx-auto px-4">
          {tab !== "build" ? (
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Auto */}
              {tab === "auto" && (
                <>
                  <div className="lg:col-span-2">
                    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
                      <div className="text-lg font-extrabold text-slate-900">Automatic Generated Combos</div>
                      <div className="mt-1 text-sm font-semibold text-slate-600">
                        System-generated bundles based on real co-purchase behaviour. Each bundle has 3–4 items of the same category with extra {OFF_PCT}% off.
                      </div>
                    </div>
                  </div>

                  {loadingAuto ? (
                    <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-10 text-center font-semibold text-slate-600">
                      Loading auto combos...
                    </div>
                  ) : (
                    autoCombos.map(renderComboCard)
                  )}
                </>
              )}

              {/* Admin */}
              {tab === "admin" && (
                <>
                  <div className="lg:col-span-2">
                    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
                      <div className="text-lg font-extrabold text-slate-900">Backend Curated Combos</div>
                      <div className="mt-1 text-sm font-semibold text-slate-600">
                        Admin-created bundles (mostly PYQ based). You control products + thumbnail + naming. Extra {OFF_PCT}% off applies automatically.
                      </div>
                    </div>
                  </div>

                  {loadingAdmin ? (
                    <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-10 text-center font-semibold text-slate-600">
                      Loading curated combos...
                    </div>
                  ) : (
                    adminCombos.map(renderComboCard)
                  )}
                </>
              )}
            </div>
          ) : (
            // Build your own combo
            <div className="grid lg:grid-cols-[420px_1fr] gap-6 items-start">
              {/* Builder sidebar */}
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 sticky top-24">
                <div className="text-lg font-extrabold text-slate-900">Generate Your Own Combo</div>
                <div className="mt-1 text-sm font-semibold text-slate-600">
                  Rule: Select <span className="font-extrabold text-slate-800">minimum {minBuildCount}</span> products of the <span className="font-extrabold text-slate-800">same category</span>. Extra {OFF_PCT}% off will apply.
                </div>

                <div className="mt-5">
                  <div className="text-xs font-extrabold text-slate-700 uppercase mb-2">Choose category</div>
                  <select
                    value={builderCategory}
                    onChange={(e) => {
                      setBuilderCategory(e.target.value);
                      setSelectedMap({});
                      setBuilderSearch("");
                    }}
                    className="w-full rounded-xl border border-gray-200 px-3 py-3 font-extrabold text-slate-800 outline-none focus:border-blue-500"
                  >
                    {availableCategoriesForBuilder.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="mt-4">
                  <div className="text-xs font-extrabold text-slate-700 uppercase mb-2">Search products</div>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-white">
                    <Search size={18} className="text-gray-400" />
                    <input
                      value={builderSearch}
                      onChange={(e) => setBuilderSearch(e.target.value)}
                      placeholder="Type course code / title…"
                      className="w-full outline-none text-sm font-semibold text-slate-800 placeholder:text-gray-400"
                    />
                    {builderSearch && (
                      <button
                        onClick={() => setBuilderSearch("")}
                        className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500"
                        aria-label="Clear search"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs font-extrabold text-slate-700 uppercase">Selected</div>
                  <div className="mt-2 text-sm font-extrabold text-slate-900">{selectedList.length} items</div>
                  <div className="mt-2 text-xs font-bold text-slate-600">
                    MRP: <span className="line-through">₹{builderPricing.sum}</span> • Offer:{" "}
                    <span className="text-blue-700">₹{builderPricing.offer}</span> • Save:{" "}
                    <span className="text-emerald-700">₹{builderPricing.save}</span>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={clearBuilder}
                      className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 font-extrabold text-sm py-2"
                    >
                      Clear
                    </button>
                    <button
                      disabled={!canGenerateStudentCombo}
                      onClick={() =>
                        alert(
                          canGenerateStudentCombo
                            ? "Next step: Create a temporary combo object + redirect to checkout."
                            : `Please select minimum ${minBuildCount} products to generate your combo.`
                        )
                      }
                      className={`flex-1 rounded-xl font-extrabold text-sm py-2 text-white transition ${
                        canGenerateStudentCombo
                          ? "bg-slate-900 hover:bg-slate-800"
                          : "bg-slate-400 cursor-not-allowed"
                      }`}
                    >
                      Generate
                    </button>
                  </div>

                  <div className="mt-3 text-[11px] font-semibold text-slate-600 leading-relaxed">
                    Note: This combo is not a unique product in DB — it combines existing products.
                  </div>
                </div>
              </div>

              {/* Builder product list */}
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-extrabold text-slate-900">Pick products</div>
                    <div className="mt-1 text-sm font-semibold text-slate-600">
                      Category: <span className="font-extrabold text-slate-800">{builderCategory}</span> • Select at least {minBuildCount}.
                    </div>
                  </div>
                  <div className="text-xs font-bold text-slate-500">
                    Extra {OFF_PCT}% off applies on total
                  </div>
                </div>

                {builderLoading ? (
                  <div className="py-12 text-center text-slate-600 font-semibold">Loading products…</div>
                ) : (
                  <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {builderProducts.map((p, idx) => {
                      const key = String(p._id || p.slug || p.title || idx);
                      const picked = !!selectedMap[key];
                      const thumb = pickImagesSorted(p.images, p.thumbnailUrl);

                      return (
                        <button
                          key={key}
                          onClick={() => togglePick(p)}
                          className={`text-left rounded-2xl border p-4 transition shadow-sm hover:shadow ${
                            picked ? "border-blue-600 bg-blue-50" : "border-gray-200 bg-white"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="relative w-14 h-20 rounded-xl overflow-hidden border border-gray-200 bg-gray-100 shrink-0">
                              {thumb ? (
                                <Image src={thumb} alt={p.title} fill className="object-cover" sizes="56px" />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                                  <Layers size={20} />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-extrabold text-slate-500 uppercase">
                                {p.category || builderCategory}
                              </div>
                              <div className="mt-1 text-sm font-extrabold text-slate-900 line-clamp-2">
                                {p.title}
                              </div>
                              <div className="mt-2 flex items-center justify-between">
                                <div className="text-sm font-extrabold text-blue-700">₹{p.price}</div>
                                <div className={`inline-flex items-center gap-1 text-xs font-extrabold px-2 py-1 rounded-full ${
                                  picked ? "bg-blue-600 text-white" : "bg-gray-100 text-slate-700"
                                }`}>
                                  {picked ? <Minus size={14} /> : <Plus size={14} />}
                                  {picked ? "Remove" : "Add"}
                                </div>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* CTA + FAQ */}
      <section className="bg-white border-t border-gray-100 pt-10 md:pt-12">
        <div className="max-w-[1600px] mx-auto px-4">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xl font-extrabold text-slate-900">Want to browse everything?</div>
                <div className="mt-1 text-sm font-semibold text-slate-600">
                  Explore all categories (Solved Assignments, PYQ, Guess Papers, Ebooks, Projects, Hardcopy Delivery, etc).
                </div>
              </div>
              <Link
                href="/products"
                className="inline-flex items-center justify-center px-5 py-3 rounded-2xl bg-slate-900 text-white font-extrabold hover:bg-slate-800 transition"
              >
                Go to All Products →
              </Link>
            </div>
          </div>

          <div className="mt-10 md:mt-12">
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-6">Combo FAQs</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { t: "Why same-category only?", d: "Customers search category-wise, and same-category bundles keep results clean & relevant." },
                { t: "How auto-combos work?", d: "System detects products frequently bought together (5/10/20+ users) and generates 3–4 item bundles." },
                { t: "Student combo rule?", d: `To generate your own combo, select minimum ${minBuildCount} products from the same category.` },
              ].map((x) => (
                <div key={x.t} className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
                  <div className="flex items-start gap-3">
                    <Check className="text-emerald-600 mt-0.5" size={18} />
                    <div>
                      <div className="font-extrabold text-slate-900">{x.t}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-600">{x.d}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 text-[12px] font-semibold text-slate-500">
              Note: This page UI is ready. Next step will be implementing: (1) combo generation logic (auto + student), (2) combo checkout flow, (3) saving curated combos from backend.
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <FloatingButtons />
    </main>
  );
}
