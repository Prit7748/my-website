"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  MessageSquareQuote,
  Plus,
  Save,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Star,
} from "lucide-react";

type Row = {
  _id: string;
  name: string;
  course: string;
  text: string;
  rating?: number;
  avatarUrl?: string;
  isActive?: boolean;
  sortOrder?: number;
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

export default function TestimonialsAdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // form
  const [name, setName] = useState("");
  const [course, setCourse] = useState("");
  const [text, setText] = useState("");
  const [rating, setRating] = useState<number>(5);
  const [sortOrder, setSortOrder] = useState<number>(1000);
  const [isActive, setIsActive] = useState(true);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => (a.sortOrder ?? 1000) - (b.sortOrder ?? 1000));
  }, [rows]);

  async function load() {
    setLoading(true);
    try {
      const data = await adminFetchJSON(`/api/site-settings/testimonials?admin=1`);
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!name.trim()) return alert("Name required");
    if (!course.trim()) return alert("Course required");
    if (!text.trim()) return alert("Text required");

    await adminFetchJSON(`/api/site-settings/testimonials`, {
      method: "POST",
      body: JSON.stringify({
        name: name.trim(),
        course: course.trim(),
        text: text.trim(),
        rating,
        sortOrder,
        isActive,
      }),
    });

    setName("");
    setCourse("");
    setText("");
    setRating(5);
    setSortOrder(1000);
    setIsActive(true);
    await load();
  }

  async function update(id: string, patch: Partial<Row>) {
    await adminFetchJSON(`/api/site-settings/testimonials/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    });
    await load();
  }

  async function del(id: string) {
    const ok = confirm("Delete this testimonial?");
    if (!ok) return;
    await adminFetchJSON(`/api/site-settings/testimonials/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-2xl font-extrabold flex items-center gap-2">
                <MessageSquareQuote className="text-slate-700" />
                Testimonials
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Add/edit student reviews (active + sort order). Home page slider will use ACTIVE items.
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
              <Plus size={18} /> Add Testimonial
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-600">Student Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  placeholder="Rahul Kumar"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Course</label>
                <input
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  placeholder="M.Com"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-600">Review Text</label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm min-h-[120px]"
                  placeholder="Great experience! The assignments were accurate..."
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Rating (1–5)</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value || 5))}
                    type="number"
                    min={1}
                    max={5}
                    className="w-28 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  />
                  <div className="flex items-center gap-1 text-yellow-500">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={16} fill={s <= rating ? "currentColor" : "none"} />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Sort Order (lower = top)</label>
                <input
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value || 1000))}
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
                  onClick={add}
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
                <div className="p-5 text-sm text-slate-600">No testimonials yet.</div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {sorted.map((r) => (
                    <div key={r._id} className="p-4 bg-white">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                          <div className="font-extrabold text-slate-900">
                            Order: {r.sortOrder ?? 1000} • {r.isActive ? "ACTIVE" : "INACTIVE"}
                          </div>
                          <div className="text-xs text-slate-700 mt-1">
                            <span className="font-bold">Name:</span> {r.name} •{" "}
                            <span className="font-bold">Course:</span> {r.course}
                          </div>
                          <div className="mt-2 text-xs text-slate-600 leading-relaxed">
                            {r.text}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="text-[11px] font-bold text-slate-600">Rating:</div>
                            <div className="flex items-center gap-1 text-yellow-500">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star key={s} size={14} fill={s <= (r.rating ?? 5) ? "currentColor" : "none"} />
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => update(r._id, { isActive: !r.isActive })}
                            className={cn(
                              "inline-flex items-center gap-2 px-3 py-2 rounded-xl border font-bold text-sm transition",
                              r.isActive
                                ? "bg-white border-gray-200 text-slate-800 hover:bg-gray-50"
                                : "bg-gray-200 border-gray-200 text-gray-700 hover:bg-gray-300"
                            )}
                          >
                            {r.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                            {r.isActive ? "Disable" : "Enable"}
                          </button>

                          <button
                            onClick={() => del(r._id)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white transition font-bold text-sm"
                          >
                            <Trash2 size={18} /> Delete
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <div className="text-xs font-bold text-slate-600">Change order:</div>
                        <input
                          defaultValue={r.sortOrder ?? 1000}
                          type="number"
                          className="w-32 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                          onKeyDown={async (e) => {
                            if (e.key !== "Enter") return;
                            const val = Number((e.target as HTMLInputElement).value || 1000);
                            await update(r._id, { sortOrder: val });
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
            Next: Home page will load ACTIVE testimonials from DB with cache.
          </div>
        </div>
      </div>
    </main>
  );
}
