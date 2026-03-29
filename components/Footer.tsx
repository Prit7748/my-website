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

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function iconFor(key: string) {
  const k = safeStr(key).toLowerCase();
  if (k.includes("facebook")) return Facebook;
  if (k.includes("instagram")) return Instagram;
  if (k.includes("twitter") || k.includes("x")) return Twitter;
  if (k.includes("youtube")) return Youtube;
  if (k.includes("telegram")) return Send;
  if (k.includes("whatsapp") || k.includes("wa.me")) return Send;
  return Send;
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

  const footerSocials = useMemo(() => socials.slice(0, 8), [socials]);

  return (
    <footer className="bg-gradient-to-b from-slate-950 via-[#0d1730] to-slate-950 text-slate-300 font-sans">
      {/* Top Section: Newsletter */}
      <div className="border-b border-white/10 bg-white/[0.02] backdrop-blur-sm">
        <div className="max-w-[1600px] mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <h3 className="text-white text-lg font-bold tracking-tight">
              Join our IGNOU Community
            </h3>
            <p className="text-sm text-slate-400">
              Get exam tips, updates and special offers.
            </p>
          </div>

          <div className="flex w-full md:w-auto gap-2">
            <input
              type="email"
              placeholder="Enter your email"
              className="bg-white/5 border border-white/10 text-white px-4 py-2.5 rounded-lg outline-none focus:border-blue-500 focus:bg-white/[0.07] w-full md:w-64 transition"
            />
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold transition flex items-center gap-2 shadow-lg shadow-blue-950/30">
              Subscribe <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="max-w-[1600px] mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Column 1: About & Social */}
          <div className="space-y-6">
            <div className="inline-flex flex-col">
              <h2 className="text-white text-2xl md:text-[28px] font-extrabold tracking-[0.02em] leading-none">
                I <span className="text-blue-400">Students</span> Portal
              </h2>
              <span className="mt-2 h-[3px] w-16 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" />
            </div>

            <p className="text-sm leading-relaxed text-slate-400 max-w-sm">
              Your one-stop destination for IGNOU solved assignments, handwritten
              notes, and projects help. We ensure 90+ marks quality content created
              by toppers.
            </p>

            <div className="flex gap-3 pt-2 flex-wrap">
              {footerSocials.length === 0 ? (
                <a
                  href="#"
                  className="bg-white/5 border border-white/10 p-2.5 rounded-full opacity-60 cursor-not-allowed"
                  onClick={(e) => e.preventDefault()}
                  title="Social links not set"
                >
                  <Send size={18} />
                </a>
              ) : (
                footerSocials.map((it) => {
                  const Icon = iconFor(it.icon || it.name);
                  return (
                    <a
                      key={it._id}
                      href={it.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-white/5 border border-white/10 p-2.5 rounded-full hover:bg-white/10 hover:text-white hover:border-white/20 transition"
                      title={it.name}
                    >
                      <Icon size={18} />
                    </a>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h3 className="text-white font-bold text-lg mb-6 relative inline-block tracking-tight">
              Quick Links
              <span className="absolute bottom-0 left-0 w-1/2 h-0.5 bg-blue-500 -mb-2 rounded-full"></span>
            </h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/" className="hover:text-blue-400 flex items-center gap-2 transition">
                  <ChevronRight size={14} /> Home
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-blue-400 flex items-center gap-2 transition">
                  <ChevronRight size={14} /> About Us
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-blue-400 flex items-center gap-2 transition">
                  <ChevronRight size={14} /> Blog / Updates
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-blue-400 flex items-center gap-2 transition">
                  <ChevronRight size={14} /> Contact Support
                </Link>
              </li>
              <li>
                <Link href="/solved-assignments" className="hover:text-blue-400 flex items-center gap-2 transition">
                  <ChevronRight size={14} /> Buy Assignments
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Policies */}
          <div>
            <h3 className="text-white font-bold text-lg mb-6 relative inline-block tracking-tight">
              Policy Info
              <span className="absolute bottom-0 left-0 w-1/2 h-0.5 bg-blue-500 -mb-2 rounded-full"></span>
            </h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/privacy" className="hover:text-blue-400 flex items-center gap-2 transition">
                  <ChevronRight size={14} /> Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-blue-400 flex items-center gap-2 transition">
                  <ChevronRight size={14} /> Terms & Conditions
                </Link>
              </li>
              <li>
                <Link href="/refund-policy" className="hover:text-blue-400 flex items-center gap-2 transition">
                  <ChevronRight size={14} /> Refund Policy
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-blue-400 flex items-center gap-2 transition">
                  <ChevronRight size={14} /> Help & FAQs
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact Info */}
          <div>
            <h3 className="text-white font-bold text-lg mb-6 relative inline-block tracking-tight">
              Get In Touch
              <span className="absolute bottom-0 left-0 w-1/2 h-0.5 bg-blue-500 -mb-2 rounded-full"></span>
            </h3>
            <ul className="space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <MapPin className="text-blue-400 mt-1 flex-shrink-0" size={18} />
                <span>
                  Old Police Colony, Hansi Road, Near PS Sadar,
                  <br />
                  Bhiwani - 127021
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="text-blue-400 flex-shrink-0" size={18} />
                <span>+91 7496865680</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="text-blue-400 flex-shrink-0" size={18} />
                <span>support@istudentsportal.com</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10 bg-black/20 py-6">
        <div className="max-w-[1600px] mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>&copy; {new Date().getFullYear()} IGNOU Students Portal. All Rights Reserved.</p>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400">We Accept:</span>
            <div className="flex gap-1 opacity-80 grayscale hover:grayscale-0 transition">
              <div className="bg-white text-slate-900 px-2 py-1 rounded font-bold text-[10px]">UPI</div>
              <div className="bg-white text-slate-900 px-2 py-1 rounded font-bold text-[10px]">VISA</div>
              <div className="bg-white text-slate-900 px-2 py-1 rounded font-bold text-[10px]">RuPay</div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}