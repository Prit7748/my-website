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

export default function ProductQuickView({ product, onClose }: QuickViewProps) {
  if (!product) return null;

  // 1) Prefer product.images (array). If empty, fallback to thumbnailUrl as a single-image array.
  const rawImages: string[] = Array.isArray(product.images) ? product.images : [];
  const baseList: string[] = rawImages.length ? rawImages : product.thumbnailUrl ? [product.thumbnailUrl] : [];
  const sorted = sortImagesNamewise(baseList);

  // 2) Thumbnail = 1st image, QuickView preview = 2nd image, else fallback to 1st.
  const thumb = sorted[0] || "";
  const quick = sorted[1] || sorted[0] || "";

  // Slightly better alt for accessibility (SEO doesn't matter much here because it's a modal,
  // but good alt is still a best-practice)
  const imgAlt = product?.title ? `${product.title} preview` : "Product preview";

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
          <div className="relative w-[280px] aspect-[210/297] shadow-lg border border-gray-200 bg-white overflow-hidden rounded-lg">
            {quick ? (
              <Image
                src={quick}
                alt={imgAlt}
                fill
                className="object-cover"
                // Better performance: tell browser what size to load
                sizes="(max-width: 768px) 80vw, 280px"
                // If you want: set priority true only if modal opens frequently
                // priority
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
                <FileText size={40} className="text-gray-300 mb-2" />
                <h4 className="font-bold text-gray-400 text-sm">NO PREVIEW IMAGE</h4>
                <p className="text-[10px] text-gray-400 mt-2">Add at least 1 image in DB.</p>
              </div>
            )}
          </div>

          {thumb && (
            <div className="absolute bottom-6 left-6 bg-white/90 border border-gray-200 rounded-lg px-3 py-2 text-[11px] font-bold text-gray-700 shadow-sm">
              Preview = 2nd image (name-wise)
            </div>
          )}
        </div>

        <div className="p-8 flex flex-col">
          <div className="mb-1">
            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded">
              INSTANT DOWNLOAD
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

          <div className="space-y-3 mb-8 border-t border-b border-gray-100 py-6">
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
          </div>

          <div className="mt-auto space-y-3">
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-200 transition transform active:scale-95">
              Buy Now & Download
            </button>
            <p className="text-center text-xs text-gray-400">Secure payment via UPI / Card</p>
          </div>
        </div>
      </div>
    </div>
  );
}
