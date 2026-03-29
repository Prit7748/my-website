"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  FolderPlus,
  Folder,
  ShieldCheck,
  RefreshCcw,
  Image as ImageIcon,
  Upload,
  Pencil,
  Trash2,
  X,
  Search,
  BarChart3,
} from "lucide-react";

type BootstrapResponse = {
  ok?: boolean;
  root?: { _id: string; name: string; path: string; level: number; slug?: string };
};

type FolderItem = {
  _id: string;
  name: string;
  slug: string;
  path: string;
  level: number;
  sortOrder: number;
  isLocked: boolean;
  notes?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
};

type FolderListResponse = {
  ok?: boolean;
  parent?: { _id: string; name: string; path: string; level: number };
  breadcrumbs?: Array<{ name: string; path: string }>;
  folders?: FolderItem[];
};

type ImageFileItem = {
  _id: string;
  folderId: string;
  fileName: string;
  originalName: string;
  fileExt: string;
  baseName: string;
  skuNormalized: string;
  productExists: boolean;
  productId?: string;
  productSku?: string;
  productSlug?: string;
  publicUrl: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  isPrimary?: boolean;
  uploadedAt?: string | null;
  updatedAt?: string | null;
};

type FileListResponse = { ok?: boolean; files?: ImageFileItem[]; total?: number };

type UploadRow = {
  sku?: string;
  status?: string;
  uploaded?: number;
  totalNow?: number;
  skipped?: number;
  reason?: string;
};

