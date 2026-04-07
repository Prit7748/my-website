"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination, EffectFade } from "swiper/modules";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "swiper/css/effect-fade";

type Device = "desktop" | "mobile";
type SlideType = "image" | "video";

type HeroSlideItem = {
  _id?: string;
  id?: string;
  device: Device;
  type: SlideType;
  src: string;
  link?: string;
  alt?: string;
  isActive?: boolean;
  order?: number;
  durationSeconds?: number;
};

type HeroSliderProps = {
  initialDesktopSlides?: HeroSlideItem[];
  initialMobileSlides?: HeroSlideItem[];
};

function safeStr(x: unknown) {
  return String(x ?? "").trim();
}

function safeNum(x: unknown, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function clampDurationSeconds(x: unknown, fallback = 5) {
  const n = Math.trunc(safeNum(x, fallback));
  if (n < 1) return 1;
  if (n > 60) return 60;
  return n;
}

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function normalizeSlides(input: unknown, fallbackDevice: Device): HeroSlideItem[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item: any, index): HeroSlideItem => {
      const device: Device = item?.device === "mobile" ? "mobile" : fallbackDevice;
      const type: SlideType = item?.type === "video" ? "video" : "image";
      const src = safeStr(item?.src);
      const link = safeStr(item?.link);
      const alt = safeStr(item?.alt);
      const isActive = item?.isActive !== false;
      const order = safeNum(item?.order, 1000 + index);
      const durationSeconds = clampDurationSeconds(item?.durationSeconds, 5);

      return {
        _id: safeStr(item?._id),
        id: safeStr(item?.id) || safeStr(item?._id) || `${device}-${index + 1}`,
        device,
        type,
        src,
        link,
        alt,
        isActive,
        order,
        durationSeconds,
      };
    })
    .filter((item) => item.isActive !== false && !!item.src)
    .sort((a, b) => {
      const orderDiff = safeNum(a.order, 1000) - safeNum(b.order, 1000);
      if (orderDiff !== 0) return orderDiff;
      return safeStr(a.id).localeCompare(safeStr(b.id));
    });
}

function SlideWrapper({
  href,
  children,
}: {
  href?: string;
  children: React.ReactNode;
}) {
  const cleanHref = safeStr(href);

  if (!cleanHref) {
    return <div className="relative block h-full w-full">{children}</div>;
  }

  if (isExternalHref(cleanHref)) {
    return (
      <a href={cleanHref} className="relative block h-full w-full" aria-label="Hero slide link">
        {children}
      </a>
    );
  }

  return (
    <Link href={cleanHref} className="relative block h-full w-full" aria-label="Hero slide link">
      {children}
    </Link>
  );
}

function SlideMedia({
  slide,
  isActive,
  isPriority,
}: {
  slide: HeroSlideItem;
  isActive: boolean;
  isPriority: boolean;
}) {
  const altText =
    safeStr(slide.alt) ||
    (slide.device === "desktop"
      ? "IGNOU Students Portal hero banner"
      : "IGNOU Students Portal mobile hero banner");

  if (slide.type === "video") {
    return (
      <video
        key={slide.src}
        className="h-full w-full object-cover"
        muted
        playsInline
        loop
        autoPlay={isActive}
        preload={isActive || isPriority ? "metadata" : "none"}
        controls={false}
      >
        <source src={slide.src} type="video/mp4" />
      </video>
    );
  }

  return (
    <img
      src={slide.src}
      alt={altText}
      className="h-full w-full object-cover"
      loading={isPriority ? "eager" : "lazy"}
      fetchPriority={isPriority ? "high" : "auto"}
      decoding="async"
    />
  );
}

