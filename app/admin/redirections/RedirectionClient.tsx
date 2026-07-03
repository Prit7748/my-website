"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRightLeft,
  ExternalLink,
  Info,
  Pencil,
  PlusCircle,
  RefreshCw,
  Save,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from "lucide-react";

type RedirectionRow = {
  _id: string;
  fromPath: string;
  toPath: string;
  statusCode: 301 | 302;
  isActive: boolean;
  note?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function safeStr(x: unknown) {
  return String(x ?? "").trim();
}

function statusLabel(code: number) {
  return code === 302 ? "302 Temporary" : "301 Permanent";
}

export default function RedirectionClient() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<RedirectionRow[]>([]);

  const [search, setSearch] = useState("");
  const [only, setOnly] = useState<"" | "active" | "inactive">("");

  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editId, setEditId] = useState("");

  const [form, setForm] = useState({
    fromPath: "",
    toPath: "",
    statusCode: 301 as 301 | 302,
    isActive: true,
    note: "",
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams();
      if (safeStr(search)) q.set("search", safeStr(search));
      if (only) q.set("only", only);

      const res = await fetch(`/api/admin/redirections?${q.toString()}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load redirections");
      setItems(Array.isArray(data?.redirections) ? data.redirections : []);
    } catch (e: any) {
      setItems([]);
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = safeStr(search).toLowerCase();
    if (!s) return items;
    return items.filter((row) => {
      const from = safeStr(row.fromPath).toLowerCase();
      const to = safeStr(row.toPath).toLowerCase();
      const note = safeStr(row.note).toLowerCase();
      return from.includes(s) || to.includes(s) || note.includes(s);
    });
  }, [items, search]);

  function resetForm() {
    setForm({
      fromPath: "",
      toPath: "",
      statusCode: 301,
      isActive: true,
      note: "",
    });
    setEditId("");
    setMode("list");
    setError("");
  }

  function startCreate() {
    resetForm();
    setMode("create");
  }

  async function startEdit(id: string) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/redirections/${id}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load redirection");

      const row = data?.redirection || {};
      setEditId(id);
      setForm({
        fromPath: safeStr(row.fromPath),
        toPath: safeStr(row.toPath),
        statusCode: Number(row.statusCode) === 302 ? 302 : 301,
        isActive: Boolean(row.isActive),
        note: safeStr(row.note),
      });
      setMode("edit");
    } catch (e: any) {
      setError(e?.message || "Failed to load redirection");
    } finally {
      setBusy(false);
    }
  }

  async function submitCreate() {
    setError("");
    setBusy(true);
    try {
      const payload = {
        fromPath: safeStr(form.fromPath),
        toPath: safeStr(form.toPath),
        statusCode: form.statusCode,
        isActive: Boolean(form.isActive),
        note: safeStr(form.note),
      };

      if (!payload.fromPath) throw new Error("Previous URL is required");
      if (!payload.toPath) throw new Error("New URL is required");

      const res = await fetch("/api/admin/redirections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Create failed");

      resetForm();
      await load();
    } catch (e: any) {
      setError(e?.message || "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitEdit() {
    if (!editId) return;
    setError("");
    setBusy(true);
    try {
      const payload = {
        fromPath: safeStr(form.fromPath),
        toPath: safeStr(form.toPath),
        statusCode: form.statusCode,
        isActive: Boolean(form.isActive),
        note: safeStr(form.note),
      };

      if (!payload.fromPath) throw new Error("Previous URL is required");
      if (!payload.toPath) throw new Error("New URL is required");

      const res = await fetch(`/api/admin/redirections/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Update failed");

      resetForm();
      await load();
    } catch (e: any) {
      setError(e?.message || "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: RedirectionRow) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/redirections/${row._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Toggle failed");
      await load();
    } catch (e: any) {
      setError(e?.message || "Toggle failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: RedirectionRow) {
    const ok = confirm(`Delete redirection from "${row.fromPath}"?`);
    if (!ok) return;

    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/redirections/${row._id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      await load();
    } catch (e: any) {
      setError(e?.message || "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-2xl font-extrabold flex items-center gap-2">
                <ArrowRightLeft className="text-slate-700" />
                URL Redirections
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Map old URLs to new ones with 301 permanent or 302 temporary redirects.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={load}
                disabled={loading || busy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm disabled:opacity-50"
              >
                <RefreshCw size={18} />
                Refresh
              </button>

              <button
                onClick={startCreate}
                disabled={busy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-bold shadow-sm disabled:opacity-50"
              >
                <PlusCircle size={18} />
                New Redirect
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

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                  <div className="flex items-center gap-2 w-full md:w-[60%]">
                    <Search className="text-slate-600" size={18} />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search previous URL, new URL, note..."
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 bg-white"
                    />
                  </div>

                  <select
                    value={only}
                    onChange={(e) => setOnly(e.target.value as "" | "active" | "inactive")}
                    className="rounded-xl border border-gray-300 px-3 py-2 bg-white font-semibold"
                  >
                    <option value="">All</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>

                  <button
                    onClick={load}
                    disabled={loading || busy}
                    className="rounded-xl border border-gray-300 px-3 py-2 bg-white font-semibold hover:bg-gray-50 disabled:opacity-50"
                  >
                    Apply
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-gray-200 overflow-hidden">
                <div className="bg-white px-4 py-3 font-extrabold flex items-center justify-between">
                  <span>Redirections</span>
                  <span className="text-xs text-slate-500 font-semibold">
                    {filtered.length} items
                  </span>
                </div>

                {loading ? (
                  <div className="p-4 text-sm text-slate-600 bg-white">Loading...</div>
                ) : filtered.length ? (
                  <div className="divide-y bg-white">
                    {filtered.map((row) => (
                      <div key={row._id} className="p-4 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-xs text-slate-500 font-semibold">From</div>
                          <div className="font-bold text-slate-900 break-all">{row.fromPath}</div>

                          <div className="text-xs text-slate-500 font-semibold mt-2">To</div>
                          <div className="text-sm text-slate-800 break-all flex items-start gap-1">
                            {/^https?:\/\//i.test(row.toPath) ? (
                              <ExternalLink size={14} className="mt-0.5 shrink-0" />
                            ) : null}
                            <span>{row.toPath}</span>
                          </div>

                          <div className="text-xs text-slate-600 mt-2 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex px-2 py-1 rounded-lg font-semibold ${
                                row.statusCode === 301
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {statusLabel(row.statusCode)}
                            </span>
                            <span
                              className={`inline-flex px-2 py-1 rounded-lg font-semibold ${
                                row.isActive
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-200 text-gray-700"
                              }`}
                            >
                              {row.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>

                          {safeStr(row.note) ? (
                            <div className="text-xs text-slate-600 mt-2 line-clamp-2">
                              {safeStr(row.note)}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => toggleActive(row)}
                            disabled={busy}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm disabled:opacity-50"
                            title="Toggle active"
                          >
                            {row.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                          </button>

                          <button
                            onClick={() => startEdit(row._id)}
                            disabled={busy}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm disabled:opacity-50"
                            title="Edit"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            onClick={() => remove(row)}
                            disabled={busy}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-red-50 border border-gray-200 transition font-semibold shadow-sm disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-sm text-slate-600 bg-white">
                    No redirections found.
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="font-extrabold text-lg flex items-center justify-between">
                  <span>
                    {mode === "edit"
                      ? "Edit Redirect"
                      : mode === "create"
                        ? "Create Redirect"
                        : "Redirect Form"}
                  </span>
                  {mode !== "list" ? (
                    <button
                      onClick={resetForm}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
                    >
                      <X size={18} />
                      Cancel
                    </button>
                  ) : null}
                </div>

                {mode === "list" ? (
                  <div className="mt-3 text-sm text-slate-600">
                    Click <b>New Redirect</b> or <b>Edit</b> to start.
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <label className="text-sm font-semibold">
                      Previous URL
                      <input
                        value={form.fromPath}
                        onChange={(e) =>
                          setForm((s) => ({ ...s, fromPath: e.target.value }))
                        }
                        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 bg-white"
                        placeholder="/solved-assignments/old-slug-here"
                      />
                      <div className="mt-1 text-xs text-slate-500">
                        Relative path only. Query strings are preserved automatically.
                      </div>
                    </label>

                    <label className="text-sm font-semibold">
                      New URL
                      <input
                        value={form.toPath}
                        onChange={(e) => setForm((s) => ({ ...s, toPath: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 bg-white"
                        placeholder="/solved-assignments/new-slug or https://example.com/page"
                      />
                      <div className="mt-1 text-xs text-slate-500">
                        Relative path or full absolute URL.
                      </div>
                    </label>

                    <label className="text-sm font-semibold">
                      Redirect Type
                      <select
                        value={form.statusCode}
                        onChange={(e) =>
                          setForm((s) => ({
                            ...s,
                            statusCode: Number(e.target.value) === 302 ? 302 : 301,
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 bg-white font-semibold"
                      >
                        <option value={301}>301 Permanent</option>
                        <option value={302}>302 Temporary</option>
                      </select>
                    </label>

                    <label className="text-sm font-semibold">
                      Note (optional)
                      <textarea
                        value={form.note}
                        onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 bg-white min-h-[80px]"
                        placeholder="Why this redirect exists"
                      />
                    </label>

                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-extrabold text-sm">Status</div>
                          <div className="text-xs text-slate-600">Active / Inactive</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setForm((s) => ({ ...s, isActive: !s.isActive }))}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
                        >
                          {form.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                          {form.isActive ? "Active" : "Inactive"}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={mode === "edit" ? submitEdit : submitCreate}
                      disabled={busy}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-bold shadow-sm disabled:opacity-50"
                    >
                      <Save size={18} />
                      {mode === "edit" ? "Save Changes" : "Create Redirect"}
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
                <div className="font-extrabold text-sm text-blue-900 flex items-center gap-2">
                  <Info size={16} />
                  How it works
                </div>
                <div className="mt-2 text-xs text-blue-800 leading-6">
                  Active redirects run on every frontend page request through the site proxy.
                  Use 301 for permanent URL moves and 302 for temporary changes.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
