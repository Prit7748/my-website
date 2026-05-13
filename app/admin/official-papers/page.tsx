"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  LoaderCircle,
  Database,
  Files,
  HardDriveUpload,
  ShieldCheck,
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
  error?: string;
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

type DirectUploadSingleResult = {
  fileName: string;
  skuNormalized?: string;
  fileId?: string;
  status: "uploaded" | "replaced" | "skipped" | "failed";
  reason?: string;
};

type DirectUploadResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  summary?: {
    totalFiles?: number;
    uploadedFiles?: number;
    replacedFiles?: number;
    doneFiles?: number;
    skippedFiles?: number;
    failedFiles?: number;
    conflictMode?: string;
    mode?: string;
  };
  results?: DirectUploadSingleResult[];
};

type AllPagesSyncMode = "zero" | "all";

const DIRECT_UPLOAD_CONCURRENCY = 4;
const DIRECT_UPLOAD_MAX_RETRIES = 3;
const DIRECT_UPLOAD_TIMEOUT_MS = 120000;
const RETRY_BASE_DELAY_MS = 1200;

const ALL_PAGES_SYNC_CONCURRENCY = 3;
const ALL_PAGES_SYNC_PAGE_SIZE = 200;

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

function safeText(x: any) {
  return String(x ?? "").trim();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  const [conflictMode, setConflictMode] = useState<"ignore" | "replace">("ignore");
  const [selectedPdfFiles, setSelectedPdfFiles] = useState<File[]>([]);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadSessionActive, setUploadSessionActive] = useState(false);
  const [uploadSessionTotal, setUploadSessionTotal] = useState(0);
  const [uploadSessionDone, setUploadSessionDone] = useState(0);

  const [isSyncChoiceOpen, setIsSyncChoiceOpen] = useState(false);
  const [isSyncingAllPages, setIsSyncingAllPages] = useState(false);
  const [allPagesSyncMode, setAllPagesSyncMode] = useState<AllPagesSyncMode | "">("");
  const [allPagesSyncStage, setAllPagesSyncStage] = useState("");
  const [allPagesSyncScanned, setAllPagesSyncScanned] = useState(0);
  const [allPagesSyncTotal, setAllPagesSyncTotal] = useState(0);
  const [allPagesSyncDone, setAllPagesSyncDone] = useState(0);
  const [allPagesSyncSuccess, setAllPagesSyncSuccess] = useState(0);
  const [allPagesSyncFailed, setAllPagesSyncFailed] = useState(0);
  const [allPagesSyncCurrentFile, setAllPagesSyncCurrentFile] = useState("");

  const [actionLoadingId, setActionLoadingId] = useState("");

  const longTaskActiveRef = useRef(false);

  const selectedPdfTotalBytes = useMemo(
    () => selectedPdfFiles.reduce((sum, file) => sum + Number(file.size || 0), 0),
    [selectedPdfFiles]
  );

  const uploadProgressPercent = useMemo(() => {
    if (!uploadSessionTotal) return 0;
    return Math.min(100, Math.round((uploadSessionDone / uploadSessionTotal) * 100));
  }, [uploadSessionDone, uploadSessionTotal]);

  const allPagesSyncProgressPercent = useMemo(() => {
    if (!allPagesSyncTotal) return 0;
    return Math.min(100, Math.round((allPagesSyncDone / allPagesSyncTotal) * 100));
  }, [allPagesSyncDone, allPagesSyncTotal]);

  function resetMessages() {
    setServerMessage("");
    setServerMessageType("info");
  }

  function resetUploadProgress() {
    setUploadSessionActive(false);
    setUploadSessionTotal(0);
    setUploadSessionDone(0);
  }

  function resetAllPagesSyncProgress() {
    setAllPagesSyncMode("");
    setAllPagesSyncStage("");
    setAllPagesSyncScanned(0);
    setAllPagesSyncTotal(0);
    setAllPagesSyncDone(0);
    setAllPagesSyncSuccess(0);
    setAllPagesSyncFailed(0);
    setAllPagesSyncCurrentFile("");
  }

  function resetSelectedFiles() {
    setSelectedPdfFiles([]);
    const input = document.getElementById(
      "official-paper-direct-input"
    ) as HTMLInputElement | null;
    if (input) input.value = "";
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

  function normalizeSelectedPdfFiles(fileList: FileList | File[] | null | undefined) {
    const arr = Array.from(fileList || []);
    const onlyPdf = arr.filter((file) => {
      const name = safeText(file?.name).toLowerCase();
      return name.endsWith(".pdf");
    });

    const uniqueMap = new Map<string, File>();
    for (const file of onlyPdf) {
      const key = `${file.name}__${file.size}__${file.lastModified}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, file);
      }
    }

    return Array.from(uniqueMap.values());
  }

  async function uploadSinglePdfRequest(file: File) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DIRECT_UPLOAD_TIMEOUT_MS);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("conflictMode", conflictMode);

      const res = await fetch("/api/admin/official-papers/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
        signal: controller.signal,
      });

      const data = (await safeReadJson(res)) as DirectUploadResponse;

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || data?.message || "Upload failed");
      }

      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async function uploadSinglePdfWithRetry(file: File) {
    let lastError = "";

    for (let attempt = 1; attempt <= DIRECT_UPLOAD_MAX_RETRIES; attempt++) {
      try {
        return await uploadSinglePdfRequest(file);
      } catch (error: any) {
        lastError = safeText(error?.message || "Upload failed");

        const lower = lastError.toLowerCase();
        const noRetry =
          lower.includes("not authenticated") ||
          lower.includes("forbidden") ||
          lower.includes("only pdf") ||
          lower.includes("file exceeds") ||
          lower.includes("empty pdf") ||
          lower.includes("sku could not be parsed");

        if (noRetry || attempt === DIRECT_UPLOAD_MAX_RETRIES) {
          throw new Error(lastError);
        }

        await sleep(RETRY_BASE_DELAY_MS * attempt);
      }
    }

    throw new Error(lastError || "Upload failed after retries");
  }

  async function startDirectUpload() {
    if (!selectedPdfFiles.length) {
      alert("Pehle PDF files select karo.");
      return;
    }

    if (showTrash) {
      alert("Trash view me upload allowed nahi hai.");
      return;
    }

    if (isSyncingAllPages) {
      alert("Pages sync process chal raha hai. Complete hone ke baad upload start karo.");
      return;
    }

    const usableFiles = normalizeSelectedPdfFiles(selectedPdfFiles);
    if (!usableFiles.length) {
      alert("Valid PDF files nahi mili.");
      return;
    }

    resetMessages();
    setIsUploading(true);
    setUploadSessionActive(true);
    setUploadSessionTotal(usableFiles.length);
    setUploadSessionDone(0);

    let uploadedFiles = 0;
    let replacedFiles = 0;
    let skippedFiles = 0;
    let failedFiles = 0;
    let nextIndex = 0;

    async function worker() {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;

        if (currentIndex >= usableFiles.length) return;

        const file = usableFiles[currentIndex];

        try {
          const data = await uploadSinglePdfWithRetry(file);
          const result = Array.isArray(data?.results) ? data.results[0] : null;
          const status = safeText(result?.status).toLowerCase();

          if (status === "uploaded") {
            uploadedFiles += 1;
            setUploadSessionDone((prev) => prev + 1);
          } else if (status === "replaced") {
            replacedFiles += 1;
            setUploadSessionDone((prev) => prev + 1);
          } else if (status === "skipped") {
            skippedFiles += 1;
          } else {
            failedFiles += 1;
          }
        } catch {
          failedFiles += 1;
        }
      }
    }

    try {
      const workerCount = Math.min(DIRECT_UPLOAD_CONCURRENCY, usableFiles.length);
      await Promise.all(Array.from({ length: workerCount }, () => worker()));

      const doneFiles = uploadedFiles + replacedFiles;

      if (doneFiles > 0 && failedFiles === 0 && skippedFiles === 0) {
        setServerMessage(`${doneFiles} PDFs successfully upload ho gayi.`);
        setServerMessageType("success");
      } else if (doneFiles > 0) {
        setServerMessage(
          `Upload complete. Done ${doneFiles}, Skipped ${skippedFiles}, Failed ${failedFiles}.`
        );
        setServerMessageType("info");
      } else {
        setServerMessage(
          `Koi bhi PDF successfully upload nahi ho paayi. Skipped ${skippedFiles}, Failed ${failedFiles}.`
        );
        setServerMessageType("error");
      }

      await refreshAll();
      resetSelectedFiles();
    } catch (error: any) {
      setServerMessage(safeText(error?.message || "Upload failed"));
      setServerMessageType("error");
    } finally {
      setIsUploading(false);
    }
  }

  async function fetchOfficialPapersForPageSync(mode: AllPagesSyncMode) {
    const allRows: OfficialPaperItem[] = [];
    let currentPage = 1;
    let totalPages = 1;

    while (currentPage <= totalPages) {
      setAllPagesSyncStage(`Files list scan ho rahi hai: page ${currentPage}/${totalPages}`);

      const qs = new URLSearchParams();
      qs.set("page", String(currentPage));
      qs.set("pageSize", String(ALL_PAGES_SYNC_PAGE_SIZE));
      qs.set("sortBy", mode === "zero" ? "pageCount" : "uploadedAt");
      qs.set("sortDir", mode === "zero" ? "asc" : "desc");

      const res = await fetch(`/api/admin/official-papers/files?${qs.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });

      const data = (await safeReadJson(res)) as FileListResponse;

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to load files for page sync");
      }

      const rows = Array.isArray(data?.files) ? data.files : [];
      setAllPagesSyncScanned((prev) => prev + rows.length);

      for (const row of rows) {
        if (!row?._id) continue;

        if (mode === "zero") {
          const pageCount = Number(row.pageCount || 0);
          if (pageCount <= 0) {
            allRows.push(row);
          }
        } else {
          allRows.push(row);
        }
      }

      totalPages = Math.max(1, Number(data?.totalPages || 1));
      currentPage += 1;
    }

    const uniqueMap = new Map<string, OfficialPaperItem>();
    for (const row of allRows) {
      if (row?._id && !uniqueMap.has(row._id)) {
        uniqueMap.set(row._id, row);
      }
    }

    return Array.from(uniqueMap.values());
  }

  async function syncSingleOfficialPaperPageCount(file: OfficialPaperItem) {
    const res = await fetch("/api/admin/official-papers/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "syncpages", fileId: file._id }),
    });

    const data = await safeReadJson(res);

    if (!res.ok || !(data as any)?.ok) {
      throw new Error((data as any)?.error || "Sync pages failed");
    }

    return data;
  }

  async function startSyncPages(mode: AllPagesSyncMode) {
    if (isUploading) {
      alert("Upload process chal raha hai. Complete hone ke baad page sync karo.");
      return;
    }

    if (isSyncingAllPages) return;

    setIsSyncChoiceOpen(false);
    resetMessages();
    resetAllPagesSyncProgress();

    setIsSyncingAllPages(true);
    setAllPagesSyncMode(mode);
    setAllPagesSyncStage("Preparing...");
    setServerMessage(
      mode === "zero"
        ? "0 page count wali files scan ho rahi hain..."
        : "Sabhi official paper files scan ho rahi hain..."
    );
    setServerMessageType("info");

    try {
      const targetFiles = await fetchOfficialPapersForPageSync(mode);

      if (!targetFiles.length) {
        setServerMessage(
          mode === "zero"
            ? "0 page count wali koi official paper file nahi mili. Sync ki zarurat nahi hai."
            : "Sync ke liye koi live official paper file nahi mili."
        );
        setServerMessageType("info");
        setAllPagesSyncStage("No files found");
        return;
      }

      setAllPagesSyncTotal(targetFiles.length);
      setAllPagesSyncDone(0);
      setAllPagesSyncSuccess(0);
      setAllPagesSyncFailed(0);
      setAllPagesSyncStage("Page count sync running...");

      let nextIndex = 0;
      let processedCount = 0;
      let successCount = 0;
      let failedCount = 0;

      async function worker() {
        while (true) {
          const currentIndex = nextIndex;
          nextIndex += 1;

          if (currentIndex >= targetFiles.length) return;

          const file = targetFiles[currentIndex];
          setAllPagesSyncCurrentFile(
            `${currentIndex + 1}/${targetFiles.length} - ${
              file.fileName || file.skuNormalized || "Processing..."
            }`
          );

          try {
            await syncSingleOfficialPaperPageCount(file);
            successCount += 1;
            setAllPagesSyncSuccess(successCount);
          } catch {
            failedCount += 1;
            setAllPagesSyncFailed(failedCount);
          } finally {
            processedCount += 1;
            setAllPagesSyncDone(processedCount);
          }
        }
      }

      const workerCount = Math.min(ALL_PAGES_SYNC_CONCURRENCY, targetFiles.length);
      await Promise.all(Array.from({ length: workerCount }, () => worker()));

      setAllPagesSyncStage("Completed");

      if (failedCount > 0) {
        setServerMessage(
          `Page sync complete. Mode: ${
            mode === "zero" ? "Only 0 page count" : "All files"
          }. Total ${targetFiles.length}, Success ${successCount}, Failed ${failedCount}.`
        );
        setServerMessageType("info");
      } else {
        setServerMessage(
          `Page sync successfully complete. Mode: ${
            mode === "zero" ? "Only 0 page count" : "All files"
          }. Total ${targetFiles.length} files synced.`
        );
        setServerMessageType("success");
      }

      await refreshAll();
    } catch (error: any) {
      setAllPagesSyncStage("Failed");
      setServerMessage(safeText(error?.message || "Page sync failed"));
      setServerMessageType("error");
    } finally {
      setIsSyncingAllPages(false);
      setAllPagesSyncCurrentFile("");
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
    const anyLongTaskRunning = isUploading || isSyncingAllPages;

    if (anyLongTaskRunning && !longTaskActiveRef.current) {
      notifyLongTaskStart();
      longTaskActiveRef.current = true;
    }

    if (!anyLongTaskRunning && longTaskActiveRef.current) {
      notifyLongTaskEnd();
      longTaskActiveRef.current = false;
    }
  }, [isUploading, isSyncingAllPages]);

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
      {isSyncChoiceOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-xl rounded-3xl bg-white border border-slate-200 shadow-2xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-extrabold text-indigo-800">
                  <RefreshCcw size={14} />
                  Page Count Sync
                </div>
                <h2 className="mt-3 text-xl font-extrabold text-slate-900">
                  Kaunsi files sync karni hain?
                </h2>
                <p className="mt-1 text-sm text-slate-600 leading-6">
                  90% cases me sirf 0 page count wali files sync karni hoti hain. Isliye pehla
                  option recommended hai.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsSyncChoiceOpen(false)}
                className="rounded-xl border border-slate-200 bg-white p-2 hover:bg-slate-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => void startSyncPages("zero")}
                className="text-left rounded-2xl border border-emerald-200 bg-emerald-50 p-4 hover:bg-emerald-100 transition"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <BadgeCheck size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-emerald-900">
                      Sync Only 0 Page Count Files
                    </div>
                    <div className="mt-1 text-xs leading-5 text-emerald-800">
                      Recommended. Sirf un official paper PDFs ka page count sync hoga jinka
                      current page count 0 hai.
                    </div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => void startSyncPages("all")}
                className="text-left rounded-2xl border border-indigo-200 bg-indigo-50 p-4 hover:bg-indigo-100 transition"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <RefreshCcw size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-indigo-900">
                      Sync All Official Paper Files
                    </div>
                    <div className="mt-1 text-xs leading-5 text-indigo-800">
                      Sabhi live official paper PDFs ka page count dobara sync hoga. Large data me
                      ye option zyada time le sakta hai.
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 border border-sky-200 px-3 py-1 text-xs font-extrabold text-sky-800">
                <FolderOpen size={14} />
                Official Papers Management
              </div>

              <h1 className="text-2xl font-extrabold mt-3">IGNOU Official Papers</h1>
              <p className="text-sm text-slate-600 mt-1">
                Ye page unsolved question papers ke liye hai. Upload ke baad page count sync ke liye
                recommended option: 0 page count files only.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsSyncChoiceOpen(true)}
                disabled={isUploading || isSyncingAllPages}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition font-semibold shadow-sm disabled:opacity-60"
              >
                {isSyncingAllPages ? (
                  <LoaderCircle size={18} className="animate-spin" />
                ) : (
                  <RefreshCcw size={18} />
                )}
                {isSyncingAllPages ? "Syncing Pages..." : "Sync Pages"}
              </button>

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
                disabled={isSyncingAllPages}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm disabled:opacity-60"
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
                  Total count ka meaning clear
                </div>
                <div className="text-sm text-blue-800 mt-2 leading-6">
                  Is page par jo total count dikh raha hai, woh current upload ka count nahi hai.
                  Ye database me present <b>live official paper files</b> ka total hai.
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

          {isUploading ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
              <div className="flex items-center gap-2">
                <LoaderCircle size={18} className="animate-spin" />
                Direct official papers upload chal raha hai.
              </div>
            </div>
          ) : null}

          {(isSyncingAllPages || allPagesSyncTotal > 0 || allPagesSyncScanned > 0) ? (
            <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-extrabold text-indigo-900">
                    Page Count Sync Progress
                  </div>
                  <div className="mt-1 text-xs text-indigo-800">
                    Mode:{" "}
                    <b>
                      {allPagesSyncMode === "zero"
                        ? "Only 0 page count files"
                        : allPagesSyncMode === "all"
                        ? "All official paper files"
                        : "-"}
                    </b>
                  </div>
                </div>

                {isSyncingAllPages ? (
                  <div className="inline-flex items-center gap-2 rounded-full bg-white border border-indigo-200 px-3 py-2 text-xs font-extrabold text-indigo-800">
                    <LoaderCircle size={14} className="animate-spin" />
                    Running
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 rounded-full bg-white border border-indigo-200 px-3 py-2 text-xs font-extrabold text-indigo-800">
                    <CheckCircle2 size={14} />
                    Ready
                  </div>
                )}
              </div>

              <div className="mt-3 h-4 w-full overflow-hidden rounded-full bg-indigo-100">
                <div
                  className="h-full rounded-full bg-indigo-700 transition-all"
                  style={{ width: `${allPagesSyncProgressPercent}%` }}
                />
              </div>

              <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                <div className="rounded-xl bg-white border border-indigo-100 p-3">
                  <div className="text-indigo-700 font-bold">Scanned</div>
                  <div className="mt-1 text-slate-900 font-extrabold">
                    {allPagesSyncScanned}
                  </div>
                </div>

                <div className="rounded-xl bg-white border border-indigo-100 p-3">
                  <div className="text-indigo-700 font-bold">Target</div>
                  <div className="mt-1 text-slate-900 font-extrabold">
                    {allPagesSyncTotal}
                  </div>
                </div>

                <div className="rounded-xl bg-white border border-indigo-100 p-3">
                  <div className="text-indigo-700 font-bold">Processed</div>
                  <div className="mt-1 text-slate-900 font-extrabold">
                    {allPagesSyncDone}
                  </div>
                </div>

                <div className="rounded-xl bg-white border border-emerald-100 p-3">
                  <div className="text-emerald-700 font-bold">Success</div>
                  <div className="mt-1 text-slate-900 font-extrabold">
                    {allPagesSyncSuccess}
                  </div>
                </div>

                <div className="rounded-xl bg-white border border-rose-100 p-3">
                  <div className="text-rose-700 font-bold">Failed</div>
                  <div className="mt-1 text-slate-900 font-extrabold">
                    {allPagesSyncFailed}
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs text-indigo-900 leading-6">
                Stage: <b>{allPagesSyncStage || "-"}</b>
                <br />
                Current file: <b className="break-all">{allPagesSyncCurrentFile || "-"}</b>
              </div>
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-6 items-start">
            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <HardDriveUpload size={18} className="text-sky-700" />
                  <div className="text-sm font-extrabold">Official Papers PDF Upload</div>
                </div>

                <label
                  htmlFor="official-paper-direct-input"
                  className={`mt-3 flex min-h-[140px] w-full cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50 px-4 py-6 text-center transition ${
                    showTrash || isUploading || isSyncingAllPages
                      ? "pointer-events-none opacity-60"
                      : "hover:bg-sky-100"
                  }`}
                >
                  <div>
                    <div className="mx-auto h-12 w-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center">
                      <Files size={20} />
                    </div>
                    <div className="mt-3 text-sm font-extrabold text-sky-800">
                      Click here to select multiple PDFs
                    </div>
                    <div className="mt-1 text-xs text-sky-700">
                      Simple direct upload system active hai
                    </div>
                  </div>
                </label>

                <input
                  id="official-paper-direct-input"
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  onChange={(e) => {
                    const list = normalizeSelectedPdfFiles(e.target.files);
                    setSelectedPdfFiles(list);
                    resetUploadProgress();
                    resetMessages();
                  }}
                  className="hidden"
                  disabled={showTrash || isUploading || isSyncingAllPages}
                />

                <select
                  value={conflictMode}
                  onChange={(e) => setConflictMode(e.target.value as "ignore" | "replace")}
                  className="w-full mt-3 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  disabled={showTrash || isUploading || isSyncingAllPages}
                >
                  <option value="ignore">Duplicate mode: Ignore new</option>
                  <option value="replace">Duplicate mode: Replace old</option>
                </select>

                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-700">
                  Selected PDFs: <b>{selectedPdfFiles.length}</b>
                  <br />
                  Total Size: <b>{formatBytes(selectedPdfTotalBytes)}</b>
                  <br />
                  Direct upload concurrency: <b>{DIRECT_UPLOAD_CONCURRENCY}</b>
                  <br />
                  Auto retry: <b>{DIRECT_UPLOAD_MAX_RETRIES} attempts / PDF</b>
                  <br />
                  Jo PDF successfully upload ho jayegi, woh turant final done mani jayegi.
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={startDirectUpload}
                    disabled={
                      showTrash ||
                      isUploading ||
                      isSyncingAllPages ||
                      !selectedPdfFiles.length
                    }
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-950 text-white transition font-extrabold disabled:opacity-60 shadow-sm"
                  >
                    <Upload size={18} />
                    {isUploading ? "Uploading..." : "Start Direct Upload"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      resetSelectedFiles();
                      resetUploadProgress();
                      resetMessages();
                    }}
                    disabled={isUploading || isSyncingAllPages}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-extrabold disabled:opacity-60 shadow-sm"
                  >
                    <X size={18} />
                    Clear
                  </button>
                </div>

                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
                  Recommended filename pattern:
                  <br />
                  <b>BHIC131ENG202526A.pdf</b>
                  <br />
                  <b>BEGC101ENG202526Q.pdf</b>
                </div>
              </div>

              {uploadSessionActive ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <div className="text-sm font-extrabold text-blue-900">
                    Upload Progress
                  </div>

                  <div className="mt-3 h-4 w-full overflow-hidden rounded-full bg-blue-100">
                    <div
                      className="h-full rounded-full bg-blue-700 transition-all"
                      style={{ width: `${uploadProgressPercent}%` }}
                    />
                  </div>

                  <div className="mt-3 text-sm text-blue-900 leading-7">
                    Total PDFs: <b>{uploadSessionTotal}</b>
                    <br />
                    Uploaded PDFs: <b>{uploadSessionDone}</b>
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 leading-6">
                <b>Best workflow:</b> PDFs upload karo → upload complete hone do → upar
                <b> Sync Pages</b> button click karo → pehle <b>Sync Only 0 Page Count Files</b>
                option use karo.
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900 leading-6">
                <div className="flex items-start gap-2">
                  <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <b>Important separation:</b> Ye page keval official unsolved question papers ke liye hai.
                    Actual product PDFs ka vault flow alag hi rahega aur usko is upload flow se mix nahi kiya gaya.
                  </div>
                </div>
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
                    {showTrash ? "Total Trashed Official Papers" : "Total Live Official Papers"}: {serverTotal}
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

                                    <span
                                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 border ${
                                        Number(file.pageCount || 0) <= 0
                                          ? "border-rose-200 bg-rose-50 text-rose-700"
                                          : "border-slate-200 bg-slate-50"
                                      }`}
                                    >
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
                                          disabled={isBusy || isSyncingAllPages}
                                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-sm font-bold shadow-sm disabled:opacity-60"
                                        >
                                          <ExternalLink size={15} />
                                          Open
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => downloadPdf(file)}
                                          disabled={isBusy || isSyncingAllPages}
                                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-sm font-bold shadow-sm disabled:opacity-60"
                                        >
                                          <Download size={15} />
                                          Download
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => syncPages(file)}
                                          disabled={isBusy || isSyncingAllPages}
                                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 text-sm font-bold shadow-sm disabled:opacity-60"
                                        >
                                          <RefreshCcw size={15} />
                                          Sync Pages
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => editSkuMeta(file)}
                                          disabled={isBusy || isSyncingAllPages}
                                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-sm font-bold shadow-sm disabled:opacity-60"
                                        >
                                          <Pencil size={15} />
                                          Edit SKU
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => moveToTrash(file)}
                                          disabled={isBusy || isSyncingAllPages}
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
                                          disabled={isBusy || isSyncingAllPages}
                                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-sm font-bold shadow-sm disabled:opacity-60"
                                        >
                                          <RotateCcw size={15} />
                                          Restore
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => purgeFile(file)}
                                          disabled={isBusy || isSyncingAllPages}
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

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 leading-6">
                <b>Current status:</b> Upload complete hone ke baad <b>Sync Pages</b> button se
                pehle <b>Only 0 Page Count Files</b> sync karo. Ye fast aur safe rahega.
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}