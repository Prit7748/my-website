"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { X, CheckCircle, CheckCircle2, FileText, Calendar, MessageCircle, ShoppingCart, Star } from "lucide-react";
import { useCart } from "@/context/CartContext";
import {
  buildAssignmentMasterThumbUrl,
  extractCourseCodesText,
  isSolvedAssignmentProduct,
  pickSortedImagePair,
} from "@/lib/thumbUrls";

interface QuickViewProps {
  product: any;
  onClose: () => void;
}

function safeText(x: any) {
  return String(x ?? "").trim();
}

function normAvail(v?: string) {
  return safeText(v).toLowerCase();
}

function resolvedAvailability(product: any) {
  return normAvail(product?.effectiveAvailability || product?.availability || "available");
}

function isOutProduct(product: any) {
  const a = resolvedAvailability(product);
  return a === "out_of_stock" || a === "outofstock" || a === "out-of-stock" || product?.canPurchase === false;
}

function isHardcopyProduct(product: any) {
  const c = String(product?.category || "").toLowerCase();
  return c.includes("handwritten hardcopy") || c.includes("delivery");
}

function extractDisplaySubjectTitle(p: any) {
  const lang = safeText(p?.language).toLowerCase();
  const hi = safeText(p?.subjectTitleHi);
  const en = safeText(p?.subjectTitleEn);

  if ((lang === "hindi" || lang.startsWith("hin")) && hi) return hi;
  if ((lang === "english" || lang.startsWith("eng")) && en) return en;

  return (
    hi ||
    en ||
    safeText(p?.subjectTitle) ||
    safeText(p?.subject_title) ||
    safeText(p?.subjectName) ||
    safeText(p?.subject_name) ||
    safeText(p?.paperTitle) ||
    safeText(p?.paper_title) ||
    safeText(p?.subject) ||
    ""
  );
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

function DeliveryLoopAnimation() {
  const [activeStep, setActiveStep] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const stepDuration = 3200;
    const fadeDuration = 280;

    const timer = setInterval(() => {
      setVisible(false);

      const switchTimer = setTimeout(() => {
        setActiveStep((prev) => (prev + 1) % 4);
        setVisible(true);
      }, fadeDuration);

      return () => clearTimeout(switchTimer);
    }, stepDuration);

    return () => clearInterval(timer);
  }, []);

  const steps = [
    {
      id: "STEP 1",
      title: "Handwritten Preparation",
      desc: "Your assignment pages are neatly handwritten in a clean and readable format.",
    },
    {
      id: "STEP 2",
      title: "Secure Packing",
      desc: "The pages are arranged properly, packed safely, and sealed before dispatch.",
    },
    {
      id: "STEP 3",
      title: "Fast Delivery",
      desc: "Your handwritten product is dispatched securely with delivery support.",
    },
    {
      id: "STEP 4",
      title: "Happy Customer Review",
      desc: "The parcel is delivered successfully and the customer is satisfied and confident.",
    },
  ];

  const step = steps[activeStep];

  return (
    <div className="w-full flex items-center justify-center">
      <div className="relative w-[320px] max-w-[80vw] aspect-[210/297] rounded-2xl bg-white border border-slate-200 shadow-[0_20px_60px_rgba(15,23,42,0.12)] overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_55%,#f9fffc_100%)]" />
        <div className="absolute inset-0 delivery-grid opacity-60" />

        <div className="absolute top-0 left-0 w-full px-4 pt-4 z-20">
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-1.5 flex-1 rounded-full bg-slate-200 overflow-hidden"
              >
                <div
                  className={`h-full rounded-full ${
                    i < activeStep
                      ? "w-full bg-gradient-to-r from-blue-600 to-cyan-500"
                      : i === activeStep
                      ? "delivery-progress"
                      : "w-0"
                  }`}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="absolute inset-0 px-5 pt-10 pb-5">
          <div
            key={activeStep}
            className={`h-full flex flex-col transition-all duration-300 ${
              visible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-2"
            }`}
          >
            <div className="min-h-[86px]">
              <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-extrabold tracking-[0.18em] text-blue-700">
                {step.id}
              </div>
              <div className="mt-2 text-[19px] leading-tight font-extrabold text-slate-900">
                {step.title}
              </div>
              <div className="mt-2 text-[12px] leading-5 font-medium text-slate-600">
                {step.desc}
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center">
              <div className="relative w-full h-[190px] rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)] overflow-hidden">
                {activeStep === 0 && (
                  <div className="absolute inset-0 p-5">
                    <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-blue-50 to-transparent" />
                    <div className="relative mx-auto mt-2 h-[138px] w-[108px] rounded-xl border border-slate-200 bg-white shadow-sm delivery-page">
                      <div className="px-3 pt-4">
                        <div className="mb-3 h-2.5 w-12 rounded-full bg-slate-200" />
                        <div className="space-y-2.5">
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div className="write-line write-line-1 h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" />
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div className="write-line write-line-2 h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" />
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div className="write-line write-line-3 h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" />
                          </div>
                          <div className="h-2 w-[70%] rounded-full bg-slate-100 overflow-hidden">
                            <div className="write-line write-line-4 h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="absolute right-8 top-[72px] delivery-pen">
                      <div className="relative w-11 h-2.5 rounded-full bg-gradient-to-r from-slate-900 to-slate-700 shadow-md">
                        <div className="absolute -right-2 top-[2px] w-0 h-0 border-l-[8px] border-l-slate-700 border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent" />
                      </div>
                    </div>

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-3 py-1.5 text-[10px] font-extrabold text-white shadow-lg whitespace-nowrap">
                      Neat • Clean • Readable
                    </div>
                  </div>
                )}

                {activeStep === 1 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="absolute left-7 top-5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-extrabold text-amber-700">
                      Protected & Sealed
                    </div>

                    <div className="relative w-[185px] h-[118px] delivery-envelope">
                      <div className="absolute inset-0 rounded-2xl bg-[linear-gradient(180deg,#fde68a_0%,#fcd34d_100%)] border border-amber-300 shadow-[0_18px_35px_rgba(245,158,11,0.20)]" />
                      <div className="absolute left-0 right-0 top-0 h-[62px] bg-[linear-gradient(180deg,#fef3c7_0%,#fde68a_100%)] clip-envelope rounded-t-2xl" />
                      <div className="absolute left-1/2 top-[58px] -translate-x-1/2 w-9 h-9 rounded-full bg-[radial-gradient(circle_at_30%_30%,#ef4444_0%,#b91c1c_100%)] shadow-[0_10px_24px_rgba(239,68,68,0.28)] delivery-seal" />
                    </div>

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1.5 text-[10px] font-extrabold text-white shadow-md whitespace-nowrap">
                      Packed for Safe Delivery
                    </div>
                  </div>
                )}

                {activeStep === 2 && (
                  <div className="absolute inset-0 overflow-hidden bg-[linear-gradient(180deg,#eff6ff_0%,#ffffff_100%)]">
                    <div className="absolute inset-0 delivery-map opacity-60" />

                    <svg
                      viewBox="0 0 320 190"
                      className="absolute inset-0 w-full h-full"
                      fill="none"
                    >
                      <path
                        d="M28 138 C82 112, 112 126, 158 92 C192 67, 232 74, 286 38"
                        stroke="#93c5fd"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray="8 10"
                      />
                    </svg>

                    <div className="absolute top-4 right-4 rounded-full border border-blue-200 bg-white px-3 py-1 text-[10px] font-extrabold text-blue-700 shadow-sm">
                      Tracking Support
                    </div>

                    <div className="absolute left-[-90px] bottom-7 delivery-truck-run">
                      <div className="relative w-[118px] h-[48px]">
                        <div className="absolute left-0 bottom-3 w-[72px] h-[26px] rounded-[10px] bg-gradient-to-r from-blue-600 to-indigo-600 shadow-[0_10px_24px_rgba(37,99,235,0.24)]" />
                        <div className="absolute left-[68px] bottom-3 w-[40px] h-[26px] rounded-[10px] bg-gradient-to-r from-slate-800 to-slate-600" />
                        <div className="absolute left-[14px] bottom-0 w-[18px] h-[18px] rounded-full bg-slate-900">
                          <div className="absolute inset-[4px] rounded-full bg-slate-300" />
                        </div>
                        <div className="absolute left-[74px] bottom-0 w-[18px] h-[18px] rounded-full bg-slate-900">
                          <div className="absolute inset-[4px] rounded-full bg-slate-300" />
                        </div>
                      </div>
                    </div>

                    <div className="absolute bottom-4 right-4 rounded-full bg-blue-600 px-3 py-1.5 text-[10px] font-extrabold text-white shadow-md whitespace-nowrap">
                      Quick Dispatch
                    </div>
                  </div>
                )}

                {activeStep === 3 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top,#dbeafe_0%,#ffffff_50%,#dcfce7_100%)]">
                    <div className="absolute top-5 left-6 rounded-full border border-green-200 bg-white px-3 py-1 text-[10px] font-extrabold text-green-700 shadow-sm">
                      Successful Delivery
                    </div>

                    <div className="relative w-[180px] rounded-[24px] border border-slate-200 bg-white/95 px-4 py-5 text-center shadow-[0_18px_40px_rgba(15,23,42,0.10)] delivery-review-card">
                      <div className="flex justify-center gap-1 mb-3">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <Star
                            key={i}
                            size={17}
                            className="fill-amber-400 text-amber-400 delivery-star"
                            style={{ animationDelay: `${i * 0.12}s` }}
                          />
                        ))}
                      </div>

                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                        <CheckCircle2 size={24} className="text-green-600" />
                      </div>

                      <div className="text-[15px] font-extrabold text-slate-900">
                        Customer Happy
                      </div>
                      <div className="mt-1 text-[11px] font-semibold text-slate-600 leading-relaxed">
                        Delivered successfully and ready to submit
                      </div>

                      <div className="mt-3 inline-flex items-center rounded-full bg-gradient-to-r from-green-500 to-emerald-500 px-3 py-1.5 text-[10px] font-extrabold text-white shadow-md">
                        5-Star Experience
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 text-center text-[11px] font-semibold text-slate-500">
              Live handwritten hardcopy process preview
            </div>
          </div>
        </div>

        <style jsx>{`
          .delivery-grid {
            background-image: radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.08) 1px, transparent 0);
            background-size: 18px 18px;
          }

          .delivery-progress {
            width: 100%;
            background: linear-gradient(90deg, #2563eb, #06b6d4);
            animation: deliveryBar 3.2s linear forwards;
            transform-origin: left center;
          }

          @keyframes deliveryBar {
            from {
              transform: scaleX(0);
            }
            to {
              transform: scaleX(1);
            }
          }

          .delivery-page {
            animation: floatPage 2.4s ease-in-out infinite;
          }

          @keyframes floatPage {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-3px);
            }
          }

          .delivery-pen {
            animation: penMove 1.9s ease-in-out infinite;
          }

          @keyframes penMove {
            0%, 100% {
              transform: translateX(0) rotate(-18deg);
            }
            50% {
              transform: translateX(18px) translateY(-6px) rotate(-24deg);
            }
          }

          .write-line {
            width: 0%;
            animation: writeGrow 0.9s ease forwards;
          }

          .write-line-1 { animation-delay: 0.05s; }
          .write-line-2 { animation-delay: 0.35s; }
          .write-line-3 { animation-delay: 0.65s; }
          .write-line-4 { animation-delay: 0.95s; }

          @keyframes writeGrow {
            from {
              width: 0%;
              opacity: 0.3;
            }
            to {
              width: 100%;
              opacity: 1;
            }
          }

          .clip-envelope {
            clip-path: polygon(0 0, 100% 0, 50% 72%);
          }

          .delivery-envelope {
            animation: envelopeFloat 2.2s ease-in-out infinite;
          }

          @keyframes envelopeFloat {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-5px);
            }
          }

          .delivery-seal {
            animation: sealPop 1.4s ease-in-out infinite;
          }

          @keyframes sealPop {
            0%, 100% {
              transform: translateX(-50%) scale(1);
            }
            50% {
              transform: translateX(-50%) scale(1.08);
            }
          }

          .delivery-map {
            background-image: radial-gradient(circle at 7px 7px, rgba(37, 99, 235, 0.12) 2px, transparent 0);
            background-size: 24px 24px;
          }

          .delivery-truck-run {
            animation: truckRun 2.6s ease-in-out infinite;
          }

          @keyframes truckRun {
            0% {
              transform: translateX(0);
            }
            55% {
              transform: translateX(255px);
            }
            100% {
              transform: translateX(255px);
            }
          }

          .delivery-review-card {
            animation: cardRise 0.45s ease-out;
          }

          @keyframes cardRise {
            from {
              transform: translateY(10px);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }

          .delivery-star {
            opacity: 0;
            transform: scale(0);
            animation: starPop 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          }

          @keyframes starPop {
            0% {
              opacity: 0;
              transform: scale(0);
            }
            80% {
              opacity: 1;
              transform: scale(1.16);
            }
            100% {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}</style>
      </div>
    </div>
  );
}

export default function ProductQuickView({ product, onClose }: QuickViewProps) {
  const router = useRouter();
  const { cart, addToCart, removeFromCart } = useCart();

  const [actionLoading, setActionLoading] = useState(false);
  const [actionText, setActionText] = useState("");

  if (!product) return null;

  const hardcopyMode = isHardcopyProduct(product);
  const outMode = isOutProduct(product);

  const displayTitle = safeText(product?.title) || extractDisplaySubjectTitle(product) || "Product";

  const pair = pickSortedImagePair(Array.isArray(product.images) ? product.images : []);
  const sorted = pair.all;

  const useAssignmentMasterThumb = isSolvedAssignmentProduct(product);
  const masterFallback = useAssignmentMasterThumb ? buildAssignmentMasterThumbUrl(product) : "";

  const thumb = pair.first || masterFallback;
  const quick = pair.second || pair.first || masterFallback;

  const imgAlt = displayTitle ? `${displayTitle} preview` : "Product preview";

  const topBadge = hardcopyMode ? "DELIVERY (HARDCOPY)" : "DIGITAL PRODUCT";
  const previewHint =
    sorted.length >= 2
      ? "Preview = 2nd image (name-wise)"
      : sorted.length === 1
      ? "Preview = 1st image (name-wise)"
      : useAssignmentMasterThumb
      ? "Preview = Master Thumbnail"
      : "Preview = No Image";

  const cartId = safeText(product?._id) || safeText(product?.id) || safeText(product?.slug);
  const inCart = cart.some((x: any) => safeText(x?.id) === cartId);

  async function handleAction() {
    if (actionLoading || !cartId) return;

    if (hardcopyMode) {
      setActionLoading(true);
      setActionText("Processing...");

      if (!inCart) {
        addToCart({
          id: cartId,
          title: displayTitle,
          price: Number(product?.price || 0),
          image: thumb || "",
          quantity: 1,
          category: safeText(product?.category) || "Product",
          courseCode: extractCourseCodesText(product) || undefined,
          availability: safeText(product?.availability) || "available",
          canPurchase: product?.canPurchase !== false,
        } as any);
      }

      onClose();
      router.push("/checkout");
      return;
    }

    if (outMode) {
      setActionLoading(true);
      setActionText("Submitting...");

      const result = await sendWantToBuyRequest(product);

      if (result.ok) {
        setActionText("Request Sent");
      } else {
        setActionText(result.error || "Request failed");
      }

      setTimeout(() => {
        setActionLoading(false);
      }, 800);
      return;
    }

    setActionLoading(true);
    setActionText(inCart ? "Removing..." : "Adding...");

    if (inCart) {
      removeFromCart(cartId);
      setActionText("Removed");
    } else {
      addToCart({
        id: cartId,
        title: displayTitle,
        price: Number(product?.price || 0),
        image: thumb || "",
        quantity: 1,
        category: safeText(product?.category) || "Product",
        courseCode: extractCourseCodesText(product) || undefined,
        availability: safeText(product?.availability) || "available",
        canPurchase: product?.canPurchase !== false,
      } as any);
      setActionText("Added");
    }

    setTimeout(() => {
      setActionLoading(false);
    }, 500);
  }

  const ctaText = hardcopyMode
    ? actionLoading
      ? actionText || "Processing..."
      : "Buy Now (Hardcopy Delivery)"
    : outMode
    ? actionLoading
      ? actionText || "Submitting..."
      : "Want to Buy"
    : actionLoading
    ? actionText || (inCart ? "Removing..." : "Adding...")
    : inCart
    ? "Remove from Cart"
    : "Add to Cart";

  const ctaClass = hardcopyMode
    ? "bg-blue-600 hover:bg-blue-700 text-white"
    : outMode
    ? "bg-orange-500 hover:bg-orange-600 text-white"
    : inCart
    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
    : "bg-blue-600 hover:bg-blue-700 text-white";

  const subText = hardcopyMode
    ? "Secure payment • Delivery support via WhatsApp"
    : outMode
    ? "This product is request-based right now"
    : "Secure payment via UPI / Card";

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Product quick view"
    >
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto grid md:grid-cols-2 shadow-2xl relative">
        <button
          onClick={onClose}
          aria-label="Close quick view"
          className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-red-50 hover:text-red-600 transition z-10"
        >
          <X size={20} />
        </button>

        <div className="bg-gray-100 p-8 flex items-center justify-center relative">
          {hardcopyMode ? (
            <DeliveryLoopAnimation />
          ) : (
            <div className="relative w-[280px] aspect-[210/297] shadow-lg border border-gray-200 bg-white overflow-hidden rounded-lg">
              {quick ? (
                <Image
                  src={quick}
                  alt={imgAlt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 80vw, 280px"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
                  <FileText size={40} className="text-gray-300 mb-2" />
                  <h4 className="font-bold text-gray-400 text-sm">NO PREVIEW IMAGE</h4>
                  <p className="text-[10px] text-gray-400 mt-2">Add at least 1 image in DB.</p>
                </div>
              )}
            </div>
          )}

          {!hardcopyMode && !!thumb && (
            <div className="absolute bottom-6 left-6 bg-white/90 border border-gray-200 rounded-lg px-3 py-2 text-[11px] font-bold text-gray-700 shadow-sm">
              {previewHint}
            </div>
          )}

          {hardcopyMode && (
            <div className="absolute bottom-6 left-6 bg-white/90 border border-gray-200 rounded-lg px-3 py-2 text-[11px] font-extrabold text-slate-800 shadow-sm">
              Live Process Preview (loop)
            </div>
          )}
        </div>

        <div className="p-8 flex flex-col">
          <div className="mb-1 flex flex-wrap gap-2">
            <span
              className={`text-xs font-bold px-2 py-1 rounded ${
                hardcopyMode ? "bg-indigo-100 text-indigo-700" : "bg-green-100 text-green-700"
              }`}
            >
              {topBadge}
            </span>

            {outMode && !hardcopyMode ? (
              <span className="text-xs font-bold px-2 py-1 rounded bg-orange-100 text-orange-700">
                REQUEST BASED
              </span>
            ) : null}
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-2 leading-snug">{displayTitle}</h2>

          <div className="flex items-center gap-4 mb-6">
            <span className="text-3xl font-bold text-blue-700">₹{product.price}</span>
            {!!product.oldPrice && <span className="text-lg text-gray-400 line-through">₹{product.oldPrice}</span>}
            {!!product.oldPrice && (
              <span className="text-sm text-green-600 font-bold">
                {Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)}% OFF
              </span>
            )}
          </div>

          <div className="space-y-3 mb-6 border-t border-b border-gray-100 py-6">
            {hardcopyMode ? (
              <>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <CheckCircle size={18} className="text-green-500" />
                  <span>Handwritten pages in neat presentation</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <FileText size={18} className="text-blue-500" />
                  <span>Packed securely for delivery</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Calendar size={18} className="text-orange-500" />
                  <span>
                    Session: <span className="font-bold text-gray-800">{product.session || "—"}</span>
                  </span>
                </div>

                <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-[11px] font-extrabold text-slate-700 uppercase">Note</div>
                  <div className="mt-1 text-[12px] font-semibold text-slate-600 leading-relaxed">
                    We only convert the content provided by the student into handwritten format for presentation. We do not promote unfair means.
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <CheckCircle size={18} className="text-green-500" />
                  <span>100% Correct Answers (Verified by Expert)</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <FileText size={18} className="text-blue-500" />
                  <span>Typed PDF (Searchable Text)</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Calendar size={18} className="text-orange-500" />
                  <span>
                    Session: <span className="font-bold text-gray-800">{product.session || "—"}</span>
                  </span>
                </div>

                {outMode ? (
                  <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-3">
                    <div className="text-[11px] font-extrabold text-orange-800 uppercase">Availability</div>
                    <div className="mt-1 text-[12px] font-semibold text-orange-900 leading-relaxed">
                      This product is not instantly available right now. You can submit a <b>Want to Buy</b> request.
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div className="mt-auto space-y-3">
            <button
              type="button"
              onClick={handleAction}
              disabled={actionLoading}
              className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition transform active:scale-95 flex items-center justify-center gap-2 ${ctaClass} ${
                actionLoading ? "opacity-85 cursor-not-allowed" : ""
              }`}
            >
              {outMode && !hardcopyMode ? <MessageCircle size={20} /> : <ShoppingCart size={20} />}
              {ctaText}
            </button>
            <p className="text-center text-xs text-gray-400">{subText}</p>
          </div>
        </div>
      </div>
    </div>
  );
}