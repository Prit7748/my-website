"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  FileText,
  Truck,
  Sparkles,
  ShoppingCart,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { productHref } from "@/lib/productHref";
import { useCart } from "@/context/CartContext";
import { trackSelectItem } from "../lib/analytics";
import {
  buildAssignmentMasterThumbUrl,
  buildHardcopyMasterThumbUrl,
  extractCourseCodesText,
  isHandwrittenHardcopyProduct,
  isSolvedAssignmentProduct,
  pickSortedImagePair,
} from "@/lib/thumbUrls";

type ApiProduct = {
  _id?: string;
  title: string;
  slug: string;
  category?: string;

  courseCode?: string;
  courseCodes?: string[];

  session?: string;
  language?: string;

  price: number;
  oldPrice?: number | null;

  images?: string[];
  thumbUrl?: string;
  thumbnailUrl?: string;
  quickUrl?: string;

  isDigital?: boolean;

  availability?: "available" | "on_demand" | "want_to_buy" | string;
  rawAvailability?: string;
  canPurchase?: boolean;

  subjectCode?: string;
  subjectTitle?: string;
  subjectTitleHi?: string;
  subjectTitleEn?: string;
  medium?: string;
  updatedAt?: string;
};

function money(n: number) {
  try {
    return new Intl.NumberFormat("en-IN").format(Number(n || 0));
  } catch {
    return String(n);
  }
}

function safeText(x: any) {
  return String(x ?? "").trim();
}

function normAvail(v?: string) {
  return safeText(v).toLowerCase();
}

function isWantToBuyAvailability(v?: string) {
  const a = normAvail(v);
  return (
    a === "want_to_buy" ||
    a === "wanttobuy" ||
    a === "want-to-buy" ||
    a === "out_of_stock" ||
    a === "outofstock" ||
    a === "out-of-stock"
  );
}

function isOnDemandAvailability(v?: string) {
  const a = normAvail(v);
  return (
    a === "on_demand" ||
    a === "ondemand" ||
    a === "on-demand" ||
    a === "coming_soon" ||
    a === "comingsoon" ||
    a === "coming-soon"
  );
}

function schemaAvailability(v?: string) {
  if (isWantToBuyAvailability(v)) return "https://schema.org/OutOfStock";
  if (isOnDemandAvailability(v)) return "https://schema.org/PreOrder";
  return "https://schema.org/InStock";
}

function isPyqCategory(input: any) {
  const c = safeText(input).toLowerCase();
  return (
    c === "question papers (pyq)" ||
    c === "question papers" ||
    c === "question paper (pyq)" ||
    c === "question paper" ||
    c === "pyq" ||
    c === "pyqs" ||
    c === "previous year paper" ||
    c === "previous year papers"
  );
}

function looksLikePyqRuntimeThumb(url: string) {
  const u = safeText(url);
  if (!u) return false;
  return u.includes("/api/thumb/pyq?");
}

function extractPyqSubjectCode(product: ApiProduct) {
  const direct = safeText(product?.subjectCode);
  if (direct) return direct;

  const t = safeText(product?.title).toUpperCase();
  const m = t.match(/\b([A-Z]{2,10})\s*[- ]?\s*(\d{1,6}[A-Z0-9]*)\b/);
  if (m) return `${m[1]}-${m[2]}`;

  return "";
}

function extractPyqSubjectTitle(product: ApiProduct) {
  const lang = safeText(product?.language).toLowerCase();
  const hi = safeText(product?.subjectTitleHi);
  const en = safeText(product?.subjectTitleEn);
  const direct = safeText(product?.subjectTitle);

  if ((lang === "hindi" || lang.startsWith("hin")) && hi) return hi;
  if ((lang === "english" || lang.startsWith("eng")) && en) return en;

  return direct || hi || en || safeText(product?.title) || "Solved Previous Year Paper";
}

function extractPyqMedium(product: ApiProduct) {
  return safeText(product?.language) || safeText(product?.medium) || "English";
}

