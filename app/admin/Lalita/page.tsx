"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  AlertTriangle,
  CheckCircle2,
  Info,
  LoaderCircle,
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
  folderName?: string;
  folderPath?: string;
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

type FileListResponse = {
  ok?: boolean;
  files?: VaultFileItem[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
};

type UploadApiResponse = {
  ok?: boolean;
  action?: "prepare" | "finalize";
  status?: "ready" | "uploaded" | "replaced" | "skipped";
  message?: string;
  error?: string;
  needsPuzzle?: boolean;
  fileName?: string;
  skuNormalized?: string;
  fileId?: string;
  pageCount?: number;
  uploadUrl?: string;
  uploadToken?: string;
  s3Key?: string;
  contentType?: string;
  expiresInSeconds?: number;
  maxFileBytes?: number;
  warnings?: string[];
  counts?: {
    total?: number;
    uploaded?: number;
    replaced?: number;
    skipped?: number;
    failed?: number;
    done?: number;
  };
};

type PreparedDirectUpload = {
  uploadUrl: string;
  uploadToken: string;
  s3Key: string;
  contentType: string;
  fileName: string;
};

const MAX_DIRECT_UPLOAD_BYTES = 20 * 1024 * 1024;

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

function buildFileKey(file: File) {
  return `${safeText(file.name)}__${Number(file.size || 0)}__${Number(
    file.lastModified || 0
  )}`;
}

function normalizeSelectedPdfFiles(fileList: FileList | File[] | null | undefined) {
  const arr = Array.from(fileList || []);
  const onlyPdf = arr.filter((file) =>
    safeText(file?.name).toLowerCase().endsWith(".pdf")
  );

  const seen = new Set<string>();
  const out: File[] = [];

  for (const file of onlyPdf) {
    const key = buildFileKey(file);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(file);
  }

  return out;
}

function parseS3ErrorMessage(input: string) {
  const text = safeText(input);
  if (!text) return "";

  const match = text.match(/<Message>([\s\S]*?)<\/Message>/i);
  if (match?.[1]) {
    return safeText(match[1]);
  }

  return text.slice(0, 300);
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

  const [folderSortBy, setFolderSortBy] = useState("name");
  const [folderSortDir, setFolderSortDir] = useState<"asc" | "desc">("asc");

  const [fileSortBy, setFileSortBy] = useState("uploadedAt");
  const [fileSortDir, setFileSortDir] = useState<"asc" | "desc">("desc");

  const [filePage, setFilePage] = useState(1);
  const [filePageSize, setFilePageSize] = useState(25);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);

  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [conflictMode, setConflictMode] = useState<"ignore" | "replace">("ignore");

  const [isUploading, setIsUploading] = useState(false);
  const [uploadPaused, setUploadPaused] = useState(false);
  const [uploadPauseReason, setUploadPauseReason] = useState("");
  const [uploadTotalCount, setUploadTotalCount] = useState(0);
  const [uploadProcessedCount, setUploadProcessedCount] = useState(0);
  const [uploadUploadedCount, setUploadUploadedCount] = useState(0);
  const [uploadSkippedCount, setUploadSkippedCount] = useState(0);
  const [uploadFailedCount, setUploadFailedCount] = useState(0);
  const [uploadCurrentFileName, setUploadCurrentFileName] = useState("");
  const [uploadCurrentIndex, setUploadCurrentIndex] = useState(0);

  const [serverMessage, setServerMessage] = useState("");
  const [serverMessageType, setServerMessageType] = useState<"success" | "error" | "info">("info");

  const [showTrash, setShowTrash] = useState(false);
  const [folderActionLoadingId, setFolderActionLoadingId] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState("");
  const [renameValue, setRenameValue] = useState("");

  const [cutFileId, setCutFileId] = useState("");
  const [cutFileName, setCutFileName] = useState("");
  const [fileActionLoadingId, setFileActionLoadingId] = useState("");

  const longTaskActiveRef = useRef(false);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);
  const uploadCancelRequestedRef = useRef(false);
  const uploadNextIndexRef = useRef(0);
  const uploadTargetPathRef = useRef("root");
  const uploadConflictModeRef = useRef<"ignore" | "replace">("ignore");

  const titlePath = useMemo(() => breadcrumbs.map((x) => x.name).join(" / "), [breadcrumbs]);
  const searchActive = globalSearch.trim().length > 0;

  const selectedFilesSize = useMemo(
    () => selectedFiles.reduce((sum, file) => sum + Number(file.size || 0), 0),
    [selectedFiles]
  );

  const oversizedSelectedFilesCount = useMemo(
    () =>
      selectedFiles.filter(
        (file) => Math.max(0, Math.trunc(Number(file.size || 0))) > MAX_DIRECT_UPLOAD_BYTES
      ).length,
    [selectedFiles]
  );

  const uploadProgressPercent = useMemo(() => {
    if (!uploadTotalCount) return 0;
    return Math.min(100, Math.round((uploadProcessedCount / uploadTotalCount) * 100));
  }, [uploadProcessedCount, uploadTotalCount]);

  const fromItem = serverTotal === 0 ? 0 : (filePage - 1) * filePageSize + 1;
  const toItem = Math.min(filePage * filePageSize, serverTotal);

  function resetMessages() {
    setServerMessage("");
    setServerMessageType("info");
  }

  function resetUploadProgress(keepSelection = true) {
    setIsUploading(false);
    setUploadPaused(false);
    setUploadPauseReason("");
    setUploadTotalCount(0);
    setUploadProcessedCount(0);
    setUploadUploadedCount(0);
    setUploadSkippedCount(0);
    setUploadFailedCount(0);
    setUploadCurrentFileName("");
    setUploadCurrentIndex(0);
    uploadAbortControllerRef.current = null;
    uploadCancelRequestedRef.current = false;
    uploadNextIndexRef.current = 0;
    uploadTargetPathRef.current = currentPath;
    uploadConflictModeRef.current = conflictMode;

    if (!keepSelection) {
      setSelectedFiles([]);
      const input = document.getElementById("vault-upload-input") as HTMLInputElement | null;
      if (input) input.value = "";
    }
  }

  async function safeReadJson(res: Response) {
    const text = await res.text();

    if (!text) {
      return { ok: false, error: "Server returned empty response" };
    }

    try {
      return JSON.parse(text);
    } catch {
      return {
        ok: false,
        error: text.slice(0, 400) || "Invalid server response",
      };
    }
  }

  async function loadBootstrap() {
    setBootLoading(true);
    try {
      const res = await fetch("/api/admin/pdf-vault/bootstrap", {
        credentials: "include",
        cache: "no-store",
      });

      const data: BootstrapResponse = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAccessGranted(false);
        return;
      }

      setAccessGranted(Boolean(data?.accessGranted));
      setCurrentPath(data?.root?.path || "root");

      if (!data?.accessGranted) {
        const puzzleRes = await fetch("/api/admin/pdf-vault/puzzle", {
          credentials: "include",
          cache: "no-store",
        });
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
      } else if (q) {
        qs.set("global", "1");
        qs.set("q", q);
      } else {
        qs.set("parentPath", path);
      }

      qs.set("sortBy", fileSortBy);
      qs.set("sortDir", fileSortDir);
      qs.set("page", String(filePage));
      qs.set("pageSize", String(filePageSize));

      const res = await fetch(`/api/admin/pdf-vault/files?${qs.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });

      const data: FileListResponse = await res.json().catch(() => ({}));
      if (!res.ok) {
        if ((data as any)?.needsPuzzle) {
          setAccessGranted(false);
          await loadBootstrap();
          return;
        }

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

  async function prepareDirectUpload(
    file: File,
    targetPath: string,
    mode: "ignore" | "replace"
  ) {
    const controller = new AbortController();
    uploadAbortControllerRef.current = controller;

    const res = await fetch("/api/admin/pdf-vault/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      signal: controller.signal,
      body: JSON.stringify({
        action: "prepare",
        parentPath: targetPath,
        conflictMode: mode,
        fileName: file.name,
        sizeBytes: Number(file.size || 0),
      }),
    });

    const data = (await safeReadJson(res)) as UploadApiResponse & Record<string, any>;
    return { res, data };
  }

  async function uploadFileToS3(file: File, prepared: PreparedDirectUpload) {
    const controller = new AbortController();
    uploadAbortControllerRef.current = controller;

    const res = await fetch(prepared.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": safeText(prepared.contentType || file.type || "application/pdf"),
      },
      body: file,
      signal: controller.signal,
    });

    if (res.ok) {
      return { ok: true as const, error: "" };
    }

    const errorText = parseS3ErrorMessage(await res.text().catch(() => ""));
    return {
      ok: false as const,
      error: errorText || `Direct S3 upload failed (${res.status})`,
    };
  }

  async function finalizeDirectUpload(
    file: File,
    prepared: PreparedDirectUpload,
    targetPath: string,
    mode: "ignore" | "replace"
  ) {
    const controller = new AbortController();
    uploadAbortControllerRef.current = controller;

    const res = await fetch("/api/admin/pdf-vault/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      signal: controller.signal,
      body: JSON.stringify({
        action: "finalize",
        parentPath: targetPath,
        conflictMode: mode,
        fileName: file.name,
        s3Key: prepared.s3Key,
        uploadToken: prepared.uploadToken,
      }),
    });

    const data = (await safeReadJson(res)) as UploadApiResponse & Record<string, any>;
    return { res, data };
  }

  async function runDirectUpload(
    startIndex: number,
    targetPath: string,
    mode: "ignore" | "replace"
  ) {
    if (!selectedFiles.length) {
      alert("Pehle PDF files select karo.");
      return;
    }

    if (showTrash) {
      alert("Trash view me upload allowed nahi hai.");
      return;
    }

    uploadCancelRequestedRef.current = false;
    setIsUploading(true);
    setUploadPaused(false);
    setUploadPauseReason("");
    setUploadTotalCount(selectedFiles.length);

    let uploadedCount = startIndex === 0 ? 0 : uploadUploadedCount;
    let processedCount = startIndex === 0 ? 0 : uploadProcessedCount;
    let skippedCount = startIndex === 0 ? 0 : uploadSkippedCount;
    let failedCount = startIndex === 0 ? 0 : uploadFailedCount;
    const failureMessages: string[] = [];

    if (startIndex === 0) {
      setUploadUploadedCount(0);
      setUploadProcessedCount(0);
      setUploadSkippedCount(0);
      setUploadFailedCount(0);
    }

    try {
      for (let i = startIndex; i < selectedFiles.length; i++) {
        if (uploadCancelRequestedRef.current) {
          break;
        }

        uploadNextIndexRef.current = i;
        const file = selectedFiles[i];

        setUploadCurrentIndex(i + 1);
        setUploadCurrentFileName(file.name);

        if (Math.max(0, Math.trunc(Number(file.size || 0))) > MAX_DIRECT_UPLOAD_BYTES) {
          skippedCount += 1;
          processedCount += 1;
          setUploadSkippedCount(skippedCount);
          setUploadProcessedCount(processedCount);
          continue;
        }

        try {
          const preparedResponse = await prepareDirectUpload(file, targetPath, mode);

          if (uploadCancelRequestedRef.current) {
            break;
          }

          const preparedData = preparedResponse.data;
          if (!preparedResponse.res.ok || !preparedData?.ok) {
            const errMsg =
              safeText(preparedData?.error || preparedData?.message || "Upload prepare failed") ||
              "Upload prepare failed";

            if (
              preparedResponse.res.status === 401 ||
              preparedResponse.res.status === 403 ||
              preparedData?.needsPuzzle
            ) {
              setIsUploading(false);
              setUploadPaused(true);
              setUploadPauseReason(errMsg);
              setServerMessage(errMsg);
              setServerMessageType("error");

              if (preparedData?.needsPuzzle) {
                setAccessGranted(false);
                await loadBootstrap();
              }
              return;
            }

            failedCount += 1;
            processedCount += 1;
            failureMessages.push(errMsg);
            setUploadFailedCount(failedCount);
            setUploadProcessedCount(processedCount);
            continue;
          }

          if (safeText(preparedData?.status).toLowerCase() === "skipped") {
            skippedCount += 1;
            processedCount += 1;
            setUploadSkippedCount(skippedCount);
            setUploadProcessedCount(processedCount);
            continue;
          }

          const prepared: PreparedDirectUpload = {
            uploadUrl: safeText(preparedData?.uploadUrl),
            uploadToken: safeText(preparedData?.uploadToken),
            s3Key: safeText(preparedData?.s3Key),
            contentType: safeText(preparedData?.contentType || "application/pdf"),
            fileName: safeText(preparedData?.fileName || file.name),
          };

          if (!prepared.uploadUrl || !prepared.uploadToken || !prepared.s3Key) {
            failedCount += 1;
            processedCount += 1;
            failureMessages.push("Prepare response incomplete");
            setUploadFailedCount(failedCount);
            setUploadProcessedCount(processedCount);
            continue;
          }

          const s3Upload = await uploadFileToS3(file, prepared);

          if (uploadCancelRequestedRef.current) {
            break;
          }

          if (!s3Upload.ok) {
            failedCount += 1;
            processedCount += 1;
            failureMessages.push(s3Upload.error || "Direct S3 upload failed");
            setUploadFailedCount(failedCount);
            setUploadProcessedCount(processedCount);
            continue;
          }

          const finalResponse = await finalizeDirectUpload(file, prepared, targetPath, mode);

          if (uploadCancelRequestedRef.current) {
            break;
          }

          const finalData = finalResponse.data;

          if (!finalResponse.res.ok || !finalData?.ok) {
            const errMsg =
              safeText(finalData?.error || finalData?.message || "Upload finalize failed") ||
              "Upload finalize failed";

            if (
              finalResponse.res.status === 401 ||
              finalResponse.res.status === 403 ||
              finalData?.needsPuzzle
            ) {
              setIsUploading(false);
              setUploadPaused(true);
              setUploadPauseReason(errMsg);
              setServerMessage(errMsg);
              setServerMessageType("error");

              if (finalData?.needsPuzzle) {
                setAccessGranted(false);
                await loadBootstrap();
              }
              return;
            }

            failedCount += 1;
            processedCount += 1;
            failureMessages.push(errMsg);
            setUploadFailedCount(failedCount);
            setUploadProcessedCount(processedCount);
            continue;
          }

          const status = safeText(finalData?.status).toLowerCase();

          if (status === "uploaded" || status === "replaced") {
            uploadedCount += 1;
            processedCount += 1;
            setUploadUploadedCount(uploadedCount);
            setUploadProcessedCount(processedCount);
            continue;
          }

          if (status === "skipped") {
            skippedCount += 1;
            processedCount += 1;
            setUploadSkippedCount(skippedCount);
            setUploadProcessedCount(processedCount);
            continue;
          }

          failedCount += 1;
          processedCount += 1;
          failureMessages.push("Unknown finalize response");
          setUploadFailedCount(failedCount);
          setUploadProcessedCount(processedCount);
        } catch (error: any) {
          if (uploadCancelRequestedRef.current) {
            break;
          }

          const reason = safeText(error?.message || "Upload interrupted");

          if (reason.toLowerCase().includes("abort")) {
            break;
          }

          failedCount += 1;
          processedCount += 1;
          failureMessages.push(reason || "Upload interrupted");
          setUploadFailedCount(failedCount);
          setUploadProcessedCount(processedCount);
          continue;
        } finally {
          uploadAbortControllerRef.current = null;
        }
      }

      setIsUploading(false);
      setUploadCurrentFileName("");
      setUploadCurrentIndex(0);

      if (uploadCancelRequestedRef.current) {
        setServerMessage(
          `Upload stopped. ${uploadedCount} PDF${uploadedCount === 1 ? "" : "s"} already uploaded successfully.`
        );
        setServerMessageType("info");
        return;
      }

      if (processedCount >= selectedFiles.length) {
        const firstFailure = safeText(failureMessages[0] || "");
        const summaryMessage =
          failedCount > 0 || skippedCount > 0
            ? `Upload finished. Actual uploaded ${uploadedCount} / ${selectedFiles.length}. Skipped ${skippedCount}, Failed ${failedCount}.${firstFailure ? ` First issue: ${firstFailure}` : ""}`
            : `Upload finished successfully. ${uploadedCount} / ${selectedFiles.length} PDFs uploaded.`;

        setServerMessage(summaryMessage);
        setServerMessageType(failedCount > 0 ? "info" : "success");

        await refreshAll();
      }
    } finally {
      uploadAbortControllerRef.current = null;
      setIsUploading(false);
    }
  }

  async function startDirectUpload() {
    if (!selectedFiles.length) {
      alert("Pehle PDF files select karo.");
      return;
    }

    resetMessages();
    resetUploadProgress(true);
    uploadTargetPathRef.current = currentPath;
    uploadConflictModeRef.current = conflictMode;
    setUploadTotalCount(selectedFiles.length);
    uploadNextIndexRef.current = 0;
    await runDirectUpload(0, uploadTargetPathRef.current, uploadConflictModeRef.current);
  }

  async function resumeDirectUpload() {
    if (!selectedFiles.length) {
      alert("Same original PDF list current browser me select honi chahiye.");
      return;
    }

    resetMessages();
    setUploadPaused(false);
    setUploadPauseReason("");
    await runDirectUpload(
      uploadNextIndexRef.current,
      uploadTargetPathRef.current,
      uploadConflictModeRef.current
    );
  }

  function cancelCurrentUpload() {
    const ok = window.confirm("Current upload stop karna hai?");
    if (!ok) return;

    uploadCancelRequestedRef.current = true;

    try {
      uploadAbortControllerRef.current?.abort();
    } catch {
      // ignore
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

      if (currentPath === folder.path && (data as any)?.folder?.path) {
        setCurrentPath(String((data as any).folder.path));
      }

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
      const res = await fetch(
        `/api/admin/pdf-vault/folders?folderId=${encodeURIComponent(folder._id)}`,
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
      const fileName = `${(breadcrumbs[breadcrumbs.length - 1]?.name || "folder").replace(
        /[^a-zA-Z0-9-_]/g,
        "-"
      )}.zip`;

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
      const res = await fetch(
        `/api/admin/pdf-vault/files?fileId=${encodeURIComponent(file._id)}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

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
    void loadBootstrap();
  }, []);

  useEffect(() => {
    if (!accessGranted) return;
    void loadFolders(currentPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessGranted, currentPath, folderSortBy, folderSortDir, showTrash]);

  useEffect(() => {
    if (!accessGranted) return;

    const t = setTimeout(() => {
      void loadFiles(currentPath, globalSearch.trim());
    }, searchActive ? 250 : 0);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    accessGranted,
    currentPath,
    globalSearch,
    showTrash,
    fileSortBy,
    fileSortDir,
    filePage,
    filePageSize,
  ]);

  useEffect(() => {
    setFilePage(1);
  }, [filePageSize, currentPath, showTrash, fileSortBy, fileSortDir]);

  useEffect(() => {
    if (isUploading && !longTaskActiveRef.current) {
      notifyLongTaskStart();
      longTaskActiveRef.current = true;
    }

    if (!isUploading && longTaskActiveRef.current) {
      notifyLongTaskEnd();
      longTaskActiveRef.current = false;
    }
  }, [isUploading]);

  useEffect(() => {
    return () => {
      if (longTaskActiveRef.current) {
        notifyLongTaskEnd();
        longTaskActiveRef.current = false;
      }

      try {
        uploadAbortControllerRef.current?.abort();
      } catch {
        // ignore
      }
    };
  }, []);

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
                <p className="text-sm text-slate-600 mt-1">
                  Access verify karne ke liye answer submit kijiye.
                </p>
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
                Solved PDFs ab direct browser to S3 final upload mode me process hongi. Current
                path: <b>{titlePath || "root"}</b>
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {!showTrash && (
                <button
                  type="button"
                  onClick={() => void downloadCurrentFolderZip()}
                  disabled={folderActionLoadingId === `download:${currentPath}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm disabled:opacity-60"
                >
                  <FolderDown size={18} />
                  {folderActionLoadingId === `download:${currentPath}` ? "Preparing ZIP..." : "Download Folder"}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowTrash((p) => !p);
                  setFilePage(1);
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

              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <ArrowLeft size={18} />
                Back
              </Link>

              <button
                type="button"
                onClick={() => void refreshAll()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <RefreshCcw size={18} />
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <Info size={18} className="mt-0.5 shrink-0 text-blue-800" />
              <div>
                <div className="text-sm font-extrabold text-blue-900">
                  Direct S3 upload system
                </div>
                <div className="text-sm text-blue-800 mt-2 leading-6">
                  Ab browser se PDF direct S3 par upload hogi, phir final record database me save
                  hoga. Uploaded counter tabhi badega jab file <b>actual me S3 + database</b> dono
                  me finalize ho jayegi.
                  <br />
                  Per PDF max size <b>{formatBytes(MAX_DIRECT_UPLOAD_BYTES)}</b> hai.
                  <br />
                  Agar upload beech me stop hota hai, jo PDFs uploaded count me aa chuki hain woh
                  already saved hoti hain.
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
                Upload running hai. Inactivity auto-logout temporarily pause rahega jab tak current upload chal raha hai.
              </div>
            </div>
          ) : null}

          {uploadPaused ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-rose-800">
                    <AlertTriangle size={18} />
                    Upload Paused
                  </div>
                  <div className="mt-2 text-sm text-rose-800 leading-6">
                    {uploadPauseReason || "Upload temporarily paused hai."}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void resumeDirectUpload()}
                  disabled={isUploading || !selectedFiles.length}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold shadow-sm disabled:opacity-60"
                >
                  <Upload size={16} />
                  Resume Upload
                </button>
              </div>
            </div>
          ) : null}

          {!showTrash && (
            <div className="mt-6 relative">
              <div className="relative">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={globalSearch}
                  onChange={(e) => {
                    setGlobalSearch(e.target.value);
                    setFilePage(1);
                  }}
                  className="w-full pl-12 pr-12 py-4 rounded-2xl border border-slate-200 bg-white outline-none focus:border-blue-500 transition font-medium text-[15px]"
                  placeholder="Search any PDF from all folders and subfolders..."
                />
                {globalSearch ? (
                  <button
                    type="button"
                    onClick={() => {
                      setGlobalSearch("");
                      setFilePage(1);
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <X size={18} />
                  </button>
                ) : null}
              </div>
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
                  onClick={() => void pasteCutFileHere()}
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

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-6 items-start">
            <div className="space-y-4 min-w-0">
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-sm font-extrabold">Upload Solved PDFs</div>

                <label
                  htmlFor="vault-upload-input"
                  className={`mt-3 flex min-h-[120px] w-full cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50 px-4 py-6 text-center transition ${
                    showTrash || isUploading ? "pointer-events-none opacity-60" : "hover:bg-emerald-100"
                  }`}
                >
                  <div>
                    <div className="mx-auto h-12 w-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
                      <Upload size={20} />
                    </div>
                    <div className="mt-3 text-sm font-extrabold text-emerald-800">
                      Click here to select PDFs
                    </div>
                    <div className="mt-1 text-xs text-emerald-700">
                      Multiple PDF files ek saath select kar sakte ho
                    </div>
                  </div>
                </label>

                <input
                  id="vault-upload-input"
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  onChange={(e) => {
                    const onlyPdf = normalizeSelectedPdfFiles(e.target.files);
                    resetUploadProgress(true);
                    setSelectedFiles(onlyPdf);

                    const totalChosen = Array.from(e.target.files || []).length;

                    if (onlyPdf.length !== totalChosen) {
                      setServerMessage("Non-PDF files ignore kar di gayi hain. Sirf PDFs select hui hain.");
                      setServerMessageType("info");
                    } else {
                      resetMessages();
                    }
                  }}
                  className="hidden"
                  disabled={showTrash || isUploading}
                />

                <select
                  value={conflictMode}
                  onChange={(e) => setConflictMode(e.target.value as "ignore" | "replace")}
                  className="w-full mt-3 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  disabled={showTrash || isUploading}
                >
                  <option value="ignore">Duplicate mode: Ignore new</option>
                  <option value="replace">Duplicate mode: Replace old</option>
                </select>

                <div className="mt-3 text-xs text-slate-500 leading-6">
                  Current folder: <b>{currentPath}</b>
                  <br />
                  Selected PDFs: <b>{selectedFiles.length}</b>
                  <br />
                  Selected size: <b>{formatBytes(selectedFilesSize)}</b>
                  <br />
                  Max file size per PDF: <b>{formatBytes(MAX_DIRECT_UPLOAD_BYTES)}</b>
                  <br />
                  Oversized files: <b>{oversizedSelectedFilesCount}</b>
                </div>

                {oversizedSelectedFilesCount > 0 ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                    {oversizedSelectedFilesCount} file 20MB limit se upar hain. Ye files skip hongi, baaki PDFs continue hongi.
                  </div>
                ) : null}

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void startDirectUpload()}
                    disabled={isUploading || showTrash || !selectedFiles.length}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-950 text-white transition font-extrabold disabled:opacity-60 shadow-sm"
                  >
                    <Upload size={18} />
                    {isUploading ? "Uploading..." : "Start Upload"}
                  </button>

                  <button
                    type="button"
                    onClick={() => resetUploadProgress(false)}
                    disabled={isUploading}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-extrabold disabled:opacity-60 shadow-sm"
                  >
                    <X size={18} />
                    Clear
                  </button>
                </div>

                {isUploading ? (
                  <button
                    type="button"
                    onClick={cancelCurrentUpload}
                    className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white transition font-extrabold shadow-sm"
                  >
                    <XCircle size={18} />
                    Stop Current Upload
                  </button>
                ) : null}

                {(uploadTotalCount > 0 || selectedFiles.length > 0) ? (
                  <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <div className="text-sm font-extrabold text-blue-900">Upload Progress</div>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-blue-200 bg-white p-3">
                        <div className="text-[11px] uppercase font-extrabold text-blue-700">
                          Total PDFs
                        </div>
                        <div className="mt-1 text-lg font-extrabold text-slate-900">
                          {uploadTotalCount || selectedFiles.length}
                        </div>
                      </div>

                      <div className="rounded-xl border border-emerald-200 bg-white p-3">
                        <div className="text-[11px] uppercase font-extrabold text-emerald-700">
                          Uploaded PDFs
                        </div>
                        <div className="mt-1 text-lg font-extrabold text-slate-900">
                          {uploadUploadedCount}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 h-4 w-full overflow-hidden rounded-full bg-blue-100">
                      <div
                        className="h-full rounded-full bg-blue-700 transition-all"
                        style={{ width: `${uploadProgressPercent}%` }}
                      />
                    </div>

                    <div className="mt-2 text-xs font-semibold text-blue-900">
                      Processed {uploadProcessedCount} / {uploadTotalCount || selectedFiles.length}
                    </div>

                    {uploadCurrentFileName ? (
                      <div className="mt-2 text-xs text-blue-900 break-all">
                        Current file: <b>{uploadCurrentIndex}. {uploadCurrentFileName}</b>
                      </div>
                    ) : null}

                    <div className="mt-2 text-xs text-blue-900">
                      Folder snapshot: <b>{uploadTargetPathRef.current || currentPath}</b>
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
                  Recommended filename format:
                  <br />
                  <b>BHIC131ENG202526.pdf</b>
                  <br />
                  <b>BEGC101HIN202526.pdf</b>
                  <br />
                  Filename se SKU parse hoga, isliye final PDF name product SKU-based hi rakho.
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm font-extrabold text-slate-900">
                      {showTrash ? "Trashed Folders" : "Folders"}
                    </div>

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
                        onClick={() => {
                          setCurrentPath(item.path);
                          setFilePage(1);
                        }}
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
                  <div className="p-6 text-slate-600 font-bold">
                    {showTrash ? "No trashed folders found." : "No folders found."}
                  </div>
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
                                      void renameFolder(folder);
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
                                    setFilePage(1);
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
                                          void moveFolderToTrash(folder);
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
                                          setFilePage(1);
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
                                          void restoreFolder(folder);
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
                                          void purgeFolder(folder);
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
                      onClick={() => void createFolder()}
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
                      onChange={(e) => {
                        setFileSortBy(e.target.value);
                        setFilePage(1);
                      }}
                      className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold outline-none"
                    >
                      <option value="uploadedAt">By Uploaded Date</option>
                      <option value="name">By Name</option>
                      <option value="productExists">By Product Exists</option>
                      <option value="updatedAt">By Updated Date</option>
                      <option value="pageCount">By Page Count</option>
                    </select>

                    <select
                      value={fileSortDir}
                      onChange={(e) => {
                        setFileSortDir(e.target.value as "asc" | "desc");
                        setFilePage(1);
                      }}
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
                      Total: {serverTotal}
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
                      {files.map((file) => {
                        const isGreen =
                          file.productExists && String(file.titleColor).toLowerCase() === "green";
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

                                      {searchActive && file.folderPath ? (
                                        <div className="text-xs text-slate-500 mt-1 break-all">
                                          Folder: <b>{file.folderPath}</b>
                                        </div>
                                      ) : null}
                                    </>
                                  ) : (
                                    <div className="text-xs text-rose-600 mt-1 break-words font-semibold">
                                      Trashed: {formatDate(file.deletedAt)}
                                    </div>
                                  )}

                                  <div className="flex items-center gap-2 flex-wrap mt-1 text-xs text-slate-500">
                                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 border border-slate-200 bg-slate-50">
                                      Uploaded: <b>{formatDate(file.uploadedAt)}</b>
                                    </span>

                                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 border border-slate-200 bg-slate-50">
                                      Size: <b>{formatBytes(Number(file.sizeBytes || 0))}</b>
                                    </span>

                                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 border border-slate-200 bg-slate-50">
                                      Pages: <b>{Number(file.pageCount || 0)}</b>
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 flex-wrap mt-3">
                                    {!showTrash ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => void openPdf(file)}
                                          disabled={isBusy}
                                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-sm font-bold shadow-sm disabled:opacity-60"
                                        >
                                          <ExternalLink size={15} />
                                          Open
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => void downloadPdf(file)}
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
                                          onClick={() => void moveFileToTrash(file)}
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
                                          onClick={() => void restoreFile(file)}
                                          disabled={isBusy}
                                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-sm font-bold shadow-sm disabled:opacity-60"
                                        >
                                          <RotateCcw size={15} />
                                          Restore
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => void purgeFile(file)}
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
                            onClick={() => setFilePage((p) => Math.max(1, p - 1))}
                            disabled={filePage <= 1}
                            className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-gray-50 text-sm font-bold disabled:opacity-50"
                          >
                            Previous
                          </button>

                          {Array.from({ length: serverTotalPages }, (_, i) => i + 1)
                            .filter((p) => {
                              if (serverTotalPages <= 7) return true;
                              if (p === 1 || p === serverTotalPages) return true;
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
                                    className={`min-w-[42px] px-3 py-2 rounded-xl text-sm font-bold border ${
                                      p === filePage
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
                            onClick={() => setFilePage((p) => Math.min(serverTotalPages, p + 1))}
                            disabled={filePage >= serverTotalPages}
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