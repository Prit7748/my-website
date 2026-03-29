"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { FileText, Truck, Sparkles, ShoppingCart, CheckCircle2, XCircle } from "lucide-react";
import { productHref } from "@/lib/productHref";
import { useCart } from "@/context/CartContext";
import { trackSelectItem } from "../lib/analytics";

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
};

const SOLVED_ASSIGNMENTS_CATEGORY = "Solved Assignments";
const HANDWRITTEN_HARDCOPY_CATEGORY = "Handwritten Hardcopy (Delivery)";

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

async function sendWantToBuyRequest(product: ApiProduct) {
  try {
    const res = await fetch("/api/products/want-to-buy", {
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
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {}

    if (!res.ok) throw new Error(data?.error || data?.message || "Request failed");
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Request failed" };
  }
}

function normalizeSession(x: any) {
  const s = safeText(x);
  if (!s) return "";
  return s.replace(/\s+/g, " ").trim();
}

function extractSubjectTitle(p: ApiProduct) {
  const lang = safeText(p?.language).toLowerCase();
  const hi = safeText(p?.subjectTitleHi);
  const en = safeText(p?.subjectTitleEn);

  if ((lang === "hindi" || lang.startsWith("hin")) && hi) return hi;
  if ((lang === "english" || lang.startsWith("eng")) && en) return en;

  return hi || en || safeText(p?.subjectTitle) || "";
}

function extractSubjectCode(p: ApiProduct) {
  const direct = safeText(p?.subjectCode);
  if (direct) return direct;

  const t = safeText(p?.title);
  const m = t.match(/\b([A-Z]{2,6})\s*[-]?\s*(\d{2,4})\b/);
  if (m) return `${m[1]} ${m[2]}`.trim();

  return "";
}

function extractCourseCodesText(p: ApiProduct) {
  const list = Array.isArray(p?.courseCodes)
    ? p.courseCodes.map((x: any) => safeText(x)).filter(Boolean)
    : [];

  if (list.length) return Array.from(new Set(list)).join(", ");

  return safeText(p?.courseCode) || "";
}

function extractMedium(p: ApiProduct) {
  return safeText(p?.language) || safeText(p?.medium) || "";
}

function isSolvedAssignmentProduct(product: ApiProduct) {
  return safeText(product.category).toLowerCase() === SOLVED_ASSIGNMENTS_CATEGORY.toLowerCase();
}

function isHandwrittenHardcopyProduct(product: ApiProduct) {
  return safeText(product.category).toLowerCase() === HANDWRITTEN_HARDCOPY_CATEGORY.toLowerCase();
}

function buildAssignmentMasterThumb(p: ApiProduct) {
  const session = normalizeSession(p?.session) || "2025-2026";
  const code = extractSubjectCode(p) || "IGNOU";
  const title = extractSubjectTitle(p) || "Solved Assignment";
  const course = extractCourseCodesText(p) || "IGNOU";
  const medium = extractMedium(p) || "English";

  const qs = new URLSearchParams({
    session,
    code,
    title,
    course,
    medium,
  });

  const v = safeText(p?._id) || safeText(p?.slug) || "1";
  return `/api/thumb/assignment?${qs.toString()}&v=${encodeURIComponent(v)}`;
}

function buildHardcopyMasterThumb(p: ApiProduct) {
  const session = normalizeSession(p?.session) || "2025-26";
  const code = extractSubjectCode(p) || "IGNOU";
  const medium = extractMedium(p) || "English";

  const qs = new URLSearchParams({
    session,
    code,
    medium,
  });

  const v = safeText(p?._id) || safeText(p?.slug) || "1";
  return `/api/thumb/hardcopy?${qs.toString()}&v=${encodeURIComponent(v)}`;
}

function getSortedUploadedImages(product: ApiProduct) {
  const arr = Array.isArray(product.images)
    ? product.images
        .map((x) => safeText(x))
        .filter(Boolean)
        .sort((a, b) => {
          const aName = a.split("?")[0].split("/").pop() || "";
          const bName = b.split("?")[0].split("/").pop() || "";
          return aName.localeCompare(bName, undefined, { numeric: true, sensitivity: "base" });
        })
    : [];

  return Array.from(new Set(arr));
}

function firstValidImage(product: ApiProduct) {
  if (isSolvedAssignmentProduct(product)) {
    return buildAssignmentMasterThumb(product);
  }

  if (isHandwrittenHardcopyProduct(product)) {
    return buildHardcopyMasterThumb(product);
  }

  const uploaded = getSortedUploadedImages(product);
  return uploaded[0] || "";
}

function secondValidImage(product: ApiProduct, fallback: string) {
  if (isSolvedAssignmentProduct(product) || isHandwrittenHardcopyProduct(product)) {
    return fallback;
  }

  const uploaded = getSortedUploadedImages(product);
  return uploaded[1] || uploaded[0] || "";
}

export default function ProductCard({ product }: { product: ApiProduct }) {
  const [imgBroken, setImgBroken] = useState(false);
  const [wantToBuySent, setWantToBuySent] = useState(false);
  const [wantLoading, setWantLoading] = useState(false);

  const { cart, addToCart, removeFromCart } = useCart();

  const [toast, setToast] = useState<{ show: boolean; text: string; kind: "add" | "remove" | "info" | "success" }>({
    show: false,
    text: "",
    kind: "add",
  });
  const toastTimer = useRef<any>(null);

  const imgPrimary = useMemo(() => {
    return firstValidImage(product);
  }, [product]);

  const imgQuick = useMemo(() => {
    return secondValidImage(product, imgPrimary);
  }, [product, imgPrimary]);

  const hasDiscount = !!product.oldPrice && Number(product.oldPrice) > Number(product.price || 0);
  const discountPct = hasDiscount
    ? Math.round(((Number(product.oldPrice) - Number(product.price)) / Number(product.oldPrice)) * 100)
    : 0;

  const isHardcopy = safeText(product.category).toLowerCase().includes("hardcopy");
  const isDigital = product.isDigital ?? !isHardcopy;

  const href = productHref({ slug: product.slug, category: product.category });

  const courseCodeText =
    product.courseCode || (Array.isArray(product.courseCodes) ? product.courseCodes.join(", ") : "") || "";

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
    toastTimer.current = setTimeout(() => setToast((p) => ({ ...p, show: false })), 1800);
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
      showToast("info", result.error || "Request could not be submitted. Please try again.");
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
      text: isOnDemand ? "Add to Cart" : "Add to Cart",
      cls: "bg-blue-600 text-white border-blue-600 hover:bg-blue-700",
    };
  }, [inCart, isWantToBuy, wantToBuySent, wantLoading, isOnDemand]);

  const showPrimaryImage = !!imgPrimary && !imgBroken;
  const showHoverImage =
    !!imgQuick &&
    !isSolvedAssignmentProduct(product) &&
    !isHandwrittenHardcopyProduct(product) &&
    imgQuick !== imgPrimary;

  return (
    <div
      className="group relative rounded-2xl border border-gray-200 bg-white overflow-hidden
                 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl
                 active:scale-[0.99]"
    >
      {toast.show && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
          <div
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold shadow-lg border ${
              toast.kind === "add"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : toast.kind === "remove"
                ? "bg-rose-50 text-rose-800 border-rose-200"
                : toast.kind === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-slate-50 text-slate-800 border-slate-200"
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
      )}

      <Link href={href} className="block" aria-label={product.title} onClick={handleProductOpen}>
        <div className="relative aspect-[210/297] bg-white">
          {showPrimaryImage ? (
            <Image
              src={imgPrimary}
              alt={product.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw"
              onError={() => setImgBroken(true)}
              priority={false}
            />
          ) : null}

          {showHoverImage ? (
            <Image
              src={imgQuick}
              alt=""
              fill
              className="hidden md:block object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw"
            />
          ) : null}

          {hasDiscount && (
            <div className="absolute top-2 left-2 z-10">
              <span className="inline-flex items-center gap-1 rounded-lg bg-green-600 text-white text-[10px] font-extrabold px-2 py-1 shadow-sm">
                <Sparkles size={12} />
                SAVE {discountPct > 0 ? `${discountPct}%` : "MORE"}
              </span>
            </div>
          )}

          <div className="absolute top-2 right-2 z-10 flex flex-col gap-2 items-end">
            <span
              className={`inline-flex items-center gap-1 rounded-lg text-[10px] font-extrabold px-2 py-1 shadow-sm ${
                isDigital ? "bg-blue-600 text-white" : "bg-orange-600 text-white"
              }`}
            >
              {isDigital ? <FileText size={12} /> : <Truck size={12} />}
              {isDigital ? "PDF" : "HARDCOPY"}
            </span>
          </div>

          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="hidden md:flex absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-full rounded-xl bg-white/90 backdrop-blur px-3 py-2 text-center text-xs font-extrabold text-slate-800 shadow-sm border border-white/60">
              View Details →
            </div>
          </div>
        </div>

        <div className="p-3 pb-2">
          <div className="text-[10px] font-extrabold uppercase tracking-wide text-blue-700">
            {product.category || "Product"}
          </div>

          <h3 className="mt-1 font-extrabold text-[12px] md:text-sm text-slate-900 line-clamp-2 group-hover:text-blue-700 transition">
            {product.title}
          </h3>

          <div className="mt-2 flex items-end gap-2">
            <div className="text-blue-700 font-extrabold text-sm md:text-base">₹{money(product.price)}</div>
            {!!product.oldPrice && Number(product.oldPrice) > 0 && (
              <div className="text-xs text-gray-400 line-through font-bold">₹{money(Number(product.oldPrice))}</div>
            )}
          </div>

          <div className="mt-2 text-[11px] text-gray-600 font-bold flex flex-wrap gap-x-2 gap-y-1">
            {courseCodeText ? (
              <span className="rounded-md bg-gray-50 px-2 py-1 border border-gray-100">{courseCodeText}</span>
            ) : null}
            {product.session ? (
              <span className="rounded-md bg-gray-50 px-2 py-1 border border-gray-100">{product.session}</span>
            ) : null}
            {product.language ? (
              <span className="rounded-md bg-gray-50 px-2 py-1 border border-gray-100">{product.language}</span>
            ) : null}
          </div>
        </div>
      </Link>

      <div className="px-3 pb-3">
        <button
          onClick={handleToggleCart}
          disabled={wantLoading}
          className={`w-full inline-flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-extrabold transition border ${buttonUi.cls} ${
            wantLoading ? "opacity-80 cursor-not-allowed" : ""
          }`}
          title={buttonUi.text}
        >
          <ShoppingCart size={16} />
          {buttonUi.text}
        </button>
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-0 ring-blue-200/60 group-hover:ring-4 transition-all duration-300" />
    </div>
  );
}