function SliderShell({
  slides,
  desktop,
}: {
  slides: HeroSlideItem[];
  desktop: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!slides.length) return null;

  const hasMultiple = slides.length > 1;
  const shellClass = desktop
    ? "w-full h-[300px] sm:h-[340px] md:h-[420px] lg:h-[500px] xl:h-[600px]"
    : "w-full aspect-[713/620]";

  return (
    <Swiper
      modules={[Autoplay, Navigation, Pagination, EffectFade]}
      effect={hasMultiple ? "fade" : "slide"}
      fadeEffect={{ crossFade: true }}
      speed={700}
      spaceBetween={0}
      slidesPerView={1}
      loop={hasMultiple}
      navigation={hasMultiple}
      pagination={hasMultiple ? { clickable: true } : false}
      autoplay={
        hasMultiple
          ? {
              delay: 5000,
              disableOnInteraction: false,
              pauseOnMouseEnter: true,
            }
          : false
      }
      onSlideChange={(swiper) => {
        setActiveIndex(swiper.realIndex || 0);
      }}
      className={shellClass}
    >
      {slides.map((slide, index) => {
        const slideKey = safeStr(slide._id) || safeStr(slide.id) || `${slide.device}-${index}`;
        const isCurrent = activeIndex === index;
        const isFirst = index === 0;
        const durationMs = clampDurationSeconds(slide.durationSeconds, 5) * 1000;

        return (
          <SwiperSlide key={slideKey} data-swiper-autoplay={durationMs}>
            <SlideWrapper href={slide.link}>
              <SlideMedia slide={slide} isActive={isCurrent} isPriority={isFirst} />
            </SlideWrapper>
          </SwiperSlide>
        );
      })}
    </Swiper>
  );
}

export default function HeroSlider({
  initialDesktopSlides = [],
  initialMobileSlides = [],
}: HeroSliderProps) {
  const [desktopSlides, setDesktopSlides] = useState<HeroSlideItem[]>(
    normalizeSlides(initialDesktopSlides, "desktop")
  );
  const [mobileSlides, setMobileSlides] = useState<HeroSlideItem[]>(
    normalizeSlides(initialMobileSlides, "mobile")
  );
  const [loading, setLoading] = useState(
    initialDesktopSlides.length === 0 && initialMobileSlides.length === 0
  );

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    async function loadSlides() {
      try {
        setLoading((prev) => prev || (desktopSlides.length === 0 && mobileSlides.length === 0));

        const ts = Date.now();

        const [desktopRes, mobileRes] = await Promise.all([
          fetch(`/api/site-settings/hero-slides?device=desktop&_=${ts}`, {
            method: "GET",
            signal: controller.signal,
            cache: "no-store",
          }),
          fetch(`/api/site-settings/hero-slides?device=mobile&_=${ts}`, {
            method: "GET",
            signal: controller.signal,
            cache: "no-store",
          }),
        ]);

        const [desktopData, mobileData] = await Promise.all([
          desktopRes.ok ? desktopRes.json() : [],
          mobileRes.ok ? mobileRes.json() : [],
        ]);

        if (ignore) return;

        setDesktopSlides(normalizeSlides(desktopData, "desktop"));
        setMobileSlides(normalizeSlides(mobileData, "mobile"));
      } catch {
        if (ignore) return;
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadSlides();

    return () => {
      ignore = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasDesktop = useMemo(() => desktopSlides.length > 0, [desktopSlides]);
  const hasMobile = useMemo(() => mobileSlides.length > 0, [mobileSlides]);

  if (!hasDesktop && !hasMobile && !loading) {
    return null;
  }

  return (
    <div className="relative w-full overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-sm">
      <div className="hidden md:block">
        {hasDesktop ? (
          <SliderShell slides={desktopSlides} desktop />
        ) : loading ? (
          <div className="w-full h-[300px] sm:h-[340px] md:h-[420px] lg:h-[500px] xl:h-[600px] animate-pulse bg-slate-100" />
        ) : null}
      </div>

      <div className="block md:hidden">
        {hasMobile ? (
          <SliderShell slides={mobileSlides} desktop={false} />
        ) : loading ? (
          <div className="w-full aspect-[713/620] animate-pulse bg-slate-100" />
        ) : null}
      </div>
    </div>
  );
}