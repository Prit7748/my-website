"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Plus,
  Pencil,
  RefreshCcw,
  Search,
  X,
  CheckCircle2,
  AlertCircle,
  SlidersHorizontal,
} from "lucide-react";

type SettingRecord = {
  _id?: string;
  id?: string;
  categorySlug?: string;
  categoryLabel?: string;
  isActive?: boolean;
  comboEnabled?: boolean;
  manualCombosEnabled?: boolean;
  makeOwnComboEnabled?: boolean;
  discountType?: string;
  discountValue?: number;
  builderRules?: {
    minProductsRequired?: number;
    maxProductsAllowed?: number;
    sameCategoryOnly?: boolean;
    sameSubjectOnly?: boolean;
    sameMediumOnly?: boolean;
  };
  ui?: {
    makeOwnComboText?: string;
  };
};

type SettingsResponse = {
  ok?: boolean;
  count?: number;
  settings?: SettingRecord[];
  error?: string;
};

const CATEGORY_OPTIONS = [
  { value: "solved-assignments", label: "Solved Assignments" },
  { value: "question-papers", label: "Question Papers (PYQ)" },
  { value: "guess-papers", label: "Guess Papers" },
  { value: "ebooks-notes", label: "eBooks/Notes" },
  { value: "handwritten-pdfs", label: "Handwritten PDFs" },
  { value: "handwritten-hardcopy", label: "Handwritten Hardcopy (Delivery)" },
  { value: "projects-synopsis", label: "Projects & Synopsis" },
];

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function defaultForm() {
  return {
    categorySlug: "solved-assignments",
    isActive: true,
    comboEnabled: true,
    manualCombosEnabled: true,
    makeOwnComboEnabled: false,
    discountValue: "20",
    minProductsRequired: "0",
    maxProductsAllowed: "0",
    sameCategoryOnly: true,
    sameSubjectOnly: false,
    sameMediumOnly: false,
    makeOwnComboText: "",
  };
}

