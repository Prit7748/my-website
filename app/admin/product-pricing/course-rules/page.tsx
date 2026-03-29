"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCcw,
  IndianRupee,
  Save,
  Trash2,
  ShieldAlert,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type CourseItem = {
  _id?: string;
  code: string;
  title?: string;
  isActive?: boolean;
};

type PricingRuleItem = {
  _id: string;
  key: string;
  ruleType: "course_rule" | "product_override";
  category: string;
  courseCode?: string;
  courseTitle?: string;
  price: number;
  oldPrice?: number;
  isActive?: boolean;
  notes?: string;
  updatedBy?: string;
  updatedAt?: string;
  lastAppliedAt?: string | null;
};

type BootstrapResponse = {
  ok?: boolean;
  error?: string;
  categories?: string[];
  courses?: CourseItem[];
  courseRules?: PricingRuleItem[];
};

const PAGE_SIZES = [25, 50, 100] as const;

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function formatDate(input?: string | null) {
  if (!input) return "-";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-IN");
}

export default function CourseRulesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState<string[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [courseRules, setCourseRules] = useState<PricingRuleItem[]>([]);

  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error" | "info">("info");
  const [courseSearch, setCourseSearch] = useState("");

  const [resultsSearch, setResultsSearch] = useState("");
  const [resultsCategory, setResultsCategory] = useState("");
  const [resultsPage, setResultsPage] = useState(1);
  const [resultsPageSize, setResultsPageSize] = useState<number>(25);

  const [courseRuleForm, setCourseRuleForm] = useState({
    category: "Solved Assignments",
    courseCodes: [] as string[],
    selectAllCourses: false,
    price: "",
    oldPrice: "",
    notes: "",
    isActive: true,
    applyToExisting: true,
  });

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/product-pricing?page=1&pageSize=25`, {
        credentials: "include",
        cache: "no-store",
      });

      const data = (await res.json()) as BootstrapResponse;

      if (!res.ok || !data?.ok) {
        setMsg(data?.error || "Failed to load course pricing data");
        setMsgType("error");
        return;
      }

      const nextCategories = Array.isArray(data.categories) ? data.categories : [];
      setCategories(nextCategories);
      setCourses(Array.isArray(data.courses) ? data.courses : []);
      setCourseRules(
        (Array.isArray(data.courseRules) ? data.courseRules : []).filter(
          (r) => r.ruleType === "course_rule"
        )
      );

      setCourseRuleForm((prev) => {
        const fallbackCategory = nextCategories[0] || "Solved Assignments";
        const finalCategory = nextCategories.includes(prev.category)
          ? prev.category
          : fallbackCategory;
        return finalCategory === prev.category ? prev : { ...prev, category: finalCategory };
      });
    } catch (e: any) {
      setMsg(e?.message || "Failed to load course pricing data");
      setMsgType("error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredCourses = useMemo(() => {
    const q = courseSearch.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => {
      const code = String(c.code || "").toLowerCase();
      const title = String(c.title || "").toLowerCase();
      return code.includes(q) || title.includes(q);
    });
  }, [courses, courseSearch]);

  const visibleCourseCodes = useMemo(() => {
    return filteredCourses.map((c) => c.code);
  }, [filteredCourses]);

  const selectedCourseSet = useMemo(() => {
    return new Set(courseRuleForm.courseCodes);
  }, [courseRuleForm.courseCodes]);

  const filteredRules = useMemo(() => {
    const q = resultsSearch.trim().toLowerCase();
    const category = resultsCategory.trim();

    return courseRules.filter((r) => {
      if (category && r.category !== category) return false;

      if (!q) return true;

      const hay = [
        r.category,
        r.courseCode,
        r.courseTitle,
        r.notes,
        r.updatedBy,
        r.key,
      ]
        .map((x) => String(x || "").toLowerCase())
        .join(" ");

      return hay.includes(q);
    });
  }, [courseRules, resultsSearch, resultsCategory]);

  const totalFilteredRules = filteredRules.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredRules / resultsPageSize));

  useEffect(() => {
    setResultsPage(1);
  }, [resultsSearch, resultsCategory, resultsPageSize]);

  useEffect(() => {
    if (resultsPage > totalPages) {
      setResultsPage(totalPages);
    }
  }, [resultsPage, totalPages]);

  const pagedRules = useMemo(() => {
    const start = (resultsPage - 1) * resultsPageSize;
    return filteredRules.slice(start, start + resultsPageSize);
  }, [filteredRules, resultsPage, resultsPageSize]);

  function toggleCourse(code: string) {
    setCourseRuleForm((prev) => {
      const next = new Set(prev.courseCodes);
      if (next.has(code)) next.delete(code);
      else next.add(code);

      return {
        ...prev,
        selectAllCourses: false,
        courseCodes: Array.from(next),
      };
    });
  }

  function selectVisibleCourses() {
    setCourseRuleForm((prev) => ({
      ...prev,
      selectAllCourses: false,
      courseCodes: Array.from(new Set([...prev.courseCodes, ...visibleCourseCodes])),
    }));
  }

  function clearVisibleCourses() {
    const visible = new Set(visibleCourseCodes);
    setCourseRuleForm((prev) => ({
      ...prev,
      selectAllCourses: false,
      courseCodes: prev.courseCodes.filter((c) => !visible.has(c)),
    }));
  }

  async function saveCourseRule() {
    if (!courseRuleForm.category.trim()) {
      alert("Category required hai.");
      return;
    }

    if (!courseRuleForm.selectAllCourses && !courseRuleForm.courseCodes.length) {
      alert("Kam se kam ek course select karo ya Select All use karo.");
      return;
    }

    if (safeNum(courseRuleForm.price, 0) <= 0) {
      alert("Valid price required hai.");
      return;
    }

    setSaving(true);
    setMsg("");

    try {
      const res = await fetch("/api/admin/product-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "upsert_course_rule",
          category: courseRuleForm.category,
          courseCodes: courseRuleForm.courseCodes,
          selectAllCourses: courseRuleForm.selectAllCourses,
          price: Number(courseRuleForm.price),
          oldPrice: Number(courseRuleForm.oldPrice || 0),
          notes: courseRuleForm.notes,
          isActive: courseRuleForm.isActive,
          applyToExisting: courseRuleForm.applyToExisting,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg((data as any)?.error || "Failed to save course rules");
        setMsgType("error");
        return;
      }

      setMsg((data as any)?.message || "Course pricing rules saved.");
      setMsgType("success");
      await loadData();
    } catch (e: any) {
      setMsg(e?.message || "Failed to save course rules");
      setMsgType("error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRule(ruleId: string) {
    const ok = confirm("Kya aap is course pricing rule ko delete karna chahte ho?");
    if (!ok) return;

    setSaving(true);
    setMsg("");

    try {
      const res = await fetch("/api/admin/product-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "delete_rule",
          ruleId,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg((data as any)?.error || "Failed to delete rule");
        setMsgType("error");
        return;
      }

      setMsg((data as any)?.message || "Rule deleted successfully.");
      setMsgType("success");
      await loadData();
    } catch (e: any) {
      setMsg(e?.message || "Failed to delete rule");
      setMsgType("error");
    } finally {
      setSaving(false);
    }
  }

  function goToPage(nextPage: number) {
    const safePage = Math.min(Math.max(nextPage, 1), totalPages);
    setResultsPage(safePage);
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-2xl font-extrabold flex items-center gap-2">
                <IndianRupee size={24} />
                Course Price Rules
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Yahan category + multi-course pricing rules alag se manage honge.
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => loadData()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <RefreshCcw size={18} />
                Refresh
              </button>

              <Link
                href="/admin/product-pricing"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <ArrowLeft size={18} />
                Back to Product Pricing
              </Link>
            </div>
          </div>

          {msg ? (
            <div
              className={`mt-5 rounded-2xl border p-4 text-sm font-semibold ${
                msgType === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : msgType === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : "border-blue-200 bg-blue-50 text-blue-800"
              }`}
            >
              {msg}
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 leading-6">
            <div className="inline-flex items-start gap-2">
              <ShieldAlert size={18} className="mt-0.5 shrink-0" />
              <div>
                Is page par aap multi-course ya select-all active courses par same pricing rule apply kar sakte ho, aur niche saved rules ko search/filter/paging ke saath manage kar sakte ho.
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <div className="text-sm font-extrabold mb-4">Create / Update Course Price Rules</div>

            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Category</label>
            <select
              value={courseRuleForm.category}
              onChange={(e) => setCourseRuleForm((p) => ({ ...p, category: e.target.value }))}
              className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <label className="inline-flex items-center gap-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={courseRuleForm.selectAllCourses}
                  onChange={(e) =>
                    setCourseRuleForm((p) => ({
                      ...p,
                      selectAllCourses: e.target.checked,
                      courseCodes: e.target.checked ? [] : p.courseCodes,
                    }))
                  }
                  className="h-4 w-4"
                />
                Select All Active Courses
              </label>

              <div className="text-xs text-slate-500">
                {courseRuleForm.selectAllCourses
                  ? `All active courses selected (${courses.length})`
                  : `Selected courses: ${courseRuleForm.courseCodes.length}`}
              </div>
            </div>

            {!courseRuleForm.selectAllCourses ? (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-xs font-bold text-slate-500 uppercase">Multi Course Select</div>

                <div className="relative mt-2">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    placeholder="Search course code or title..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 outline-none"
                  />
                </div>

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={selectVisibleCourses}
                    className="px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-bold"
                  >
                    Select Visible
                  </button>
                  <button
                    type="button"
                    onClick={clearVisibleCourses}
                    className="px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-bold"
                  >
                    Clear Visible
                  </button>
                </div>

                <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-gray-200">
                  {filteredCourses.length ? (
                    filteredCourses.map((c) => {
                      const checked = selectedCourseSet.has(c.code);
                      return (
                        <label
                          key={c.code}
                          className="flex items-start gap-3 px-4 py-3 border-b last:border-b-0 bg-white hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCourse(c.code)}
                            className="h-4 w-4 mt-0.5"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-sm">{c.code}</div>
                            <div className="text-xs text-slate-500">{c.title || "-"}</div>
                          </div>
                        </label>
                      );
                    })
                  ) : (
                    <div className="px-4 py-8 text-sm text-slate-500 text-center">
                      No courses found.
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Price</label>
                <input
                  value={courseRuleForm.price}
                  onChange={(e) => setCourseRuleForm((p) => ({ ...p, price: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  placeholder="49"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Old Price</label>
                <input
                  value={courseRuleForm.oldPrice}
                  onChange={(e) => setCourseRuleForm((p) => ({ ...p, oldPrice: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  placeholder="79"
                />
              </div>
            </div>

            <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">Note</label>
            <textarea
              value={courseRuleForm.notes}
              onChange={(e) => setCourseRuleForm((p) => ({ ...p, notes: e.target.value }))}
              className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[90px]"
              placeholder="Optional internal admin note"
            />

            <div className="flex items-center gap-3 mt-4">
              <input
                type="checkbox"
                checked={courseRuleForm.isActive}
                onChange={(e) => setCourseRuleForm((p) => ({ ...p, isActive: e.target.checked }))}
                className="h-4 w-4"
              />
              <div className="font-bold text-sm">Rule Active</div>
            </div>

            <div className="flex items-center gap-3 mt-3">
              <input
                type="checkbox"
                checked={courseRuleForm.applyToExisting}
                onChange={(e) => setCourseRuleForm((p) => ({ ...p, applyToExisting: e.target.checked }))}
                className="h-4 w-4"
              />
              <div className="font-bold text-sm">Apply to all existing matching products now</div>
            </div>

            <button
              type="button"
              onClick={saveCourseRule}
              disabled={saving}
              className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-950 text-white font-extrabold disabled:opacity-60"
            >
              <Save size={18} />
              {saving ? "Saving..." : "Save Course Rule(s)"}
            </button>
          </div>

          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-sm font-extrabold">Saved Course Rules</div>
                <div className="text-xs text-slate-500 mt-1">
                  Search, category filter aur paging ke saath manage karo.
                </div>
              </div>

              <div className="text-sm text-slate-600">
                Total matched rules: <b>{totalFilteredRules}</b>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_280px_160px_auto] gap-3">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={resultsSearch}
                  onChange={(e) => setResultsSearch(e.target.value)}
                  placeholder="Search by course code, title, category, note..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white outline-none"
                />
              </div>

              <select
                value={resultsCategory}
                onChange={(e) => setResultsCategory(e.target.value)}
                className="px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={resultsPageSize}
                onChange={(e) => setResultsPageSize(Number(e.target.value))}
                className="px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  setResultsSearch("");
                  setResultsCategory("");
                  setResultsPage(1);
                }}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 font-bold"
              >
                Clear Filters
              </button>
            </div>

            <div className="mt-5 overflow-auto">
              <table className="min-w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 border-b">Category</th>
                    <th className="text-left px-3 py-2 border-b">Course</th>
                    <th className="text-left px-3 py-2 border-b">Price</th>
                    <th className="text-left px-3 py-2 border-b">Old</th>
                    <th className="text-left px-3 py-2 border-b">Updated</th>
                    <th className="text-left px-3 py-2 border-b">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        Loading rules...
                      </td>
                    </tr>
                  ) : pagedRules.length ? (
                    pagedRules.map((r) => (
                      <tr key={r._id} className="border-b last:border-b-0">
                        <td className="px-3 py-2 min-w-[180px]">{r.category}</td>
                        <td className="px-3 py-2 min-w-[220px]">
                          <div className="font-semibold">{r.courseCode || "-"}</div>
                          <div className="text-xs text-slate-500">{r.courseTitle || ""}</div>
                        </td>
                        <td className="px-3 py-2 font-bold">₹{safeNum(r.price, 0)}</td>
                        <td className="px-3 py-2">₹{safeNum(r.oldPrice, 0)}</td>
                        <td className="px-3 py-2 text-xs">
                          {formatDate(r.updatedAt)}
                          <div className="text-slate-400 mt-1">Applied: {formatDate(r.lastAppliedAt)}</div>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => deleteRule(r._id)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-rose-50 border border-gray-200 font-bold"
                          >
                            <Trash2 size={15} />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No course pricing rules found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm text-slate-600">
                Page <b>{resultsPage}</b> of <b>{totalPages}</b>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={resultsPage <= 1}
                  onClick={() => goToPage(resultsPage - 1)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 font-bold disabled:opacity-50"
                >
                  <ChevronLeft size={16} />
                  Prev
                </button>

                <button
                  type="button"
                  disabled={resultsPage >= totalPages}
                  onClick={() => goToPage(resultsPage + 1)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 font-bold disabled:opacity-50"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 leading-6">
            Ab saved course rules section me:
            <br />
            1. Search box
            <br />
            2. Category filter
            <br />
            3. 25 / 50 / 100 paging
            <br />
            teeno aa gaye hain.
          </div>
        </div>
      </div>
    </main>
  );
}