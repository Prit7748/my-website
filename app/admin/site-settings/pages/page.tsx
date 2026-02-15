"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, ToggleLeft, ToggleRight, ExternalLink } from "lucide-react";

type PolicyRow = {
  _id?: string;
  key: string;
  title: string;
  subtitle?: string;
  isEnabled?: boolean;
  updatedAt?: string;
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

const LIVE_MAP: Record<string, string> = {
  privacy: "/privacy",
  terms: "/terms",
  "refund-policy": "/refund-policy",
};

export default function PolicyPagesAdminList() {
  const [rows, setRows] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await adminFetchJSON("/api/site-settings/pages");
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(key: string, next: boolean) {
    await adminFetchJSON(`/api/site-settings/pages/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify({ isEnabled: next }),
    });
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
                Policy Pages
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Live pages will use DB content only when <b>Enabled</b>. Otherwise existing page content will show.
              </div>
            </div>

            <Link
              href="/admin/site-settings"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
            >
              <ArrowLeft size={18} /> Back
            </Link>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="p-5 text-sm text-slate-600">Loading...</div>
            ) : rows.length === 0 ? (
              <div className="p-5 text-sm text-slate-600">No pages found.</div>
            ) : (
              <div className="divide-y divide-gray-200">
                {rows.map((r) => {
                  const liveHref = LIVE_MAP[r.key] || "/";
                  return (
                    <div key={r.key} className="p-4 bg-white flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <div className="font-extrabold text-slate-900">
                          {r.title}{" "}
                          <span className={cn("ml-2 text-[10px] px-2 py-0.5 rounded-full font-extrabold",
                            r.isEnabled ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-700"
                          )}>
                            {r.isEnabled ? "ENABLED" : "DISABLED"}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          Key: <span className="font-bold">{r.key}</span>
                          {r.subtitle ? <span className="ml-2">• {r.subtitle}</span> : null}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          Live: <span className="font-bold">{liveHref}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggle(r.key, !r.isEnabled)}
                          className={cn(
                            "inline-flex items-center gap-2 px-3 py-2 rounded-xl border font-extrabold text-sm transition",
                            r.isEnabled
                              ? "bg-white border-gray-200 text-slate-800 hover:bg-gray-50"
                              : "bg-gray-200 border-gray-200 text-gray-700 hover:bg-gray-300"
                          )}
                        >
                          {r.isEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                          {r.isEnabled ? "Disable" : "Enable"}
                        </button>

                        <Link
                          href={`/admin/site-settings/pages/${encodeURIComponent(r.key)}`}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-extrabold text-sm"
                        >
                          Edit
                        </Link>

                        <a
                          href={liveHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 transition font-extrabold text-sm"
                        >
                          <ExternalLink size={16} /> Open
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Note: Content editor uses HTML. Abhi aap enable/disable pe focus karo—content later change kar denge.
          </div>
        </div>
      </div>
    </main>
  );
}
