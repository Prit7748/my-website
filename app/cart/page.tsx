"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ShoppingBag,
  ShieldCheck,
  ArrowLeft,
  CreditCard,
  User,
} from "lucide-react";
import { useCart } from "../../context/CartContext";
import TopBar from "../../components/TopBar";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import ProductCard from "../../components/ProductCard";

type MeUser = {
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
};

type LatestProduct = {
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

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function roundSafe(x: any) {
  const n = Number(x);
  const safe = Number.isFinite(n) ? n : 0;
  return Math.round(safe * 100) / 100;
}

function isComboCartItem(item: any) {
  return safeStr(item?.itemType).toLowerCase() === "combo";
}

export default function CartPage() {
  const { cart, removeFromCart, addToCart, cartTotal } = useCart();

  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<MeUser | null>(null);

  const [latestProducts, setLatestProducts] = useState<LatestProduct[]>([]);
  const [latestLoading, setLatestLoading] = useState(true);
  const [latestError, setLatestError] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadCurrentUser() {
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!alive) return;

        if (!res.ok) {
          setCurrentUser(null);
          return;
        }

        const data = await res.json();
        setCurrentUser(data?.user || null);
      } catch {
        if (!alive) return;
        setCurrentUser(null);
      } finally {
        if (alive) setAuthLoading(false);
      }
    }

    loadCurrentUser();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadLatestProducts() {
      setLatestLoading(true);
      setLatestError("");

      try {
        const res = await fetch("/api/products?limit=4&sort=latest", {
          method: "GET",
          cache: "no-store",
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load latest products");
        }

        if (!alive) return;

        const list = Array.isArray(data?.products) ? data.products.slice(0, 4) : [];
        setLatestProducts(list);
      } catch (e: any) {
        if (!alive) return;
        setLatestProducts([]);
        setLatestError(e?.message || "Failed to load latest products");
      } finally {
        if (alive) setLatestLoading(false);
      }
    }

    loadLatestProducts();

    return () => {
      alive = false;
    };
  }, []);

  const increaseQty = (item: any) => addToCart({ ...item, quantity: 1 });

  const decreaseQty = (item: any) => {
    if (item.quantity > 1) addToCart({ ...item, quantity: -1 });
  };

  const finalTotal = useMemo(() => {
    return roundSafe(cartTotal);
  }, [cartTotal]);

  const latestArrivalItems = useMemo(() => {
    return latestProducts.slice(0, 4);
  }, [latestProducts]);

  const checkoutHref = "/checkout";

  const loginRedirectHref = useMemo(() => {
    return `/login?redirect=${encodeURIComponent(checkoutHref)}`;
  }, []);

  return (
    <main className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800">
      <TopBar />
      <Navbar />

      <div className="max-w-[1200px] mx-auto px-4 py-8 md:py-12">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-3">
            <ShoppingBag className="text-blue-600" /> Your Shopping Cart
            <span className="text-lg font-normal text-gray-500">({cart.length} Items)</span>
          </h1>
        </div>

        {cart.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-24 h-24 bg-blue-50 text-blue-300 rounded-full flex items-center justify-center mb-6">
              <ShoppingBag size={48} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Your cart is empty</h2>
            <p className="text-gray-500 mb-8 max-w-md">
              Looks like you haven&apos;t added any assignments, notes, or combos yet. Explore our collection to find what you need.
            </p>
            <Link
              href="/solved-assignments"
              className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-blue-700 transition flex items-center gap-2 shadow-lg shadow-blue-200"
            >
              Start Shopping <ArrowRight size={18} />
            </Link>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8 items-start mb-12">
            <div className="flex-1 w-full space-y-4">
              {cart.map((item: any) => {
                return (
                  <div
                    key={item.id}
                    className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm flex gap-4 sm:gap-6 items-start relative hover:shadow-md transition duration-300"
                  >
                    <div className="w-20 h-24 sm:w-24 sm:h-32 bg-gray-100 rounded-lg relative overflow-hidden flex-shrink-0 border border-gray-100">
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 bg-gray-50 text-center p-2">
                        <span className="text-xs font-bold">
                          {isComboCartItem(item) ? "COMBO" : item.courseCode || "PDF"}
                        </span>
                        {isComboCartItem(item) ? (
                          <span className="mt-1 text-[10px] font-extrabold text-violet-500">BUNDLE</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-2 gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base md:text-lg font-extrabold text-slate-900 leading-snug">
                              {safeStr(item.title) || "Untitled Item"}
                            </h3>

                            {isComboCartItem(item) ? (
                              <span className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 text-[11px] font-extrabold">
                                Builder Combo
                              </span>
                            ) : null}

                            {safeStr(item.comboBadge) ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 text-[11px] font-extrabold">
                                {safeStr(item.comboBadge)}
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-1 flex flex-wrap gap-2">
                            {safeStr(item.category) ? (
                              <span className="inline-flex items-center rounded-full bg-gray-50 text-slate-700 border border-gray-200 px-2.5 py-1 text-[11px] font-extrabold">
                                {safeStr(item.category)}
                              </span>
                            ) : null}

                            {safeStr(item.comboCategorySlug) ? (
                              <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 text-[11px] font-extrabold">
                                {safeStr(item.comboCategorySlug)}
                              </span>
                            ) : null}

                            {safeStr(item.comboMediumLabel) ? (
                              <span className="inline-flex items-center rounded-full bg-gray-50 text-slate-700 border border-gray-200 px-2.5 py-1 text-[11px] font-extrabold">
                                Medium: {safeStr(item.comboMediumLabel)}
                              </span>
                            ) : null}

                            {safeStr(item.comboSessionLabel) ? (
                              <span className="inline-flex items-center rounded-full bg-gray-50 text-slate-700 border border-gray-200 px-2.5 py-1 text-[11px] font-extrabold">
                                Session: {safeStr(item.comboSessionLabel)}
                              </span>
                            ) : null}

                            {safeStr(item.comboSaveLabel) ? (
                              <span className="inline-flex items-center rounded-full bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1 text-[11px] font-extrabold">
                                {safeStr(item.comboSaveLabel)}
                              </span>
                            ) : null}
                          </div>

                          {isComboCartItem(item) &&
                          Array.isArray(item.comboItems) &&
                          item.comboItems.length > 0 ? (
                            <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-3">
                              <div className="text-[11px] uppercase font-extrabold tracking-wide text-indigo-700">
                                Included Combo Items
                              </div>

                              <div className="mt-2 space-y-2">
                                {item.comboItems.slice(0, 6).map((comboItem: any, idx: number) => (
                                  <div
                                    key={`${safeStr(comboItem?.title)}-${idx}`}
                                    className="rounded-xl border border-indigo-100 bg-white px-3 py-2"
                                  >
                                    <div className="text-sm font-extrabold text-slate-900 leading-snug">
                                      {safeStr(comboItem?.title) || "Untitled Item"}
                                    </div>
                                    {safeStr(comboItem?.subtitle) ? (
                                      <div className="mt-0.5 text-xs font-semibold text-slate-600">
                                        {safeStr(comboItem?.subtitle)}
                                      </div>
                                    ) : null}
                                  </div>
                                ))}

                                {item.comboItems.length > 6 ? (
                                  <div className="text-xs font-extrabold text-indigo-700">
                                    +{item.comboItems.length - 6} more items
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-gray-400 hover:text-red-500 transition p-2 hover:bg-red-50 rounded-full shrink-0 mt-1"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-end justify-between gap-4 mt-4">
                        <div className="flex items-center border border-gray-200 rounded-lg h-10 bg-gray-50">
                          <button
                            onClick={() => decreaseQty(item)}
                            className="px-3 hover:bg-gray-200 text-gray-500 h-full rounded-l-lg disabled:opacity-50"
                            disabled={item.quantity <= 1}
                          >
                            <Minus size={14} />
                          </button>
                          <span className="px-3 text-sm font-bold w-10 text-center bg-white h-full flex items-center justify-center border-x border-gray-200">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => increaseQty(item)}
                            className="px-3 hover:bg-gray-200 text-gray-500 h-full rounded-r-lg"
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-[11px] uppercase font-extrabold tracking-wide text-slate-500">
                            {isComboCartItem(item) ? "Combo Price" : "Price"}
                          </div>
                          <div className="mt-1 text-lg md:text-xl font-extrabold text-blue-700">
                            ₹{Number(item.price || 0) * item.quantity}
                          </div>
                          {item.quantity > 1 ? (
                            <div className="text-xs text-gray-400 mt-1">₹{item.price} each</div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="pt-4">
                <Link
                  href="/solved-assignments"
                  className="inline-flex items-center gap-2 text-blue-600 font-bold hover:text-blue-800 transition"
                >
                  <ArrowLeft size={18} /> Continue Shopping
                </Link>
              </div>
            </div>

            <div className="lg:w-[400px] flex-shrink-0 w-full">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sticky top-24">
                <h3 className="font-bold text-xl text-slate-900 mb-6">Order Summary</h3>

                <div className="space-y-3 mb-6 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-bold text-slate-900">₹{roundSafe(cartTotal)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Delivery Charges</span>
                    <span className="text-green-600 font-bold uppercase text-xs bg-green-50 px-2 py-0.5 rounded">
                      Free
                    </span>
                  </div>

                  <div className="border-t border-dashed border-gray-200 pt-4 mt-2 flex justify-between text-xl font-bold text-slate-900">
                    <span>Total Amount</span>
                    <span>₹{roundSafe(finalTotal)}</span>
                  </div>

                  <p className="text-xs text-gray-400 text-right">(Inclusive of all taxes)</p>
                </div>

                {authLoading ? (
                  <div className="w-full bg-gray-200 text-gray-500 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 mb-4">
                    Checking login...
                  </div>
                ) : currentUser ? (
                  <>
                    <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
                      Logged in as{" "}
                      <span className="font-bold">
                        {safeStr(currentUser.name || currentUser.email || "User")}
                      </span>
                      . You can continue to secure checkout.
                    </div>

                    <Link
                      href={checkoutHref}
                      className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition shadow-lg shadow-blue-200 active:scale-95 flex items-center justify-center gap-2 mb-4"
                    >
                      Proceed to Checkout <ArrowRight size={20} />
                    </Link>
                  </>
                ) : (
                  <>
                    <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
                      <div className="font-bold mb-1 flex items-center gap-2">
                        <User size={16} />
                        Login required before checkout
                      </div>
                      <p>Product cart me add ho jayega, lekin order place karne ke liye login zaruri hai.</p>
                    </div>

                    <Link
                      href={loginRedirectHref}
                      className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition shadow-lg shadow-blue-200 active:scale-95 flex items-center justify-center gap-2 mb-3"
                    >
                      Login to Continue <ArrowRight size={20} />
                    </Link>

                    <Link
                      href="/login"
                      className="w-full bg-white border border-gray-200 text-slate-700 py-3 rounded-xl font-bold text-sm hover:bg-gray-50 transition flex items-center justify-center gap-2 mb-4"
                    >
                      Sign In / Sign Up
                    </Link>
                  </>
                )}

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <ShieldCheck className="text-blue-600 flex-shrink-0" size={18} />
                    <span><strong>Secure Payment:</strong> We use encrypted SSL security.</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <CreditCard className="text-blue-600 flex-shrink-0" size={18} />
                    <span><strong>Accepts:</strong> UPI, Cards, NetBanking, Wallets.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <section className="bg-gradient-to-r from-blue-700 via-indigo-600 to-violet-600 py-12 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl" />

        <div className="max-w-[1400px] mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
              ✨ Latest Arrivals{" "}
              <span className="text-sm font-normal bg-white/20 px-3 py-1 rounded-full border border-white/20">
                Fresh Content
              </span>
            </h2>

            <Link
              href="/products"
              className="text-white text-sm font-bold border border-white/30 px-5 py-2.5 rounded-full hover:bg-white hover:text-blue-700 transition"
            >
              View All Products
            </Link>
          </div>

          {latestLoading ? (
            <div className="flex flex-nowrap gap-4 overflow-x-auto pb-2 md:overflow-visible">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={`latest-skeleton-${idx}`}
                  className="min-w-[240px] md:min-w-0 md:flex-1 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm p-3 animate-pulse"
                >
                  <div className="aspect-[210/297] rounded-xl bg-white/20" />
                  <div className="mt-3 h-3 rounded bg-white/20" />
                  <div className="mt-2 h-3 w-2/3 rounded bg-white/20" />
                  <div className="mt-4 h-9 rounded-xl bg-white/20" />
                </div>
              ))}
            </div>
          ) : latestArrivalItems.length > 0 ? (
            <div className="flex flex-nowrap gap-4 overflow-x-auto pb-2 md:overflow-visible">
              {latestArrivalItems.map((prod) => (
                <div
                  key={safeStr(prod._id) || safeStr(prod.slug) || prod.title}
                  className="min-w-[240px] md:min-w-0 md:flex-1"
                >
                  <ProductCard product={prod} />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm p-6 text-white">
              <div className="text-lg font-bold">Latest products abhi show nahi ho pa rahe.</div>
              <div className="text-sm text-white/80 mt-1">
                {latestError || "No active products found."}
              </div>
              <Link
                href="/products"
                className="inline-flex items-center gap-2 mt-4 bg-white text-blue-700 px-5 py-2.5 rounded-xl font-bold hover:bg-blue-50 transition"
              >
                Explore Products <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}