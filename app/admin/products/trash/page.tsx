"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCcw,
  RotateCcw,
  Trash2,
  AlertTriangle,
  LoaderCircle,
  X,
} from "lucide-react";

type Product = {
  _id: string;
  title: string;
  sku: string;
  slug: string;
  category: string;
  subjectCode: string;
  session: string;
  language: string;
  price: number;
  isActive: boolean;
  deletedAt?: string | null;
};

type ProductsTrashApiResponse = {
  ok?: boolean;
  error?: string;
  products?: Product[];
};

export default function AdminProductsTrashPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>("");
  const [lastError, setLastError] = useState<string>("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  async function load() {
    setLastError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/products?trash=1&limit=200", {
        credentials: "include",
        cache: "no-store",
      });
      const data: ProductsTrashApiResponse = await res.json().catch(() => ({}));

      if (!res.ok) {
        setLastError(data?.error || "Failed to load trash");
        return;
      }

      setItems(Array.isArray(data?.products) ? data.products : []);
    } catch (e: any) {
      setLastError(e?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  async function restore(id: string) {
    const ok = window.confirm("Restore this product from Trash?");
    if (!ok) return;

    setLastError("");
    setBusyId(id);

    const prev = items;
    setItems((p) => p.filter((x) => x._id !== id));

    try {
      const res = await fetch(`/api/admin/products/${id}?action=restore`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setItems(prev);
        setLastError((data as any)?.error || "Restore failed");
        return;
      }

      await load();
    } catch (e: any) {
      setItems(prev);
      setLastError(e?.message || "Network error");
    } finally {
      setBusyId("");
    }
  }

  async function permanentDelete(id: string) {
    const ok = window.confirm("⚠️ Permanent delete? This cannot be undone.");
    if (!ok) return;

    setLastError("");
    setBusyId(id);

    const prev = items;
    setItems((p) => p.filter((x) => x._id !== id));

    try {
      const res = await fetch(`/api/admin/products/${id}?action=purge`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setItems(prev);
        setLastError((data as any)?.error || "Permanent delete failed");
        return;
      }

      await load();
    } catch (e: any) {
      setItems(prev);
      setLastError(e?.message || "Network error");
    } finally {
      setBusyId("");
    }
  }

  async function deleteAllPermanently() {
    if (confirmText !== "DELETE ALL TRASH PRODUCTS") {
      setLastError('Please type exactly: DELETE ALL TRASH PRODUCTS');
      return;
    }

    setLastError("");
    setBulkDeleting(true);

    try {
      const res = await fetch("/api/admin/products/bulk-trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "purge_all",
          confirmText,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setLastError((data as any)?.error || "Bulk permanent delete failed");
        return;
      }

      setBulkModalOpen(false);
      setConfirmText("");
      await load();
      window.alert(`Done. Permanently deleted ${Number((data as any)?.deletedCount || 0)} trashed products.`);
    } catch (e: any) {
      setLastError(e?.message || "Network error");
    } finally {
      setBulkDeleting(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const trashCount = useMemo(() => items.length, [items]);

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-2xl font-extrabold">Trash</div>
              <div className="text-sm text-slate-600 mt-1">
                Deleted products (restore or permanently delete)
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => void load()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <RefreshCcw size={18} />
                Refresh
              </button>

              {trashCount > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setLastError("");
                    setBulkModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition font-bold shadow-sm"
                >
                  <Trash2 size={18} />
                  Delete All Permanently
                </button>
              ) : null}

              <Link
                href="/admin/products"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <ArrowLeft size={18} />
                Back
              </Link>
            </div>
          </div>

          {lastError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 font-semibold">
              {lastError}
            </div>
          ) : null}

          {trashCount > 0 ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700" />
                <div>
                  <div className="text-sm font-extrabold text-amber-800">
                    Trash Summary
                  </div>
                  <div className="mt-1 text-sm text-amber-800">
                    Current trashed products: <b>{trashCount}</b>
                    <br />
                    Individual restore/delete supported. Bulk permanent delete will remove all trashed products at once and cannot be undone.
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-6">
            {loading ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-slate-600 font-semibold">
                Loading...
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-700 font-semibold">
                Trash is empty ✅
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((p) => {
                  const isBusy = busyId === p._id;

                  return (
                    <div
                      key={p._id}
                      className="rounded-2xl border border-gray-200 bg-gray-50 p-4 flex items-start justify-between gap-4 flex-wrap"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold break-words">{p.title}</div>

                        <div className="text-sm text-slate-700 mt-1 break-words">
                          <b>SKU:</b> {p.sku} &nbsp; | &nbsp; <b>Subject:</b> {p.subjectCode}
                          &nbsp; | &nbsp; <b>Session:</b> {p.session} &nbsp; | &nbsp; <b>Lang:</b>{" "}
                          {p.language}
                        </div>

                        <div className="text-xs text-slate-500 mt-1 break-words">
                          Category: {p.category} • Price: ₹{p.price} • Status:{" "}
                          {p.isActive ? "Active" : "Draft"}
                        </div>

                        <div className="text-xs text-rose-600 mt-1">
                          DeletedAt: {p.deletedAt ? new Date(p.deletedAt).toLocaleString() : "—"}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2 flex-wrap justify-end">
                        <button
                          onClick={() => void restore(p._id)}
                          disabled={isBusy || bulkDeleting}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-emerald-50 border border-gray-200 transition font-bold disabled:opacity-60"
                          title="Restore"
                        >
                          <RotateCcw size={16} />
                          {isBusy ? "Working..." : "Restore"}
                        </button>

                        <button
                          onClick={() => void permanentDelete(p._id)}
                          disabled={isBusy || bulkDeleting}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-red-50 border border-gray-200 transition font-bold disabled:opacity-60"
                          title="Permanent Delete"
                        >
                          <Trash2 size={16} />
                          Delete Permanently
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Live-ready: Vercel cron will auto purge items older than 30 days.
          </div>
        </div>
      </div>

      {bulkModalOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm px-4 py-6 overflow-y-auto">
          <div className="max-w-2xl mx-auto rounded-3xl bg-white border border-gray-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 bg-rose-50 flex items-center justify-between gap-4">
              <div>
                <div className="text-xl font-extrabold text-rose-800 flex items-center gap-2">
                  <AlertTriangle size={22} />
                  Delete All Trashed Products Permanently
                </div>
                <div className="text-xs text-rose-700 mt-1">
                  This action cannot be undone.
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (bulkDeleting) return;
                  setBulkModalOpen(false);
                  setConfirmText("");
                }}
                className="h-10 w-10 rounded-2xl bg-white hover:bg-rose-100 border border-rose-200 flex items-center justify-center shadow-sm"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                You are about to permanently delete <b>{trashCount}</b> trashed product
                {trashCount === 1 ? "" : "s"}.
                <br />
                To confirm, type exactly:
                <div className="mt-2 font-extrabold text-slate-900">
                  DELETE ALL TRASH PRODUCTS
                </div>
              </div>

              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type confirmation text here"
                className="w-full mt-4 px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none focus:border-rose-500 transition font-medium"
                disabled={bulkDeleting}
              />

              <div className="mt-5 flex items-center justify-end gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    if (bulkDeleting) return;
                    setBulkModalOpen(false);
                    setConfirmText("");
                  }}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold"
                  disabled={bulkDeleting}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => void deleteAllPermanently()}
                  disabled={bulkDeleting || confirmText !== "DELETE ALL TRASH PRODUCTS"}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition font-bold disabled:opacity-60"
                >
                  {bulkDeleting ? (
                    <>
                      <LoaderCircle size={18} className="animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={18} />
                      Delete All Permanently
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}