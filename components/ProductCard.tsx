"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { FileText, Truck, Sparkles, ShoppingCart, CheckCircle2, XCircle } from "lucide-react";
import { productHref } from "@/lib/productHref";
import { useCart } from "@/context/CartContext";

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
  availability?: "available" | "coming_soon" | "out_of_stock";
};

function money(n: number) {
  try {
    return new Intl.NumberFormat("en-IN").format(n);
  } catch {
    return String(n);
  }
}

function safeText(x: any) {
  return String(x ?? "").trim();
}

export default function ProductCard({ product }: { product: ApiProduct }) {
  const [imgBroken, setImgBroken] = useState(false);

  const { cart, addToCart, removeFromCart } = useCart();

  // ✅ Non-blocking toast (no screen freeze)
  const [toast, setToast] = useState<{ show: boolean; text: string; kind: "add" | "remove" }>({
    show: false,
    text: "",
    kind: "add",
  });
  const toastTimer = useRef<any>(null);

  const imgPrimary = useMemo(() => {
    return product.thumbUrl || product.thumbnailUrl || product.images?.[0] || "/images/cover1.jpg";
  }, [product.thumbUrl, product.thumbnailUrl, product.images]);

  const imgQuick = useMemo(() => {
    return product.quickUrl || product.images?.[1] || imgPrimary;
  }, [product.quickUrl, product.images, imgPrimary]);

  const hasDiscount = !!product.oldPrice && product.oldPrice > product.price;
  const discountPct = hasDiscount
    ? Math.round(((Number(product.oldPrice) - product.price) / Number(product.oldPrice)) * 100)
    : 0;

  const isHardcopy = (product.category || "").toLowerCase().includes("hardcopy");
  const isDigital = product.isDigital ?? !isHardcopy;

  const href = productHref({ slug: product.slug, category: product.category });

  const courseCodeText =
    product.courseCode || (Array.isArray(product.courseCodes) ? product.courseCodes[0] : "") || "";

  const availability = product.availability || "available";
  const isOut = availability === "out_of_stock";
  const isComing = availability === "coming_soon";

  // ✅ CRITICAL FIX:
  // CartContext expects: { id, title, price, image, quantity, category, courseCode? }
  // We'll use stable id as product._id (best). Fallback to slug (still stable).
  const cartId = safeText(product._id) || safeText(product.slug);

  // ✅ detect in-cart for button toggle
  const inCart = useMemo(() => {
    return cart.some((x) => safeText(x?.id) === cartId);
  }, [cart, cartId]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function showToast(kind: "add" | "remove") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({
      show: true,
      kind,
      text: kind === "add" ? "Added to cart ✅" : "Removed from cart ❌",
    });
    toastTimer.current = setTimeout(() => {
      setToast((p) => ({ ...p, show: false }));
    }, 1400);
  }

  function handleToggleCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    // ✅ Abhi ke liye out_of_stock / coming_soon me cart toggle nahi (later: want-to-buy flow alag)
    if (isOut || isComing) {
      // non-blocking info (freeze nahi hoga)
      setToast({
        show: true,
        kind: "remove",
        text: isOut ? "This item is Out of Stock" : "This item is Coming Soon",
      });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast((p) => ({ ...p, show: false })), 1400);
      return;
    }

    if (!inCart) {
      addToCart({
        id: cartId,
        title: product.title,
        price: Number(product.price || 0),
        image: imgPrimary,
        quantity: 1,
        category: product.category || "Product",
        courseCode: courseCodeText || undefined,
      });
      showToast("add");
    } else {
      removeFromCart(cartId);
      showToast("remove");
    }
  }

  const buttonUi = useMemo(() => {
    // toggle colors: blue (not in cart) -> green (in cart)
    if (isOut) {
      return { text: "Want to Buy", cls: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100" };
    }
    if (isComing) {
      return { text: "Buy Now", cls: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" };
    }
    if (inCart) {
      return { text: "Added (Remove)", cls: "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700" };
    }
    return { text: "Add to Cart", cls: "bg-blue-600 text-white border-blue-600 hover:bg-blue-700" };
  }, [inCart, isOut, isComing]);

  return (
    <div
      className="group relative rounded-2xl border border-gray-200 bg-white overflow-hidden
                 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl
                 active:scale-[0.99]"
    >
      {/* ✅ Mini toast (no freeze) */}
      {toast.show && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
          <div
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold shadow-lg border ${
              toast.kind === "add"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            {toast.kind === "add" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {toast.text}
          </div>
        </div>
      )}

      {/* Clickable area (Link) */}
      <Link href={href} className="block" aria-label={product.title}>
        <div className="relative aspect-[210/297] bg-gray-100">
          <Image
            src={imgBroken ? "/images/cover1.jpg" : imgPrimary}
            alt={product.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw"
            onError={() => setImgBroken(true)}
            priority={false}
          />

          <Image
            src={imgQuick}
            alt=""
            fill
            className="hidden md:block object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw"
          />

          {hasDiscount && (
            <div className="absolute top-2 left-2 z-10">
              <span className="inline-flex items-center gap-1 rounded-lg bg-green-600 text-white text-[10px] font-extrabold px-2 py-1 shadow-sm">
                <Sparkles size={12} />
                SAVE {discountPct > 0 ? `${discountPct}%` : "MORE"}
              </span>
            </div>
          )}

          <div className="absolute top-2 right-2 z-10">
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
            {!!product.oldPrice && product.oldPrice > 0 && (
              <div className="text-xs text-gray-400 line-through font-bold">₹{money(product.oldPrice)}</div>
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

      {/* ✅ Add to cart button (outside Link) */}
      <div className="px-3 pb-3">
        <button
          onClick={handleToggleCart}
          className={`w-full inline-flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-extrabold transition border ${buttonUi.cls}`}
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
