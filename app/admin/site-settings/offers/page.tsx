// app/admin/site-settings/offers/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Gift,
  Save,
  Trash2,
  Pencil,
  RefreshCcw,
  Plus,
  ExternalLink,
} from "lucide-react";

type OfferRow = {
  _id: string;
  title: string;
  shortText?: string;
  badgeText?: string;
  couponCode?: string;
  ctaText?: string;
  ctaHref?: string;
  coverImageUrl?: string;
  bgVariant?: "blue" | "emerald" | "violet" | "amber" | "rose" | "slate";
  categoryTags?: string[];
  sortOrder?: number;
  isFeatured?: boolean;
  isActive?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type FormState = {
  title: string;
  shortText: string;
  badgeText: string;
  couponCode: string;
  ctaText: string;
  ctaHref: string;
  coverImageUrl: string;
  bgVariant: "blue" | "emerald" | "violet" | "amber" | "rose" | "slate";
  categoryTags: string;
  sortOrder: string;
  isFeatured: boolean;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
};

const DEFAULT_FORM: FormState = {
  title: "",
  shortText: "",
  badgeText: "",
  couponCode: "",
  ctaText: "",
  ctaHref: "",
  coverImageUrl: "",
  bgVariant: "blue",
  categoryTags: "",
  sortOrder: "0",
  isFeatured: false,
  isActive: true,
  startsAt: "",
  endsAt: "",
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function toInputDateTime(value?: string | null) {
  const v = safeStr(value);
  if (!v) return "";
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromRowToForm(row: OfferRow): FormState {
  return {
    title: safeStr(row?.title),
    shortText: safeStr(row?.shortText),
    badgeText: safeStr(row?.badgeText),
    couponCode: safeStr(row?.couponCode).toUpperCase(),
    ctaText: safeStr(row?.ctaText),
    ctaHref: safeStr(row?.ctaHref),
    coverImageUrl: safeStr(row?.coverImageUrl),
    bgVariant: (safeStr(row?.bgVariant).toLowerCase() || "blue") as FormState["bgVariant"],
    categoryTags: Array.isArray(row?.categoryTags) ? row.categoryTags.join(", ") : "",
    sortOrder: String(row?.sortOrder ?? 0),
    isFeatured: !!row?.isFeatured,
    isActive: row?.isActive !== false,
    startsAt: toInputDateTime(row?.startsAt),
    endsAt: toInputDateTime(row?.endsAt),
  };
}

function variantClasses(variant?: string) {
  const v = safeStr(variant).toLowerCase();
  if (v === "emerald") return "from-emerald-600 to-emerald-400 border-emerald-200";
  if (v === "violet") return "from-violet-600 to-fuchsia-500 border-violet-200";
  if (v === "amber") return "from-amber-500 to-orange-400 border-amber-200";
  if (v === "rose") return "from-rose-600 to-pink-500 border-rose-200";
  if (v === "slate") return "from-slate-700 to-slate-500 border-slate-200";
  return "from-blue-700 to-cyan-500 border-blue-200";
}

async function adminFetchJSON(url: string, init?: RequestInit) {
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
    throw new Error(safeStr(data?.error) || "Request failed");
  }
  return data;
}

export default function OffersAdminPage() {
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  async function load() {
    setLoading(true);
    try {
      const data = await adminFetchJSON("/api/admin/site-settings/offers");
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      alert(safeStr(e?.message) || "Failed to load offers");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function resetForm() {
    setEditingId("");
    setForm(DEFAULT_FORM);
  }

  function startEdit(row: OfferRow) {
    setEditingId(String(row._id));
    setForm(fromRowToForm(row));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    if (!safeStr(form.title)) {
      alert("Title required");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        title: safeStr(form.title),
        shortText: safeStr(form.shortText),
        badgeText: safeStr(form.badgeText),
        couponCode: safeStr(form.couponCode).toUpperCase(),
        ctaText: safeStr(form.ctaText),
        ctaHref: safeStr(form.ctaHref),
        coverImageUrl: safeStr(form.coverImageUrl),
        bgVariant: safeStr(form.bgVariant).toLowerCase(),
        categoryTags: safeStr(form.categoryTags)
          .split(",")
          .map((x) => safeStr(x))
          .filter(Boolean),
        sortOrder: Number(form.sortOrder || 0),
        isFeatured: !!form.isFeatured,
        isActive: !!form.isActive,
        startsAt: safeStr(form.startsAt) || null,
        endsAt: safeStr(form.endsAt) || null,
      };

      if (editingId) {
        await adminFetchJSON(`/api/admin/site-settings/offers/${encodeURIComponent(editingId)}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await adminFetchJSON("/api/admin/site-settings/offers", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      alert(editingId ? "Offer updated ✅" : "Offer created ✅");
      resetForm();
      await load();
    } catch (e: any) {
      alert(safeStr(e?.message) || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeOffer(id: string) {
    if (!confirm("Delete this offer?")) return;

    try {
      await adminFetchJSON(`/api/admin/site-settings/offers/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (editingId === id) resetForm();
      await load();
    } catch (e: any) {
      alert(safeStr(e?.message) || "Delete failed");
    }
  }

  const sortedPreview = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (!!a.isFeatured !== !!b.isFeatured) return a.isFeatured ? -1 : 1;
      return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
    });
  }, [rows]);

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-2xl font-extrabold flex items-center gap-2">
                <Gift className="text-slate-700" />
                Offers Page Manager
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Home page ka special offer button isi page par open hoga. Yahan se offers create, edit, delete aur sort karo.
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <a
                href="/offers"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <ExternalLink size={18} />
                Open Offers Page
              </a>

              <Link
                href="/admin/site-settings"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <ArrowLeft size={18} />
                Back
              </Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 xl:grid-cols-5 gap-6">
            <div className="xl:col-span-2 rounded-3xl border border-gray-200 bg-gray-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-lg font-extrabold">
                  {editingId ? "Edit Offer" : "Create New Offer"}
                </div>

                <button
                  onClick={resetForm}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition text-sm font-bold"
                >
                  <Plus size={16} />
                  New
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-600">Title</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                    placeholder="Mega Assignment Offer"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600">Short Text</label>
                  <textarea
                    value={form.shortText}
                    onChange={(e) => setForm((p) => ({ ...p, shortText: e.target.value }))}
                    className="mt-1 w-full min-h-[100px] rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                    placeholder="Offer details, conditions, best use case..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600">Badge</label>
                    <input
                      value={form.badgeText}
                      onChange={(e) => setForm((p) => ({ ...p, badgeText: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                      placeholder="Limited Time"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Coupon Code</label>
                    <input
                      value={form.couponCode}
                      onChange={(e) => setForm((p) => ({ ...p, couponCode: safeStr(e.target.value).toUpperCase() }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm uppercase"
                      placeholder="IGNOU20"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">CTA Text</label>
                    <input
                      value={form.ctaText}
                      onChange={(e) => setForm((p) => ({ ...p, ctaText: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                      placeholder="Use Offer"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">CTA Href</label>
                    <input
                      value={form.ctaHref}
                      onChange={(e) => setForm((p) => ({ ...p, ctaHref: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                      placeholder="/checkout?coupon=IGNOU20"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Cover Image URL</label>
                    <input
                      value={form.coverImageUrl}
                      onChange={(e) => setForm((p) => ({ ...p, coverImageUrl: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                      placeholder="https://..."
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Background Variant</label>
                    <select
                      value={form.bgVariant}
                      onChange={(e) => setForm((p) => ({ ...p, bgVariant: e.target.value as FormState["bgVariant"] }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                    >
                      <option value="blue">Blue</option>
                      <option value="emerald">Emerald</option>
                      <option value="violet">Violet</option>
                      <option value="amber">Amber</option>
                      <option value="rose">Rose</option>
                      <option value="slate">Slate</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Sort Order</label>
                    <input
                      value={form.sortOrder}
                      onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Category Tags</label>
                    <input
                      value={form.categoryTags}
                      onChange={(e) => setForm((p) => ({ ...p, categoryTags: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                      placeholder="Solved Assignments, PYQ, Ebooks"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Starts At</label>
                    <input
                      type="datetime-local"
                      value={form.startsAt}
                      onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Ends At</label>
                    <input
                      type="datetime-local"
                      value={form.endsAt}
                      onChange={(e) => setForm((p) => ({ ...p, endsAt: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-5 flex-wrap pt-2">
                  <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.isFeatured}
                      onChange={(e) => setForm((p) => ({ ...p, isFeatured: e.target.checked }))}
                    />
                    Featured
                  </label>

                  <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                    />
                    Active
                  </label>
                </div>

                <div className="flex gap-3 flex-wrap pt-2">
                  <button
                    onClick={save}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-extrabold shadow-sm disabled:opacity-60"
                  >
                    <Save size={18} />
                    {saving ? "Saving..." : editingId ? "Update Offer" : "Create Offer"}
                  </button>

                  <button
                    onClick={() => void load()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-extrabold shadow-sm"
                  >
                    <RefreshCcw size={18} />
                    Refresh
                  </button>
                </div>
              </div>
            </div>

            <div className="xl:col-span-3 rounded-3xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-lg font-extrabold">Current Offers</div>
                  <div className="text-sm text-slate-600 mt-1">
                    Featured offers upar dikhenge. Public page par active time-window wale offers hi visible honge.
                  </div>
                </div>

                <div className="text-xs font-bold text-slate-500">
                  Total: {rows.length}
                </div>
              </div>

              {loading ? (
                <div className="mt-6 text-sm text-slate-600">Loading offers...</div>
              ) : sortedPreview.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm font-semibold text-slate-600">
                  No offers found. Left side se first offer create karo.
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sortedPreview.map((row) => (
                    <div
                      key={row._id}
                      className={`rounded-3xl border overflow-hidden shadow-sm ${variantClasses(row.bgVariant)}`}
                    >
                      <div className="bg-gradient-to-r px-5 py-5 text-white">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              {safeStr(row.badgeText) ? (
                                <span className="inline-flex rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide">
                                  {safeStr(row.badgeText)}
                                </span>
                              ) : null}

                              <span className="inline-flex rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide">
                                {row.isActive ? "Active" : "Inactive"}
                              </span>

                              {row.isFeatured ? (
                                <span className="inline-flex rounded-full bg-yellow-300/20 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-yellow-100">
                                  Featured
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-3 text-xl font-extrabold leading-tight">
                              {safeStr(row.title)}
                            </div>

                            {safeStr(row.shortText) ? (
                              <div className="mt-2 text-sm text-white/90 font-medium leading-6">
                                {safeStr(row.shortText)}
                              </div>
                            ) : null}
                          </div>

                          {safeStr(row.couponCode) ? (
                            <div className="rounded-2xl bg-white/15 px-3 py-2 text-right">
                              <div className="text-[10px] uppercase tracking-wide font-extrabold text-white/80">
                                Coupon
                              </div>
                              <div className="text-sm font-extrabold">
                                {safeStr(row.couponCode)}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="bg-white p-4">
                        <div className="text-xs text-slate-500 font-semibold leading-6">
                          Sort: <b>{row.sortOrder ?? 0}</b>
                          {safeStr(row.ctaHref) ? (
                            <>
                              {" "}• CTA: <b>{safeStr(row.ctaText) || "View Offer"}</b>
                            </>
                          ) : null}
                        </div>

                        {Array.isArray(row.categoryTags) && row.categoryTags.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {row.categoryTags.map((tag) => (
                              <span
                                key={`${row._id}-${tag}`}
                                className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-bold text-slate-700"
                              >
                                {safeStr(tag)}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        <div className="mt-4 flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => startEdit(row)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition text-sm font-extrabold"
                          >
                            <Pencil size={16} />
                            Edit
                          </button>

                          <button
                            onClick={() => void removeOffer(row._id)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-red-200 text-red-700 transition text-sm font-extrabold"
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>

                          {safeStr(row.ctaHref) ? (
                            <a
                              href={safeStr(row.ctaHref)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition text-sm font-extrabold"
                            >
                              <ExternalLink size={16} />
                              Open CTA
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

