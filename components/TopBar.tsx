"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Instagram,
  Youtube,
  Facebook,
  Twitter,
  Send,
  PhoneCall,
  Truck,
} from "lucide-react";

type SocialItem = {
  _id: string;
  name: string;
  url: string;
  icon?: string;
  isActive: boolean;
  sortOrder: number;
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function iconFor(key: string) {
  const k = safeStr(key).toLowerCase();
  if (k.includes("instagram")) return Instagram;
  if (k.includes("youtube")) return Youtube;
  if (k.includes("facebook")) return Facebook;
  if (k.includes("twitter") || k.includes("x")) return Twitter;
  if (k.includes("telegram")) return Send;
  return null;
}

async function fetchSocialLinks(): Promise<SocialItem[]> {
  try {
    const res = await fetch("/api/site-settings/social-links", { cache: "no-store" });
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

  // ✅ TopBar rule: all active EXCEPT WhatsApp
  const topBarSocials = useMemo(() => {
    return items
      .filter((it) => {
        const n = safeStr(it.name).toLowerCase();
        const ic = safeStr(it.icon).toLowerCase();
        const u = safeStr(it.url).toLowerCase();
        const isWhatsapp =
          n.includes("whatsapp") || ic.includes("whatsapp") || u.includes("wa.me");
        return !isWhatsapp;
      })
      .slice(0, 5);
  }, [items]);

  return (
    // ✅ Static light pink background + ✅ remove bottom line (no border)
    <div className="bg-rose-50 text-slate-800 font-sans">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-5 py-2.5 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        {/* Left: Info */}
        <div className="flex flex-wrap items-center gap-2 md:gap-4 text-sm">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 border border-rose-200 text-slate-700">
            <Truck size={16} className="text-slate-600" />
            Same Day Delivery in Delhi
          </span>

          <a
            href="tel:7496865680"
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 border border-blue-200 text-blue-700 font-bold hover:bg-white transition"
            title="Call Support"
          >
            <PhoneCall size={16} />
            7496865680
          </a>
        </div>

        {/* Right: Links + Social */}
        <div className="flex items-center justify-between md:justify-end gap-3 md:gap-5">
          <div className="flex gap-3 text-sm font-semibold text-slate-600">
            <Link href="/about" className="hover:text-slate-900 transition">
              About
            </Link>
            <Link href="/faq" className="hover:text-slate-900 transition">
              FAQ
            </Link>
            <Link href="/blog" className="hover:text-slate-900 transition">
              Blog
            </Link>
          </div>

          <div className="h-6 w-px bg-rose-200 hidden md:block" />

          <div className="flex items-center gap-2">
            {topBarSocials.length === 0 ? (
              <>
                <span className="text-xs text-slate-400 hidden sm:block">Follow:</span>
                <a
                  href="#"
                  className="bg-slate-900 text-white p-2 rounded-full opacity-60 cursor-not-allowed"
                  title="Social links not set"
                  onClick={(e) => e.preventDefault()}
                >
                  <Instagram size={16} />
                </a>
              </>
            ) : (
              topBarSocials.map((it) => {
                const Icon = iconFor(it.icon || it.name) || Send;
                return (
                  <a
                    key={it._id}
                    href={it.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full bg-white/80 border border-rose-200 hover:bg-white hover:shadow-sm transition"
                    title={it.name}
                  >
                    <Icon size={16} className="text-slate-700" />
                  </a>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
