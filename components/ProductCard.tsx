"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FileText, Truck, Sparkles } from "lucide-react";
import { productHref } from "@/lib/productHref";

type ApiProduct = {
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
};

function money(n: number) {
  try {
    return new Intl.NumberFormat("en-IN").format(n);
  } catch {
    return String(n);
  }
}

export default function ProductCard({ product }: { product: ApiProduct }) {
  const [imgBroken, setImgBroken] = useState(false);

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

  return (
    <Link
      href={href}
      className="group relative block rounded-2xl border border-gray-200 bg-white overflow-hidden
                 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl
                 active:scale-[0.99]"
      aria-label={product.title}
    >
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

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-extrabold uppercase tracking-wide text-blue-700">
              {product.category || "Product"}
            </div>

            <h3 className="mt-1 font-extrabold text-[12px] md:text-sm text-slate-900 line-clamp-2 group-hover:text-blue-700 transition">
              {product.title}
            </h3>
          </div>
        </div>

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

        <div className="mt-3 md:hidden">
          <div className="w-full rounded-xl bg-blue-50 text-blue-700 border border-blue-100 py-2 text-center text-xs font-extrabold">
            Tap to View →
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-0 ring-blue-200/60 group-hover:ring-4 transition-all duration-300" />
    </Link>
  );
}
