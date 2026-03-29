"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  FolderPlus,
  Folder,
  ShieldCheck,
  Search,
  RefreshCcw,
  LockKeyhole,
  FileText,
  Upload,
  Pencil,
  Trash2,
  RotateCcw,
  XCircle,
  Scissors,
  ClipboardPaste,
  ExternalLink,
  Download,
  FolderDown,
  X,
} from "lucide-react";

type BootstrapResponse = {
  ok?: boolean;
  hiddenPath?: string;
  accessGranted?: boolean;
  root?: { _id: string; name: string; path: string; level: number };
};

type FolderItem = {
  _id: string;
  name: string;
  slug: string;
  path: string;
  level: number;
  sortOrder: number;
  isLocked: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
};

type FolderListResponse = {
  ok?: boolean;
  parent?: { _id: string; name: string; path: string; level: number };
  breadcrumbs?: Array<{ name: string; path: string }>;
  folders?: FolderItem[];
  trash?: boolean;
};

type VaultFileItem = {
  _id: string;
  folderId: string;
  originalName: string;
  fileName: string;
  fileExt: string;
  baseName: string;
  skuNormalized: string;
  titleColor: "green" | "red" | string;
  productExists: boolean;
  productId?: string;
  productSku?: string;
  productSlug?: string;
  mimeType?: string;
  sizeBytes?: number;
  pageCount?: number;
  uploadedAt?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
};

type FileListResponse = { ok?: boolean; files?: VaultFileItem[]; total?: number };

