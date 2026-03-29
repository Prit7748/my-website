// ✅ FILE: app/admin/subjects/page.tsx  (COMPLETE REPLACE)
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Upload,
  Search,
  Trash2,
  RefreshCw,
  X,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import * as XLSX from "xlsx";

type SubjectRow = {
  _id: string;
  code: string;
  titleEn?: string;
  titleHi?: string;
  otherLangName?: string;
  titleOther?: string;
};

type ListResp = {
  items: SubjectRow[];
  pagination: { total: number; page: number; totalPages: number; limit: number };
};

type BulkRow = { code: string; language: string; title: string };

function safeStr(x: any) {
  return String(x ?? "").trim();
}
function codeNorm(x: any) {
  return safeStr(x).replace(/\s+/g, " ").toUpperCase();
}

// ✅ Changed bg-white to bg-green-50 for light green background
const cellInput =
  "w-full h-10 px-3 rounded-xl border border-gray-200 bg-green-50 outline-none text-[12px] font-semibold text-slate-800 " +
  "focus:ring-2 focus:ring-slate-200 overflow-x-auto whitespace-nowrap";
const cellCode =
  "w-full h-10 px-3 rounded-xl border border-gray-200 bg-green-50 outline-none text-[12px] font-extrabold text-slate-900 " +
  "focus:ring-2 focus:ring-slate-200 overflow-x-auto whitespace-nowrap";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

// ✅ Pagination window helper (shows 1 ... 4 5 6 ... 20)
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

