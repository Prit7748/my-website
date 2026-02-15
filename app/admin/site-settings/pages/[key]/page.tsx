"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Save, FileText, ToggleLeft, ToggleRight } from "lucide-react";

type PolicyRow = {
  key: string;
  title: string;
  subtitle?: string;
  contentHtml?: string;
  isEnabled?: boolean;
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

export default function PolicyPageEditor() {
  const params = useParams<{ key: string }>();
  const key = String(params?.key || "");

  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<PolicyRow | null>(null);

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await adminFetchJSON(`/api/site-settings/pages/${encodeURIComponent(key)}`);
      const r = data as PolicyRow | null;
      setRow(r);
      setTitle(String(r?.title || ""));
      setSubtitle(String(r?.subtitle || ""));
      setContentHtml(String(r?.contentHtml || ""));
      setIsEnabled(!!r?.isEnabled);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!key) return;
    load();
  }, [key]);

  async function save() {
    await adminFetchJSON(`/api/site-settings/pages/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify({ title, subtitle, contentHtml, isEnabled }),
    });
    alert("Saved ✅");
    await load();
  }

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-2xl font-extrabold flex items-center gap-2">
                <FileText className="text-slate-700" />
                Edit Page: <span className="text-slate-500">{key}</span>
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Live page DB content will apply only when enabled.
              </div>
            </div>

            <Link
              href="/admin/site-settings/pages"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
            >
              <ArrowLeft size={18} /> Back
            </Link>
          </div>

          {loading ? (
            <div className="mt-6 text-sm text-slate-600">Loading...</div>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600">Title</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600">Subtitle (optional)</label>
                  <input
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  />
                </div>

                <div className="md:col-span-2 flex items-center gap-3">
                  <label className="text-xs font-bold text-slate-600">Enabled</label>
                  <button
                    onClick={() => setIsEnabled((v) => !v)}
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-2 rounded-xl border font-extrabold text-sm transition",
                      isEnabled ? "bg-white border-gray-200 text-slate-800" : "bg-gray-200 border-gray-200 text-gray-700"
                    )}
                  >
                    {isEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    {isEnabled ? "ON" : "OFF"}
                  </button>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-600">Content HTML</label>
                  <textarea
                    value={contentHtml}
                    onChange={(e) => setContentHtml(e.target.value)}
                    className="mt-1 w-full min-h-[260px] rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm font-mono"
                    placeholder="<section>...</section>"
                  />
                  <div className="text-[11px] text-slate-500 mt-1">
                    Tip: Abhi change nahi karna hai to as-is rakho. Later edit kar denge.
                  </div>
                </div>

                <div className="md:col-span-2 flex gap-3 flex-wrap">
                  <button
                    onClick={save}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-extrabold shadow-sm"
                  >
                    <Save size={18} /> Save
                  </button>
                </div>
              </div>

              <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <div className="font-extrabold text-slate-800">Preview (Admin)</div>
                <div className="mt-3 bg-white border border-gray-200 rounded-2xl p-6">
                  <h1 className="text-2xl font-extrabold text-slate-900">{title || row?.title}</h1>
                  {subtitle ? <p className="text-slate-500 mt-2 text-sm">{subtitle}</p> : null}
                  <div className="mt-6" dangerouslySetInnerHTML={{ __html: contentHtml }} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