type UploadRow = {
  ok?: boolean;
  fileName?: string;
  action?: string;
  reason?: string;
  skuNormalized?: string;
  productMatched?: boolean;
  productSku?: string;
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

export default function HiddenPdfVaultPage() {
  const [bootLoading, setBootLoading] = useState(true);
  const [accessGranted, setAccessGranted] = useState(false);

  const [puzzleA, setPuzzleA] = useState<number>(0);
  const [puzzleB, setPuzzleB] = useState<number>(0);
  const [puzzleAnswer, setPuzzleAnswer] = useState("");
  const [puzzleLoading, setPuzzleLoading] = useState(false);
  const [showBlankDenied, setShowBlankDenied] = useState(false);

  const [currentPath, setCurrentPath] = useState("root");
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ name: string; path: string }>>([]);
  const [folderLoading, setFolderLoading] = useState(false);

  const [files, setFiles] = useState<VaultFileItem[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);

  const [globalSearch, setGlobalSearch] = useState("");
  const [globalSuggestions, setGlobalSuggestions] = useState<VaultFileItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [folderSortBy, setFolderSortBy] = useState("name");
  const [folderSortDir, setFolderSortDir] = useState<"asc" | "desc">("asc");

  const [fileSortBy, setFileSortBy] = useState("uploadedAt");
  const [fileSortDir, setFileSortDir] = useState<"asc" | "desc">("desc");

  const [filePage, setFilePage] = useState(1);
  const [filePageSize, setFilePageSize] = useState(25);

  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [conflictMode, setConflictMode] = useState<"ignore" | "replace">("ignore");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);

  const [showTrash, setShowTrash] = useState(false);
  const [folderActionLoadingId, setFolderActionLoadingId] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState("");
  const [renameValue, setRenameValue] = useState("");

  const [cutFileId, setCutFileId] = useState("");
  const [cutFileName, setCutFileName] = useState("");
  const [fileActionLoadingId, setFileActionLoadingId] = useState("");

  const titlePath = useMemo(() => breadcrumbs.map((x) => x.name).join(" / "), [breadcrumbs]);
  const searchActive = globalSearch.trim().length > 0;

  const pagedFiles = useMemo(() => {
    const start = (filePage - 1) * filePageSize;
    return files.slice(start, start + filePageSize);
  }, [files, filePage, filePageSize]);

  const totalPages = useMemo(() => {
    const total = Math.ceil(files.length / filePageSize);
    return total > 0 ? total : 1;
  }, [files.length, filePageSize]);

  const startItem = files.length ? (filePage - 1) * filePageSize + 1 : 0;
  const endItem = Math.min(filePage * filePageSize, files.length);

  async function loadBootstrap() {
    setBootLoading(true);
    try {
      const res = await fetch("/api/admin/pdf-vault/bootstrap", { credentials: "include", cache: "no-store" });
      const data: BootstrapResponse = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAccessGranted(false);
        return;
      }

      setAccessGranted(Boolean(data?.accessGranted));
      setCurrentPath(data?.root?.path || "root");

      if (!data?.accessGranted) {
        const puzzleRes = await fetch("/api/admin/pdf-vault/puzzle", { credentials: "include", cache: "no-store" });
        const puzzleData = await puzzleRes.json().catch(() => ({}));
        if (puzzleRes.ok) {
          setPuzzleA(Number((puzzleData as any)?.puzzle?.a || 0));
          setPuzzleB(Number((puzzleData as any)?.puzzle?.b || 0));
        }
      }
    } finally {
      setBootLoading(false);
    }
  }

  async function loadFolders(path = currentPath) {
    setFolderLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("parentPath", path);
      qs.set("sortBy", folderSortBy);
      qs.set("sortDir", folderSortDir);
      if (showTrash) qs.set("trash", "1");

      const res = await fetch(`/api/admin/pdf-vault/folders?${qs.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });

      const data: FolderListResponse = await res.json().catch(() => ({}));
      if (!res.ok) {
        if ((data as any)?.needsPuzzle) {
          setAccessGranted(false);
          await loadBootstrap();
        }
        return;
      }

      setFolders(Array.isArray(data?.folders) ? data.folders : []);
      setBreadcrumbs(Array.isArray(data?.breadcrumbs) ? data.breadcrumbs : []);
    } finally {
      setFolderLoading(false);
    }
  }

  async function loadFiles(path = currentPath, q = globalSearch.trim()) {
    setFilesLoading(true);
    try {
      const qs = new URLSearchParams();

      if (showTrash) {
        qs.set("trash", "1");
        qs.set("parentPath", path);
      } else {
        qs.set("parentPath", q ? "root" : path);
        if (q) qs.set("q", q);
      }

      qs.set("sortBy", fileSortBy);
      qs.set("sortDir", fileSortDir);

      const res = await fetch(`/api/admin/pdf-vault/files?${qs.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });

      const data: FileListResponse = await res.json().catch(() => ({}));
      if (!res.ok) {
        if ((data as any)?.needsPuzzle) {
          setAccessGranted(false);
          await loadBootstrap();
        }
        return;
      }

      const nextFiles = Array.isArray(data?.files) ? data.files : [];
      setFiles(nextFiles);
      setFilePage(1);

      if (!showTrash && q) setGlobalSuggestions(nextFiles.slice(0, 8));
      else setGlobalSuggestions([]);
    } finally {
      setFilesLoading(false);
    }
  }

  async function solvePuzzle() {
    if (!puzzleAnswer.trim()) {
      alert("Answer fill karo.");
      return;
    }

    setPuzzleLoading(true);
    try {
      const res = await fetch("/api/admin/pdf-vault/puzzle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ answer: Number(puzzleAnswer) }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !(data as any)?.ok) {
        setShowBlankDenied(true);
        return;
      }

      setAccessGranted(true);
      setPuzzleAnswer("");
      await Promise.all([loadFolders("root"), loadFiles("root", "")]);
    } finally {
      setPuzzleLoading(false);
    }
  }

  async function createFolder() {
    if (!newFolderName.trim()) {
      alert("Folder name required hai.");
      return;
    }
    if (showTrash) {
      alert("Trash view me folder create nahi kar sakte.");
      return;
    }

    setCreatingFolder(true);
    try {
      const res = await fetch("/api/admin/pdf-vault/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ parentPath: currentPath, name: newFolderName.trim() }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as any)?.error || "Folder create failed");
        return;
      }

      setNewFolderName("");
      await loadFolders(currentPath);
    } finally {
      setCreatingFolder(false);
    }
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
    notifyLongTaskStart();

    try {
      const form = new FormData();
      form.append("parentPath", currentPath);
      form.append("conflictMode", conflictMode);
      for (const file of uploadFiles) form.append("files", file);

      const res = await fetch("/api/admin/pdf-vault/upload", {
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
      const input = document.getElementById("vault-upload-input") as HTMLInputElement | null;
      if (input) input.value = "";

      await Promise.all([loadFiles(currentPath, globalSearch.trim()), loadFolders(currentPath)]);
    } finally {
      notifyLongTaskEnd();
      setUploading(false);
    }
  }

  async function renameFolder(folder: FolderItem) {
    const nextName = renameValue.trim();
    if (!nextName) {
      alert("New folder name required hai.");
      return;
    }

    setFolderActionLoadingId(folder._id);
    try {
      const res = await fetch("/api/admin/pdf-vault/folders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ folderId: folder._id, name: nextName }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as any)?.error || "Rename failed");
        return;
      }

      if (currentPath === folder.path && (data as any)?.folder?.path) setCurrentPath(String((data as any).folder.path));

      setRenamingFolderId("");
      setRenameValue("");
      await loadFolders(currentPath);
    } finally {
      setFolderActionLoadingId("");
    }
  }

  async function moveFolderToTrash(folder: FolderItem) {
    const ok = window.confirm(`"${folder.name}" ko trash me bhejna hai?`);
    if (!ok) return;

    setFolderActionLoadingId(folder._id);
    try {
      const res = await fetch(`/api/admin/pdf-vault/folders?folderId=${encodeURIComponent(folder._id)}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as any)?.error || "Delete failed");
        return;
      }

      await loadFolders(currentPath);
    } finally {
      setFolderActionLoadingId("");
    }
  }

  async function restoreFolder(folder: FolderItem) {
    setFolderActionLoadingId(folder._id);
    try {
      const res = await fetch("/api/admin/pdf-vault/folders?action=restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ folderId: folder._id }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as any)?.error || "Restore failed");
        return;
      }

      await Promise.all([loadFolders(currentPath), loadFiles(currentPath, globalSearch.trim())]);
    } finally {
      setFolderActionLoadingId("");
    }
  }

  async function purgeFolder(folder: FolderItem) {
    const ok = window.confirm(`"${folder.name}" permanently delete karna hai? Ye recover nahi hoga.`);
    if (!ok) return;

    setFolderActionLoadingId(folder._id);
    try {
      const res = await fetch("/api/admin/pdf-vault/folders?action=purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ folderId: folder._id }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as any)?.error || "Purge failed");
        return;
      }

      await loadFolders(currentPath);
    } finally {
      setFolderActionLoadingId("");
    }
  }

  async function downloadCurrentFolderZip() {
    if (showTrash) {
      alert("Trash view me folder download allowed nahi hai.");
      return;
    }

    const password = window.prompt("Folder download password enter karo:");
    if (!password) return;

    setFolderActionLoadingId(`download:${currentPath}`);
    try {
      const res = await fetch("/api/admin/pdf-vault/folders?action=download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ folderPath: currentPath, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert((data as any)?.error || "Folder download failed");
        return;
      }

      const blob = await res.blob();
      const fileName = `${(breadcrumbs[breadcrumbs.length - 1]?.name || "folder").replace(/[^a-zA-Z0-9-_]/g, "-")}.zip`;

      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(objectUrl);
    } finally {
      setFolderActionLoadingId("");
    }
  }

  async function openPdf(file: VaultFileItem) {
    setFileActionLoadingId(file._id);
    try {
      const res = await fetch("/api/admin/pdf-vault/files", {
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
      setFileActionLoadingId("");
    }
  }

  async function downloadPdf(file: VaultFileItem) {
    const password = window.prompt("Download password enter karo:");
    if (!password) return;

    setFileActionLoadingId(file._id);
    try {
      const res = await fetch("/api/admin/pdf-vault/files", {
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
      setFileActionLoadingId("");
    }
  }

  async function moveFileToTrash(file: VaultFileItem) {
    const ok = window.confirm(`"${file.fileName}" ko trash me bhejna hai?`);
    if (!ok) return;

    setFileActionLoadingId(file._id);
    try {
      const res = await fetch(`/api/admin/pdf-vault/files?fileId=${encodeURIComponent(file._id)}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as any)?.error || "File delete failed");
        return;
      }

      if (cutFileId === file._id) {
        setCutFileId("");
        setCutFileName("");
      }

      await loadFiles(currentPath, globalSearch.trim());
    } finally {
      setFileActionLoadingId("");
    }
  }

  async function restoreFile(file: VaultFileItem) {
    setFileActionLoadingId(file._id);
    try {
      const res = await fetch("/api/admin/pdf-vault/files", {
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

      await loadFiles(currentPath, globalSearch.trim());
    } finally {
      setFileActionLoadingId("");
    }
  }

  async function purgeFile(file: VaultFileItem) {
    const ok = window.confirm(`"${file.fileName}" permanently delete karna hai? Ye recover nahi hoga.`);
    if (!ok) return;

    setFileActionLoadingId(file._id);
    try {
      const res = await fetch("/api/admin/pdf-vault/files", {
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

      await loadFiles(currentPath, globalSearch.trim());
    } finally {
      setFileActionLoadingId("");
    }
  }

  async function pasteCutFileHere() {
    if (!cutFileId) {
      alert("Pehle kisi file par Cut select karo.");
      return;
    }

    setFileActionLoadingId(cutFileId);
    try {
      const res = await fetch("/api/admin/pdf-vault/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "move", fileId: cutFileId, targetPath: currentPath }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as any)?.error || "Move failed");
        return;
      }

      setCutFileId("");
      setCutFileName("");
      await Promise.all([loadFiles(currentPath, globalSearch.trim()), loadFolders(currentPath)]);
      alert("File moved successfully.");
    } finally {
      setFileActionLoadingId("");
    }
  }

  async function refreshAll() {
    await Promise.all([loadFolders(currentPath), loadFiles(currentPath, globalSearch.trim())]);
  }

  useEffect(() => {
    loadBootstrap();
  }, []);

  useEffect(() => {
    if (!accessGranted) return;
    void Promise.all([loadFolders(currentPath), loadFiles(currentPath, globalSearch.trim())]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessGranted, currentPath, folderSortBy, folderSortDir, fileSortBy, fileSortDir, showTrash]);

  useEffect(() => {
    if (!accessGranted || showTrash) return;

    const t = setTimeout(() => {
      void loadFiles(currentPath, globalSearch.trim());
      setShowSuggestions(Boolean(globalSearch.trim()));
    }, 220);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalSearch]);

  useEffect(() => {
    setFilePage(1);
  }, [filePageSize]);

  if (showBlankDenied) return <main className="min-h-screen bg-white" />;

  if (bootLoading) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-slate-700 font-bold">
        Loading secure vault...
      </main>
    );
  }

  if (!accessGranted) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] text-slate-900">
        <div className="max-w-2xl mx-auto px-4 py-16">
          <div className="rounded-3xl bg-white border border-gray-200 p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
                <LockKeyhole size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold">Secure PDF Vault</h1>
                <p className="text-sm text-slate-600 mt-1">Access verify karne ke liye answer submit kijiye.</p>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-sm font-extrabold text-slate-900">Verification Puzzle</div>

              <div className="mt-5 text-2xl font-extrabold text-slate-900 tracking-wide">
                {puzzleA} + {puzzleB} = ?
              </div>

              <input
                value={puzzleAnswer}
                onChange={(e) => setPuzzleAnswer(e.target.value)}
                className="w-full mt-4 px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none focus:border-slate-500 transition font-bold"
                placeholder="Enter answer"
                inputMode="numeric"
              />

              <button
                type="button"
                onClick={solvePuzzle}
                disabled={puzzleLoading}
                className="w-full mt-4 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-950 text-white transition font-extrabold disabled:opacity-60"
              >
                <ShieldCheck size={18} />
                {puzzleLoading ? "Checking..." : "Open Vault"}
              </button>
            </div>

            <div className="mt-6">
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <ArrowLeft size={18} />
                Back to Admin
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-extrabold text-emerald-800">
                <ShieldCheck size={14} />
                Secure Vault Open
              </div>

              <h1 className="text-2xl font-extrabold mt-3">Bulk Product PDFs Vault</h1>
              <p className="text-sm text-slate-600 mt-1">
                Hidden secure area. Current path: <b>{titlePath || "root"}</b>
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {!showTrash && (
                <button
                  type="button"
                  onClick={downloadCurrentFolderZip}
                  disabled={folderActionLoadingId === `download:${currentPath}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm disabled:opacity-60"
                >
                  <FolderDown size={18} />
                  {folderActionLoadingId === `download:${currentPath}` ? "Preparing ZIP..." : "Download Folder"}
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowTrash((p) => !p)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border transition font-semibold shadow-sm ${showTrash
                    ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                    : "bg-white hover:bg-gray-50 border-gray-200"
                  }`}
              >
                <Trash2 size={18} />
                {showTrash ? "Trash View On" : "Open Trash"}
              </button>

              <Link
                href="/admin/products/bulk"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <ArrowLeft size={18} />
                Back
              </Link>

              <button
                type="button"
                onClick={refreshAll}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <RefreshCcw size={18} />
                Refresh
              </button>
            </div>
          </div>

          {!showTrash && (
            <div className="mt-6 relative">
              <div className="relative">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  onFocus={() => {
                    if (globalSearch.trim()) setShowSuggestions(true);
                  }}
                  className="w-full pl-12 pr-12 py-4 rounded-2xl border border-slate-200 bg-white outline-none focus:border-blue-500 transition font-medium text-[15px]"
                  placeholder="Search any PDF from all folders and subfolders..."
                />
                {globalSearch ? (
                  <button
                    type="button"
                    onClick={() => {
                      setGlobalSearch("");
                      setGlobalSuggestions([]);
                      setShowSuggestions(false);
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <X size={18} />
                  </button>
                ) : null}
              </div>

              {showSuggestions && globalSearch.trim() && globalSuggestions.length > 0 ? (
                <div className="absolute z-20 left-0 right-0 mt-2 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                  {globalSuggestions.map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => {
                        setGlobalSearch(item.fileName);
                        setShowSuggestions(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                    >
                      <div className="font-semibold text-slate-800 break-all">{item.fileName}</div>
                      <div className="text-xs text-slate-500 mt-1 break-all">
                        SKU: <b>{item.skuNormalized || "-"}</b>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {cutFileId && !showTrash ? (
            <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="text-sm text-violet-900 font-bold">
                Cut file selected: <b>{cutFileName || cutFileId}</b>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={pasteCutFileHere}
                  disabled={fileActionLoadingId === cutFileId}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-700 hover:bg-violet-800 text-white font-bold disabled:opacity-60"
                >
                  <ClipboardPaste size={16} />
                  Paste Here
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCutFileId("");
                    setCutFileName("");
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-violet-200 text-violet-700 font-bold"
                >
                  Cancel Cut
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
            <div className="space-y-4 min-w-0">
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-sm font-extrabold">Upload PDFs</div>

                <label
                  htmlFor="vault-upload-input"
                  className={`mt-3 flex min-h-[120px] w-full cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50 px-4 py-6 text-center transition ${showTrash ? "pointer-events-none opacity-60" : "hover:bg-emerald-100"
                    }`}
                >
                  <div>
                    <div className="mx-auto h-12 w-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
                      <Upload size={20} />
                    </div>
                    <div className="mt-3 text-sm font-extrabold text-emerald-800">Click here to select PDFs</div>
                    <div className="mt-1 text-xs text-emerald-700">Multiple PDF files choose kar sakte ho</div>
                  </div>
                </label>

                <input
                  id="vault-upload-input"
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
                  Current folder: <b>{currentPath}</b>
                  <br />
                  Selected PDFs: <b>{uploadFiles.length}</b>
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

              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm font-extrabold text-slate-900">{showTrash ? "Trashed Folders" : "Folders"}</div>

                    <div className="flex items-center gap-2">
                      <select
                        value={folderSortBy}
                        onChange={(e) => setFolderSortBy(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold outline-none"
                      >
                        <option value="name">By Name</option>
                        <option value="createdAt">By Created</option>
                        <option value="updatedAt">By Updated</option>
                        <option value="sortOrder">By Sort</option>
                      </select>

                      <select
                        value={folderSortDir}
                        onChange={(e) => setFolderSortDir(e.target.value as "asc" | "desc")}
                        className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold outline-none"
                      >
                        <option value="asc">Asc</option>
                        <option value="desc">Desc</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-xs font-bold text-slate-600 mt-3">
                    {breadcrumbs.map((item, idx) => (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => setCurrentPath(item.path)}
                        className="inline-flex items-center gap-2 hover:text-blue-700 transition-colors"
                      >
                        <span>{item.name}</span>
                        {idx !== breadcrumbs.length - 1 ? <ChevronRight size={13} /> : null}
                      </button>
                    ))}
                  </div>
                </div>

                {folderLoading ? (
                  <div className="p-6 text-slate-600 font-bold">Loading folders...</div>
                ) : folders.length === 0 ? (
                  <div className="p-6 text-slate-600 font-bold">{showTrash ? "No trashed folders found." : "No folders found."}</div>
                ) : (
                  <div className="flex flex-col">
                    {folders.map((folder) => {
                      const isBusy = folderActionLoadingId === folder._id;
                      const isRenaming = renamingFolderId === folder._id;

                      return (
                        <div
                          key={folder._id}
                          className="w-full px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
                        >
                          <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 items-start">
                            <div
                              className={
                                showTrash
                                  ? "h-11 w-11 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0"
                                  : "h-11 w-11 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0"
                              }
                            >
                              <Folder size={20} />
                            </div>

                            <div className="min-w-0">
                              {isRenaming ? (
                                <div className="flex items-center gap-2 flex-wrap w-full">
                                  <input
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    autoFocus
                                    className="px-3 py-2 rounded-xl border border-blue-300 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm font-medium flex-1 min-w-[150px]"
                                    placeholder="New folder name"
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      renameFolder(folder);
                                    }}
                                    disabled={isBusy}
                                    className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold disabled:opacity-60 shadow-sm"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRenamingFolderId("");
                                      setRenameValue("");
                                    }}
                                    className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-bold shadow-sm hover:bg-slate-50 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (showTrash || isRenaming) return;
                                    setCurrentPath(folder.path);
                                  }}
                                  className="w-full text-left min-w-0"
                                >
                                  <div className="font-extrabold text-slate-800 text-[15px] leading-snug break-words">
                                    {folder.name}
                                  </div>
                                  <div className="text-xs text-slate-500 mt-0.5 break-all">{folder.path}</div>
                                  {showTrash && folder.deletedAt ? (
                                    <div className="text-[11px] text-rose-600 font-semibold mt-1">
                                      Trashed: {formatDate(folder.deletedAt)}
                                    </div>
                                  ) : null}
                                </button>
                              )}

                              {!isRenaming ? (
                                <div className="mt-3 flex items-center gap-2 flex-wrap">
                                  {!showTrash ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setRenamingFolderId(folder._id);
                                          setRenameValue(folder.name);
                                        }}
                                        title="Rename Folder"
                                        className="p-2.5 rounded-xl bg-white hover:bg-blue-50 hover:text-blue-600 border border-slate-200 text-slate-500 transition-colors shadow-sm"
                                      >
                                        <Pencil size={16} />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          moveFolderToTrash(folder);
                                        }}
                                        disabled={isBusy}
                                        title="Move to Trash"
                                        className="p-2.5 rounded-xl bg-white hover:bg-rose-50 hover:border-rose-200 border border-slate-200 text-slate-500 hover:text-rose-600 transition-colors shadow-sm disabled:opacity-60"
                                      >
                                        <Trash2 size={16} />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCurrentPath(folder.path);
                                        }}
                                        className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold transition-colors shadow-sm ml-1"
                                      >
                                        Open <ChevronRight size={16} />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          restoreFolder(folder);
                                        }}
                                        disabled={isBusy}
                                        title="Restore Folder"
                                        className="p-2.5 rounded-xl bg-white hover:bg-emerald-50 hover:border-emerald-200 border border-slate-200 text-slate-500 hover:text-emerald-600 transition-colors shadow-sm disabled:opacity-60"
                                      >
                                        <RotateCcw size={16} />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          purgeFolder(folder);
                                        }}
                                        disabled={isBusy}
                                        title="Permanently Delete"
                                        className="p-2.5 rounded-xl bg-white hover:bg-rose-50 hover:border-rose-200 border border-slate-200 text-slate-500 hover:text-rose-600 transition-colors shadow-sm disabled:opacity-60"
                                      >
                                        <XCircle size={16} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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

            <div className="min-w-0 space-y-6">
              {!showTrash && (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-extrabold">Create Folder</div>

                  <div className="mt-3 flex items-center gap-3 flex-wrap">
                    <input
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      className="flex-1 min-w-[220px] px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                      placeholder="Folder name"
                      disabled={showTrash}
                    />

                    <button
                      type="button"
                      onClick={createFolder}
                      disabled={creatingFolder || showTrash}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-950 text-white transition font-extrabold disabled:opacity-60 shadow-sm"
                    >
                      <FolderPlus size={18} />
                      {creatingFolder ? "Creating..." : "Create Folder"}
                    </button>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm min-w-0">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">
                      {showTrash ? "Trashed PDF Files" : searchActive ? "Search Results" : "PDF Files"}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {showTrash
                        ? "Deleted PDFs can be restored or permanently deleted"
                        : "Green = product exists, Red = product not found"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={fileSortBy}
                      onChange={(e) => setFileSortBy(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold outline-none"
                    >
                      <option value="uploadedAt">By Uploaded Date</option>
                      <option value="name">By Name</option>
                      <option value="productExists">By Product Exists</option>
                      <option value="updatedAt">By Updated Date</option>
                    </select>

                    <select
                      value={fileSortDir}
                      onChange={(e) => setFileSortDir(e.target.value as "asc" | "desc")}
                      className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold outline-none"
                    >
                      <option value="asc">Asc</option>
                      <option value="desc">Desc</option>
                    </select>

                    <select
                      value={String(filePageSize)}
                      onChange={(e) => {
                        setFilePageSize(Number(e.target.value));
                        setFilePage(1);
                      }}
                      className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold outline-none"
                    >
                      <option value="25">25 / page</option>
                      <option value="50">50 / page</option>
                      <option value="100">100 / page</option>
                      <option value="200">200 / page</option>
                    </select>

                    <div className="text-xs font-bold text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-200">
                      Total: {files.length}
                    </div>
                  </div>
                </div>

                {filesLoading ? (
                  <div className="p-6 text-slate-600 font-bold">Loading files...</div>
                ) : files.length === 0 ? (
                  <div className="p-6 text-slate-600 font-bold">
                    {showTrash
                      ? "No trashed PDF files found."
                      : searchActive
                        ? "No matching PDF files found."
                        : "No PDF files found in this folder."}
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col">
                      {pagedFiles.map((file) => {
                        const isGreen = file.productExists && String(file.titleColor).toLowerCase() === "green";
                        const isBusy = fileActionLoadingId === file._id;

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
                                  ) : (
                                    <div className="text-xs text-rose-600 mt-1 break-words font-semibold">
                                      Trashed: {formatDate(file.deletedAt)}
                                    </div>
                                  )}

                                  <div className="text-xs text-slate-500 mt-1 break-words">
                                    Pages: <b>{Number(file.pageCount || 0)}</b>
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
                                          onClick={() => {
                                            setCutFileId(file._id);
                                            setCutFileName(file.fileName);
                                          }}
                                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-700 text-sm font-bold shadow-sm"
                                        >
                                          <Scissors size={15} />
                                          Cut
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => moveFileToTrash(file)}
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

                              <div className="hidden md:block text-xs text-slate-500 space-y-1.5 min-w-[190px] bg-white p-2.5 rounded-xl border border-slate-100">
                                <div>
                                  Pages: <b className="text-slate-700">{Number(file.pageCount || 0)}</b>
                                </div>
                                <div>
                                  Size: <b className="text-slate-700">{formatBytes(Number(file.sizeBytes || 0))}</b>
                                </div>
                                <div>
                                  Uploaded: <b className="text-slate-700">{formatDate(file.uploadedAt)}</b>
                                </div>
                                <div>
                                  Updated: <b className="text-slate-700">{formatDate(file.updatedAt)}</b>
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
                          Showing <b>{startItem}</b> to <b>{endItem}</b> of <b>{files.length}</b> results
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setFilePage((p) => Math.max(1, p - 1))}
                            disabled={filePage <= 1}
                            className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-gray-50 text-sm font-bold disabled:opacity-50"
                          >
                            Previous
                          </button>

                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter((p) => {
                              if (totalPages <= 7) return true;
                              if (p === 1 || p === totalPages) return true;
                              return Math.abs(p - filePage) <= 1;
                            })
                            .map((p, idx, arr) => {
                              const prev = arr[idx - 1];
                              const showGap = idx > 0 && prev && p - prev > 1;

                              return (
                                <div key={`page-wrap-${p}`} className="flex items-center gap-2">
                                  {showGap ? <span className="text-slate-400 px-1">...</span> : null}
                                  <button
                                    type="button"
                                    onClick={() => setFilePage(p)}
                                    className={`min-w-[42px] px-3 py-2 rounded-xl text-sm font-bold border ${p === filePage
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
                            onClick={() => setFilePage((p) => Math.min(totalPages, p + 1))}
                            disabled={filePage >= totalPages}
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
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}