export default function AdminSubjectsPage() {
  const [items, setItems] = useState<SubjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  // ✅ Limit selectable
  const [limit, setLimit] = useState<number>(25);
  const LIMIT_OPTIONS = [25, 50, 100, 200];

  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1, limit });

  // ✅ inline new row
  const NEW_ID = "__NEW__";
  const [newRow, setNewRow] = useState<SubjectRow | null>(null);

  // saving state
  const [savingId, setSavingId] = useState<string | null>(null);

  // toast
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

      const res = await fetch(`/api/admin/subjects?${params.toString()}`, { cache: "no-store" });
      const raw = await res.text();
      if (!raw) throw new Error("Empty API response (check server logs).");

      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error("Invalid JSON from API (check server logs).");
      }

      if (!res.ok) throw new Error(data?.error || "Failed to load subjects");

      const typed = data as ListResp;

      setItems(Array.isArray(typed.items) ? typed.items : []);

      const p = typed.pagination || { total: 0, page: 1, totalPages: 1, limit: nextLimit };
      setMeta({
        total: Number(p.total || 0),
        page: Number(p.page || nextPage || 1),
        totalPages: Number(p.totalPages || 1),
        limit: Number(p.limit || nextLimit),
      });

      setPage(Number(p.page || nextPage || 1));
    } catch (e: any) {
      setError(e?.message || "Failed to load subjects");
      setItems([]);
      setMeta({ total: 0, page: 1, totalPages: 1, limit: next?.limit ?? limit });
    } finally {
      setLoading(false);
    }
  }

  // Load on page / limit
  useEffect(() => {
    load({ page, limit });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  // Search debounce
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
      code: "",
      titleEn: "",
      titleHi: "",
      otherLangName: "",
      titleOther: "",
    });
  }

  async function createSubject(row: SubjectRow) {
    setError("");
    const code = codeNorm(row.code);
    if (!code) return showToast("Subject code is required", false);

    setSavingId(NEW_ID);
    try {
      const res = await fetch("/api/admin/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          titleEn: safeStr(row.titleEn),
          titleHi: safeStr(row.titleHi),
          otherLangName: safeStr(row.otherLangName),
          titleOther: safeStr(row.titleOther),
        }),
      });

      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!res.ok) throw new Error(data?.error || "Create failed");

      showToast("Subject created", true);
      setNewRow(null);
      await load({ page, q, limit });
    } catch (e: any) {
      showToast(e?.message || "Create failed", false);
    } finally {
      setSavingId(null);
    }
  }

  // ✅ API uses PUT
  async function putSubject(id: string, patch: Partial<SubjectRow>) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/subjects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(patch.code !== undefined ? { code: codeNorm(patch.code) } : {}),
          ...(patch.titleEn !== undefined ? { titleEn: safeStr(patch.titleEn) } : {}),
          ...(patch.titleHi !== undefined ? { titleHi: safeStr(patch.titleHi) } : {}),
          ...(patch.otherLangName !== undefined ? { otherLangName: safeStr(patch.otherLangName) } : {}),
          ...(patch.titleOther !== undefined ? { titleOther: safeStr(patch.titleOther) } : {}),
        }),
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

  async function deleteSubject(id: string) {
    const ok = confirm("Delete this subject?");
    if (!ok) return;

    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/subjects/${id}`, { method: "DELETE" });

      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!res.ok) throw new Error(data?.error || "Delete failed");

      showToast("Deleted", true);

      // ✅ if last item deleted on last page, go back one page
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

  // ✅ fixed alignment columns
  const gridCols =
    "grid grid-cols-[160px_minmax(240px,1fr)_minmax(240px,1fr)_220px_minmax(240px,1fr)_120px] gap-3 items-center";
  const headerChip =
    "rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-[11px] font-extrabold text-slate-700 uppercase tracking-wide";

  /* =========================
     ✅ Excel Upload UI + Bulk flow
     ========================= */
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkStep, setBulkStep] = useState<"pick" | "review">("pick");
  const [bulkMode, setBulkMode] = useState<"skip" | "replace">("skip");
  const [bulkWorking, setBulkWorking] = useState(false);
  const [bulkResult, setBulkResult] = useState<any>(null);

  function openExcelPicker() {
    setUploadOpen(true);
    setBulkStep("pick");
    setBulkRows([]);
    setBulkResult(null);
    setBulkMode("skip");
    setTimeout(() => fileRef.current?.click(), 50);
  }

  function detectHeaders(rowObj: any) {
    const keys = Object.keys(rowObj || {}).map((k) => k.toLowerCase().trim());
    const pick = (cands: string[]) => keys.find((k) => cands.includes(k)) || "";
    const codeK = pick(["code", "subject code", "subjectcode", "subject_code", "subcode", "subject"]);
    const langK = pick(["language", "lang", "medium"]);
    const titleK = pick(["title", "subject title", "subjecttitle", "subject_title", "name"]);
    return { codeK, langK, titleK };
  }

  async function parseExcel(file: File) {
    setError("");
    setBulkWorking(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) throw new Error("No sheet found in Excel.");
      const ws = wb.Sheets[sheetName];

      const json = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[];
      if (!json.length) throw new Error("Excel is empty.");

      const { codeK, langK, titleK } = detectHeaders(json[0]);
      let rows: BulkRow[] = [];

      if (codeK && langK && titleK) {
        rows = json
          .map((r) => ({
            code: safeStr(r[codeK]),
            language: safeStr(r[langK]), // ✅ this becomes otherLangName when not hi/en
            title: safeStr(r[titleK]),
          }))
          .filter((r) => r.code && r.language && r.title);
      } else {
        const arr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
        const body = arr.slice(1).filter((r) => r.some((x) => safeStr(x)));
        rows = body
          .map((r) => ({
            code: safeStr(r[0]),
            language: safeStr(r[1]),
            title: safeStr(r[2]),
          }))
          .filter((r) => r.code && r.language && r.title);
      }

      if (!rows.length) throw new Error("No valid rows found. Need: code, language, title.");

      setBulkRows(rows);

      // ✅ dryRun
      const res = await fetch("/api/admin/subjects/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true, rows }),
      });
      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!res.ok) throw new Error(data?.error || "Bulk dryRun failed");

      setBulkResult(data);
      setBulkStep("review");
    } catch (e: any) {
      setBulkResult(null);
      setBulkRows([]);
      setBulkStep("pick");
      showToast(e?.message || "Excel parse failed", false);
    } finally {
      setBulkWorking(false);
    }
  }

  async function applyBulk() {
    if (!bulkRows.length) return;
    setBulkWorking(true);
    try {
      const res = await fetch("/api/admin/subjects/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false, mode: bulkMode, rows: bulkRows }),
      });
      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!res.ok) throw new Error(data?.error || "Bulk apply failed");

      showToast("Bulk upload applied", true);
      setUploadOpen(false);
      setBulkRows([]);
      setBulkResult(null);
      await load({ page: 1, q, limit });
      setPage(1);
    } catch (e: any) {
      showToast(e?.message || "Bulk apply failed", false);
    } finally {
      setBulkWorking(false);
    }
  }

  // ✅ pagination buttons list
  const pages = useMemo(() => pageWindow(meta.page, meta.totalPages), [meta.page, meta.totalPages]);

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      {/* toast */}
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

      {/* hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) parseExcel(f);
          e.currentTarget.value = "";
        }}
      />

      {/* upload modal */}
      {uploadOpen ? (
        <div className="fixed inset-0 z-[9998] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white border border-gray-200 shadow-xl p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xl font-extrabold flex items-center gap-2">
                  <FileSpreadsheet className="text-emerald-700" />
                  Excel Bulk Upload
                </div>
                <div className="text-sm text-slate-600 mt-1">
                  Excel columns: <b>code</b>, <b>language</b>, <b>title</b>
                </div>
              </div>
              <button
                onClick={() => {
                  if (bulkWorking) return;
                  setUploadOpen(false);
                }}
                className="h-10 w-10 rounded-2xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center"
                title="Close"
              >
                <X />
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              {bulkStep === "pick" ? (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm font-bold text-slate-700">Select an Excel file to continue.</div>
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={bulkWorking}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition font-extrabold disabled:opacity-60"
                  >
                    {bulkWorking ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                    Choose Excel
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm font-extrabold text-slate-800">Dry-run result</div>
                    <button
                      onClick={() => {
                        setBulkStep("pick");
                        setBulkRows([]);
                        setBulkResult(null);
                        setBulkMode("skip");
                        setTimeout(() => fileRef.current?.click(), 50);
                      }}
                      disabled={bulkWorking}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-extrabold disabled:opacity-60"
                    >
                      Change File
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <StatCard label="Total Codes" value={String(bulkResult?.totalCodes ?? "-")} />
                    <StatCard label="New" value={String(bulkResult?.newCount ?? "-")} />
                    <StatCard label="Duplicates" value={String(bulkResult?.duplicateCount ?? "-")} />
                  </div>

                  {Array.isArray(bulkResult?.duplicatesSample) && bulkResult.duplicatesSample.length ? (
                    <div className="text-xs text-slate-600">
                      Duplicate sample: <span className="font-extrabold">{bulkResult.duplicatesSample.join(", ")}</span>
                    </div>
                  ) : null}

                  <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm font-bold text-slate-700">If duplicates exist, what to do?</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setBulkMode("skip")}
                        className={`px-4 py-2 rounded-xl border font-extrabold text-sm transition ${
                          bulkMode === "skip"
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        SKIP
                      </button>
                      <button
                        onClick={() => setBulkMode("replace")}
                        className={`px-4 py-2 rounded-xl border font-extrabold text-sm transition ${
                          bulkMode === "replace"
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        REPLACE
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      onClick={() => setUploadOpen(false)}
                      disabled={bulkWorking}
                      className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 font-extrabold text-sm disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={applyBulk}
                      disabled={bulkWorking}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition font-extrabold text-sm disabled:opacity-60"
                    >
                      {bulkWorking ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                      Apply Upload
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 text-xs text-slate-500 font-semibold">
              Note: Hindi/English के अलावा कोई भी “language” value automatically <b>Other Language Name</b> में जाएगी।
            </div>
          </div>
        </div>
      ) : null}

      <div className="max-w-[1400px] mx-auto px-4 py-10">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="text-2xl font-extrabold flex items-center gap-2">
                <BookOpen className="text-slate-700" />
                Subjects (Codes & Titles)
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Inline editable grid + Excel bulk upload (duplicate detect + skip/replace)
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={addNewRowInline}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 text-white hover:bg-orange-700 transition font-semibold shadow-sm"
              >
                <Plus size={18} /> Add New Subject
              </button>

              <button
                onClick={openExcelPicker}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition font-semibold shadow-sm"
              >
                <Upload size={18} /> Upload Excel
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
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          <div className="mt-6">
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-gray-200 bg-white">
              <Search size={18} className="text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by subject code or any title..."
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
          </div>

          <div className="mt-6 overflow-x-auto">
            <div className="min-w-[1180px]">
              <div className={`${gridCols} pb-3`}>
                <div className={headerChip}>Subject Code</div>
                <div className={headerChip}>English Title</div>
                <div className={headerChip}>Hindi Title</div>
                <div className={headerChip}>Other Language Name</div>
                <div className={headerChip}>Other Title</div>
                <div className={headerChip}>Actions</div>
              </div>

              {newRow ? (
                <EditableRow
                  key="__new__"
                  row={newRow}
                  gridCols={gridCols}
                  saving={savingId === NEW_ID}
                  isNew
                  onCreate={createSubject}
                  onCancel={() => setNewRow(null)}
                  onSave={() => {}}
                  onDelete={() => {}}
                />
              ) : null}

              {loading ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-slate-600">Loading...</div>
              ) : items.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-slate-600">No subjects yet.</div>
              ) : (
                <div className="space-y-3">
                  {items.map((it) => (
                    <EditableRow
                      key={it._id}
                      row={it}
                      gridCols={gridCols}
                      saving={savingId === it._id}
                      onSave={(patch) => putSubject(it._id, patch)}
                      onDelete={() => deleteSubject(it._id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ✅ Enhanced Pagination */}
          <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs font-bold text-slate-600">
              Total: {meta.total} | Page {meta.page}/{meta.totalPages}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* limit selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-slate-600">Rows:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setLimit(v);
                    setPage(1);
                  }}
                  className="px-3 py-2 rounded-xl border border-gray-200 bg-white font-extrabold text-sm outline-none"
                >
                  {LIMIT_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              {/* prev/next */}
              <button
                disabled={meta.page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 font-extrabold text-sm disabled:opacity-50"
              >
                <ChevronLeft size={18} /> Prev
              </button>

              {/* page numbers */}
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

              {/* quick jump */}
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
            Tip: Cells single-line fixed-height हैं; long text देखने/एडिट करने के लिए cell के अंदर horizontal scroll/arrow keys use करें।
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="text-xs font-extrabold text-slate-600 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-slate-900">{value}</div>
    </div>
  );
}

function EditableRow({
  row,
  gridCols,
  saving,
  onSave,
  onDelete,
  isNew,
  onCreate,
  onCancel,
}: {
  row: SubjectRow;
  gridCols: string;
  saving: boolean;
  onSave: (patch: Partial<SubjectRow>) => void;
  onDelete: () => void;
  isNew?: boolean;
  onCreate?: (r: SubjectRow) => void;
  onCancel?: () => void;
}) {
  const [code, setCode] = useState(row.code || "");
  const [titleEn, setTitleEn] = useState(row.titleEn || "");
  const [titleHi, setTitleHi] = useState(row.titleHi || "");
  const [otherLangName, setOtherLangName] = useState(row.otherLangName || "");
  const [titleOther, setTitleOther] = useState(row.titleOther || "");

  useEffect(() => {
    setCode(row.code || "");
    setTitleEn(row.titleEn || "");
    setTitleHi(row.titleHi || "");
    setOtherLangName(row.otherLangName || "");
    setTitleOther(row.titleOther || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row._id]);

  const changed =
    codeNorm(code) !== codeNorm(row.code) ||
    safeStr(titleEn) !== safeStr(row.titleEn) ||
    safeStr(titleHi) !== safeStr(row.titleHi) ||
    safeStr(otherLangName) !== safeStr(row.otherLangName) ||
    safeStr(titleOther) !== safeStr(row.titleOther);

  function autoSaveOnBlur() {
    if (isNew) return;
    if (!changed) return;
    onSave({
      code: codeNorm(code),
      titleEn: safeStr(titleEn),
      titleHi: safeStr(titleHi),
      otherLangName: safeStr(otherLangName),
      titleOther: safeStr(titleOther),
    });
  }

  // ✅ Removed visual wrapper classes (border, bg, p-2) to fix double lining capsule effect. 
  // Leaves a single wrapper so the layout doesn't break.
  const cellWrap = ""; 

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className={gridCols}>
        <div className={cellWrap}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onBlur={autoSaveOnBlur}
            placeholder="AMT 01"
            className={cellCode}
          />
        </div>

        <div className={cellWrap}>
          <input
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
            onBlur={autoSaveOnBlur}
            placeholder="English title (optional)"
            className={cellInput}
          />
        </div>

        <div className={cellWrap}>
          <input
            value={titleHi}
            onChange={(e) => setTitleHi(e.target.value)}
            onBlur={autoSaveOnBlur}
            placeholder="Hindi title (optional)"
            className={cellInput}
          />
        </div>

        <div className={cellWrap}>
          <input
            value={otherLangName}
            onChange={(e) => setOtherLangName(e.target.value)}
            onBlur={autoSaveOnBlur}
            placeholder="Assamese / Urdu / German ..."
            className={cellInput}
          />
        </div>

        <div className={cellWrap}>
          <input
            value={titleOther}
            onChange={(e) => setTitleOther(e.target.value)}
            onBlur={autoSaveOnBlur}
            placeholder="Other language title"
            className={cellInput}
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          {isNew ? (
            <>
              <button
                disabled={saving}
                onClick={() =>
                  onCreate?.({
                    _id: "__NEW__",
                    code: codeNorm(code),
                    titleEn,
                    titleHi,
                    otherLangName,
                    titleOther,
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
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} className="text-rose-600" />}
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}