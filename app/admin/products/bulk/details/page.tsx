// ✅ FILE: app\admin\products\bulk\details\page.tsx (COMPLETE REPLACE)
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  AlertTriangle,
  FileSpreadsheet,
  RefreshCcw,
  Info,
  Lock,
} from "lucide-react";
import { CATEGORY_CONFIG, PHYSICAL_CATEGORY } from "@/lib/productCatalog";

type ResultItem = {
  rowNumber: number;
  sku?: string;
  title?: string;
  slug?: string;
  status: "created" | "updated" | "skipped" | "failed" | "validated";
  reason?: string;
  missingSubject?: string;
  missingCourse?: string[];
  missingSession?: string;
  duplicateFound?: boolean;
  matchedBy?: "sku" | "slug" | "sku_or_slug";
  courseCodes?: string[];
  courseTitles?: string[];
  availabilityAfter?: string;
};

type BulkResponse = {
  ok?: boolean;
  dryRun?: boolean;
  error?: string;
  message?: string;
  duplicateStrategy?: "replace" | "ignore";
  summary?: {
    totalRows: number;
    validRows: number;
    createdRows: number;
    updatedRows: number;
    skippedRows: number;
    failedRows: number;
  };
  comboSync?: {
    attempted: number;
    succeeded: number;
    failed: number;
    errors: string[];
    mode: string;
  };
  hardcopySync?: {
    attempted: number;
    succeeded: number;
    failed: number;
    errors: string[];
    mode: string;
  };
  items?: ResultItem[];
};

const DEFAULT_NOTE =
  "Please verify the question paper shown in the preview/thumbnail before purchasing. Purchase only if it matches your subject code, medium, session, and questions.";

const DEFAULT_TITLE_TEMPLATE = "IGNOU %B Solved Assignment %C (%D Medium)";
const DEFAULT_SHORT_DESC_TEMPLATE =
  "Download IGNOU %B (%F) solved assignment for session %C in %D medium.";
const DEFAULT_LONG_DESC_TEMPLATE =
  "This IGNOU %B (%F) solved assignment is prepared for session %C in %D medium. Course title is auto-matched from master data: %G.";
const DEFAULT_META_TITLE_TEMPLATE =
  "IGNOU %B Solved Assignment %C (%D Medium) PDF Download";
const DEFAULT_META_DESCRIPTION_TEMPLATE =
  "Download IGNOU %B (%F) solved assignment for session %C in %D medium. Course title: %G. Instant access and verified subject mapping.";

const TOKEN_HELP = [
  "%A = Unique Id (SKU)",
  "%B = Subject Code",
  "%C = Session",
  "%D = Language",
  "%E = Course Code",
  "%F = Subject Title (language matched from master subjects)",
  "%G = Course Title (from master courses)",
];

const SAMPLE_CSV = `unique_id,subject_code,session,language,course_code
BHIC131ENG202526,BHIC 131,2025-2026,English,BAHIH
BHIC132HIN202526,BHIC 132,2025-2026,Hindi,BAHIH
BEGC101ENG202526,BEGC 101,2025-2026,English,BAEGH
BPSC101ENG202526,BPSC 101,2025-2026,English,"BAPSH, BAG"`;

function notifyLongTaskStart() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("admin-long-task-start"));
  }
}

function notifyLongTaskEnd() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("admin-long-task-end"));
  }
}

