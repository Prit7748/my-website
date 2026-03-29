"use client";

import Link from "next/link";
import { ArrowRight, Lock, Sparkles } from "lucide-react";

type MakeOwnComboCtaProps = {
  title?: string;
  description: string;
  buttonText?: string;
  disabled?: boolean;
  href?: string;
  note?: string;
};

export default function MakeOwnComboCta({
  title = "Create Your Own Combo",
  description,
  buttonText = "Open Builder",
  disabled = false,
  href = "#",
  note = "",
}: MakeOwnComboCtaProps) {
  const buttonClass = disabled
    ? "bg-slate-200 text-slate-500 cursor-not-allowed"
    : "bg-slate-900 text-white hover:bg-slate-800";

  return (
    <div className="rounded-[28px] border border-gray-200 bg-white shadow-xl overflow-hidden">
      <div className="p-5 md:p-6 border-b border-gray-100 bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-3 py-1 text-[11px] font-extrabold shadow">
              <Sparkles size={13} />
              CUSTOM COMBO BUILDER
            </div>

            <div className="mt-3 text-xl md:text-2xl font-extrabold text-slate-900">
              {title}
            </div>

            <div className="mt-1 text-sm font-semibold text-slate-700 leading-relaxed max-w-3xl">
              {description}
            </div>

            {note ? (
              <div className="mt-3 text-xs font-bold text-slate-500 leading-relaxed">
                {note}
              </div>
            ) : null}
          </div>

          {disabled ? (
            <button
              type="button"
              disabled
              className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-extrabold transition shadow-lg ${buttonClass}`}
            >
              <Lock size={18} />
              Currently Unavailable
            </button>
          ) : (
            <Link
              href={href}
              className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-extrabold transition shadow-lg ${buttonClass}`}
            >
              {buttonText}
              <ArrowRight size={18} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}