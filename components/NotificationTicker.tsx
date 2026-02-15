"use client";

import Link from "next/link";
import { useMemo } from "react";

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
};

function isExternalUrl(href: string) {
  const h = String(href || "").trim().toLowerCase();
  return h.startsWith("http://") || h.startsWith("https://");
}

export default function NotificationTicker({
  title = "Notifications",
  items,
  heightClass = "h-[360px]",
}: Props) {
  const loop = useMemo(() => [...items, ...items], [items]);

  return (
    <div className={`w-full ${heightClass} flex flex-col`}>
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="text-sm font-extrabold text-slate-900">{title}</div>
        <div className="text-[11px] font-bold text-slate-400">Auto updates</div>
      </div>

      <div className="px-4 pb-5 flex-1">
        <div className="relative h-full rounded-2xl border border-gray-100 bg-slate-50 overflow-hidden">
          <div className="ticker group absolute inset-0">
            <div className="ticker-track">
              {loop.map((n, idx) => {
                const external = isExternalUrl(n.href);

                const Card = (
                  <div className="block mx-3 mt-3 rounded-2xl bg-white border border-gray-100 shadow-sm px-4 py-3 hover:border-blue-200 hover:bg-blue-50 transition">
                    <div className="flex items-start gap-2">
                      <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <div className="min-w-0">
                        <div className="text-[12px] font-extrabold text-slate-800 leading-snug line-clamp-2">
                          {n.title}
                        </div>
                        {n.badge ? (
                          <div className="mt-1 inline-flex text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-900 text-white">
                            {n.badge}
                          </div>
                        ) : null}
                        {external ? (
                          <div className="mt-1 text-[10px] font-bold text-slate-400">
                            Opens official site
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );

                // ✅ External: <a> with security
                if (external) {
                  return (
                    <a
                      key={`${n.id}-${idx}`}
                      href={n.href}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="block"
                    >
                      {Card}
                    </a>
                  );
                }

                // ✅ Internal: Next Link
                return (
                  <Link key={`${n.id}-${idx}`} href={n.href} className="block">
                    {Card}
                  </Link>
                );
              })}
            </div>
          </div>

          <style jsx>{`
            .ticker:hover .ticker-track {
              animation-play-state: paused;
            }
            .ticker-track {
              will-change: transform;
              animation: tickerScroll 18s linear infinite;
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

        <div className="mt-3 text-[11px] font-semibold text-slate-400 px-1">
          Hover to pause • Click to open
        </div>
      </div>
    </div>
  );
}
