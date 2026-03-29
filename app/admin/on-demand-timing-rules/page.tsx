"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock3,
  Layers3,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";

type TimingRule = {
  _id: string;
  categoryLabel: string;
  categoryKey: string;
  courseCode: string;
  courseCodeKey: string;
  courseTitle: string;
  ruleType: "category_default" | "course_override" | string;
  deliverWithinMinutes: number;
  onDemandNote: string;
  isActive: boolean;
  updatedBy?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastModifiedAt?: string | null;
};

type RuleGroup = {
  categoryLabel: string;
  categoryKey: string;
  defaultRule: TimingRule | null;
  courseOverrides: TimingRule[];
  totalRules: number;
};

type ApiResponse = {
  ok?: boolean;
  items?: RuleGroup[];
  meta?: {
    allowedCategoryLabels?: string[];
    totalRules?: number;
  };
  error?: string;
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function fmtDate(x?: string | null) {
  if (!x) return "-";
  try {
    return new Date(x).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(x);
  }
}

const DEFAULT_MINUTES = 20;

export default function AdminOnDemandTimingRulesPage() {
  const [loading, setLoading] = useState(true);
  const [savingDefault, setSavingDefault] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [groups, setGroups] = useState<RuleGroup[]>([]);
  const [allowedCategories, setAllowedCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [defaultMinutes, setDefaultMinutes] = useState(String(DEFAULT_MINUTES));
  const [defaultNote, setDefaultNote] = useState("");
  const [defaultActive, setDefaultActive] = useState(true);

  const [editingOverrideId, setEditingOverrideId] = useState("");
  const [overrideCourseCode, setOverrideCourseCode] = useState("");
  const [overrideMinutes, setOverrideMinutes] = useState(String(DEFAULT_MINUTES));
  const [overrideNote, setOverrideNote] = useState("");
  const [overrideActive, setOverrideActive] = useState(true);

  async function loadData(preserveCategory?: string) {
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/admin/on-demand-timing-rules", {
        credentials: "include",
        cache: "no-store",
      });

      const data: ApiResponse = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setGroups([]);
        setAllowedCategories([]);
        setErrorMsg(data?.error || "Failed to load timing rules.");
        return;
      }

      const nextGroups = Array.isArray(data?.items) ? data.items : [];
      const nextAllowed = Array.isArray(data?.meta?.allowedCategoryLabels)
        ? data.meta!.allowedCategoryLabels!.filter(Boolean)
        : [];

      setGroups(nextGroups);
      setAllowedCategories(nextAllowed);

      const preferred = safeStr(preserveCategory || selectedCategory);
      const preferredExists =
        preferred &&
        (nextAllowed.includes(preferred) ||
          nextGroups.some((x) => safeStr(x.categoryLabel) === preferred));

      const nextSelected =
        preferredExists
          ? preferred
          : nextAllowed[0] || nextGroups[0]?.categoryLabel || "";

      setSelectedCategory(nextSelected);
    } catch {
      setGroups([]);
      setAllowedCategories([]);
      setErrorMsg("Failed to load timing rules.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedGroup = useMemo(() => {
    return (
      groups.find((x) => safeStr(x.categoryLabel) === safeStr(selectedCategory)) || null
    );
  }, [groups, selectedCategory]);

  useEffect(() => {
    const rule = selectedGroup?.defaultRule || null;

    setDefaultMinutes(String(Math.max(1, safeNum(rule?.deliverWithinMinutes, DEFAULT_MINUTES))));
    setDefaultNote(safeStr(rule?.onDemandNote));
    setDefaultActive(rule ? Boolean(rule.isActive) : true);

    setEditingOverrideId("");
    setOverrideCourseCode("");
    setOverrideMinutes(String(DEFAULT_MINUTES));
    setOverrideNote("");
    setOverrideActive(true);
  }, [selectedGroup]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 2200);
    return () => clearTimeout(t);
  }, [message]);

  useEffect(() => {
    if (!errorMsg) return;
    const t = setTimeout(() => setErrorMsg(""), 3000);
    return () => clearTimeout(t);
  }, [errorMsg]);

  const filteredOverrides = useMemo(() => {
    const q = safeStr(search).toLowerCase();
    const items = Array.isArray(selectedGroup?.courseOverrides)
      ? selectedGroup!.courseOverrides
      : [];

    if (!q) return items;

    return items.filter((item) => {
      const hay = [
        safeStr(item.courseCode),
        safeStr(item.courseTitle),
        safeStr(item.onDemandNote),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [selectedGroup, search]);

  async function saveDefaultRule() {
    if (!selectedCategory) {
      setErrorMsg("Please select a category first.");
      return;
    }

    setSavingDefault(true);
    setErrorMsg("");
    setMessage("");

    try {
      const res = await fetch("/api/admin/on-demand-timing-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          categoryLabel: selectedCategory,
          deliverWithinMinutes: Math.max(1, safeNum(defaultMinutes, DEFAULT_MINUTES)),
          onDemandNote: defaultNote,
          isActive: defaultActive,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setErrorMsg(data?.error || "Failed to save category default rule.");
        return;
      }

      setMessage("Category default timing saved.");
      await loadData(selectedCategory);
    } catch {
      setErrorMsg("Failed to save category default rule.");
    } finally {
      setSavingDefault(false);
    }
  }

  async function saveCourseOverride() {
    if (!selectedCategory) {
      setErrorMsg("Please select a category first.");
      return;
    }

    if (!safeStr(overrideCourseCode)) {
      setErrorMsg("Course code required.");
      return;
    }

    setSavingOverride(true);
    setErrorMsg("");
    setMessage("");

    try {
      const url = editingOverrideId
        ? `/api/admin/on-demand-timing-rules/${encodeURIComponent(editingOverrideId)}`
        : "/api/admin/on-demand-timing-rules";

      const method = editingOverrideId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          categoryLabel: selectedCategory,
          courseCode: safeStr(overrideCourseCode).toUpperCase(),
          deliverWithinMinutes: Math.max(1, safeNum(overrideMinutes, DEFAULT_MINUTES)),
          onDemandNote: overrideNote,
          isActive: overrideActive,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setErrorMsg(data?.error || "Failed to save course override.");
        return;
      }

      setMessage(editingOverrideId ? "Course override updated." : "Course override created.");
      await loadData(selectedCategory);
    } catch {
      setErrorMsg("Failed to save course override.");
    } finally {
      setSavingOverride(false);
    }
  }

  function startEditOverride(rule: TimingRule) {
    setEditingOverrideId(safeStr(rule._id));
    setOverrideCourseCode(safeStr(rule.courseCode));
    setOverrideMinutes(String(Math.max(1, safeNum(rule.deliverWithinMinutes, DEFAULT_MINUTES))));
    setOverrideNote(safeStr(rule.onDemandNote));
    setOverrideActive(Boolean(rule.isActive));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetOverrideForm() {
    setEditingOverrideId("");
    setOverrideCourseCode("");
    setOverrideMinutes(String(DEFAULT_MINUTES));
    setOverrideNote("");
    setOverrideActive(true);
  }

  async function deleteRule(ruleId: string) {
    const yes = window.confirm("Delete this timing rule?");
    if (!yes) return;

    setDeletingId(ruleId);
    setErrorMsg("");
    setMessage("");

    try {
      const res = await fetch(
        `/api/admin/on-demand-timing-rules/${encodeURIComponent(ruleId)}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setErrorMsg(data?.error || "Failed to delete rule.");
        return;
      }

      if (editingOverrideId === ruleId) {
        resetOverrideForm();
      }

      setMessage("Timing rule deleted.");
      await loadData(selectedCategory);
    } catch {
      setErrorMsg("Failed to delete rule.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div className="max-w-[1800px] mx-auto px-4 py-4">
        <div className="rounded-[28px] bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-7 border-b border-gray-200 bg-gradient-to-r from-white to-slate-50">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shadow-sm">
                  <Clock3 size={28} />
                </div>

                <div>
                  <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight">
                    On Demand Timing Rules
                  </h1>
                  <p className="mt-2 text-sm md:text-xl text-slate-600">
                    Category default + course-wise override timer settings
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold shadow-sm"
                >
                  <ArrowLeft size={18} />
                  Back
                </Link>

                <button
                  onClick={() => loadData(selectedCategory)}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold shadow-sm"
                >
                  <RefreshCcw size={18} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 border-b border-gray-200 bg-white">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-3 rounded-3xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                  Categories
                </div>

                <div className="mt-3 space-y-2 max-h-[420px] overflow-auto pr-1">
                  {(allowedCategories.length
                    ? allowedCategories
                    : groups.map((x) => x.categoryLabel)
                  ).map((categoryLabel) => {
                    const group =
                      groups.find((x) => safeStr(x.categoryLabel) === safeStr(categoryLabel)) || null;
                    const isSelected = safeStr(selectedCategory) === safeStr(categoryLabel);

                    return (
                      <button
                        key={categoryLabel}
                        type="button"
                        onClick={() => setSelectedCategory(categoryLabel)}
                        className={`w-full text-left rounded-2xl border px-4 py-3 transition ${
                          isSelected
                            ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                            : "bg-white hover:bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div className="font-extrabold">{categoryLabel}</div>
                        <div
                          className={`mt-1 text-xs font-semibold ${
                            isSelected ? "text-slate-200" : "text-slate-500"
                          }`}
                        >
                          Rules: {group?.totalRules || 0}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-9 grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                  <div className="flex items-center gap-2">
                    <Layers3 size={18} className="text-amber-700" />
                    <div className="font-extrabold text-amber-900">
                      Category Default Rule
                    </div>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                        Selected Category
                      </label>
                      <input
                        value={selectedCategory}
                        readOnly
                        className="mt-1 w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white font-bold text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                        Deliver Within (minutes)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={1440}
                        value={defaultMinutes}
                        onChange={(e) => setDefaultMinutes(e.target.value)}
                        className="mt-1 w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white font-bold text-slate-800 outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                        On Demand Note
                      </label>
                      <textarea
                        value={defaultNote}
                        onChange={(e) => setDefaultNote(e.target.value)}
                        className="mt-1 w-full min-h-[120px] px-4 py-3 rounded-2xl border border-gray-200 bg-white font-medium text-slate-800 outline-none focus:border-amber-500"
                        placeholder="Default trust note for this category"
                      />
                    </div>

                    <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3">
                      <input
                        type="checkbox"
                        checked={defaultActive}
                        onChange={(e) => setDefaultActive(e.target.checked)}
                        className="h-4 w-4"
                      />
                      <span className="font-bold text-slate-800">Rule Active</span>
                    </label>

                    <button
                      type="button"
                      onClick={saveDefaultRule}
                      disabled={savingDefault || !selectedCategory}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold shadow-sm disabled:opacity-60"
                    >
                      <Save size={18} />
                      {savingDefault ? "Saving..." : "Save Category Default"}
                    </button>
                  </div>
                </div>

                <div className="rounded-3xl border border-indigo-200 bg-indigo-50 p-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Plus size={18} className="text-indigo-700" />
                      <div className="font-extrabold text-indigo-900">
                        {editingOverrideId ? "Edit Course Override" : "Add Course Override"}
                      </div>
                    </div>

                    {editingOverrideId ? (
                      <button
                        type="button"
                        onClick={resetOverrideForm}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 font-bold shadow-sm"
                      >
                        <X size={16} />
                        Cancel Edit
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                        Category
                      </label>
                      <input
                        value={selectedCategory}
                        readOnly
                        className="mt-1 w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white font-bold text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                        Course Code
                      </label>
                      <input
                        value={overrideCourseCode}
                        onChange={(e) => setOverrideCourseCode(e.target.value.toUpperCase())}
                        readOnly={Boolean(editingOverrideId)}
                        className={`mt-1 w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white font-bold text-slate-800 outline-none focus:border-indigo-500 ${
                          editingOverrideId ? "cursor-not-allowed bg-slate-50" : ""
                        }`}
                        placeholder="Example: BAG / BAHIH / BCOMG"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                        Deliver Within (minutes)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={1440}
                        value={overrideMinutes}
                        onChange={(e) => setOverrideMinutes(e.target.value)}
                        className="mt-1 w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white font-bold text-slate-800 outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                        On Demand Note
                      </label>
                      <textarea
                        value={overrideNote}
                        onChange={(e) => setOverrideNote(e.target.value)}
                        className="mt-1 w-full min-h-[120px] px-4 py-3 rounded-2xl border border-gray-200 bg-white font-medium text-slate-800 outline-none focus:border-indigo-500"
                        placeholder="Specific trust note for this course"
                      />
                    </div>

                    <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3">
                      <input
                        type="checkbox"
                        checked={overrideActive}
                        onChange={(e) => setOverrideActive(e.target.checked)}
                        className="h-4 w-4"
                      />
                      <span className="font-bold text-slate-800">Rule Active</span>
                    </label>

                    <button
                      type="button"
                      onClick={saveCourseOverride}
                      disabled={savingOverride || !selectedCategory}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold shadow-sm disabled:opacity-60"
                    >
                      <Save size={18} />
                      {savingOverride
                        ? "Saving..."
                        : editingOverrideId
                        ? "Update Course Override"
                        : "Save Course Override"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {message ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                {message}
              </div>
            ) : null}

            {errorMsg ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
                {errorMsg}
              </div>
            ) : null}
          </div>

          <div className="px-6 py-5 border-t border-gray-200 bg-white">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xl font-extrabold text-slate-900">
                  {selectedCategory || "Rules"}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Category default + course-specific override table
                </div>
              </div>

              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search course code or title"
                  className="w-[320px] max-w-[90vw] pl-11 pr-4 py-3 rounded-2xl border border-gray-200 outline-none focus:border-indigo-500 bg-white text-slate-800 font-medium"
                />
              </div>
            </div>

            <div className="mt-5 overflow-x-auto rounded-3xl border border-gray-200">
              <table className="min-w-full">
                <thead className="bg-slate-50">
                  <tr className="text-left">
                    <th className="px-5 py-4 text-sm font-extrabold text-slate-900">Rule Type</th>
                    <th className="px-5 py-4 text-sm font-extrabold text-slate-900">Course</th>
                    <th className="px-5 py-4 text-sm font-extrabold text-slate-900">Minutes</th>
                    <th className="px-5 py-4 text-sm font-extrabold text-slate-900">Status</th>
                    <th className="px-5 py-4 text-sm font-extrabold text-slate-900">Note</th>
                    <th className="px-5 py-4 text-sm font-extrabold text-slate-900">Updated</th>
                    <th className="px-5 py-4 text-sm font-extrabold text-slate-900">Actions</th>
                  </tr>
                </thead>

                <tbody className="bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-slate-600 font-semibold">
                        Loading timing rules...
                      </td>
                    </tr>
                  ) : !selectedGroup?.defaultRule && filteredOverrides.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center">
                        <div className="text-xl font-extrabold text-slate-900">
                          No rules found for this category
                        </div>
                        <div className="mt-2 text-slate-600 font-semibold">
                          Upar form se category default ya course override add karo.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {selectedGroup?.defaultRule ? (
                        <tr className="border-t border-gray-200 align-top bg-amber-50/50">
                          <td className="px-5 py-5">
                            <span className="inline-flex rounded-full bg-amber-500 text-white px-3 py-1 text-xs font-extrabold">
                              Category Default
                            </span>
                          </td>

                          <td className="px-5 py-5 font-bold text-slate-800">All Courses</td>

                          <td className="px-5 py-5">
                            <span className="inline-flex min-w-[48px] h-[40px] items-center justify-center rounded-2xl bg-slate-900 text-white px-4 text-lg font-extrabold">
                              {selectedGroup.defaultRule.deliverWithinMinutes}
                            </span>
                          </td>

                          <td className="px-5 py-5">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-extrabold ${
                                selectedGroup.defaultRule.isActive
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {selectedGroup.defaultRule.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>

                          <td className="px-5 py-5 min-w-[320px] text-sm font-semibold text-slate-700">
                            {selectedGroup.defaultRule.onDemandNote || "-"}
                          </td>

                          <td className="px-5 py-5 min-w-[170px] text-sm font-bold text-slate-700">
                            {fmtDate(
                              selectedGroup.defaultRule.updatedAt ||
                                selectedGroup.defaultRule.lastModifiedAt
                            )}
                          </td>

                          <td className="px-5 py-5 min-w-[150px]">
                            <button
                              type="button"
                              onClick={() => {
                                setDefaultMinutes(
                                  String(
                                    Math.max(
                                      1,
                                      safeNum(
                                        selectedGroup.defaultRule?.deliverWithinMinutes,
                                        DEFAULT_MINUTES
                                      )
                                    )
                                  )
                                );
                                setDefaultNote(safeStr(selectedGroup.defaultRule?.onDemandNote));
                                setDefaultActive(Boolean(selectedGroup.defaultRule?.isActive));
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold shadow-sm"
                            >
                              <Pencil size={16} />
                              Edit
                            </button>
                          </td>
                        </tr>
                      ) : null}

                      {filteredOverrides.map((rule) => (
                        <tr key={rule._id} className="border-t border-gray-200 align-top">
                          <td className="px-5 py-5">
                            <span className="inline-flex rounded-full bg-indigo-100 text-indigo-800 px-3 py-1 text-xs font-extrabold">
                              Course Override
                            </span>
                          </td>

                          <td className="px-5 py-5 min-w-[220px]">
                            <div className="text-[15px] font-extrabold text-slate-900">
                              {rule.courseCode}
                            </div>
                            <div className="mt-1 text-sm text-slate-500">
                              {rule.courseTitle || "-"}
                            </div>
                          </td>

                          <td className="px-5 py-5">
                            <span className="inline-flex min-w-[48px] h-[40px] items-center justify-center rounded-2xl bg-indigo-600 text-white px-4 text-lg font-extrabold">
                              {rule.deliverWithinMinutes}
                            </span>
                          </td>

                          <td className="px-5 py-5">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-extrabold ${
                                rule.isActive
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {rule.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>

                          <td className="px-5 py-5 min-w-[320px] text-sm font-semibold text-slate-700">
                            {rule.onDemandNote || "-"}
                          </td>

                          <td className="px-5 py-5 min-w-[170px] text-sm font-bold text-slate-700">
                            {fmtDate(rule.updatedAt || rule.lastModifiedAt)}
                          </td>

                          <td className="px-5 py-5 min-w-[220px]">
                            <div className="flex items-center gap-3 flex-wrap">
                              <button
                                type="button"
                                onClick={() => startEditOverride(rule)}
                                className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold shadow-sm"
                              >
                                <Pencil size={16} />
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => deleteRule(rule._id)}
                                disabled={deletingId === rule._id}
                                className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-rose-50 border border-gray-200 transition font-bold shadow-sm disabled:opacity-60"
                              >
                                <Trash2 size={16} />
                                {deletingId === rule._id ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}