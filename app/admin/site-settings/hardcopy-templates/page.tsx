"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  RefreshCcw,
  PenBox,
  Info,
  Truck,
  BadgeIndianRupee,
  ShieldCheck,
} from "lucide-react";

type ApiResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  item?: {
    titleTemplate: string;
    shortDescTemplate: string;
    longDescTemplate: string;
    importantNoteTemplate: string;
    metaTitleTemplate: string;
    metaDescriptionTemplate: string;

    deliveryChargeEnabled?: boolean;
    deliveryChargeThresholdAmount?: number;
    deliveryChargeAmount?: number;
    deliveryChargeLabel?: string;
    freeDeliveryLabel?: string;

    updatedBy?: string;
    updatedAt?: string | null;
  };
  defaults?: {
    titleTemplate: string;
    shortDescTemplate: string;
    longDescTemplate: string;
    importantNoteTemplate: string;
    metaTitleTemplate: string;
    metaDescriptionTemplate: string;

    deliveryChargeEnabled?: boolean;
    deliveryChargeThresholdAmount?: number;
    deliveryChargeAmount?: number;
    deliveryChargeLabel?: string;
    freeDeliveryLabel?: string;
  };
};

const TOKEN_HELP = [
  "%1 = Subject Code",
  "%2 = Subject Title (same medium)",
  "%3 = Course Code(s)",
  "%4 = Course Title(s)",
  "%5 = Session",
  "%6 = Medium",
];

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function safeBool(x: any, def = false) {
  if (typeof x === "boolean") return x;
  if (typeof x === "string") {
    const v = x.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(v)) return true;
    if (["false", "0", "no", "off"].includes(v)) return false;
  }
  if (typeof x === "number") {
    if (x === 1) return true;
    if (x === 0) return false;
  }
  return def;
}