type UploadResponse = {
  ok?: boolean;
  summary?: {
    totalSkuFoldersInZip?: number;
    updated?: number;
    skuNotFound?: number;
    failed?: number;
  };
  items?: UploadRow[];
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

export default function BulkProductImagesPage() {
  const [bootLoading, setBootLoading] = useState(true);

  const [currentPath, setCurrentPath] = useState("img-root");
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ name: string; path: string }>>([]);
  const [folderLoading, setFolderLoading] = useState(false);

  const [fileSortBy, setFileSortBy] = useState("uploadedAt");
  const [fileSortDir, setFileSortDir] = useState<"asc" | "desc">("desc");
  const [folderSortBy, setFolderSortBy] = useState("name");
  const [folderSortDir, setFolderSortDir] = useState<"asc" | "desc">("asc");

  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [zipFile, setZipFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<"append" | "replace">("append");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);

  const [folderActionLoadingId, setFolderActionLoadingId] = useState("");
  const [fileActionLoadingId, setFileActionLoadingId] = useState("");

  const [renamingFolderId, setRenamingFolderId] = useState("");
  const [renameValue, setRenameValue] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalFolder, setModalFolder] = useState<FolderItem | null>(null);
  const [modalFiles, setModalFiles] = useState<ImageFileItem[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [singleImageFile, setSingleImageFile] = useState<File | null>(null);
  const [singleUploading, setSingleUploading] = useState(false);

  const [productFolderSearch, setProductFolderSearch] = useState("");
  const [productFolderPage, setProductFolderPage] = useState(1);
  const [productFolderPageSize, setProductFolderPageSize] = useState(12);

  const titlePath = useMemo(() => breadcrumbs.map((x) => x.name).join(" / "), [breadcrumbs]);

  const manualFolders = useMemo(
    () => folders.filter((x) => safeText(x.notes) !== "AUTO_IMAGE_PRODUCT_FOLDER"),
    [folders]
  );

  const uploadedProductFolders = useMemo(
    () => folders.filter((x) => safeText(x.notes) === "AUTO_IMAGE_PRODUCT_FOLDER"),
    [folders]
  );

  const filteredUploadedProductFolders = useMemo(() => {
    const q = safeText(productFolderSearch).toLowerCase();
    if (!q) return uploadedProductFolders;

    return uploadedProductFolders.filter((folder) => {
      const hay =
        `${safeText(folder.name)} ${safeText(folder.path)} ${safeText(folder.slug)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [uploadedProductFolders, productFolderSearch]);

  const productFolderTotalPages = useMemo(() => {
    const total = Math.ceil(filteredUploadedProductFolders.length / productFolderPageSize);
    return total > 0 ? total : 1;
  }, [filteredUploadedProductFolders.length, productFolderPageSize]);

  const pagedUploadedProductFolders = useMemo(() => {
    const start = (productFolderPage - 1) * productFolderPageSize;
    return filteredUploadedProductFolders.slice(start, start + productFolderPageSize);
  }, [filteredUploadedProductFolders, productFolderPage, productFolderPageSize]);

  const productFolderStartItem = filteredUploadedProductFolders.length
    ? (productFolderPage - 1) * productFolderPageSize + 1
    : 0;

  const productFolderEndItem = Math.min(
    productFolderPage * productFolderPageSize,
    filteredUploadedProductFolders.length
  );

  async function loadBootstrap() {
    setBootLoading(true);
    try {
      const res = await fetch("/api/products/bulk-images/bootstrap", {
        credentials: "include",
        cache: "no-store",
      });

      const data: BootstrapResponse = await res.json().catch(() => ({}));
      if (!res.ok || !data?.root?.path) {
        alert((data as any)?.error || "Bootstrap failed");
        return;
      }

      setCurrentPath(data.root.path);
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

      const res = await fetch(`/api/products/bulk-images/folders?${qs.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });

      const data: FolderListResponse = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as any)?.error || "Folders load failed");
        return;
      }

      setFolders(Array.isArray(data?.folders) ? data.folders : []);
      setBreadcrumbs(Array.isArray(data?.breadcrumbs) ? data.breadcrumbs : []);
    } finally {
      setFolderLoading(false);
    }
  }

  async function loadModalFiles(folderPath: string) {
    setModalLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("parentPath", folderPath);
      qs.set("sortBy", fileSortBy);
      qs.set("sortDir", fileSortDir);

      const res = await fetch(`/api/products/bulk-images/files?${qs.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });

      const data: FileListResponse = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as any)?.error || "Images load failed");
        return;
      }

      setModalFiles(Array.isArray(data?.files) ? data.files : []);
    } finally {
      setModalLoading(false);
    }
  }

  async function openFolderModal(folder: FolderItem) {
    setModalFolder(folder);
    setModalOpen(true);
    setSingleImageFile(null);
    await loadModalFiles(folder.path);
  }

  async function createFolder() {
    if (!newFolderName.trim()) {
      alert("Folder name required hai.");
      return;
    }

    setCreatingFolder(true);
    try {
      const res = await fetch("/api/products/bulk-images/folders", {
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

  async function handleZipUpload() {
    if (!zipFile) {
      alert("Pehle ZIP file select karo.");
      return;
    }

    setUploading(true);
    setUploadResult(null);
    notifyLongTaskStart();

    try {
      const form = new FormData();
      form.append("file", zipFile);
      form.append("mode", uploadMode);
      form.append("parentPath", currentPath);

      const res = await fetch("/api/products/bulk-images/upload", {
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
      setZipFile(null);

      const input = document.getElementById("bulk-images-zip-input") as HTMLInputElement | null;
      if (input) input.value = "";

      await loadFolders(currentPath);
    } finally {
      notifyLongTaskEnd();
      setUploading(false);
    }
  }

  async function handleSingleImageUpload() {
    if (!modalFolder) {
      alert("Folder select nahi hai.");
      return;
    }

    if (!singleImageFile) {
      alert("Pehle image select karo.");
      return;
    }

    setSingleUploading(true);
    try {
      const form = new FormData();
      form.append("folderPath", modalFolder.path);
      form.append("file", singleImageFile);

      const res = await fetch("/api/products/bulk-images/files", {
        method: "PUT",
        credentials: "include",
        body: form,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !(data as any)?.ok) {
        alert((data as any)?.error || "Single image upload failed");
        return;
      }

      setSingleImageFile(null);
      const input = document.getElementById("single-image-upload-input") as HTMLInputElement | null;
      if (input) input.value = "";

      await Promise.all([loadModalFiles(modalFolder.path), loadFolders(currentPath)]);
    } finally {
      setSingleUploading(false);
    }
  }

  async function deleteImage(file: ImageFileItem) {
    const ok = window.confirm(`"${file.fileName}" ko delete karna hai?`);
    if (!ok) return;

    setFileActionLoadingId(file._id);
    try {
      const res = await fetch("/api/products/bulk-images/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "delete", fileId: file._id }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as any)?.error || "Delete failed");
        return;
      }

      if (modalFolder) {
        await loadModalFiles(modalFolder.path);
      }
      await loadFolders(currentPath);
    } finally {
      setFileActionLoadingId("");
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
      const res = await fetch("/api/products/bulk-images/folders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ folderId: folder._id, name: nextName }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !(data as any)?.ok) {
        alert((data as any)?.error || "Rename failed");
        return;
      }

      setRenamingFolderId("");
      setRenameValue("");
      await loadFolders(currentPath);
    } finally {
      setFolderActionLoadingId("");
    }
  }

  async function deleteFolder(folder: FolderItem) {
    const ok = window.confirm(`"${folder.name}" folder ko delete karna hai?`);
    if (!ok) return;

    setFolderActionLoadingId(folder._id);
    try {
      const res = await fetch(
        `/api/products/bulk-images/folders?folderId=${encodeURIComponent(folder._id)}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !(data as any)?.ok) {
        alert((data as any)?.error || "Folder delete failed");
        return;
      }

      if (modalFolder?._id === folder._id) {
        setModalOpen(false);
        setModalFolder(null);
        setModalFiles([]);
      }

      await loadFolders(currentPath);
    } finally {
      setFolderActionLoadingId("");
    }
  }

  async function refreshAll() {
    await loadFolders(currentPath);
    if (modalOpen && modalFolder) {
      await loadModalFiles(modalFolder.path);
    }
  }

  useEffect(() => {
    loadBootstrap();
  }, []);

  useEffect(() => {
    if (!currentPath) return;
    void loadFolders(currentPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath, folderSortBy, folderSortDir]);

  useEffect(() => {
    if (!modalOpen || !modalFolder) return;
    void loadModalFiles(modalFolder.path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileSortBy, fileSortDir]);

  useEffect(() => {
    setProductFolderSearch("");
    setProductFolderPage(1);
  }, [currentPath]);

  useEffect(() => {
    setProductFolderPage(1);
  }, [productFolderSearch, productFolderPageSize]);

  useEffect(() => {
    if (productFolderPage > productFolderTotalPages) {
      setProductFolderPage(productFolderTotalPages);
    }
  }, [productFolderPage, productFolderTotalPages]);

  if (bootLoading) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-slate-700 font-bold">
        Loading product images vault...
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
                Product Images Vault
              </div>

              <h1 className="text-2xl font-extrabold mt-3">Bulk Product Images Upload</h1>
              <p className="text-sm text-slate-600 mt-1">
                Current path: <b>{titlePath || "img-root"}</b>
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href="/admin/products/bulk"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <ArrowLeft size={18} />
                Back
              </Link>

              <Link
                href="/admin/products/bulk/bulk-images/report"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white border border-blue-600 transition font-semibold shadow-sm"
              >
                <BarChart3 size={18} />
                Image Report
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

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
            <div className="space-y-4 min-w-0">
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-sm font-extrabold">Upload Images ZIP</div>

                <label
                  htmlFor="bulk-images-zip-input"
                  className="mt-3 flex min-h-[120px] w-full cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50 px-4 py-6 text-center transition hover:bg-emerald-100"
                >
                  <div>
                    <div className="mx-auto h-12 w-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
                      <Upload size={20} />
                    </div>
                    <div className="mt-3 text-sm font-extrabold text-emerald-800">
                      Click here to select ZIP
                    </div>
                    <div className="mt-1 text-xs text-emerald-700">ZIP format only</div>
                  </div>
                </label>

                <input
                  id="bulk-images-zip-input"
                  type="file"
                  accept=".zip,application/zip"
                  onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                  className="hidden"
                />

                <select
                  value={uploadMode}
                  onChange={(e) => setUploadMode(e.target.value as "append" | "replace")}
                  className="w-full mt-3 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                >
                  <option value="append">Mode: Append Images</option>
                  <option value="replace">Mode: Replace Existing Images</option>
                </select>

                <div className="mt-3 text-xs text-slate-500 leading-5 break-words">
                  Current folder: <b>{currentPath}</b>
                  <br />
                  Selected ZIP: <b>{zipFile?.name || "No file selected"}</b>
                </div>

                {currentPath === "img-root" ? (
                  <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-700">
                    ZIP upload direct <b>img-root</b> me allowed nahi hai. Pehle left side se koi
                    website-created folder open karo, phir uske andar ZIP upload karo.
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={handleZipUpload}
                  disabled={uploading || currentPath === "img-root"}
                  className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-950 text-white transition font-extrabold disabled:opacity-60 shadow-sm"
                >
                  <Upload size={18} />
                  {uploading ? "Uploading..." : "Upload ZIP"}
                </button>

                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                  ZIP structure aise rakho:
                  <br />
                  <b>SKU1/image1.jpg</b>
                  <br />
                  <b>SKU1/image2.png</b>
                  <br />
                  <b>SKU2/image1.webp</b>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <BarChart3 size={20} />
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-blue-900">
                      Category-wise Missing Images Report
                    </div>
                    <div className="text-xs text-blue-800 mt-2 leading-5">
                      Category ke hisab se total products, image-attached products aur missing image
                      products dekhne ke liye report page use karo. Missing image SKUs ko Excel me
                      download bhi kar sakte ho.
                    </div>

                    <Link
                      href="/admin/products/bulk/bulk-images/report"
                      className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-extrabold shadow-sm"
                    >
                      <BarChart3 size={16} />
                      Open Image Report
                    </Link>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm font-extrabold text-slate-900">
                      Website Created Folders
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
                ) : manualFolders.length === 0 ? (
                  <div className="p-6 text-slate-600 font-bold">
                    No website created folders found.
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {manualFolders.map((folder) => {
                      const isBusy = folderActionLoadingId === folder._id;
                      const isRenaming = renamingFolderId === folder._id;

                      return (
                        <div
                          key={folder._id}
                          className="w-full px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
                        >
                          <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 items-start">
                            <div className="h-11 w-11 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
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
                                    onClick={() => renameFolder(folder)}
                                    disabled={isBusy}
                                    className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold disabled:opacity-60 shadow-sm"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
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
                                  onClick={() => setCurrentPath(folder.path)}
                                  className="w-full text-left min-w-0"
                                >
                                  <div className="font-extrabold text-slate-800 text-[15px] leading-snug break-words">
                                    {folder.name}
                                  </div>
                                  <div className="text-xs text-slate-500 mt-0.5 break-all">
                                    {folder.path}
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-1">
                                    Updated: {formatDate(folder.updatedAt)}
                                  </div>
                                </button>
                              )}

                              {!isRenaming ? (
                                <div className="mt-3 flex items-center gap-2 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => {
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
                                    onClick={() => deleteFolder(folder)}
                                    disabled={isBusy}
                                    title="Delete Folder"
                                    className="p-2.5 rounded-xl bg-white hover:bg-rose-50 hover:text-rose-600 border border-slate-200 text-slate-500 transition-colors shadow-sm"
                                  >
                                    <Trash2 size={16} />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setCurrentPath(folder.path)}
                                    className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold transition-colors shadow-sm ml-1"
                                  >
                                    Open <ChevronRight size={16} />
                                  </button>
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

              {uploadResult ? (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                  <div className="text-sm font-extrabold text-indigo-900">Last Upload Result</div>
                  <div className="text-xs text-indigo-800 mt-2 leading-6">
                    Total SKU Folders:{" "}
                    <b>{Number(uploadResult.summary?.totalSkuFoldersInZip || 0)}</b> | Updated:{" "}
                    <b>{Number(uploadResult.summary?.updated || 0)}</b> | SKU Not Found:{" "}
                    <b>{Number(uploadResult.summary?.skuNotFound || 0)}</b> | Failed:{" "}
                    <b>{Number(uploadResult.summary?.failed || 0)}</b>
                  </div>

                  {Array.isArray(uploadResult.items) && uploadResult.items.length ? (
                    <div className="mt-3 space-y-2 max-h-[340px] overflow-auto pr-1">
                      {uploadResult.items.map((row, idx) => (
                        <div
                          key={`${row.sku || "row"}-${idx}`}
                          className="rounded-xl border border-indigo-100 bg-white px-3 py-2 text-xs"
                        >
                          <div className="font-bold text-slate-800 break-all">
                            {row.sku || "-"}
                          </div>
                          <div className="mt-1 text-slate-600">
                            Status: <b>{row.status || "-"}</b>
                            {typeof row.uploaded === "number" ? (
                              <>
                                {" "}
                                | Uploaded: <b>{row.uploaded}</b>
                              </>
                            ) : null}
                            {typeof row.totalNow === "number" ? (
                              <>
                                {" "}
                                | Total Now: <b>{row.totalNow}</b>
                              </>
                            ) : null}
                            {typeof row.skipped === "number" ? (
                              <>
                                {" "}
                                | Skipped: <b>{row.skipped}</b>
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
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm font-extrabold">Create Folder</div>

                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  <input
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="flex-1 min-w-[220px] px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                    placeholder="Folder name"
                  />

                  <button
                    type="button"
                    onClick={createFolder}
                    disabled={creatingFolder}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-950 text-white transition font-extrabold disabled:opacity-60 shadow-sm"
                  >
                    <FolderPlus size={18} />
                    {creatingFolder ? "Creating..." : "Create Folder"}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm min-w-0">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">
                      ZIP Uploaded Product Folders
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Selected website folder ke andar uploaded product image folders
                    </div>
                    <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800 break-all">
                      Current selected folder: <span>{currentPath}</span>
                    </div>
                  </div>

                  <div className="text-xs font-bold text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-200">
                    Total: {filteredUploadedProductFolders.length}
                  </div>
                </div>

                <div className="px-4 py-4 border-b border-gray-100 bg-white">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[240px]">
                      <Search
                        size={18}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        value={productFolderSearch}
                        onChange={(e) => setProductFolderSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white outline-none focus:border-blue-500 transition text-sm font-medium"
                        placeholder="Search product folders by SKU, folder name, path..."
                      />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={String(productFolderPageSize)}
                        onChange={(e) => setProductFolderPageSize(Number(e.target.value))}
                        className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold outline-none"
                      >
                        <option value="12">12 / page</option>
                        <option value="24">24 / page</option>
                        <option value="48">48 / page</option>
                        <option value="96">96 / page</option>
                      </select>

                      {productFolderSearch ? (
                        <button
                          type="button"
                          onClick={() => setProductFolderSearch("")}
                          className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700"
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                {folderLoading ? (
                  <div className="p-6 text-slate-600 font-bold">Loading product folders...</div>
                ) : filteredUploadedProductFolders.length === 0 ? (
                  <div className="p-6 text-slate-600 font-bold">
                    {productFolderSearch
                      ? "No matching product folders found."
                      : "No uploaded product image folders found in this location."}
                  </div>
                ) : (
                  <>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {pagedUploadedProductFolders.map((folder) => {
                        const isBusy = folderActionLoadingId === folder._id;

                        return (
                          <div
                            key={folder._id}
                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                          >
                            <button
                              type="button"
                              onClick={() => openFolderModal(folder)}
                              className="w-full text-left"
                            >
                              <div className="flex items-start gap-3">
                                <div className="h-11 w-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                  <ImageIcon size={20} />
                                </div>

                                <div className="min-w-0">
                                  <div className="font-extrabold text-slate-800 break-words">
                                    {folder.name}
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1 break-all">
                                    {folder.path}
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-1">
                                    Updated: {formatDate(folder.updatedAt)}
                                  </div>
                                </div>
                              </div>
                            </button>

                            <div className="mt-3 flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => openFolderModal(folder)}
                                className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-bold transition-colors shadow-sm"
                              >
                                Open Images
                              </button>

                              <button
                                type="button"
                                onClick={() => deleteFolder(folder)}
                                disabled={isBusy}
                                className="p-2.5 rounded-xl bg-white hover:bg-rose-50 hover:text-rose-600 border border-slate-200 text-slate-500 transition-colors shadow-sm"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="px-4 py-4 border-t border-gray-200 bg-white">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="text-sm text-slate-600 font-semibold">
                          Showing <b>{productFolderStartItem}</b> to <b>{productFolderEndItem}</b>{" "}
                          of <b>{filteredUploadedProductFolders.length}</b> product folders
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setProductFolderPage((p) => Math.max(1, p - 1))}
                            disabled={productFolderPage <= 1}
                            className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-gray-50 text-sm font-bold disabled:opacity-50"
                          >
                            Previous
                          </button>

                          {Array.from({ length: productFolderTotalPages }, (_, i) => i + 1)
                            .filter((p) => {
                              if (productFolderTotalPages <= 7) return true;
                              if (p === 1 || p === productFolderTotalPages) return true;
                              return Math.abs(p - productFolderPage) <= 1;
                            })
                            .map((p, idx, arr) => {
                              const prev = arr[idx - 1];
                              const showGap = idx > 0 && prev && p - prev > 1;

                              return (
                                <div key={`pf-page-wrap-${p}`} className="flex items-center gap-2">
                                  {showGap ? <span className="text-slate-400 px-1">...</span> : null}
                                  <button
                                    type="button"
                                    onClick={() => setProductFolderPage(p)}
                                    className={`min-w-[42px] px-3 py-2 rounded-xl text-sm font-bold border ${
                                      p === productFolderPage
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
                            onClick={() =>
                              setProductFolderPage((p) =>
                                Math.min(productFolderTotalPages, p + 1)
                              )
                            }
                            disabled={productFolderPage >= productFolderTotalPages}
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

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="font-extrabold text-slate-900">Important Notes</div>
                <ul className="mt-2 space-y-1 list-disc pl-5">
                  <li>Website created folders left side me rahenge.</li>
                  <li>ZIP se bane product folders right side me show honge.</li>
                  <li>Product images public hi rahengi, private nahi hongi.</li>
                  <li>Har SKU/product ke liye max 8 images rahengi.</li>
                  <li>Same product ka second active ZIP-folder kisi aur jagah allowed nahi hai.</li>
                  <li>Thumbnail overwrite tabhi hota hai jab thumbnail empty ho.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {modalOpen && modalFolder ? (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-extrabold text-slate-900">{modalFolder.name}</div>
                <div className="text-sm text-slate-500 mt-1 break-all">{modalFolder.path}</div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setModalFolder(null);
                  setModalFiles([]);
                  setSingleImageFile(null);
                }}
                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-auto max-h-[calc(90vh-82px)]">
              <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={fileSortBy}
                    onChange={(e) => setFileSortBy(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold outline-none"
                  >
                    <option value="uploadedAt">By Uploaded Date</option>
                    <option value="name">By Name</option>
                    <option value="productExists">By Product Exists</option>
                  </select>

                  <select
                    value={fileSortDir}
                    onChange={(e) => setFileSortDir(e.target.value as "asc" | "desc")}
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold outline-none"
                  >
                    <option value="asc">Asc</option>
                    <option value="desc">Desc</option>
                  </select>

                  <div className="text-xs font-bold text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-200">
                    Total: {modalFiles.length}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <label
                    htmlFor="single-image-upload-input"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-sm font-bold shadow-sm cursor-pointer"
                  >
                    <Upload size={16} />
                    Select Image
                  </label>

                  <input
                    id="single-image-upload-input"
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => setSingleImageFile(e.target.files?.[0] || null)}
                  />

                  <button
                    type="button"
                    onClick={handleSingleImageUpload}
                    disabled={singleUploading || !singleImageFile}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white text-sm font-bold shadow-sm disabled:opacity-60"
                  >
                    <Upload size={16} />
                    {singleUploading ? "Uploading..." : "Upload Image"}
                  </button>
                </div>
              </div>

              {singleImageFile ? (
                <div className="mb-4 text-sm text-slate-600">
                  Selected: <b>{singleImageFile.name}</b>
                </div>
              ) : null}

              {modalLoading ? (
                <div className="p-6 text-slate-600 font-bold">Loading images...</div>
              ) : modalFiles.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-slate-500 font-bold">
                  No images found in this folder.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {modalFiles.map((file) => {
                    const isBusy = fileActionLoadingId === file._id;

                    return (
                      <div
                        key={file._id}
                        className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm"
                      >
                        <div className="aspect-square bg-slate-100 relative">
                          {file.publicUrl ? (
                            <img
                              src={file.publicUrl}
                              alt={file.fileName}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <ImageIcon size={28} />
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => deleteImage(file)}
                            disabled={isBusy}
                            className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white/95 border border-rose-200 text-rose-700 flex items-center justify-center shadow-sm disabled:opacity-60"
                            title="Delete image"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div className="p-3">
                          <div
                            className={`text-xs font-extrabold break-words ${
                              file.productExists ? "text-emerald-700" : "text-red-700"
                            }`}
                            style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
                          >
                            {file.fileName}
                          </div>

                          <div className="text-[11px] text-slate-500 mt-1 break-all">
                            SKU: <b>{file.productSku || file.skuNormalized || "-"}</b>
                          </div>

                          <div className="text-[11px] text-slate-500 mt-1">
                            Size: <b>{formatBytes(Number(file.sizeBytes || 0))}</b>
                          </div>

                          <div className="text-[11px] text-slate-500 mt-1">
                            Uploaded: <b>{formatDate(file.uploadedAt)}</b>
                          </div>

                          <div className="mt-3 flex items-center gap-2">
                            <a
                              href={file.publicUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-xs font-bold shadow-sm"
                            >
                              View
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}