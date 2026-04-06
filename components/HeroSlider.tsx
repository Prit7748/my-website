// components/HeroSlider.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type SlideItem = {
  id: string;
  type: "image" | "video";
  src: string;
  alt: string;
  href?: string;
};

const AUTOPLAY_MS = 5000;

const slides: SlideItem[] = [
  {
    id: "hero-solved-assignments",
    type: "image",
    src: "/Slider1.png",
    alt: "IGNOU Solved Assignments",
    href: "/solved-assignments",
  },
  {
    id: "hero-intro-video",
    type: "video",
    src: "/intro.mp4",
    alt: "IGNOU Students Portal Introduction",
    href: "/products",
  },
];

function isClickableHref(href?: string) {
  const value = String(href || "").trim();
  return !!value && value !== "#";
}

function SlideMedia({
  slide,
  priority,
}: {
  slide: SlideItem;
  priority?: boolean;
}) {
  if (slide.type === "image") {
    return (
      <Image
        src={slide.src}
        alt={slide.alt}
        fill
        priority={priority}
        sizes="(max-width: 768px) 100vw, 100vw"
        className="object-cover"
      />
    );
  }

  return (
    <video
      className="h-full w-full object-cover"
      autoPlay
      muted
      loop
      playsInline
      preload={priority ? "auto" : "metadata"}
      aria-label={slide.alt}
    >
      <source src={slide.src} type="video/mp4" />
    </video>
  );
}

function SlideContent({
  slide,
  priority,
}: {
  slide: SlideItem;
  priority?: boolean;
}) {
  const content = (
    <div className="relative h-full w-full">
      <SlideMedia slide={slide} priority={priority} />
    </div>
  );

  if (isClickableHref(slide.href)) {
    return (
      <Link
        href={slide.href!}
        className="block h-full w-full"
        aria-label={slide.alt}
      >
        {content}
      </Link>
    );
  }

  return content;
}

export default function HeroSlider() {
  const slideCount = slides.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = useMemo(() => slides[activeIndex] || slides[0], [activeIndex]);

  useEffect(() => {
    if (slideCount <= 1) return;

    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slideCount);
    }, AUTOPLAY_MS);

    return () => window.clearInterval(timer);
  }, [slideCount]);

  const goTo = (index: number) => {
    if (slideCount <= 0) return;
    const next = ((index % slideCount) + slideCount) % slideCount;
    setActiveIndex(next);
  };

  const goPrev = () => goTo(activeIndex - 1);
  const goNext = () => goTo(activeIndex + 1);

  return (
    <div className="relative w-full overflow-hidden rounded-[28px] bg-slate-100">
      <div className="relative h-[240px] sm:h-[300px] md:h-[420px] lg:h-[520px] w-full">
        <SlideContent slide={activeSlide} priority />

        {slideCount > 1 ? (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous slide"
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-slate-800 shadow-md transition hover:bg-white"
            >
              <ChevronLeft size={20} />
            </button>

            <button
              type="button"
              onClick={goNext}
              aria-label="Next slide"
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-slate-800 shadow-md transition hover:bg-white"
            >
              <ChevronRight size={20} />
            </button>

            <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/25 px-3 py-2 backdrop-blur-sm">
              {slides.map((slide, index) => {
                const isActive = index === activeIndex;
                return (
                  <button
                    key={slide.id}
                    type="button"
                    aria-label={`Go to slide ${index + 1}`}
                    aria-current={isActive ? "true" : "false"}
                    onClick={() => goTo(index)}
                    className={`h-2.5 rounded-full transition-all ${
                      isActive ? "w-8 bg-white" : "w-2.5 bg-white/60 hover:bg-white/80"
                    }`}
                  />
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}