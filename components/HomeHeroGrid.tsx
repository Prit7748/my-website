"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import NotificationTicker, { type NoticeItem } from "./NotificationTicker";

type Props = {
  onSearch: (q: string) => void;
  offersHref?: string;
  notices?: NoticeItem[]; // optional override
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

  // ✅ API notices (default)
  const [apiNotices, setApiNotices] = useState<NoticeItem[]>([]);

  // ✅ fallback (only if API empty/error)
  const fallbackNotices: NoticeItem[] = useMemo(
    () => [
      { id: "n1", title: "New Solved Assignments Uploaded ✅", href: "/products?sort=latest" },
      { id: "n2", title: "Handwritten Hardcopy: Express Delivery Available 🚚", href: "/handwritten-hardcopy" },
      { id: "n3", title: "PYQ + Guess Papers Combo Offer 🔥", href: "/combo" },
      { id: "n4", title: "Important: Exam Form / Date Updates (Check Here)", href: "/blog" },
    ],
    []
  );

  // If parent passes notices, use them (highest priority)
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

  // ✅ Prefer API, fallback only if API empty
  const list = forced || (apiNotices.length ? apiNotices : fallbackNotices);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = String(q || "").trim();
    onSearch(text);
  }

  return (
    <section className="bg-white">
      <div className="max-w-[1600px] mx-auto px-4 pt-6 pb-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4 items-stretch">
          <form
            onSubmit={submit}
            className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex items-stretch"
            aria-label="Search products"
          >
            <div className="flex-1 flex items-center gap-3 px-4">
              <Search className="text-slate-400" size={18} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Type any subject/course code"
                className="w-full py-4 outline-none text-slate-800 placeholder:text-slate-300 font-semibold"
              />
            </div>
            <button
              type="submit"
              className="px-6 md:px-8 font-extrabold bg-[#0F766E] text-white hover:opacity-95 transition"
            >
              Search
            </button>
          </form>

          <Link
            href={offersHref}
            className="rounded-2xl border border-emerald-200 bg-emerald-50 shadow-sm flex items-center justify-center font-extrabold text-slate-800 hover:bg-emerald-100 transition"
            aria-label="Special Offers"
          >
            Special Offers
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-5">
          <div className="rounded-[32px] border border-gray-200 shadow-sm overflow-hidden bg-white">
            <div className="relative w-full">
              <div className="aspect-[16/7] sm:aspect-[16/6] lg:aspect-[16/6]">{left}</div>
            </div>
          </div>

          <div className="rounded-[32px] border border-gray-200 shadow-sm overflow-hidden bg-white">
            <div className="h-full flex flex-col">
              <NotificationTicker
                title="Notifications"
                items={list}
                heightClass="h-[280px] sm:h-[320px] lg:h-[360px]"
              />

              {/* ✅ Helpful footer */}
              <div className="px-5 pb-5">
                <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
                  <div className="text-xs font-extrabold text-slate-800">
                    Quick Help
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-bold">
                    <Link
                      href="/blog"
                      className="rounded-xl border border-gray-100 bg-slate-50 hover:bg-slate-100 px-3 py-2 text-slate-700"
                    >
                      Exam Updates
                    </Link>
                    <Link
                      href="/products?sort=latest"
                      className="rounded-xl border border-gray-100 bg-slate-50 hover:bg-slate-100 px-3 py-2 text-slate-700"
                    >
                      Latest Uploads
                    </Link>
                    <Link
                      href="/faq"
                      className="rounded-xl border border-gray-100 bg-slate-50 hover:bg-slate-100 px-3 py-2 text-slate-700"
                    >
                      FAQs
                    </Link>
                    <Link
                      href="/contact"
                      className="rounded-xl border border-gray-100 bg-slate-50 hover:bg-slate-100 px-3 py-2 text-slate-700"
                    >
                      Need Help?
                    </Link>
                  </div>
                  <div className="mt-2 text-[10px] text-slate-400 font-semibold">
                    Tip: Official links open in a new tab for safety.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
