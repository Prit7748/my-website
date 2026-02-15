"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Save,
  Trash2,
  RefreshCw,
  Share2,
  ExternalLink,
} from "lucide-react";

type SocialItem = {
  _id: string;
  name: string;
  url: string;
  icon?: string;
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
function isValidUrl(u: string) {
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function AdminSocialLinksPage() {
  const [items, setItems] = useState<SocialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  const [q, setQ] = useState("");

  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newIcon, setNewIcon] = useState("");
  const [newSortOrder, setNewSortOrder] = useState<number>(0);
  const [newActive, setNewActive] = useState(true);
  const [creating, setCreating] = useState(false);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/site-settings/social-links?admin=1", { cache: "no-store" });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.message || "Failed");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load social links");
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
            safeStr(it.name).toLowerCase().includes(s) ||
            safeStr(it.url).toLowerCase().includes(s) ||
            safeStr(it.icon).toLowerCase().includes(s)
        )
      : items;

    return [...base].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [items, q]);

  async function createItem() {
    setError("");

    const name = safeStr(newName);
    const url = safeStr(newUrl);
    const icon = safeStr(newIcon);

    if (name.length < 2) return setError("Name min 2 characters required.");
    if (!isValidUrl(url)) return setError("Valid https URL is required.");

    setCreating(true);
    try {
      const res = await fetch("/api/site-settings/social-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          url,
          icon,
          isActive: newActive,
          sortOrder: num(newSortOrder, 0),
        }),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.message || "Create failed");

      setNewName("");
      setNewUrl("");
      setNewIcon("");
      setNewSortOrder(0);
      setNewActive(true);

      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to create social link");
    } finally {
      setCreating(false);
    }
  }

  async function saveItem(id: string, patch: Partial<SocialItem>) {
    setError("");
    setSavingId(id);
    try {
      if (patch.url !== undefined && !isValidUrl(safeStr(patch.url))) {
        throw new Error("Valid https URL is required.");
      }

      const res = await fetch(`/api/site-settings/social-links/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.message || "Update failed");
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to update social link");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteItem(id: string) {
    setError("");
    const ok = confirm("Delete this social link?");
    if (!ok) return;

    setSavingId(id);
    try {
      const res = await fetch(`/api/site-settings/social-links/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.message || "Delete failed");
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to delete social link");
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
                <Share2 className="text-slate-700" />
                Social Links
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Manage social/contact links (active + sortOrder). Use icons like: whatsapp, telegram, youtube, instagram.
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
              <div className="font-extrabold">Add New Link</div>
              <button
                onClick={createItem}
                disabled={creating}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition font-semibold shadow-sm disabled:opacity-60"
              >
                <Plus size={18} /> {creating ? "Adding..." : "Add"}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-600">Name</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="WhatsApp"
                  className="mt-1 w-full px-4 py-2 rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-600">URL</label>
                <input
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://wa.me/91xxxxxxxxxx"
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
                <label className="text-xs font-bold text-slate-600">Icon Key (optional)</label>
                <input
                  value={newIcon}
                  onChange={(e) => setNewIcon(e.target.value)}
                  placeholder="whatsapp / telegram / youtube / instagram"
                  className="mt-1 w-full px-4 py-2 rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-slate-200"
                />
                <div className="text-xs text-slate-500 mt-2">
                  Tip: URL must be https. Icon key is just a label for frontend mapping.
                </div>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
            <div className="font-extrabold">All Links</div>
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
                No links yet.
              </div>
            ) : (
              filtered.map((it) => (
                <SocialRow
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
            Tip: Put WhatsApp/Telegram first with lower sortOrder (0, 10, 20...).
          </div>
        </div>
      </div>
    </main>
  );
}

function SocialRow({
  item,
  saving,
  onSave,
  onDelete,
}: {
  item: SocialItem;
  saving: boolean;
  onSave: (patch: Partial<SocialItem>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [url, setUrl] = useState(item.url);
  const [icon, setIcon] = useState(item.icon || "");
  const [sortOrder, setSortOrder] = useState<number>(item.sortOrder ?? 0);
  const [isActive, setIsActive] = useState<boolean>(!!item.isActive);

  useEffect(() => {
    setName(item.name);
    setUrl(item.url);
    setIcon(item.icon || "");
    setSortOrder(item.sortOrder ?? 0);
    setIsActive(!!item.isActive);
  }, [item._id]);

  const changed =
    safeStr(name) !== safeStr(item.name) ||
    safeStr(url) !== safeStr(item.url) ||
    safeStr(icon) !== safeStr(item.icon || "") ||
    sortOrder !== (item.sortOrder ?? 0) ||
    isActive !== !!item.isActive;

  const previewOk = isValidUrl(safeStr(url));

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="font-extrabold text-slate-900">Link</div>
        <div className="flex items-center gap-2">
          <a
            href={previewOk ? url : "#"}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border transition font-semibold shadow-sm ${
              previewOk
                ? "bg-white hover:bg-gray-50 border-gray-200 text-slate-800"
                : "bg-gray-50 border-gray-200 text-slate-400 cursor-not-allowed"
            }`}
            onClick={(e) => {
              if (!previewOk) e.preventDefault();
            }}
            title={previewOk ? "Open link" : "Invalid URL"}
          >
            <ExternalLink size={18} /> Open
          </a>

          <button
            onClick={() =>
              onSave({
                name: safeStr(name),
                url: safeStr(url),
                icon: safeStr(icon),
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
        <div>
          <label className="text-xs font-bold text-slate-600">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full px-4 py-2 rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-xs font-bold text-slate-600">URL</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="mt-1 w-full px-4 py-2 rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-slate-200"
          />
          {!previewOk ? (
            <div className="text-xs text-red-600 mt-1">Please enter a valid https URL.</div>
          ) : null}
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
          <label className="text-xs font-bold text-slate-600">Icon Key (optional)</label>
          <input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="whatsapp / telegram / youtube / instagram"
            className="mt-1 w-full px-4 py-2 rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>
      </div>
    </div>
  );
}
