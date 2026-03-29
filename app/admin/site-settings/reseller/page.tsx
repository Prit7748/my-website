"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Loader2,
  Wallet,
  Sparkles,
  ShieldCheck,
  Crown,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileText,
} from "lucide-react";

type PlanCode = "basic" | "standard" | "premium";

type PlanRow = {
  code: PlanCode;
  name: string;
  price: number;
  isActive: boolean;
  isHighlighted: boolean;
  badge: string;
  accentColor: string;
  description: string;
  sortOrder: number;
};

type BenefitRow = {
  planCode: PlanCode;
  discountPercent: number;
  discountProductLimit: number;
  walletDeductionEnabled: boolean;
};

type CategoryRule = {
  categoryKey: string;
  categoryLabel: string;
  isActive: boolean;
  benefitMode: "wallet_deduction" | "discount_only" | "excluded";
  sortOrder: number;
  planBenefits: BenefitRow[];
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

type ResellerConfigState = {
  isActive: boolean;
  banner: {
    isActive: boolean;
    title: string;
    subtitle: string;
    ctaText: string;
    placement: "home_slider_below" | "combo_area" | "both";
  };
  plans: PlanRow[];
  categoryRules: CategoryRule[];
  walletPageContent: WalletPageContent;
};

type Stats = {
  activeSellerCount: number;
  pausedSellerCount: number;
  blockedSellerCount: number;
  totalWalletBalance: number;
  totalWalletUsed: number;
  totalDiscountSaved: number;
  totalRechargeAmount: number;
  totalPaidRecharges: number;
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function listToTextarea(input: any) {
  return Array.isArray(input) ? input.map((x) => safeStr(x)).filter(Boolean).join("\n") : "";
}

function textareaToList(input: string) {
  return Array.from(
    new Set(
      safeStr(input)
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean)
    )
  );
}

function defaultBenefit(planCode: PlanCode): BenefitRow {
  return {
    planCode,
    discountPercent: 0,
    discountProductLimit: 0,
    walletDeductionEnabled: false,
  };
}

function createEmptyRule(nextIndex: number): CategoryRule {
  return {
    categoryKey: `New Category ${nextIndex}`,
    categoryLabel: `New Category ${nextIndex}`,
    isActive: true,
    benefitMode: "excluded",
    sortOrder: nextIndex,
    planBenefits: [
      defaultBenefit("basic"),
      defaultBenefit("standard"),
      defaultBenefit("premium"),
    ],
  };
}

function defaultWalletPageContent(): WalletPageContent {
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

export default function AdminResellerSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [stats, setStats] = useState<Stats>({
    activeSellerCount: 0,
    pausedSellerCount: 0,
    blockedSellerCount: 0,
    totalWalletBalance: 0,
    totalWalletUsed: 0,
    totalDiscountSaved: 0,
    totalRechargeAmount: 0,
    totalPaidRecharges: 0,
  });

  const [config, setConfig] = useState<ResellerConfigState>({
    isActive: true,
    banner: {
      isActive: true,
      title: "",
      subtitle: "",
      ctaText: "",
      placement: "home_slider_below",
    },
    plans: [],
    categoryRules: [],
    walletPageContent: defaultWalletPageContent(),
  });

  async function loadData() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/reseller-config", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to load reseller settings");

      const walletPageContentRaw = data?.config?.walletPageContent || {};
      const walletDefaults = defaultWalletPageContent();

      setConfig({
        isActive: Boolean(data?.config?.isActive ?? true),
        banner: {
          isActive: Boolean(data?.config?.banner?.isActive ?? true),
          title: safeStr(data?.config?.banner?.title),
          subtitle: safeStr(data?.config?.banner?.subtitle),
          ctaText: safeStr(data?.config?.banner?.ctaText),
          placement: (safeStr(data?.config?.banner?.placement || "home_slider_below") ||
            "home_slider_below") as "home_slider_below" | "combo_area" | "both",
        },
        plans: Array.isArray(data?.config?.plans) ? data.config.plans : [],
        categoryRules: Array.isArray(data?.config?.categoryRules)
          ? data.config.categoryRules
          : [],
        walletPageContent: {
          isActive: Boolean(walletPageContentRaw?.isActive ?? true),
          badgeText: safeStr(walletPageContentRaw?.badgeText || walletDefaults.badgeText),
          sectionTitle: safeStr(walletPageContentRaw?.sectionTitle || walletDefaults.sectionTitle),
          sectionSubtitle: safeStr(
            walletPageContentRaw?.sectionSubtitle || walletDefaults.sectionSubtitle
          ),
          processTitle: safeStr(walletPageContentRaw?.processTitle || walletDefaults.processTitle),
          processSteps: Array.isArray(walletPageContentRaw?.processSteps)
            ? walletPageContentRaw.processSteps
            : walletDefaults.processSteps,
          benefitsTitle: safeStr(
            walletPageContentRaw?.benefitsTitle || walletDefaults.benefitsTitle
          ),
          benefits: Array.isArray(walletPageContentRaw?.benefits)
            ? walletPageContentRaw.benefits
            : walletDefaults.benefits,
          activationTitle: safeStr(
            walletPageContentRaw?.activationTitle || walletDefaults.activationTitle
          ),
          activationPoints: Array.isArray(walletPageContentRaw?.activationPoints)
            ? walletPageContentRaw.activationPoints
            : walletDefaults.activationPoints,
          notesTitle: safeStr(walletPageContentRaw?.notesTitle || walletDefaults.notesTitle),
          notes: Array.isArray(walletPageContentRaw?.notes)
            ? walletPageContentRaw.notes
            : walletDefaults.notes,
          ctaNote: safeStr(walletPageContentRaw?.ctaNote || walletDefaults.ctaNote),
        },
      });

      setStats({
        activeSellerCount: Number(data?.stats?.activeSellerCount || 0),
        pausedSellerCount: Number(data?.stats?.pausedSellerCount || 0),
        blockedSellerCount: Number(data?.stats?.blockedSellerCount || 0),
        totalWalletBalance: Number(data?.stats?.totalWalletBalance || 0),
        totalWalletUsed: Number(data?.stats?.totalWalletUsed || 0),
        totalDiscountSaved: Number(data?.stats?.totalDiscountSaved || 0),
        totalRechargeAmount: Number(data?.stats?.totalRechargeAmount || 0),
        totalPaidRecharges: Number(data?.stats?.totalPaidRecharges || 0),
      });
    } catch (e: any) {
      setError(e?.message || "Failed to load reseller settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const plansSorted = useMemo(() => {
    return [...config.plans]
      .map((plan, originalIndex) => ({ plan, originalIndex }))
      .sort((a, b) => safeNum(a.plan.sortOrder, 0) - safeNum(b.plan.sortOrder, 0));
  }, [config.plans]);

  const rulesSorted = useMemo(() => {
    return [...config.categoryRules]
      .map((rule, originalIndex) => ({ rule, originalIndex }))
      .sort((a, b) => safeNum(a.rule.sortOrder, 0) - safeNum(b.rule.sortOrder, 0));
  }, [config.categoryRules]);

  function updatePlan(index: number, key: keyof PlanRow, value: any) {
    setConfig((prev) => {
      const next = [...prev.plans];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, plans: next };
    });
  }

  function updateRule(ruleIndex: number, key: keyof CategoryRule, value: any) {
    setConfig((prev) => {
      const next = [...prev.categoryRules];
      next[ruleIndex] = { ...next[ruleIndex], [key]: value };
      return { ...prev, categoryRules: next };
    });
  }

  function updateBenefit(ruleIndex: number, benefitIndex: number, key: keyof BenefitRow, value: any) {
    setConfig((prev) => {
      const rules = [...prev.categoryRules];
      const benefits = [...rules[ruleIndex].planBenefits];
      benefits[benefitIndex] = { ...benefits[benefitIndex], [key]: value };
      rules[ruleIndex] = { ...rules[ruleIndex], planBenefits: benefits };
      return { ...prev, categoryRules: rules };
    });
  }

  function updateWalletContent(key: keyof WalletPageContent, value: any) {
    setConfig((prev) => ({
      ...prev,
      walletPageContent: {
        ...prev.walletPageContent,
        [key]: value,
      },
    }));
  }

  function addRule() {
    setConfig((prev) => ({
      ...prev,
      categoryRules: [...prev.categoryRules, createEmptyRule(prev.categoryRules.length + 1)],
    }));
  }

  function removeRule(index: number) {
    setConfig((prev) => ({
      ...prev,
      categoryRules: prev.categoryRules.filter((_, i) => i !== index),
    }));
  }

  async function saveSettings() {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/reseller-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to save reseller settings");

      setSuccess(data?.message || "Saved successfully");
      if (data?.stats) {
        setStats({
          activeSellerCount: Number(data?.stats?.activeSellerCount || 0),
          pausedSellerCount: Number(data?.stats?.pausedSellerCount || 0),
          blockedSellerCount: Number(data?.stats?.blockedSellerCount || 0),
          totalWalletBalance: Number(data?.stats?.totalWalletBalance || 0),
          totalWalletUsed: Number(data?.stats?.totalWalletUsed || 0),
          totalDiscountSaved: Number(data?.stats?.totalDiscountSaved || 0),
          totalRechargeAmount: Number(data?.stats?.totalRechargeAmount || 0),
          totalPaidRecharges: Number(data?.stats?.totalPaidRecharges || 0),
        });
      }
    } catch (e: any) {
      setError(e?.message || "Failed to save reseller settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="rounded-3xl bg-white border border-slate-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-2xl font-extrabold flex items-center gap-2 text-violet-900">
                <Wallet className="text-violet-500" />
                Reseller Control Panel
              </div>
              <div className="text-sm text-slate-500 mt-1">
                Manage seller banner, plans, category rules, wallet-page content, and system status.
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={loadData}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 transition font-semibold shadow-sm text-slate-700"
              >
                <RefreshCw size={18} className="text-violet-400" />
                Refresh
              </button>

              <button
                onClick={saveSettings}
                disabled={saving || loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white transition font-extrabold shadow-sm disabled:opacity-60"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Save Settings
              </button>

              <Link
                href="/admin/site-settings"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 transition font-semibold shadow-sm text-slate-700"
              >
                <ArrowLeft size={18} className="text-slate-400" />
                Back
              </Link>
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 flex items-center gap-2">
              <AlertTriangle size={18} />
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 flex items-center gap-2">
              <CheckCircle2 size={18} />
              {success}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6 text-sm font-bold text-slate-600">
              Loading reseller settings...
            </div>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard label="Active Sellers" value={stats.activeSellerCount} icon={<ShieldCheck size={18} />} />
                <StatCard label="Paused / Blocked" value={stats.pausedSellerCount + stats.blockedSellerCount} icon={<AlertTriangle size={18} />} />
                <StatCard label="Wallet Balance Total" value={`₹${stats.totalWalletBalance}`} icon={<Wallet size={18} />} />
                <StatCard label="Total Recharges" value={`₹${stats.totalRechargeAmount}`} icon={<Sparkles size={18} />} />
              </div>

              <section className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="text-lg font-extrabold text-slate-900">Global Seller Banner</div>
                <div className="text-sm text-slate-500 mt-1">
                  Homepage seller attraction banner content control.
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Banner Title">
                    <input
                      value={config.banner.title}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          banner: { ...prev.banner, title: e.target.value },
                        }))
                      }
                      className="w-full h-12 px-4 rounded-2xl border border-slate-200 bg-white outline-none focus:border-violet-300 text-sm font-semibold"
                    />
                  </Field>

                  <Field label="CTA Text">
                    <input
                      value={config.banner.ctaText}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          banner: { ...prev.banner, ctaText: e.target.value },
                        }))
                      }
                      className="w-full h-12 px-4 rounded-2xl border border-slate-200 bg-white outline-none focus:border-violet-300 text-sm font-semibold"
                    />
                  </Field>

                  <Field label="Banner Subtitle" full>
                    <textarea
                      value={config.banner.subtitle}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          banner: { ...prev.banner, subtitle: e.target.value },
                        }))
                      }
                      className="w-full min-h-[110px] px-4 py-3 rounded-2xl border border-slate-200 bg-white outline-none focus:border-violet-300 text-sm font-semibold"
                    />
                  </Field>

                  <Field label="Placement">
                    <select
                      value={config.banner.placement}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          banner: {
                            ...prev.banner,
                            placement: e.target.value as "home_slider_below" | "combo_area" | "both",
                          },
                        }))
                      }
                      className="w-full h-12 px-4 rounded-2xl border border-slate-200 bg-white outline-none focus:border-violet-300 text-sm font-semibold"
                    >
                      <option value="home_slider_below">Home Slider Below</option>
                      <option value="combo_area">Combo Area</option>
                      <option value="both">Both</option>
                    </select>
                  </Field>

                  <Field label="Toggles">
                    <div className="flex flex-wrap gap-3">
                      <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">
                        <input
                          type="checkbox"
                          checked={config.isActive}
                          onChange={(e) =>
                            setConfig((prev) => ({ ...prev, isActive: e.target.checked }))
                          }
                        />
                        Global System Active
                      </label>

                      <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">
                        <input
                          type="checkbox"
                          checked={config.banner.isActive}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              banner: { ...prev.banner, isActive: e.target.checked },
                            }))
                          }
                        />
                        Banner Active
                      </label>
                    </div>
                  </Field>
                </div>
              </section>

              <section className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="text-lg font-extrabold text-slate-900">Plan Settings</div>
                <div className="text-sm text-slate-500 mt-1">
                  Price, badge, highlight, and plan presentation control.
                </div>

                <div className="mt-5 grid grid-cols-1 xl:grid-cols-3 gap-4">
                  {plansSorted.map(({ plan, originalIndex }) => (
                    <div key={plan.code} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-lg font-extrabold text-slate-900 capitalize">
                          {plan.code}
                        </div>
                        {plan.code === "premium" ? <Crown size={18} className="text-violet-500" /> : null}
                      </div>

                      <div className="mt-4 space-y-3">
                        <MiniField label="Name">
                          <input
                            value={plan.name}
                            onChange={(e) => updatePlan(originalIndex, "name", e.target.value)}
                            className="w-full h-11 px-4 rounded-2xl border border-slate-200 bg-slate-50 outline-none focus:border-violet-300 text-sm font-semibold"
                          />
                        </MiniField>

                        <MiniField label="Badge">
                          <input
                            value={plan.badge}
                            onChange={(e) => updatePlan(originalIndex, "badge", e.target.value)}
                            className="w-full h-11 px-4 rounded-2xl border border-slate-200 bg-slate-50 outline-none focus:border-violet-300 text-sm font-semibold"
                          />
                        </MiniField>

                        <MiniField label="Price">
                          <input
                            type="number"
                            value={plan.price}
                            onChange={(e) => updatePlan(originalIndex, "price", Number(e.target.value || 0))}
                            className="w-full h-11 px-4 rounded-2xl border border-slate-200 bg-slate-50 outline-none focus:border-violet-300 text-sm font-semibold"
                          />
                        </MiniField>

                        <MiniField label="Accent Color">
                          <input
                            value={plan.accentColor}
                            onChange={(e) => updatePlan(originalIndex, "accentColor", e.target.value)}
                            className="w-full h-11 px-4 rounded-2xl border border-slate-200 bg-slate-50 outline-none focus:border-violet-300 text-sm font-semibold"
                          />
                        </MiniField>

                        <MiniField label="Description">
                          <textarea
                            value={plan.description}
                            onChange={(e) => updatePlan(originalIndex, "description", e.target.value)}
                            className="w-full min-h-[90px] px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 outline-none focus:border-violet-300 text-sm font-semibold"
                          />
                        </MiniField>

                        <div className="grid grid-cols-2 gap-3">
                          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                            <input
                              type="checkbox"
                              checked={plan.isActive}
                              onChange={(e) => updatePlan(originalIndex, "isActive", e.target.checked)}
                            />
                            Active
                          </label>

                          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                            <input
                              type="checkbox"
                              checked={plan.isHighlighted}
                              onChange={(e) => updatePlan(originalIndex, "isHighlighted", e.target.checked)}
                            />
                            Highlight
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-lg font-extrabold text-slate-900">Category Rules</div>
                    <div className="text-sm text-slate-500 mt-1">
                      Decide which categories use wallet deduction, discount-only, or exclusion.
                    </div>
                  </div>

                  <button
                    onClick={addRule}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-extrabold shadow-sm"
                  >
                    <Plus size={18} />
                    Add Category Rule
                  </button>
                </div>

                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                  Handwritten Hardcopy (Delivery) ko default me inactive placeholder rakha gaya hai. Jab aap future me chaho tab is rule ko active kar sakte ho.
                </div>

                <div className="mt-5 space-y-5">
                  {rulesSorted.map(({ rule, originalIndex }) => (
                    <div key={`${rule.categoryKey}-${originalIndex}`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 flex-1">
                          <MiniField label="Category Key">
                            <input
                              value={rule.categoryKey}
                              onChange={(e) => updateRule(originalIndex, "categoryKey", e.target.value)}
                              className="w-full h-11 px-4 rounded-2xl border border-slate-200 bg-slate-50 outline-none focus:border-violet-300 text-sm font-semibold"
                            />
                          </MiniField>

                          <MiniField label="Category Label">
                            <input
                              value={rule.categoryLabel}
                              onChange={(e) => updateRule(originalIndex, "categoryLabel", e.target.value)}
                              className="w-full h-11 px-4 rounded-2xl border border-slate-200 bg-slate-50 outline-none focus:border-violet-300 text-sm font-semibold"
                            />
                          </MiniField>

                          <MiniField label="Benefit Mode">
                            <select
                              value={rule.benefitMode}
                              onChange={(e) => updateRule(originalIndex, "benefitMode", e.target.value)}
                              className="w-full h-11 px-4 rounded-2xl border border-slate-200 bg-slate-50 outline-none focus:border-violet-300 text-sm font-semibold"
                            >
                              <option value="wallet_deduction">Wallet Deduction</option>
                              <option value="discount_only">Discount Only</option>
                              <option value="excluded">Excluded</option>
                            </select>
                          </MiniField>

                          <MiniField label="Sort Order">
                            <input
                              type="number"
                              value={rule.sortOrder}
                              onChange={(e) => updateRule(originalIndex, "sortOrder", Number(e.target.value || 0))}
                              className="w-full h-11 px-4 rounded-2xl border border-slate-200 bg-slate-50 outline-none focus:border-violet-300 text-sm font-semibold"
                            />
                          </MiniField>
                        </div>

                        <div className="flex items-center gap-3">
                          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                            <input
                              type="checkbox"
                              checked={rule.isActive}
                              onChange={(e) => updateRule(originalIndex, "isActive", e.target.checked)}
                            />
                            Active
                          </label>

                          <button
                            onClick={() => removeRule(originalIndex)}
                            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-extrabold"
                          >
                            <Trash2 size={16} />
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {rule.planBenefits.map((benefit, benefitIndex) => (
                          <div key={`${benefit.planCode}-${benefitIndex}`} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                            <div className="text-sm font-extrabold text-slate-900 uppercase">
                              {benefit.planCode}
                            </div>

                            <div className="mt-4 space-y-3">
                              <MiniField label="Discount %">
                                <input
                                  type="number"
                                  value={benefit.discountPercent}
                                  onChange={(e) =>
                                    updateBenefit(originalIndex, benefitIndex, "discountPercent", Number(e.target.value || 0))
                                  }
                                  className="w-full h-11 px-4 rounded-2xl border border-slate-200 bg-white outline-none focus:border-violet-300 text-sm font-semibold"
                                />
                              </MiniField>

                              <MiniField label="Discount Product Limit">
                                <input
                                  type="number"
                                  value={benefit.discountProductLimit}
                                  onChange={(e) =>
                                    updateBenefit(originalIndex, benefitIndex, "discountProductLimit", Number(e.target.value || 0))
                                  }
                                  className="w-full h-11 px-4 rounded-2xl border border-slate-200 bg-white outline-none focus:border-violet-300 text-sm font-semibold"
                                />
                              </MiniField>

                              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={benefit.walletDeductionEnabled}
                                  onChange={(e) =>
                                    updateBenefit(originalIndex, benefitIndex, "walletDeductionEnabled", e.target.checked)
                                  }
                                />
                                Wallet Deduction Enabled
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-2xl border border-violet-200 bg-white flex items-center justify-center shrink-0">
                    <FileText size={20} className="text-violet-600" />
                  </div>
                  <div>
                    <div className="text-lg font-extrabold text-slate-900">
                      Wallet Page Seller Information Content
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      Ye content public wallet recharge page par tiles ke niche show hoga. Isko future me backend se edit kar sakte ho.
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Section Active">
                    <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={config.walletPageContent.isActive}
                        onChange={(e) => updateWalletContent("isActive", e.target.checked)}
                      />
                      Show this section on wallet page
                    </label>
                  </Field>

                  <Field label="Badge Text">
                    <input
                      value={config.walletPageContent.badgeText}
                      onChange={(e) => updateWalletContent("badgeText", e.target.value)}
                      className="w-full h-12 px-4 rounded-2xl border border-slate-200 bg-white outline-none focus:border-violet-300 text-sm font-semibold"
                    />
                  </Field>

                  <Field label="Section Title" full>
                    <input
                      value={config.walletPageContent.sectionTitle}
                      onChange={(e) => updateWalletContent("sectionTitle", e.target.value)}
                      className="w-full h-12 px-4 rounded-2xl border border-slate-200 bg-white outline-none focus:border-violet-300 text-sm font-semibold"
                    />
                  </Field>

                  <Field label="Section Subtitle" full>
                    <textarea
                      value={config.walletPageContent.sectionSubtitle}
                      onChange={(e) => updateWalletContent("sectionSubtitle", e.target.value)}
                      className="w-full min-h-[110px] px-4 py-3 rounded-2xl border border-slate-200 bg-white outline-none focus:border-violet-300 text-sm font-semibold"
                    />
                  </Field>

                  <Field label="Process Title">
                    <input
                      value={config.walletPageContent.processTitle}
                      onChange={(e) => updateWalletContent("processTitle", e.target.value)}
                      className="w-full h-12 px-4 rounded-2xl border border-slate-200 bg-white outline-none focus:border-violet-300 text-sm font-semibold"
                    />
                  </Field>

                  <Field label="Benefits Title">
                    <input
                      value={config.walletPageContent.benefitsTitle}
                      onChange={(e) => updateWalletContent("benefitsTitle", e.target.value)}
                      className="w-full h-12 px-4 rounded-2xl border border-slate-200 bg-white outline-none focus:border-violet-300 text-sm font-semibold"
                    />
                  </Field>

                  <Field label="Process Steps (one line = one point)" full>
                    <textarea
                      value={listToTextarea(config.walletPageContent.processSteps)}
                      onChange={(e) => updateWalletContent("processSteps", textareaToList(e.target.value))}
                      className="w-full min-h-[170px] px-4 py-3 rounded-2xl border border-slate-200 bg-white outline-none focus:border-violet-300 text-sm font-semibold"
                    />
                  </Field>

                  <Field label="Benefits (one line = one point)" full>
                    <textarea
                      value={listToTextarea(config.walletPageContent.benefits)}
                      onChange={(e) => updateWalletContent("benefits", textareaToList(e.target.value))}
                      className="w-full min-h-[170px] px-4 py-3 rounded-2xl border border-slate-200 bg-white outline-none focus:border-violet-300 text-sm font-semibold"
                    />
                  </Field>

                  <Field label="After Recharge Title">
                    <input
                      value={config.walletPageContent.activationTitle}
                      onChange={(e) => updateWalletContent("activationTitle", e.target.value)}
                      className="w-full h-12 px-4 rounded-2xl border border-slate-200 bg-white outline-none focus:border-violet-300 text-sm font-semibold"
                    />
                  </Field>

                  <Field label="Important Notes Title">
                    <input
                      value={config.walletPageContent.notesTitle}
                      onChange={(e) => updateWalletContent("notesTitle", e.target.value)}
                      className="w-full h-12 px-4 rounded-2xl border border-slate-200 bg-white outline-none focus:border-violet-300 text-sm font-semibold"
                    />
                  </Field>

                  <Field label="After Recharge Points (one line = one point)" full>
                    <textarea
                      value={listToTextarea(config.walletPageContent.activationPoints)}
                      onChange={(e) => updateWalletContent("activationPoints", textareaToList(e.target.value))}
                      className="w-full min-h-[170px] px-4 py-3 rounded-2xl border border-slate-200 bg-white outline-none focus:border-violet-300 text-sm font-semibold"
                    />
                  </Field>

                  <Field label="Important Notes (one line = one point)" full>
                    <textarea
                      value={listToTextarea(config.walletPageContent.notes)}
                      onChange={(e) => updateWalletContent("notes", textareaToList(e.target.value))}
                      className="w-full min-h-[170px] px-4 py-3 rounded-2xl border border-slate-200 bg-white outline-none focus:border-violet-300 text-sm font-semibold"
                    />
                  </Field>

                  <Field label="Bottom CTA Note" full>
                    <textarea
                      value={config.walletPageContent.ctaNote}
                      onChange={(e) => updateWalletContent("ctaNote", e.target.value)}
                      className="w-full min-h-[110px] px-4 py-3 rounded-2xl border border-slate-200 bg-white outline-none focus:border-violet-300 text-sm font-semibold"
                    />
                  </Field>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs uppercase font-extrabold tracking-wide text-slate-500">
          {label}
        </div>
        <div className="text-violet-500">{icon}</div>
      </div>
      <div className="mt-4 text-3xl font-black text-slate-900">{value}</div>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}

function MiniField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500 mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}