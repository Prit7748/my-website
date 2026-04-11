"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  Send,
  MapPin,
  Mail,
  Phone,
  ChevronRight,
} from "lucide-react";

type SocialItem = {
  _id: string;
  name: string;
  url: string;
  icon?: string;
  isActive: boolean;
  sortOrder: number;
};

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function socialType(key: string) {
  const k = safeStr(key).toLowerCase();

  if (k.includes("facebook")) return "facebook";
  if (k.includes("instagram")) return "instagram";
  if (k.includes("twitter") || k.includes("x")) return "twitter";
  if (k.includes("youtube")) return "youtube";
  if (k.includes("telegram")) return "telegram";
  if (k.includes("whatsapp") || k.includes("wa.me")) return "whatsapp";

  return "default";
}

function SocialIcon({
  type,
  size = 18,
  className = "",
}: {
  type: string;
  size?: number;
  className?: string;
}) {
  if (type === "facebook") return <Facebook size={size} className={className} />;
  if (type === "instagram") return <Instagram size={size} className={className} />;
  if (type === "twitter") return <Twitter size={size} className={className} />;
  if (type === "youtube") return <Youtube size={size} className={className} />;
  if (type === "telegram") return <Send size={size} className={className} />;

  if (type === "whatsapp") {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        aria-hidden="true"
        className={className}
        fill="currentColor"
      >
        <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.52 0 .18 5.34.18 11.88c0 2.1.54 4.14 1.62 5.94L0 24l6.42-1.68a11.8 11.8 0 0 0 5.64 1.44h.06c6.54 0 11.88-5.34 11.88-11.88 0-3.18-1.26-6.18-3.48-8.4ZM12.12 21.72h-.06a9.8 9.8 0 0 1-4.98-1.38l-.36-.18-3.78.96 1.02-3.66-.24-.36a9.82 9.82 0 0 1-1.56-5.22c0-5.46 4.44-9.9 9.9-9.9 2.64 0 5.1 1.02 6.96 2.88a9.78 9.78 0 0 1 2.88 6.96c0 5.46-4.44 9.9-9.9 9.9Zm5.4-7.38c-.3-.15-1.74-.84-2.04-.96-.24-.09-.42-.15-.6.15-.18.3-.69.96-.84 1.14-.15.18-.33.21-.63.06-.3-.15-1.26-.45-2.4-1.44a8.93 8.93 0 0 1-1.65-2.04c-.18-.3-.03-.45.12-.6.12-.12.3-.33.45-.48.15-.18.21-.3.3-.48.09-.18.03-.36-.03-.51-.06-.15-.6-1.47-.84-2.01-.21-.54-.45-.45-.6-.45h-.51c-.18 0-.45.06-.69.33-.24.27-.9.9-.9 2.19 0 1.29.93 2.52 1.05 2.7.15.18 1.83 2.79 4.41 3.9.63.27 1.11.42 1.47.54.63.18 1.2.15 1.65.09.51-.09 1.53-.63 1.74-1.23.21-.6.21-1.11.15-1.23-.06-.09-.24-.15-.54-.3Z" />
      </svg>
    );
  }

  return <Send size={size} className={className} />;
}

