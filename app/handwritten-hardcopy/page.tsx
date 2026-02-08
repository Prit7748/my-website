// ✅ FILE PATH: app/handwritten-hardcopy/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
  Truck,
  Package,
  Pencil,
  MapPin,
} from "lucide-react";

import TopBar from "@/components/TopBar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingButtons from "@/components/FloatingButtons";

import FilterSidebar from "@/components/solved-assignments/FilterSidebar";
import SortBar from "@/components/solved-assignments/SortBar";
import ProductGrid from "@/components/solved-assignments/ProductGrid";
import Pagination from "@/components/solved-assignments/Pagination";

const HARDCOPY = "Handwritten Hardcopy (Delivery)";

function safeSplitComma(v: string | null) {
  return (v || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

// ✅ English policy (better tone)
const INTEGRITY_NOTE =
  "We do not provide illegal or cheating services. We only convert the content/outline/points/data shared by the student into a neat handwritten format and deliver it. The final academic submission remains the student’s responsibility.";

type SampleImg = { src: string; alt: string };

// ✅ Temporary local sample images (later you can load from DB/API)
const SAMPLE_IMAGES: SampleImg[] = [
  { src: "/samples/handwriting/1.jpg", alt: "Handwriting sample page 1" },
  { src: "/samples/handwriting/2.jpg", alt: "Handwriting sample page 2" },
  { src: "/samples/handwriting/3.jpg", alt: "Handwriting sample page 3" },
  { src: "/samples/handwriting/4.jpg", alt: "Handwriting sample page 4" },
];

function SamplesSlider({
  images,
  href,
}: {
  images: SampleImg[];
  href: string;
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!images?.length) return;
    const t = setInterval(() => {
      setIdx((p) => (p + 1) % images.length);
    }, 2500);
    return () => clearInterval(t);
  }, [images]);

  const current = images[idx];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-sm overflow-hidden">
      <div className="p-4 md:p-5 flex items-start md:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs md:text-sm font-extrabold text-slate-900">
            Our Handwriting Samples
          </div>
          <div className="mt-1 text-[11px] md:text-xs font-semibold text-slate-600">
            Real handwriting preview (portrait pages). Updated regularly.
          </div>
        </div>
        <Link
          href={href}
          className="shrink-0 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-slate-900 text-white font-extrabold text-xs md:text-sm hover:bg-slate-800 transition"
        >
          View Samples →
        </Link>
      </div>

      <div className="relative w-full aspect-[16/9] bg-gray-50">
        {current?.src ? (
          <Image
            src={current.src}
            alt={current.alt}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 900px"
            priority={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 font-bold text-sm">
            No samples yet
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />

        {/* dots */}
        <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              aria-label={`Go to sample ${i + 1}`}
              onClick={() => setIdx(i)}
              className={`h-2.5 w-2.5 rounded-full border border-white/70 ${
                i === idx ? "bg-white" : "bg-white/30"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HandwrittenHardcopyPage() {
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
    urlCategory ? safeSplitComma(urlCategory) : [HARDCOPY]
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

  const syncHardcopyUrl = (nextCourse: string, nextSession: string, nextSearch: string) => {
    const params = new URLSearchParams(searchParams.toString());

    params.set("category", HARDCOPY);

    if (nextCourse) params.set("course", nextCourse);
    else params.delete("course");

    if (nextSession) params.set("session", nextSession);
    else params.delete("session");

    if (nextSearch) params.set("search", nextSearch);
    else params.delete("search");

    params.delete("page");

    const qs = params.toString();
    router.replace(`/handwritten-hardcopy${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const handleToggleCategory = (cat: string) => {
    const current = Array.isArray(selectedCat) ? selectedCat : [HARDCOPY];
    const next = current.includes(cat) ? current.filter((c) => c !== cat) : [...current, cat];
    const normalized = next.length === 0 ? [HARDCOPY] : next;

    const hasOther = normalized.some((c) => c !== HARDCOPY);
    const isMultiple = normalized.length > 1;

    if (hasOther || isMultiple) {
      redirectToProducts(normalized);
      return;
    }

    setSelectedCat([HARDCOPY]);
    syncHardcopyUrl(selectedCourse, selectedSession, search);
  };

  useEffect(() => {
    const c = safeSplitComma(searchParams.get("category"));
    const course = (searchParams.get("course") || "").trim();
    const session = (searchParams.get("session") || "").trim();
    const qSearch = (searchParams.get("search") || "").trim();

    const hasOther = c.some((x) => x !== HARDCOPY);
    const isMultiple = c.length > 1;

    if (hasOther || isMultiple) {
      const params = new URLSearchParams(searchParams.toString());
      const qs = params.toString();
      router.replace(`/products${qs ? `?${qs}` : ""}`);
      return;
    }

    setSelectedCat([HARDCOPY]);
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
      syncHardcopyUrl(selectedCourse, selectedSession, q);
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const breadcrumbText = useMemo(() => HARDCOPY, []);

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

      <div className="bg-white border-b border-gray-100">
        <div className="max-w-[1600px] mx-auto px-4 py-3 text-[13px] text-gray-500 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <Link href="/" className="hover:text-blue-700 font-semibold">
            Home
          </Link>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="text-blue-700 font-extrabold">Handwritten Hardcopy (Delivery)</span>
        </div>
      </div>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-[#f7f9ff]" />
        <div className="absolute inset-0 isp-grid opacity-60" />
        <div className="absolute -top-28 -left-28 h-[320px] w-[320px] rounded-full blur-3xl opacity-25 bg-gradient-to-br from-blue-500 via-indigo-500 to-cyan-400 isp-floaty" />
        <div className="absolute -bottom-36 -right-24 h-[380px] w-[380px] rounded-full blur-3xl opacity-20 bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-400 isp-floaty" />

        <div className="relative max-w-[1600px] mx-auto px-4 py-7 md:py-12">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10">
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-extrabold text-blue-700">
                <Sparkles size={14} /> Handwritten + Delivered to your address
              </div>

              <h1 className="mt-3 text-[28px] leading-tight md:text-5xl font-extrabold text-slate-900">
                Handwritten Hardcopy (Delivery)
              </h1>

              <p className="mt-2 text-sm md:text-lg font-medium text-slate-600 max-w-3xl">
                Printed nahi — real handwritten pages, neatly packed and delivered across India. Select course & session to match your requirement.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-white/85 backdrop-blur border border-blue-100 text-blue-700 text-xs md:text-sm font-extrabold shadow-sm">
                  {HARDCOPY}
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

              <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { i: <Pencil size={16} className="text-blue-700" />, t: "Handwritten Pages" },
                  { i: <Package size={16} className="text-indigo-700" />, t: "Safe Packing" },
                  { i: <Truck size={16} className="text-cyan-700" />, t: "Fast Dispatch" },
                  { i: <MapPin size={16} className="text-violet-700" />, t: "All India Delivery" },
                ].map((x) => (
                  <div
                    key={x.t}
                    className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-sm px-3 py-2 flex items-center gap-2"
                  >
                    {x.i}
                    <div className="text-[11px] md:text-xs font-extrabold text-slate-800">{x.t}</div>
                  </div>
                ))}
              </div>

              {/* ✅ Samples slider: placed in HERO after key trust points (noticeable + SEO-friendly, but not overpowering) */}
              <div className="mt-5">
                <SamplesSlider images={SAMPLE_IMAGES} href="/handwriting-samples" />
              </div>

              <div className="mt-5 md:hidden space-y-3">
                <button
                  onClick={() => setIsFilterOpen(true)}
                  className="w-full rounded-2xl bg-blue-600 text-white font-extrabold py-3.5 shadow-lg active:scale-[0.99] transition flex items-center justify-center gap-2"
                >
                  <Filter size={18} /> Filter & Sort
                </button>

                <div className="w-full rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-sm p-3">
                  <div className="text-[11px] font-extrabold text-slate-700 uppercase mb-2">
                    Search hardcopy products
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-white">
                    <Search size={18} className="text-gray-400" />
                    <input
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Type course code / title…"
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
                    Filters = exact matching for course & session.
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden lg:block w-[420px]">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-sm p-4">
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="text-green-600" size={18} />
                    <div className="text-xs">
                      <div className="font-extrabold text-slate-900">Neat Handwriting</div>
                      <div className="font-bold text-gray-500">Readable formatting</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-sm p-4">
                  <div className="flex items-center gap-2">
                    <Zap className="text-blue-600" size={18} />
                    <div className="text-xs">
                      <div className="font-extrabold text-slate-900">Fast Dispatch</div>
                      <div className="font-bold text-gray-500">Quick processing</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-sm p-4 col-span-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="text-indigo-600" size={18} />
                    <div className="text-xs">
                      <div className="font-extrabold text-slate-900">Delivery Assurance</div>
                      <div className="font-bold text-gray-500">Packed & trackable</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="p-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-cyan-600 isp-shimmer text-white">
                  <div className="text-sm font-extrabold">How Delivery Works</div>
                  <div className="mt-1 text-xs font-bold opacity-90">
                    Write → Pack → Dispatch → Delivered to your address
                  </div>
                </div>
                <div className="p-5">
                  <div className="text-xs font-extrabold text-slate-900">Tip</div>
                  <div className="mt-2 text-xs font-bold text-gray-600 leading-relaxed">
                    Course + Session select karo, phir product open karke address & delivery details confirm karo.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden md:block mt-6 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur shadow-sm p-5">
            <div className="text-base font-extrabold text-slate-900">
              Handwritten Hardcopy Delivery (All India) – Fast Dispatch & Safe Packing
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-600 leading-relaxed">
              Multiple categories select karoge to All Products par auto-redirect ho jaoge.
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

      <section className="bg-[#f7f9ff] py-8 md:py-10 border-t border-gray-100">
        <div className="max-w-[1600px] mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-8 items-start relative">
            <div className="hidden lg:block w-[360px] flex-shrink-0 self-start z-30">
              <FilterSidebar
                className="border border-gray-200 rounded-2xl shadow-sm bg-white"
                selectedCat={[HARDCOPY]}
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
                selectedCat={[HARDCOPY]}
                onToggleCategory={handleToggleCategory}
              />
            </div>

            <div className="flex-1 w-full min-w-0">
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-3 md:p-4">
                <SortBar total={meta.total} page={meta.page} limit={meta.limit} />
              </div>

              <div className="mt-5">
                <ProductGrid selectedCat={[HARDCOPY]} onMeta={setMeta} />
              </div>

              <div className="mt-6">
                <Pagination page={meta.page} totalPages={meta.totalPages} />
              </div>

              {/* ✅ Subtle policy box */}
              <div className="mt-8 rounded-2xl border border-gray-200 bg-white/90 backdrop-blur p-4">
                <div className="text-[12px] font-extrabold text-slate-800">Academic Integrity Note</div>
                <div className="mt-1 text-[12px] text-slate-600 font-semibold leading-relaxed">
                  {INTEGRITY_NOTE}
                </div>
              </div>

              {/* ✅ Delivery info SEO */}
              <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm font-extrabold text-slate-900">Delivery & Packing</div>
                <div className="mt-1 text-sm text-slate-600 font-semibold leading-relaxed">
                  Safe packing, fast dispatch, and delivery across India. Delivery time may vary by location and workload.
                </div>
              </div>

              {/* ✅ Sample product testing tip (no fake product injected; shows what to test) */}
              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-sm font-extrabold text-slate-900">Test Product Tip</div>
                <div className="mt-1 text-sm text-slate-600 font-semibold leading-relaxed">
                  To test this page quickly, create one product in DB with category exactly:
                  <span className="font-extrabold text-slate-800"> {HARDCOPY}</span> and add a thumbnail/image. Then refresh—product will appear here.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border-t border-gray-100">
        <div className="max-w-[1600px] mx-auto px-4 pt-10">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-lg font-extrabold text-slate-900">Want to browse everything?</div>
              <div className="mt-1 text-sm font-semibold text-slate-600">
                Explore all categories in one place (Solved Assignments, PYQ, Guess Papers, Ebooks, Projects, Combo, etc).
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
              { t: "Neat Handwriting", d: "Readable, clean formatting for submission." },
              { t: "Safe Packing", d: "Proper packing so pages remain safe." },
              { t: "All India Delivery", d: "Delivery across India with fast dispatch." },
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
