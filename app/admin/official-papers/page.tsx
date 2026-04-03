"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  Search,
  RefreshCcw,
  Download,
  Trash2,
  RotateCcw,
  XCircle,
  ExternalLink,
  FileText,
  FolderOpen,
  Clock3,
  Boxes,
  BadgeCheck,
  X,
  Pencil,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Info,
  PauseCircle,
  LoaderCircle,
  BarChart3,
  Database,
} from "lucide-react";

type OfficialPaperItem = {
  _id: string;
  skuNormalized: string;
  productExists: boolean;
  productId?: string;
  productSku?: string;
  productSlug?: string;
  titleColor?: string;
  originalName: string;
  fileName: string;
  fileExt?: string;
  baseName?: string;
  mimeType?: string;
  sizeBytes?: number;
  pageCount?: number;
  uploadedAt?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
  productCategory?: string;
  productSubjectCode?: string;
  productLanguage?: string;
  productSession?: string;
  productCourseCodes?: string[];
};

type FileListResponse = {
  ok?: boolean;
  files?: OfficialPaperItem[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
};

type StatsResponse = {
  ok?: boolean;
  stats?: {
    totalLiveOfficialPapers?: number;
    onlyUnsolvedWithoutSolvedCount?: number;
    matchedProductsCount?: number;
    unmatchedProductsCount?: number;
    lastUploadDate?: string | null;
    lastUploadFileName?: string;
    lastUploadSku?: string;
  };
};

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

function formatBytes(bytes: number) {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(input?: string | null) {
  if (!input) return "-";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-IN");
}

function formatDateTime(input?: string | null) {
  if (!input) return "—";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN");
}

function safeText(x: any) {
  return String(x ?? "").trim();
}

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

function isFinalStatus(status: string) {
  const s = safeText(status);
  return (
    s === "completed" ||
    s === "completed_with_errors" ||
    s === "failed" ||
    s === "cancelled"
  );
}

function statusTone(status: string) {
  const s = safeText(status);

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

const CATEGORY_OPTIONS = [
  "",
  "Solved Assignments",
  "Question Papers (PYQ)",
  "Handwritten PDFs",
  "Ebooks",
  "Guess Papers",
  "projects",
  "Handwritten Hardcopy (Delivery)",
];

const LANGUAGE_OPTIONS = ["", "Hindi", "English", "Sanskrit", "Urdu"];

export default function OfficialPapersPage() {
  const [files, setFiles] = useState<OfficialPaperItem[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);

  const [stats, setStats] = useState<StatsResponse["stats"]>({
    totalLiveOfficialPapers: 0,
    onlyUnsolvedWithoutSolvedCount: 0,
    matchedProductsCount: 0,
    unmatchedProductsCount: 0,
    lastUploadDate: null,
    lastUploadFileName: "",
    lastUploadSku: "",
  });

  const [serverMessage, setServerMessage] = useState("");
  const [serverMessageType, setServerMessageType] = useState<
    "success" | "error" | "info"
  >("info");

  const [search, setSearch] = useState("");
  const [showTrash, setShowTrash] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState("");
  const [courseCodeFilter, setCourseCodeFilter] = useState("");
  const [subjectCodeFilter, setSubjectCodeFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");

  const [sortBy, setSortBy] = useState("uploadedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);

  const [zipFile, setZipFile] = useState<File | null>(null);
  const [conflictMode, setConflictMode] = useState<"ignore" | "replace">("ignore");
  const [batchSize, setBatchSize] = useState(100);
  const [creatingJob, setCreatingJob] = useState(false);

  const [activeJob, setActiveJob] = useState<BulkJobState | null>(null);
  const [activeJobId, setActiveJobId] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const [actionLoadingId, setActionLoadingId] = useState("");

  const processInFlightRef = useRef(false);
  const longTaskActiveRef = useRef(false);
  const finalRefreshDoneRef = useRef(false);

  const currentStatus = safeText(activeJob?.status);
  const isJobActive = Boolean(activeJobId) && !isFinalStatus(currentStatus);
  const progress = activeJob?.progress;
  const summary = activeJob?.summary || {};
  const recentFailures = Array.isArray(activeJob?.recentFailures)
    ? activeJob.recentFailures
    : [];

  function resetMessages() {
    setServerMessage("");
    setServerMessageType("info");
  }

  function resetJobState() {
    setActiveJob(null);
    setActiveJobId("");
    finalRefreshDoneRef.current = false;
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
      const res = await fetch("/api/admin/official-papers/jobs/process", {
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

  async function loadStats() {
    try {
      const res = await fetch("/api/admin/official-papers/stats", {
        credentials: "include",
        cache: "no-store",
      });

      const data: StatsResponse = await res.json().catch(() => ({}));
      if (!res.ok) return;

      setStats({
        totalLiveOfficialPapers: Number(data?.stats?.totalLiveOfficialPapers || 0),
        onlyUnsolvedWithoutSolvedCount: Number(
          data?.stats?.onlyUnsolvedWithoutSolvedCount || 0
        ),
        matchedProductsCount: Number(data?.stats?.matchedProductsCount || 0),
        unmatchedProductsCount: Number(data?.stats?.unmatchedProductsCount || 0),
        lastUploadDate: data?.stats?.lastUploadDate || null,
        lastUploadFileName: String(data?.stats?.lastUploadFileName || ""),
        lastUploadSku: String(data?.stats?.lastUploadSku || ""),
      });
    } catch {
      // ignore
    }
  }

  async function loadFiles() {
    setFilesLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("q", search.trim());
      if (showTrash) qs.set("trash", "1");
      if (categoryFilter) qs.set("category", categoryFilter);
      if (courseCodeFilter.trim()) qs.set("courseCode", courseCodeFilter.trim());
      if (subjectCodeFilter.trim()) {
        qs.set("subjectCode", subjectCodeFilter.trim().toUpperCase());
      }
      if (languageFilter) qs.set("language", languageFilter);
      qs.set("sortBy", sortBy);
      qs.set("sortDir", sortDir);
      qs.set("page", String(page));
      qs.set("pageSize", String(pageSize));

      const res = await fetch(`/api/admin/official-papers/files?${qs.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });

      const data: FileListResponse = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as any)?.error || "Failed to load official papers");
        setFiles([]);
        setServerTotal(0);
        setServerTotalPages(1);
        return;
      }

      setFiles(Array.isArray(data?.files) ? data.files : []);
      setServerTotal(Number(data?.total || 0));
      setServerTotalPages(Math.max(1, Number(data?.totalPages || 1)));
    } finally {
      setFilesLoading(false);
    }
  }

  async function refreshAll() {
    await Promise.all([loadFiles(), loadStats()]);
  }

  async function createJob() {
    if (!zipFile) {
      alert("Pehle ZIP file select karo.");
      return;
    }

    if (showTrash) {
      alert("Trash view me upload allowed nahi hai.");
      return;
    }

    setCreatingJob(true);
    resetMessages();
    resetJobState();

    try {
      const fd = new FormData();
      fd.append("file", zipFile);
      fd.append("conflictMode", conflictMode);
      fd.append("batchSize", String(batchSize));

      const res = await fetch("/api/admin/official-papers/jobs", {
        method: "POST",
        credentials: "include",
        body: fd,
      });

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
      finalRefreshDoneRef.current = false;
      setServerMessage("Bulk official papers job started successfully.");
      setServerMessageType("success");

      setZipFile(null);
      const input = document.getElementById(
        "official-paper-upload-input"
      ) as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (e: any) {
      const errMsg = e?.message || "Server error";
      setServerMessage(errMsg);
      setServerMessageType("error");
      alert(errMsg);
    } finally {
      setCreatingJob(false);
    }
  }

  async function cancelCurrentJob() {
    if (!activeJobId) return;

    const ok = window.confirm("Current official papers bulk job ko cancel karna hai?");
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

  async function openPdf(file: OfficialPaperItem) {
    setActionLoadingId(file._id);
    try {
      const res = await fetch("/api/admin/official-papers/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "open", fileId: file._id }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !(data as any)?.url) {
        alert((data as any)?.error || "Open failed");
        return;
      }

      window.open(String((data as any).url), "_blank", "noopener,noreferrer");
    } finally {
      setActionLoadingId("");
    }
  }

  async function downloadPdf(file: OfficialPaperItem) {
    const password = window.prompt("Download password enter karo:");
    if (!password) return;

    setActionLoadingId(file._id);
    try {
      const res = await fetch("/api/admin/official-papers/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "download", fileId: file._id, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !(data as any)?.url) {
        alert((data as any)?.error || "Download failed");
        return;
      }

      window.open(String((data as any).url), "_blank", "noopener,noreferrer");
    } finally {
      setActionLoadingId("");
    }
  }

  async function moveToTrash(file: OfficialPaperItem) {
    const ok = window.confirm(`"${file.fileName}" ko trash me bhejna hai?`);
    if (!ok) return;

    setActionLoadingId(file._id);
    try {
      const res = await fetch(
        `/api/admin/official-papers/files?fileId=${encodeURIComponent(file._id)}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as any)?.error || "Delete failed");
        return;
      }

      await refreshAll();
    } finally {
      setActionLoadingId("");
    }
  }

  async function restoreFile(file: OfficialPaperItem) {
    setActionLoadingId(file._id);
    try {
      const res = await fetch("/api/admin/official-papers/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "restore", fileId: file._id }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as any)?.error || "Restore failed");
        return;
      }

      await refreshAll();
    } finally {
      setActionLoadingId("");
    }
  }

  async function purgeFile(file: OfficialPaperItem) {
    const ok = window.confirm(
      `"${file.fileName}" permanently delete karna hai? Ye recover nahi hoga.`
    );
    if (!ok) return;

    setActionLoadingId(file._id);
    try {
      const res = await fetch("/api/admin/official-papers/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "purge", fileId: file._id }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as any)?.error || "Permanent delete failed");
        return;
      }

      await refreshAll();
    } finally {
      setActionLoadingId("");
    }
  }

  async function syncPages(file: OfficialPaperItem) {
    setActionLoadingId(file._id);
    try {
      const res = await fetch("/api/admin/official-papers/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "syncpages", fileId: file._id }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as any)?.error || "Sync pages failed");
        return;
      }

      await refreshAll();
    } finally {
      setActionLoadingId("");
    }
  }

  async function editSkuMeta(file: OfficialPaperItem) {
    const nextSku = window.prompt("Naya SKU enter karo:", file.skuNormalized || "");
    if (!nextSku) return;

    setActionLoadingId(file._id);
    try {
      const res = await fetch("/api/admin/official-papers/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "update-meta",
          fileId: file._id,
          skuNormalized: nextSku,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as any)?.error || "Metadata update failed");
        return;
      }

      await refreshAll();
    } finally {
      setActionLoadingId("");
    }
  }

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
    if (!activeJobId) return;
    if (!isFinalStatus(currentStatus)) {
      finalRefreshDoneRef.current = false;
      return;
    }
    if (finalRefreshDoneRef.current) return;

    finalRefreshDoneRef.current = true;
    void refreshAll();
  }, [activeJobId, currentStatus]);

  useEffect(() => {
    return () => {
      if (longTaskActiveRef.current) {
        notifyLongTaskEnd();
        longTaskActiveRef.current = false;
      }
    };
  }, []);

  useEffect(() => {
    void loadStats();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadFiles();
    }, 250);

    return () => clearTimeout(t);
  }, [
    search,
    showTrash,
    categoryFilter,
    courseCodeFilter,
    subjectCodeFilter,
    languageFilter,
    sortBy,
    sortDir,
    page,
    pageSize,
  ]);

  const fromItem = serverTotal === 0 ? 0 : (page - 1) * pageSize + 1;
  const toItem = Math.min(page * pageSize, serverTotal);

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 border border-sky-200 px-3 py-1 text-xs font-extrabold text-sky-800">
                <FolderOpen size={14} />
                Readiness Management
              </div>

              <h1 className="text-2xl font-extrabold mt-3">IGNOU Official Papers</h1>
              <p className="text-sm text-slate-600 mt-1">
                Ab official papers upload job-based batch system par chalega. Large ZIP uploads me
                progress, cancel, aur failed CSV export available hai.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setShowTrash((p) => !p);
                  setPage(1);
                }}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border transition font-semibold shadow-sm ${
                  showTrash
                    ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                    : "bg-white hover:bg-gray-50 border-gray-200"
                }`}
              >
                <Trash2 size={18} />
                {showTrash ? "Trash View On" : "Open Trash"}
              </button>

              <button
                type="button"
                onClick={refreshAll}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <RefreshCcw size={18} />
                Refresh
              </button>

              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <ArrowLeft size={18} />
                Back
              </Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
              <div className="text-xs font-extrabold uppercase tracking-wide text-sky-700">
                Last Upload Date
              </div>
              <div className="mt-2 text-sm font-bold text-slate-900">
                {formatDate(stats?.lastUploadDate)}
              </div>
              <div className="mt-1 text-xs text-slate-600 break-all">
                {stats?.lastUploadFileName || "-"}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs font-extrabold uppercase tracking-wide text-amber-700">
                Only Unsolved, Solved Missing
              </div>
              <div className="mt-2 text-sm font-bold text-slate-900">
                {Number(stats?.onlyUnsolvedWithoutSolvedCount || 0)}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-xs font-extrabold uppercase tracking-wide text-emerald-700">
                Matched Products
              </div>
              <div className="mt-2 text-sm font-bold text-slate-900">
                {Number(stats?.matchedProductsCount || 0)}
              </div>
            </div>

            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="text-xs font-extrabold uppercase tracking-wide text-rose-700">
                Unmatched SKU Files
              </div>
              <div className="mt-2 text-sm font-bold text-slate-900">
                {Number(stats?.unmatchedProductsCount || 0)}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <Database size={18} className="mt-0.5 shrink-0 text-blue-800" />
              <div>
                <div className="text-sm font-extrabold text-blue-900">
                  Official papers ab ZIP + job batches me process honge
                </div>
                <div className="text-sm text-blue-800 mt-2 leading-6">
                  Single-request upload hata diya gaya hai.
                  <br />
                  Bade upload ke liye ZIP select karo, batch size choose karo, fir job start karo.
                  <br />
                  Job complete hone ke baad failed/skipped items CSV me export ki ja sakti hain.
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
                    Current Job: {safeText(activeJob.jobLabel) || "Bulk Official Papers Upload"}
                  </div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-wide">
                    Status: {safeText(activeJob.status) || "—"}
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
                  <div className="text-sm font-extrabold">Progress</div>
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
                    <div className="text-xs text-slate-500 font-bold uppercase">Total Files</div>
                    <div className="text-xl font-extrabold mt-1">
                      {summary?.totalFiles ?? progress?.totalItems ?? 0}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="text-xs text-slate-500 font-bold uppercase">Valid Files</div>
                    <div className="text-xl font-extrabold mt-1">{summary?.validFiles ?? 0}</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="text-xs text-slate-500 font-bold uppercase">Uploaded</div>
                    <div className="text-xl font-extrabold mt-1">{summary?.uploadedFiles ?? 0}</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="text-xs text-slate-500 font-bold uppercase">Replaced</div>
                    <div className="text-xl font-extrabold mt-1">{summary?.replacedFiles ?? 0}</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="text-xs text-slate-500 font-bold uppercase">Ignored / Skipped</div>
                    <div className="text-xl font-extrabold mt-1">
                      {(summary?.ignoredFiles ?? 0) + (summary?.skippedFiles ?? 0)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="text-xs text-slate-500 font-bold uppercase">Failed</div>
                    <div className="text-xl font-extrabold mt-1">{summary?.failedFiles ?? 0}</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-sm font-extrabold">Batch Status</div>
                    <div className="text-sm text-slate-600 mt-2 leading-6">
                      Current Batch: <b>{progress?.currentBatchNumber ?? 0}</b> /{" "}
                      <b>{progress?.batchCount ?? 0}</b>
                      <br />
                      Batch Size: <b>{progress?.batchSize ?? 0}</b>
                      <br />
                      Last Processed Index: <b>{progress?.lastProcessedIndex ?? -1}</b>
                    </div>
                    {activeJob?.lastBatch?.note ? (
                      <div className="mt-2 text-xs text-slate-700">{activeJob.lastBatch.note}</div>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-sm font-extrabold">Upload Summary</div>
                    <div className="text-sm text-slate-600 mt-2 leading-6">
                      Matched Products: <b>{summary?.matchedProducts ?? 0}</b>
                      <br />
                      Conflict Mode:{" "}
                      <b>
                        {safeText(
                          summary?.conflictMode || activeJob?.config?.conflictMode || "-"
                        )}
                      </b>
                      <br />
                      Source ZIP:{" "}
                      <b className="break-all">
                        {safeText(
                          summary?.originalFileName ||
                            activeJob?.config?.originalFileName ||
                            "-"
                        )}
                      </b>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-sm font-extrabold">Result</div>
                    <div className="text-sm text-slate-600 mt-2 leading-6">
                      Message: <b>{safeText(activeJob?.resultMessage || "-")}</b>
                      <br />
                      Failures Logged: <b>{Number(activeJob?.failuresCount || 0)}</b>
                    </div>
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

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-6 items-start">
            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-sm font-extrabold">Upload Official Papers ZIP</div>

                <label
                  htmlFor="official-paper-upload-input"
                  className={`mt-3 flex min-h-[120px] w-full cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50 px-4 py-6 text-center transition ${
                    showTrash || isJobActive ? "pointer-events-none opacity-60" : "hover:bg-sky-100"
                  }`}
                >
                  <div>
                    <div className="mx-auto h-12 w-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center">
                      <Upload size={20} />
                    </div>
                    <div className="mt-3 text-sm font-extrabold text-sky-800">
                      Click here to select ZIP
                    </div>
                    <div className="mt-1 text-xs text-sky-700">
                      ZIP ke andar PDF filenames ideally same SKU honi chahiye
                    </div>
                  </div>
                </label>

                <input
                  id="official-paper-upload-input"
                  type="file"
                  accept=".zip,application/zip"
                  onChange={(e) => {
                    const selected = e.target.files?.[0] || null;
                    setZipFile(selected);
                  }}
                  className="hidden"
                  disabled={showTrash || isJobActive}
                />

                <select
                  value={conflictMode}
                  onChange={(e) => setConflictMode(e.target.value as "ignore" | "replace")}
                  className="w-full mt-3 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  disabled={showTrash || isJobActive}
                >
                  <option value="ignore">Duplicate mode: Ignore new</option>
                  <option value="replace">Duplicate mode: Replace old</option>
                </select>

                <select
                  value={String(batchSize)}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="w-full mt-3 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  disabled={showTrash || isJobActive}
                >
                  <option value="25">25 files / batch</option>
                  <option value="50">50 files / batch</option>
                  <option value="100">100 files / batch</option>
                  <option value="200">200 files / batch</option>
                  <option value="300">300 files / batch</option>
                  <option value="500">500 files / batch</option>
                </select>

                <div className="mt-3 text-xs text-slate-500 leading-5">
                  Selected ZIP: <b>{zipFile?.name || "No ZIP selected"}</b>
                  <br />
                  Solved PDF already hone par official paper upload auto-ignore ho jayegi.
                </div>

                <button
                  type="button"
                  onClick={createJob}
                  disabled={creatingJob || showTrash || isJobActive}
                  className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-950 text-white transition font-extrabold disabled:opacity-60 shadow-sm"
                >
                  <Upload size={18} />
                  {creatingJob ? "Starting..." : "Start ZIP Upload Job"}
                </button>

                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                  Recommended ZIP structure:
                  <br />
                  <b>BHIC131ENG202526.pdf</b>
                  <br />
                  <b>BEGC101ENG202526.pdf</b>
                  <br />
                  Nested folders bhi allowed hain, lekin final filename SKU-based hona chahiye.
                </div>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900 leading-6">
                <b>Job-based flow:</b> ZIP upload → job create → batch processing → progress tracking → failed CSV download.
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Filter size={16} className="text-slate-700" />
                  <div className="text-sm font-extrabold">Filters</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                  <div className="relative xl:col-span-2">
                    <Search
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                      className="w-full pl-11 pr-10 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-sky-500 transition"
                      placeholder="Search by SKU / file / product"
                    />
                    {search ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          setPage(1);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      >
                        <X size={18} />
                      </button>
                    ) : null}
                  </div>

                  <select
                    value={categoryFilter}
                    onChange={(e) => {
                      setCategoryFilter(e.target.value);
                      setPage(1);
                    }}
                    className="px-3 py-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold outline-none"
                  >
                    {CATEGORY_OPTIONS.map((item) => (
                      <option key={item || "all"} value={item}>
                        {item || "All Categories"}
                      </option>
                    ))}
                  </select>

                  <input
                    value={subjectCodeFilter}
                    onChange={(e) => {
                      setSubjectCodeFilter(e.target.value);
                      setPage(1);
                    }}
                    className="px-3 py-3 rounded-xl border border-slate-200 bg-white text-sm outline-none"
                    placeholder="Subject Code"
                  />

                  <input
                    value={courseCodeFilter}
                    onChange={(e) => {
                      setCourseCodeFilter(e.target.value);
                      setPage(1);
                    }}
                    className="px-3 py-3 rounded-xl border border-slate-200 bg-white text-sm outline-none"
                    placeholder="Course Code"
                  />

                  <select
                    value={languageFilter}
                    onChange={(e) => {
                      setLanguageFilter(e.target.value);
                      setPage(1);
                    }}
                    className="px-3 py-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold outline-none"
                  >
                    {LANGUAGE_OPTIONS.map((item) => (
                      <option key={item || "all"} value={item}>
                        {item || "All Mediums"}
                      </option>
                    ))}
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value);
                      setPage(1);
                    }}
                    className="px-3 py-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold outline-none"
                  >
                    <option value="uploadedAt">By Uploaded Date</option>
                    <option value="name">By Name</option>
                    <option value="productExists">By Product Exists</option>
                    <option value="updatedAt">By Updated Date</option>
                    <option value="pageCount">By Page Count</option>
                  </select>

                  <select
                    value={sortDir}
                    onChange={(e) => {
                      setSortDir(e.target.value as "asc" | "desc");
                      setPage(1);
                    }}
                    className="px-3 py-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold outline-none"
                  >
                    <option value="desc">Desc</option>
                    <option value="asc">Asc</option>
                  </select>

                  <select
                    value={String(pageSize)}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="px-3 py-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold outline-none"
                  >
                    <option value="25">25 / page</option>
                    <option value="50">50 / page</option>
                    <option value="100">100 / page</option>
                    <option value="200">200 / page</option>
                  </select>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm min-w-0">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">
                      {showTrash ? "Trashed Official Papers" : "Official Paper Files"}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Green = product exists, Red = product not found
                    </div>
                  </div>

                  <div className="text-xs font-bold text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-200">
                    Total: {serverTotal}
                  </div>
                </div>

                {filesLoading ? (
                  <div className="p-6 text-slate-600 font-bold">Loading files...</div>
                ) : files.length === 0 ? (
                  <div className="p-6 text-slate-600 font-bold">
                    {showTrash ? "No trashed official papers found." : "No official papers found."}
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col">
                      {files.map((file) => {
                        const isGreen =
                          file.productExists &&
                          String(file.titleColor).toLowerCase() === "green";
                        const isBusy = actionLoadingId === file._id;

                        return (
                          <div
                            key={file._id}
                            className="px-4 py-4 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                <div
                                  className={
                                    showTrash
                                      ? "h-11 w-11 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0"
                                      : isGreen
                                      ? "h-11 w-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0"
                                      : "h-11 w-11 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center shrink-0"
                                  }
                                >
                                  <FileText size={20} />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div
                                    className={
                                      showTrash
                                        ? "font-extrabold text-rose-700 break-words whitespace-normal"
                                        : isGreen
                                        ? "font-extrabold text-emerald-700 break-words whitespace-normal"
                                        : "font-extrabold text-red-700 break-words whitespace-normal"
                                    }
                                    style={{
                                      wordBreak: "break-word",
                                      overflowWrap: "anywhere",
                                    }}
                                  >
                                    {file.fileName}
                                  </div>

                                  <div className="text-xs text-slate-500 mt-1 break-all">
                                    SKU: <b>{file.skuNormalized || "-"}</b>
                                  </div>

                                  {!showTrash ? (
                                    <>
                                      <div className="text-xs text-slate-500 mt-1 break-words">
                                        Product:{" "}
                                        {file.productExists ? (
                                          <span className="font-bold text-emerald-700">
                                            Exists {file.productSku ? `(${file.productSku})` : ""}
                                          </span>
                                        ) : (
                                          <span className="font-bold text-red-700">Not found</span>
                                        )}
                                      </div>

                                      <div className="text-xs text-slate-500 mt-1 break-words">
                                        Category: <b>{file.productCategory || "-"}</b> | Subject:{" "}
                                        <b>{file.productSubjectCode || "-"}</b> | Medium:{" "}
                                        <b>{file.productLanguage || "-"}</b>
                                      </div>

                                      <div className="text-xs text-slate-500 mt-1 break-words">
                                        Course:{" "}
                                        <b>{(file.productCourseCodes || []).join(", ") || "-"}</b>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="text-xs text-rose-600 mt-1 break-words font-semibold">
                                      Trashed: {formatDate(file.deletedAt)}
                                    </div>
                                  )}

                                  <div className="flex items-center gap-2 flex-wrap mt-1 text-xs text-slate-500">
                                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 border border-slate-200 bg-slate-50">
                                      <Clock3 size={12} />
                                      {formatDate(file.uploadedAt)}
                                    </span>

                                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 border border-slate-200 bg-slate-50">
                                      <Boxes size={12} />
                                      {formatBytes(Number(file.sizeBytes || 0))}
                                    </span>

                                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 border border-slate-200 bg-slate-50">
                                      <BadgeCheck size={12} />
                                      {Number(file.pageCount || 0)} pages
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 flex-wrap mt-3">
                                    {!showTrash ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => openPdf(file)}
                                          disabled={isBusy}
                                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-sm font-bold shadow-sm disabled:opacity-60"
                                        >
                                          <ExternalLink size={15} />
                                          Open
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => downloadPdf(file)}
                                          disabled={isBusy}
                                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-sm font-bold shadow-sm disabled:opacity-60"
                                        >
                                          <Download size={15} />
                                          Download
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => syncPages(file)}
                                          disabled={isBusy}
                                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 text-sm font-bold shadow-sm disabled:opacity-60"
                                        >
                                          <RefreshCcw size={15} />
                                          Sync Pages
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => editSkuMeta(file)}
                                          disabled={isBusy}
                                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-sm font-bold shadow-sm disabled:opacity-60"
                                        >
                                          <Pencil size={15} />
                                          Edit SKU
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => moveToTrash(file)}
                                          disabled={isBusy}
                                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-sm font-bold shadow-sm disabled:opacity-60"
                                        >
                                          <Trash2 size={15} />
                                          Delete
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => restoreFile(file)}
                                          disabled={isBusy}
                                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-sm font-bold shadow-sm disabled:opacity-60"
                                        >
                                          <RotateCcw size={15} />
                                          Restore
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => purgeFile(file)}
                                          disabled={isBusy}
                                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-sm font-bold shadow-sm disabled:opacity-60"
                                        >
                                          <XCircle size={15} />
                                          Delete Permanently
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="px-4 py-4 border-t border-gray-200 bg-white">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="text-sm text-slate-600 font-semibold">
                          Showing <b>{fromItem}</b> to <b>{toItem}</b> of <b>{serverTotal}</b> results
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-gray-50 text-sm font-bold disabled:opacity-50"
                          >
                            Previous
                          </button>

                          {Array.from({ length: serverTotalPages }, (_, i) => i + 1)
                            .filter((p) => {
                              if (serverTotalPages <= 7) return true;
                              if (p === 1 || p === serverTotalPages) return true;
                              return Math.abs(p - page) <= 1;
                            })
                            .map((p, idx, arr) => {
                              const prev = arr[idx - 1];
                              const showGap = idx > 0 && prev && p - prev > 1;

                              return (
                                <div key={`page-wrap-${p}`} className="flex items-center gap-2">
                                  {showGap ? <span className="text-slate-400 px-1">...</span> : null}
                                  <button
                                    type="button"
                                    onClick={() => setPage(p)}
                                    className={`min-w-[42px] px-3 py-2 rounded-xl text-sm font-bold border ${
                                      p === page
                                        ? "bg-slate-900 text-white border-slate-900"
                                        : "bg-white hover:bg-gray-50 border-slate-200 text-slate-700"
                                    }`}
                                  >
                                    {p}
                                  </button>
                                </div>
                              );
                            })}

                          <button
                            type="button"
                            onClick={() => setPage((p) => Math.min(serverTotalPages, p + 1))}
                            disabled={page >= serverTotalPages}
                            className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-gray-50 text-sm font-bold disabled:opacity-50"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {activeJob ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center gap-2 text-lg font-extrabold">
                    <BarChart3 size={20} />
                    Recent Failed / Skipped Files
                  </div>

                  <div className="mt-1 text-sm text-slate-500">
                    Table me recent 100 failed/skipped files dikh rahe hain. Full list ke liye CSV download karo.
                  </div>

                  <div className="mt-5 overflow-auto">
                    <table className="min-w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2 border-b">Batch</th>
                          <th className="text-left px-3 py-2 border-b">Row</th>
                          <th className="text-left px-3 py-2 border-b">SKU</th>
                          <th className="text-left px-3 py-2 border-b">File</th>
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
                            <td className="px-3 py-2">{item.fileName || item.identifier || "—"}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${
                                  safeText(item.status) === "skipped"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                {safeText(item.status) || "failed"}
                              </span>
                            </td>
                            <td className="px-3 py-2 min-w-[320px] text-slate-700">{item.reason || "—"}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(item.createdAt)}</td>
                          </tr>
                        ))}

                        {recentFailures.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                              No failed/skipped files recorded yet.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 leading-6">
                <b>Current status:</b> Ab page job complete / failed / cancelled hote hi stats aur file list automatically refresh kar dega.
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}