function socialButtonClass(type: string) {
  if (type === "instagram") {
    return "border-fuchsia-300/60 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.35),transparent_35%),linear-gradient(135deg,rgba(244,114,182,0.22),rgba(251,146,60,0.2))] text-pink-200 hover:text-white hover:border-fuchsia-300 hover:shadow-[0_12px_28px_rgba(232,121,249,0.28)]";
  }

  if (type === "youtube") {
    return "border-red-300/50 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.28),transparent_35%),linear-gradient(135deg,rgba(239,68,68,0.22),rgba(248,113,113,0.14))] text-red-200 hover:text-white hover:border-red-300 hover:shadow-[0_12px_28px_rgba(239,68,68,0.28)]";
  }

  if (type === "facebook") {
    return "border-blue-300/50 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.28),transparent_35%),linear-gradient(135deg,rgba(59,130,246,0.22),rgba(96,165,250,0.14))] text-blue-200 hover:text-white hover:border-blue-300 hover:shadow-[0_12px_28px_rgba(59,130,246,0.28)]";
  }

  if (type === "twitter") {
    return "border-slate-300/50 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.22),transparent_35%),linear-gradient(135deg,rgba(148,163,184,0.18),rgba(71,85,105,0.16))] text-slate-100 hover:text-white hover:border-slate-200 hover:shadow-[0_12px_28px_rgba(148,163,184,0.22)]";
  }

  if (type === "telegram") {
    return "border-cyan-300/50 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.28),transparent_35%),linear-gradient(135deg,rgba(34,211,238,0.2),rgba(56,189,248,0.14))] text-cyan-200 hover:text-white hover:border-cyan-300 hover:shadow-[0_12px_28px_rgba(34,211,238,0.24)]";
  }

  if (type === "whatsapp") {
    return "border-emerald-300/50 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.32),transparent_35%),linear-gradient(135deg,rgba(34,197,94,0.24),rgba(74,222,128,0.14))] text-emerald-200 hover:text-white hover:border-emerald-300 hover:shadow-[0_12px_28px_rgba(34,197,94,0.28)]";
  }

  return "border-white/15 bg-white/5 text-slate-200 hover:text-white hover:border-white/25 hover:bg-white/10 hover:shadow-[0_12px_28px_rgba(148,163,184,0.16)]";
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

export default function Footer() {
  const [socials, setSocials] = useState<SocialItem[]>([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      const list = await fetchSocialLinks();
      if (!alive) return;
      setSocials(list);
    })();

    return () => {
      alive = false;
    };
  }, []);

  const footerSocials = useMemo(() => {
    return [...socials]
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
      .slice(0, 8);
  }, [socials]);

  return (
    <footer className="bg-gradient-to-b from-slate-950 via-[#0d1730] to-slate-950 font-sans text-slate-300">
      <div className="border-b border-white/10 bg-white/[0.02] backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-4 px-4 py-8 md:flex-row">
          <div className="text-center md:text-left">
            <h3 className="text-lg font-bold tracking-tight text-white">
              Join our IGNOU Community
            </h3>
            <p className="text-sm text-slate-400">
              Get exam tips, updates and special offers.
            </p>
          </div>

          <div className="flex w-full gap-2 md:w-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:bg-white/[0.07] md:w-64"
            />
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 font-bold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-700"
            >
              Subscribe <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-4 py-16">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-6">
            <div className="inline-flex flex-col">
              <h2 className="text-2xl font-extrabold leading-none tracking-[0.02em] text-white md:text-[28px]">
                I <span className="text-blue-400">Students</span> Portal
              </h2>
              <span className="mt-2 h-[3px] w-16 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" />
            </div>

            <p className="max-w-sm text-sm leading-relaxed text-slate-400">
              Your one-stop destination for IGNOU solved assignments, handwritten
              notes, and projects help. We ensure 90+ marks quality content created
              by toppers.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              {footerSocials.length === 0 ? (
                <a
                  href="#"
                  title="Social links not set"
                  aria-label="Social links not set"
                  onClick={(e) => e.preventDefault()}
                  className="cursor-not-allowed rounded-full border border-white/10 bg-white/5 p-2.5 opacity-60"
                >
                  <Send size={18} />
                </a>
              ) : (
                footerSocials.map((it) => {
                  const type = socialType(it.icon || it.name);

                  return (
                    <a
                      key={it._id}
                      href={it.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={it.name}
                      aria-label={it.name}
                      className={`group rounded-full border p-2.5 backdrop-blur-sm transition-all duration-200 hover:-translate-y-[2px] ${socialButtonClass(
                        type
                      )}`}
                    >
                      <SocialIcon
                        type={type}
                        size={18}
                        className="transition-transform duration-200 group-hover:scale-110"
                      />
                    </a>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <h3 className="relative mb-6 inline-block text-lg font-bold tracking-tight text-white">
              Quick Links
              <span className="absolute bottom-0 left-0 -mb-2 h-0.5 w-1/2 rounded-full bg-blue-500" />
            </h3>

            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/" className="flex items-center gap-2 transition hover:text-blue-400">
                  <ChevronRight size={14} /> Home
                </Link>
              </li>
              <li>
                <Link href="/about" className="flex items-center gap-2 transition hover:text-blue-400">
                  <ChevronRight size={14} /> About Us
                </Link>
              </li>
              <li>
                <Link href="/blog" className="flex items-center gap-2 transition hover:text-blue-400">
                  <ChevronRight size={14} /> Blog / Updates
                </Link>
              </li>
              <li>
                <Link href="/contact" className="flex items-center gap-2 transition hover:text-blue-400">
                  <ChevronRight size={14} /> Contact Support
                </Link>
              </li>
              <li>
                <Link
                  href="/solved-assignments"
                  className="flex items-center gap-2 transition hover:text-blue-400"
                >
                  <ChevronRight size={14} /> Buy Assignments
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="relative mb-6 inline-block text-lg font-bold tracking-tight text-white">
              Policy Info
              <span className="absolute bottom-0 left-0 -mb-2 h-0.5 w-1/2 rounded-full bg-blue-500" />
            </h3>

            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/privacy" className="flex items-center gap-2 transition hover:text-blue-400">
                  <ChevronRight size={14} /> Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="flex items-center gap-2 transition hover:text-blue-400">
                  <ChevronRight size={14} /> Terms & Conditions
                </Link>
              </li>
              <li>
                <Link
                  href="/refund-policy"
                  className="flex items-center gap-2 transition hover:text-blue-400"
                >
                  <ChevronRight size={14} /> Refund Policy
                </Link>
              </li>
              <li>
                <Link href="/faq" className="flex items-center gap-2 transition hover:text-blue-400">
                  <ChevronRight size={14} /> Help & FAQs
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="relative mb-6 inline-block text-lg font-bold tracking-tight text-white">
              Get In Touch
              <span className="absolute bottom-0 left-0 -mb-2 h-0.5 w-1/2 rounded-full bg-blue-500" />
            </h3>

            <ul className="space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <MapPin className="mt-1 flex-shrink-0 text-blue-400" size={18} />
                <span>
                  Old Police Colony, Hansi Road, Near PS Sadar,
                  <br />
                  Bhiwani - 127021
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="flex-shrink-0 text-blue-400" size={18} />
                <span>+91 7496865680</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="flex-shrink-0 text-blue-400" size={18} />
                <span>support@istudentsportal.com</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-black/20 py-6">
        <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-4 px-4 text-xs text-slate-500 md:flex-row">
          <p>
            &copy; {new Date().getFullYear()} IGNOU Students Portal. All Rights Reserved.
          </p>

          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400">We Accept:</span>
            <div className="flex gap-1 opacity-80 transition hover:grayscale-0">
              <div className="rounded bg-white px-2 py-1 text-[10px] font-bold text-slate-900">
                UPI
              </div>
              <div className="rounded bg-white px-2 py-1 text-[10px] font-bold text-slate-900">
                VISA
              </div>
              <div className="rounded bg-white px-2 py-1 text-[10px] font-bold text-slate-900">
                RuPay
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}