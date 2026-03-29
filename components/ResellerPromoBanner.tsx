"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Wallet,
  BadgePercent,
  ChevronRight,
  ShieldCheck,
  Zap,
} from "lucide-react";

type PublicPlan = {
  code: "basic" | "standard" | "premium";
  name: string;
  price: number;
  isActive: boolean;
  isHighlighted?: boolean;
  badge?: string;
  accentColor?: string;
  description?: string;
  sortOrder?: number;
};

type PublicBanner = {
  isActive: boolean;
  title: string;
  subtitle: string;
  ctaText: string;
  placement: "home_slider_below" | "combo_area" | "both";
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function planPriceLabel(plans: PublicPlan[], code: "basic" | "standard" | "premium") {
  const found = plans.find((p) => p.code === code);
  return `₹${safeNum(found?.price, 0)}`;
}

export default function ResellerPromoBanner() {
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<PublicBanner>({
    isActive: true,
    title: "Special Offers for Sellers",
    subtitle: "Earn more with exclusive reseller discounts and wallet benefits.",
    ctaText: "Activate Seller Wallet",
    placement: "home_slider_below",
  });
  const [plans, setPlans] = useState<PublicPlan[]>([]);

  useEffect(() => {
    let alive = true;

    async function loadConfig() {
      try {
        const res = await fetch("/api/reseller-config", {
          method: "GET",
          cache: "no-store",
        });

        const data = await res.json().catch(() => ({}));
        if (!alive || !res.ok) return;

        setBanner(data?.config?.banner || banner);
        setPlans(Array.isArray(data?.config?.plans) ? data.config.plans : []);
      } catch {
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadConfig();

    return () => {
      alive = false;
    };
  }, []);

  const activePlans = useMemo(
    () =>
      (Array.isArray(plans) ? plans : [])
        .filter((p) => Boolean(p?.isActive))
        .sort((a, b) => safeNum(a?.sortOrder, 0) - safeNum(b?.sortOrder, 0)),
    [plans]
  );

  if (!loading && (!banner?.isActive || activePlans.length === 0)) {
    return null;
  }

  return (
    <section className="bg-white border-b border-gray-100">
      <div className="max-w-[1600px] mx-auto px-4 py-6 md:py-8">
        <Link
          href="/wallet"
          className="group relative block overflow-hidden rounded-[28px] border border-violet-200 shadow-xl bg-gradient-to-r from-[#0F172A] via-[#312E81] to-[#7C3AED]"
          aria-label="Open Seller Wallet Plans"
        >
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,white_0,transparent_28%),radial-gradient(circle_at_80%_30%,white_0,transparent_20%),radial-gradient(circle_at_50%_90%,white_0,transparent_22%)]" />
          <div className="absolute -top-16 -left-10 h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl seller-float" />
          <div className="absolute -bottom-16 right-0 h-48 w-48 rounded-full bg-fuchsia-400/20 blur-3xl seller-float-delayed" />

          <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-6 items-center p-6 md:p-8 lg:p-10">
            <div className="lg:col-span-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] md:text-xs font-extrabold text-white seller-pulse">
                <Sparkles size={14} />
                {safeStr(banner?.title || "Special Offers for Sellers")}
              </div>

              <h2 className="mt-4 text-2xl md:text-4xl font-black text-white leading-tight">
                Earn More with
                <span className="bg-gradient-to-r from-yellow-300 via-orange-300 to-pink-300 bg-clip-text text-transparent seller-zoom inline-block ml-2">
                  Exclusive Reseller Discounts
                </span>
              </h2>

              <p className="mt-3 max-w-3xl text-sm md:text-base font-semibold text-white/85 leading-relaxed">
                {safeStr(
                  banner?.subtitle ||
                    "Activate your seller wallet to unlock category-based discounts, wallet deduction on low-price items, premium reseller identity, and future bulk buying benefits."
                )}
              </p>

              <div className="mt-5 flex flex-wrap gap-2 md:gap-3">
                <div className="inline-flex items-center gap-2 rounded-2xl bg-white/10 border border-white/15 px-3 py-2 text-xs md:text-sm font-extrabold text-white">
                  <Wallet size={16} className="text-cyan-200" />
                  Wallet Recharge Plans
                </div>
                <div className="inline-flex items-center gap-2 rounded-2xl bg-white/10 border border-white/15 px-3 py-2 text-xs md:text-sm font-extrabold text-white">
                  <BadgePercent size={16} className="text-yellow-300" />
                  10% / 15% / 20% Benefits
                </div>
                <div className="inline-flex items-center gap-2 rounded-2xl bg-white/10 border border-white/15 px-3 py-2 text-xs md:text-sm font-extrabold text-white">
                  <ShieldCheck size={16} className="text-emerald-300" />
                  Reseller Benefits Activated
                </div>
              </div>

              <div className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white text-slate-900 px-5 py-3 font-extrabold shadow-lg group-hover:translate-x-1 transition">
                {safeStr(banner?.ctaText || "Open Seller Wallet Page")}
                <ChevronRight size={18} />
              </div>
            </div>

            <div className="lg:col-span-4">
              <div className="rounded-[26px] border border-white/15 bg-white/10 backdrop-blur-sm p-5 md:p-6 shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-white/15 border border-white/15 flex items-center justify-center text-white">
                    <Zap size={24} />
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-white">
                      Seller Quick Preview
                    </div>
                    <div className="text-xs font-semibold text-white/75">
                      Live plan prices from admin settings
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-white/15 bg-black/15 px-4 py-3 text-sm font-bold text-white/90">
                    Basic Plan • {planPriceLabel(activePlans, "basic")}
                  </div>
                  <div className="rounded-2xl border border-white/15 bg-black/15 px-4 py-3 text-sm font-bold text-white/90">
                    Standard Plan • {planPriceLabel(activePlans, "standard")}
                  </div>
                  <div className="rounded-2xl border border-white/15 bg-black/15 px-4 py-3 text-sm font-bold text-white/90">
                    Premium Plan • {planPriceLabel(activePlans, "premium")}
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-xs font-bold text-cyan-100">
                  Prices and seller banner text now follow admin-controlled reseller settings.
                </div>
              </div>
            </div>
          </div>

          <style jsx>{`
            .seller-pulse {
              animation: sellerPulse 2.4s ease-in-out infinite;
            }
            .seller-zoom {
              animation: sellerZoom 3s ease-in-out infinite;
            }
            .seller-float {
              animation: sellerFloat 7s ease-in-out infinite;
            }
            .seller-float-delayed {
              animation: sellerFloat 8.5s ease-in-out infinite;
            }

            @keyframes sellerPulse {
              0%, 100% {
                transform: scale(1);
                box-shadow: 0 0 0 0 rgba(255,255,255,0.12);
              }
              50% {
                transform: scale(1.02);
                box-shadow: 0 0 0 10px rgba(255,255,255,0);
              }
            }

            @keyframes sellerZoom {
              0%, 100% {
                transform: scale(1);
              }
              50% {
                transform: scale(1.03);
              }
            }

            @keyframes sellerFloat {
              0%, 100% {
                transform: translateY(0px);
              }
              50% {
                transform: translateY(-10px);
              }
            }
          `}</style>
        </Link>
      </div>
    </section>
  );
}