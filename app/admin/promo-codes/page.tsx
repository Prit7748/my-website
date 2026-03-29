"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgePercent,
  Plus,
  Save,
  Pencil,
  Trash2,
  RefreshCcw,
  Search,
  Eye,
  BarChart3,
  Check,
} from "lucide-react";

type PromoCodeItem = {
  _id: string;
  code: string;
  title: string;
  description?: string;
  badgeText?: string;
  isActive?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  discountType?: "percent" | "fixed" | string;
  discountValue?: number;
  maxDiscountAmount?: number;
  totalUsageLimit?: number;
  perUserUsageLimit?: number;
  totalUsedCount?: number;
  firstOrderOnly?: boolean;
  minOrderAmount?: number;
  minCartQuantity?: number;
  minDistinctProducts?: number;
  minDistinctCategories?: number;
  allowCombos?: boolean;
  allowResellers?: boolean;
  isAutoApply?: boolean;
  isStackable?: boolean;
  allowedCategories?: string[];
  blockedCategories?: string[];
  requiredCategoryRules?: Array<{ categoryKey: string; minQty: number }>;
  publicNote?: string;
  internalNote?: string;
  priority?: number;
  createdAt?: string;
  updatedAt?: string;
};

type PromoListResponse = {
  ok?: boolean;
  items?: PromoCodeItem[];
  total?: number;
  page?: number;
  totalPages?: number;
};

const CATEGORY_OPTIONS = [
  { value: "solved assignments", label: "Solved Assignments", desc: "Session-wise solved PDFs" },
  { value: "question papers pyq", label: "Question Papers (PYQ)", desc: "Previous year papers" },
  { value: "guess papers", label: "Guess Papers", desc: "Exam-focused guess material" },
  { value: "ebooks", label: "Ebooks / Notes", desc: "Notes, ebooks, revision files" },
  { value: "handwritten pdfs", label: "Handwritten PDFs", desc: "Handwritten PDF material" },
  {
    value: "handwritten hardcopy",
    label: "Handwritten Hardcopy (Delivery)",
    desc: "Physical handwritten delivery items",
  },
  { value: "projects synopsis", label: "Projects & Synopsis", desc: "Project reports and synopsis" },
  { value: "combo", label: "Combo", desc: "Builder combos and combo packs" },
] as const;

type CategoryOption = (typeof CATEGORY_OPTIONS)[number];
type CategoryValue = CategoryOption["value"];

type RequiredCategoryRule = {
  categoryKey: CategoryValue;
  minQty: number;
};

type PromoFormState = {
  code: string;
  title: string;
  description: string;
  badgeText: string;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
  discountType: "percent" | "fixed";
  discountValue: string;
  maxDiscountAmount: string;
  totalUsageLimit: string;
  perUserUsageLimit: string;
  firstOrderOnly: boolean;
  minOrderAmount: string;
  minCartQuantity: string;
  minDistinctProducts: string;
  minDistinctCategories: string;
  allowCombos: boolean;
  allowResellers: boolean;
  isAutoApply: boolean;
  isStackable: boolean;
  allowedCategories: CategoryValue[];
  requiredCategoryRules: RequiredCategoryRule[];
  publicNote: string;
  internalNote: string;
  priority: string;
};

const CATEGORY_VALUES: CategoryValue[] = CATEGORY_OPTIONS.map(
  (option) => option.value
) as CategoryValue[];

