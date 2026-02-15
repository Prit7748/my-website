"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  RefreshCcw,
  ArrowLeft,
  Pencil,
  Copy,
  Trash2,
  ExternalLink,
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
  createdAt?: string;
  deletedAt?: string | null;
};

export default function AdminProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>("");
  const [trashCount, setTrashCount] = useState<number>(0);

  async function load() {
    setLoading(true);
    try {
      // ✅ Fetch normal (non-trash) list
      const res = await fetch("/api/admin/products", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "Failed to load products");
        return;
      }
      const list = (data?.products || []) as Product[];
      setItems(list.filter((p) => !p.deletedAt)); // extra safety

      // ✅ Fetch trash count (fast + clean UX)
      const resTrash = await fetch("/api/admin/products?trash=1", { credentials: "include" });
      const dataTrash = await resTrash.json();
      if (resTrash.ok) {
        const t = (dataTrash?.products || []) as Product[];
        setTrashCount(t.length);
      } else {
        setTrashCount(0);
      }
    } finally {
      setLoading(false);
    }
  }

  async function softDelete(id: string) {
    const ok = confirm("Move this product to Trash? (You can restore later)");
    if (!ok) return;

    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "Delete failed");
        return;
      }
      await load();
    } finally {
      setBusyId("");
    }
  }

  async function duplicate(id: string) {
    const ok = confirm("Duplicate this product? A new draft copy will be created.");
    if (!ok) return;

    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/products/${id}?action=duplicate`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "Duplicate failed");
        return;
      }
      await load();
      if (data?.product?.sku) {
        alert(`Duplicated! New SKU: ${data.product.sku}`);
      }
    } finally {
      setBusyId("");
    }
  }

  const trashBadge = useMemo(() => {
    if (!trashCount) return null;
    return (
      <span className="ml-2 inline-flex items-center justify-center min-w-[22px] h-[22px] px-2 rounded-full bg-rose-100 text-rose-700 text-xs font-extrabold border border-rose-200">
        {trashCount}
      </span>
    );
  }, [trashCount]);

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-2xl font-extrabold">Products</div>
              <div className="text-sm text-slate-600 mt-1">
                Create / manage products (latest first)
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={load}
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

              {/* ✅ NEW: Trash Page Link + Badge */}
              <Link
                href="/admin/products/trash"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-rose-50 border border-gray-200 transition font-semibold shadow-sm"
                title="Open Trash (deleted products)"
              >
                <Trash2 size={18} />
                Trash
                {trashBadge}
              </Link>

              <Link
                href="/admin/products/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-bold shadow-sm"
              >
                <Plus size={18} />
                Add New
              </Link>
            </div>
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="text-slate-600">Loading...</div>
            ) : items.length === 0 ? (
              <div className="text-slate-600">No products yet.</div>
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
                          <b>SKU:</b> {p.sku} &nbsp; | &nbsp; <b>Subject:</b> {p.subjectCode}{" "}
                          &nbsp; | &nbsp; <b>Session:</b> {p.session} &nbsp; | &nbsp;{" "}
                          <b>Lang:</b> {p.language}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Category: {p.category} • Price: ₹{p.price} • Status:{" "}
                          {p.isActive ? "Active" : "Draft"}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 truncate">
                          Slug: /product/{p.slug}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2 flex-wrap justify-end">
                        <Link
                          href={`/admin/products/new?id=${encodeURIComponent(p._id)}`}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold"
                          title="Edit"
                        >
                          <Pencil size={16} />
                          Edit
                        </Link>

                        <button
                          onClick={() => duplicate(p._id)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold disabled:opacity-60"
                          title="Duplicate"
                        >
                          <Copy size={16} />
                          {isBusy ? "Working..." : "Duplicate"}
                        </button>

                        <button
                          onClick={() => softDelete(p._id)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-red-50 border border-gray-200 transition font-bold disabled:opacity-60"
                          title="Move to Trash"
                        >
                          <Trash2 size={16} />
                          Trash
                        </button>

                        <Link
                          href={`/product/${p.slug}`}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold"
                          title="Open public page"
                        >
                          <ExternalLink size={16} />
                          Open
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Next: Trash page actions (restore/purge) + 30-days auto purge (cron).
          </div>
        </div>
      </div>
    </main>
  );
}
