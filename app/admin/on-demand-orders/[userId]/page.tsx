"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  RefreshCcw,
  User2,
  Mail,
  Phone,
  CalendarDays,
  Upload,
  ExternalLink,
  Folder,
  ChevronRight,
  X,
  RefreshCw,
  FileText,
  CheckCircle2,
  Star,
  Trash2,
  Loader2,
} from "lucide-react";

type ItemRow = {
  lineId: string;
  orderMongoId?: string;
  orderId?: string;
  orderDate?: string | null;
  productId: string;
  sku: string;
  title: string;
  slug: string;
  category: string;
  price: number;
};

type ApiResponse = {
  ok: boolean;
  user: {
    _id: string;
    name: string;
    email: string;
    phone: string;
    joinedAt?: string | null;
    daysOld?: number;
  };
  summary: {
    totalPurchasedProducts: number;
    totalOnDemandProducts: number;
    purchasedCourseCodes: string[];
  };
  items: ItemRow[];
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
};

type FolderListResponse = {
  ok?: boolean;
  parent?: { _id: string; name: string; path: string; level: number };
  breadcrumbs?: Array<{ name: string; path: string }>;
  folders?: FolderItem[];
  error?: string;
};

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
  error?: string;
};

type FolderShortcut = {
  name: string;
  path: string;
} | null;

const SHORTCUTS_STORAGE_KEY = "on_demand_upload_folder_shortcuts_v1";

function formatDateTime(x?: string | null) {
  if (!x) return "-";
  try {
    return new Date(x).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(x);
  }
}

function money(n: number) {
  try {
    return new Intl.NumberFormat("en-IN").format(Number(n || 0));
  } catch {
    return String(n);
  }
}

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function categoryToPublicPath(category: string, slug: string) {
  const c = String(category || "").trim().toLowerCase();

  if (c === "solved assignments") return `/solved-assignments/${slug}`;
  if (c === "handwritten pdfs") return `/handwritten-pdfs/${slug}`;
  if (c === "handwritten hardcopy (delivery)") return `/handwritten-hardcopy/${slug}`;
  if (c === "question papers (pyq)") return `/question-papers/${slug}`;
  if (c === "guess papers") return `/guess-papers/${slug}`;
  if (c === "ebooks/notes") return `/ebooks/${slug}`;
  if (c === "projects & synopsis") return `/projects/${slug}`;
  if (c === "combo") return `/combo/${slug}`;

  return `/products/${slug}`;
}

function getPathLabel(path: string) {
  const clean = safeStr(path);
  if (!clean) return "root";
  const parts = clean.split("/").filter(Boolean);
  return parts[parts.length - 1] || clean;
}

function readShortcutsFromStorage(): { shortcut1: FolderShortcut; shortcut2: FolderShortcut } {
  if (typeof window === "undefined") {
    return { shortcut1: null, shortcut2: null };
  }

  try {
    const raw = window.localStorage.getItem(SHORTCUTS_STORAGE_KEY);
    if (!raw) return { shortcut1: null, shortcut2: null };

    const parsed = JSON.parse(raw);
    return {
      shortcut1:
        parsed?.shortcut1 && safeStr(parsed.shortcut1.path)
          ? {
              name: safeStr(parsed.shortcut1.name) || getPathLabel(parsed.shortcut1.path),
              path: safeStr(parsed.shortcut1.path),
            }
          : null,
      shortcut2:
        parsed?.shortcut2 && safeStr(parsed.shortcut2.path)
          ? {
              name: safeStr(parsed.shortcut2.name) || getPathLabel(parsed.shortcut2.path),
              path: safeStr(parsed.shortcut2.path),
            }
          : null,
    };
  } catch {
    return { shortcut1: null, shortcut2: null };
  }
}

function writeShortcutsToStorage(shortcut1: FolderShortcut, shortcut2: FolderShortcut) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    SHORTCUTS_STORAGE_KEY,
    JSON.stringify({
      shortcut1,
      shortcut2,
    })
  );
}

