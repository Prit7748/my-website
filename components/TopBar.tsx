"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Instagram,
  Youtube,
  Facebook,
  Twitter,
  Send,
  Truck,
  Sparkles,
} from "lucide-react";

type SocialItem = {
  _id: string;
  name: string;
  url: string;
  icon?: string;
  isActive: boolean;
  sortOrder: number;
};

const DELIVERY_TEXT = "All India Delivery 7496865680 T&C";

function safeStr(x: unknown) {
  return String(x ?? "").trim();
}

function iconFor(key: string) {
  const k = safeStr(key).toLowerCase();

  if (k.includes("instagram")) return Instagram;
  if (k.includes("youtube")) return Youtube;
  if (k.includes("facebook")) return Facebook;
  if (k.includes("twitter") || k === "x" || k.includes("x ")) return Twitter;
  if (k.includes("telegram")) return Send;

  return null;
}

function socialButtonClass(key: string) {
  const k = safeStr(key).toLowerCase();

  if (k.includes("instagram")) {
    return "border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 via-pink-50 to-orange-50 text-fuchsia-700 hover:from-fuchsia-100 hover:via-pink-100 hover:to-orange-100 hover:border-fuchsia-300";
  }

  if (k.includes("youtube")) {
    return "border-red-200 bg-gradient-to-br from-red-50 to-rose-50 text-red-600 hover:from-red-100 hover:to-rose-100 hover:border-red-300";
  }

  if (k.includes("facebook")) {
    return "border-blue-200 bg-gradient-to-br from-blue-50 to-sky-50 text-blue-700 hover:from-blue-100 hover:to-sky-100 hover:border-blue-300";
  }

  if (k.includes("twitter") || k === "x" || k.includes("x ")) {
    return "border-slate-300 bg-gradient-to-br from-slate-50 to-gray-100 text-slate-800 hover:from-slate-100 hover:to-gray-200 hover:border-slate-400";
  }

  if (k.includes("telegram")) {
    return "border-cyan-200 bg-gradient-to-br from-cyan-50 to-sky-50 text-cyan-700 hover:from-cyan-100 hover:to-sky-100 hover:border-cyan-300";
  }

  return "border-rose-200 bg-white/90 text-slate-700 hover:bg-white hover:border-rose-300";
}

async function fetchSocialLinks(): Promise<SocialItem[]> {
  try {
    const res = await fetch("/api/site-settings/social-links", {
      cache: "no-store",
    });

    const data = await res.json();
    if (!data?.ok) return [];

    const items = Array.isArray(data.items) ? data.items : [];
    return items.filter((x: any) => x && x.isActive);
  } catch {
    return [];
  }
}

