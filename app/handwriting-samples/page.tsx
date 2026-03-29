"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight, X, ChevronLeft, ChevronRight as ChevronRightIcon } from "lucide-react";

type SampleImg = {
  src: string;
  alt: string;
};

type HandwritingSampleApiItem = {
  imageUrl?: string;
  alt?: string;
};

const FALLBACK_SAMPLE_IMAGES: SampleImg[] = [
  { src: "/samples/handwriting/1.jpg", alt: "Handwriting sample page 1" },
  { src: "/samples/handwriting/2.jpg", alt: "Handwriting sample page 2" },
  { src: "/samples/handwriting/3.jpg", alt: "Handwriting sample page 3" },
  { src: "/samples/handwriting/4.jpg", alt: "Handwriting sample page 4" },
];

export default function HandwritingSamplesPage() {
  const [images, setImages] = useState<SampleImg[]>(FALLBACK_SAMPLE_IMAGES);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const activeImage =
    activeIndex !== null && images[activeIndex] ? images[activeIndex] : null;

  useEffect(() => {
    let active = true;

    async function loadSamples() {
      try {
        const res = await fetch("/api/site-settings/handwriting-samples", {
          cache: "no-store",
        });

        if (!res.ok) throw new Error("Failed to load samples");

        const data = await res.json();
        const items: HandwritingSampleApiItem[] = Array.isArray(data?.items)
          ? data.items
          : [];

        const next: SampleImg[] = items
          .map((item) => ({
            src: String(item?.imageUrl || "").trim(),
            alt: String(item?.alt || "Handwriting sample").trim(),
          }))
          .filter((x) => Boolean(x.src));

        if (!active) return;

        if (next.length > 0) {
          setImages(next);
        } else {
          setImages(FALLBACK_SAMPLE_IMAGES);
        }
      } catch (error) {
        console.error("Failed to load handwriting samples:", error);
        if (active) {
          setImages(FALLBACK_SAMPLE_IMAGES);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSamples();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (activeIndex !== null) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [activeIndex]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (activeIndex === null) return;

      if (e.key === "Escape") {
        setActiveIndex(null);
      } else if (e.key === "ArrowRight") {
        setActiveIndex((prev) => {
          if (prev === null) return prev;
          return (prev + 1) % images.length;
        });
      } else if (e.key === "ArrowLeft") {
        setActiveIndex((prev) => {
          if (prev === null) return prev;
          return (prev - 1 + images.length) % images.length;
        });
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, images.length]);

  function openViewer(index: number) {
    setActiveIndex(index);
  }

  function closeViewer() {
    setActiveIndex(null);
  }

  function showPrev() {
    setActiveIndex((prev) => {
      if (prev === null) return prev;
      return (prev - 1 + images.length) % images.length;
    });
  }

  function showNext() {
    setActiveIndex((prev) => {
      if (prev === null) return prev;
      return (prev + 1) % images.length;
    });
  }

  return (
    <main className="min-h-screen bg-white text-slate-800">
      <div className="border-b border-gray-100">
        <div className="max-w-[1200px] mx-auto px-4 py-3 text-[13px] text-gray-500 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <Link href="/" className="hover:text-blue-700 font-semibold">
            Home
          </Link>
          <ChevronRight size={14} className="text-gray-300" />
          <Link href="/handwritten-hardcopy" className="hover:text-blue-700 font-semibold">
            Handwritten Hardcopy
          </Link>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="text-blue-700 font-extrabold">Handwriting Samples</span>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 py-8">
        <h1 className="text-2xl md:text-4xl font-extrabold text-slate-900">
          Handwriting Samples
        </h1>
        <p className="mt-2 text-sm md:text-lg font-semibold text-slate-600">
          Preview real handwritten pages (portrait). Click any sample to open zoom view.
        </p>

        {loading ? (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-gray-200 overflow-hidden bg-gray-50 animate-pulse"
              >
                <div className="aspect-[210/297] bg-gray-200" />
              </div>
            ))}
          </div>
        ) : images.length > 0 ? (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            {images.map((img, index) => (
              <button
                key={`${img.src}-${index}`}
                type="button"
                onClick={() => openViewer(index)}
                className="group rounded-2xl border border-gray-200 overflow-hidden bg-gray-50 text-left hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className="relative aspect-[210/297] overflow-hidden">
                  <Image
                    src={img.src}
                    alt={img.alt}
                    fill
                    className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    sizes="(max-width: 768px) 50vw, 25vw"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                  <div className="absolute bottom-2 left-2 right-2 rounded-xl bg-white/90 backdrop-blur px-3 py-2 text-[11px] md:text-xs font-extrabold text-slate-800 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    Click to zoom
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center">
            <div className="text-lg font-extrabold text-slate-900">No samples found</div>
            <div className="mt-1 text-sm font-semibold text-slate-600">
              Please add handwriting sample images from admin/site settings.
            </div>
          </div>
        )}

        <div className="mt-8">
          <Link
            href="/handwritten-hardcopy"
            className="inline-flex items-center justify-center px-5 py-3 rounded-2xl bg-slate-900 text-white font-extrabold hover:bg-slate-800 transition"
          >
            Back to Handwritten Hardcopy →
          </Link>
        </div>
      </div>

      {activeImage && (
        <div
          className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm"
          onClick={closeViewer}
        >
          <div className="absolute inset-0 flex items-center justify-center p-3 md:p-6">
            <div
              className="relative w-full max-w-6xl h-[92vh] rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeViewer}
                className="absolute top-3 right-3 z-20 h-11 w-11 rounded-full bg-white/95 text-slate-900 shadow-lg hover:bg-white flex items-center justify-center"
                aria-label="Close zoom view"
              >
                <X size={20} />
              </button>

              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={showPrev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-20 h-11 w-11 rounded-full bg-white/95 text-slate-900 shadow-lg hover:bg-white flex items-center justify-center"
                    aria-label="Previous image"
                  >
                    <ChevronLeft size={22} />
                  </button>

                  <button
                    type="button"
                    onClick={showNext}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-20 h-11 w-11 rounded-full bg-white/95 text-slate-900 shadow-lg hover:bg-white flex items-center justify-center"
                    aria-label="Next image"
                  >
                    <ChevronRightIcon size={22} />
                  </button>
                </>
              )}

              <div className="absolute top-3 left-3 z-20 rounded-full bg-white/95 text-slate-900 px-4 py-2 text-xs md:text-sm font-extrabold shadow-lg">
                {activeIndex! + 1} / {images.length}
              </div>

              <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden">
                <Image
                  src={activeImage.src}
                  alt={activeImage.alt}
                  fill
                  className="object-contain"
                  sizes="100vw"
                  unoptimized
                  priority
                />
              </div>

              <div className="absolute bottom-3 left-3 right-3 z-20 rounded-2xl bg-white/95 backdrop-blur px-4 py-3 shadow-lg">
                <div className="text-sm md:text-base font-extrabold text-slate-900">
                  {activeImage.alt || `Handwriting sample ${activeIndex! + 1}`}
                </div>
                <div className="mt-1 text-xs md:text-sm font-semibold text-slate-600">
                  Press Esc to close • Use ← / → keys to switch samples
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}