export default function HardcopyTemplatesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [defaults, setDefaults] = useState<ApiResponse["defaults"] | null>(null);
  const [serverMessage, setServerMessage] = useState("");
  const [serverMessageType, setServerMessageType] = useState<"success" | "error" | "info">("info");

  const [form, setForm] = useState({
    titleTemplate: "",
    shortDescTemplate: "",
    longDescTemplate: "",
    importantNoteTemplate: "",
    metaTitleTemplate: "",
    metaDescriptionTemplate: "",

    deliveryChargeEnabled: false,
    deliveryChargeThresholdAmount: 1000,
    deliveryChargeAmount: 100,
    deliveryChargeLabel: "Delivery Charge",
    freeDeliveryLabel: "Free Delivery",
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/site-settings/hardcopy-templates", {
          credentials: "include",
          cache: "no-store",
        });
        const data = (await res.json()) as ApiResponse;

        if (!res.ok || !data?.ok) {
          const msg = data?.error || "Failed to load hardcopy templates";
          setServerMessage(msg);
          setServerMessageType("error");
          return;
        }

        setDefaults(data?.defaults || null);

        setForm({
          titleTemplate: safeStr(data?.item?.titleTemplate),
          shortDescTemplate: safeStr(data?.item?.shortDescTemplate),
          longDescTemplate: safeStr(data?.item?.longDescTemplate),
          importantNoteTemplate: safeStr(data?.item?.importantNoteTemplate),
          metaTitleTemplate: safeStr(data?.item?.metaTitleTemplate),
          metaDescriptionTemplate: safeStr(data?.item?.metaDescriptionTemplate),

          deliveryChargeEnabled: safeBool(data?.item?.deliveryChargeEnabled, false),
          deliveryChargeThresholdAmount: Math.max(
            0,
            safeNum(data?.item?.deliveryChargeThresholdAmount, 1000)
          ),
          deliveryChargeAmount: Math.max(
            0,
            safeNum(data?.item?.deliveryChargeAmount, 100)
          ),
          deliveryChargeLabel: safeStr(data?.item?.deliveryChargeLabel || "Delivery Charge"),
          freeDeliveryLabel: safeStr(data?.item?.freeDeliveryLabel || "Free Delivery"),
        });

        setServerMessage("Templates loaded successfully.");
        setServerMessageType("info");
      } catch (e: any) {
        setServerMessage(e?.message || "Failed to load hardcopy templates");
        setServerMessageType("error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function saveTemplates() {
    setSaving(true);
    setServerMessage("");

    try {
      const payload = {
        ...form,
        deliveryChargeThresholdAmount: Math.max(
          0,
          safeNum(form.deliveryChargeThresholdAmount, 0)
        ),
        deliveryChargeAmount: Math.max(0, safeNum(form.deliveryChargeAmount, 0)),
      };

      const res = await fetch("/api/admin/site-settings/hardcopy-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as ApiResponse;

      if (!res.ok || !data?.ok) {
        const msg = data?.error || "Failed to save templates";
        setServerMessage(msg);
        setServerMessageType("error");
        alert(msg);
        return;
      }

      setServerMessage(
        data?.message || "Templates and delivery settings saved successfully."
      );
      setServerMessageType("success");
    } catch (e: any) {
      const msg = e?.message || "Failed to save templates";
      setServerMessage(msg);
      setServerMessageType("error");
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  function resetDefaults() {
    if (!defaults) return;

    setForm({
      titleTemplate: safeStr(defaults.titleTemplate),
      shortDescTemplate: safeStr(defaults.shortDescTemplate),
      longDescTemplate: safeStr(defaults.longDescTemplate),
      importantNoteTemplate: safeStr(defaults.importantNoteTemplate),
      metaTitleTemplate: safeStr(defaults.metaTitleTemplate),
      metaDescriptionTemplate: safeStr(defaults.metaDescriptionTemplate),

      deliveryChargeEnabled: safeBool(defaults.deliveryChargeEnabled, false),
      deliveryChargeThresholdAmount: Math.max(
        0,
        safeNum(defaults.deliveryChargeThresholdAmount, 1000)
      ),
      deliveryChargeAmount: Math.max(
        0,
        safeNum(defaults.deliveryChargeAmount, 100)
      ),
      deliveryChargeLabel: safeStr(defaults.deliveryChargeLabel || "Delivery Charge"),
      freeDeliveryLabel: safeStr(defaults.freeDeliveryLabel || "Free Delivery"),
    });

    setServerMessage("Default templates restored in form. Do not forget to save.");
    setServerMessageType("info");
  }

  const deliveryPreview = useMemo(() => {
    const threshold = Math.max(0, safeNum(form.deliveryChargeThresholdAmount, 0));
    const charge = Math.max(0, safeNum(form.deliveryChargeAmount, 0));
    const chargeLabel = safeStr(form.deliveryChargeLabel || "Delivery Charge");
    const freeLabel = safeStr(form.freeDeliveryLabel || "Free Delivery");

    if (!form.deliveryChargeEnabled) {
      return "Delivery charge rule is currently disabled. Hardcopy checkout will continue to show free delivery unless checkout logic is updated later.";
    }

    return `When hardcopy subtotal is below ₹${threshold}, customer will be charged ₹${charge} as "${chargeLabel}". If subtotal is ₹${threshold} or above, checkout can show "${freeLabel}".`;
  }, [form]);

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-extrabold flex items-center gap-2">
                <PenBox className="text-fuchsia-700" />
                Hardcopy Templates
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Control hardcopy content templates and delivery charge rules from one place.
              </p>
            </div>

            <Link
              href="/admin/site-settings"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
            >
              <ArrowLeft size={18} />
              Back
            </Link>
          </div>

          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="text-sm font-extrabold text-blue-900">Available Tokens</div>
            <div className="text-sm text-blue-800 mt-2 leading-6">
              {TOKEN_HELP.map((x) => (
                <div key={x}>{x}</div>
              ))}
            </div>
          </div>

          {serverMessage ? (
            <div
              className={`mt-4 rounded-2xl border p-4 text-sm font-semibold ${
                serverMessageType === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : serverMessageType === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : "border-blue-200 bg-blue-50 text-blue-800"
              }`}
            >
              <div className="flex items-start gap-2">
                <Info size={18} className="mt-0.5 shrink-0" />
                <div>{serverMessage}</div>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="mt-6 text-sm text-slate-500">Loading templates...</div>
          ) : (
            <div className="mt-6 space-y-5">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <div className="text-base font-extrabold text-slate-900">
                  Template Settings
                </div>
                <div className="text-sm text-slate-600 mt-1">
                  These templates are used while generating hardcopy product content.
                </div>

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-5 block">
                  Title Template
                </label>
                <input
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  value={form.titleTemplate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, titleTemplate: e.target.value }))
                  }
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                  Short Description Template
                </label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[100px]"
                  value={form.shortDescTemplate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, shortDescTemplate: e.target.value }))
                  }
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                  Long Description Template
                </label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[180px]"
                  value={form.longDescTemplate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, longDescTemplate: e.target.value }))
                  }
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                  Important Note Template
                </label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[140px]"
                  value={form.importantNoteTemplate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, importantNoteTemplate: e.target.value }))
                  }
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                  Meta Title Template
                </label>
                <input
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  value={form.metaTitleTemplate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, metaTitleTemplate: e.target.value }))
                  }
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                  Meta Description Template
                </label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[120px]"
                  value={form.metaDescriptionTemplate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, metaDescriptionTemplate: e.target.value }))
                  }
                />
              </div>

              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-white border border-orange-200 flex items-center justify-center text-orange-700 shrink-0">
                    <Truck size={20} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-base font-extrabold text-slate-900">
                      Delivery Charge Settings
                    </div>
                    <div className="text-sm text-slate-700 mt-1 leading-6">
                      Configure when a delivery fee should be applied for hardcopy-only orders.
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-orange-200 bg-white p-4">
                  <label className="flex items-center justify-between gap-4 cursor-pointer">
                    <div>
                      <div className="text-sm font-extrabold text-slate-900">
                        Enable Delivery Charge Rule
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        Turn this on when you want to charge delivery below a certain hardcopy subtotal.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          deliveryChargeEnabled: !p.deliveryChargeEnabled,
                        }))
                      }
                      className={`relative inline-flex h-7 w-14 items-center rounded-full transition ${
                        form.deliveryChargeEnabled ? "bg-emerald-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                          form.deliveryChargeEnabled ? "translate-x-8" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </label>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-orange-200 bg-white p-4">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1 block">
                      Hardcopy Subtotal Threshold
                    </label>
                    <div className="mt-1 relative">
                      <BadgeIndianRupee
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="number"
                        min={0}
                        className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                        value={form.deliveryChargeThresholdAmount}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            deliveryChargeThresholdAmount: Math.max(
                              0,
                              safeNum(e.target.value, 0)
                            ),
                          }))
                        }
                      />
                    </div>
                    <div className="mt-2 text-xs text-slate-600 font-semibold leading-5">
                      Example: if threshold is ₹1000, then orders below ₹1000 can be charged delivery.
                    </div>
                  </div>

                  <div className="rounded-2xl border border-orange-200 bg-white p-4">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1 block">
                      Delivery Charge Amount
                    </label>
                    <div className="mt-1 relative">
                      <BadgeIndianRupee
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="number"
                        min={0}
                        className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                        value={form.deliveryChargeAmount}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            deliveryChargeAmount: Math.max(
                              0,
                              safeNum(e.target.value, 0)
                            ),
                          }))
                        }
                      />
                    </div>
                    <div className="mt-2 text-xs text-slate-600 font-semibold leading-5">
                      Example: ₹100 delivery charge for smaller hardcopy orders.
                    </div>
                  </div>

                  <div className="rounded-2xl border border-orange-200 bg-white p-4">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1 block">
                      Delivery Charge Label
                    </label>
                    <input
                      className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                      value={form.deliveryChargeLabel}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          deliveryChargeLabel: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="rounded-2xl border border-orange-200 bg-white p-4">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1 block">
                      Free Delivery Label
                    </label>
                    <input
                      className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                      value={form.freeDeliveryLabel}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          freeDeliveryLabel: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-start gap-2">
                    <ShieldCheck size={18} className="text-emerald-700 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-sm font-extrabold text-emerald-900">
                        Rule Preview
                      </div>
                      <div className="mt-1 text-sm text-emerald-800 leading-6">
                        {deliveryPreview}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={saveTemplates}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-950 text-white font-extrabold disabled:opacity-60"
                >
                  <Save size={18} />
                  {saving ? "Saving..." : "Save Settings"}
                </button>

                <button
                  type="button"
                  onClick={resetDefaults}
                  disabled={!defaults}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 font-extrabold disabled:opacity-60"
                >
                  <RefreshCcw size={18} />
                  Reset Default Settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}