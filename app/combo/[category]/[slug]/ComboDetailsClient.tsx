"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import {
  ChevronRight,
  Boxes,
  IndianRupee,
  Languages,
  CalendarClock,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  ShoppingCart,
  Tag,
  Truck,
  FileText,
  BookOpen,
  PackageCheck,
  BadgeCheck,
  Hash,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingButtons from "@/components/FloatingButtons";
import { useCart } from "@/context/CartContext";
import {
  formatLanguageLabel,
  formatPyqUiText,
  formatSessionLabel,
  formatSubjectCodesLabel,
} from "@/lib/pyqUiFormat";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

type ComboItem = {
  title?: string;
  subtitle?: string;
  courseCodes?: string[];
  thumbnailUrl?: string;
  slug?: string;
};

type ComboDetails = {
  id?: string;
  slug?: string;
  categorySlug?: string;
  title?: string;
  shortTitle?: string;
  description?: string;
  shortDescription?: string;
  badge?: string;
  itemsLabel?: string;
  priceLabel?: string;
  saveLabel?: string;
  mediumLabel?: string;
  sessionLabel?: string;
  subjectCodesLabel?: string;
  courseCodesLabel?: string;
  courseTitlesLabel?: string;
  variant?: "default" | "pyq" | "hardcopy";
  thumbnailUrl?: string;
  comboKind?: string;
  sourceType?: string;
  totalMrp?: number;
  offerPrice?: number;
  saveAmount?: number;
  savePercent?: number;
  items?: ComboItem[];
};

function parsePrice(priceLabel: string, fallback = 0) {
  const digits = safeStr(priceLabel).replace(/[^\d]/g, "");
  return digits ? Number(digits) : Number(fallback || 0);
}

function categoryLabelFromSlug(slug: string) {
  const map: Record<string, string> = {
    "solved-assignments": "Solved Assignments",
    "question-papers": "PYQs",
    "guess-papers": "Guess Papers",
    "ebooks-notes": "Ebooks / Notes",
    "handwritten-pdfs": "Handwritten PDFs",
    "handwritten-hardcopy": "Handwritten Hardcopy",
    "projects-synopsis": "Project & Synopsis",
  };

  return map[safeStr(slug)] || safeStr(slug).replace(/-/g, " ");
}

function variantStyles(variant?: string) {
  const v = safeStr(variant);

  if (v === "pyq") {
    return {
      heroBg: "bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-50",
      pill: "bg-emerald-600 text-white",
      softPill: "bg-emerald-50 text-emerald-700 border-emerald-200",
      cta: "bg-emerald-600 hover:bg-emerald-700 text-white",
      icon: <FileText size={14} />,
      typeLabel: "PYQ Combo",
    };
  }

  if (v === "hardcopy") {
    return {
      heroBg: "bg-gradient-to-br from-orange-100 via-amber-50 to-yellow-50",
      pill: "bg-orange-600 text-white",
      softPill: "bg-orange-50 text-orange-700 border-orange-200",
      cta: "bg-slate-900 hover:bg-slate-800 text-white",
      icon: <Truck size={14} />,
      typeLabel: "Hardcopy Combo",
    };
  }

  return {
    heroBg: "bg-gradient-to-br from-blue-100 via-indigo-50 to-cyan-50",
    pill: "bg-blue-600 text-white",
    softPill: "bg-blue-50 text-blue-700 border-blue-200",
    cta: "bg-slate-900 hover:bg-slate-800 text-white",
    icon: <Boxes size={14} />,
    typeLabel: "Combo Pack",
  };
}

function getVisualItems(items?: ComboItem[], max = 6) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      title: safeStr(item?.title),
      thumbnailUrl: safeStr(item?.thumbnailUrl),
    }))
    .filter((item) => item.title || item.thumbnailUrl)
    .slice(0, max);
}