export default function AdminOnDemandOrderDetailPage() {
  const params = useParams<{ userId: string }>();
  const userId = String(params?.userId || "");

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [deletingLineId, setDeletingLineId] = useState("");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemRow | null>(null);

  const [currentPath, setCurrentPath] = useState("root");
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ name: string; path: string }>>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [conflictMode, setConflictMode] = useState<"ignore" | "replace">("replace");

  const [shortcut1, setShortcut1] = useState<FolderShortcut>(null);
  const [shortcut2, setShortcut2] = useState<FolderShortcut>(null);

  async function load() {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/on-demand-orders/${userId}`, {
        credentials: "include",
        cache: "no-store",
      });

      const json: ApiResponse = await res.json();
      if (!res.ok) {
        alert((json as any)?.error || "Failed to load");
        setData(null);
        return;
      }

      setData(json);
    } catch {
      alert("Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadFolders(path = "root") {
    setFoldersLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("parentPath", path);

      const res = await fetch(`/api/admin/on-demand-orders/folders?${qs.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });

      const json: FolderListResponse = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert((json as any)?.error || "Failed to load folders");
        return;
      }

      setCurrentPath(path);
      setFolders(Array.isArray(json?.folders) ? json.folders : []);
      setBreadcrumbs(Array.isArray(json?.breadcrumbs) ? json.breadcrumbs : []);
    } catch {
      alert("Failed to load folders");
    } finally {
      setFoldersLoading(false);
    }
  }

  function refreshShortcutsFromStorage() {
    const next = readShortcutsFromStorage();
    setShortcut1(next.shortcut1);
    setShortcut2(next.shortcut2);
  }

  function saveShortcut(slot: 1 | 2) {
    const folderName = breadcrumbs[breadcrumbs.length - 1]?.name || getPathLabel(currentPath);
    const value: FolderShortcut = {
      name: folderName,
      path: currentPath || "root",
    };

    const nextShortcut1 = slot === 1 ? value : shortcut1;
    const nextShortcut2 = slot === 2 ? value : shortcut2;

    setShortcut1(nextShortcut1);
    setShortcut2(nextShortcut2);
    writeShortcutsToStorage(nextShortcut1, nextShortcut2);

    alert(`Current folder successfully Shortcut ${slot} me save ho gaya.`);
  }

  function clearShortcut(slot: 1 | 2) {
    const nextShortcut1 = slot === 1 ? null : shortcut1;
    const nextShortcut2 = slot === 2 ? null : shortcut2;

    setShortcut1(nextShortcut1);
    setShortcut2(nextShortcut2);
    writeShortcutsToStorage(nextShortcut1, nextShortcut2);
  }

  async function openShortcut(shortcut: FolderShortcut) {
    if (!shortcut?.path) {
      alert("Shortcut empty hai.");
      return;
    }
    await loadFolders(shortcut.path);
  }

  async function openUploadModal(item: ItemRow) {
    setSelectedItem(item);
    setUploadFile(null);
    setConflictMode("replace");
    setCurrentPath("root");
    setFolders([]);
    setBreadcrumbs([{ name: "root", path: "root" }]);
    refreshShortcutsFromStorage();
    setUploadOpen(true);
    await loadFolders("root");
  }

  async function handleDeleteSingleItem(item: ItemRow) {
    const lineId = safeStr(item?.lineId);
    if (!lineId) {
      alert("Delete reference missing hai. Please refresh page.");
      return;
    }

    const ok = window.confirm(
      `Kya aap sirf is selected on-demand order ko delete karna chahte hain?\n\nProduct: ${safeStr(
        item.title
      )}\nOrder: ${safeStr(item.orderId || "-")}\n\nIs action se is customer ke baki on-demand orders delete nahi honge.`
    );

    if (!ok) return;

    try {
      setDeletingLineId(lineId);

      const qs = new URLSearchParams();
      qs.set("lineId", lineId);

      const res = await fetch(`/api/admin/on-demand-orders/${userId}?${qs.toString()}`, {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert((json as any)?.error || "Delete failed");
        return;
      }

      if (selectedItem?.lineId === lineId) {
        setSelectedItem(null);
        setUploadOpen(false);
        setUploadFile(null);
      }

      await load();

      alert("Selected on-demand order successfully delete ho gaya.");
    } catch {
      alert("Delete failed");
    } finally {
      setDeletingLineId("");
    }
  }

  async function handleDirectVaultUpload() {
    if (!selectedItem) {
      alert("No product selected.");
      return;
    }

    if (!safeStr(selectedItem.sku)) {
      alert("Is product ka SKU missing hai. Pehle product SKU check karo.");
      return;
    }

    if (!uploadFile) {
      alert("Pehle PDF file select karo.");
      return;
    }

    if (uploadFile.type && uploadFile.type !== "application/pdf") {
      alert("Sirf PDF file allowed hai.");
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("parentPath", currentPath || "root");
      form.append("conflictMode", conflictMode);
      form.append("productSku", safeStr(selectedItem.sku));
      form.append("files", uploadFile);

      const res = await fetch("/api/admin/on-demand-orders/upload", {
        method: "POST",
        credentials: "include",
        body: form,
      });

      const json: UploadResponse = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        alert((json as any)?.error || "Upload failed");
        return;
      }

      const firstRow = Array.isArray(json?.results) ? json.results[0] : null;
      const matched = Boolean(
        firstRow?.productMatched || Number(json?.summary?.matchedProducts || 0) > 0
      );

      await load();
      await loadFolders(currentPath || "root");

      setUploadOpen(false);
      setSelectedItem(null);
      setUploadFile(null);

      if (matched) {
        alert("PDF successfully upload ho gayi. Product link ho gaya aur on-demand list refresh bhi ho gayi.");
      } else {
        alert("PDF upload ho gayi, lekin product auto-match confirm nahi hua. SKU ek baar check kar lo.");
      }
    } catch {
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    refreshShortcutsFromStorage();
  }, []);

  const userPriorityLabel = useMemo(() => {
    const days = Number(data?.user?.daysOld || 0);
    if (days <= 7) return "Very New User";
    if (days <= 30) return "New User";
    if (days <= 180) return "Regular User";
    return "Old Customer";
  }, [data]);

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div className="max-w-[1700px] mx-auto px-4 py-4">
        <div className="rounded-[28px] bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-6 border-b border-gray-200 bg-gradient-to-r from-white to-slate-50">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 shadow-sm">
                  <User2 size={28} />
                </div>
                <div>
                  <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight">
                    On Demand User Details
                  </h1>
                  <p className="mt-2 text-sm md:text-xl text-slate-600">
                    Direct folder select + product PDF upload + single order delete
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href="/admin/on-demand-orders"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold shadow-sm"
                >
                  <ArrowLeft size={18} />
                  Back
                </Link>

                <button
                  onClick={load}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold shadow-sm"
                >
                  <RefreshCcw size={18} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="rounded-3xl border border-gray-200 bg-gray-50 p-8 text-slate-600 font-semibold">
                Loading user details...
              </div>
            ) : !data ? (
              <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
                <div className="text-2xl font-extrabold text-slate-900">No data found</div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-5 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="text-xl font-extrabold text-slate-900">
                      {data.user.name}
                    </div>

                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex items-center gap-3 text-slate-700 font-semibold">
                        <Mail size={16} className="text-blue-700" />
                        <span>{data.user.email}</span>
                      </div>

                      <div className="flex items-center gap-3 text-slate-700 font-semibold">
                        <Phone size={16} className="text-emerald-700" />
                        <span>{data.user.phone}</span>
                      </div>

                      <div className="flex items-center gap-3 text-slate-700 font-semibold">
                        <CalendarDays size={16} className="text-amber-700" />
                        <span>Joined: {formatDateTime(data.user.joinedAt)}</span>
                      </div>
                    </div>

                    <div className="mt-5 inline-flex items-center rounded-2xl bg-blue-50 border border-blue-100 px-4 py-2 text-sm font-extrabold text-blue-800">
                      Priority Hint: {userPriorityLabel}
                    </div>
                  </div>

                  <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                      <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">
                        Total Purchased Products
                      </div>
                      <div className="mt-3 text-4xl font-extrabold text-slate-900">
                        {data.summary.totalPurchasedProducts}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-amber-500 bg-amber-500 p-5 shadow-sm">
                      <div className="text-[11px] uppercase tracking-wide font-extrabold text-amber-100">
                        Total On Demand Products
                      </div>
                      <div className="mt-3 text-4xl font-extrabold text-white">
                        {data.summary.totalOnDemandProducts}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-blue-600 bg-blue-600 p-5 shadow-sm">
                      <div className="text-[11px] uppercase tracking-wide font-extrabold text-blue-100">
                        Customer Age
                      </div>
                      <div className="mt-3 text-4xl font-extrabold text-white">
                        {Number(data.user.daysOld || 0)}
                      </div>
                      <div className="mt-1 text-sm font-bold text-blue-100">
                        days
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-lg font-extrabold text-slate-900">
                    Purchased Course Hints
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Array.isArray(data.summary.purchasedCourseCodes) &&
                    data.summary.purchasedCourseCodes.length > 0 ? (
                      data.summary.purchasedCourseCodes.map((code) => (
                        <span
                          key={code}
                          className="inline-flex rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm font-extrabold text-slate-700"
                        >
                          {code}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500 font-semibold">
                        No course code hints found.
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-6 overflow-x-auto rounded-3xl border border-gray-200">
                  <table className="min-w-full">
                    <thead className="bg-slate-50">
                      <tr className="text-left">
                        <th className="px-5 py-4 text-lg font-extrabold text-slate-900">#</th>
                        <th className="px-5 py-4 text-lg font-extrabold text-slate-900">Order Ref</th>
                        <th className="px-5 py-4 text-lg font-extrabold text-slate-900">Product</th>
                        <th className="px-5 py-4 text-lg font-extrabold text-slate-900">SKU</th>
                        <th className="px-5 py-4 text-lg font-extrabold text-slate-900">Price</th>
                        <th className="px-5 py-4 text-lg font-extrabold text-slate-900">Latest</th>
                        <th className="px-5 py-4 text-lg font-extrabold text-slate-900">Actions</th>
                      </tr>
                    </thead>

                    <tbody className="bg-white">
                      {data.items.map((item, idx) => {
                        const deleting = deletingLineId === safeStr(item.lineId);

                        return (
                          <tr key={safeStr(item.lineId) || `${item.productId}-${idx}`} className="border-t border-gray-200 align-top">
                            <td className="px-5 py-5 text-lg font-bold text-slate-800">
                              {idx + 1}
                            </td>

                            <td className="px-5 py-5 min-w-[180px]">
                              <div className="text-[14px] font-extrabold text-slate-900 break-all">
                                {safeStr(item.orderId) || "-"}
                              </div>
                            </td>

                            <td className="px-5 py-5 min-w-[320px]">
                              <div className="text-[16px] font-extrabold text-slate-900">
                                {item.title}
                              </div>
                              <div className="mt-1 text-sm text-slate-500">
                                {item.category}
                              </div>
                            </td>

                            <td className="px-5 py-5 text-[15px] font-mono font-bold text-rose-600 min-w-[180px]">
                              {item.sku || "-"}
                            </td>

                            <td className="px-5 py-5 text-[16px] font-bold text-slate-800">
                              ₹{money(item.price)}
                            </td>

                            <td className="px-5 py-5 text-[15px] font-bold text-slate-700 min-w-[200px]">
                              {formatDateTime(item.orderDate)}
                            </td>

                            <td className="px-5 py-5 min-w-[420px]">
                              <div className="flex items-center gap-3 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => openUploadModal(item)}
                                  className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white transition font-bold shadow-sm"
                                >
                                  <Upload size={17} />
                                  Upload PDF
                                </button>

                                <Link
                                  href={categoryToPublicPath(item.category, item.slug)}
                                  target="_blank"
                                  className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold shadow-sm"
                                >
                                  <ExternalLink size={17} />
                                  Open
                                </Link>

                                <button
                                  type="button"
                                  disabled={deleting}
                                  onClick={() => handleDeleteSingleItem(item)}
                                  className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-red-50 border border-red-200 text-red-700 transition font-bold shadow-sm disabled:opacity-60"
                                >
                                  {deleting ? (
                                    <Loader2 size={17} className="animate-spin" />
                                  ) : (
                                    <Trash2 size={17} />
                                  )}
                                  {deleting ? "Deleting..." : "Delete This Order"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 text-sm text-slate-500">
                  Is page se ab har selected on-demand row ko alag se delete kiya ja sakta hai. Bulk delete ab bhi main list page par available rahega.
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {uploadOpen && selectedItem ? (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (!uploading) {
                setUploadOpen(false);
                setSelectedItem(null);
                setUploadFile(null);
              }
            }}
          />
          <div className="relative w-full max-w-5xl rounded-3xl bg-white border border-gray-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-5 border-b border-gray-200 flex items-start justify-between gap-4">
              <div>
                <div className="text-xl font-extrabold text-slate-900">
                  On-Demand PDF Upload
                </div>
                <div className="text-sm text-slate-600 mt-1">
                  Yahan se direct folder select karke PDF upload karo. Kisi extra vault security access ki zarurat nahi hai.
                </div>
              </div>

              <button
                type="button"
                disabled={uploading}
                onClick={() => {
                  setUploadOpen(false);
                  setSelectedItem(null);
                  setUploadFile(null);
                }}
                className="h-11 w-11 rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm font-extrabold text-amber-900">
                  Selected Product
                </div>
                <div className="mt-2 text-lg font-extrabold text-slate-900">
                  {selectedItem.title}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="inline-flex rounded-xl bg-white border border-amber-200 px-3 py-2 text-sm font-extrabold text-amber-900">
                    SKU: {safeStr(selectedItem.sku) || "-"}
                  </span>
                  <span className="inline-flex rounded-xl bg-white border border-amber-200 px-3 py-2 text-sm font-bold text-slate-700">
                    Category: {safeStr(selectedItem.category) || "-"}
                  </span>
                  <span className="inline-flex rounded-xl bg-white border border-amber-200 px-3 py-2 text-sm font-bold text-slate-700">
                    Order: {safeStr(selectedItem.orderId) || "-"}
                  </span>
                </div>
                <div className="mt-3 text-sm font-semibold text-amber-800 leading-6">
                  Upload ke time final filename automatically <b>{safeStr(selectedItem.sku) || "SKU"}.pdf</b> set hoga.
                </div>
              </div>

              <div className="mt-5 rounded-3xl border border-yellow-200 bg-yellow-50 p-4">
                <div className="flex items-center gap-2 text-sm font-extrabold text-yellow-900">
                  <Star size={16} />
                  Folder Shortcuts
                </div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-yellow-200 bg-white p-4">
                    <div className="text-xs uppercase tracking-wide font-extrabold text-yellow-700">
                      Shortcut 1
                    </div>
                    <div className="mt-2 text-sm font-bold text-slate-900 break-all">
                      {shortcut1?.path ? shortcut1.path : "Not set"}
                    </div>
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => saveShortcut(1)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold shadow-sm"
                      >
                        <Star size={14} />
                        Set Current
                      </button>
                      <button
                        type="button"
                        onClick={() => openShortcut(shortcut1)}
                        disabled={!shortcut1?.path}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-sm font-bold shadow-sm disabled:opacity-50"
                      >
                        <Folder size={14} />
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => clearShortcut(1)}
                        disabled={!shortcut1?.path}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-sm font-bold shadow-sm disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-yellow-200 bg-white p-4">
                    <div className="text-xs uppercase tracking-wide font-extrabold text-yellow-700">
                      Shortcut 2
                    </div>
                    <div className="mt-2 text-sm font-bold text-slate-900 break-all">
                      {shortcut2?.path ? shortcut2.path : "Not set"}
                    </div>
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => saveShortcut(2)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold shadow-sm"
                      >
                        <Star size={14} />
                        Set Current
                      </button>
                      <button
                        type="button"
                        onClick={() => openShortcut(shortcut2)}
                        disabled={!shortcut2?.path}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-sm font-bold shadow-sm disabled:opacity-50"
                      >
                        <Folder size={14} />
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => clearShortcut(2)}
                        disabled={!shortcut2?.path}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-sm font-bold shadow-sm disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                        Clear
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-yellow-800 font-semibold leading-5">
                  Current selected folder ko aap Shortcut 1 ya Shortcut 2 me save kar sakte ho. Ye shortcuts isi browser me remembered rahenge.
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-5">
                <div className="rounded-3xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                  <div className="px-4 py-4 border-b border-gray-200 bg-slate-50">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-lg font-extrabold text-slate-900">
                        Select Upload Folder
                      </div>

                      <button
                        type="button"
                        onClick={() => loadFolders(currentPath || "root")}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold shadow-sm"
                      >
                        <RefreshCw size={16} />
                        Refresh
                      </button>
                    </div>

                    <div className="mt-3 flex items-center gap-2 flex-wrap text-sm font-bold text-slate-600">
                      {breadcrumbs.map((item, idx) => (
                        <button
                          key={item.path}
                          type="button"
                          onClick={() => loadFolders(item.path)}
                          className="inline-flex items-center gap-2 hover:text-blue-700 transition-colors"
                        >
                          <span>{item.name}</span>
                          {idx !== breadcrumbs.length - 1 ? <ChevronRight size={14} /> : null}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                      <div className="text-xs uppercase tracking-wide font-extrabold text-blue-700">
                        Selected Final Folder
                      </div>
                      <div className="mt-1 text-base font-extrabold text-blue-900 break-all">
                        {currentPath || "root"}
                      </div>
                    </div>

                    {foldersLoading ? (
                      <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-5 text-slate-600 font-bold">
                        Loading folders...
                      </div>
                    ) : folders.length === 0 ? (
                      <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5 text-slate-600 font-semibold">
                        Is folder ke andar abhi koi sub-folder nahi hai. Aap isi current folder me direct upload kar sakte ho.
                      </div>
                    ) : (
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {folders.map((folder) => (
                          <button
                            key={folder._id}
                            type="button"
                            onClick={() => loadFolders(folder.path)}
                            className="text-left rounded-2xl border border-gray-200 bg-white hover:bg-slate-50 p-4 transition shadow-sm"
                          >
                            <div className="flex items-start gap-3">
                              <div className="h-11 w-11 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                                <Folder size={18} />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-extrabold text-slate-900 break-words">
                                  {folder.name}
                                </div>
                                <div className="mt-1 text-xs text-slate-500 break-all">
                                  {folder.path}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-lg font-extrabold text-slate-900">
                    Upload PDF
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-600 leading-6">
                    Is upload flow me download ya folder download ka koi option nahi hai. Ye sirf on-demand delivery ke liye hai.
                  </div>

                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="text-xs uppercase tracking-wide font-extrabold text-emerald-700">
                      Final Upload Filename
                    </div>
                    <div className="mt-1 text-lg font-extrabold text-emerald-900 break-all">
                      {safeStr(selectedItem.sku) || "SKU"}.pdf
                    </div>
                  </div>

                  <div className="mt-4">
                    <label
                      htmlFor="direct-on-demand-upload"
                      className="flex min-h-[160px] w-full cursor-pointer items-center justify-center rounded-3xl border-2 border-dashed border-amber-300 bg-amber-50 px-4 py-6 text-center hover:bg-amber-100 transition"
                    >
                      <div>
                        <div className="mx-auto h-14 w-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center">
                          <Upload size={22} />
                        </div>
                        <div className="mt-3 text-base font-extrabold text-amber-900">
                          Click here to select PDF
                        </div>
                        <div className="mt-1 text-sm font-semibold text-amber-800">
                          Original file name kuchh bhi ho sakta hai
                        </div>
                      </div>
                    </label>

                    <input
                      id="direct-on-demand-upload"
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setUploadFile(file);
                      }}
                    />
                  </div>

                  {uploadFile ? (
                    <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-white border border-gray-200 flex items-center justify-center shrink-0">
                          <FileText size={18} className="text-slate-700" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-slate-900 break-all">
                            Original File: {uploadFile.name}
                          </div>
                          <div className="mt-1 text-xs font-semibold text-slate-600 break-all">
                            Final File Name: {safeStr(selectedItem.sku) || "SKU"}.pdf
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4">
                    <label className="text-sm font-extrabold text-slate-800">
                      Duplicate Handling
                    </label>
                    <select
                      value={conflictMode}
                      onChange={(e) => setConflictMode(e.target.value as "ignore" | "replace")}
                      className="w-full mt-2 px-4 py-3 rounded-2xl border border-gray-200 bg-white outline-none"
                    >
                      <option value="replace">Replace old PDF with new PDF</option>
                      <option value="ignore">Ignore if same SKU already exists</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleDirectVaultUpload}
                    disabled={uploading}
                    className="w-full mt-5 inline-flex items-center justify-center gap-2 px-5 py-4 rounded-2xl bg-slate-900 hover:bg-slate-950 text-white transition font-extrabold shadow-sm disabled:opacity-60"
                  >
                    {uploading ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={18} />
                    )}
                    {uploading ? "Uploading..." : "Upload PDF"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}