// components/solved-assignments/ProductQuickView.tsx
"use client";

import Image from "next/image";
import { X, CheckCircle, FileText, Calendar } from "lucide-react";

interface QuickViewProps {
  product: any;
  onClose: () => void;
}

function fileNameOf(path: string) {
  const clean = (path || "").split("?")[0];
  const parts = clean.split("/");
  return (parts[parts.length - 1] || "").toLowerCase();
}

function sortImagesNamewise(arr: string[]) {
  return [...(arr || [])]
    .filter((x) => typeof x === "string" && x.trim().length > 0)
    .sort((a, b) => fileNameOf(a).localeCompare(fileNameOf(b), undefined, { numeric: true }));
}

// ✅ Detect Hardcopy category (DB string match)
function isHardcopyProduct(product: any) {
  const c = String(product?.category || "").toLowerCase();
  // adjust if your DB category differs
  return c.includes("handwritten hardcopy") || c.includes("delivery");
}

/** ✅ 8–10 sec loop animation: Writing -> Packing -> Delivery -> Happy student */
function DeliveryLoopAnimation() {
  return (
    <div className="w-full flex items-center justify-center">
      <div className="relative w-[320px] max-w-[80vw] aspect-[210/297] rounded-xl bg-white border border-gray-200 shadow-lg overflow-hidden">
        {/* background */}
        <div className="absolute inset-0 bg-gradient-to-b from-white via-[#f7fbff] to-[#fff7fb]" />
        <div className="absolute inset-0 hardcopy-grid opacity-70" />

        {/* progress bar */}
        <div className="absolute top-0 left-0 w-full h-[6px] bg-gray-100">
          <div className="h-full hardcopy-progress" />
        </div>

        {/* Scene container */}
        <div className="absolute inset-0 p-5">
          {/* Scene 1: Writing */}
          <div className="scene scene-1">
            <div className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wide">Step 1</div>
            <div className="mt-1 text-sm font-extrabold text-slate-900">We Handwrite Your Pages</div>

            <div className="mt-4 relative h-[150px] rounded-xl border border-gray-200 bg-white overflow-hidden">
              {/* paper lines */}
              <div className="absolute inset-0 p-4">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="h-[10px] border-b border-gray-100" />
                ))}
              </div>

              {/* pen + writing line */}
              <div className="absolute left-6 top-[72px] flex items-center gap-2">
                <div className="pen" />
                <div className="ink-line" />
              </div>

              {/* stamp */}
              <div className="absolute right-4 bottom-4 text-[10px] font-extrabold text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-lg">
                Neat • Clean • Readable
              </div>
            </div>

            <div className="mt-3 text-[11px] font-semibold text-slate-600">
              Your provided content is written in clean handwriting format.
            </div>
          </div>

          {/* Scene 2: Packing */}
          <div className="scene scene-2">
            <div className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wide">Step 2</div>
            <div className="mt-1 text-sm font-extrabold text-slate-900">Safe Packing</div>

            <div className="mt-4 relative h-[150px] rounded-xl border border-gray-200 bg-white overflow-hidden flex items-center justify-center">
              <div className="envelope">
                <div className="env-top" />
                <div className="env-body" />
                <div className="env-seal" />
              </div>

              <div className="absolute left-5 top-5 text-[10px] font-extrabold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
                Protected & Sealed
              </div>
            </div>

            <div className="mt-3 text-[11px] font-semibold text-slate-600">
              Pages are packed securely for delivery.
            </div>
          </div>

          {/* Scene 3: Delivery */}
          <div className="scene scene-3">
            <div className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wide">Step 3</div>
            <div className="mt-1 text-sm font-extrabold text-slate-900">Fast Delivery Across India</div>

            <div className="mt-4 relative h-[150px] rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="absolute inset-0 p-4">
                <div className="map-dots" />
              </div>

              <div className="truck-wrap">
                <div className="truck">
                  <div className="truck-body" />
                  <div className="truck-cabin" />
                  <div className="wheel wheel-1" />
                  <div className="wheel wheel-2" />
                </div>
              </div>

              <div className="absolute right-4 bottom-4 text-[10px] font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded-lg">
                Quick Dispatch
              </div>
            </div>

            <div className="mt-3 text-[11px] font-semibold text-slate-600">
              Delivered to your address with tracking support.
            </div>
          </div>

          {/* Scene 4: Happy Student */}
          <div className="scene scene-4">
            <div className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wide">Step 4</div>
            <div className="mt-1 text-sm font-extrabold text-slate-900">Receive & Submit Confidently</div>

            <div className="mt-4 relative h-[150px] rounded-xl border border-gray-200 bg-white overflow-hidden flex items-center justify-center">
              <div className="badge">
                <div className="badge-ring" />
                <div className="badge-inner">
                  <div className="text-[11px] font-extrabold text-slate-900">Delivered</div>
                  <div className="mt-1 text-[10px] font-bold text-slate-600">Ready to Submit</div>
                  <div className="mt-2 inline-flex items-center justify-center text-[10px] font-extrabold text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full">
                    Better Presentation
                  </div>
                </div>
              </div>

              <div className="confetti confetti-1" />
              <div className="confetti confetti-2" />
              <div className="confetti confetti-3" />
            </div>

            <div className="mt-3 text-[11px] font-semibold text-slate-600">
              Clean handwriting helps in better readability and presentation.
            </div>
          </div>
        </div>
      </div>

      {/* styles */}
      <style jsx>{`
        .hardcopy-grid {
          background-image: radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.07) 1px, transparent 0);
          background-size: 18px 18px;
        }
        .hardcopy-progress {
          width: 100%;
          background: linear-gradient(90deg, #2563eb, #4f46e5, #06b6d4);
          animation: prog 9.6s linear infinite;
          transform-origin: left center;
        }
        @keyframes prog {
          0% {
            transform: scaleX(0);
          }
          100% {
            transform: scaleX(1);
          }
        }

        /* scenes: 4 scenes in 9.6 sec */
        .scene {
          position: absolute;
          inset: 20px;
          opacity: 0;
          transform: translateY(6px);
          animation: scene 9.6s linear infinite;
        }
        .scene-1 {
          animation-delay: 0s;
        }
        .scene-2 {
          animation-delay: 2.4s;
        }
        .scene-3 {
          animation-delay: 4.8s;
        }
        .scene-4 {
          animation-delay: 7.2s;
        }
        @keyframes scene {
          0% {
            opacity: 0;
            transform: translateY(6px);
          }
          6% {
            opacity: 1;
            transform: translateY(0);
          }
          44% {
            opacity: 1;
            transform: translateY(0);
          }
          50% {
            opacity: 0;
            transform: translateY(-6px);
          }
          100% {
            opacity: 0;
            transform: translateY(-6px);
          }
        }

        /* pen + ink */
        .pen {
          width: 40px;
          height: 10px;
          border-radius: 999px;
          background: linear-gradient(90deg, #0f172a, #334155);
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.12);
          position: relative;
          animation: penMove 2.2s ease-in-out infinite;
        }
        .pen:after {
          content: "";
          position: absolute;
          right: -8px;
          top: 2px;
          width: 0;
          height: 0;
          border-left: 8px solid #334155;
          border-top: 3px solid transparent;
          border-bottom: 3px solid transparent;
        }
        .ink-line {
          height: 3px;
          border-radius: 999px;
          background: #1e3a8a;
          width: 0px;
          margin-left: 6px;
          animation: ink 2.2s ease-in-out infinite;
        }
        @keyframes penMove {
          0% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(90px);
          }
          100% {
            transform: translateX(0);
          }
        }
        @keyframes ink {
          0% {
            width: 0px;
            opacity: 0.2;
          }
          30% {
            width: 90px;
            opacity: 1;
          }
          60% {
            width: 140px;
            opacity: 1;
          }
          100% {
            width: 0px;
            opacity: 0.2;
          }
        }

        /* envelope */
        .envelope {
          width: 190px;
          height: 120px;
          position: relative;
          animation: pop 2.2s ease-in-out infinite;
        }
        .env-body {
          position: absolute;
          inset: 0;
          border-radius: 16px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          box-shadow: 0 14px 40px rgba(15, 23, 42, 0.08);
        }
        .env-top {
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 70px;
          border-radius: 16px 16px 12px 12px;
          background: linear-gradient(180deg, #e2e8f0, #f8fafc);
          clip-path: polygon(0 0, 100% 0, 50% 70%);
          opacity: 0.95;
          transform-origin: 50% 0%;
          animation: flap 2.2s ease-in-out infinite;
        }
        .env-seal {
          position: absolute;
          left: 50%;
          top: 55%;
          transform: translate(-50%, -50%);
          width: 38px;
          height: 38px;
          border-radius: 999px;
          background: radial-gradient(circle at 30% 30%, #ef4444, #b91c1c);
          box-shadow: 0 10px 24px rgba(239, 68, 68, 0.25);
        }
        @keyframes flap {
          0% {
            transform: rotateX(0deg);
          }
          50% {
            transform: rotateX(35deg);
          }
          100% {
            transform: rotateX(0deg);
          }
        }
        @keyframes pop {
          0% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
          100% {
            transform: translateY(0);
          }
        }

        /* map + truck */
        .map-dots {
          width: 100%;
          height: 100%;
          border-radius: 14px;
          background-image: radial-gradient(circle at 6px 6px, rgba(37, 99, 235, 0.12) 2px, transparent 0);
          background-size: 24px 24px;
        }
        .truck-wrap {
          position: absolute;
          left: -120px;
          bottom: 22px;
          width: calc(100% + 240px);
          height: 60px;
          animation: drive 2.2s ease-in-out infinite;
        }
        .truck {
          position: absolute;
          left: 0;
          bottom: 0;
          width: 120px;
          height: 46px;
        }
        .truck-body {
          position: absolute;
          left: 0;
          bottom: 10px;
          width: 74px;
          height: 26px;
          border-radius: 10px;
          background: linear-gradient(90deg, #2563eb, #4f46e5);
          box-shadow: 0 14px 30px rgba(37, 99, 235, 0.18);
        }
        .truck-cabin {
          position: absolute;
          left: 70px;
          bottom: 10px;
          width: 42px;
          height: 26px;
          border-radius: 10px;
          background: linear-gradient(90deg, #0f172a, #334155);
        }
        .wheel {
          position: absolute;
          bottom: 2px;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: #0f172a;
        }
        .wheel:after {
          content: "";
          position: absolute;
          inset: 4px;
          border-radius: 999px;
          background: #94a3b8;
        }
        .wheel-1 {
          left: 16px;
        }
        .wheel-2 {
          left: 76px;
        }
        @keyframes drive {
          0% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(220px);
          }
          100% {
            transform: translateX(0);
          }
        }

        /* badge + confetti */
        .badge {
          width: 170px;
          height: 170px;
          position: relative;
          animation: pulse 2.2s ease-in-out infinite;
        }
        .badge-ring {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: conic-gradient(from 90deg, #22c55e, #06b6d4, #4f46e5, #22c55e);
          filter: blur(0px);
          opacity: 0.85;
        }
        .badge-inner {
          position: absolute;
          inset: 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid rgba(226, 232, 240, 1);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          box-shadow: 0 18px 44px rgba(15, 23, 42, 0.08);
        }
        @keyframes pulse {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.03);
          }
          100% {
            transform: scale(1);
          }
        }
        .confetti {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 3px;
          opacity: 0.9;
          animation: conf 2.2s ease-in-out infinite;
        }
        .confetti-1 {
          left: 34px;
          top: 34px;
          background: #22c55e;
          animation-delay: 0.1s;
        }
        .confetti-2 {
          right: 40px;
          top: 54px;
          background: #2563eb;
          animation-delay: 0.2s;
        }
        .confetti-3 {
          left: 58px;
          bottom: 40px;
          background: #a855f7;
          animation-delay: 0.3s;
        }
        @keyframes conf {
          0% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-10px) rotate(40deg);
          }
          100% {
            transform: translateY(0) rotate(0deg);
          }
        }
      `}</style>
    </div>
  );
}

