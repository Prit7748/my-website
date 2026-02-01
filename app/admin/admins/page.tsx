"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ShieldCheck, ArrowRight, RefreshCcw } from "lucide-react";
import Link from "next/link";

type Admin = {
  _id: string;
  name?: string;
  email: string;
  role: string;
  permissions?: string[];
  createdAt?: string;
};

export default function AdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    adminKey: "",
    permissionsText: "products:write,orders:read",
  });

  const permissions = useMemo(() => {
    return form.permissionsText
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }, [form.permissionsText]);

  async function loadAdmins() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/admins", { credentials: "include" });
      const data = await res.json();
      if (res.ok) setAdmins(data.admins || []);
      else alert(data.error || "Failed to load admins");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdmins();
  }, []);

  async function createAdmin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          adminKey: form.adminKey,
          permissions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed");
        return;
      }

      alert("Co-Admin created ✅");
      setForm({
        name: "",
        email: "",
        password: "",
        adminKey: "",
        permissionsText: "products:write,orders:read",
      });
      await loadAdmins();
    } finally {
      setBusy(false);
    }
  }

  async function deleteAdmin(id: string) {
    if (!confirm("Delete this Co-Admin?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/admins?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to delete");
        return;
      }
      alert("Deleted ✅");
      await loadAdmins();
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
                <ShieldCheck className="text-slate-700" />
                Admin Management
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Master Admin only: create/delete Co-Admins and control permissions.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadAdmins}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <RefreshCcw size={18} />
                Refresh
              </button>

              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-bold shadow-sm"
              >
                Back <ArrowRight size={18} />
              </Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
              <div className="text-lg font-extrabold">Create Co-Admin</div>
              <div className="text-sm text-slate-600 mt-1">
                Password strong rakho + Admin Key minimum 8.
              </div>

              <form onSubmit={createAdmin} className="mt-4 space-y-3">
                <input
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                  placeholder="Full name"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
                <input
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  required
                />
                <input
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                  placeholder="Password (8+ strong)"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  required
                />
                <input
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                  placeholder="Admin Key (min 8)"
                  type="password"
                  value={form.adminKey}
                  onChange={(e) => setForm((p) => ({ ...p, adminKey: e.target.value }))}
                  required
                />
                <input
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                  placeholder="Permissions (comma separated)"
                  value={form.permissionsText}
                  onChange={(e) => setForm((p) => ({ ...p, permissionsText: e.target.value }))}
                />

                <button
                  disabled={busy}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition font-extrabold disabled:opacity-60"
                >
                  <Plus size={18} />
                  {busy ? "Working..." : "Create Co-Admin"}
                </button>

                <div className="text-xs text-slate-500">
                  Example permissions: <b>products:write</b>, <b>orders:read</b>, <b>orders:write</b>
                </div>
              </form>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-5">
              <div className="text-lg font-extrabold">Co-Admins List</div>
              <div className="text-sm text-slate-600 mt-1">
                Total: {loading ? "..." : admins.length}
              </div>

              <div className="mt-4 space-y-3">
                {loading ? (
                  <div className="text-slate-600">Loading...</div>
                ) : admins.length === 0 ? (
                  <div className="text-slate-600">No co-admins yet.</div>
                ) : (
                  admins.map((a) => (
                    <div
                      key={a._id}
                      className="rounded-2xl border border-gray-200 bg-gray-50 p-4 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-extrabold truncate">{a.name || "—"}</div>
                        <div className="text-sm text-slate-700 truncate">{a.email}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          permissions: {(a.permissions || []).join(", ") || "—"}
                        </div>
                      </div>

                      <button
                        onClick={() => deleteAdmin(a._id)}
                        disabled={busy}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold disabled:opacity-60"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Next step: co-admin login me “Admin Key” field required kar denge (sirf co_admin ke liye), master admin ke liye OTP phase baad me add karenge.
          </div>
        </div>
      </div>
    </main>
  );
}
