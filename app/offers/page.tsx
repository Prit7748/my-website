import Link from "next/link";
import {
  BadgePercent,
  ChevronRight,
  Clock3,
  Sparkles,
  Tags,
} from "lucide-react";
import TopBar from "@/components/TopBar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import dbConnect from "@/lib/db";
import OfferEntry from "@/models/OfferEntry";

export const revalidate = 300;

export const metadata = {
  title: "Special Offers | IGNOU Students Portal",
  description:
    "Check the latest special offers, promo codes, and limited-time deals on IGNOU study material.",
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function variantClasses(variant?: string) {
  const v = safeStr(variant).toLowerCase();

  if (v === "emerald") {
    return {
      wrap: "from-emerald-700 via-emerald-600 to-lime-500",
      chip: "bg-emerald-100 text-emerald-800 border-emerald-200",
      light: "bg-emerald-50 border-emerald-100",
      button: "bg-emerald-600 hover:bg-emerald-700",
    };
  }

  if (v === "violet") {
    return {
      wrap: "from-violet-700 via-fuchsia-600 to-pink-500",
      chip: "bg-violet-100 text-violet-800 border-violet-200",
      light: "bg-violet-50 border-violet-100",
      button: "bg-violet-600 hover:bg-violet-700",
    };
  }

  if (v === "amber") {
    return {
      wrap: "from-amber-600 via-orange-500 to-yellow-400",
      chip: "bg-amber-100 text-amber-800 border-amber-200",
      light: "bg-amber-50 border-amber-100",
      button: "bg-amber-600 hover:bg-amber-700",
    };
  }

  if (v === "rose") {
    return {
      wrap: "from-rose-700 via-pink-600 to-fuchsia-500",
      chip: "bg-rose-100 text-rose-800 border-rose-200",
      light: "bg-rose-50 border-rose-100",
      button: "bg-rose-600 hover:bg-rose-700",
    };
  }

  if (v === "slate") {
    return {
      wrap: "from-slate-800 via-slate-700 to-slate-500",
      chip: "bg-slate-100 text-slate-800 border-slate-200",
      light: "bg-slate-50 border-slate-100",
      button: "bg-slate-800 hover:bg-slate-900",
    };
  }

  return {
    wrap: "from-[#0B1B4B] via-[#1E40AF] to-[#06B6D4]",
    chip: "bg-blue-100 text-blue-800 border-blue-200",
    light: "bg-blue-50 border-blue-100",
    button: "bg-blue-600 hover:bg-blue-700",
  };
}

function formatDate(input?: string | Date | null) {
  if (!input) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(input));
  } catch {
    return safeStr(input);
  }
}

async function getLiveOffers() {
  await dbConnect();

  const now = new Date();

  const rows = await OfferEntry.find({
    isActive: true,
    $and: [
      {
        $or: [{ startsAt: null }, { startsAt: { $exists: false } }, { startsAt: { $lte: now } }],
      },
      {
        $or: [{ endsAt: null }, { endsAt: { $exists: false } }, { endsAt: { $gte: now } }],
      },
    ],
  })
    .sort({ isFeatured: -1, sortOrder: 1, createdAt: -1, _id: -1 })
    .lean();

  return Array.isArray(rows) ? rows : [];
}

