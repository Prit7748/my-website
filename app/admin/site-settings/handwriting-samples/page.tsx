"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Save,
  Trash2,
  Upload,
} from "lucide-react";

type SampleItem = {
  id: string;
  imageUrl: string;
  alt: string;
  sortOrder: number;
  isActive: boolean;
};

export default function HandwritingSamplesSettingsPage() {
  const [items, setItems] = useState<SampleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  async function loadItems() {
    try {
      setLoading(true);
      const res = await fetch("/api/site-settings/handwriting-samples?scope=admin", {
        cache: "no-store",
      });
      const data = await res.json();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (error) {
      console.error(error);
      setMessage("Items load nahi ho paaye.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setMessage("Please image choose karo.");
      return;
    }

    try {
      setUploading(true);
      setMessage("");

      const fd = new FormData();
      fd.append("file", file);
      fd.append("alt", alt);
      fd.append("sortOrder", String(sortOrder));
      fd.append("isActive", String(isActive));

      const res = await fetch("/api/site-settings/handwriting-samples", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data?.error || "Upload failed.");
        return;
      }

      setFile(null);
      setAlt("");
      setSortOrder(0);
      setIsActive(true);
      setMessage("Sample image upload ho gayi.");
      await loadItems();
    } catch (error) {
      console.error(error);
      setMessage("Upload ke time error aa gaya.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(item: SampleItem) {
    try {
      setBusyId(item.id);
      setMessage("");

      const res = await fetch("/api/site-settings/handwriting-samples", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data?.error || "Save failed.");
        return;
      }

      setMessage("Item update ho gaya.");
      await loadItems();
    } catch (error) {
      console.error(error);
      setMessage("Update ke time error aa gaya.");
    } finally {
      setBusyId("");
    }
  }

  async function handleDelete(id: string) {
    const ok = window.confirm("Kya aap is handwriting sample ko delete karna chahte ho?");
    if (!ok) return;

    try {
      setBusyId(id);
      setMessage("");

      const res = await fetch(
        `/api/site-settings/handwriting-samples?id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setMessage(data?.error || "Delete failed.");
        return;
      }

      setMessage("Sample delete ho gaya.");
      await loadItems();
    } catch (error) {
      console.error(error);
      setMessage("Delete ke time error aa gaya.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-10">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-2xl font-extrabold flex items-center gap-2">
                <ImagePlus className="text-slate-700" />
                Handwriting Samples
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Yahan se handwritten hardcopy page ke sample images upload, sort,
                hide/show aur delete kar sakte ho.
              </div>
            </div>

            <Link
              href="/admin/site-settings"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
            >
              <ArrowLeft size={18} /> Back to Site Settings
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <div className="text-lg font-extrabold text-slate-900">
                Upload New Sample
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Ye images hardcopy page ke slider me show hongi.
              </div>

              <form onSubmit={handleUpload} className="mt-5 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Image File
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Alt Text
                  </label>
                  <input
                    value={alt}
                    onChange={(e) => setAlt(e.target.value)}
                    placeholder="e.g. Handwriting sample page 1"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value || 0))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium outline-none focus:border-slate-400"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  Upload ke baad active rakho
                </label>

                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-3 font-extrabold hover:bg-slate-800 disabled:opacity-60"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      Upload Sample
                    </>
                  )}
                </button>
              </form>

              <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800 font-semibold leading-relaxed">
                Note: Ye version images ko server ke
                <span className="font-extrabold">
                  {" "}
                  /public/uploads/site-settings/handwriting-samples
                </span>{" "}
                folder me save karta hai. Self-hosted/VPS setup ke liye perfect
                hai.
              </div>

              {message && (
                <div className="mt-4 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                  {message}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-lg font-extrabold text-slate-900">
                    Existing Samples
                  </div>
                  <div className="text-sm text-slate-600 mt-1">
                    Yahan se order, alt text aur visibility manage karo.
                  </div>
                </div>

                <div className="text-sm font-bold text-slate-500">
                  Total: {items.length}
                </div>
              </div>

              {loading ? (
                <div className="py-16 flex items-center justify-center text-slate-500 font-semibold">
                  <Loader2 className="animate-spin mr-2" size={18} />
                  Loading samples...
                </div>
              ) : items.length === 0 ? (
                <div className="py-16 text-center text-slate-500 font-semibold">
                  Abhi koi sample image add nahi hai.
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                  {items.map((item) => {
                    const isBusy = busyId === item.id;

                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-gray-200 overflow-hidden bg-gray-50"
                      >
                        <div className="relative aspect-[16/10] bg-white">
                          <Image
                            src={item.imageUrl}
                            alt={item.alt || "Handwriting sample"}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, 33vw"
                          />
                        </div>

                        <div className="p-4 space-y-3">
                          <div>
                            <label className="block text-xs font-extrabold text-slate-700 mb-1">
                              Alt Text
                            </label>
                            <input
                              value={item.alt}
                              onChange={(e) =>
                                setItems((prev) =>
                                  prev.map((x) =>
                                    x.id === item.id
                                      ? { ...x, alt: e.target.value }
                                      : x
                                  )
                                )
                              }
                              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium outline-none"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                                Sort Order
                              </label>
                              <input
                                type="number"
                                value={item.sortOrder}
                                onChange={(e) =>
                                  setItems((prev) =>
                                    prev.map((x) =>
                                      x.id === item.id
                                        ? {
                                            ...x,
                                            sortOrder: Number(
                                              e.target.value || 0
                                            ),
                                          }
                                        : x
                                    )
                                  )
                                }
                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                                Status
                              </label>
                              <button
                                type="button"
                                onClick={() =>
                                  setItems((prev) =>
                                    prev.map((x) =>
                                      x.id === item.id
                                        ? { ...x, isActive: !x.isActive }
                                        : x
                                    )
                                  )
                                }
                                className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-extrabold border ${
                                  item.isActive
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : "bg-gray-100 text-gray-600 border-gray-200"
                                }`}
                              >
                                {item.isActive ? (
                                  <>
                                    <Eye size={16} /> Active
                                  </>
                                ) : (
                                  <>
                                    <EyeOff size={16} /> Hidden
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleSave(item)}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2.5 font-extrabold hover:bg-slate-800 disabled:opacity-60"
                            >
                              {isBusy ? (
                                <>
                                  <Loader2 size={16} className="animate-spin" />
                                  Saving
                                </>
                              ) : (
                                <>
                                  <Save size={16} />
                                  Save
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDelete(item.id)}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-50 text-red-700 border border-red-200 px-4 py-2.5 font-extrabold hover:bg-red-100 disabled:opacity-60"
                            >
                              <Trash2 size={16} />
                              Delete
                            </button>
                          </div>

                          <div className="text-[11px] text-slate-500 font-semibold break-all">
                            {item.imageUrl}
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
      </div>
    </main>
  );
}