const CATEGORY_MAP = new Map<CategoryValue, CategoryOption>(
  CATEGORY_OPTIONS.map((option) => [option.value, option])
);

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function toInputDateTime(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function uniqueStrings<T extends string>(arr: T[]) {
  return Array.from(new Set(arr.filter(Boolean))) as T[];
}

function normalizeCategoryKey(input: any) {
  const raw = safeStr(input)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[()]/g, " ")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (raw.includes("solved") && raw.includes("assignment")) return "solved assignments";
  if (raw.includes("question") || raw.includes("pyq")) return "question papers pyq";
  if (raw.includes("guess")) return "guess papers";
  if (raw.includes("ebook") || raw.includes("e book") || raw.includes("notes")) return "ebooks";
  if (raw.includes("hardcopy")) return "handwritten hardcopy";
  if (raw.includes("handwritten") && raw.includes("pdf")) return "handwritten pdfs";
  if (raw.includes("project")) return "projects synopsis";
  if (raw.includes("combo")) return "combo";

  return raw;
}

function isCategoryValue(value: string): value is CategoryValue {
  return CATEGORY_VALUES.includes(value as CategoryValue);
}

function normalizeKnownCategory(input: any): CategoryValue | "" {
  const key = normalizeCategoryKey(input);
  return isCategoryValue(key) ? key : "";
}

function normalizeCategoryArray(input: any): CategoryValue[] {
  const arr = Array.isArray(input) ? input : [];
  const out: CategoryValue[] = [];

  for (const item of arr) {
    const normalized = normalizeKnownCategory(item);
    if (normalized) out.push(normalized);
  }

  return uniqueStrings(out);
}

function normalizeRequiredCategoryRules(input: any): RequiredCategoryRule[] {
  const arr = Array.isArray(input) ? input : [];
  const out: RequiredCategoryRule[] = [];

  for (const item of arr) {
    const categoryKey = normalizeKnownCategory(item?.categoryKey);
    if (!categoryKey) continue;

    out.push({
      categoryKey,
      minQty: Math.max(1, Number(item?.minQty || 1)),
    });
  }

  return out;
}

function emptyForm(): PromoFormState {
  return {
    code: "",
    title: "",
    description: "",
    badgeText: "",
    isActive: true,
    startsAt: "",
    endsAt: "",
    discountType: "percent",
    discountValue: "",
    maxDiscountAmount: "",
    totalUsageLimit: "",
    perUserUsageLimit: "1",
    firstOrderOnly: false,
    minOrderAmount: "",
    minCartQuantity: "",
    minDistinctProducts: "",
    minDistinctCategories: "",
    allowCombos: true,
    allowResellers: true,
    isAutoApply: false,
    isStackable: false,
    allowedCategories: [],
    requiredCategoryRules: [],
    publicNote: "",
    internalNote: "",
    priority: "0",
  };
}

function formFromItem(item: PromoCodeItem): PromoFormState {
  return {
    code: safeStr(item.code),
    title: safeStr(item.title),
    description: safeStr(item.description),
    badgeText: safeStr(item.badgeText),
    isActive: !!item.isActive,
    startsAt: toInputDateTime(item.startsAt),
    endsAt: toInputDateTime(item.endsAt),
    discountType: safeStr(item.discountType).toLowerCase() === "fixed" ? "fixed" : "percent",
    discountValue: String(item.discountValue ?? ""),
    maxDiscountAmount: String(item.maxDiscountAmount ?? ""),
    totalUsageLimit: String(item.totalUsageLimit ?? ""),
    perUserUsageLimit: String(item.perUserUsageLimit ?? 1),
    firstOrderOnly: !!item.firstOrderOnly,
    minOrderAmount: String(item.minOrderAmount ?? ""),
    minCartQuantity: String(item.minCartQuantity ?? ""),
    minDistinctProducts: String(item.minDistinctProducts ?? ""),
    minDistinctCategories: String(item.minDistinctCategories ?? ""),
    allowCombos: item.allowCombos !== false,
    allowResellers: item.allowResellers !== false,
    isAutoApply: !!item.isAutoApply,
    isStackable: !!item.isStackable,
    allowedCategories: normalizeCategoryArray(item.allowedCategories),
    requiredCategoryRules: normalizeRequiredCategoryRules(item.requiredCategoryRules),
    publicNote: safeStr(item.publicNote),
    internalNote: safeStr(item.internalNote),
    priority: String(item.priority ?? 0),
  };
}