export default async function OffersPage() {
  const offers = await getLiveOffers();

  return (
    <main className="min-h-screen bg-white">
      <TopBar />
      <Navbar />

      <section className="bg-slate-50 border-b border-gray-100">
        <div className="max-w-[1600px] mx-auto px-4 py-14 md:py-16">
          <div className="rounded-[32px] overflow-hidden border border-slate-200 shadow-xl bg-gradient-to-br from-[#0B1B4B] via-[#1E40AF] to-[#06B6D4] relative">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.16)_1px,transparent_0)] bg-[length:22px_22px]" />
            <div className="absolute -top-16 -left-16 h-52 w-52 rounded-full bg-white/15 blur-3xl" />
            <div className="absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-cyan-200/10 blur-3xl" />

            <div className="relative px-6 py-10 md:px-10 md:py-12 lg:px-12">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/20 px-3 py-1 text-[11px] font-extrabold text-white">
                  <Sparkles size={14} />
                  Live Deals & Promo Codes
                </div>

                <h1 className="mt-4 text-3xl md:text-5xl font-extrabold text-white leading-tight">
                  Special Offers for <span className="text-yellow-300">IGNOU Students</span>
                </h1>

                <p className="mt-4 text-sm md:text-base font-semibold text-white/90 leading-7 max-w-2xl">
                  Explore limited-time discounts, promo codes, and special deal cards for solved assignments,
                  handwritten material, PYQs, ebooks, and more.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/products"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-white text-[#0B1B4B] font-extrabold shadow-lg hover:opacity-95 transition"
                  >
                    Browse Products
                    <ChevronRight size={18} />
                  </Link>

                  <Link
                    href="/combo"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-white/10 border border-white/20 text-white font-extrabold hover:bg-white/15 transition"
                  >
                    Explore Combos
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16 bg-white">
        <div className="max-w-[1600px] mx-auto px-4">
          <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-extrabold text-blue-700">
                <BadgePercent size={14} />
                Active Offers
              </div>
              <h2 className="mt-3 text-3xl font-extrabold text-slate-900">Available Right Now</h2>
              <p className="mt-2 text-sm md:text-base font-medium text-slate-500">
                Use the best available offer according to your cart and eligibility.
              </p>
            </div>

            <div className="text-sm font-bold text-slate-500">
              Total live offers: <span className="text-slate-900">{offers.length}</span>
            </div>
          </div>

          {offers.length === 0 ? (
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-10 text-center">
              <div className="text-2xl font-extrabold text-slate-900">No active offers right now</div>
              <div className="mt-2 text-sm font-semibold text-slate-600">
                Please check again later. New promotions are added regularly.
              </div>

              <div className="mt-6">
                <Link
                  href="/products"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-950 text-white font-extrabold transition"
                >
                  View Products
                  <ChevronRight size={18} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {offers.map((offer: any) => {
                const theme = variantClasses(offer?.bgVariant);
                const ctaHref = safeStr(offer?.ctaHref) || "/products";
                const ctaText = safeStr(offer?.ctaText) || "View Offer";
                const couponCode = safeStr(offer?.couponCode).toUpperCase();

                return (
                  <div
                    key={String(offer?._id)}
                    className="rounded-[28px] overflow-hidden border border-gray-200 shadow-lg bg-white"
                  >
                    <div className={`relative bg-gradient-to-r ${theme.wrap} px-6 py-6 md:px-7 md:py-7`}>
                      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.24)_1px,transparent_0)] bg-[length:20px_20px]" />

                      <div className="relative flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap gap-2 items-center">
                            {safeStr(offer?.badgeText) ? (
                              <span className="inline-flex items-center rounded-full bg-white/15 text-white border border-white/20 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide">
                                {safeStr(offer?.badgeText)}
                              </span>
                            ) : null}

                            {offer?.isFeatured ? (
                              <span className="inline-flex items-center rounded-full bg-yellow-300/20 text-yellow-100 border border-yellow-300/20 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide">
                                Featured
                              </span>
                            ) : null}
                          </div>

                          <h3 className="mt-4 text-2xl md:text-3xl font-extrabold text-white leading-tight">
                            {safeStr(offer?.title)}
                          </h3>

                          {safeStr(offer?.shortText) ? (
                            <p className="mt-3 text-sm md:text-base font-semibold text-white/90 leading-7">
                              {safeStr(offer?.shortText)}
                            </p>
                          ) : null}
                        </div>

                        {couponCode ? (
                          <div className="shrink-0 rounded-2xl bg-white/15 border border-white/20 px-4 py-3 text-right">
                            <div className="text-[11px] uppercase tracking-wide font-extrabold text-white/80">
                              Promo Code
                            </div>
                            <div className="mt-1 text-lg font-extrabold text-white">
                              {couponCode}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="p-6 md:p-7">
                      {Array.isArray(offer?.categoryTags) && offer.categoryTags.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mb-5">
                          {offer.categoryTags.map((tag: string, idx: number) => (
                            <span
                              key={`${String(offer?._id)}-${idx}-${tag}`}
                              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-extrabold ${theme.chip}`}
                            >
                              <Tags size={12} />
                              {safeStr(tag)}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {(offer?.startsAt || offer?.endsAt) ? (
                        <div className={`rounded-2xl border p-4 mb-5 ${theme.light}`}>
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-slate-700 shrink-0">
                              <Clock3 size={18} />
                            </div>

                            <div>
                              <div className="text-sm font-extrabold text-slate-900">
                                Offer validity
                              </div>
                              <div className="mt-1 text-xs font-semibold text-slate-600 leading-6">
                                {offer?.startsAt ? `Starts: ${formatDate(offer.startsAt)}` : "Already active"}
                                <br />
                                {offer?.endsAt ? `Ends: ${formatDate(offer.endsAt)}` : "No fixed expiry"}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="flex flex-col sm:flex-row gap-3">
                        <a
                          href={ctaHref}
                          className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-white font-extrabold transition ${theme.button}`}
                        >
                          {ctaText}
                          <ChevronRight size={18} />
                        </a>

                        {couponCode ? (
                          <a
                            href={`/checkout?coupon=${encodeURIComponent(couponCode)}`}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-white border border-gray-200 text-slate-900 font-extrabold hover:bg-gray-50 transition"
                          >
                            Apply Code Directly
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}