export default function AdminComboCategorySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState("");

  const [settings, setSettings] = useState<SettingRecord[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error" | ""; text: string }>({
    type: "",
    text: "",
  });

  const [form, setForm] = useState(defaultForm());

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (!message.text) return;
    const t = setTimeout(() => setMessage({ type: "", text: "" }), 2200);
    return () => clearTimeout(t);
  }, [message]);

  async function fetchSettings() {
    try {
      setLoading(true);

      const res = await fetch(`/api/admin/combo-category-settings`, {
        credentials: "include",
        cache: "no-store",
      });

      const data: SettingsResponse = await res.json().catch(() => ({}));

      if (!res.ok) {
        setSettings([]);
        setMessage({ type: "error", text: data?.error || "Failed to load category settings" });
        return;
      }

      setSettings(Array.isArray(data?.settings) ? data.settings : []);
    } catch {
      setSettings([]);
      setMessage({ type: "error", text: "Network error while loading category settings" });
    } finally {
      setLoading(false);
    }
  }

  const visibleSettings = useMemo(() => {
    const q = safeStr(search).toLowerCase();
    if (!q) return settings;

    return settings.filter((s) =>
      [s.categorySlug, s.categoryLabel]
        .map((x) => safeStr(x).toLowerCase())
        .join(" ")
        .includes(q)
    );
  }, [settings, search]);

  function resetForm() {
    setEditingId("");
    setForm(defaultForm());
  }

  function startEdit(setting: SettingRecord) {
    setEditingId(String(setting._id || setting.id || ""));
    setForm({
      categorySlug: safeStr(setting.categorySlug) || "solved-assignments",
      isActive: !!setting.isActive,
      comboEnabled: setting.comboEnabled !== false,
      manualCombosEnabled: setting.manualCombosEnabled !== false,
      makeOwnComboEnabled: !!setting.makeOwnComboEnabled,
      discountValue: String(setting.discountValue ?? 0),
      minProductsRequired: String(setting.builderRules?.minProductsRequired ?? 0),
      maxProductsAllowed: String(setting.builderRules?.maxProductsAllowed ?? 0),
      sameCategoryOnly: setting.builderRules?.sameCategoryOnly !== false,
      sameSubjectOnly: !!setting.builderRules?.sameSubjectOnly,
      sameMediumOnly: !!setting.builderRules?.sameMediumOnly,
      makeOwnComboText: safeStr(setting.ui?.makeOwnComboText),
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave() {
    if (saving) return;

    const payload = {
      categorySlug: safeStr(form.categorySlug),
      isActive: !!form.isActive,
      comboEnabled: !!form.comboEnabled,
      manualCombosEnabled: !!form.manualCombosEnabled,
      makeOwnComboEnabled: !!form.makeOwnComboEnabled,
      discountType: "percent",
      discountValue: Math.max(0, Math.min(100, safeNum(form.discountValue, 0))),
      builderRules: {
        minProductsRequired: Math.max(0, safeNum(form.minProductsRequired, 0)),
        maxProductsAllowed: Math.max(0, safeNum(form.maxProductsAllowed, 0)),
        sameCategoryOnly: !!form.sameCategoryOnly,
        sameSubjectOnly: !!form.sameSubjectOnly,
        sameMediumOnly: !!form.sameMediumOnly,
      },
      ui: {
        makeOwnComboText: safeStr(form.makeOwnComboText),
      },
    };

    try {
      setSaving(true);

      const isEdit = !!editingId;
      const url = isEdit
        ? `/api/admin/combo-category-settings/${editingId}`
        : `/api/admin/combo-category-settings`;
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage({ type: "error", text: data?.error || "Failed to save category setting" });
        return;
      }

      setMessage({
        type: "success",
        text: isEdit ? "Category setting updated ✅" : "Category setting created ✅",
      });

      resetForm();
      fetchSettings();
    } catch {
      setMessage({ type: "error", text: "Network error while saving category setting" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-2xl font-extrabold flex items-center gap-2">
                <SlidersHorizontal className="text-blue-700" />
                Combo Category Settings
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Minimum settings for manual combo, category combo visibility aur make your own combo rules.
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={fetchSettings}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 font-semibold shadow-sm"
              >
                <RefreshCcw size={16} />
                Refresh
              </button>

              <Link
                href="/admin/combos"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 font-semibold shadow-sm"
              >
                Back to Combos <ArrowRight size={18} />
              </Link>
            </div>
          </div>

          {message.text ? (
            <div
              className={`mt-6 rounded-2xl border p-4 flex items-start gap-3 ${
                message.type === "success"
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle2 className="text-emerald-700 mt-0.5" size={18} />
              ) : (
                <AlertCircle className="text-red-700 mt-0.5" size={18} />
              )}
              <div className="text-sm font-extrabold text-slate-900">{message.text}</div>
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 xl:grid-cols-[440px_1fr] gap-6">
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {editingId ? <Pencil size={18} /> : <Plus size={18} />}
                  <div className="text-lg font-extrabold">
                    {editingId ? "Edit Setting" : "Create Setting"}
                  </div>
                </div>

                {editingId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 font-bold text-sm"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="text-xs font-extrabold text-slate-600 uppercase">Category</label>
                  <select
                    value={form.categorySlug}
                    onChange={(e) => setForm((p) => ({ ...p, categorySlug: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none"
                  >
                    {CATEGORY_OPTIONS.map((x) => (
                      <option key={x.value} value={x.value}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-600 uppercase">
                    Master Discount %
                  </label>
                  <input
                    value={form.discountValue}
                    onChange={(e) => setForm((p) => ({ ...p, discountValue: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none"
                    placeholder="20"
                  />
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="text-sm font-extrabold text-slate-900">Make Your Own Combo Rules</div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-extrabold text-slate-600 uppercase">
                        Min Products
                      </label>
                      <input
                        value={form.minProductsRequired}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, minProductsRequired: e.target.value }))
                        }
                        className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 outline-none"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-extrabold text-slate-600 uppercase">
                        Max Products
                      </label>
                      <input
                        value={form.maxProductsAllowed}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, maxProductsAllowed: e.target.value }))
                        }
                        className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 outline-none"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <label className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-semibold">
                      <input
                        type="checkbox"
                        checked={form.sameCategoryOnly}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, sameCategoryOnly: e.target.checked }))
                        }
                      />
                      Same Category Only
                    </label>

                    <label className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-semibold">
                      <input
                        type="checkbox"
                        checked={form.sameSubjectOnly}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, sameSubjectOnly: e.target.checked }))
                        }
                      />
                      Same Subject Only
                    </label>

                    <label className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-semibold">
                      <input
                        type="checkbox"
                        checked={form.sameMediumOnly}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, sameMediumOnly: e.target.checked }))
                        }
                      />
                      Same Medium Only
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-600 uppercase">
                    Make Your Own Combo Text
                  </label>
                  <textarea
                    value={form.makeOwnComboText}
                    onChange={(e) => setForm((p) => ({ ...p, makeOwnComboText: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none min-h-[130px]"
                    placeholder="Customer ko dikhane wala helper text..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 font-semibold">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                    />
                    Active
                  </label>

                  <label className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 font-semibold">
                    <input
                      type="checkbox"
                      checked={form.comboEnabled}
                      onChange={(e) => setForm((p) => ({ ...p, comboEnabled: e.target.checked }))}
                    />
                    Combo Enabled
                  </label>

                  <label className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 font-semibold">
                    <input
                      type="checkbox"
                      checked={form.manualCombosEnabled}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, manualCombosEnabled: e.target.checked }))
                      }
                    />
                    Manual Combos Enabled
                  </label>

                  <label className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 font-semibold">
                    <input
                      type="checkbox"
                      checked={form.makeOwnComboEnabled}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, makeOwnComboEnabled: e.target.checked }))
                      }
                    />
                    Make Own Combo Enabled
                  </label>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-700 hover:bg-blue-800 text-white font-extrabold transition shadow-sm disabled:opacity-60"
                  >
                    {editingId ? <Pencil size={16} /> : <Plus size={16} />}
                    {saving
                      ? editingId
                        ? "Updating..."
                        : "Creating..."
                      : editingId
                      ? "Update Setting"
                      : "Create Setting"}
                  </button>

                  <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 font-extrabold transition shadow-sm"
                  >
                    <X size={16} />
                    Reset
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={18} />
                  <div className="text-lg font-extrabold">Existing Category Settings</div>
                </div>
                <div className="text-xs font-extrabold text-slate-500">
                  Total: {visibleSettings.length}
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3">
                  <Search size={16} className="text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full outline-none"
                    placeholder="Search category settings..."
                  />
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {loading ? (
                  <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center font-extrabold text-slate-600">
                    Loading category settings...
                  </div>
                ) : visibleSettings.length === 0 ? (
                  <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
                    <div className="font-extrabold text-slate-900">No category settings found</div>
                    <div className="text-sm text-slate-600 mt-1">Abhi list empty hai.</div>
                  </div>
                ) : (
                  visibleSettings.map((setting, index) => {
                    const settingId = String(setting._id || setting.id || "");

                    return (
                      <div
                        key={settingId || `${setting.categorySlug}-${index}`}
                        className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold ${
                                  setting.isActive
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-slate-100 text-slate-600 border border-slate-200"
                                }`}
                              >
                                {setting.isActive ? "active" : "inactive"}
                              </span>

                              <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold ${
                                  setting.comboEnabled
                                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                                    : "bg-slate-100 text-slate-600 border border-slate-200"
                                }`}
                              >
                                {setting.comboEnabled ? "combo on" : "combo off"}
                              </span>
                            </div>

                            <div className="mt-3 text-lg font-extrabold text-slate-900">
                              {safeStr(setting.categoryLabel || setting.categorySlug)}
                            </div>
                            <div className="mt-1 text-xs font-bold text-slate-500">
                              {safeStr(setting.categorySlug)}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="inline-flex items-center rounded-full bg-gray-50 border border-gray-200 px-3 py-1 text-[11px] font-extrabold text-slate-700">
                                manual: {setting.manualCombosEnabled ? "yes" : "no"}
                              </span>
                              <span className="inline-flex items-center rounded-full bg-gray-50 border border-gray-200 px-3 py-1 text-[11px] font-extrabold text-slate-700">
                                make own: {setting.makeOwnComboEnabled ? "yes" : "no"}
                              </span>
                              <span className="inline-flex items-center rounded-full bg-gray-50 border border-gray-200 px-3 py-1 text-[11px] font-extrabold text-slate-700">
                                discount: {Number(setting.discountValue || 0)}%
                              </span>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 min-w-[200px]">
                            <div className="text-[11px] uppercase font-extrabold text-slate-500">
                              Builder Rules
                            </div>
                            <div className="mt-1 text-sm font-extrabold text-slate-900">
                              {Number(setting.builderRules?.minProductsRequired || 0)} /{" "}
                              {Number(setting.builderRules?.maxProductsAllowed || 0)}
                            </div>
                            <div className="text-xs font-semibold text-slate-600 mt-1">
                              {[
                                setting.builderRules?.sameCategoryOnly ? "Same Category" : "",
                                setting.builderRules?.sameSubjectOnly ? "Same Subject" : "",
                                setting.builderRules?.sameMediumOnly ? "Same Medium" : "",
                              ]
                                .filter(Boolean)
                                .join(" • ") || "No strict rule"}
                            </div>
                          </div>
                        </div>

                        {safeStr(setting.ui?.makeOwnComboText) ? (
                          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-slate-700 leading-relaxed">
                            {safeStr(setting.ui?.makeOwnComboText)}
                          </div>
                        ) : null}

                        <div className="mt-4 flex items-center gap-3 flex-wrap">
                          <button
                            type="button"
                            onClick={() => startEdit(setting)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-extrabold transition shadow-sm"
                          >
                            <Pencil size={15} />
                            Edit
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}