function buildPayload(form: PromoFormState) {
  return {
    code: safeStr(form.code).toUpperCase(),
    title: safeStr(form.title),
    description: safeStr(form.description),
    badgeText: safeStr(form.badgeText),
    isActive: !!form.isActive,
    startsAt: safeStr(form.startsAt) ? new Date(form.startsAt).toISOString() : "",
    endsAt: safeStr(form.endsAt) ? new Date(form.endsAt).toISOString() : "",
    discountType: form.discountType,
    discountValue: Number(form.discountValue || 0),
    maxDiscountAmount: Number(form.maxDiscountAmount || 0),
    totalUsageLimit: Number(form.totalUsageLimit || 0),
    perUserUsageLimit: Number(form.perUserUsageLimit || 0),
    firstOrderOnly: !!form.firstOrderOnly,
    minOrderAmount: Number(form.minOrderAmount || 0),
    minCartQuantity: Number(form.minCartQuantity || 0),
    minDistinctProducts: Number(form.minDistinctProducts || 0),
    minDistinctCategories: Number(form.minDistinctCategories || 0),
    allowCombos: !!form.allowCombos,
    allowResellers: !!form.allowResellers,
    isAutoApply: !!form.isAutoApply,
    isStackable: !!form.isStackable,
    allowedCategories: uniqueStrings(form.allowedCategories),
    blockedCategories: [],
    requiredCategoryRules: form.requiredCategoryRules.map((rule) => ({
      categoryKey: rule.categoryKey,
      minQty: Math.max(1, Number(rule.minQty || 1)),
    })),
    publicNote: safeStr(form.publicNote),
    internalNote: safeStr(form.internalNote),
    priority: Number(form.priority || 0),
  };
}

async function apiFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...(init || {}),
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || "Request failed");
  }

  return data;
}

