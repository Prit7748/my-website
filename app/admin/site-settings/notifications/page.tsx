"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, Plus, Save, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

type NoticeRow = {
  _id: string;
  id: string;
  title: string;
  href: string;
  badge?: string;
  isActive?: boolean;
  order?: number;
  expiresAt?: string | null;
};

function cn(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

async function adminFetchJSON(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...(init || {}),
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Request failed");
  return data;
}

export default function NotificationsAdminPage() {
  const [rows, setRows] = useState<NoticeRow[]>([]);
  const [loading, setLoading] = useState(true);

  // form
  const [title, setTitle] = useState("");
  const [href, setHref] = useState("");
  const [badge, setBadge] = useState("");
  const [order, setOrder] = useState<number>(1000);
  const [isActive, setIsActive] = useState(true);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => (a.order || 1000) - (b.order || 1000));
  }, [rows]);

  async function load() {
    setLoading(true);
    try {
      const data = await adminFetchJSON(`/api/site-settings/notices?admin=1`);
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addNotice() {
    if (!title.trim()) return alert("Title required");
    if (!href.trim()) return alert("Link (href) required");

    await adminFetchJSON(`/api/site-settings/notices`, {
      method: "POST",
      body: JSON.stringify({
        title: title.trim(),
        href: href.trim(),
        badge: badge.trim(),
        order,
        isActive,
      }),
    });

    setTitle("");
    setHref("");
    setBadge("");
    setOrder(1000);
    setIsActive(true);
    await load();
  }

  async function updateNotice(id: string, patch: Partial<NoticeRow>) {
    await adminFetchJSON(`/api/site-settings/notices/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    });
    await load();
  }

  async function deleteNotice(id: string) {
    const ok = confirm("Delete this notification?");
    if (!ok) return;
    await adminFetchJSON(`/api/site-settings/notices/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-2xl font-extrabold flex items-center gap-2">
                <Bell className="text-slate-700" />
                Notifications
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Add/edit notification items (internal or external links)
              </div>
            </div>

            <Link
              href="/admin/site-settings"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
            >
              <ArrowLeft size={18} /> Back
            </Link>
          </div>

          {/* Add */}
          <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5 shadow-sm">
            <div className="font-extrabold text-slate-800 flex items-center gap-2">
              <Plus size={18} /> Add Notification
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-600">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  placeholder="Exam form date updated (Official link)"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-600">Href (internal or https://...)</label>
                <input
                  value={href}
                  onChange={(e) => setHref(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  placeholder="/blog  OR  https://www.ignou.ac.in/..."
                />
                <div className="text-[11px] text-slate-500 mt-1">
                  External link auto new tab me khulega.
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Badge (optional)</label>
                <input
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  placeholder="OFFICIAL"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Order (lower = top)</label>
                <input
                  value={order}
                  onChange={(e) => setOrder(Number(e.target.value || 1000))}
                  type="number"
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  placeholder="1000"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-600">Active</label>
                <button
                  onClick={() => setIsActive((v) => !v)}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-2 rounded-xl border font-bold text-sm transition",
                    isActive ? "bg-white border-gray-200 text-slate-800" : "bg-gray-200 border-gray-200 text-gray-600"
                  )}
                >
                  {isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  {isActive ? "ON" : "OFF"}
                </button>
              </div>

              <div className="md:col-span-2">
                <button
                  onClick={addNotice}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-extrabold shadow-sm"
                >
                  <Save size={18} /> Save
                </button>
              </div>
            </div>
          </div>

          {/* List */}
          <div className="mt-6">
            <div className="font-extrabold text-slate-800">Items</div>

            <div className="mt-3 rounded-2xl border border-gray-200 overflow-hidden">
              {loading ? (
                <div className="p-5 text-sm text-slate-600">Loading...</div>
              ) : sorted.length === 0 ? (
                <div className="p-5 text-sm text-slate-600">No notifications yet.</div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {sorted.map((n) => (
                    <div key={n._id} className="p-4 bg-white">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                          <div className="font-extrabold text-slate-900">
                            Order: {n.order ?? 1000} • {n.isActive ? "ACTIVE" : "INACTIVE"}
                          </div>
                          <div className="text-xs text-slate-700 mt-1">
                            <span className="font-bold">Title:</span> {n.title}
                          </div>
                          <div className="text-xs text-slate-600 mt-1 break-all">
                            <span className="font-bold">Href:</span> {n.href}
                          </div>
                          {n.badge ? (
                            <div className="mt-2 inline-flex text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-900 text-white">
                              {n.badge}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateNotice(n._id, { isActive: !n.isActive })}
                            className={cn(
                              "inline-flex items-center gap-2 px-3 py-2 rounded-xl border font-bold text-sm transition",
                              n.isActive
                                ? "bg-white border-gray-200 text-slate-800 hover:bg-gray-50"
                                : "bg-gray-200 border-gray-200 text-gray-700 hover:bg-gray-300"
                            )}
                          >
                            {n.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                            {n.isActive ? "Disable" : "Enable"}
                          </button>

                          <button
                            onClick={() => deleteNotice(n._id)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white transition font-bold text-sm"
                          >
                            <Trash2 size={18} /> Delete
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <div className="text-xs font-bold text-slate-600">Change order:</div>
                        <input
                          defaultValue={n.order ?? 1000}
                          type="number"
                          className="w-32 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                          onKeyDown={async (e) => {
                            if (e.key !== "Enter") return;
                            const val = Number((e.target as HTMLInputElement).value || 1000);
                            await updateNotice(n._id, { order: val });
                          }}
                        />
                        <div className="text-[11px] text-slate-500">Enter press karke save hoga</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Next: Home page ko API-powered notices se connect karenge (speed cache included).
          </div>
        </div>
      </div>
    </main>
  );
}
