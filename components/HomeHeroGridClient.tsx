"use client";

import React from "react";
import { useRouter } from "next/navigation";

import HomeHeroGrid from "@/components/HomeHeroGrid";
import type { NoticeItem } from "@/components/NotificationTicker";

type Props = {
  offersHref?: string;
  notices?: NoticeItem[];
  left: React.ReactNode;
};

const NAV_START_EVENT = "isp:navigation-start";

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function dispatchNavigationStart(href?: string) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(NAV_START_EVENT, {
      detail: {
        href: safeStr(href) || undefined,
      },
    })
  );
}

export default function HomeHeroGridClient({
  offersHref = "/offers",
  notices,
  left,
}: Props) {
  const router = useRouter();

  return (
    <HomeHeroGrid
      onSearch={(q) => {
        const text = safeStr(q);
        const url = text
          ? `/products?search=${encodeURIComponent(text)}`
          : "/products";

        dispatchNavigationStart(url);
        router.push(url);
      }}
      offersHref={offersHref}
      notices={notices}
      left={left}
    />
  );
}