function buildPyqMasterThumbUrl(product: ApiProduct) {
  const session = safeText(product?.session) || "June, 2025";
  const code = extractPyqSubjectCode(product) || "IGNOU";
  const title = extractPyqSubjectTitle(product) || "Solved Previous Year Paper";
  const course = extractCourseCodesText(product) || "IGNOU";
  const medium = extractPyqMedium(product) || "English";

  const v = [
    "pyq-card-v2",
    safeText(product?._id),
    safeText(product?.slug),
    safeText(product?.updatedAt),
    safeText(product?.category),
    code,
    title,
    course,
    session,
    medium,
  ]
    .filter(Boolean)
    .join("|");

  const qs = new URLSearchParams({
    session,
    code,
    title,
    course,
    medium,
    v,
  });

  return `/api/thumb/pyq?${qs.toString()}`;
}

function sendWantToBuyRequest(product: ApiProduct) {
  return fetch("/api/products/want-to-buy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      productId: safeText(product._id),
      slug: safeText(product.slug),
      title: safeText(product.title),
      category: safeText(product.category),
      availability: safeText(product.availability),
    }),
  })
    .then(async (res) => {
      let data: any = null;
      try {
        data = await res.json();
      } catch {}
      if (!res.ok) throw new Error(data?.error || data?.message || "Request failed");
      return { ok: true, data };
    })
    .catch((e: any) => ({
      ok: false,
      error: e?.message || "Request failed",
    }));
}

function firstValidImage(product: ApiProduct) {
  if (isSolvedAssignmentProduct(product)) {
    return buildAssignmentMasterThumbUrl(product);
  }

  if (isHandwrittenHardcopyProduct(product)) {
    return buildHardcopyMasterThumbUrl(product);
  }

  if (isPyqCategory(product?.category)) {
    const runtimeThumbFromApi =
      safeText(product?.thumbnailUrl) && looksLikePyqRuntimeThumb(safeText(product.thumbnailUrl))
        ? safeText(product.thumbnailUrl)
        : safeText(product?.thumbUrl) && looksLikePyqRuntimeThumb(safeText(product.thumbUrl))
        ? safeText(product.thumbUrl)
        : "";

    if (runtimeThumbFromApi) return runtimeThumbFromApi;

    return buildPyqMasterThumbUrl(product);
  }

  const uploaded = pickSortedImagePair(product.images).all;
  return uploaded[0] || safeText(product.thumbnailUrl) || safeText(product.thumbUrl) || "";
}

function secondValidImage(product: ApiProduct, fallback: string) {
  if (
    isSolvedAssignmentProduct(product) ||
    isHandwrittenHardcopyProduct(product) ||
    isPyqCategory(product?.category)
  ) {
    return fallback;
  }

  const pair = pickSortedImagePair(product.images);
  return pair.second || pair.first || safeText(product.quickUrl) || fallback;
}