export default function TopBar() {
  const [items, setItems] = useState<SocialItem[]>([]);
  const [mobileFrame, setMobileFrame] = useState(0);

  useEffect(() => {
    let alive = true;

    (async () => {
      const list = await fetchSocialLinks();
      if (!alive) return;
      setItems(list);
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;

    const timer = window.setInterval(() => {
      setMobileFrame((prev) => (prev === 0 ? 1 : 0));
    }, 3000);

    return () => window.clearInterval(timer);
  }, []);

  const topBarSocials = useMemo(() => {
    return [...items]
      .filter((it) => {
        const n = safeStr(it.name).toLowerCase();
        const ic = safeStr(it.icon).toLowerCase();
        const u = safeStr(it.url).toLowerCase();

        const isWhatsapp =
          n.includes("whatsapp") ||
          ic.includes("whatsapp") ||
          u.includes("wa.me");

        return !isWhatsapp;
      })
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
      .slice(0, 5);
  }, [items]);

  const mobileSocials = topBarSocials.slice(0, 4);

  return (
    <div className="bg-rose-50 font-sans text-slate-800">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-5">
        <div className="hidden items-center justify-between gap-3 py-2.5 md:flex">
          <div className="flex flex-wrap items-center gap-2 text-sm md:gap-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white/90 px-3 py-1 text-slate-700 shadow-[0_1px_0_rgba(255,255,255,0.7)]">
              <Truck size={16} className="text-rose-600" />
              {DELIVERY_TEXT}
            </span>
          </div>

          <div className="flex items-center justify-end gap-4 lg:gap-5">
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
              <Link href="/about" className="transition hover:text-slate-900">
                About
              </Link>
              <Link href="/faq" className="transition hover:text-slate-900">
                FAQ
              </Link>
              <Link href="/blog" className="transition hover:text-slate-900">
                Blog
              </Link>
            </div>

            <div className="hidden h-6 w-px bg-rose-200 lg:block" />

            <div className="flex items-center gap-2">
              {topBarSocials.length === 0 ? (
                <>
                  <span className="hidden text-xs text-slate-400 sm:block">
                    Follow:
                  </span>
                  <a
                    href="#"
                    title="Social links not set"
                    onClick={(e) => e.preventDefault()}
                    className="cursor-not-allowed rounded-full border border-slate-200 bg-slate-100 p-2 text-slate-400 opacity-70"
                    aria-label="Social links not set"
                  >
                    <Instagram size={16} />
                  </a>
                </>
              ) : (
                topBarSocials.map((it) => {
                  const iconKey = it.icon || it.name;
                  const Icon = iconFor(iconKey) || Send;

                  return (
                    <a
                      key={it._id}
                      href={it.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={it.name}
                      aria-label={it.name}
                      className={`rounded-full border p-2 shadow-sm transition duration-200 hover:-translate-y-[1px] hover:shadow-md ${socialButtonClass(
                        iconKey
                      )}`}
                    >
                      <Icon size={16} />
                    </a>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="relative h-10 overflow-hidden md:hidden">
          <div
            className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
              mobileFrame === 0
                ? "translate-y-0 opacity-100"
                : "-translate-y-2 opacity-0 pointer-events-none"
            }`}
            aria-hidden={mobileFrame !== 0}
          >
            <div className="flex w-full items-center justify-center">
              <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-rose-200 bg-white/95 px-3 py-1 text-[12px] font-semibold text-slate-700 shadow-sm">
                <Truck size={14} className="shrink-0 text-rose-600" />
                <span className="truncate">{DELIVERY_TEXT}</span>
                <Sparkles size={12} className="shrink-0 text-amber-500" />
              </span>
            </div>
          </div>

          <div
            className={`absolute inset-0 flex items-center justify-between gap-2 transition-all duration-300 ${
              mobileFrame === 1
                ? "translate-y-0 opacity-100"
                : "translate-y-2 opacity-0 pointer-events-none"
            }`}
            aria-hidden={mobileFrame !== 1}
          >
            <div className="flex min-w-0 items-center gap-3 text-[12px] font-semibold text-slate-600">
              <Link href="/about" className="transition hover:text-slate-900">
                About
              </Link>
              <Link href="/faq" className="transition hover:text-slate-900">
                FAQ
              </Link>
              <Link href="/blog" className="transition hover:text-slate-900">
                Blog
              </Link>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {mobileSocials.length === 0 ? (
                <a
                  href="#"
                  title="Social links not set"
                  onClick={(e) => e.preventDefault()}
                  className="cursor-not-allowed rounded-full border border-slate-200 bg-slate-100 p-1.5 text-slate-400 opacity-70"
                  aria-label="Social links not set"
                >
                  <Instagram size={13} />
                </a>
              ) : (
                mobileSocials.map((it) => {
                  const iconKey = it.icon || it.name;
                  const Icon = iconFor(iconKey) || Send;

                  return (
                    <a
                      key={it._id}
                      href={it.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={it.name}
                      aria-label={it.name}
                      className={`rounded-full border p-1.5 shadow-sm transition duration-200 ${socialButtonClass(
                        iconKey
                      )}`}
                    >
                      <Icon size={13} />
                    </a>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}