function ComboVisualBlock({
  combo,
  isPyq,
}: {
  combo: ComboDetails;
  isPyq: boolean;
}) {
  const visualItems = getVisualItems(combo.items, 6);

  if (safeStr(combo.thumbnailUrl) && (isPyq || visualItems.length === 0)) {
    return (
      <div className="relative h-[420px] sm:h-[520px] xl:h-[790px] w-full overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-xl">
        <Image
          src={safeStr(combo.thumbnailUrl)}
          alt={safeStr(combo.title) || "Combo Thumbnail"}
          fill
          sizes="(max-width: 1024px) 100vw, 700px"
          className="object-cover scale-110 blur-2xl opacity-20"
          priority={false}
        />

        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/5 to-white/20" />

        <div className="absolute inset-0 p-3 sm:p-4">
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[24px] bg-white/40">
            <Image
              src={safeStr(combo.thumbnailUrl)}
              alt={safeStr(combo.title) || "Combo Thumbnail"}
              fill
              sizes="(max-width: 1024px) 100vw, 700px"
              className="object-contain object-center"
              priority={false}
            />
          </div>
        </div>

        <div className="absolute left-4 top-4">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-extrabold shadow ${
              isPyq ? "bg-emerald-600 text-white" : "bg-slate-900 text-white"
            }`}
          >
            <Sparkles size={13} />
            COMBO PREVIEW
          </span>
        </div>
      </div>
    );
  }

  const rows =
    visualItems.length <= 2
      ? "1fr"
      : visualItems.length <= 4
      ? "1fr 1fr"
      : "1fr 1fr 1fr";

  return (
    <div className="relative h-[420px] sm:h-[520px] xl:h-[790px] w-full overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-xl">
      <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50 to-slate-100" />
      <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.08)_1px,transparent_0)] bg-[length:22px_22px]" />

      <div className="absolute inset-0 p-3 sm:p-4">
        <div
          className="grid h-full w-full grid-cols-2 gap-3 overflow-hidden rounded-[24px]"
          style={{ gridTemplateRows: rows }}
        >
          {visualItems.map((item, idx) => (
            <div
              key={`${item.title || "item"}-${idx}`}
              className="relative overflow-hidden rounded-[20px] border border-white/80 bg-white shadow-md"
            >
              {safeStr(item.thumbnailUrl) ? (
                <Image
                  src={safeStr(item.thumbnailUrl)}
                  alt={item.title || `Combo item ${idx + 1}`}
                  fill
                  sizes="(max-width: 1024px) 50vw, 320px"
                  className="object-cover object-center"
                  priority={false}
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200" />
              )}

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent p-3">
                <div className="line-clamp-2 text-[11px] sm:text-xs leading-5 font-extrabold text-white">
                  {item.title || `Included Item ${idx + 1}`}
                </div>
              </div>
            </div>
          ))}

          {visualItems.length === 0 ? (
            <div className="col-span-2 row-span-2 rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-100 via-white to-slate-100" />
          ) : null}
        </div>
      </div>

      <div className="absolute left-4 top-4">
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-extrabold text-white shadow">
          <Sparkles size={13} />
          INCLUDED ITEMS PREVIEW
        </span>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  valueClass = "text-slate-900",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <div
        className={`mt-1 text-[16px] md:text-[17px] leading-snug font-extrabold ${valueClass}`}
      >
        {value}
      </div>
    </div>
  );
}

export default function ComboDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { addToCart } = useCart();

  const category = safeStr(params?.category);
  const slug = safeStr(params?.slug);

  const [loading, setLoading] = useState(true);
  const [combo, setCombo] = useState<ComboDetails | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!category || !slug) return;

    let active = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(
          `/api/combos?category=${encodeURIComponent(
            category
          )}&slug=${encodeURIComponent(slug)}`,
          { cache: "no-store" }
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load combo");
        }

        const combos = Array.isArray(data?.combos) ? data.combos : [];
        const found = combos[0] || null;

        if (!found) {
          if (active) {
            setCombo(null);
            setError("Combo not found");
          }
          return;
        }

        if (!active) return;
        setCombo(found);
      } catch (e: any) {
        if (!active) return;
        setCombo(null);
        setError(e?.message || "Failed to load combo");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [category, slug]);

  const isPyq = safeStr(combo?.variant) === "pyq";
  const isHardcopy = safeStr(combo?.variant) === "hardcopy";

  const displayCombo = useMemo<ComboDetails | null>(() => {
    if (!combo) return null;
    if (!isPyq) return combo;

    return {
      ...combo,
      title: formatPyqUiText(combo.title),
      shortTitle: formatPyqUiText(combo.shortTitle),
      description: formatPyqUiText(combo.description),
      shortDescription: formatPyqUiText(combo.shortDescription),
      mediumLabel: formatLanguageLabel(combo.mediumLabel),
      sessionLabel: formatSessionLabel(combo.sessionLabel),
      subjectCodesLabel: formatSubjectCodesLabel(combo.subjectCodesLabel),
      items: (Array.isArray(combo.items) ? combo.items : []).map((item) => ({
        ...item,
        title: formatPyqUiText(item?.title),
        subtitle: formatPyqUiText(item?.subtitle),
      })),
    };
  }, [combo, isPyq]);

  const items = useMemo(() => {
    return Array.isArray(displayCombo?.items) ? displayCombo.items : [];
  }, [displayCombo]);

  const styles = useMemo(
    () => variantStyles(displayCombo?.variant),
    [displayCombo?.variant]
  );
  const categoryLabel = categoryLabelFromSlug(category);

  const detailsFactsBlock = (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {safeStr(displayCombo?.badge) ? (
          <span
            className={`px-3 py-1 rounded-full border text-xs font-extrabold ${styles.softPill}`}
          >
            {displayCombo?.badge}
          </span>
        ) : null}

        {safeStr(displayCombo?.mediumLabel) ? (
          <span className="px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-extrabold">
            {displayCombo?.mediumLabel}
          </span>
        ) : null}

        {safeStr(displayCombo?.sessionLabel) ? (
          <span className="px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-extrabold">
            {displayCombo?.sessionLabel}
          </span>
        ) : null}

        <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-extrabold">
          {items.length} Included Items
        </span>

        <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-extrabold">
          Same Category Bundle
        </span>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          icon={<IndianRupee size={12} />}
          label="Bundle Price"
          value={safeStr(displayCombo?.priceLabel) || "₹0"}
        />
        <StatCard
          icon={<Tag size={12} />}
          label="Savings"
          value={safeStr(displayCombo?.saveLabel) || "Bundle Offer"}
          valueClass="text-emerald-700"
        />
        <StatCard
          icon={<Languages size={12} />}
          label="Medium"
          value={safeStr(displayCombo?.mediumLabel) || "-"}
        />
        <StatCard
          icon={<CalendarClock size={12} />}
          label="Session"
          value={safeStr(displayCombo?.sessionLabel) || "-"}
        />
      </div>

      {(safeStr(displayCombo?.subjectCodesLabel) ||
        safeStr(displayCombo?.courseCodesLabel)) && (
        <div className="grid md:grid-cols-2 gap-3">
          {safeStr(displayCombo?.subjectCodesLabel) ? (
            <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                <Hash size={12} />
                Subject Codes
              </div>
              <div className="mt-2 text-[16px] leading-snug font-extrabold text-slate-800 break-words">
                {safeStr(displayCombo?.subjectCodesLabel)}
              </div>
            </div>
          ) : null}

          {safeStr(displayCombo?.courseCodesLabel) ? (
            <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                <BookOpen size={12} />
                Course Codes
              </div>
              <div className="mt-2 text-[16px] leading-snug font-extrabold text-slate-800 break-words">
                {safeStr(displayCombo?.courseCodesLabel)}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 shadow-sm p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="text-emerald-600 mt-0.5" size={18} />
            <div className="text-sm font-extrabold text-slate-900 leading-relaxed">
              Carefully grouped products in one combo pack
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 shadow-sm p-4">
          <div className="flex items-start gap-3">
            <PackageCheck className="text-blue-600 mt-0.5" size={18} />
            <div className="text-sm font-extrabold text-slate-900 leading-relaxed">
              Included items visible before checkout
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 shadow-sm p-4">
          <div className="flex items-start gap-3">
            <BadgeCheck className="text-indigo-600 mt-0.5" size={18} />
            <div className="text-sm font-extrabold text-slate-900 leading-relaxed">
              {Number(displayCombo?.savePercent || 0) > 0
                ? `${Number(
                    displayCombo?.savePercent || 0
                  )}% discount applied on bundle pricing`
                : "Bundle pricing advantage included"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!category || !slug) notFound();

  function handleAddComboToCart() {
    if (!displayCombo) return;

    const comboId = `combo:${safeStr(displayCombo.categorySlug)}:${safeStr(
      displayCombo.slug
    )}`;
    const comboPrice = parsePrice(
      safeStr(displayCombo.priceLabel),
      Number(displayCombo.offerPrice || 0)
    );

    addToCart({
      id: comboId,
      title: safeStr(displayCombo.title),
      price: comboPrice,
      image: safeStr(displayCombo.thumbnailUrl),
      quantity: 1,
      category: "Combo",
      courseCode: safeStr(displayCombo.categorySlug),
      availability: "available",
      canPurchase: true,
      itemType: "combo",
      comboSlug: safeStr(displayCombo.slug),
      comboCategorySlug: safeStr(displayCombo.categorySlug),
      comboBadge: safeStr(displayCombo.badge),
      comboSaveLabel: safeStr(displayCombo.saveLabel),
      comboMediumLabel: safeStr(displayCombo.mediumLabel),
      comboSessionLabel: safeStr(displayCombo.sessionLabel),
      comboItems: items.map((x) => ({
        title: safeStr(x.title),
        subtitle: safeStr(x.subtitle),
      })),
    });

    router.push("/cart");
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <Navbar />

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
          <Link
            href={`/combo/${category}`}
            className="hover:text-blue-700 font-semibold"
          >
            {categoryLabel}
          </Link>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="text-blue-700 font-extrabold">
            {loading ? "Loading..." : displayCombo?.title || "Combo"}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="max-w-[1600px] mx-auto px-4 py-16">
          <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center font-extrabold text-slate-600">
            Loading combo details...
          </div>
        </div>
      ) : error || !displayCombo ? (
        <div className="max-w-[1600px] mx-auto px-4 py-16">
          <div className="rounded-3xl border border-red-200 bg-red-50 p-10 text-center">
            <div className="text-xl font-extrabold text-red-700">
              Unable to load combo
            </div>
            <div className="mt-2 text-sm font-semibold text-red-600">
              {error || "Combo not found"}
            </div>
          </div>
        </div>
      ) : (
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-[#f7f9ff]" />
          <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.06)_1px,transparent_0)] bg-[length:22px_22px]" />

          <div className="relative max-w-[1600px] mx-auto px-4 py-8 md:py-12">
            <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-8 items-start">
              <div className="min-w-0">
                <div
                  className={`rounded-[32px] border border-gray-200 p-4 md:p-5 shadow-xl ${styles.heroBg}`}
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-3 py-1 text-[11px] font-extrabold shadow">
                      {styles.icon}
                      {styles.typeLabel}
                    </span>

                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold shadow ${styles.pill}`}
                    >
                      {safeStr(displayCombo.saveLabel) || "Bundle Offer"}
                    </span>
                  </div>

                  <ComboVisualBlock combo={displayCombo} isPyq={isPyq} />
                </div>

                <div className="mt-4 hidden lg:block">{detailsFactsBlock}</div>
              </div>

              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-extrabold text-slate-700 shadow-sm">
                  <PackageCheck size={14} />
                  Combo Details
                </div>

                <h1 className="mt-3 text-[28px] leading-tight md:text-5xl font-extrabold text-slate-900">
                  {displayCombo.title}
                </h1>

                <p className="mt-3 text-sm md:text-lg font-medium text-slate-600 max-w-3xl leading-relaxed">
                  {safeStr(displayCombo.description) ||
                    "Explore this combo pack with included items, pricing benefit, medium details, and a clear checkout-ready bundle view."}
                </p>

                <div className="mt-5 rounded-[24px] border border-slate-200 bg-white shadow-lg overflow-hidden">
                  <div
                    className={`p-4 border-b border-slate-100 ${styles.heroBg}`}
                  >
                    <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                      Quick Action
                    </div>
                    <div className="mt-1 text-lg md:text-xl font-extrabold text-slate-900">
                      Add this combo to cart
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-700 leading-relaxed">
                      Review the bundle details and continue to checkout when
                      you are ready.
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={handleAddComboToCart}
                        className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-extrabold transition shadow-lg ${styles.cta}`}
                      >
                        <ShoppingCart size={18} />
                        Add Combo to Cart
                      </button>

                      <Link
                        href="/cart"
                        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 font-extrabold hover:bg-slate-100 transition"
                      >
                        View Cart
                        <ArrowRight size={18} />
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-[28px] border border-orange-200 bg-[#fffaf4] shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-orange-100 bg-[#fff6ec]">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div>
                        <div className="inline-flex items-center gap-2 text-[26px] font-extrabold text-orange-800">
                          <Boxes size={20} />
                          Combo Package
                        </div>
                        <div className="mt-3 text-base font-extrabold text-orange-700">
                          This combo includes {items.length} product
                          {items.length === 1 ? "" : "s"}:
                        </div>
                      </div>

                      <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2 text-xs font-extrabold text-orange-700">
                        <PackageCheck size={14} />
                        {items.length} Items Included
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="space-y-3">
                      {items.length ? (
                        items.map((item: any, idx: number) => (
                          <div
                            key={`${item?.title || "item"}-${idx}`}
                            className="rounded-2xl border border-orange-100 bg-white px-4 py-3 shadow-sm"
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
                                <CheckCircle2 size={14} />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="text-[15px] leading-6 font-semibold text-slate-700">
                                  {safeStr(item?.title) || "Untitled Item"}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-orange-100 bg-white p-6 text-center">
                          <div className="font-extrabold text-slate-900">
                            No item details available
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 rounded-2xl border border-orange-200 bg-white px-4 py-4 shadow-sm">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-4 text-sm">
                          <span className="font-medium text-slate-500">
                            Individual Total:
                          </span>
                          <span className="font-semibold text-slate-400 line-through">
                            {Number(displayCombo.totalMrp || 0) > 0
                              ? `₹${Number(displayCombo.totalMrp || 0)}`
                              : safeStr(displayCombo.saveLabel)
                              ? "Higher than combo price"
                              : "-"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-4 text-base">
                          <span className="font-medium text-slate-600">
                            Combo Price:
                          </span>
                          <span className="font-extrabold text-blue-700 text-[28px] leading-none">
                            {safeStr(displayCombo.priceLabel) || "₹0"}
                          </span>
                        </div>

                        <div className="border-t border-orange-100 pt-3 flex items-center justify-between gap-4">
                          <span className="font-extrabold text-emerald-700 text-lg">
                            You Save:
                          </span>
                          <span className="font-extrabold text-emerald-600 text-[18px]">
                            {safeStr(displayCombo.saveLabel) || "Bundle Offer"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {isHardcopy ? (
                  <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                    <div className="flex items-start gap-3">
                      <Truck className="text-orange-700 mt-0.5" size={18} />
                      <div>
                        <div className="font-extrabold text-orange-900">
                          Delivery-related combo pack
                        </div>
                        <div className="mt-1 text-sm font-semibold text-orange-800 leading-relaxed">
                          This bundle may include physical handwritten hardcopy
                          products, so delivery details will apply during
                          checkout.
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="text-blue-700 mt-0.5" size={18} />
                    <div>
                      <div className="font-extrabold text-blue-900">
                        Clear combo checkout view
                      </div>
                      <div className="text-sm text-slate-700 mt-1 leading-relaxed">
                        Review included products, pricing, medium, and session
                        details before adding this combo to your cart.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 lg:hidden">{detailsFactsBlock}</div>
              </div>
            </div>
          </div>
        </section>
      )}

      <Footer />
      <FloatingButtons />
    </main>
  );
}