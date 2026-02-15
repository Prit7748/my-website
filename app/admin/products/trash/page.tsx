"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCcw, RotateCcw, Trash2 } from "lucide-react";

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

export default function AdminProductsTrashPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>("");
  const [lastError, setLastError] = useState<string>("");

  async function load() {
    setLastError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/products?trash=1", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        setLastError(data?.error || "Failed to load trash");
        return;
      }
      setItems(data?.products || []);
    } catch (e: any) {
      setLastError(e?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  async function restore(id: string) {
    const ok = confirm("Restore this product from Trash?");
    if (!ok) return;

    setLastError("");
    setBusyId(id);

    // optimistic remove from trash list
    const prev = items;
    setItems((p) => p.filter((x) => x._id !== id));

    try {
      const res = await fetch(`/api/admin/products/${id}?action=restore`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setItems(prev);
        setLastError(data?.error || "Restore failed");
        return;
      }
      // refresh (to stay accurate)
      await load();
    } catch (e: any) {
      setItems(prev);
      setLastError(e?.message || "Network error");
    } finally {
      setBusyId("");
    }
  }

  async function permanentDelete(id: string) {
    const ok = confirm("⚠️ Permanent delete? This cannot be undone.");
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
      const data = await res.json();
      if (!res.ok) {
        setItems(prev);
        setLastError(data?.error || "Permanent delete failed");
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

  useEffect(() => {
    load();
  }, []);

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

            <div className="flex items-center gap-2">
              <button
                onClick={load}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <RefreshCcw size={18} />
                Refresh
              </button>

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

          <div className="mt-6">
            {loading ? (
              <div className="text-slate-600">Loading...</div>
            ) : items.length === 0 ? (
              <div className="text-slate-600">Trash is empty ✅</div>
            ) : (
              <div className="space-y-3">
                {items.map((p) => {
                  const isBusy = busyId === p._id;
                  return (
                    <div
                      key={p._id}
                      className="rounded-2xl border border-gray-200 bg-gray-50 p-4 flex items-start justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <div className="font-extrabold truncate">{p.title}</div>
                        <div className="text-sm text-slate-700 mt-1">
                          <b>SKU:</b> {p.sku} &nbsp; | &nbsp; <b>Subject:</b> {p.subjectCode} &nbsp; | &nbsp;{" "}
                          <b>Session:</b> {p.session} &nbsp; | &nbsp; <b>Lang:</b> {p.language}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Category: {p.category} • Price: ₹{p.price} • Status:{" "}
                          {p.isActive ? "Active" : "Draft"}
                        </div>
                        <div className="text-xs text-rose-600 mt-1">
                          DeletedAt: {p.deletedAt ? new Date(p.deletedAt).toLocaleString() : "—"}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2 flex-wrap justify-end">
                        <button
                          onClick={() => restore(p._id)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-emerald-50 border border-gray-200 transition font-bold disabled:opacity-60"
                          title="Restore"
                        >
                          <RotateCcw size={16} />
                          {isBusy ? "Working..." : "Restore"}
                        </button>

                        <button
                          onClick={() => permanentDelete(p._id)}
                          disabled={isBusy}
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
    </main>
  );
}
