"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import NotificationTicker, { type NoticeItem } from "./NotificationTicker";

type Props = {
  onSearch: (q: string) => void;
  offersHref?: string;
  notices?: NoticeItem[];
  left: React.ReactNode;
};

async function fetchNotices(): Promise<NoticeItem[]> {
  try {
    const res = await fetch("/api/site-settings/notices", { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data
      .map((x: any) => ({
        id: String(x.id || x._id || ""),
        title: String(x.title || ""),
        href: String(x.href || ""),
        badge: x.badge ? String(x.badge) : undefined,
      }))
      .filter((n: NoticeItem) => n.id && n.title && n.href);
  } catch {
    return [];
  }
}

export default function HomeHeroGrid({
  onSearch,
  offersHref = "/offers",
  notices,
  left,
}: Props) {
  const [q, setQ] = useState("");

  const [apiNotices, setApiNotices] = useState<NoticeItem[]>([]);

  const fallbackNotices: NoticeItem[] = useMemo(
    () => [
      {
        id: "n1",
        title: "New Solved Assignments Uploaded ✅",
        href: "/products?sort=latest",
      },
      {
        id: "n2",
        title: "Handwritten Hardcopy: Express Delivery Available 🚚",
        href: "/handwritten-hardcopy",
      },
      {
        id: "n3",
        title: "PYQ + Guess Papers Combo Offer 🔥",
        href: "/combo",
      },
      {
        id: "n4",
        title: "Important: Exam Form / Date Updates (Check Here)",
        href: "/blog",
      },
    ],
    []
  );

  const forced = notices?.length ? notices : null;

  useEffect(() => {
    if (forced) return;

    let alive = true;

    (async () => {
      const list = await fetchNotices();
      if (!alive) return;
      setApiNotices(list);
    })();

    return () => {
      alive = false;
    };
  }, [forced]);

  const list = forced || (apiNotices.length ? apiNotices : fallbackNotices);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = String(q || "").trim();
    onSearch(text);
  }

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1600px] px-4 pb-4 pt-6">
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1fr_260px]">
          <form
            onSubmit={submit}
            className="flex items-stretch overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
            aria-label="Search products"
          >
            <div className="flex flex-1 items-center gap-3 px-4">
              <Search className="text-slate-400" size={18} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Type any subject/course code"
                className="w-full py-4 font-semibold text-slate-800 outline-none placeholder:text-slate-300"
              />
            </div>

            <button
              type="submit"
              className="bg-[#0F766E] px-6 font-extrabold text-white transition hover:opacity-95 md:px-8"
            >
              Search
            </button>
          </form>

          <Link
            href={offersHref}
            className="flex items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 font-extrabold text-slate-800 shadow-sm transition hover:bg-emerald-100"
            aria-label="Special Offers"
          >
            Special Offers
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_420px]">
          <div className="overflow-hidden rounded-[32px] border border-gray-200 bg-white shadow-sm">
            <div className="relative w-full">
              <div className="aspect-[16/7] sm:aspect-[16/6] lg:aspect-[16/6]">
                {left}
              </div>
            </div>
          </div>

          <div className="h-full">
            <NotificationTicker
              title="Notifications"
              items={list}
              heightClass="h-[280px] sm:h-[320px] lg:h-full min-h-[360px]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}