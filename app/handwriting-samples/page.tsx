// ✅ NEW FILE PATH: app/handwriting-samples/page.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";

const SAMPLE_IMAGES = [
  "/samples/handwriting/1.jpg",
  "/samples/handwriting/2.jpg",
  "/samples/handwriting/3.jpg",
  "/samples/handwriting/4.jpg",
];

export default function HandwritingSamplesPage() {
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
        <h1 className="text-2xl md:text-4xl font-extrabold text-slate-900">Handwriting Samples</h1>
        <p className="mt-2 text-sm md:text-lg font-semibold text-slate-600">
          Preview real handwritten pages (portrait). More samples are added regularly.
        </p>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {SAMPLE_IMAGES.map((src) => (
            <div key={src} className="rounded-2xl border border-gray-200 overflow-hidden bg-gray-50">
              <div className="relative aspect-[210/297]">
                <Image
                  src={src}
                  alt="Handwriting sample"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <Link
            href="/handwritten-hardcopy"
            className="inline-flex items-center justify-center px-5 py-3 rounded-2xl bg-slate-900 text-white font-extrabold hover:bg-slate-800 transition"
          >
            Back to Handwritten Hardcopy →
          </Link>
        </div>
      </div>
    </main>
  );
}
