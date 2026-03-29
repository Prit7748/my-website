// app/combo/[category]/builder/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import {
  ChevronRight,
  Wrench,
  Search,
  CheckCircle2,
  ShoppingCart,
  Boxes,
  ShieldCheck,
  Languages,
  CalendarClock,
  IndianRupee,
  Filter,
  PackageCheck,
} from "lucide-react";
import { useCart } from "@/context/CartContext";

const ALLOWED_CATEGORY_SLUGS = new Set([
  "solved-assignments",
  "question-papers",
  "guess-papers",
  "ebooks-notes",
  "handwritten-pdfs",
  "handwritten-hardcopy",
  "projects-synopsis",
]);

type BuilderProduct = {
  id: string;
  title: string;
  slug: string;
  category: string;
  subjectCode: string;
  subjectTitleEn?: string;
  subjectTitleHi?: string;
  courseCodes?: string[];
  courseTitles?: string[];
  session: string;
  session6?: string;
  medium: string;
  lang3?: string;
  price: number;
  thumbUrl?: string;
  createdAt?: string;
};

type BuilderConfig = {
  categorySlug: string;
  categoryLabel: string;
  minProductsRequired: number;
  maxProductsAllowed: number;
  discountType: string;
  discountValue: number;
  sameCategoryOnly: boolean;
  sameSubjectOnly: boolean;
  sameMediumOnly: boolean;
  useLatestSessionsOnly: boolean;
  latestProductCount: number;
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function categoryLabelFromSlug(slug: string) {
  const map: Record<string, string> = {
    "solved-assignments": "Solved Assignments",
    "question-papers": "Question Papers (PYQ)",
    "guess-papers": "Guess Papers",
    "ebooks-notes": "Ebooks / Notes",
    "handwritten-pdfs": "Handwritten PDFs",
    "handwritten-hardcopy": "Handwritten Hardcopy",
    "projects-synopsis": "Project & Synopsis",
  };

  return map[safeStr(slug)] || safeStr(slug).replace(/-/g, " ");
}

function money(n: number) {
  try {
    return new Intl.NumberFormat("en-IN").format(Number(n || 0));
  } catch {
    return String(n || 0);
  }
}

function computeDiscountedPrice(total: number, discountType: string, discountValue: number) {
  const t = Math.max(0, Number(total || 0));
  const d = Math.max(0, Number(discountValue || 0));
  const type = safeStr(discountType).toLowerCase();

  if (type === "flat") {
    return Math.max(0, Math.round(t - d));
  }

  return Math.max(0, Math.round(t * (1 - d / 100)));
}

function uniqueStrings(arr: string[]) {
  return Array.from(new Set((arr || []).map((x) => safeStr(x)).filter(Boolean)));
}

function buildGeneratedComboTitle(
  categoryLabel: string,
  selectedProducts: BuilderProduct[],
  medium: string
) {
  const subjectCodes = uniqueStrings(selectedProducts.map((x) => safeStr(x.subjectCode)));
  const courseCodes = uniqueStrings(
    selectedProducts.flatMap((x) =>
      (Array.isArray(x.courseCodes) ? x.courseCodes : []).map((c) => safeStr(c))
    )
  );

  if (subjectCodes.length === 1 && medium) {
    return `${subjectCodes[0]} ${medium} Custom Combo`.replace(/\s+/g, " ").trim();
  }

  if (subjectCodes.length === 1) {
    return `${subjectCodes[0]} ${categoryLabel} Custom Combo`.replace(/\s+/g, " ").trim();
  }

  if (courseCodes.length === 1) {
    return `${courseCodes[0]} ${categoryLabel} Custom Combo`.replace(/\s+/g, " ").trim();
  }

  return `${categoryLabel} Custom Combo (${selectedProducts.length} Items)`;
}

function buildBadge(config: BuilderConfig | null, selectedCount: number) {
  if (!config) return `${selectedCount} Items`;
  if (safeStr(config.discountType).toLowerCase() === "flat") {
    return `Save ₹${Number(config.discountValue || 0)}`;
  }
  return `Save ${Number(config.discountValue || 0)}%`;
}

function sessionSortValue(session6: string, session: string) {
  const s6 = safeStr(session6);
  if (/^\d{6}$/.test(s6)) return Number(s6);

  const raw = safeStr(session).toUpperCase();
  const m = raw.match(/(JUN|JUNE|DEC|DECEMBER)[\s\-]*(\d{2,4})/i);
  if (m) {
    const monRaw = m[1].toUpperCase();
    const yyRaw = m[2];
    const year = yyRaw.length === 2 ? Number(`20${yyRaw}`) : Number(yyRaw);
    const mm = monRaw.startsWith("JUN") ? 6 : 12;
    return year * 100 + mm;
  }

  const nums = raw.replace(/\D/g, "");
  if (nums.length >= 6) return Number(nums.slice(0, 6));
  if (nums.length === 4) return Number(`${nums}00`);
  return 0;
}

export default function ComboBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const { addToCart, cart } = useCart();

  const category = safeStr(params?.category);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const [allProducts, setAllProducts] = useState<BuilderProduct[]>([]);
  const [config, setConfig] = useState<BuilderConfig | null>(null);

  const [search, setSearch] = useState("");
  const [mediumFilter, setMediumFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    if (!ALLOWED_CATEGORY_SLUGS.has(category)) return;

    let active = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams();
        params.set("categorySlug", category);
        params.set("limit", "200");

        const res = await fetch(`/api/combo-builder/products?${params.toString()}`, {
          cache: "no-store",
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load builder products");
        }

        if (!active) return;

        const nextProducts = Array.isArray(data?.products) ? data.products : [];
        setAllProducts(nextProducts);
        setConfig(data?.builderConfig || null);

        const allowedIds = new Set(nextProducts.map((p: any) => safeStr(p.id)));
        setSelectedIds((prev) => prev.filter((id) => allowedIds.has(safeStr(id))));
      } catch (e: any) {
        if (!active) return;
        setAllProducts([]);
        setConfig(null);
        setError(e?.message || "Failed to load builder products");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [category]);

  const products = useMemo(() => {
    const q = safeStr(search).toLowerCase();

    return allProducts.filter((p) => {
      const mediumOk = !mediumFilter || safeStr(p.medium) === safeStr(mediumFilter);
      const subjectOk = !subjectFilter || safeStr(p.subjectCode) === safeStr(subjectFilter);

      const searchOk =
        !q ||
        [
          p.title,
          p.subjectCode,
          p.subjectTitleEn,
          p.subjectTitleHi,
          p.session,
          p.medium,
          ...(Array.isArray(p.courseCodes) ? p.courseCodes : []),
        ]
          .map((x) => safeStr(x).toLowerCase())
          .join(" ")
          .includes(q);

      return mediumOk && subjectOk && searchOk;
    });
  }, [allProducts, search, mediumFilter, subjectFilter]);

  const selectedProducts = useMemo(() => {
    const map = new Map(allProducts.map((p) => [p.id, p]));
    return selectedIds.map((id) => map.get(id)).filter(Boolean) as BuilderProduct[];
  }, [allProducts, selectedIds]);

  const mediumOptions = useMemo(() => {
    return Array.from(new Set(allProducts.map((p) => safeStr(p.medium)).filter(Boolean))).sort();
  }, [allProducts]);

  const subjectOptions = useMemo(() => {
    return Array.from(new Set(allProducts.map((p) => safeStr(p.subjectCode)).filter(Boolean))).sort();
  }, [allProducts]);

  const totalMrp = useMemo(() => {
    return selectedProducts.reduce((acc, item) => acc + Math.max(0, Number(item.price || 0)), 0);
  }, [selectedProducts]);

  const offerPrice = useMemo(() => {
    if (!config) return totalMrp;
    return computeDiscountedPrice(totalMrp, config.discountType, config.discountValue);
  }, [config, totalMrp]);

  const saveAmount = Math.max(0, totalMrp - offerPrice);

  const detectedMedium = useMemo(() => {
    const mediums = uniqueStrings(selectedProducts.map((x) => safeStr(x.medium)));
    return mediums.length === 1 ? mediums[0] : "";
  }, [selectedProducts]);

  const detectedSessionLabel = useMemo(() => {
    if (!selectedProducts.length) return "";

    const sorted = [...selectedProducts].sort(
      (a, b) =>
        sessionSortValue(safeStr(b.session6), safeStr(b.session)) -
        sessionSortValue(safeStr(a.session6), safeStr(a.session))
    );

    const first = safeStr(sorted[0]?.session);
    const last = safeStr(sorted[sorted.length - 1]?.session);

    if (first && last && first !== last) return `${first} to ${last}`;
    return first || "";
  }, [selectedProducts]);

  const detectedSubjectCodesLabel = useMemo(() => {
    return uniqueStrings(selectedProducts.map((x) => safeStr(x.subjectCode))).join(", ");
  }, [selectedProducts]);

  const generatedTitle = useMemo(() => {
    return buildGeneratedComboTitle(
      safeStr(config?.categoryLabel) || categoryLabelFromSlug(category),
      selectedProducts,
      detectedMedium
    );
  }, [config, category, selectedProducts, detectedMedium]);

  const isMinSatisfied = useMemo(() => {
    return selectedIds.length >= Number(config?.minProductsRequired || 0);
  }, [selectedIds.length, config]);

  const isMaxSatisfied = useMemo(() => {
    const max = Number(config?.maxProductsAllowed || 0);
    if (max <= 0) return true;
    return selectedIds.length <= max;
  }, [selectedIds.length, config]);

  const sameSubjectValid = useMemo(() => {
    if (!config?.sameSubjectOnly || selectedProducts.length <= 1) return true;
    const first = safeStr(selectedProducts[0]?.subjectCode);
    return selectedProducts.every((x) => safeStr(x.subjectCode) === first);
  }, [config, selectedProducts]);

  const sameMediumValid = useMemo(() => {
    if (!config?.sameMediumOnly || selectedProducts.length <= 1) return true;
    const first = safeStr(selectedProducts[0]?.medium);
    return selectedProducts.every((x) => safeStr(x.medium) === first);
  }, [config, selectedProducts]);

  const canProceed = isMinSatisfied && isMaxSatisfied && sameSubjectValid && sameMediumValid;

  if (!ALLOWED_CATEGORY_SLUGS.has(category)) {
    notFound();
  }

  function toggleSelect(id: string) {
    const max = Number(config?.maxProductsAllowed || 0);
    setActionError("");

    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }

      if (max > 0 && prev.length >= max) {
        setActionError(`Aap maximum ${max} products hi select kar sakte hain.`);
        return prev;
      }

      return [...prev, id];
    });
  }

  function handleAddBuilderComboToCart() {
    if (!config || !canProceed || !selectedProducts.length || addingToCart) return;

    try {
      setAddingToCart(true);
      setActionError("");

      const sortedIds = selectedProducts.map((x) => x.id).sort();
      const comboId = ["builder-combo", safeStr(config.categorySlug || category), sortedIds.join("-")].join(":");

      const existingCombo = Array.isArray(cart)
        ? cart.find((item: any) => safeStr(item?.id) === comboId)
        : null;

      if (existingCombo) {
        router.push("/cart");
        return;
      }

      const comboItems = selectedProducts.map((item) => ({
        title: safeStr(item.title),
        subtitle: [safeStr(item.subjectCode), safeStr(item.medium), safeStr(item.session)]
          .filter(Boolean)
          .join(" • "),
      }));

      const primaryImage = safeStr(selectedProducts[0]?.thumbUrl) || "";

      addToCart({
        id: comboId,
        title: generatedTitle,
        price: offerPrice,
        image: primaryImage,
        quantity: 1,
        category: "Combo",
        courseCode: safeStr(config.categorySlug || category),
        availability: "available",
        canPurchase: true,
        itemType: "combo",
        comboSlug: "",
        comboCategorySlug: safeStr(config.categorySlug || category),
        comboBadge: buildBadge(config, selectedProducts.length),
        comboSaveLabel:
          saveAmount > 0
            ? safeStr(config.discountType).toLowerCase() === "flat"
              ? `Save ₹${Number(config.discountValue || 0)}`
              : `Save ${Number(config.discountValue || 0)}%`
            : "",
        comboMediumLabel: detectedMedium,
        comboSessionLabel: detectedSessionLabel,
        comboItems,
        comboBuilderProductIds: sortedIds,
      });

      router.push("/cart");
    } catch {
      setActionError("Combo ko cart me add karne me problem aa gayi.");
    } finally {
      setAddingToCart(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
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
          <Link href={`/combo/${encodeURIComponent(category)}`} className="hover:text-blue-700 font-semibold">
            {categoryLabelFromSlug(category)}
          </Link>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="text-blue-700 font-extrabold">Builder</span>
        </div>
      </div>

      <section className="max-w-[1600px] mx-auto px-4 py-8 md:py-10">
        <div className="rounded-[32px] border border-gray-200 bg-gradient-to-br from-blue-50 via-white to-indigo-50 shadow-xl overflow-hidden">
          <div className="p-6 md:p-8 border-b border-gray-100">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-3 py-1 text-[11px] font-extrabold shadow">
              <Wrench size={13} />
              LIVE BUILDER
            </div>

            <h1 className="mt-4 text-[28px] md:text-5xl font-extrabold text-slate-900 leading-tight">
              {categoryLabelFromSlug(category)} Combo Builder
            </h1>

            <p className="mt-3 text-sm md:text-lg font-medium text-slate-600 max-w-4xl leading-relaxed">
              Category products select kijiye, rules validate honge, aur provisional combo price preview live dikhega.
            </p>
          </div>

          <div className="p-5 md:p-6">
            {loading ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center font-extrabold text-slate-600">
                Loading builder products...
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
                <div className="text-lg font-extrabold text-red-700">Unable to load builder</div>
                <div className="mt-1 text-sm font-semibold text-red-600">{error}</div>
              </div>
            ) : (
              <div className="grid xl:grid-cols-[1.1fr_0.9fr] gap-6 items-start">
                <div className="min-w-0">
                  <div className="rounded-[28px] border border-gray-200 bg-white shadow-sm p-4 md:p-5">
                    <div className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
                      <Filter size={18} />
                      Filter Products
                    </div>

                    <div className="mt-4 grid md:grid-cols-3 gap-3">
                      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                        <div className="flex items-center gap-2 text-slate-500">
                          <Search size={15} />
                          <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search title, code..."
                            className="w-full outline-none text-sm"
                          />
                        </div>
                      </div>

                      <select
                        value={mediumFilter}
                        onChange={(e) => setMediumFilter(e.target.value)}
                        className="rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none text-sm font-semibold"
                      >
                        <option value="">All Mediums</option>
                        {mediumOptions.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>

                      <select
                        value={subjectFilter}
                        onChange={(e) => setSubjectFilter(e.target.value)}
                        className="rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none text-sm font-semibold"
                      >
                        <option value="">All Subject Codes</option>
                        {subjectOptions.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    {actionError ? (
                      <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-extrabold text-red-700">
                        {actionError}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-5 grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {products.map((product) => {
                      const isSelected = selectedIds.includes(product.id);

                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => toggleSelect(product.id)}
                          className={`text-left rounded-[24px] border shadow-sm overflow-hidden transition ${
                            isSelected
                              ? "border-blue-500 bg-blue-50 shadow-md"
                              : "border-gray-200 bg-white hover:shadow-md"
                          }`}
                        >
                          <div className="relative h-[180px] bg-gradient-to-br from-slate-100 via-white to-slate-100">
                            {safeStr(product.thumbUrl) ? (
                              <Image
                                src={safeStr(product.thumbUrl)}
                                alt={product.title}
                                fill
                                sizes="(max-width: 1280px) 50vw, 33vw"
                                className="object-contain p-3"
                              />
                            ) : null}
                          </div>

                          <div className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="text-sm font-extrabold text-slate-900 line-clamp-2">
                                {product.title}
                              </div>
                              {isSelected ? (
                                <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-blue-600 text-white text-[11px] font-extrabold px-2">
                                  ✓
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200 text-[11px] font-extrabold text-slate-700">
                                {product.subjectCode || "-"}
                              </span>
                              <span className="px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200 text-[11px] font-extrabold text-slate-700">
                                {product.medium || "-"}
                              </span>
                              <span className="px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200 text-[11px] font-extrabold text-slate-700">
                                {product.session || "-"}
                              </span>
                            </div>

                            <div className="mt-3 text-lg font-extrabold text-blue-700">
                              ₹{money(product.price)}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="min-w-0 xl:sticky xl:top-6">
                  <div className="rounded-[28px] border border-gray-200 bg-white shadow-xl overflow-hidden">
                    <div className="p-5 border-b border-gray-100 bg-gradient-to-br from-slate-50 via-white to-blue-50">
                      <div className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
                        <Boxes size={18} />
                        Builder Summary
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-600">
                        Selected items, rules aur pricing preview
                      </div>
                    </div>

                    <div className="p-5 space-y-4">
                      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-4">
                        <div className="text-[11px] uppercase font-extrabold text-indigo-700">
                          Generated Combo Title
                        </div>
                        <div className="mt-1 text-base font-extrabold text-slate-900">
                          {generatedTitle}
                        </div>
                        {detectedSubjectCodesLabel ? (
                          <div className="mt-2 text-xs font-bold text-indigo-800">
                            Subject Codes: {detectedSubjectCodesLabel}
                          </div>
                        ) : null}
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                          <div className="text-[11px] uppercase font-extrabold text-slate-500">
                            Selected Products
                          </div>
                          <div className="mt-1 text-xl font-extrabold text-slate-900">
                            {selectedIds.length}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                          <div className="text-[11px] uppercase font-extrabold text-slate-500">
                            Required Range
                          </div>
                          <div className="mt-1 text-sm font-extrabold text-slate-900">
                            {Number(config?.minProductsRequired || 0)} to{" "}
                            {Number(config?.maxProductsAllowed || 0) || "∞"}
                          </div>
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                          <div className="flex items-center gap-2 text-[11px] uppercase font-extrabold text-emerald-700">
                            <IndianRupee size={12} />
                            Total MRP
                          </div>
                          <div className="mt-1 text-xl font-extrabold text-slate-900">
                            ₹{money(totalMrp)}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
                          <div className="flex items-center gap-2 text-[11px] uppercase font-extrabold text-blue-700">
                            <ShoppingCart size={12} />
                            Combo Price
                          </div>
                          <div className="mt-1 text-xl font-extrabold text-slate-900">
                            ₹{money(offerPrice)}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
                        <div className="text-[11px] uppercase font-extrabold text-orange-700">
                          You Save
                        </div>
                        <div className="mt-1 text-lg font-extrabold text-slate-900">
                          ₹{money(saveAmount)}
                        </div>
                        <div className="mt-1 text-xs font-bold text-orange-700">
                          Discount: {safeStr(config?.discountType || "percent")} • {Number(config?.discountValue || 0)}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div
                          className={`rounded-2xl border px-4 py-3 text-sm font-extrabold ${
                            isMinSatisfied
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-red-200 bg-red-50 text-red-700"
                          }`}
                        >
                          Minimum products rule: {isMinSatisfied ? "Passed" : "Not satisfied"}
                        </div>

                        <div
                          className={`rounded-2xl border px-4 py-3 text-sm font-extrabold ${
                            isMaxSatisfied
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-red-200 bg-red-50 text-red-700"
                          }`}
                        >
                          Maximum products rule: {isMaxSatisfied ? "Passed" : "Exceeded"}
                        </div>

                        <div
                          className={`rounded-2xl border px-4 py-3 text-sm font-extrabold ${
                            sameSubjectValid
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-red-200 bg-red-50 text-red-700"
                          }`}
                        >
                          Same subject rule: {config?.sameSubjectOnly ? (sameSubjectValid ? "Passed" : "Failed") : "Not required"}
                        </div>

                        <div
                          className={`rounded-2xl border px-4 py-3 text-sm font-extrabold ${
                            sameMediumValid
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-red-200 bg-red-50 text-red-700"
                          }`}
                        >
                          Same medium rule: {config?.sameMediumOnly ? (sameMediumValid ? "Passed" : "Failed") : "Not required"}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                          <PackageCheck size={16} />
                          Selected items snapshot
                        </div>
                        <div className="mt-3 space-y-2 max-h-[260px] overflow-auto">
                          {selectedProducts.length === 0 ? (
                            <div className="text-sm font-semibold text-slate-500">
                              No products selected yet.
                            </div>
                          ) : (
                            selectedProducts.map((item) => (
                              <div
                                key={item.id}
                                className="rounded-xl border border-gray-200 bg-white px-3 py-3"
                              >
                                <div className="text-sm font-extrabold text-slate-900">
                                  {item.title}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-extrabold text-slate-600">
                                  <span className="inline-flex items-center gap-1">
                                    <Languages size={11} />
                                    {item.medium || "-"}
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <CalendarClock size={11} />
                                    {item.session || "-"}
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <CheckCircle2 size={11} />
                                    {item.subjectCode || "-"}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                        <div className="flex items-start gap-3">
                          <ShieldCheck className="text-indigo-700 mt-0.5" size={18} />
                          <div>
                            <div className="font-extrabold text-indigo-900">
                              Cart-ready builder combo
                            </div>
                            <div className="mt-1 text-sm font-semibold text-indigo-800 leading-relaxed">
                              {canProceed
                                ? "Validation passed. Ab selected combo direct cart me add ho sakta hai."
                                : "Abhi rule validation complete nahi hui hai. Selection ko rules ke according adjust kijiye."}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          disabled={!canProceed || addingToCart}
                          onClick={handleAddBuilderComboToCart}
                          className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-extrabold transition shadow-lg ${
                            canProceed && !addingToCart
                              ? "bg-slate-900 text-white hover:bg-slate-800"
                              : "bg-slate-200 text-slate-500 cursor-not-allowed"
                          }`}
                        >
                          <ShoppingCart size={18} />
                          {addingToCart ? "Adding..." : "Add Builder Combo to Cart"}
                        </button>

                        <Link
                          href={`/combo/${encodeURIComponent(category)}`}
                          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-gray-200 bg-white text-slate-800 font-extrabold hover:bg-gray-50 transition"
                        >
                          Back to Category
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}