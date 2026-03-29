"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Star, ShoppingCart, Eye, Layers, ImageIcon, CheckCircle2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import ProductQuickView from "./ProductQuickView";
import { productHref } from "@/lib/productHref";
import { useCart } from "@/context/CartContext";
import {
  buildAssignmentMasterThumbUrl,
  buildHardcopyMasterThumbUrl,
  extractCourseCodesText,
  isHandwrittenHardcopyProduct,
  isSolvedAssignmentProduct,
  pickSortedImagePair,
} from "@/lib/thumbUrls";

type Meta = { total: number; page: number; totalPages: number; limit: number };

interface ProductGridProps {
  selectedCat: string[];
  onMeta?: (meta: Meta) => void;
  search?: string;
  initialProducts?: any[];
  initialMeta?: Meta | null;
  initialQueryKey?: string;
}

function safeText(x: any) {
  return String(x ?? "").trim();
}

function normAvail(v?: string) {
  return safeText(v).toLowerCase();
}

function isOutProduct(p: any) {
  const a = normAvail(p?.availability || "available");
  return a === "out_of_stock" || a === "outofstock" || a === "out-of-stock" || p?.canPurchase === false;
}

async function sendWantToBuyRequest(product: any) {
  try {
    const res = await fetch("/api/products/want-to-buy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        productId: safeText(product?._id || product?.id),
        slug: safeText(product?.slug),
        title: safeText(product?.title),
        category: safeText(product?.category),
        availability: safeText(product?.availability),
      }),
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {}

    if (!res.ok) {
      throw new Error(data?.error || data?.message || "Request failed");
    }

    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Request failed" };
  }
}

