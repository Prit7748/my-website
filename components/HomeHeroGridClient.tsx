"use client";

import React from "react";
import HomeHeroGrid from "@/components/HomeHeroGrid";
import type { NoticeItem } from "@/components/NotificationTicker";

type Props = {
  offersHref?: string;
  notices?: NoticeItem[];
  left: React.ReactNode;
};

export default function HomeHeroGridClient({ offersHref = "/offers", notices, left }: Props) {
  return (
    <HomeHeroGrid
      onSearch={(q) => {
        const text = String(q || "").trim();
        const url = text ? `/products?search=${encodeURIComponent(text)}` : "/products";
        window.location.href = url;
      }}
      offersHref={offersHref}
      notices={notices}
      left={left}
    />
  );
}
