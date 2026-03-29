"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Search,
  X,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type SessionRow = {
  _id: string;
  name: string;
  slug: string;
  categories: string[];
  sortOrder: number;
  isActive: boolean;
};

type ListResp = {
  items: SessionRow[];
  pagination: { total: number; page: number; totalPages: number; limit: number };
};

type CategoryOption = {
  slug: string;
  label: string;
  apiLabel: string;
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function num(x: any, d = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function slugify(input: string) {
  return safeStr(input)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function pageWindow(current: number, total: number) {
  const pages: (number | "…")[] = [];
  if (total <= 9) {
    for (let i = 1; i <= total; i++) pages.push(i);
    return pages;
  }
  const add = (x: number | "…") => pages.push(x);
  add(1);
  const left = Math.max(2, current - 2);
  const right = Math.min(total - 1, current + 2);
  if (left > 2) add("…");
  for (let i = left; i <= right; i++) add(i);
  if (right < total - 1) add("…");
  add(total);
  return pages;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  { slug: "solved-assignments", label: "Solved Assignments", apiLabel: "Solved Assignments" },
  { slug: "question-papers", label: "Question Papers (PYQ)", apiLabel: "Question Papers (PYQ)" },
  { slug: "guess-papers", label: "Guess Papers", apiLabel: "Guess Papers" },
  { slug: "ebooks", label: "eBooks/Notes", apiLabel: "Ebooks" },
  { slug: "projects", label: "Projects & Synopsis", apiLabel: "projects" },
  { slug: "handwritten-pdfs", label: "Handwritten PDFs", apiLabel: "Handwritten PDFs" },
  { slug: "handwritten-hardcopy", label: "Handwritten Hardcopy", apiLabel: "Handwritten Hardcopy (Delivery)" },
  { slug: "combo", label: "Combo", apiLabel: "Combo" },
];

function normalizeCategoryToUiSlug(input: any) {
  const raw = safeStr(input);
  if (!raw) return "";

  const s = raw
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[()]/g, " ")
    .replace(/[_/]+/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (
    s === "solved assignments" ||
    s === "solved assignment" ||
    s === "assignment" ||
    s === "assignments"
  ) {
    return "solved-assignments";
  }

  if (
    s === "question papers" ||
    s === "question paper" ||
    s === "pyq" ||
    s === "previous year question papers" ||
    s === "question papers pyq"
  ) {
    return "question-papers";
  }

  if (
    s === "handwritten pdfs" ||
    s === "handwritten pdf" ||
    s === "handwritten notes pdf" ||
    s === "handwritten notes pdfs"
  ) {
    return "handwritten-pdfs";
  }

  if (
    s === "ebooks" ||
    s === "ebook" ||
    s === "e books" ||
    s === "e book" ||
    s === "ebooks notes" ||
    s === "ebooks and notes" ||
    s === "ebook notes" ||
    s === "ebook and notes"
  ) {
    return "ebooks";
  }

  if (s === "guess papers" || s === "guess paper") {
    return "guess-papers";
  }

  if (
    s === "projects" ||
    s === "project" ||
    s === "projects synopsis" ||
    s === "project synopsis"
  ) {
    return "projects";
  }

  if (
    s === "handwritten hardcopy" ||
    s === "handwritten hardcopies" ||
    s === "handwritten hard copy" ||
    s === "handwritten hard copies" ||
    s === "handwritten hardcopy delivery" ||
    s === "handwritten hard copy delivery" ||
    s === "handwritten hardcopies delivery" ||
    s === "handwritten hard copies delivery" ||
    s === "hardcopy" ||
    s === "hardcopies" ||
    s === "hard copy" ||
    s === "hard copies"
  ) {
    return "handwritten-hardcopy";
  }

  if (s === "combo" || s === "combos") {
    return "combo";
  }

  return slugify(raw);
}

function normalizeCategoryArrayToUiSlugs(input: any) {
  const arr = Array.isArray(input)
    ? input
    : typeof input === "string"
    ? input.split(",")
    : [];

  const out: string[] = [];
  const seen = new Set<string>();

  for (const item of arr) {
    const slug = normalizeCategoryToUiSlug(item);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }

  return out;
}

function uiSlugsToApiCategories(slugs: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const slug of slugs) {
    const found = CATEGORY_OPTIONS.find((c) => c.slug === slug);
    const value = safeStr(found?.apiLabel || slug);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }

  return out;
}

export default function AdminSessionsPage() {
  const [items, setItems] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1, limit: 50 });

  const NEW_ID = "__NEW__";
  const [newRow, setNewRow] = useState<SessionRow | null>(null);

  const [toast, setToast] = useState<{ show: boolean; ok: boolean; text: string }>({
    show: false,
    ok: true,
    text: "",
  });
  const toastT = useRef<any>(null);

  function showToast(text: string, ok: boolean) {
    if (toastT.current) clearTimeout(toastT.current);
    setToast({ show: true, ok, text });
    toastT.current = setTimeout(() => setToast((p) => ({ ...p, show: false })), 1600);
  }

  async function load(next?: { page?: number; q?: string; limit?: number }) {
    const nextPage = next?.page ?? page;
    const nextQ = next?.q ?? q;
    const nextLimit = next?.limit ?? limit;

    setError("");
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("limit", String(nextLimit));
      if (safeStr(nextQ)) params.set("q", safeStr(nextQ));

      const res = await fetch(`/api/admin/sessions?${params.toString()}`, { cache: "no-store" });
      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!res.ok) throw new Error(data?.error || "Failed to load sessions");

      const typed = data as ListResp;
      setItems(Array.isArray(typed.items) ? typed.items : []);

      const p = typed.pagination || { total: 0, page: 1, totalPages: 1, limit: nextLimit };
      setMeta({
        total: Number(p.total || 0),
        page: Number(p.page || 1),
        totalPages: Number(p.totalPages || 1),
        limit: Number(p.limit || nextLimit),
      });
      setPage(Number(p.page || nextPage || 1));
    } catch (e: any) {
      setItems([]);
      setMeta({ total: 0, page: 1, totalPages: 1, limit: nextLimit });
      setError(e?.message || "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load({ page, limit });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      load({ page: 1, q, limit });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function addNewRowInline() {
    setNewRow({
      _id: NEW_ID,
      name: "",
      slug: "",
      categories: [],
      sortOrder: 0,
      isActive: true,
    });
  }

  async function createSession(row: SessionRow) {
    const name = safeStr(row.name);
    if (!name) return showToast("Session name is required", false);

    setSavingId(NEW_ID);
    try {
      const res = await fetch("/api/admin/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          categories: uiSlugsToApiCategories(normalizeCategoryArrayToUiSlugs(row.categories)),
          sortOrder: num(row.sortOrder, 0),
          isActive: Boolean(row.isActive),
        }),
      });

      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!res.ok) throw new Error(data?.error || "Create failed");

      showToast("Session created", true);
      setNewRow(null);
      await load({ page, q, limit });
    } catch (e: any) {
      showToast(e?.message || "Create failed", false);
    } finally {
      setSavingId(null);
    }
  }

  async function putSession(id: string, patch: Partial<SessionRow>) {
    setSavingId(id);
    try {
      const nextPatch: Partial<SessionRow> & { categories?: string[] } = { ...patch };

      if ("categories" in nextPatch) {
        nextPatch.categories = uiSlugsToApiCategories(
          normalizeCategoryArrayToUiSlugs(nextPatch.categories || [])
        );
      }

      const res = await fetch(`/api/admin/sessions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextPatch),
      });

      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!res.ok) throw new Error(data?.error || "Update failed");

      showToast("Saved", true);
      await load({ page, q, limit });
    } catch (e: any) {
      showToast(e?.message || "Update failed", false);
    } finally {
      setSavingId(null);
    }
  }

  async function deleteSession(id: string) {
    const ok = confirm("Delete this session?");
    if (!ok) return;

    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/sessions/${id}`, { method: "DELETE" });
      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!res.ok) throw new Error(data?.error || "Delete failed");

      showToast("Deleted", true);

      const willBeEmpty = items.length === 1 && page > 1;
      const nextPage = willBeEmpty ? page - 1 : page;
      setPage(nextPage);
      await load({ page: nextPage, q, limit });
    } catch (e: any) {
      showToast(e?.message || "Delete failed", false);
    } finally {
      setSavingId(null);
    }
  }

  const pages = useMemo(() => pageWindow(meta.page, meta.totalPages), [meta.page, meta.totalPages]);

  const gridCols = "grid grid-cols-[260px_120px_120px_minmax(420px,1fr)_120px] gap-3 items-center";
  const headerChip =
    "rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-[11px] font-extrabold text-slate-700 uppercase tracking-wide";

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div
        className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[9999] transition-all duration-300 ${
          toast.show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
        }`}
      >
        <div
          className={`px-4 py-2 rounded-2xl shadow-lg border text-sm font-extrabold flex items-center gap-2 ${
            toast.ok ? "bg-emerald-600 text-white border-emerald-500" : "bg-rose-600 text-white border-rose-500"
          }`}
        >
          {toast.ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          {toast.text}
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 py-10">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="text-2xl font-extrabold flex items-center gap-2">
                <CalendarDays className="text-slate-700" />
                Sessions (Smart by Category)
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Decide which session appears in which category filters + product upload form.
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={addNewRowInline}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 text-white hover:bg-orange-700 transition font-semibold shadow-sm"
              >
                <Plus size={18} /> Add New Session
              </button>

              <button
                onClick={() => load({ page, q, limit })}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <RefreshCw size={18} /> Refresh
              </button>

              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <ArrowLeft size={18} /> Back
              </Link>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-gray-200 bg-white w-full md:w-[520px]">
              <Search size={18} className="text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search session name / category..."
                className="w-full outline-none text-sm font-semibold text-slate-800 placeholder:text-gray-400"
              />
              {q ? (
                <button
                  onClick={() => setQ("")}
                  className="h-9 w-9 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500"
                  title="Clear"
                >
                  <X size={18} />
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <div className="text-xs font-extrabold text-slate-600">Per page</div>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="h-11 px-3 rounded-2xl border border-gray-200 bg-white text-sm font-extrabold text-slate-800 outline-none"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <div className="min-w-[1200px]">
              <div className={`${gridCols} pb-3`}>
                <div className={headerChip}>Session Name</div>
                <div className={headerChip}>Sort</div>
                <div className={headerChip}>Active</div>
                <div className={headerChip}>Applicable Categories</div>
                <div className={headerChip}>Action</div>
              </div>

              {newRow ? (
                <SessionRowEditor
                  key="__new__"
                  row={newRow}
                  saving={savingId === NEW_ID}
                  gridCols={gridCols}
                  isNew
                  onCreate={createSession}
                  onCancel={() => setNewRow(null)}
                  onSave={() => {}}
                  onDelete={() => {}}
                />
              ) : null}

              {loading ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-slate-600">
                  Loading...
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-slate-600">
                  No sessions yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((it) => (
                    <SessionRowEditor
                      key={it._id}
                      row={it}
                      saving={savingId === it._id}
                      gridCols={gridCols}
                      onSave={(patch) => putSession(it._id, patch)}
                      onDelete={() => deleteSession(it._id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs font-bold text-slate-600">
              Total: {meta.total} | Page {meta.page}/{meta.totalPages}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                disabled={meta.page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 font-extrabold text-sm disabled:opacity-50"
              >
                <ChevronLeft size={18} /> Prev
              </button>

              <div className="flex items-center gap-1">
                {pages.map((p, idx) =>
                  p === "…" ? (
                    <div key={`dots-${idx}`} className="px-2 text-slate-400 font-extrabold">
                      …
                    </div>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      disabled={loading}
                      className={`min-w-[38px] h-10 px-3 rounded-xl border text-sm font-extrabold transition ${
                        p === meta.page
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white border-gray-200 hover:bg-gray-50 text-slate-800"
                      } disabled:opacity-60`}
                      title={`Page ${p}`}
                    >
                      {p}
                    </button>
                  )
                )}
              </div>

              <button
                disabled={meta.page >= meta.totalPages || loading}
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 font-extrabold text-sm disabled:opacity-50"
              >
                Next <ChevronRight size={18} />
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-slate-600">Go:</span>
                <input
                  type="number"
                  min={1}
                  max={meta.totalPages}
                  defaultValue={meta.page}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    const v = clamp(Number((e.target as HTMLInputElement).value || 1), 1, meta.totalPages);
                    setPage(v);
                  }}
                  className="w-20 h-10 px-3 rounded-xl border border-gray-200 bg-white font-extrabold text-sm outline-none"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 text-[12px] text-slate-500 font-semibold">
            Tip: Assignments में year sessions रखें, PYQ में June/December sessions रखें, ebooks/guess-papers में Latest/New Edition जैसी tags रखें.
          </div>
        </div>
      </div>
    </main>
  );
}

function SessionRowEditor({
  row,
  gridCols,
  saving,
  onSave,
  onDelete,
  isNew,
  onCreate,
  onCancel,
}: {
  row: SessionRow;
  gridCols: string;
  saving: boolean;
  onSave: (patch: Partial<SessionRow>) => void;
  onDelete: () => void;
  isNew?: boolean;
  onCreate?: (r: SessionRow) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(row.name || "");
  const [sortOrder, setSortOrder] = useState<number>(Number(row.sortOrder || 0));
  const [isActive, setIsActive] = useState<boolean>(!!row.isActive);
  const [cats, setCats] = useState<string[]>(normalizeCategoryArrayToUiSlugs(row.categories));

  useEffect(() => {
    setName(row.name || "");
    setSortOrder(Number(row.sortOrder || 0));
    setIsActive(!!row.isActive);
    setCats(normalizeCategoryArrayToUiSlugs(row.categories));
  }, [row]);

  const originalCats = useMemo(
    () => normalizeCategoryArrayToUiSlugs(row.categories).slice().sort(),
    [row.categories]
  );

  const changed =
    safeStr(name) !== safeStr(row.name) ||
    Number(sortOrder) !== Number(row.sortOrder || 0) ||
    Boolean(isActive) !== Boolean(row.isActive) ||
    JSON.stringify(cats.slice().sort()) !== JSON.stringify(originalCats);

  function autoSave() {
    if (isNew) return;
    if (!changed) return;

    onSave({
      name: safeStr(name),
      sortOrder: Number(sortOrder || 0),
      isActive,
      categories: uiSlugsToApiCategories(cats),
    });
  }

  function toggleCat(slug: string) {
    setCats((prev) => {
      const has = prev.includes(slug);
      return has ? prev.filter((x) => x !== slug) : [...prev, slug];
    });
  }

  const cellWrap = "rounded-2xl border border-gray-200 bg-white p-2";
  const input =
    "w-full h-10 px-3 rounded-xl border border-gray-200 bg-white outline-none text-[12px] font-semibold text-slate-800 focus:ring-2 focus:ring-slate-200 overflow-x-auto whitespace-nowrap";
  const code =
    "w-full h-10 px-3 rounded-xl border border-gray-200 bg-white outline-none text-[12px] font-extrabold text-slate-900 focus:ring-2 focus:ring-slate-200 overflow-x-auto whitespace-nowrap";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className={gridCols}>
        <div className={cellWrap}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={autoSave}
            placeholder="2025-2026 / June 2023 / Latest"
            className={code}
            disabled={saving}
          />
        </div>

        <div className={cellWrap}>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value || 0))}
            onBlur={autoSave}
            className={input}
            disabled={saving}
          />
        </div>

        <div className={cellWrap}>
          <label className="flex items-center gap-2 px-2 h-10">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => {
                setIsActive(e.target.checked);
                setTimeout(autoSave, 0);
              }}
              disabled={saving}
            />
            <span className="text-sm font-extrabold text-slate-700">Active</span>
          </label>
        </div>

        <div className={`${cellWrap} overflow-x-auto`}>
          <div className="flex items-center gap-2 h-10 min-w-max pr-2">
            {CATEGORY_OPTIONS.map((c) => {
              const on = cats.includes(c.slug);
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => {
                    toggleCat(c.slug);
                    setTimeout(autoSave, 0);
                  }}
                  disabled={saving}
                  className={`px-3 h-9 rounded-xl border text-xs font-extrabold transition ${
                    on
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white border-gray-200 hover:bg-gray-50 text-slate-800"
                  } disabled:opacity-60`}
                  title={c.label}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          {isNew ? (
            <>
              <button
                disabled={saving}
                onClick={() =>
                  onCreate?.({
                    ...row,
                    name: safeStr(name),
                    sortOrder,
                    isActive,
                    categories: uiSlugsToApiCategories(cats),
                  })
                }
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition font-extrabold text-sm disabled:opacity-60"
              >
                <CheckCircle2 size={18} />
                {saving ? "Saving..." : "Create"}
              </button>

              <button
                disabled={saving}
                onClick={() => onCancel?.()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-extrabold text-sm disabled:opacity-60"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={onDelete}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-rose-50 border border-gray-200 hover:border-rose-200 transition font-extrabold text-sm disabled:opacity-60"
              title="Delete"
            >
              <Trash2 size={18} className="text-rose-600" />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}