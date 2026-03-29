"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BellRing, X } from "lucide-react";

export type NoticeItem = {
  id: string;
  title: string;
  href: string;
  badge?: string;
};

type Props = {
  title?: string;
  items: NoticeItem[];
  heightClass?: string;
  viewAllThreshold?: number;
};

function isExternalUrl(href: string) {
  const h = String(href || "").trim().toLowerCase();
  return h.startsWith("http://") || h.startsWith("https://");
}

function NoticeCard({ item }: { item: NoticeItem }) {
  const external = isExternalUrl(item.href);

  const content = (
    <div className="mx-3 mt-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/70">
      <div className="flex items-start gap-3">
        <span className="mt-1.5 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
        <div className="min-w-0">
          <div className="line-clamp-2 text-[13px] font-extrabold leading-5 text-slate-800 sm:text-[13.5px]">
            {item.title}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {item.badge ? (
              <span className="inline-flex rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-extrabold text-white">
                {item.badge}
              </span>
            ) : null}

            {external ? (
              <span className="text-[10px] font-bold text-slate-400">
                Opens official site
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  if (external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="block"
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={item.href} className="block">
      {content}
    </Link>
  );
}

function ScrollingList({
  items,
  duration = 18,
  compact = false,
}: {
  items: NoticeItem[];
  duration?: number;
  compact?: boolean;
}) {
  const shouldLoop = items.length > 1;
  const loopItems = useMemo(
    () => (shouldLoop ? [...items, ...items] : items),
    [items, shouldLoop]
  );

  if (!items.length) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm font-semibold text-slate-400">
        No notifications available right now.
      </div>
    );
  }

  return (
    <div
      className="ticker absolute inset-0 overflow-hidden"
      style={
        {
          ["--ticker-duration" as string]: `${duration}s`,
        } as React.CSSProperties
      }
    >
      <div className={`ticker-track ${compact ? "pb-14" : "pb-16"}`}>
        {loopItems.map((item, idx) => (
          <NoticeCard key={`${item.id}-${idx}`} item={item} />
        ))}
      </div>

      <style jsx>{`
        .ticker:hover .ticker-track {
          animation-play-state: paused;
        }

        .ticker-track {
          will-change: transform;
          animation: ${shouldLoop ? "tickerScroll" : "none"}
            var(--ticker-duration) linear infinite;
        }

        @keyframes tickerScroll {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(-50%);
          }
        }
      `}</style>
    </div>
  );
}

export default function NotificationTicker({
  title = "Notifications",
  items,
  heightClass = "h-[320px] sm:h-[360px]",
  viewAllThreshold = 4,
}: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const showViewAll = items.length > viewAllThreshold;
  const tickerDuration = Math.max(16, Math.min(items.length * 4, 34));
  const modalDuration = Math.max(20, Math.min(items.length * 4.5, 42));

  return (
    <>
      <div className={`w-full ${heightClass}`}>
        <div className="flex h-full flex-col rounded-[30px] border border-slate-200 bg-white/95 shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <BellRing className="h-4 w-4" />
              </span>
              <div className="text-sm font-extrabold text-slate-900">
                {title}
              </div>
            </div>

            <div className="text-[11px] font-bold text-slate-400">
              Auto updates
            </div>
          </div>

          <div className="relative mx-4 mb-4 flex-1 overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
            <ScrollingList items={items} duration={tickerDuration} />

            <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-slate-50 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent" />

            {showViewAll ? (
              <div className="absolute bottom-3 right-3 z-10">
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="pointer-events-auto inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-extrabold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                >
                  View all
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <BellRing className="h-4.5 w-4.5" />
                </span>
                <div>
                  <div className="text-base font-extrabold text-slate-900">
                    All Notifications
                  </div>
                  <div className="text-xs font-semibold text-slate-400">
                    Auto scrolling updates
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close notifications popup"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="p-4 sm:p-5">
              <div className="relative h-[65vh] min-h-[420px] overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
                <ScrollingList items={items} duration={modalDuration} compact />

                <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-slate-50 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent" />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}