"use client";

import { useEffect, useMemo, useState } from "react";
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

type UploadRow = {
  ok?: boolean;
  fileName?: string;
  action?: string;
  reason?: string;
  skuNormalized?: string;
  productMatched?: boolean;
  productSku?: string;
  availabilityAfter?: string;
};

type UploadResponse = {
  ok?: boolean;
  summary?: {
    total?: number;
    uploaded?: number;
    replaced?: number;
    ignored?: number;
    failed?: number;
    skipped?: number;
    matchedProducts?: number;
  };
  results?: UploadRow[];
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

  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [conflictMode, setConflictMode] = useState<"ignore" | "replace">("ignore");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);

  const [actionLoadingId, setActionLoadingId] = useState("");

  const totalPages = useMemo(() => {
    const total = Math.ceil(files.length / pageSize);
    return total > 0 ? total : 1;
  }, [files.length, pageSize]);

  const pagedFiles = useMemo(() => {
    const start = (page - 1) * pageSize;
    return files.slice(start, start + pageSize);
  }, [files, page, pageSize]);

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
        onlyUnsolvedWithoutSolvedCount: Number(data?.stats?.onlyUnsolvedWithoutSolvedCount || 0),
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
      if (subjectCodeFilter.trim()) qs.set("subjectCode", subjectCodeFilter.trim().toUpperCase());
      if (languageFilter) qs.set("language", languageFilter);
      qs.set("sortBy", sortBy);
      qs.set("sortDir", sortDir);

      const res = await fetch(`/api/admin/official-papers/files?${qs.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });

      const data: FileListResponse = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as any)?.error || "Failed to load official papers");
        setFiles([]);
        return;
      }

      setFiles(Array.isArray(data?.files) ? data.files : []);
      setPage(1);
    } finally {
      setFilesLoading(false);
    }
  }

  async function refreshAll() {
    await Promise.all([loadFiles(), loadStats()]);
  }

  async function handleUpload() {
    if (!uploadFiles.length) {
      alert("Pehle PDF files select karo.");
      return;
    }

    if (showTrash) {
      alert("Trash view me upload allowed nahi hai.");
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const form = new FormData();
      form.append("conflictMode", conflictMode);
      for (const file of uploadFiles) {
        form.append("files", file);
      }

      const res = await fetch("/api/admin/official-papers/upload", {
        method: "POST",
        credentials: "include",
        body: form,
      });

      const data: UploadResponse = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        alert((data as any)?.error || "Upload failed");
        return;
      }

      setUploadResult(data);
      setUploadFiles([]);
      const input = document.getElementById("official-paper-upload-input") as HTMLInputElement | null;
      if (input) input.value = "";

      await refreshAll();
    } finally {
      setUploading(false);
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
      const res = await fetch(`/api/admin/official-papers/files?fileId=${encodeURIComponent(file._id)}`, {
        method: "DELETE",
        credentials: "include",
      });

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
    const ok = window.confirm(`"${file.fileName}" permanently delete karna hai? Ye recover nahi hoga.`);
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
        body: JSON.stringify({ action: "update-meta", fileId: file._id, skuNormalized: nextSku }),
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
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortDir, showTrash]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadFiles();
    }, 250);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter, courseCodeFilter, subjectCodeFilter, languageFilter]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

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
                SKU filename ke basis par official / unsolved papers upload karo. Availability auto-update hogi.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowTrash((p) => !p)}
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

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-6 items-start">
            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-sm font-extrabold">Upload Official Papers</div>

                <label
                  htmlFor="official-paper-upload-input"
                  className={`mt-3 flex min-h-[120px] w-full cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50 px-4 py-6 text-center transition ${
                    showTrash ? "pointer-events-none opacity-60" : "hover:bg-sky-100"
                  }`}
                >
                  <div>
                    <div className="mx-auto h-12 w-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center">
                      <Upload size={20} />
                    </div>
                    <div className="mt-3 text-sm font-extrabold text-sky-800">
                      Click here to select PDFs
                    </div>
                    <div className="mt-1 text-xs text-sky-700">
                      Filename ideally same SKU par hona chahiye
                    </div>
                  </div>
                </label>

                <input
                  id="official-paper-upload-input"
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  onChange={(e) => {
                    const list = Array.from(e.target.files || []);
                    setUploadFiles(list);
                  }}
                  className="hidden"
                  disabled={showTrash}
                />

                <select
                  value={conflictMode}
                  onChange={(e) => setConflictMode(e.target.value as "ignore" | "replace")}
                  className="w-full mt-3 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  disabled={showTrash}
                >
                  <option value="ignore">Duplicate mode: Ignore new</option>
                  <option value="replace">Duplicate mode: Replace old</option>
                </select>

                <div className="mt-3 text-xs text-slate-500 leading-5">
                  Selected PDFs: <b>{uploadFiles.length}</b>
                  <br />
                  Solved PDF already hone par official paper upload auto-ignore ho jayegi.
                </div>

                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading || showTrash}
                  className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-950 text-white transition font-extrabold disabled:opacity-60 shadow-sm"
                >
                  <Upload size={18} />
                  {uploading ? "Uploading..." : "Upload PDFs"}
                </button>
              </div>

              {uploadResult && !showTrash ? (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                  <div className="text-sm font-extrabold text-indigo-900">Last Upload Result</div>
                  <div className="text-xs text-indigo-800 mt-2 leading-6">
                    Total: <b>{Number(uploadResult.summary?.total || 0)}</b> | Uploaded:{" "}
                    <b>{Number(uploadResult.summary?.uploaded || 0)}</b> | Replaced:{" "}
                    <b>{Number(uploadResult.summary?.replaced || 0)}</b> | Ignored:{" "}
                    <b>{Number(uploadResult.summary?.ignored || 0)}</b> | Failed:{" "}
                    <b>{Number(uploadResult.summary?.failed || 0)}</b> | Product matched:{" "}
                    <b>{Number(uploadResult.summary?.matchedProducts || 0)}</b>
                  </div>

                  {Array.isArray(uploadResult.results) && uploadResult.results.length ? (
                    <div className="mt-3 space-y-2 max-h-[340px] overflow-auto pr-1">
                      {uploadResult.results.map((row, idx) => (
                        <div
                          key={`${row.fileName || "row"}-${idx}`}
                          className="rounded-xl border border-indigo-100 bg-white px-3 py-2 text-xs"
                        >
                          <div className="font-bold text-slate-800 break-all">{row.fileName || "-"}</div>
                          <div className="mt-1 text-slate-600">
                            Action: <b>{row.action || "-"}</b>
                            {row.skuNormalized ? (
                              <>
                                {" "}
                                | SKU: <b>{row.skuNormalized}</b>
                              </>
                            ) : null}
                            {row.productMatched ? (
                              <>
                                {" "}
                                | Product: <b>{row.productSku || "matched"}</b>
                              </>
                            ) : null}
                            {row.availabilityAfter ? (
                              <>
                                {" "}
                                | Availability: <b>{row.availabilityAfter}</b>
                              </>
                            ) : null}
                            {row.reason ? (
                              <>
                                {" "}
                                | Reason: <b>{row.reason}</b>
                              </>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="min-w-0 space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Filter size={16} className="text-slate-700" />
                  <div className="text-sm font-extrabold">Filters</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                  <div className="relative xl:col-span-2">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-11 pr-10 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-sky-500 transition"
                      placeholder="Search by SKU / file / product"
                    />
                    {search ? (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      >
                        <X size={18} />
                      </button>
                    ) : null}
                  </div>

                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
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
                    onChange={(e) => setSubjectCodeFilter(e.target.value)}
                    className="px-3 py-3 rounded-xl border border-slate-200 bg-white text-sm outline-none"
                    placeholder="Subject Code"
                  />

                  <input
                    value={courseCodeFilter}
                    onChange={(e) => setCourseCodeFilter(e.target.value)}
                    className="px-3 py-3 rounded-xl border border-slate-200 bg-white text-sm outline-none"
                    placeholder="Course Code"
                  />

                  <select
                    value={languageFilter}
                    onChange={(e) => setLanguageFilter(e.target.value)}
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
                    onChange={(e) => setSortBy(e.target.value)}
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
                    onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
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
                    Total: {files.length}
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
                      {pagedFiles.map((file) => {
                        const isGreen = file.productExists && String(file.titleColor).toLowerCase() === "green";
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
                                        Course: <b>{(file.productCourseCodes || []).join(", ") || "-"}</b>
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
                          Showing <b>{files.length ? (page - 1) * pageSize + 1 : 0}</b> to{" "}
                          <b>{Math.min(page * pageSize, files.length)}</b> of <b>{files.length}</b> results
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

                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter((p) => {
                              if (totalPages <= 7) return true;
                              if (p === 1 || p === totalPages) return true;
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
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
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

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 leading-6">
                <b>Current status:</b> Ab page me category, course, subject code, medium filters; last upload date; only unsolved count; unmatched SKU count; aur basic metadata edit (SKU relink) add ho gaya hai.
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}