export default function BulkDetailsPage() {
  const allowedCategories = useMemo(
    () => CATEGORY_CONFIG.filter((c) => c.label !== PHYSICAL_CATEGORY).map((c) => c.label),
    []
  );

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkResponse | null>({
    ok: false,
    dryRun: true,
    summary: {
      totalRows: 0,
      validRows: 0,
      createdRows: 0,
      updatedRows: 0,
      skippedRows: 0,
      failedRows: 0,
    },
    items: [],
  });

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [serverMessage, setServerMessage] = useState("");
  const [serverMessageType, setServerMessageType] = useState<"success" | "error" | "info">("info");

  const [form, setForm] = useState({
    category: "Solved Assignments",
    titleTemplate: DEFAULT_TITLE_TEMPLATE,
    importantNoteTemplate: DEFAULT_NOTE,
    shortDescTemplate: DEFAULT_SHORT_DESC_TEMPLATE,
    longDescTemplate: DEFAULT_LONG_DESC_TEMPLATE,
    slugTemplate: "",
    metaTitleTemplate: DEFAULT_META_TITLE_TEMPLATE,
    metaDescriptionTemplate: DEFAULT_META_DESCRIPTION_TEMPLATE,
    publishNow: false,
    csvText: "",
    duplicateStrategy: "ignore" as "replace" | "ignore",
  });

  const canSubmit = useMemo(() => {
    return form.category.trim() && form.titleTemplate.trim() && (form.csvText.trim() || uploadFile);
  }, [form, uploadFile]);

  function fillSample() {
    setForm((p) => ({ ...p, csvText: SAMPLE_CSV }));
    setUploadFile(null);
    setServerMessage("");
  }

  function resetMessages() {
    setServerMessage("");
    setServerMessageType("info");
  }

  async function safeReadJson(res: Response) {
    const text = await res.text();
    if (!text) return { ok: false, error: "Server returned empty response" };

    try {
      return JSON.parse(text);
    } catch {
      return {
        ok: false,
        error: text.slice(0, 300) || "Invalid server response",
      };
    }
  }

  async function submit(dryRun: boolean) {
    if (!canSubmit) {
      alert("Category, Title Template aur CSV/Excel data required hai.");
      return;
    }

    if (form.category === PHYSICAL_CATEGORY) {
      alert(
        "Handwritten Hardcopy (Delivery) category ka manual bulk upload disabled hai. Ye products ab Solved Assignments se automatically generate honge."
      );
      return;
    }

    setLoading(true);
    setResult(null);
    resetMessages();
    notifyLongTaskStart();

    try {
      let res: Response;

      if (uploadFile) {
        const fd = new FormData();
        fd.append("file", uploadFile);
        fd.append("dryRun", String(dryRun));
        fd.append("category", form.category);
        fd.append("titleTemplate", form.titleTemplate);
        fd.append("importantNoteTemplate", form.importantNoteTemplate);
        fd.append("shortDescTemplate", form.shortDescTemplate);
        fd.append("longDescTemplate", form.longDescTemplate);
        fd.append("slugTemplate", form.slugTemplate);
        fd.append("metaTitleTemplate", form.metaTitleTemplate);
        fd.append("metaDescriptionTemplate", form.metaDescriptionTemplate);
        fd.append("publishNow", String(form.publishNow));
        fd.append("duplicateStrategy", form.duplicateStrategy);

        res = await fetch("/api/admin/products/bulk/details", {
          method: "POST",
          credentials: "include",
          body: fd,
        });
      } else {
        res = await fetch("/api/admin/products/bulk/details", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            dryRun,
            category: form.category,
            titleTemplate: form.titleTemplate,
            importantNoteTemplate: form.importantNoteTemplate,
            shortDescTemplate: form.shortDescTemplate,
            longDescTemplate: form.longDescTemplate,
            slugTemplate: form.slugTemplate,
            metaTitleTemplate: form.metaTitleTemplate,
            metaDescriptionTemplate: form.metaDescriptionTemplate,
            publishNow: form.publishNow,
            csvText: form.csvText,
            duplicateStrategy: form.duplicateStrategy,
          }),
        });
      }

      const data = (await safeReadJson(res)) as BulkResponse;

      if (!res.ok || !data?.ok) {
        const errMsg = data?.error || "Bulk request failed";
        setServerMessage(errMsg);
        setServerMessageType("error");
        alert(errMsg);
        return;
      }

      setResult(data);
      setServerMessage(
        data?.message ||
          (dryRun
            ? "Validation completed successfully."
            : "Products processed successfully.")
      );
      setServerMessageType("success");
    } catch (e: any) {
      const errMsg = e?.message || "Server error";
      setServerMessage(errMsg);
      setServerMessageType("error");
      alert(errMsg);
    } finally {
      notifyLongTaskEnd();
      setLoading(false);
    }
  }

  const summary = result?.summary;

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-extrabold">Bulk Product Details Upload</h1>
              <p className="text-sm text-slate-600 mt-1">
                Static template + CSV/Excel row merge. Subject, course aur session validation server side par hogi.
              </p>
            </div>

            <Link
              href="/admin/products/bulk"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
            >
              <ArrowLeft size={18} />
              Back
            </Link>
          </div>

          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <Lock size={18} className="mt-0.5 shrink-0 text-blue-800" />
              <div>
                <div className="text-sm font-extrabold text-blue-900">
                  Pricing aur availability dono auto-managed hain
                </div>
                <div className="text-sm text-blue-800 mt-2 leading-6">
                  Ab bulk upload me <b>manual price</b> aur <b>manual availability</b> ki need nahi hai.
                  <br />
                  Final price <b>Product Pricing rules</b> se aayega.
                  <br />
                  Final availability <b>solved PDF / official paper existence</b> se auto derive hogi.
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-extrabold text-emerald-900">Sample CSV rows</div>
                <div className="text-sm text-emerald-800 mt-1">
                  Ab minimum 5 columns hi chahiye: SKU, Subject Code, Session, Language, Course Code.
                </div>
              </div>
              <button
                type="button"
                onClick={fillSample}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
              >
                <FileSpreadsheet size={16} />
                Fill Sample
              </button>
            </div>

            <pre className="mt-3 overflow-auto rounded-xl bg-white border border-emerald-200 p-3 text-xs leading-6 text-slate-700">
              {SAMPLE_CSV}
            </pre>
          </div>

          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="text-sm font-extrabold text-blue-900">CSV / Excel format</div>
            <div className="text-sm text-blue-800 mt-2 leading-6">
              File me required columns ye hain: <b>Unique Id, Subject Code, Session, Language, Course Code</b>.
              <br />
              {TOKEN_HELP.map((x) => (
                <div key={x}>{x}</div>
              ))}
              <div className="mt-2 font-semibold">
                Note: %F me sirf usi language ka subject title aayega jo row me diya gaya hai. English row me Hindi ya other title nahi aayega.
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
                {serverMessageType === "success" ? (
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                ) : serverMessageType === "error" ? (
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                ) : (
                  <Info size={18} className="mt-0.5 shrink-0" />
                )}
                <div>{serverMessage}</div>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
              Long admin task running. Inactivity auto-logout is temporarily paused until this process finishes.
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <div className="text-sm font-extrabold mb-3">Static Template Details</div>

                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Category</label>
                <select
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                >
                  {allowedCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">Title Template</label>
                <input
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  value={form.titleTemplate}
                  onChange={(e) => setForm((p) => ({ ...p, titleTemplate: e.target.value }))}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">Important Note Template</label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[90px]"
                  value={form.importantNoteTemplate}
                  onChange={(e) => setForm((p) => ({ ...p, importantNoteTemplate: e.target.value }))}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">Short Description Template</label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[90px]"
                  value={form.shortDescTemplate}
                  onChange={(e) => setForm((p) => ({ ...p, shortDescTemplate: e.target.value }))}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">Long Description Template</label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[140px]"
                  value={form.longDescTemplate}
                  onChange={(e) => setForm((p) => ({ ...p, longDescTemplate: e.target.value }))}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">Slug Template (optional)</label>
                <input
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  placeholder="Leave blank for auto slug"
                  value={form.slugTemplate}
                  onChange={(e) => setForm((p) => ({ ...p, slugTemplate: e.target.value }))}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">Meta Title Template</label>
                <input
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  value={form.metaTitleTemplate}
                  onChange={(e) => setForm((p) => ({ ...p, metaTitleTemplate: e.target.value }))}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">Meta Description Template</label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[110px]"
                  value={form.metaDescriptionTemplate}
                  onChange={(e) => setForm((p) => ({ ...p, metaDescriptionTemplate: e.target.value }))}
                />

                <div className="flex items-center gap-3 mt-4">
                  <input
                    type="checkbox"
                    checked={form.publishNow}
                    onChange={(e) => setForm((p) => ({ ...p, publishNow: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  <div className="font-bold">Publish now (otherwise draft)</div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-sm font-extrabold mb-3">CSV / Excel Input</div>

                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Upload CSV / Excel file</label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setUploadFile(file);
                    if (file) {
                      setForm((p) => ({ ...p, csvText: "" }));
                    }
                  }}
                />

                <div className="mt-2 text-xs text-slate-500">
                  Selected file: {uploadFile ? uploadFile.name : "No file selected"}
                </div>

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">Or paste CSV text</label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 outline-none min-h-[260px] font-mono text-sm"
                  placeholder={SAMPLE_CSV}
                  value={form.csvText}
                  onChange={(e) => {
                    setUploadFile(null);
                    setForm((p) => ({ ...p, csvText: e.target.value }));
                  }}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-sm font-extrabold mb-3">Duplicate Product Handling</div>

                <div className="space-y-3">
                  <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="duplicateStrategy"
                      value="ignore"
                      checked={form.duplicateStrategy === "ignore"}
                      onChange={() => setForm((p) => ({ ...p, duplicateStrategy: "ignore" }))}
                      className="mt-1 h-4 w-4"
                    />
                    <div>
                      <div className="font-bold text-sm">Ignore duplicate row</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Same SKU ya same generated slug mile to old product same rahega, new row skip ho jayegi.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="duplicateStrategy"
                      value="replace"
                      checked={form.duplicateStrategy === "replace"}
                      onChange={() => setForm((p) => ({ ...p, duplicateStrategy: "replace" }))}
                      className="mt-1 h-4 w-4"
                    />
                    <div>
                      <div className="font-bold text-sm">Replace existing product</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Same SKU ya same generated slug mile to old product ki details new uploaded data se update ho jayengi.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-sm font-extrabold mb-3">Actions</div>

                <button
                  type="button"
                  disabled={loading || !canSubmit}
                  onClick={() => submit(true)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white transition font-extrabold disabled:opacity-60"
                >
                  <CheckCircle2 size={18} />
                  {loading ? "Working..." : "Validate Only"}
                </button>

                <button
                  type="button"
                  disabled={loading || !canSubmit}
                  onClick={() => submit(false)}
                  className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-950 text-white transition font-extrabold disabled:opacity-60"
                >
                  <Database size={18} />
                  {loading ? "Working..." : "Create Products"}
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setUploadFile(null);
                    setServerMessage("");
                    setResult({
                      ok: false,
                      dryRun: true,
                      summary: {
                        totalRows: 0,
                        validRows: 0,
                        createdRows: 0,
                        updatedRows: 0,
                        skippedRows: 0,
                        failedRows: 0,
                      },
                      items: [],
                    });
                    setForm({
                      category: "Solved Assignments",
                      titleTemplate: DEFAULT_TITLE_TEMPLATE,
                      importantNoteTemplate: DEFAULT_NOTE,
                      shortDescTemplate: DEFAULT_SHORT_DESC_TEMPLATE,
                      longDescTemplate: DEFAULT_LONG_DESC_TEMPLATE,
                      slugTemplate: "",
                      metaTitleTemplate: DEFAULT_META_TITLE_TEMPLATE,
                      metaDescriptionTemplate: DEFAULT_META_DESCRIPTION_TEMPLATE,
                      publishNow: false,
                      csvText: "",
                      duplicateStrategy: "ignore",
                    });
                  }}
                  className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-extrabold disabled:opacity-60"
                >
                  <RefreshCcw size={18} />
                  Reset Form
                </button>

                <div className="mt-4 text-[11px] text-slate-500 leading-5">
                  Pehle Validate Only run karo. Jab summary me failed rows 0 ya acceptable ho tab Create Products run karo.
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="inline-flex items-center gap-2 text-sm font-extrabold text-amber-900">
                  <AlertTriangle size={16} />
                  Important
                </div>
                <div className="text-sm text-amber-800 mt-2 leading-6">
                  Subject code master subjects me hona chahiye.
                  <br />
                  Course code master courses me hona chahiye.
                  <br />
                  Multiple course codes comma separated allowed hain.
                  <br />
                  Session selected category ke master sessions me valid hona chahiye.
                  <br />
                  Final saved price Product Pricing rules se aayega.
                  <br />
                  Final availability file existence se derive hogi.
                  <br />
                  Duplicate handling aapke selected Ignore / Replace mode ke hisab se hogi.
                  <br />
                  %F aur %G master data se auto aayenge. Excel me inke liye alag columns dene ki zarurat nahi hai.
                </div>
              </div>
            </div>
          </div>

          {result && (
            <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-lg font-extrabold">
                    Result Summary {result?.dryRun ? "(Validation Only)" : "(Create Mode)"}
                  </div>
                  <div className="text-sm text-slate-500 mt-1">
                    Duplicate Strategy:{" "}
                    <span className="font-bold uppercase">{result?.duplicateStrategy || form.duplicateStrategy}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mt-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs text-slate-500 font-bold uppercase">Total Rows</div>
                  <div className="text-xl font-extrabold mt-1">{summary?.totalRows ?? 0}</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs text-slate-500 font-bold uppercase">Valid Rows</div>
                  <div className="text-xl font-extrabold mt-1">{summary?.validRows ?? 0}</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs text-slate-500 font-bold uppercase">Created Rows</div>
                  <div className="text-xl font-extrabold mt-1">{summary?.createdRows ?? 0}</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs text-slate-500 font-bold uppercase">Updated Rows</div>
                  <div className="text-xl font-extrabold mt-1">{summary?.updatedRows ?? 0}</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs text-slate-500 font-bold uppercase">Skipped Rows</div>
                  <div className="text-xl font-extrabold mt-1">{summary?.skippedRows ?? 0}</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs text-slate-500 font-bold uppercase">Failed Rows</div>
                  <div className="text-xl font-extrabold mt-1">{summary?.failedRows ?? 0}</div>
                </div>
              </div>

              {!result?.dryRun && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-sm font-extrabold">Combo Sync</div>
                    <div className="text-sm text-slate-600 mt-2 leading-6">
                      Attempted: <b>{result?.comboSync?.attempted ?? 0}</b>
                      <br />
                      Succeeded: <b>{result?.comboSync?.succeeded ?? 0}</b>
                      <br />
                      Failed: <b>{result?.comboSync?.failed ?? 0}</b>
                    </div>
                    {result?.comboSync?.errors?.length ? (
                      <div className="mt-2 text-xs text-rose-700">
                        {result.comboSync.errors.join(" | ")}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-sm font-extrabold">Hardcopy Sync</div>
                    <div className="text-sm text-slate-600 mt-2 leading-6">
                      Attempted: <b>{result?.hardcopySync?.attempted ?? 0}</b>
                      <br />
                      Succeeded: <b>{result?.hardcopySync?.succeeded ?? 0}</b>
                      <br />
                      Failed: <b>{result?.hardcopySync?.failed ?? 0}</b>
                    </div>
                    {result?.hardcopySync?.errors?.length ? (
                      <div className="mt-2 text-xs text-rose-700">
                        {result.hardcopySync.errors.join(" | ")}
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              <div className="mt-5 overflow-auto">
                <table className="min-w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 border-b">Row</th>
                      <th className="text-left px-3 py-2 border-b">SKU</th>
                      <th className="text-left px-3 py-2 border-b">Title</th>
                      <th className="text-left px-3 py-2 border-b">Course Codes</th>
                      <th className="text-left px-3 py-2 border-b">Course Titles</th>
                      <th className="text-left px-3 py-2 border-b">Duplicate</th>
                      <th className="text-left px-3 py-2 border-b">Match By</th>
                      <th className="text-left px-3 py-2 border-b">Status</th>
                      <th className="text-left px-3 py-2 border-b">Availability After</th>
                      <th className="text-left px-3 py-2 border-b">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result?.items || []).map((item, idx) => (
                      <tr key={`${item.rowNumber}-${idx}`} className="border-b last:border-b-0 align-top">
                        <td className="px-3 py-2">{item.rowNumber}</td>
                        <td className="px-3 py-2 font-semibold">{item.sku || "—"}</td>
                        <td className="px-3 py-2 min-w-[260px]">{item.title || "—"}</td>
                        <td className="px-3 py-2 min-w-[180px]">
                          {item.courseCodes?.length ? item.courseCodes.join(", ") : "—"}
                        </td>
                        <td className="px-3 py-2 min-w-[220px]">
                          {item.courseTitles?.length ? item.courseTitles.join(", ") : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {item.duplicateFound ? (
                            <span className="inline-flex rounded-full bg-amber-100 text-amber-800 px-2 py-1 text-xs font-bold">
                              Yes
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-emerald-100 text-emerald-800 px-2 py-1 text-xs font-bold">
                              No
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 uppercase text-xs font-bold text-slate-600">
                          {item.matchedBy || "—"}
                        </td>
                        <td className="px-3 py-2 font-bold">
                          {item.status === "created" ? (
                            <span className="text-emerald-700">Created</span>
                          ) : item.status === "updated" ? (
                            <span className="text-blue-700">Updated</span>
                          ) : item.status === "skipped" ? (
                            <span className="text-amber-700">Skipped</span>
                          ) : item.status === "validated" ? (
                            <span className="text-slate-700">Valid</span>
                          ) : (
                            <span className="text-rose-700">Failed</span>
                          )}
                        </td>
                        <td className="px-3 py-2 min-w-[160px] font-semibold text-slate-700">
                          {item.availabilityAfter || "Auto on final save"}
                        </td>
                        <td
                          className={`px-3 py-2 min-w-[280px] ${
                            item.status === "failed"
                              ? "text-rose-700"
                              : item.status === "skipped"
                              ? "text-amber-700"
                              : "text-slate-700"
                          }`}
                        >
                          {item.reason || "—"}
                          {item.missingCourse?.length ? ` (${item.missingCourse.join(", ")})` : ""}
                          {item.missingSubject ? ` (${item.missingSubject})` : ""}
                          {item.missingSession ? ` (${item.missingSession})` : ""}
                        </td>
                      </tr>
                    ))}

                    {(!result?.items || result.items.length === 0) && (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                          No rows to display.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}