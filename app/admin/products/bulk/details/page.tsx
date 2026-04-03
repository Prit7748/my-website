"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Download,
  Play,
  PauseCircle,
  LoaderCircle,
  BarChart3,
} from "lucide-react";
import { CATEGORY_CONFIG, PHYSICAL_CATEGORY } from "@/lib/productCatalog";

type RecentFailureItem = {
  itemIndex?: number;
  rowNumber?: number;
  batchNumber?: number;
  identifier?: string;
  sku?: string;
  fileName?: string;
  status?: string;
  reason?: string;
  createdAt?: string | null;
};

type BulkJobProgress = {
  totalItems: number;
  processedItems: number;
  successItems: number;
  failedItems: number;
  skippedItems: number;
  validItems: number;
  batchSize: number;
  batchCount: number;
  currentBatchNumber: number;
  lastProcessedIndex: number;
  progressPercent: number;
};

type BulkJobState = {
  _id: string;
  jobType: string;
  jobLabel: string;
  status: string;
  createdBy: string;
  meta?: any;
  config?: any;
  summary?: any;
  progress?: BulkJobProgress;
  lastBatch?: {
    batchNumber?: number;
    fromIndex?: number;
    toIndex?: number;
    attempted?: number;
    success?: number;
    failed?: number;
    skipped?: number;
    startedAt?: string | null;
    endedAt?: string | null;
    note?: string;
  } | null;
  failuresCount?: number;
  recentFailures?: RecentFailureItem[];
  resultMessage?: string;
  downloadFileName?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  cancelledAt?: string | null;
  lastHeartbeatAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
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

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function formatDateTime(input?: string | null) {
  if (!input) return "—";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN");
}

function isFinalStatus(status: string) {
  const s = safeStr(status);
  return (
    s === "completed" ||
    s === "completed_with_errors" ||
    s === "failed" ||
    s === "cancelled"
  );
}

function statusTone(status: string) {
  const s = safeStr(status);

  if (s === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (s === "completed_with_errors") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (s === "failed" || s === "cancelled") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  return "border-blue-200 bg-blue-50 text-blue-800";
}

export default function BulkDetailsPage() {
  const allowedCategories = useMemo(
    () =>
      CATEGORY_CONFIG.filter((c) => c.label !== PHYSICAL_CATEGORY).map(
        (c) => c.label
      ),
    []
  );

  const [loading, setLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [serverMessage, setServerMessage] = useState("");
  const [serverMessageType, setServerMessageType] = useState<
    "success" | "error" | "info"
  >("info");

  const [activeJob, setActiveJob] = useState<BulkJobState | null>(null);
  const [activeJobId, setActiveJobId] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const processInFlightRef = useRef(false);
  const longTaskActiveRef = useRef(false);

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
    batchSize: 500,
  });

  const canSubmit = useMemo(() => {
    return (
      form.category.trim() &&
      form.titleTemplate.trim() &&
      (form.csvText.trim() || uploadFile)
    );
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

  function resetJobState() {
    setActiveJob(null);
    setActiveJobId("");
  }

  async function safeReadJson(res: Response) {
    const text = await res.text();
    if (!text) return { ok: false, error: "Server returned empty response" };

    try {
      return JSON.parse(text);
    } catch {
      return {
        ok: false,
        error: text.slice(0, 400) || "Invalid server response",
      };
    }
  }

  async function fetchJobStatus(jobId: string) {
    const res = await fetch(`/api/admin/bulk-jobs/${encodeURIComponent(jobId)}`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    const data = await safeReadJson(res);
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || "Failed to fetch job status");
    }

    const job = data?.job as BulkJobState;
    setActiveJob(job);
    return job;
  }

  async function processNextBatch(jobId: string) {
    if (!jobId || processInFlightRef.current) return;

    processInFlightRef.current = true;
    try {
      const res = await fetch("/api/admin/products/bulk/details/jobs/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ jobId }),
      });

      const data = await safeReadJson(res);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Batch processing failed");
      }

      if (data?.job) {
        setActiveJob(data.job as BulkJobState);
      }
    } finally {
      processInFlightRef.current = false;
    }
  }

  async function createJob(dryRun: boolean) {
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
    resetMessages();
    resetJobState();

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
        fd.append("batchSize", String(form.batchSize));

        res = await fetch("/api/admin/products/bulk/details/jobs", {
          method: "POST",
          credentials: "include",
          body: fd,
        });
      } else {
        res = await fetch("/api/admin/products/bulk/details/jobs", {
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
            batchSize: form.batchSize,
          }),
        });
      }

      const data = await safeReadJson(res);

      if (!res.ok || !data?.ok) {
        const errMsg = data?.error || "Job creation failed";
        setServerMessage(errMsg);
        setServerMessageType("error");
        alert(errMsg);
        return;
      }

      const job = data?.job as BulkJobState;
      setActiveJob(job);
      setActiveJobId(job?._id || "");
      setServerMessage(
        dryRun
          ? "Validation job started successfully."
          : "Bulk upload job started successfully."
      );
      setServerMessageType("success");
    } catch (e: any) {
      const errMsg = e?.message || "Server error";
      setServerMessage(errMsg);
      setServerMessageType("error");
      alert(errMsg);
    } finally {
      setLoading(false);
    }
  }

  async function cancelCurrentJob() {
    if (!activeJobId) return;

    const ok = window.confirm("Current bulk job ko cancel karna hai?");
    if (!ok) return;

    setIsCancelling(true);
    try {
      const res = await fetch(`/api/admin/bulk-jobs/${encodeURIComponent(activeJobId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "cancel" }),
      });

      const data = await safeReadJson(res);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Cancel failed");
      }

      if (data?.job) {
        setActiveJob(data.job as BulkJobState);
      }

      setServerMessage("Bulk job cancelled.");
      setServerMessageType("info");
    } catch (e: any) {
      const errMsg = e?.message || "Cancel failed";
      setServerMessage(errMsg);
      setServerMessageType("error");
      alert(errMsg);
    } finally {
      setIsCancelling(false);
    }
  }

  const currentStatus = safeStr(activeJob?.status);
  const isJobActive = Boolean(activeJobId) && !isFinalStatus(currentStatus);
  const progress = activeJob?.progress;
  const summary = activeJob?.summary || {};
  const recentFailures = Array.isArray(activeJob?.recentFailures)
    ? activeJob!.recentFailures!
    : [];

  useEffect(() => {
    if (isJobActive && !longTaskActiveRef.current) {
      notifyLongTaskStart();
      longTaskActiveRef.current = true;
    }

    if ((!isJobActive || isFinalStatus(currentStatus)) && longTaskActiveRef.current) {
      notifyLongTaskEnd();
      longTaskActiveRef.current = false;
    }
  }, [isJobActive, currentStatus]);

  useEffect(() => {
    if (!activeJobId) return;
    if (isFinalStatus(currentStatus)) return;

    const timer = setTimeout(() => {
      void processNextBatch(activeJobId);
    }, 400);

    return () => clearTimeout(timer);
  }, [activeJobId, currentStatus, activeJob?.progress?.processedItems]);

  useEffect(() => {
    if (!activeJobId) return;
    if (isFinalStatus(currentStatus)) return;

    const interval = setInterval(() => {
      void fetchJobStatus(activeJobId).catch(() => {
        // ignore polling error
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [activeJobId, currentStatus]);

  useEffect(() => {
    return () => {
      if (longTaskActiveRef.current) {
        notifyLongTaskEnd();
        longTaskActiveRef.current = false;
      }
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-extrabold">Bulk Product Details Upload</h1>
              <p className="text-sm text-slate-600 mt-1">
                Ab ye flow job-based batch system par chal raha hai. Large upload ab
                batch-wise process hoga.
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
                  Minimum required columns: SKU, Subject Code, Session, Language, Course Code.
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
                Note: %F me sirf usi language ka subject title aayega jo row me diya gaya hai.
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

          {activeJob ? (
            <div className={`mt-4 rounded-2xl border p-4 ${statusTone(currentStatus)}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-sm font-extrabold">
                    Current Job: {safeStr(activeJob.jobLabel) || "Bulk Product Details"}
                  </div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-wide">
                    Status: {safeStr(activeJob.status) || "—"}
                  </div>
                  <div className="mt-2 text-xs leading-5">
                    Job ID: <b>{activeJob._id}</b>
                    <br />
                    Started: <b>{formatDateTime(activeJob.startedAt || activeJob.createdAt)}</b>
                    <br />
                    Last heartbeat: <b>{formatDateTime(activeJob.lastHeartbeatAt)}</b>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {activeJobId ? (
                    <a
                      href={`/api/admin/bulk-jobs/${encodeURIComponent(activeJobId)}/failures`}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold shadow-sm border ${
                        Number(activeJob.failuresCount || 0) > 0
                          ? "bg-white hover:bg-gray-50 border-gray-200 text-slate-900"
                          : "bg-gray-100 border-gray-200 text-slate-400 pointer-events-none"
                      }`}
                    >
                      <Download size={16} />
                      Download Failed CSV
                    </a>
                  ) : null}

                  {!isFinalStatus(currentStatus) ? (
                    <button
                      type="button"
                      onClick={cancelCurrentJob}
                      disabled={isCancelling}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-sm disabled:opacity-60"
                    >
                      <PauseCircle size={16} />
                      {isCancelling ? "Cancelling..." : "Cancel Job"}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/70 bg-white/70 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm font-extrabold">
                    Progress
                  </div>
                  <div className="text-sm font-bold">
                    {progress?.processedItems ?? 0} / {progress?.totalItems ?? 0} processed
                  </div>
                </div>

                <div className="mt-3 h-4 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-slate-900 transition-all"
                    style={{ width: `${progress?.progressPercent ?? 0}%` }}
                  />
                </div>

                <div className="mt-2 text-xs font-semibold text-slate-700">
                  {progress?.progressPercent ?? 0}% complete
                </div>

                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="text-xs text-slate-500 font-bold uppercase">Total Rows</div>
                    <div className="text-xl font-extrabold mt-1">{progress?.totalItems ?? 0}</div>
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

                <div className="mt-4 grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-sm font-extrabold">Batch Status</div>
                    <div className="text-sm text-slate-600 mt-2 leading-6">
                      Current Batch: <b>{progress?.currentBatchNumber ?? 0}</b> / <b>{progress?.batchCount ?? 0}</b>
                      <br />
                      Batch Size: <b>{progress?.batchSize ?? 0}</b>
                      <br />
                      Last Processed Index: <b>{progress?.lastProcessedIndex ?? -1}</b>
                    </div>
                    {activeJob?.lastBatch?.note ? (
                      <div className="mt-2 text-xs text-slate-700">
                        {activeJob.lastBatch.note}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-sm font-extrabold">Combo Sync</div>
                    <div className="text-sm text-slate-600 mt-2 leading-6">
                      Attempted: <b>{summary?.comboSync?.attempted ?? 0}</b>
                      <br />
                      Succeeded: <b>{summary?.comboSync?.succeeded ?? 0}</b>
                      <br />
                      Failed: <b>{summary?.comboSync?.failed ?? 0}</b>
                    </div>
                    {Array.isArray(summary?.comboSync?.errors) && summary.comboSync.errors.length ? (
                      <div className="mt-2 text-xs text-rose-700">
                        {summary.comboSync.errors.join(" | ")}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-sm font-extrabold">Hardcopy Sync</div>
                    <div className="text-sm text-slate-600 mt-2 leading-6">
                      Attempted: <b>{summary?.hardcopySync?.attempted ?? 0}</b>
                      <br />
                      Succeeded: <b>{summary?.hardcopySync?.succeeded ?? 0}</b>
                      <br />
                      Failed: <b>{summary?.hardcopySync?.failed ?? 0}</b>
                    </div>
                    {Array.isArray(summary?.hardcopySync?.errors) && summary.hardcopySync.errors.length ? (
                      <div className="mt-2 text-xs text-rose-700">
                        {summary.hardcopySync.errors.join(" | ")}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {isJobActive ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
              <div className="flex items-center gap-2">
                <LoaderCircle size={18} className="animate-spin" />
                Batch job running. Inactivity auto-logout temporarily paused hai jab tak job finish nahi hoti.
              </div>
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
                  disabled={isJobActive}
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
                  disabled={isJobActive}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">Important Note Template</label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[90px]"
                  value={form.importantNoteTemplate}
                  onChange={(e) => setForm((p) => ({ ...p, importantNoteTemplate: e.target.value }))}
                  disabled={isJobActive}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">Short Description Template</label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[90px]"
                  value={form.shortDescTemplate}
                  onChange={(e) => setForm((p) => ({ ...p, shortDescTemplate: e.target.value }))}
                  disabled={isJobActive}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">Long Description Template</label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[140px]"
                  value={form.longDescTemplate}
                  onChange={(e) => setForm((p) => ({ ...p, longDescTemplate: e.target.value }))}
                  disabled={isJobActive}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">Slug Template (optional)</label>
                <input
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  placeholder="Leave blank for auto slug"
                  value={form.slugTemplate}
                  onChange={(e) => setForm((p) => ({ ...p, slugTemplate: e.target.value }))}
                  disabled={isJobActive}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">Meta Title Template</label>
                <input
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  value={form.metaTitleTemplate}
                  onChange={(e) => setForm((p) => ({ ...p, metaTitleTemplate: e.target.value }))}
                  disabled={isJobActive}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">Meta Description Template</label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[110px]"
                  value={form.metaDescriptionTemplate}
                  onChange={(e) => setForm((p) => ({ ...p, metaDescriptionTemplate: e.target.value }))}
                  disabled={isJobActive}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1 block">Batch Size</label>
                    <select
                      className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                      value={String(form.batchSize)}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, batchSize: Number(e.target.value) }))
                      }
                      disabled={isJobActive}
                    >
                      <option value="100">100 rows / batch</option>
                      <option value="250">250 rows / batch</option>
                      <option value="500">500 rows / batch</option>
                      <option value="750">750 rows / batch</option>
                      <option value="1000">1000 rows / batch</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={form.publishNow}
                        onChange={(e) => setForm((p) => ({ ...p, publishNow: e.target.checked }))}
                        className="h-4 w-4"
                        disabled={isJobActive}
                      />
                      <div className="font-bold">Publish now (otherwise draft)</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-sm font-extrabold mb-3">CSV / Excel Input</div>

                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Upload CSV / Excel file</label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  disabled={isJobActive}
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
                  disabled={isJobActive}
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
                      disabled={isJobActive}
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
                      disabled={isJobActive}
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
                  disabled={loading || !canSubmit || isJobActive}
                  onClick={() => createJob(true)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white transition font-extrabold disabled:opacity-60"
                >
                  <Play size={18} />
                  {loading ? "Starting..." : "Validate Only"}
                </button>

                <button
                  type="button"
                  disabled={loading || !canSubmit || isJobActive}
                  onClick={() => createJob(false)}
                  className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-950 text-white transition font-extrabold disabled:opacity-60"
                >
                  <Database size={18} />
                  {loading ? "Starting..." : "Create Products"}
                </button>

                <button
                  type="button"
                  disabled={loading || isJobActive}
                  onClick={() => {
                    setUploadFile(null);
                    resetMessages();
                    resetJobState();
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
                      batchSize: 500,
                    });
                  }}
                  className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-extrabold disabled:opacity-60"
                >
                  <RefreshCcw size={18} />
                  Reset Form
                </button>

                <div className="mt-4 text-[11px] text-slate-500 leading-5">
                  Recommended: pehle Validate Only run karo, phir final Create Products job chalao.
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
                  Failed ya skipped rows CSV me export ki ja sakti hain.
                </div>
              </div>
            </div>
          </div>

          {activeJob ? (
            <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2 text-lg font-extrabold">
                <BarChart3 size={20} />
                Recent Failed / Skipped Rows
              </div>

              <div className="mt-1 text-sm text-slate-500">
                Table me recent 100 failed/skipped rows dikh rahi hain. Full list ke liye CSV download karo.
              </div>

              <div className="mt-5 overflow-auto">
                <table className="min-w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 border-b">Batch</th>
                      <th className="text-left px-3 py-2 border-b">Row</th>
                      <th className="text-left px-3 py-2 border-b">SKU</th>
                      <th className="text-left px-3 py-2 border-b">Identifier</th>
                      <th className="text-left px-3 py-2 border-b">Status</th>
                      <th className="text-left px-3 py-2 border-b">Reason</th>
                      <th className="text-left px-3 py-2 border-b">Logged At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentFailures.map((item, idx) => (
                      <tr key={`${item.rowNumber}-${idx}`} className="border-b last:border-b-0 align-top">
                        <td className="px-3 py-2">{item.batchNumber || "—"}</td>
                        <td className="px-3 py-2">{item.rowNumber || "—"}</td>
                        <td className="px-3 py-2 font-semibold">{item.sku || "—"}</td>
                        <td className="px-3 py-2">{item.identifier || "—"}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${
                              safeStr(item.status) === "skipped"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {safeStr(item.status) || "failed"}
                          </span>
                        </td>
                        <td className="px-3 py-2 min-w-[320px] text-slate-700">{item.reason || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(item.createdAt)}</td>
                      </tr>
                    ))}

                    {recentFailures.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          No failed/skipped rows recorded yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}