function CategoryToggleCard({
  label,
  desc,
  selected,
  onClick,
  tone = "blue",
}: {
  label: string;
  desc: string;
  selected: boolean;
  onClick: () => void;
  tone?: "blue" | "violet";
}) {
  const toneMap = {
    blue: selected
      ? "border-blue-300 bg-blue-50 text-blue-900"
      : "border-gray-200 bg-white text-slate-800 hover:border-blue-200 hover:bg-blue-50/40",
    violet: selected
      ? "border-violet-300 bg-violet-50 text-violet-900"
      : "border-gray-200 bg-white text-slate-800 hover:border-violet-200 hover:bg-violet-50/40",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl border p-3 transition ${toneMap[tone]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-extrabold text-sm">{label}</div>
          <div className="text-[11px] mt-1 opacity-80">{desc}</div>
        </div>
        <div
          className={`h-6 w-6 rounded-full border flex items-center justify-center shrink-0 ${
            selected ? "bg-white border-current" : "bg-gray-50 border-gray-300"
          }`}
        >
          {selected ? <Check size={14} /> : null}
        </div>
      </div>
    </button>
  );
}

export default function PromoCodesAdminPage() {
  const [items, setItems] = useState<PromoCodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<PromoFormState>(emptyForm());
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [message, setMessage] = useState("");

  async function load(nextQuery?: string, nextStatus?: "all" | "active" | "inactive") {
    setLoading(true);
    try {
      const finalQuery = safeStr(nextQuery ?? query);
      const finalStatus = nextStatus ?? status;

      const qs = new URLSearchParams();
      qs.set("limit", "100");
      if (finalQuery) qs.set("q", finalQuery);
      if (finalStatus !== "all") qs.set("status", finalStatus);

      const data: PromoListResponse = await apiFetch(`/api/admin/promo-codes?${qs.toString()}`);
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e: any) {
      setItems([]);
      setMessage(e?.message || "Failed to load promo codes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load("", "all");
  }, []);

  const summary = useMemo(() => {
    const total = items.length;
    const active = items.filter((x) => x.isActive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [items]);

  function resetForm() {
    setSelectedId("");
    setForm(emptyForm());
  }

  function editItem(item: PromoCodeItem) {
    setSelectedId(item._id);
    setForm(formFromItem(item));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleAllowedCategory(categoryKey: CategoryValue) {
    setForm((prev) => {
      const exists = prev.allowedCategories.includes(categoryKey);
      return {
        ...prev,
        allowedCategories: exists
          ? prev.allowedCategories.filter((x) => x !== categoryKey)
          : [...prev.allowedCategories, categoryKey],
      };
    });
  }

  function toggleRequiredCategoryRule(categoryKey: CategoryValue) {
    setForm((prev) => {
      const exists = prev.requiredCategoryRules.some((x) => x.categoryKey === categoryKey);
      return {
        ...prev,
        requiredCategoryRules: exists
          ? prev.requiredCategoryRules.filter((x) => x.categoryKey !== categoryKey)
          : [...prev.requiredCategoryRules, { categoryKey, minQty: 1 }],
      };
    });
  }

  function updateRequiredRuleQty(categoryKey: CategoryValue, minQty: number) {
    setForm((prev) => ({
      ...prev,
      requiredCategoryRules: prev.requiredCategoryRules.map((rule) =>
        rule.categoryKey === categoryKey
          ? { ...rule, minQty: Math.max(1, Number(minQty || 1)) }
          : rule
      ),
    }));
  }

  async function save() {
    setSaving(true);
    setMessage("");

    try {
      const payload = buildPayload(form);

      if (!payload.code) throw new Error("Promo code required");
      if (!payload.title) throw new Error("Title required");
      if (!(Number(payload.discountValue) > 0)) {
        throw new Error("Discount value must be greater than 0");
      }

      if (selectedId) {
        const data = await apiFetch(`/api/admin/promo-codes/${selectedId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        const updatedItem = data?.item as PromoCodeItem | undefined;
        if (updatedItem?._id) {
          setItems((prev) =>
            prev.map((item) => (item._id === updatedItem._id ? updatedItem : item))
          );
        }

        setMessage("Promo code updated successfully ✅");
      } else {
        const data = await apiFetch("/api/admin/promo-codes", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        const createdItem = data?.item as PromoCodeItem | undefined;
        if (createdItem?._id) {
          setItems((prev) => {
            const next = [createdItem, ...prev.filter((item) => item._id !== createdItem._id)];
            return next;
          });
        }

        setMessage("Promo code created successfully ✅");
      }

      resetForm();
      setQuery("");
      setStatus("all");
      await load("", "all");
    } catch (e: any) {
      setMessage(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(id: string) {
    const ok = window.confirm("Delete this promo code?");
    if (!ok) return;

    setDeletingId(id);
    setMessage("");

    try {
      await apiFetch(`/api/admin/promo-codes/${id}`, { method: "DELETE" });
      if (selectedId === id) resetForm();
      setItems((prev) => prev.filter((item) => item._id !== id));
      setMessage("Promo code deleted successfully ✅");
      await load("", "all");
    } catch (e: any) {
      setMessage(e?.message || "Delete failed");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-2xl font-extrabold flex items-center gap-2">
                <BadgePercent className="text-slate-700" />
                Promo Codes
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Create, edit, enable, disable, and manage advanced coupon rules from one place.
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Link
                href="/admin/promo-codes/usage"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-semibold shadow-sm"
              >
                <BarChart3 size={18} />
                Usage Data
              </Link>

              <Link
                href="/admin/site-settings"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <ArrowLeft size={18} />
                Back
              </Link>
            </div>
          </div>

          {message ? (
            <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900">
              {message}
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-extrabold">
                      {selectedId ? "Edit Promo Code" : "Create Promo Code"}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      Advanced rules yahin se set hongi.
                    </div>
                  </div>

                  <button
                    onClick={resetForm}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold text-sm"
                  >
                    <Plus size={16} />
                    New
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600">Promo Code</label>
                    <input
                      value={form.code}
                      onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold uppercase"
                      placeholder="IGNOU20"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Title</label>
                    <input
                      value={form.title}
                      onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                      placeholder="Festive Discount"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-600">Description</label>
                    <input
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                      placeholder="Shown in admin, can also help for future offer page"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Badge</label>
                    <input
                      value={form.badgeText}
                      onChange={(e) => setForm((p) => ({ ...p, badgeText: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                      placeholder="LIMITED"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Priority</label>
                    <input
                      type="number"
                      value={form.priority}
                      onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Discount Type</label>
                    <select
                      value={form.discountType}
                      onChange={(e) => setForm((p) => ({ ...p, discountType: e.target.value as "percent" | "fixed" }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="percent">Percent</option>
                      <option value="fixed">Fixed Amount</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Discount Value</label>
                    <input
                      type="number"
                      value={form.discountValue}
                      onChange={(e) => setForm((p) => ({ ...p, discountValue: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                      placeholder="20"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Max Discount Cap</label>
                    <input
                      type="number"
                      value={form.maxDiscountAmount}
                      onChange={(e) => setForm((p) => ({ ...p, maxDiscountAmount: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                      placeholder="0 = no cap"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Min Order Amount</label>
                    <input
                      type="number"
                      value={form.minOrderAmount}
                      onChange={(e) => setForm((p) => ({ ...p, minOrderAmount: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Total Usage Limit</label>
                    <input
                      type="number"
                      value={form.totalUsageLimit}
                      onChange={(e) => setForm((p) => ({ ...p, totalUsageLimit: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                      placeholder="0 = unlimited"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Per User Limit</label>
                    <input
                      type="number"
                      value={form.perUserUsageLimit}
                      onChange={(e) => setForm((p) => ({ ...p, perUserUsageLimit: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Min Cart Qty</label>
                    <input
                      type="number"
                      value={form.minCartQuantity}
                      onChange={(e) => setForm((p) => ({ ...p, minCartQuantity: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Min Distinct Products</label>
                    <input
                      type="number"
                      value={form.minDistinctProducts}
                      onChange={(e) => setForm((p) => ({ ...p, minDistinctProducts: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Min Distinct Categories</label>
                    <input
                      type="number"
                      value={form.minDistinctCategories}
                      onChange={(e) => setForm((p) => ({ ...p, minDistinctCategories: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Start Date</label>
                    <input
                      type="datetime-local"
                      value={form.startsAt}
                      onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">End Date</label>
                    <input
                      type="datetime-local"
                      value={form.endsAt}
                      onChange={(e) => setForm((p) => ({ ...p, endsAt: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      ["isActive", "Active"],
                      ["firstOrderOnly", "First Order Only"],
                      ["allowCombos", "Allow Combos"],
                      ["allowResellers", "Allow Resellers"],
                      ["isAutoApply", "Auto Apply"],
                      ["isStackable", "Stackable"],
                    ].map(([key, label]) => (
                      <label
                        key={key}
                        className="rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm font-bold flex items-center gap-2"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean((form as any)[key])}
                          onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.checked }))}
                        />
                        {label}
                      </label>
                    ))}
                  </div>

                  <div className="md:col-span-2 rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="text-xs font-bold text-slate-600">Allowed Categories</div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      Jo categories yahan select hongi, promo sirf unhi par active hoga. Blank chhodne par promo all eligible categories par chalega.
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {CATEGORY_OPTIONS.map((option) => (
                        <CategoryToggleCard
                          key={option.value}
                          label={option.label}
                          desc={option.desc}
                          selected={form.allowedCategories.includes(option.value)}
                          onClick={() => toggleAllowedCategory(option.value)}
                          tone="blue"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="md:col-span-2 rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="text-xs font-bold text-slate-600">Required Category Rules</div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      Yahan se select karo kis category me minimum quantity match honi chahiye.
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {CATEGORY_OPTIONS.map((option) => {
                        const selectedRule = form.requiredCategoryRules.find(
                          (x) => x.categoryKey === option.value
                        );

                        return (
                          <div
                            key={option.value}
                            className={`rounded-2xl border p-3 ${
                              selectedRule
                                ? "border-violet-300 bg-violet-50"
                                : "border-gray-200 bg-white"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <button
                                type="button"
                                onClick={() => toggleRequiredCategoryRule(option.value)}
                                className="text-left flex-1"
                              >
                                <div className="font-extrabold text-sm">{option.label}</div>
                                <div className="text-[11px] mt-1 text-slate-600">{option.desc}</div>
                              </button>

                              <div
                                className={`h-6 w-6 rounded-full border flex items-center justify-center shrink-0 ${
                                  selectedRule
                                    ? "bg-white border-violet-400 text-violet-700"
                                    : "bg-gray-50 border-gray-300 text-gray-400"
                                }`}
                              >
                                {selectedRule ? <Check size={14} /> : null}
                              </div>
                            </div>

                            {selectedRule ? (
                              <div className="mt-3">
                                <label className="text-[11px] font-bold text-violet-700">
                                  Minimum Quantity
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  value={selectedRule.minQty}
                                  onChange={(e) =>
                                    updateRequiredRuleQty(option.value, Number(e.target.value || 1))
                                  }
                                  className="mt-1 w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-bold"
                                />
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-600">Public Note</label>
                    <textarea
                      value={form.publicNote}
                      onChange={(e) => setForm((p) => ({ ...p, publicNote: e.target.value }))}
                      className="mt-1 w-full min-h-[80px] rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm"
                      placeholder="Visible note for future offer page / coupon hints"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-600">Internal Note</label>
                    <textarea
                      value={form.internalNote}
                      onChange={(e) => setForm((p) => ({ ...p, internalNote: e.target.value }))}
                      className="mt-1 w-full min-h-[90px] rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm"
                      placeholder="Admin-only notes"
                    />
                  </div>

                  <div className="md:col-span-2 flex gap-3 flex-wrap">
                    <button
                      onClick={save}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-950 text-white transition font-extrabold shadow-sm disabled:opacity-60"
                    >
                      <Save size={18} />
                      {saving ? "Saving..." : selectedId ? "Update Promo Code" : "Create Promo Code"}
                    </button>

                    <button
                      onClick={resetForm}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-extrabold shadow-sm"
                    >
                      <RefreshCcw size={18} />
                      Reset Form
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
                  <div className="text-xs font-bold uppercase text-slate-500">Total Codes</div>
                  <div className="mt-2 text-3xl font-extrabold text-slate-900">{summary.total}</div>
                </div>
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                  <div className="text-xs font-bold uppercase text-emerald-700">Active</div>
                  <div className="mt-2 text-3xl font-extrabold text-emerald-900">{summary.active}</div>
                </div>
                <div className="rounded-3xl border border-gray-200 bg-white p-5">
                  <div className="text-xs font-bold uppercase text-slate-500">Inactive</div>
                  <div className="mt-2 text-3xl font-extrabold text-slate-900">{summary.inactive}</div>
                </div>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-lg font-extrabold">Promo Code List</div>
                    <div className="text-xs text-slate-600 mt-1">
                      Search, preview, edit, and delete from here.
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search code or title"
                        className="pl-9 pr-3 py-2 rounded-xl border border-gray-200 bg-white text-sm"
                      />
                    </div>

                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as "all" | "active" | "inactive")}
                      className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm"
                    >
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>

                    <button
                      onClick={() => void load()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold text-sm"
                    >
                      <RefreshCcw size={16} />
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {loading ? (
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm font-semibold text-slate-600">
                      Loading promo codes...
                    </div>
                  ) : items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm font-semibold text-slate-600">
                      No promo codes found.
                    </div>
                  ) : (
                    items.map((item) => {
                      const allowed = normalizeCategoryArray(item.allowedCategories)
                        .map((x) => CATEGORY_MAP.get(x)?.label || "")
                        .filter(Boolean);

                      return (
                        <div
                          key={item._id}
                          className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                        >
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="font-extrabold text-slate-900 text-lg">
                                  {safeStr(item.code)}
                                </div>
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                                    item.isActive
                                      ? "bg-emerald-600 text-white"
                                      : "bg-gray-200 text-gray-700"
                                  }`}
                                >
                                  {item.isActive ? "ACTIVE" : "INACTIVE"}
                                </span>
                                {safeStr(item.badgeText) ? (
                                  <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2.5 py-1 text-[11px] font-extrabold">
                                    {safeStr(item.badgeText)}
                                  </span>
                                ) : null}
                              </div>

                              <div className="mt-1 font-bold text-slate-800">{safeStr(item.title)}</div>

                              {safeStr(item.description) ? (
                                <div className="mt-1 text-sm text-slate-600">{safeStr(item.description)}</div>
                              ) : null}

                              <div className="mt-3 flex flex-wrap gap-2">
                                <span className="inline-flex items-center rounded-full bg-white border border-gray-200 px-2.5 py-1 text-[11px] font-extrabold text-slate-700">
                                  {safeStr(item.discountType).toLowerCase() === "fixed"
                                    ? `₹${Number(item.discountValue || 0)} OFF`
                                    : `${Number(item.discountValue || 0)}% OFF`}
                                </span>

                                {Number(item.maxDiscountAmount || 0) > 0 ? (
                                  <span className="inline-flex items-center rounded-full bg-white border border-gray-200 px-2.5 py-1 text-[11px] font-extrabold text-slate-700">
                                    Cap ₹{Number(item.maxDiscountAmount || 0)}
                                  </span>
                                ) : null}

                                {Number(item.minOrderAmount || 0) > 0 ? (
                                  <span className="inline-flex items-center rounded-full bg-white border border-gray-200 px-2.5 py-1 text-[11px] font-extrabold text-slate-700">
                                    Min ₹{Number(item.minOrderAmount || 0)}
                                  </span>
                                ) : null}

                                <span className="inline-flex items-center rounded-full bg-white border border-gray-200 px-2.5 py-1 text-[11px] font-extrabold text-slate-700">
                                  Used {Number(item.totalUsedCount || 0)}
                                  {Number(item.totalUsageLimit || 0) > 0 ? ` / ${Number(item.totalUsageLimit || 0)}` : ""}
                                </span>
                              </div>

                              {allowed.length > 0 ? (
                                <div className="mt-3 text-xs text-slate-600">
                                  <span className="font-extrabold text-slate-800">Allowed:</span>{" "}
                                  {allowed.join(", ")}
                                </div>
                              ) : (
                                <div className="mt-3 text-xs text-slate-500">
                                  No allowed category selected = promo all eligible categories par chalega.
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                onClick={() => editItem(item)}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-extrabold text-sm"
                              >
                                <Pencil size={16} />
                                Edit
                              </button>

                              <Link
                                href={`/admin/promo-codes/usage?code=${encodeURIComponent(item.code)}`}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-extrabold text-sm"
                              >
                                <Eye size={16} />
                                Usage
                              </Link>

                              <button
                                onClick={() => void removeItem(item._id)}
                                disabled={deletingId === item._id}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white transition font-extrabold text-sm disabled:opacity-60"
                              >
                                <Trash2 size={16} />
                                {deletingId === item._id ? "Deleting..." : "Delete"}
                              </button>
                            </div>
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
      </div>
    </main>
  );
}