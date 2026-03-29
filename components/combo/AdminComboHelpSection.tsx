"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  HelpCircle,
  X,
  Settings2,
  Workflow,
  BookOpen,
  DatabaseZap,
  Pencil,
  Sparkles,
  Tags,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Layers3,
} from "lucide-react";

type HelpSection = {
  id: string;
  title: string;
  icon: LucideIcon;
  accent: string;
  summary: string;
  body: string[];
};

export default function AdminComboHelpSection({
  className = "",
}: {
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const sections = useMemo<HelpSection[]>(
    () => [
      {
        id: "quick-start",
        title: "Quick Start: mujhe kis order me kaam karna chahiye?",
        icon: Sparkles,
        accent: "border-emerald-200 bg-emerald-50 text-emerald-900",
        summary:
          "Sabse pehle defaults set karo, fir rules verify karo, fir preview/save chalao.",
        body: [
          "1. Agar kisi category ka basic behaviour set karna hai, to pehle Category Settings me jao.",
          "2. Agar kisi category ke liye advanced automation logic chahiye, to Combo Rules page me jao.",
          "3. PYQ combo ke liye isi page par PYQ Generator Controls use karo.",
          "4. Non-PYQ auto combo ke liye isi page par Generic Generator Controls use karo.",
          "5. Agar admin khud combo banana chahta hai, to manual combo form use karo.",
          "6. Preview dekhne ke baad hi Save chalao. Isse galat combo banne ka risk kam hota hai.",
        ],
      },
      {
        id: "category-settings",
        title: "Category Settings kya control karta hai?",
        icon: Settings2,
        accent: "border-blue-200 bg-blue-50 text-blue-900",
        summary:
          "Ye har category ka default control panel hai. Direct combo create nahi karta, defaults set karta hai.",
        body: [
          "Yahan se comboEnabled, autoGenerationEnabled, manualCombosEnabled aur makeOwnComboEnabled jaise base toggles control hote hain.",
          "Yahan default combo kind, min/max products, latest product count, default discount, same subject/same medium, thumb mode aur SEO patterns set hote hain.",
          "Simple language me: agar kisi category ka universal pattern set karna ho, to sabse pehle yahi page use karo.",
          "Baad me Combo Rules in defaults ko override kar sakte hain.",
        ],
      },
      {
        id: "combo-rules",
        title: "Combo Rules page kis kaam ka hai?",
        icon: Workflow,
        accent: "border-violet-200 bg-violet-50 text-violet-900",
        summary:
          "Ye advanced logic template / override page hai. Har rule ka practical effect category settings se zyada specific hota hai.",
        body: [
          "Yahan aap ruleType, comboKind, filters, pricing overrides, SEO overrides, thumb rules aur builder conditions define kar sakte ho.",
          "Category Settings default hoti hai, Combo Rule specific override hota hai.",
          "Agar aapko same category me alag automation logic chahiye, to woh mostly yahin define hota hai.",
          "Dhyan rahe: har field backend me equally active ho, ye zaroori nahi. Isliye preview ke bina save mat karo.",
        ],
      },
      {
        id: "pyq-generator",
        title: "PYQ Generator ka actual flow",
        icon: BookOpen,
        accent: "border-emerald-200 bg-emerald-50 text-emerald-900",
        summary:
          "PYQ side specialized hai. Ye same subject + same medium + latest pattern par kaam karta hai.",
        body: [
          "Question Papers category ke liye 3Y aur 5Y combo yahin se preview/save hote hain.",
          "3 Years PYQ combo = latest 6 products. 5 Years PYQ combo = latest 10 products.",
          "Grouping same subject code aur same medium ke basis par hoti hai.",
          "Agar required count available nahi hoga, to combo create nahi hoga.",
          "Isliye PYQ combo ko generic combo jaisa treat mat karo. Ye specialized workflow hai.",
        ],
      },
      {
        id: "generic-generator",
        title: "Generic Generator ka actual flow",
        icon: DatabaseZap,
        accent: "border-orange-200 bg-orange-50 text-orange-900",
        summary:
          "Ye non-PYQ categories ke auto combos ke liye hai, lekin current system me ye har business rule ko fully implement nahi karta.",
        body: [
          "Is page par Generic Generator Controls se preview, save aur stale generated combos cleanup hota hai.",
          "Current logic mostly rule + category defaults ke basis par chalti hai.",
          "Aapka final business goal customer co-purchase behaviour based multi-subject combo system hai, lekin current generic engine us level tak poori tarah nahi pahuncha hua ho sakta.",
          "Isliye generic combo save karne se pehle preview aur included products list ko zaroor check karo.",
        ],
      },
      {
        id: "manual-combo",
        title: "Manual Combo kab use karna chahiye?",
        icon: Pencil,
        accent: "border-slate-200 bg-slate-50 text-slate-900",
        summary:
          "Jab admin khud kisi specific combo ko create ya override karna chahe tab manual combo use karo.",
        body: [
          "Agar auto system ne desired combo nahi banaya, to admin manually combo bana sakta hai.",
          "Yeh special offer, seasonal combo, experimental combo ya manually curated combo ke liye best hai.",
          "Manual combo admin override path hai. Ye auto generator ka replacement nahi, backup / control path hai.",
        ],
      },
      {
        id: "impact-map",
        title: "Kis change ka asar kahan padega?",
        icon: Layers3,
        accent: "border-cyan-200 bg-cyan-50 text-cyan-900",
        summary:
          "Ye sabse important section hai. Isi se confusion kam hoga.",
        body: [
          "Category Settings me change karoge -> category ke defaults aur UI/SEO pattern par asar padega.",
          "Combo Rules me change karoge -> specific automation logic aur override behaviour par asar padega.",
          "PYQ Preview/Save chalaoge -> Question Papers ke specialized 3Y/5Y combos update honge.",
          "Generic Preview/Save chalaoge -> non-PYQ generated combos update honge.",
          "Manual form se save karoge -> ek admin-created combo create/update hoga.",
          "Stale cleanup chalaoge -> purane auto-generated combos inactive/trash ho sakte hain agar unka scope ab valid nahi raha.",
        ],
      },
      {
        id: "safe-usage",
        title: "Safe usage rules: galti se system kharab na ho",
        icon: ShieldCheck,
        accent: "border-amber-200 bg-amber-50 text-amber-900",
        summary:
          "Pehle preview, fir verify, uske baad hi save. Ye page powerful hai.",
        body: [
          "Kabhi bhi ek saath bahut saare settings change karke direct save mat karo.",
          "Pehle category defaults verify karo, fir rule verify karo, fir preview run karo.",
          "PYQ aur Generic ko mix karke mat socho. Dono workflows alag hain.",
          "Agar doubt ho to manual combo se test create karke output check karo.",
        ],
      },
    ],
    []
  );

  return (
    <>
      <div className={className}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          <HelpCircle size={16} />
          Wizard Help
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[100]">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />

          <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-6">
            <div className="relative w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-5 py-4 sm:px-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                    <HelpCircle size={22} />
                  </div>
                  <div>
                    <div className="text-lg sm:text-xl font-extrabold text-slate-900">
                      Combo Wizard Help
                    </div>
                    <div className="mt-1 text-sm text-slate-600 max-w-3xl">
                      Is popup me plain Hindi me samjhaaya gaya hai ki Combo
                      Settings, Rules, PYQ Generator, Generic Generator aur
                      Manual Combo creation ka actual kaam kya hai.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="max-h-[calc(92vh-88px)] overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
                <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 text-emerald-700" size={18} />
                      <div>
                        <div className="font-extrabold text-emerald-900">
                          Pehle defaults
                        </div>
                        <div className="mt-1 text-sm text-emerald-900/80">
                          Category Settings me category ka base behavior verify karo.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                    <div className="flex items-start gap-3">
                      <Tags className="mt-0.5 text-violet-700" size={18} />
                      <div>
                        <div className="font-extrabold text-violet-900">
                          Fir rules
                        </div>
                        <div className="mt-1 text-sm text-violet-900/80">
                          Advanced automation ya override chahiye to Combo Rules dekho.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                    <div className="flex items-start gap-3">
                      <ArrowRight className="mt-0.5 text-orange-700" size={18} />
                      <div>
                        <div className="font-extrabold text-orange-900">
                          Fir preview + save
                        </div>
                        <div className="mt-1 text-sm text-orange-900/80">
                          Isi page par PYQ ya Generic generator run karke output check karo.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-5 flex flex-wrap items-center gap-2">
                  <Link
                    href="/admin/combo-category-settings"
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                    onClick={() => setOpen(false)}
                  >
                    <Settings2 size={16} />
                    Category Settings
                  </Link>

                  <Link
                    href="/admin/combo-rules"
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800"
                    onClick={() => setOpen(false)}
                  >
                    <Workflow size={16} />
                    Combo Rules
                  </Link>
                </div>

                <div className="space-y-4">
                  {sections.map((section) => {
                    const Icon = section.icon;

                    return (
                      <div
                        key={section.id}
                        className={`overflow-hidden rounded-2xl border ${section.accent.split(" ")[0]}`}
                      >
                        <div className={`px-5 py-4 ${section.accent}`}>
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm">
                              <Icon size={18} />
                            </div>
                            <div>
                              <div className="font-extrabold text-base">
                                {section.title}
                              </div>
                              <div className="mt-1 text-sm opacity-90">
                                {section.summary}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white px-5 py-4">
                          <div className="grid grid-cols-1 gap-3">
                            {section.body.map((line, idx) => (
                              <div
                                key={idx}
                                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"
                              >
                                {line}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                  >
                    <X size={16} />
                    Close Wizard
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}