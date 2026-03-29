// components/dashboard/ResellerOverviewSection.tsx
import Link from "next/link";
import {
  Wallet,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Lock,
  Coins,
  BadgePercent,
} from "lucide-react";
import { getResellerPlanTheme } from "@/lib/reseller";

type DashboardUser = {
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

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

export default function ResellerOverviewSection({
  user,
  loading,
}: {
  user: DashboardUser | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="text-lg font-extrabold text-slate-900">Loading seller section...</div>
      </div>
    );
  }

  const reseller = user?.reseller || {};
  const isActiveSeller =
    Boolean(reseller?.isReseller) &&
    safeStr(reseller?.status).toLowerCase() === "active" &&
    !!safeStr(reseller?.planCode);

  const planCode = safeStr(reseller?.planCode).toLowerCase();
  const theme = getResellerPlanTheme(planCode);

  if (!isActiveSeller) {
    return (
      <div className="mt-6 rounded-[28px] border border-violet-200 bg-gradient-to-r from-violet-50 via-white to-cyan-50 p-6 md:p-7 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-3 py-1 text-[11px] font-extrabold text-violet-700">
              <Sparkles size={14} />
              Seller Wallet Locked
            </div>

            <h2 className="mt-4 text-2xl font-black text-slate-900">
              Activate reseller benefits
            </h2>

            <p className="mt-2 max-w-3xl text-sm md:text-base font-semibold text-slate-600 leading-relaxed">
              Unlock wallet deduction on selected categories, category-based
              discount access, premium identity capsule, and future bulk seller
              benefits.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/wallet"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-white font-extrabold hover:bg-slate-800 transition"
            >
              <Wallet size={18} />
              Open Seller Plans
            </Link>

            <Link
              href="/wallet"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-slate-800 font-extrabold hover:bg-gray-50 transition"
            >
              Learn Benefits
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-[28px] border border-violet-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 md:px-7 py-5 border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-cyan-50">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-extrabold bg-white text-slate-800 border-slate-200">
              <ShieldCheck size={14} />
              Reseller Benefits Active
            </div>

            <h2 className="mt-3 text-2xl font-black text-slate-900">
              Seller Dashboard Overview
            </h2>

            <p className="mt-1 text-sm font-semibold text-slate-600">
              Track wallet usage, savings, and active plan status from one place.
            </p>
          </div>

          <div
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-extrabold ${theme.capsuleClass}`}
          >
            <CheckCircle2 size={16} />
            {safeStr(reseller?.planName || theme.label)}
          </div>
        </div>
      </div>

      <div className="p-6 md:p-7">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase font-extrabold tracking-wide text-slate-500">
              Wallet Balance
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center">
                <Wallet className="text-slate-800" size={22} />
              </div>
              <div className="text-3xl font-black text-slate-900">
                ₹{safeNum(reseller?.walletBalance, 0)}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase font-extrabold tracking-wide text-slate-500">
              Total Recharged
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center">
                <Coins className="text-slate-800" size={22} />
              </div>
              <div className="text-3xl font-black text-slate-900">
                ₹{safeNum(reseller?.walletTotalRecharged, 0)}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase font-extrabold tracking-wide text-slate-500">
              Total Used
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center">
                <Lock className="text-slate-800" size={22} />
              </div>
              <div className="text-3xl font-black text-slate-900">
                ₹{safeNum(reseller?.walletTotalUsed, 0)}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase font-extrabold tracking-wide text-slate-500">
              Discount Saved
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center">
                <BadgePercent className="text-slate-800" size={22} />
              </div>
              <div className="text-3xl font-black text-slate-900">
                ₹{safeNum(reseller?.walletTotalDiscountSaved, 0)}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/wallet"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-white font-extrabold hover:bg-slate-800 transition"
          >
            Manage Wallet
            <ArrowRight size={18} />
          </Link>

          <Link
            href="/orders"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-slate-800 font-extrabold hover:bg-gray-50 transition"
          >
            View Orders
          </Link>
        </div>
      </div>
    </div>
  );
}