export default function ProductCard({ product }: { product: ApiProduct }) {
  const [imgBroken, setImgBroken] = useState(false);
  const [wantToBuySent, setWantToBuySent] = useState(false);
  const [wantLoading, setWantLoading] = useState(false);

  const { cart, addToCart, removeFromCart } = useCart();

  const [toast, setToast] = useState<{
    show: boolean;
    text: string;
    kind: "add" | "remove" | "info" | "success";
  }>({
    show: false,
    text: "",
    kind: "add",
  });

  const toastTimer = useRef<any>(null);

  const productTitle = safeText(product.title) || "IGNOU Product";
  const categoryLabel = safeText(product.category) || "Product";
  const subjectCode = safeText(product.subjectCode);
  const courseCodeText = extractCourseCodesText(product) || "";
  const sessionText = safeText(product.session);
  const languageText = safeText(product.language);
  const href = productHref({ slug: product.slug, category: product.category });

  const isHandwritten = useMemo(() => isHandwrittenHardcopyProduct(product), [product]);
  const isSolved = useMemo(() => isSolvedAssignmentProduct(product), [product]);
  const isPyq = useMemo(() => isPyqCategory(product?.category), [product]);

  const imgPrimary = useMemo(() => {
    return firstValidImage(product);
  }, [product]);

  const imgQuick = useMemo(() => {
    return secondValidImage(product, imgPrimary);
  }, [product, imgPrimary]);

  useEffect(() => {
    setImgBroken(false);
  }, [imgPrimary]);

  const hasDiscount =
    !!product.oldPrice && Number(product.oldPrice) > Number(product.price || 0);
  const discountPct = hasDiscount
    ? Math.round(
        ((Number(product.oldPrice) - Number(product.price)) / Number(product.oldPrice)) * 100
      )
    : 0;

  const isHardcopy = safeText(product.category).toLowerCase().includes("hardcopy");
  const isDigital = product.isDigital ?? !isHardcopy;

  const availability = normAvail(product.availability || "available");

  const isWantToBuy = isWantToBuyAvailability(availability) || product.canPurchase === false;
  const isOnDemand = !isWantToBuy && isOnDemandAvailability(availability);

  const cartId = safeText(product._id) || safeText(product.slug);

  const inCart = useMemo(() => {
    return cart.some((x) => safeText(x?.id) === cartId);
  }, [cart, cartId]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function showToast(kind: "add" | "remove" | "info" | "success", text?: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);

    setToast({
      show: true,
      kind,
      text:
        text ||
        (kind === "add"
          ? "Added to cart ✅"
          : kind === "remove"
          ? "Removed from cart ❌"
          : kind === "success"
          ? "Request received ✅"
          : "Updated"),
    });

    toastTimer.current = setTimeout(() => {
      setToast((p) => ({ ...p, show: false }));
    }, 1800);
  }

  async function handleWantToBuy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (wantLoading) return;

    setWantLoading(true);
    const result = await sendWantToBuyRequest(product);
    setWantLoading(false);

    if (result.ok) {
      setWantToBuySent(true);
      showToast(
        "success",
        "Request Received. We are processing your submission and will upload the product shortly. Keep an eye on our website for updates."
      );
    } else {
      showToast("info", (result as any).error || "Request could not be submitted. Please try again.");
    }
  }

  function handleToggleCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (isWantToBuy) {
      handleWantToBuy(e);
      return;
    }

    if (!inCart) {
      addToCart({
        id: cartId,
        title: product.title,
        price: Number(product.price || 0),
        image: imgPrimary || "",
        quantity: 1,
        category: product.category || "Product",
        courseCode: courseCodeText || undefined,
        availability: availability || "available",
        canPurchase: true,
      } as any);
      showToast("add");
    } else {
      removeFromCart(cartId);
      showToast("remove");
    }
  }

  function handleProductOpen() {
    trackSelectItem(
      {
        id: cartId,
        title: product.title,
        category: product.category || "Product",
        price: Number(product.price || 0),
        quantity: 1,
      },
      safeText(product.category) || "Product Listing"
    );
  }

  const buttonUi = useMemo(() => {
    if (isWantToBuy) {
      if (wantToBuySent) {
        return {
          text: wantLoading ? "Submitting..." : "Request Received",
          cls: "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700",
        };
      }

      return {
        text: wantLoading ? "Submitting..." : "Want to Buy",
        cls: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
      };
    }

    if (inCart) {
      return {
        text: "Added (Remove)",
        cls: "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700",
      };
    }

    return {
      text: "Add to Cart",
      cls: "bg-blue-600 text-white border-blue-600 hover:bg-blue-700",
    };
  }, [inCart, isWantToBuy, wantToBuySent, wantLoading]);

  const showPrimaryImage = !!imgPrimary && !imgBroken;
  const showHoverImage =
    !!imgQuick && !isSolved && !isHandwritten && !isPyq && imgQuick !== imgPrimary;

  const showDiscountBadge = hasDiscount && !isHandwritten && !isPyq;
  const showTypeBadge = !isHandwritten && !isPyq;

  return (
    <article
      itemScope
      itemType="https://schema.org/Product"
      className="group relative overflow-hidden rounded-[22px] border border-slate-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_18px_45px_rgba(15,23,42,0.10)] active:scale-[0.99]"
    >
      <meta itemProp="name" content={productTitle} />
      <meta itemProp="category" content={categoryLabel} />
      {subjectCode ? <meta itemProp="sku" content={subjectCode} /> : null}
      {imgPrimary ? <meta itemProp="image" content={imgPrimary} /> : null}

      <div itemProp="offers" itemScope itemType="https://schema.org/Offer">
        <meta itemProp="priceCurrency" content="INR" />
        <meta itemProp="price" content={String(Number(product.price || 0))} />
        <link itemProp="availability" href={schemaAvailability(product.availability)} />
      </div>

      {toast.show ? (
        <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2">
          <div
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-extrabold shadow-lg ${
              toast.kind === "add"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : toast.kind === "remove"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : toast.kind === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-slate-200 bg-slate-50 text-slate-800"
            }`}
          >
            {toast.kind === "add" ? (
              <CheckCircle2 size={16} />
            ) : toast.kind === "remove" ? (
              <XCircle size={16} />
            ) : toast.kind === "success" ? (
              <CheckCircle2 size={16} />
            ) : (
              <XCircle size={16} />
            )}
            {toast.text}
          </div>
        </div>
      ) : null}

      <Link
        href={href}
        itemProp="url"
        className="block"
        aria-label={productTitle}
        onClick={handleProductOpen}
      >
        <div className="relative aspect-[210/297] overflow-hidden bg-white">
          {showPrimaryImage ? (
            <Image
              src={imgPrimary}
              alt={productTitle}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw"
              onError={() => setImgBroken(true)}
              priority={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-center">
              <div className="px-4">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                  iStudentsPortal
                </div>
                <div className="mt-2 text-sm font-bold leading-6 text-slate-700">
                  {subjectCode || courseCodeText || "IGNOU Material"}
                </div>
              </div>
            </div>
          )}

          {showHoverImage ? (
            <Image
              src={imgQuick}
              alt=""
              fill
              className="hidden object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100 md:block"
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw"
            />
          ) : null}

          {showDiscountBadge ? (
            <div className="absolute left-2 top-2 z-10 hidden md:block">
              <span
                data-product-badge="discount"
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-[10px] font-extrabold text-white shadow-md"
              >
                <Sparkles size={12} />
                SAVE {discountPct > 0 ? `${discountPct}%` : "MORE"}
              </span>
            </div>
          ) : null}

          {showTypeBadge ? (
            <div className="absolute right-2 top-2 z-10 hidden items-end md:flex">
              <span
                data-product-badge="type"
                className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[10px] font-extrabold text-white shadow-md ${
                  isDigital ? "bg-blue-600" : "bg-orange-600"
                }`}
              >
                {isDigital ? <FileText size={12} /> : <Truck size={12} />}
                {isDigital ? "PDF" : "HARDCOPY"}
              </span>
            </div>
          ) : null}

          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/65 via-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          <div className="absolute bottom-3 left-3 right-3 hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100 md:flex">
            <div className="w-full rounded-xl border border-white/60 bg-white/90 px-3 py-2 text-center text-xs font-extrabold text-slate-800 shadow-sm backdrop-blur">
              View Details →
            </div>
          </div>
        </div>

        <div className="p-3 pb-2 md:p-3.5 md:pb-2.5">
          <h3
            itemProp="name"
            className="mt-0 line-clamp-2 text-[12px] font-extrabold text-slate-900 transition group-hover:text-blue-700 md:text-sm"
            title={productTitle}
          >
            {productTitle}
          </h3>

          <div className="mt-2 flex items-end gap-2">
            <div className="text-sm font-extrabold text-blue-700 md:text-base">
              ₹{money(product.price)}
            </div>
            {!!product.oldPrice && Number(product.oldPrice) > 0 ? (
              <div className="text-xs font-bold text-gray-400 line-through">
                ₹{money(Number(product.oldPrice))}
              </div>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold text-gray-600 md:text-[11px]">
            {subjectCode ? (
              <span className="rounded-lg border border-blue-100 bg-blue-50 px-2 py-1 text-blue-700">
                {subjectCode}
              </span>
            ) : null}

            {courseCodeText ? (
              <span className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-1">
                {courseCodeText}
              </span>
            ) : null}

            {sessionText ? (
              <span className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-1">
                {sessionText}
              </span>
            ) : null}

            {languageText ? (
              <span className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-1">
                {languageText}
              </span>
            ) : null}
          </div>
        </div>
      </Link>

      <div className="px-3 pb-3 md:px-3.5 md:pb-3.5">
        <button
          onClick={handleToggleCart}
          disabled={wantLoading}
          aria-label={buttonUi.text}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-extrabold transition ${buttonUi.cls} ${
            wantLoading ? "cursor-not-allowed opacity-80" : ""
          }`}
          title={buttonUi.text}
        >
          <ShoppingCart size={16} />
          {buttonUi.text}
        </button>
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-[22px] ring-0 ring-blue-200/60 transition-all duration-300 group-hover:ring-4" />
    </article>
  );
}