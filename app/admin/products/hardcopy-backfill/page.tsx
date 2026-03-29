"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCcw,
  PackageCheck,
  AlertTriangle,
  Info,
} from "lucide-react";

type BackfillItem = {
  sourceSku: string;
  sourceTitle: string;
  sourceAvailability: string;
  sourceLanguage: string;
  childSku: string;
  childId: string;
  ok: boolean;
  action: string;
  reason: string;
};

type BackfillResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  summary?: {
    matchedCount: number;
    processed: number;
    created: number;
    updated: number;
    trashed: number;
    skipped: number;
    failed: number;
    hasMore: boolean;
  };
  items?: BackfillItem[];
};

export default function HardcopyBackfillPage() {
  const [loading, setLoading] = useState(false);
  const [sku, setSku] = useState("");
  const [limit, setLimit] = useState("1000");
  const [serverMessage, setServerMessage] = useState("");
  const [serverMessageType, setServerMessageType] = useState<"success" | "error" | "info">("info");
  const [result, setResult] = useState<BackfillResponse | null>(null);

  async function runBackfill() {
    setLoading(true);
    setResult(null);
    setServerMessage("");
    setServerMessageType("info");

    try {
      const res = await fetch("/api/admin/products/hardcopy-backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sku: sku.trim(),
          limit: Number(limit || 1000),
        }),
      });

      const data = (await res.json()) as BackfillResponse;

      if (!res.ok || !data?.ok) {
        const msg = data?.error || "Backfill failed";
        setServerMessage(msg);
        setServerMessageType("error");
        alert(msg);
        return;
      }

      setResult(data);
      setServerMessage(data?.message || "Backfill completed successfully.");
      setServerMessageType("success");
    } catch (e: any) {
      const msg = e?.message || "Server error";
      setServerMessage(msg);
      setServerMessageType("error");
      alert(msg);
    } finally {
      setLoading(false);
    }
  }

  const summary = result?.summary;

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-extrabold">Hardcopy Backfill</h1>
              <p className="text-sm text-slate-600 mt-1">
                Already uploaded solved assignments ko scan karke handwritten hardcopy products create / update karega.
              </p>
            </div>

            <Link
              href="/admin/products"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
            >
              <ArrowLeft size={18} />
              Back
            </Link>
          </div>

          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="inline-flex items-center gap-2 text-sm font-extrabold text-blue-900">
              <Info size={16} />
              Important
            </div>
            <div className="text-sm text-blue-800 mt-2 leading-6">
              Ye tool existing <b>Solved Assignments</b> products ko scan karega.
              <br />
              Hardcopy create tabhi hogi jab source product eligible ho aur <b>Handwritten Hardcopy (Delivery)</b> category ki pricing rule available ho.
              <br />
              Agar kisi row me <b>pricing_missing</b> ya pricing related reason aaye, to hardcopy category ke pricing rules pehle set karne honge.
            </div>
          </div>

          {serverMessage ? (
            <div
              className={`mt-4 rounded-2xl border p-4 text-sm font-semibold ${
                serverMessageType === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : serverMessageType === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : "border-blue-200 bg-blue-50 text-blue-800"
              }`}
            >
              <div className="flex items-start gap-2">
                {serverMessageType === "error" ? (
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                ) : (
                  <Info size={18} className="mt-0.5 shrink-0" />
                )}
                <div>{serverMessage}</div>
              </div>
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                Specific Source SKU (optional)
              </label>
              <input
                className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                placeholder="Example: BHIC109HIN202526A"
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                Scan Limit
              </label>
              <input
                type="number"
                min={1}
                max={5000}
                className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={runBackfill}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-950 text-white transition font-extrabold disabled:opacity-60"
              >
                {loading ? <RefreshCcw size={18} className="animate-spin" /> : <PackageCheck size={18} />}
                {loading ? "Running..." : "Run Hardcopy Backfill"}
              </button>
            </div>
          </div>

          {result && (
            <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-lg font-extrabold">Backfill Result</div>

              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mt-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs text-slate-500 font-bold uppercase">Matched</div>
                  <div className="text-xl font-extrabold mt-1">{summary?.matchedCount ?? 0}</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs text-slate-500 font-bold uppercase">Processed</div>
                  <div className="text-xl font-extrabold mt-1">{summary?.processed ?? 0}</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs text-slate-500 font-bold uppercase">Created</div>
                  <div className="text-xl font-extrabold mt-1">{summary?.created ?? 0}</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs text-slate-500 font-bold uppercase">Updated</div>
                  <div className="text-xl font-extrabold mt-1">{summary?.updated ?? 0}</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs text-slate-500 font-bold uppercase">Trashed</div>
                  <div className="text-xl font-extrabold mt-1">{summary?.trashed ?? 0}</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs text-slate-500 font-bold uppercase">Skipped</div>
                  <div className="text-xl font-extrabold mt-1">{summary?.skipped ?? 0}</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs text-slate-500 font-bold uppercase">Failed</div>
                  <div className="text-xl font-extrabold mt-1">{summary?.failed ?? 0}</div>
                </div>
              </div>

              {summary?.hasMore ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Saare matched products process nahi huye. Limit badha kar dubara run karo.
                </div>
              ) : null}

              <div className="mt-5 overflow-auto">
                <table className="min-w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 border-b">Source SKU</th>
                      <th className="text-left px-3 py-2 border-b">Source Title</th>
                      <th className="text-left px-3 py-2 border-b">Availability</th>
                      <th className="text-left px-3 py-2 border-b">Language</th>
                      <th className="text-left px-3 py-2 border-b">Child SKU</th>
                      <th className="text-left px-3 py-2 border-b">Action</th>
                      <th className="text-left px-3 py-2 border-b">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result?.items || []).map((item, idx) => (
                      <tr key={`${item.sourceSku}-${idx}`} className="border-b last:border-b-0 align-top">
                        <td className="px-3 py-2 font-semibold">{item.sourceSku || "—"}</td>
                        <td className="px-3 py-2 min-w-[260px]">{item.sourceTitle || "—"}</td>
                        <td className="px-3 py-2">{item.sourceAvailability || "—"}</td>
                        <td className="px-3 py-2">{item.sourceLanguage || "—"}</td>
                        <td className="px-3 py-2 font-semibold">{item.childSku || "—"}</td>
                        <td className="px-3 py-2 uppercase text-xs font-bold text-slate-700">
                          {item.action || "—"}
                        </td>
                        <td className={`px-3 py-2 min-w-[320px] ${item.ok ? "text-slate-700" : "text-rose-700"}`}>
                          {item.reason || "—"}
                        </td>
                      </tr>
                    ))}

                    {(!result?.items || result.items.length === 0) && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          No rows to display.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}