// ✅ FILE: components/solved-assignments/ProductGrid.tsx  (COMPLETE REPLACE)
"use client";
import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Star, ShoppingCart, Eye, Layers, ImageIcon, CheckCircle2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import ProductQuickView from "./ProductQuickView";
import { productHref } from "@/lib/productHref";
import { useCart } from "@/context/CartContext";

type Meta = { total: number; page: number; totalPages: number; limit: number };

interface ProductGridProps {
  selectedCat: string[];
  onMeta?: (meta: Meta) => void;
  search?: string;
}

function fileNameOf(path: string) {
  const clean = (path || "").split("?")[0];
  const parts = clean.split("/");
  return (parts[parts.length - 1] || "").toLowerCase();
}

function pickImagesSorted(images?: string[]) {
  const arr = Array.isArray(images) ? [...images] : [];
  const sorted = arr
    .filter((x) => typeof x === "string" && x.trim().length > 0)
    .sort((a, b) => fileNameOf(a).localeCompare(fileNameOf(b), undefined, { numeric: true }));
  const first = sorted[0] || "";
  const second = sorted[1] || first || "";
  return { first, second, all: sorted };
}

function money(n: number) {
  try {
    return new Intl.NumberFormat("en-IN").format(n);
  } catch {
    return String(n);
  }
}

export default function ProductGrid({ selectedCat, onMeta, search }: ProductGridProps) {
  const searchParams = useSearchParams();
  const { cart, addToCart, removeFromCart } = useCart();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [error, setError] = useState<string>("");

  // ✅ Non-blocking toast (no screen freeze)
  const [toast, setToast] = useState<{ show: boolean; msg: string; kind: "add" | "remove" }>({
    show: false,
    msg: "",
    kind: "add",
  });

  const selectedCatKey = useMemo(() => selectedCat.join(","), [selectedCat]);

  const queryKey = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (selectedCatKey) params.set("category", selectedCatKey);
    else params.delete("category");

    const qSearch = (typeof search === "string" ? search : params.get("search") || "").trim();
    if (qSearch) params.set("search", qSearch);
    else params.delete("search");

    if (!params.get("page")) params.set("page", "1");
    if (!params.get("limit")) params.set("limit", "24");

    return params.toString();
  }, [searchParams, selectedCatKey, search]);

  function isInCart(productId: string) {
    return cart.some((x) => x.id === productId);
  }

  function showToast(msg: string, kind: "add" | "remove") {
    setToast({ show: true, msg, kind });
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => {
      setToast((p) => ({ ...p, show: false }));
    }, 1400);
  }

  function toggleCart(p: any) {
    const id = String(p?._id || p?.id || p?.slug || "");
    if (!id) return;

    const { first } = pickImagesSorted(p.images);

    if (isInCart(id)) {
      removeFromCart(id);
      showToast("Removed from cart", "remove");
      return;
    }

    addToCart({
      id,
      title: String(p?.title || "Product"),
      price: Number(p?.price || 0),
      image: first || "/images/cover1.jpg",
      quantity: 1,
      category: String(p?.category || "Product"),
      courseCode: String(p?.courseCode || (Array.isArray(p?.courseCodes) ? p.courseCodes[0] : "") || ""),
    });

    showToast("Added to cart", "add");
  }

  useEffect(() => {
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
        onMeta?.({
          total: Number(p.total || 0),
          page: Number(p.page || 1),
          totalPages: Number(p.totalPages || 1),
          limit: Number(p.limit || 24),
        });
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setError(e?.message || "Something went wrong");
        setProducts([]);
        onMeta?.({ total: 0, page: 1, totalPages: 1, limit: 24 });
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [queryKey, onMeta]);

  if (loading) {
    return (
      <div className="w-full min-h-[340px] flex items-center justify-center">
        <div className="text-gray-500 font-semibold">Loading products...</div>
      </div>
    );
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
      {/* ✅ Toast (non-blocking) */}
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
              : "bg-slate-900 text-white border-slate-800"
          }`}
        >
          <CheckCircle2 size={18} />
          {toast.msg}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
        {products.map((p: any) => {
          const { first, all } = pickImagesSorted(p.images);
          const isCombo = (p.category || "").toLowerCase().includes("combo");
          const href = productHref(p);

          const id = String(p?._id || p?.id || p?.slug || "");
          const inCart = id ? isInCart(id) : false;

          return (
            <div
              key={p._id || p.slug}
              className="bg-white rounded-xl overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-gray-100 group w-full flex flex-col relative"
            >
              <div className="aspect-[210/297] bg-gray-100 relative overflow-hidden border-b border-gray-50 group-hover:opacity-95 transition-opacity">
                <Link href={href} className="block w-full h-full">
                  {first ? (
                    <Image
                      src={first}
                      alt={p.title || "Product image"}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 768px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 bg-gray-50 text-center p-2 relative">
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

              <div className="p-4 md:p-5 flex flex-col flex-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{p.category}</p>

                <h3 className="text-[13px] md:text-[16px] font-bold text-gray-800 leading-snug line-clamp-2 mb-2 h-[38px] md:h-[48px] group-hover:text-blue-600 transition-colors">
                  <Link href={href}>{p.title}</Link>
                </h3>

                <div className="flex gap-0.5 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={12} fill="#facc15" stroke="none" />
                  ))}
                </div>

                <div className="mt-auto">
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-lg md:text-xl font-bold text-blue-700">₹{money(Number(p.price || 0))}</span>
                    {!!p.oldPrice && (
                      <span className="text-xs md:text-sm text-gray-400 line-through">₹{money(Number(p.oldPrice))}</span>
                    )}
                  </div>

                  {/* ✅ Real cart toggle + Blue⇄Green */}
                  <button
                    type="button"
                    onClick={() => toggleCart(p)}
                    className={`w-full py-2.5 rounded-lg text-[12px] md:text-[14px] font-bold flex items-center justify-center gap-2 transition shadow-md active:scale-95 ${
                      inCart
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-[#1e40af] hover:bg-[#1e3a8a] text-white"
                    }`}
                  >
                    <ShoppingCart size={16} />
                    <span className="hidden md:inline">{inCart ? "Remove from Cart" : "Add to Cart"}</span>
                    <span className="md:hidden">{inCart ? "Remove" : "Add"}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedProduct && <ProductQuickView product={selectedProduct} onClose={() => setSelectedProduct(null)} />}
    </>
  );
}
