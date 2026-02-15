"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Save, Trash2, RefreshCw, HelpCircle } from "lucide-react";

type FaqItem = {
  _id: string;
  question: string;
  answer: string;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}
function num(x: any, d = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
}

export default function AdminFaqPage() {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  const [q, setQ] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [newSortOrder, setNewSortOrder] = useState<number>(0);
  const [newActive, setNewActive] = useState(true);
  const [creating, setCreating] = useState(false);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/site-settings/faqs?admin=1", { cache: "no-store" });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.message || "Failed");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load FAQs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = safeStr(q).toLowerCase();
    const base = s
      ? items.filter(
          (it) =>
            safeStr(it.question).toLowerCase().includes(s) ||
            safeStr(it.answer).toLowerCase().includes(s)
        )
      : items;

    return [...base].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [items, q]);

  async function createItem() {
    setError("");
    const question = safeStr(newQuestion);
    const answer = safeStr(newAnswer);

    if (question.length < 5) return setError("Question min 5 characters required.");
    if (answer.length < 5) return setError("Answer min 5 characters required.");

    setCreating(true);
    try {
      const res = await fetch("/api/site-settings/faqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          answer,
          isActive: newActive,
          sortOrder: num(newSortOrder, 0),
        }),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.message || "Create failed");
      setNewQuestion("");
      setNewAnswer("");
      setNewSortOrder(0);
      setNewActive(true);
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to create FAQ");
    } finally {
      setCreating(false);
    }
  }

  async function saveItem(id: string, patch: Partial<FaqItem>) {
    setError("");
    setSavingId(id);
    try {
      const res = await fetch(`/api/site-settings/faqs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.message || "Update failed");
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to update FAQ");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteItem(id: string) {
    setError("");
    const ok = confirm("Delete this FAQ?");
    if (!ok) return;

    setSavingId(id);
    try {
      const res = await fetch(`/api/site-settings/faqs/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.message || "Delete failed");
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to delete FAQ");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-2xl font-extrabold flex items-center gap-2">
                <HelpCircle className="text-slate-700" />
                FAQ
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Create and manage Frequently Asked Questions (active + sortOrder).
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={load}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <RefreshCw size={18} /> Refresh
              </button>
              <Link
                href="/admin/site-settings"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <ArrowLeft size={18} /> Back
              </Link>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {/* Create */}
          <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="font-extrabold">Add New FAQ</div>
              <button
                onClick={createItem}
                disabled={creating}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition font-semibold shadow-sm disabled:opacity-60"
              >
                <Plus size={18} /> {creating ? "Adding..." : "Add"}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-3">
                <label className="text-xs font-bold text-slate-600">Question</label>
                <input
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="e.g. How do I download the PDF after purchase?"
                  className="mt-1 w-full px-4 py-2 rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Sort Order</label>
                <input
                  type="number"
                  value={newSortOrder}
                  onChange={(e) => setNewSortOrder(num(e.target.value, 0))}
                  className="mt-1 w-full px-4 py-2 rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-slate-200"
                />
                <label className="mt-2 inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={newActive}
                    onChange={(e) => setNewActive(e.target.checked)}
                  />
                  Active
                </label>
              </div>

              <div className="md:col-span-4">
                <label className="text-xs font-bold text-slate-600">Answer</label>
                <textarea
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  placeholder="Write a clear, helpful answer..."
                  rows={4}
                  className="mt-1 w-full px-4 py-2 rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
            <div className="font-extrabold">All FAQs</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search..."
              className="w-full md:w-80 px-4 py-2 rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>

          {/* List */}
          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-slate-600">
                Loading...
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-slate-600">
                No FAQs yet.
              </div>
            ) : (
              filtered.map((it) => (
                <FaqRow
                  key={it._id}
                  item={it}
                  saving={savingId === it._id}
                  onSave={(patch) => saveItem(it._id, patch)}
                  onDelete={() => deleteItem(it._id)}
                />
              ))
            )}
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Tip: Keep sortOrder small numbers (0, 10, 20...) so you can insert later easily.
          </div>
        </div>
      </div>
    </main>
  );
}

function FaqRow({
  item,
  saving,
  onSave,
  onDelete,
}: {
  item: FaqItem;
  saving: boolean;
  onSave: (patch: Partial<FaqItem>) => void;
  onDelete: () => void;
}) {
  const [question, setQuestion] = useState(item.question);
  const [answer, setAnswer] = useState(item.answer);
  const [sortOrder, setSortOrder] = useState<number>(item.sortOrder ?? 0);
  const [isActive, setIsActive] = useState<boolean>(!!item.isActive);

  useEffect(() => {
    setQuestion(item.question);
    setAnswer(item.answer);
    setSortOrder(item.sortOrder ?? 0);
    setIsActive(!!item.isActive);
  }, [item._id]);

  const changed =
    safeStr(question) !== safeStr(item.question) ||
    safeStr(answer) !== safeStr(item.answer) ||
    sortOrder !== (item.sortOrder ?? 0) ||
    isActive !== !!item.isActive;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="font-extrabold text-slate-900">FAQ Item</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              onSave({
                question: safeStr(question),
                answer: safeStr(answer),
                sortOrder,
                isActive,
              })
            }
            disabled={!changed || saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition font-semibold shadow-sm disabled:opacity-60"
          >
            <Save size={18} /> {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={onDelete}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm disabled:opacity-60"
          >
            <Trash2 size={18} /> Delete
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-3">
          <label className="text-xs font-bold text-slate-600">Question</label>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="mt-1 w-full px-4 py-2 rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-600">Sort Order</label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(num(e.target.value, 0))}
            className="mt-1 w-full px-4 py-2 rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-slate-200"
          />
          <label className="mt-2 inline-flex items-center gap-2 text-sm text-slate-700">
            <input checked={isActive} onChange={(e) => setIsActive(e.target.checked)} type="checkbox" />
            Active
          </label>
        </div>

        <div className="md:col-span-4">
          <label className="text-xs font-bold text-slate-600">Answer</label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={4}
            className="mt-1 w-full px-4 py-2 rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>
      </div>
    </div>
  );
}
