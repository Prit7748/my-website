// app/wallet/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Wallet,
  Sparkles,
  ShieldCheck,
  Crown,
  Gem,
  Coins,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  Lock,
  Loader2,
  FileText,
} from "lucide-react";
import TopBar from "@/components/TopBar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getResellerPlanTheme } from "@/lib/reseller";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

type MeUser = {
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
  reseller?: {
    isReseller?: boolean;
    status?: string;
    planCode?: "" | "basic" | "standard" | "premium";
    planName?: string;
    walletBalance?: number;
    walletTotalRecharged?: number;
    walletTotalUsed?: number;
    walletTotalDiscountSaved?: number;
  };
};

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

type WalletPageContent = {
  isActive: boolean;
  badgeText: string;
  sectionTitle: string;
  sectionSubtitle: string;
  processTitle: string;
  processSteps: string[];
  benefitsTitle: string;
  benefits: string[];
  activationTitle: string;
  activationPoints: string[];
  notesTitle: string;
  notes: string[];
  ctaNote: string;
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function safeList(input: any, fallback: string[] = []) {
  const raw = Array.isArray(input) ? input : fallback;
  return Array.from(
    new Set(
      raw
        .map((x: any) => safeStr(x))
        .filter(Boolean)
    )
  );
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function getIconForPlan(code: string) {
  const c = safeStr(code).toLowerCase();
  if (c === "basic") return Coins;
  if (c === "standard") return ShieldCheck;
  return Crown;
}

function getFallbackPlans(): PublicPlan[] {
  return [
    {
      code: "basic",
      name: "Basic",
      badge: "Bronze",
      price: 999,
      isActive: true,
      isHighlighted: false,
      accentColor: "green",
      description: "Entry reseller plan",
      sortOrder: 1,
    },
    {
      code: "standard",
      name: "Standard",
      badge: "Silver",
      price: 1499,
      isActive: true,
      isHighlighted: true,
      accentColor: "orange",
      description: "Most recommended reseller plan",
      sortOrder: 2,
    },
    {
      code: "premium",
      name: "Premium",
      badge: "Gold",
      price: 1999,
      isActive: true,
      isHighlighted: false,
      accentColor: "violet",
      description: "Maximum reseller benefits",
      sortOrder: 3,
    },
  ];
}

function getFallbackWalletPageContent(): WalletPageContent {
  return {
    isActive: true,
    badgeText: "Seller Wallet Guide",
    sectionTitle: "How IGNOU Seller Wallet Recharge Works",
    sectionSubtitle:
      "Understand the seller wallet recharge process, wallet benefits, activation flow, and important usage rules before you recharge your seller account.",
    processTitle: "Seller wallet recharge process",
    processSteps: [
      "Choose the seller plan that matches your business requirement and click the activate or recharge button.",
      "Complete the secure payment through Razorpay using UPI, card, net banking, or other available methods.",
      "After successful payment verification, your seller plan and wallet balance are updated on your account automatically.",
      "Eligible categories start using seller benefits according to the rules configured by the admin panel.",
    ],
    benefitsTitle: "Benefits after wallet recharge",
    benefits: [
      "Seller users can access category-based wallet deduction and discount benefits where enabled by admin rules.",
      "Wallet dashboard starts showing recharge history, available balance, total used amount, and seller savings.",
      "Active seller plan identity becomes visible in the user dashboard and related seller sections.",
      "The website can apply wallet-supported seller pricing on selected categories during checkout.",
    ],
    activationTitle: "What changes after recharge",
    activationPoints: [
      "Your account can move from normal user status to active seller status after successful recharge verification.",
      "Selected seller plan benefits become available according to the current reseller configuration.",
      "Future eligible orders can use wallet balance, discount-only rules, or both based on admin settings.",
      "Seller-specific tracking values such as wallet balance, total recharge, total usage, and saved amount are updated.",
    ],
    notesTitle: "Important notes for sellers",
    notes: [
      "Wallet benefits apply only on categories and plans that are active in admin reseller settings.",
      "Some categories may be excluded, discount-only, or wallet-deduction enabled depending on business rules.",
      "If any payment is deducted but seller activation does not update automatically, admin can verify and update the account manually.",
      "Recharge amount, usage logic, and seller visibility can be changed later from the backend without coding changes.",
    ],
    ctaNote:
      "Read the full seller process carefully before recharge so you understand activation, benefits, deductions, and future plan usage clearly.",
  };
}

function getPerksByPlan(code: string) {
  const c = safeStr(code).toLowerCase();

  if (c === "basic") {
    return [
      "Solved Assignments / PYQs par wallet usage",
      "High-price categories par limited discount eligibility",
      "Seller identity unlocked",
    ];
  }

  if (c === "standard") {
    return [
      "More discount access than Basic",
      "Highlighted seller plan UI",
      "Better category-level benefit scaling",
    ];
  }

  return [
    "Best discount percentage",
    "Premium seller identity + strongest visual signal",
    "Maximum benefit access for future scaling",
  ];
}

function getCardClass(code: string, isHighlighted?: boolean) {
  const c = safeStr(code).toLowerCase();

  if (c === "basic") {
    return "border-green-200 bg-green-50/70 hover:-translate-y-2 hover:shadow-2xl hover:shadow-green-200/50 hover:border-green-300";
  }

  if (c === "standard") {
    return isHighlighted
      ? "border-orange-300 bg-gradient-to-br from-orange-50 to-white ring-2 ring-orange-200 shadow-xl scale-[1.01] lg:scale-[1.04] hover:-translate-y-2 hover:shadow-2xl hover:shadow-orange-200/60 hover:border-orange-400"
      : "border-orange-200 bg-orange-50/70 hover:-translate-y-2 hover:shadow-2xl hover:shadow-orange-200/50 hover:border-orange-300";
  }

  return "border-violet-300 bg-violet-50/80 shadow-lg hover:-translate-y-2 hover:shadow-2xl hover:shadow-violet-200/50 hover:border-violet-400";
}

function getBadgeClass(code: string) {
  const c = safeStr(code).toLowerCase();

  if (c === "basic") return "bg-green-100 text-green-800 border-green-200";
  if (c === "standard") return "bg-orange-100 text-orange-800 border-orange-200";
  return "bg-violet-100 text-violet-800 border-violet-200";
}

export default function WalletPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<MeUser | null>(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [processingPlan, setProcessingPlan] = useState<string>("");

  const [publicBanner, setPublicBanner] = useState<PublicBanner>({
    isActive: true,
    title: "Seller Wallet & Plans",
    subtitle:
      "Activate your reseller plan, credit your seller wallet, and unlock category-based benefits directly from this page.",
    ctaText: "Activate / Recharge",
    placement: "home_slider_below",
  });

  const [publicPlans, setPublicPlans] = useState<PublicPlan[]>(getFallbackPlans());
  const [walletPageContent, setWalletPageContent] = useState<WalletPageContent>(
    getFallbackWalletPageContent()
  );

  async function loadMe() {
    const res = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    if (!res.ok) {
      router.replace(`/login?redirect=${encodeURIComponent("/wallet")}`);
      return;
    }

    const data = await res.json();
    setUser(data?.user || null);
  }

  async function loadPublicConfig() {
    const res = await fetch("/api/reseller-config", {
      method: "GET",
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return;

    if (data?.config?.banner) {
      setPublicBanner(data.config.banner);
    }

    if (Array.isArray(data?.config?.plans) && data.config.plans.length > 0) {
      setPublicPlans(data.config.plans);
    }

    const contentRaw = data?.config?.walletPageContent || {};
    const fallback = getFallbackWalletPageContent();

    setWalletPageContent({
      isActive: Boolean(contentRaw?.isActive ?? true),
      badgeText: safeStr(contentRaw?.badgeText || fallback.badgeText),
      sectionTitle: safeStr(contentRaw?.sectionTitle || fallback.sectionTitle),
      sectionSubtitle: safeStr(contentRaw?.sectionSubtitle || fallback.sectionSubtitle),
      processTitle: safeStr(contentRaw?.processTitle || fallback.processTitle),
      processSteps: safeList(contentRaw?.processSteps, fallback.processSteps),
      benefitsTitle: safeStr(contentRaw?.benefitsTitle || fallback.benefitsTitle),
      benefits: safeList(contentRaw?.benefits, fallback.benefits),
      activationTitle: safeStr(contentRaw?.activationTitle || fallback.activationTitle),
      activationPoints: safeList(contentRaw?.activationPoints, fallback.activationPoints),
      notesTitle: safeStr(contentRaw?.notesTitle || fallback.notesTitle),
      notes: safeList(contentRaw?.notes, fallback.notes),
      ctaNote: safeStr(contentRaw?.ctaNote || fallback.ctaNote),
    });
  }

  useEffect(() => {
    let alive = true;

    async function init() {
      try {
        await Promise.all([loadMe(), loadPublicConfig()]);
      } catch {
        if (!alive) return;
        router.replace(`/login?redirect=${encodeURIComponent("/wallet")}`);
      } finally {
        if (alive) setLoading(false);
      }
    }

    init();

    return () => {
      alive = false;
    };
  }, [router]);

  const reseller = user?.reseller || {};
  const planCode = safeStr(reseller?.planCode).toLowerCase() as
    | ""
    | "basic"
    | "standard"
    | "premium";
  const isActiveSeller =
    Boolean(reseller?.isReseller) &&
    safeStr(reseller?.status).toLowerCase() === "active" &&
    !!planCode;

  const theme = getResellerPlanTheme(planCode);

  const sortedPlans = useMemo(() => {
    return [...publicPlans]
      .filter((p) => Boolean(p?.isActive))
      .sort((a, b) => safeNum(a?.sortOrder, 0) - safeNum(b?.sortOrder, 0));
  }, [publicPlans]);

  const currentPlanPrice = useMemo(() => {
    return sortedPlans.find((p) => p.code === planCode)?.price || 0;
  }, [sortedPlans, planCode]);

  async function handleRecharge(planCode: "basic" | "standard" | "premium") {
    setError("");
    setSuccessMsg("");
    setProcessingPlan(planCode);

    try {
      const createRes = await fetch("/api/wallet/recharge/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planCode }),
      });

      const createData = await createRes.json().catch(() => ({}));

      if (!createRes.ok) {
        setError(createData?.error || "Recharge order create failed");
        return;
      }

      const ok = await loadRazorpayScript();
      if (!ok) {
        setError("Razorpay SDK failed to load. Internet/adblock check karo.");
        return;
      }

      const options = {
        key: safeStr(createData?.keyId),
        amount: safeNum(createData?.amount, 0),
        currency: safeStr(createData?.currency || "INR"),
        name: "IGNOU Students Portal",
        description: `${safeStr(createData?.plan?.name || "Seller")} Wallet Recharge`,
        image: "/logo.png",
        order_id: safeStr(createData?.razorpayOrderId),
        prefill: {
          name: safeStr(user?.name),
          email: safeStr(user?.email),
          contact: safeStr(user?.phone),
        },
        theme: { color: "#7C3AED" },
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch("/api/wallet/recharge/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                razorpay_order_id: response?.razorpay_order_id,
                razorpay_payment_id: response?.razorpay_payment_id,
                razorpay_signature: response?.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json().catch(() => ({}));

            if (!verifyRes.ok) {
              setError(verifyData?.error || "Recharge verification failed");
              return;
            }

            await loadMe();
            await loadPublicConfig();
            setSuccessMsg(
              `${safeStr(createData?.plan?.name || "Seller")} plan activated successfully. Wallet credited.`
            );
            router.refresh();
          } catch {
            setError("Recharge verify request failed");
          }
        },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (e: any) {
      setError(e?.message || "Recharge failed");
    } finally {
      setProcessingPlan("");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <TopBar />
      <Navbar />

      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900">
        <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_20%_20%,white_0,transparent_20%),radial-gradient(circle_at_80%_25%,white_0,transparent_16%),radial-gradient(circle_at_50%_100%,white_0,transparent_18%)]" />
        <div className="absolute -top-20 left-0 h-60 w-60 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl" />

        <div className="relative max-w-[1400px] mx-auto px-4 py-12 md:py-16">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-gradient-to-r from-cyan-400/20 via-violet-400/20 to-fuchsia-400/20 px-4 py-1.5 text-[11px] font-extrabold text-white shadow-lg shadow-cyan-500/10 backdrop-blur-sm">
              <Sparkles size={14} className="text-cyan-200" />
              {safeStr(publicBanner?.title || "Seller Wallet & Plans")}
            </div>

            <h1 className="mt-4 text-3xl md:text-5xl font-black text-white leading-tight">
              Reseller Wallet Recharge
              <span className="text-cyan-300"> Plans</span>
            </h1>

            <p className="mt-4 max-w-3xl text-sm md:text-base font-semibold leading-relaxed text-white/80">
              {safeStr(
                publicBanner?.subtitle ||
                  "Activate your reseller plan, credit your seller wallet, and unlock category-based benefits directly from this page."
              )}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 rounded-2xl bg-white/10 border border-white/15 px-4 py-2 text-sm font-extrabold text-white">
                <Wallet size={16} className="text-cyan-300" />
                Wallet Recharge Live
              </div>
              <div className="inline-flex items-center gap-2 rounded-2xl bg-white/10 border border-white/15 px-4 py-2 text-sm font-extrabold text-white">
                <Gem size={16} className="text-yellow-300" />
                Premium Seller Identity
              </div>
              <div className="inline-flex items-center gap-2 rounded-2xl bg-white/10 border border-white/15 px-4 py-2 text-sm font-extrabold text-white">
                <ShieldCheck size={16} className="text-emerald-300" />
                Category-Based Discounts
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-[1400px] mx-auto px-4 py-10 md:py-12">
        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="text-lg font-bold text-slate-700">Loading wallet data...</div>
          </div>
        ) : (
          <>
            {successMsg ? (
              <div className="mb-6 rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-extrabold text-emerald-800">
                {successMsg}
              </div>
            ) : null}

            {error ? (
              <div className="mb-6 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-extrabold text-red-800">
                {error}
              </div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs uppercase font-extrabold tracking-wide text-slate-500">
                  Current Status
                </div>
                <div className="mt-3">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-extrabold ${
                      isActiveSeller
                        ? theme.capsuleClass
                        : "bg-slate-50 text-slate-700 border-slate-200"
                    }`}
                  >
                    {isActiveSeller ? <CheckCircle2 size={16} /> : <Lock size={16} />}
                    {isActiveSeller ? safeStr(reseller?.planName || "Seller Active") : "Seller Not Active"}
                  </span>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs uppercase font-extrabold tracking-wide text-slate-500">
                  Wallet Balance
                </div>
                <div className="mt-3 text-3xl font-black text-slate-900">
                  ₹{safeNum(reseller?.walletBalance, 0)}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs uppercase font-extrabold tracking-wide text-slate-500">
                  Total Recharge
                </div>
                <div className="mt-3 text-3xl font-black text-slate-900">
                  ₹{safeNum(reseller?.walletTotalRecharged, 0)}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs uppercase font-extrabold tracking-wide text-slate-500">
                  Current Plan Value
                </div>
                <div className="mt-3 text-3xl font-black text-slate-900">
                  ₹{currentPlanPrice}
                </div>
              </div>
            </div>

            <div className="mb-8 rounded-3xl border border-blue-200 bg-blue-50 p-5 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="text-lg font-extrabold text-slate-900">
                    Live seller plan data
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-600">
                    Plan prices, names, and visibility now follow admin reseller settings dynamically.
                  </div>
                </div>

                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-white font-extrabold hover:bg-slate-800 transition"
                >
                  Open Dashboard
                  <ChevronRight size={18} />
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              {sortedPlans.map((plan) => {
                const Icon = getIconForPlan(plan.code);
                const isCurrent = plan.code === planCode;
                const isBusy = processingPlan === plan.code;

                return (
                  <div
                    key={plan.code}
                    className={`group relative rounded-[28px] border p-6 md:p-7 transition-all duration-300 ease-out ${getCardClass(
                      plan.code,
                      plan.isHighlighted
                    )}`}
                  >
                    {plan.isHighlighted ? (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-orange-200 bg-white px-3 py-1 text-[11px] font-extrabold text-orange-700 shadow-sm">
                        Most Recommended
                      </div>
                    ) : null}

                    {isCurrent ? (
                      <div className="absolute top-4 right-4 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-extrabold text-slate-800">
                        Current Plan
                      </div>
                    ) : null}

                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-extrabold ${getBadgeClass(
                            plan.code
                          )}`}
                        >
                          {safeStr(plan.badge || plan.name)}
                        </div>
                        <h2 className="mt-4 text-2xl font-black text-slate-900">
                          {safeStr(plan.name)}
                        </h2>
                      </div>

                      <div className="h-12 w-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-110">
                        <Icon size={22} className="text-slate-800" />
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="text-4xl font-black text-slate-900">
                        ₹{safeNum(plan.price, 0)}
                      </div>
                      <div className="mt-2 text-sm font-extrabold text-emerald-700">
                        Admin-controlled live plan pricing
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-600">
                        {safeStr(plan.description || "Reseller wallet plan")}
                      </div>
                    </div>

                    <div className="mt-6 space-y-3">
                      {getPerksByPlan(plan.code).map((perk) => (
                        <div
                          key={perk}
                          className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 transition-all duration-300 group-hover:bg-white"
                        >
                          <CheckCircle2 size={18} className="mt-0.5 text-emerald-600 shrink-0" />
                          <div className="text-sm font-semibold text-slate-700">
                            {perk}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRecharge(plan.code)}
                      disabled={isBusy}
                      className={`mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 font-extrabold transition-all duration-300 ${
                        isCurrent
                          ? "bg-slate-900 text-white hover:bg-slate-800 hover:shadow-xl"
                          : "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 text-white shadow-lg shadow-violet-300/40 hover:scale-[1.02] hover:shadow-2xl hover:shadow-fuchsia-300/40"
                      } disabled:opacity-70`}
                    >
                      {isBusy ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Processing...
                        </>
                      ) : isCurrent ? (
                        <>
                          Recharge Again
                          <ArrowRight size={18} />
                        </>
                      ) : (
                        <>
                          {safeStr(publicBanner?.ctaText || "Activate / Recharge")}
                          <ArrowRight size={18} />
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {walletPageContent.isActive ? (
              <section className="mt-10 rounded-[28px] border border-slate-200 bg-white p-6 md:p-7 shadow-sm">
                <div className="max-w-4xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-extrabold text-violet-700">
                    <FileText size={14} />
                    {safeStr(walletPageContent.badgeText || "Seller Wallet Guide")}
                  </div>

                  <h2 className="mt-4 text-2xl md:text-3xl font-black text-slate-900">
                    {safeStr(walletPageContent.sectionTitle || "How IGNOU Seller Wallet Recharge Works")}
                  </h2>

                  <p className="mt-3 text-sm md:text-base leading-relaxed font-semibold text-slate-600">
                    {safeStr(
                      walletPageContent.sectionSubtitle ||
                        "Understand the seller wallet recharge process, wallet benefits, activation flow, and important usage rules before you recharge your seller account."
                    )}
                  </p>
                </div>

                <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-5">
                  <InfoListCard
                    title={safeStr(walletPageContent.processTitle || "Seller wallet recharge process")}
                    items={walletPageContent.processSteps}
                  />

                  <InfoListCard
                    title={safeStr(walletPageContent.benefitsTitle || "Benefits after wallet recharge")}
                    items={walletPageContent.benefits}
                  />

                  <InfoListCard
                    title={safeStr(walletPageContent.activationTitle || "What changes after recharge")}
                    items={walletPageContent.activationPoints}
                  />
                </div>

                {walletPageContent.notes?.length ? (
                  <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
                    <div className="text-lg font-extrabold text-slate-900">
                      {safeStr(walletPageContent.notesTitle || "Important notes for sellers")}
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {walletPageContent.notes.map((note) => (
                        <div
                          key={note}
                          className="rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                        >
                          {note}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {safeStr(walletPageContent.ctaNote) ? (
                  <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-900">
                    {safeStr(walletPageContent.ctaNote)}
                  </div>
                ) : null}
              </section>
            ) : null}
          </>
        )}
      </section>

      <Footer />
    </main>
  );
}

function InfoListCard({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="text-lg font-extrabold text-slate-900">{title}</div>

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div
            key={item}
            className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
          >
            <CheckCircle2 size={18} className="mt-0.5 text-emerald-600 shrink-0" />
            <div className="text-sm font-semibold text-slate-700">{item}</div>
          </div>
        ))}
      </div>
    </div>
  );
}