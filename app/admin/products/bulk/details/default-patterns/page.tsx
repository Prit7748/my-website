"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  RefreshCcw,
  PenBox,
  Info,
  Settings2,
  CheckCircle2,
} from "lucide-react";

type TemplateItem = {
  category: string;
  titleTemplate: string;
  importantNoteTemplate: string;
  shortDescTemplate: string;
  longDescTemplate: string;
  slugTemplate: string;
  metaTitleTemplate: string;
  metaDescriptionTemplate: string;
  publishNow: boolean;
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  categories?: string[];
  item?: TemplateItem;
  items?: TemplateItem[];
  itemMap?: Record<string, TemplateItem>;
  defaults?: Record<string, TemplateItem>;
  meta?: {
    key?: string;
    updatedBy?: string;
    updatedAt?: string | null;
    createdAt?: string | null;
  };
};

const TOKEN_HELP = [
  "%A = Unique Id (SKU)",
  "%B = Subject Code",
  "%C = Session",
  "%D = Language",
  "%E = Course Code",
  "%F = Subject Title (language matched from master subjects)",
  "%G = Course Title (from master courses)",
];

function safeStr(x: any) {
  return String(x ?? "").trim();
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

function createEmptyItem(category: string): TemplateItem {
  return {
    category,
    titleTemplate: "",
    importantNoteTemplate: "",
    shortDescTemplate: "",
    longDescTemplate: "",
    slugTemplate: "",
    metaTitleTemplate: "",
    metaDescriptionTemplate: "",
    publishNow: false,
  };
}

function normalizeItem(input: any, category: string): TemplateItem {
  return {
    category,
    titleTemplate: safeStr(input?.titleTemplate),
    importantNoteTemplate: safeStr(input?.importantNoteTemplate),
    shortDescTemplate: safeStr(input?.shortDescTemplate),
    longDescTemplate: safeStr(input?.longDescTemplate),
    slugTemplate: safeStr(input?.slugTemplate),
    metaTitleTemplate: safeStr(input?.metaTitleTemplate),
    metaDescriptionTemplate: safeStr(input?.metaDescriptionTemplate),
    publishNow: safeBool(input?.publishNow, false),
  };
}

export default function BulkDefaultPatternsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("Solved Assignments");

  const [defaultsMap, setDefaultsMap] = useState<Record<string, TemplateItem>>({});
  const [itemMap, setItemMap] = useState<Record<string, TemplateItem>>({});

  const [serverMessage, setServerMessage] = useState("");
  const [serverMessageType, setServerMessageType] = useState<
    "success" | "error" | "info"
  >("info");

  const [meta, setMeta] = useState<ApiResponse["meta"] | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setServerMessage("");

    try {
      const res = await fetch("/api/admin/products/bulk/details/default-templates", {
        credentials: "include",
        cache: "no-store",
      });

      const data = (await res.json()) as ApiResponse;

      if (!res.ok || !data?.ok) {
        const msg = data?.error || "Failed to load default template settings";
        setServerMessage(msg);
        setServerMessageType("error");
        return;
      }

      const apiCategories = Array.isArray(data?.categories) ? data.categories : [];
      const normalizedMap: Record<string, TemplateItem> = {};
      const normalizedDefaults: Record<string, TemplateItem> = {};

      for (const category of apiCategories) {
        normalizedMap[category] = normalizeItem(
          data?.itemMap?.[category] || createEmptyItem(category),
          category
        );
        normalizedDefaults[category] = normalizeItem(
          data?.defaults?.[category] || createEmptyItem(category),
          category
        );
      }

      setCategories(apiCategories);
      setItemMap(normalizedMap);
      setDefaultsMap(normalizedDefaults);
      setMeta(data?.meta || null);

      if (!apiCategories.includes(selectedCategory)) {
        setSelectedCategory(apiCategories[0] || "Solved Assignments");
      }

      setServerMessage("Default template settings loaded successfully.");
      setServerMessageType("info");
    } catch (e: any) {
      setServerMessage(e?.message || "Failed to load default template settings");
      setServerMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  const currentItem = useMemo(() => {
    return (
      itemMap[selectedCategory] ||
      defaultsMap[selectedCategory] ||
      createEmptyItem(selectedCategory)
    );
  }, [itemMap, defaultsMap, selectedCategory]);

  const currentDefault = useMemo(() => {
    return defaultsMap[selectedCategory] || createEmptyItem(selectedCategory);
  }, [defaultsMap, selectedCategory]);

  function updateCurrent(patch: Partial<TemplateItem>) {
    setItemMap((prev) => ({
      ...prev,
      [selectedCategory]: {
        ...(prev[selectedCategory] ||
          defaultsMap[selectedCategory] ||
          createEmptyItem(selectedCategory)),
        ...patch,
        category: selectedCategory,
      },
    }));
  }

  async function saveCurrentCategory() {
    if (!selectedCategory) {
      alert("Please select a category first.");
      return;
    }

    if (!safeStr(currentItem.titleTemplate)) {
      alert("Title Template required hai.");
      return;
    }

    setSaving(true);
    setServerMessage("");

    try {
      const payload = {
        ...currentItem,
        category: selectedCategory,
      };

      const res = await fetch("/api/admin/products/bulk/details/default-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as ApiResponse;

      if (!res.ok || !data?.ok) {
        const msg = data?.error || "Failed to save default template settings";
        setServerMessage(msg);
        setServerMessageType("error");
        alert(msg);
        return;
      }

      const apiCategories = Array.isArray(data?.categories) ? data.categories : categories;
      const nextMap: Record<string, TemplateItem> = {};
      const nextDefaults: Record<string, TemplateItem> = {};

      for (const category of apiCategories) {
        nextMap[category] = normalizeItem(
          data?.itemMap?.[category] || itemMap[category] || createEmptyItem(category),
          category
        );
        nextDefaults[category] = normalizeItem(
          data?.defaults?.[category] || defaultsMap[category] || createEmptyItem(category),
          category
        );
      }

      setCategories(apiCategories);
      setItemMap(nextMap);
      setDefaultsMap(nextDefaults);
      setMeta(data?.meta || null);

      setServerMessage(
        data?.message || `${selectedCategory} default templates saved successfully.`
      );
      setServerMessageType("success");
    } catch (e: any) {
      const msg = e?.message || "Failed to save default template settings";
      setServerMessage(msg);
      setServerMessageType("error");
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  function resetCurrentToDefault() {
    if (!selectedCategory) return;

    setItemMap((prev) => ({
      ...prev,
      [selectedCategory]: normalizeItem(currentDefault, selectedCategory),
    }));

    setServerMessage(
      `${selectedCategory} ke default values form me restore ho gaye. Save karna mat bhoolna.`
    );
    setServerMessageType("info");
  }

  const updatedMetaText = useMemo(() => {
    const updatedBy = safeStr(meta?.updatedBy);
    const updatedAt = safeStr(meta?.updatedAt);

    if (!updatedBy && !updatedAt) return "No saved update info yet.";

    if (updatedBy && updatedAt) {
      return `Last saved by ${updatedBy} on ${updatedAt}`;
    }

    if (updatedBy) return `Last saved by ${updatedBy}`;
    return `Last saved on ${updatedAt}`;
  }, [meta]);

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-extrabold flex items-center gap-2">
                <Settings2 className="text-indigo-700" />
                Bulk Product Default Patterns
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Har category ke liye default title, description, slug, meta details aur
                publish setting yahan save karo. Ye defaults bulk details main page par
                auto-fill honge, lekin wahan manual change ab bhi possible rahega.
              </p>
            </div>

            <Link
              href="/admin/products/bulk/details"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
            >
              <ArrowLeft size={18} />
              Back to Bulk Details
            </Link>
          </div>

          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="text-sm font-extrabold text-blue-900">Available Tokens</div>
            <div className="text-sm text-blue-800 mt-2 leading-6">
              {TOKEN_HELP.map((x) => (
                <div key={x}>{x}</div>
              ))}
              <div className="mt-2 font-semibold">
                Note: Main bulk details page par category select hote hi yahi defaults
                load honge.
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-2">
              <CheckCircle2 size={18} className="text-emerald-700 mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-extrabold text-emerald-900">
                  How this works
                </div>
                <div className="mt-1 text-sm text-emerald-800 leading-6">
                  1. Yahan category-wise defaults save honge.
                  <br />
                  2. Bulk Product Details Upload page par ye values automatically form me
                  bhar jayengi.
                  <br />
                  3. Agar kisi upload ke liye alag wording chahiye ho, to main page par
                  manually edit karke upload kar sakte ho.
                </div>
              </div>
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
            <div className="mt-6 text-sm text-slate-500">
              Loading default template settings...
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="text-sm font-extrabold mb-3">Select Category</div>

                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                    Category
                  </label>
                  <select
                    className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    disabled={saving}
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-bold uppercase text-slate-500">
                      Saved Info
                    </div>
                    <div className="mt-2 text-sm text-slate-700 leading-6">
                      {updatedMetaText}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="text-sm font-extrabold mb-3">Actions</div>

                  <button
                    type="button"
                    onClick={saveCurrentCategory}
                    disabled={saving || !selectedCategory}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-950 text-white transition font-extrabold disabled:opacity-60"
                  >
                    <Save size={18} />
                    {saving ? "Saving..." : `Save ${selectedCategory || "Category"}`}
                  </button>

                  <button
                    type="button"
                    onClick={resetCurrentToDefault}
                    disabled={saving || !selectedCategory}
                    className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-extrabold disabled:opacity-60"
                  >
                    <RefreshCcw size={18} />
                    Reset Current Category to Default
                  </button>

                  <button
                    type="button"
                    onClick={loadAll}
                    disabled={saving}
                    className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-extrabold disabled:opacity-60"
                  >
                    <RefreshCcw size={18} />
                    Reload Saved Settings
                  </button>
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <div className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <PenBox size={18} />
                    {selectedCategory} Default Templates
                  </div>
                  <div className="text-sm text-slate-600 mt-1">
                    Yahan saved values bulk details form ke initial defaults ke roop me use
                    hongi.
                  </div>

                  <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-5 block">
                    Title Template
                  </label>
                  <input
                    className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                    value={currentItem.titleTemplate}
                    onChange={(e) => updateCurrent({ titleTemplate: e.target.value })}
                    disabled={saving}
                  />

                  <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                    Important Note Template
                  </label>
                  <textarea
                    className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[110px]"
                    value={currentItem.importantNoteTemplate}
                    onChange={(e) =>
                      updateCurrent({ importantNoteTemplate: e.target.value })
                    }
                    disabled={saving}
                  />

                  <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                    Short Description Template
                  </label>
                  <textarea
                    className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[110px]"
                    value={currentItem.shortDescTemplate}
                    onChange={(e) => updateCurrent({ shortDescTemplate: e.target.value })}
                    disabled={saving}
                  />

                  <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                    Long Description Template
                  </label>
                  <textarea
                    className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[180px]"
                    value={currentItem.longDescTemplate}
                    onChange={(e) => updateCurrent({ longDescTemplate: e.target.value })}
                    disabled={saving}
                  />

                  <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                    Slug Template (optional)
                  </label>
                  <input
                    className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                    placeholder="Blank chhodoge to title se auto slug banega"
                    value={currentItem.slugTemplate}
                    onChange={(e) => updateCurrent({ slugTemplate: e.target.value })}
                    disabled={saving}
                  />

                  <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                    Meta Title Template
                  </label>
                  <input
                    className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                    value={currentItem.metaTitleTemplate}
                    onChange={(e) => updateCurrent({ metaTitleTemplate: e.target.value })}
                    disabled={saving}
                  />

                  <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                    Meta Description Template
                  </label>
                  <textarea
                    className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[120px]"
                    value={currentItem.metaDescriptionTemplate}
                    onChange={(e) =>
                      updateCurrent({ metaDescriptionTemplate: e.target.value })
                    }
                    disabled={saving}
                  />

                  <div className="mt-4 flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={currentItem.publishNow}
                      onChange={(e) => updateCurrent({ publishNow: e.target.checked })}
                      className="h-4 w-4"
                      disabled={saving}
                    />
                    <div className="font-bold text-sm">
                      Default publish now for this category
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                    <div className="text-sm font-extrabold text-indigo-900">
                      Default Preview Note
                    </div>
                    <div className="text-sm text-indigo-800 mt-2 leading-6">
                      Ye values sirf starting defaults hain. Bulk upload main page par aap
                      inhe upload se pehle manually change kar sakte ho.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}