function money(n: number) {
  try {
    return new Intl.NumberFormat("en-IN").format(n);
  } catch {
    return String(n);
  }
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl overflow-hidden border border-gray-100 w-full flex flex-col animate-pulse"
        >
          <div className="aspect-[210/297] bg-gray-200 border-b border-gray-100" />
          <div className="p-3 md:p-4 flex flex-col flex-1">
            <div className="h-3 w-20 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-full bg-gray-200 rounded mb-2" />
            <div className="h-4 w-4/5 bg-gray-200 rounded mb-3" />
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="h-6 w-24 bg-gray-200 rounded" />
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((__, j) => (
                  <div key={j} className="h-3 w-3 rounded-full bg-gray-200" />
                ))}
              </div>
            </div>
            <div className="mt-auto">
              <div className="h-10 w-full bg-gray-200 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProductGrid({
  selectedCat,
  onMeta,
  search,
  initialProducts = [],
  initialMeta = null,
  initialQueryKey = "",
}: ProductGridProps) {
  const searchParams = useSearchParams();
  const { cart, addToCart, removeFromCart } = useCart();

  const selectedCatKey = useMemo(() => selectedCat.join(","), [selectedCat]);

  const queryKey = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (selectedCatKey) params.set("category", selectedCatKey);
    else params.delete("category");

    const qSearch = (typeof search === "string" ? search : params.get("search") || "").trim();
    if (qSearch) params.set("search", qSearch);
    else params.delete("search");

    if (!params.get("page")) params.set("page", "1");
    params.set("limit", "12");

    return params.toString();
  }, [searchParams, selectedCatKey, search]);

  const hasUsableInitialData =
    Array.isArray(initialProducts) && initialMeta && typeof initialQueryKey === "string" && initialQueryKey === queryKey;

  const [loading, setLoading] = useState<boolean>(!hasUsableInitialData);
  const [products, setProducts] = useState<any[]>(hasUsableInitialData ? initialProducts : []);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [error, setError] = useState<string>("");

  const [wantLoadingMap, setWantLoadingMap] = useState<Record<string, boolean>>({});
  const [wantSuccessMap, setWantSuccessMap] = useState<Record<string, boolean>>({});

  const onMetaRef = useRef<typeof onMeta>(onMeta);
  useEffect(() => {
    onMetaRef.current = onMeta;
  }, [onMeta]);

  const didUseInitialRef = useRef(false);

  useEffect(() => {
    if (hasUsableInitialData && !didUseInitialRef.current) {
      didUseInitialRef.current = true;
      setProducts(initialProducts);
      setLoading(false);
      setError("");
      onMetaRef.current?.(
        initialMeta || { total: 0, page: 1, totalPages: 1, limit: 12 }
      );
    }
  }, [hasUsableInitialData, initialProducts, initialMeta]);

  const [toast, setToast] = useState<{
    show: boolean;
    msg: string;
    kind: "add" | "remove" | "info" | "success";
  }>({
    show: false,
    msg: "",
    kind: "add",
  });

  function isInCart(productId: string) {
    return cart.some((x) => x.id === productId);
  }

  function showToast(msg: string, kind: "add" | "remove" | "info" | "success") {
    setToast({ show: true, msg, kind });
    if (typeof window !== "undefined") {
      window.clearTimeout((showToast as any)._t);
      (showToast as any)._t = window.setTimeout(() => {
        setToast((p) => ({ ...p, show: false }));
      }, 1800);
    }
  }

  async function handleWantToBuy(p: any) {
    const id = String(p?._id || p?.id || p?.slug || "");
    if (!id || wantLoadingMap[id]) return;

    setWantLoadingMap((prev) => ({ ...prev, [id]: true }));
    const result = await sendWantToBuyRequest(p);
    setWantLoadingMap((prev) => ({ ...prev, [id]: false }));

    if (result.ok) {
      setWantSuccessMap((prev) => ({ ...prev, [id]: true }));
      showToast(
        "Request Received. We are processing your submission and will upload the product shortly. Keep an eye on our website for updates.",
        "success"
      );
    } else {
      showToast(result.error || "Request could not be submitted. Please try again.", "info");
    }
  }

  function resolveCardImage(p: any) {
    if (isSolvedAssignmentProduct(p)) return buildAssignmentMasterThumbUrl(p);
    if (isHandwrittenHardcopyProduct(p)) return buildHardcopyMasterThumbUrl(p);

    const { first } = pickSortedImagePair(p?.images);
    return first || "";
  }

  function toggleCart(p: any) {
    const id = String(p?._id || p?.id || p?.slug || "");
    if (!id) return;

    if (isOutProduct(p)) {
      handleWantToBuy(p);
      return;
    }

    if (isInCart(id)) {
      removeFromCart(id);
      showToast("Removed from cart", "remove");
      return;
    }

    addToCart({
      id,
      title: String(p?.title || "Product"),
      price: Number(p?.price || 0),
      image: resolveCardImage(p),
      quantity: 1,
      category: String(p?.category || "Product"),
      courseCode: extractCourseCodesText(p),
      availability: String(p?.availability || "available"),
      canPurchase: p?.canPurchase !== false,
    } as any);

    showToast("Added to cart", "add");
  }

  useEffect(() => {
    if (hasUsableInitialData && !didUseInitialRef.current) {
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");

    (async () => {
      try {
        const res = await fetch(`/api/products?${queryKey}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || data?.message || "Fetch failed");

        const list = Array.isArray(data?.products) ? data.products : [];
        setProducts(list);

        const p = data?.pagination || {};
        onMetaRef.current?.({
          total: Number(p.total || 0),
          page: Number(p.page || 1),
          totalPages: Number(p.totalPages || 1),
          limit: 12,
        });
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setError(e?.message || "Something went wrong");
        setProducts([]);
        onMetaRef.current?.({ total: 0, page: 1, totalPages: 1, limit: 12 });
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [queryKey, hasUsableInitialData]);

  if (loading) {
    return <ProductGridSkeleton />;
  }

  if (error) {
    return (
      <div className="w-full min-h-[340px] flex flex-col items-center justify-center text-center gap-2">
        <div className="text-red-600 font-bold">Error</div>
        <div className="text-gray-600 text-sm">{error}</div>
        <div className="text-gray-400 text-xs">Check /api/products response & DB.</div>
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 w-full min-h-[300px]">
        <div className="text-center mb-10">
          <h3 className="text-xl font-bold text-gray-800 mb-2">Oops! No products found.</h3>
          <p className="text-gray-500">Try changing the filters.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[9999] transition-all duration-300 ${
          toast.show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
        }`}
        aria-live="polite"
        aria-atomic="true"
      >
        <div
          className={`px-4 py-2 rounded-2xl shadow-lg border text-sm font-extrabold flex items-center gap-2 ${
            toast.kind === "add"
              ? "bg-emerald-600 text-white border-emerald-500"
              : toast.kind === "remove"
              ? "bg-slate-900 text-white border-slate-800"
              : toast.kind === "success"
              ? "bg-emerald-600 text-white border-emerald-500"
              : "bg-orange-600 text-white border-orange-500"
          }`}
        >
          <CheckCircle2 size={18} />
          {toast.msg}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        {products.map((p: any) => {
          const { first, all } = pickSortedImagePair(p?.images);

          const isCombo = (p.category || "").toLowerCase().includes("combo");
          const href = productHref(p);

          const id = String(p?._id || p?.id || p?.slug || "");
          const inCart = id ? isInCart(id) : false;

          const isOut = isOutProduct(p);
          const wantLoading = !!wantLoadingMap[id];
          const wantSuccess = !!wantSuccessMap[id];

          const imgSrc = isSolvedAssignmentProduct(p)
            ? buildAssignmentMasterThumbUrl(p)
            : isHandwrittenHardcopyProduct(p)
            ? buildHardcopyMasterThumbUrl(p)
            : first || "";

          const productTitle = safeText(p?.title) || "Product";

          const buttonUi = isOut
            ? wantSuccess
              ? {
                  textDesktop: wantLoading ? "Submitting..." : "Request Received",
                  textMobile: wantLoading ? "..." : "Received",
                  cls: "bg-emerald-600 hover:bg-emerald-700 text-white",
                }
              : {
                  textDesktop: wantLoading ? "Submitting..." : "Want to Buy",
                  textMobile: wantLoading ? "..." : "Want",
                  cls: "bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 shadow-none",
                }
            : inCart
            ? {
                textDesktop: "Remove from Cart",
                textMobile: "Remove",
                cls: "bg-emerald-600 hover:bg-emerald-700 text-white",
              }
            : {
                textDesktop: "Add to Cart",
                textMobile: "Add",
                cls: "bg-[#1e40af] hover:bg-[#1e3a8a] text-white",
              };

          return (
            <div
              key={p._id || p.slug}
              className="bg-white rounded-xl overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-gray-100 group w-full flex flex-col relative"
            >
              <div className="aspect-[210/297] bg-white relative overflow-hidden border-b border-gray-50 group-hover:opacity-95 transition-opacity">
                <Link href={href} className="block w-full h-full">
                  {imgSrc ? (
                    <Image
                      src={imgSrc}
                      alt={productTitle}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 768px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 bg-white text-center p-2 relative">
                      {isCombo ? (
                        <div className="absolute inset-0 flex items-center justify-center opacity-10 text-purple-600">
                          <Layers size={80} />
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center opacity-10 text-slate-500">
                          <ImageIcon size={80} />
                        </div>
                      )}
                      <span className="text-lg font-bold opacity-30 uppercase">
                        {(p.category || "Product").split(" ")[0]}
                      </span>
                    </div>
                  )}
                </Link>

                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedProduct({ ...p, images: all });
                  }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/90 text-slate-800 px-4 py-2 rounded-full font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 hover:bg-blue-600 hover:text-white z-10"
                  aria-label="Open quick view"
                  type="button"
                >
                  <Eye size={16} /> <span className="text-xs">Quick View</span>
                </button>

                {isCombo ? (
                  <span className="absolute top-2 left-2 bg-purple-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">
                    BUNDLE SAVE
                  </span>
                ) : (
                  <span className="absolute top-2 left-2 bg-green-600 text-white text-[11px] font-bold px-2 py-1 rounded shadow-sm">
                    NEW
                  </span>
                )}
              </div>

              <div className="p-3 md:p-4 flex flex-col flex-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {p.category}
                </p>

                <h3 className="text-[13px] md:text-[15px] font-bold text-gray-800 leading-snug line-clamp-2 min-h-[38px] md:min-h-[42px] mb-2 group-hover:text-blue-600 transition-colors">
                  <Link href={href}>{productTitle}</Link>
                </h3>

                <div className="mt-auto">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="text-base md:text-lg font-bold text-blue-700 whitespace-nowrap">
                        ₹{money(Number(p.price || 0))}
                      </span>
                      {!!p.oldPrice && (
                        <span className="text-[11px] md:text-xs text-gray-400 line-through whitespace-nowrap">
                          ₹{money(Number(p.oldPrice))}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-0.5 shrink-0">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={11} fill="#facc15" stroke="none" />
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleCart(p)}
                    disabled={wantLoading}
                    className={`w-full py-2.5 rounded-lg text-[12px] md:text-[13px] font-bold flex items-center justify-center gap-2 transition shadow-md active:scale-95 ${buttonUi.cls} ${
                      wantLoading ? "opacity-80 cursor-not-allowed" : ""
                    }`}
                  >
                    <ShoppingCart size={16} />
                    <span className="hidden md:inline">{buttonUi.textDesktop}</span>
                    <span className="md:hidden">{buttonUi.textMobile}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedProduct && (
        <ProductQuickView product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </>
  );
}