export default function ProductQuickView({ product, onClose }: QuickViewProps) {
  if (!product) return null;

  const hardcopyMode = isHardcopyProduct(product);

  // ✅ Image logic (only for non-hardcopy)
  const rawImages: string[] = Array.isArray(product.images) ? product.images : [];
  const baseList: string[] = rawImages.length ? rawImages : product.thumbnailUrl ? [product.thumbnailUrl] : [];
  const sorted = sortImagesNamewise(baseList);

  const thumb = sorted[0] || "";
  const quick = sorted[1] || sorted[0] || "";
  const imgAlt = product?.title ? `${product.title} preview` : "Product preview";

  // ✅ label differences
  const topBadge = hardcopyMode ? "DELIVERY (HARDCOPY)" : "INSTANT DOWNLOAD";

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

        {/* LEFT: Preview (image OR animation) */}
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

          {!hardcopyMode && thumb && (
            <div className="absolute bottom-6 left-6 bg-white/90 border border-gray-200 rounded-lg px-3 py-2 text-[11px] font-bold text-gray-700 shadow-sm">
              Preview = 2nd image (name-wise)
            </div>
          )}

          {hardcopyMode && (
            <div className="absolute bottom-6 left-6 bg-white/90 border border-gray-200 rounded-lg px-3 py-2 text-[11px] font-extrabold text-slate-800 shadow-sm">
              Live Process Preview (loop)
            </div>
          )}
        </div>

        {/* RIGHT: Details */}
        <div className="p-8 flex flex-col">
          <div className="mb-1">
            <span className={`text-xs font-bold px-2 py-1 rounded ${
              hardcopyMode ? "bg-indigo-100 text-indigo-700" : "bg-green-100 text-green-700"
            }`}>
              {topBadge}
            </span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-2 leading-snug">{product.title}</h2>

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

                {/* ✅ subtle policy note (low attention but clear) */}
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
              </>
            )}
          </div>

          <div className="mt-auto space-y-3">
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-200 transition transform active:scale-95">
              {hardcopyMode ? "Buy Now (Hardcopy Delivery)" : "Buy Now & Download"}
            </button>
            <p className="text-center text-xs text-gray-400">
              {hardcopyMode ? "Secure payment • Delivery support via WhatsApp" : "Secure payment via UPI / Card"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
