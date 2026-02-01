"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCcw, ArrowLeft } from "lucide-react";

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
};

export default function AdminProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/products", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "Failed to load products");
        return;
      }
      setItems(data?.products || []);
    } finally {
      setLoading(false);
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
              <div className="text-2xl font-extrabold">Products</div>
              <div className="text-sm text-slate-600 mt-1">
                Create / view products (latest first)
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
                href="/admin"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <ArrowLeft size={18} />
                Back
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
                {items.map((p) => (
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
                      <div className="text-xs text-slate-500 mt-1 truncate">
                        Slug: /product/{p.slug}
                      </div>
                    </div>

                    <Link
                      href={`/product/${p.slug}`}
                      className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold"
                    >
                      Open
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Next step: Edit page + Update API + Image upload pipeline + Session/Subject/Course master pages.
          </div>
        </div>
      </div>
    </main>
  );
}
