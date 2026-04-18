"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  RefreshCcw,
  Image as ImageIcon,
  Info,
  Upload,
  Link2,
  LoaderCircle,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

type ApiResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  item?: {
    isEnabled?: boolean;
    templateImageUrl?: string;
    updatedBy?: string;
    createdAt?: string | null;
    updatedAt?: string | null;
  };
  defaults?: {
    isEnabled?: boolean;
    templateImageUrl?: string;
  };
};

type InputMode = "upload" | "url";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeBool(x: any, def = false) {
  if (typeof x === "boolean") return x;
  if (typeof x === "string") {
    const v = x.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(v)) return true;
    if (["false", "0", "no", "off"].includes(v)) return false;
  }
  if (typeof x === "number") {
    if (x === 1) return true;
    if (x === 0) return false;
  }
  return def;
}

function buildErrorMessage(data: any, fallback: string) {
  const parts = [
    safeStr(data?.error),
    safeStr(data?.details),
    safeStr(data?.name),
    safeStr(data?.code),
    data?.httpStatus ? `HTTP ${data.httpStatus}` : "",
  ].filter(Boolean);

  return parts.length ? parts.join(" | ") : fallback;
}

function withCacheBust(url: string, nonce: number) {
  const raw = safeStr(url);
  if (!raw) return "";
  const joiner = raw.includes("?") ? "&" : "?";
  return `${raw}${joiner}v=${nonce}`;
}

export default function PyqThumbnailPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [defaults, setDefaults] = useState<ApiResponse["defaults"] | null>(null);
  const [serverMessage, setServerMessage] = useState("");
  const [serverMessageType, setServerMessageType] = useState<"success" | "error" | "info">("info");

  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState("");
  const [previewBroken, setPreviewBroken] = useState(false);
  const [previewNonce, setPreviewNonce] = useState<number>(Date.now());

  const [form, setForm] = useState({
    isEnabled: true,
    templateImageUrl: "",
  });

  async function loadSettings(showLoadedMessage = true) {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/site-settings/pyq-thumbnail", {
        credentials: "include",
        cache: "no-store",
      });

      const data = (await res.json()) as ApiResponse;

      if (!res.ok || !data?.ok) {
        const msg = data?.error || "Failed to load PYQ thumbnail settings";
        setServerMessage(msg);
        setServerMessageType("error");
        return;
      }

      setDefaults(data?.defaults || null);

      setForm({
        isEnabled: safeBool(data?.item?.isEnabled, true),
        templateImageUrl: safeStr(data?.item?.templateImageUrl),
      });

      setPreviewBroken(false);
      setPreviewNonce(Date.now());

      if (showLoadedMessage) {
        setServerMessage("PYQ thumbnail settings loaded successfully.");
        setServerMessageType("info");
      }
    } catch (e: any) {
      setServerMessage(e?.message || "Failed to load PYQ thumbnail settings");
      setServerMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings(true);
  }, []);

  useEffect(() => {
    return () => {
      if (localPreviewUrl && localPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  function clearLocalSelection() {
    if (localPreviewUrl && localPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(localPreviewUrl);
    }
    setSelectedFile(null);
    setLocalPreviewUrl("");
  }

  function resetDefaults() {
    if (!defaults) return;

    clearLocalSelection();
    setInputMode("upload");
    setPreviewBroken(false);
    setPreviewNonce(Date.now());

    setForm({
      isEnabled: safeBool(defaults?.isEnabled, true),
      templateImageUrl: safeStr(defaults?.templateImageUrl),
    });

    setServerMessage("Default PYQ thumbnail settings restored in form. Do not forget to save.");
    setServerMessageType("info");
  }

  async function uploadSelectedFileIfNeeded() {
    if (inputMode !== "upload") {
      return safeStr(form.templateImageUrl);
    }

    if (!selectedFile) {
      throw new Error("Upload mode selected hai. Pehle image file choose karo.");
    }

    setUploading(true);

    try {
      const uploadForm = new FormData();
      uploadForm.append("file", selectedFile);
      uploadForm.append("kind", "image");
      uploadForm.append("destination", "pyq-thumbnail");

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        credentials: "include",
        body: uploadForm,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(buildErrorMessage(data, "Template image upload failed"));
      }

      const uploadedUrl = safeStr(data?.src || data?.url);
      if (!uploadedUrl) {
        throw new Error("Upload completed but image URL not found.");
      }

      setForm((prev) => ({
        ...prev,
        templateImageUrl: uploadedUrl,
      }));

      return uploadedUrl;
    } finally {
      setUploading(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setServerMessage("");

    try {
      let finalTemplateImageUrl = safeStr(form.templateImageUrl);

      if (inputMode === "upload") {
        finalTemplateImageUrl = await uploadSelectedFileIfNeeded();
      } else {
        finalTemplateImageUrl = safeStr(form.templateImageUrl);

        if (!finalTemplateImageUrl) {
          throw new Error("Public URL / Path mode me valid image URL required hai.");
        }

        if (finalTemplateImageUrl === "/images/thumbs/pyq-master-template.png") {
          throw new Error(
            "Abhi default broken local path saved hai. Ya to real public path do, ya Upload from PC use karo."
          );
        }
      }

      if (!finalTemplateImageUrl) {
        throw new Error("Template image URL required");
      }

      const payload = {
        isEnabled: safeBool(form.isEnabled, true),
        templateImageUrl: finalTemplateImageUrl,
      };

      const res = await fetch("/api/admin/site-settings/pyq-thumbnail", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as ApiResponse;

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to save PYQ thumbnail settings");
      }

      const savedUrl = safeStr(data?.item?.templateImageUrl || finalTemplateImageUrl);

      setForm({
        isEnabled: safeBool(data?.item?.isEnabled, payload.isEnabled),
        templateImageUrl: savedUrl,
      });

      clearLocalSelection();
      setInputMode("url");
      setPreviewBroken(false);
      setPreviewNonce(Date.now());

      setServerMessage(data?.message || "PYQ thumbnail settings saved successfully.");
      setServerMessageType("success");

      await loadSettings(false);
    } catch (e: any) {
      const msg = e?.message || "Failed to save PYQ thumbnail settings";
      setServerMessage(msg);
      setServerMessageType("error");
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  const previewSrc = useMemo(() => {
    if (inputMode === "upload" && localPreviewUrl) return localPreviewUrl;
    return withCacheBust(form.templateImageUrl, previewNonce);
  }, [inputMode, localPreviewUrl, form.templateImageUrl, previewNonce]);

  const rawSavedUrl = safeStr(form.templateImageUrl);
  const isUsingMissingDefault =
    rawSavedUrl === "/images/thumbs/pyq-master-template.png";

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-extrabold flex items-center gap-2">
                <ImageIcon className="text-blue-700" />
                PYQ Master Thumbnail
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Upload or set the blank PYQ master template image used for automatic runtime thumbnail generation.
              </p>
            </div>

            <Link
              href="/admin/site-settings"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
            >
              <ArrowLeft size={18} />
              Back
            </Link>
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
                {serverMessageType === "success" ? (
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                ) : (
                  <Info size={18} className="mt-0.5 shrink-0" />
                )}
                <div>{serverMessage}</div>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="mt-6 text-sm text-slate-500">Loading settings...</div>
          ) : (
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
              <div className="space-y-5">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <div className="text-base font-extrabold text-slate-900">
                    Runtime Thumbnail Source
                  </div>
                  <div className="text-sm text-slate-600 mt-1 leading-6">
                    Yahan sirf blank master template image set hogi. Dynamic fields jaise Subject Code, Subject Title, Programme, Session, Paper Code, Paper Name aur Medium runtime me isi blank image ke upar draw honge.
                  </div>

                  <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
                    <label className="flex items-center justify-between gap-4 cursor-pointer">
                      <div>
                        <div className="text-sm font-extrabold text-slate-900">
                          Enable PYQ Master Thumbnail
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          Enable hone par PYQ category cards aur fallback detail pages par runtime master thumbnail use hoga.
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            isEnabled: !p.isEnabled,
                          }))
                        }
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition ${
                          form.isEnabled ? "bg-emerald-600" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                            form.isEnabled ? "translate-x-8" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </label>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setInputMode("upload")}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border font-bold transition ${
                        inputMode === "upload"
                          ? "border-blue-700 bg-blue-700 text-white"
                          : "border-gray-200 bg-white text-slate-700 hover:bg-gray-50"
                      }`}
                    >
                      <Upload size={16} />
                      Upload from PC
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        clearLocalSelection();
                        setInputMode("url");
                      }}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border font-bold transition ${
                        inputMode === "url"
                          ? "border-blue-700 bg-blue-700 text-white"
                          : "border-gray-200 bg-white text-slate-700 hover:bg-gray-50"
                      }`}
                    >
                      <Link2 size={16} />
                      Public URL / Path
                    </button>
                  </div>

                  {inputMode === "upload" ? (
                    <div className="mt-5">
                      <label className="text-xs font-bold text-slate-500 uppercase ml-1 block">
                        Upload Blank Master Template
                      </label>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/avif"
                        className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;

                          if (localPreviewUrl && localPreviewUrl.startsWith("blob:")) {
                            URL.revokeObjectURL(localPreviewUrl);
                          }

                          setSelectedFile(file);
                          setPreviewBroken(false);

                          if (file) {
                            setLocalPreviewUrl(URL.createObjectURL(file));
                          } else {
                            setLocalPreviewUrl("");
                          }
                        }}
                      />
                      <div className="mt-2 text-xs text-slate-600 font-semibold leading-5">
                        Recommended: exactly wahi blank template upload karo jisme static content already fixed ho aur sirf blank areas me dynamic data fill hona ho.
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5">
                      <label className="text-xs font-bold text-slate-500 uppercase ml-1 block">
                        Template Image URL / Public Path
                      </label>
                      <input
                        className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                        value={form.templateImageUrl}
                        onChange={(e) => {
                          setPreviewBroken(false);
                          setForm((p) => ({
                            ...p,
                            templateImageUrl: e.target.value,
                          }));
                        }}
                        placeholder="/images/thumbs/pyq-master-template.png or https://..."
                      />
                      <div className="mt-2 text-xs text-slate-600 font-semibold leading-5">
                        Agar aap image public folder me manually upload karoge to yahan uska path de sakte ho, jaise `/images/thumbs/pyq-master-template.png`.
                      </div>
                    </div>
                  )}

                  <div className="mt-5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1 block">
                      Current Saved Template Image URL
                    </label>
                    <input
                      className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                      value={rawSavedUrl}
                      readOnly
                    />
                  </div>

                  {isUsingMissingDefault ? (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                        <div>
                          Current saved URL abhi default local path par hai. Isko real uploaded image URL se replace karna hoga.
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                  <div className="text-base font-extrabold text-blue-900">
                    Important Working Logic
                  </div>
                  <div className="mt-3 text-sm text-blue-900 leading-7 font-medium">
                    Ye page sirf blank template image ko manage karega. Actual dynamic placement, font sizing, wrapping aur positioning runtime thumbnail route me hogi.
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={saveSettings}
                    disabled={saving || uploading}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-950 text-white font-extrabold disabled:opacity-60"
                  >
                    {saving || uploading ? (
                      <LoaderCircle size={18} className="animate-spin" />
                    ) : (
                      <Save size={18} />
                    )}
                    {uploading ? "Uploading..." : saving ? "Saving..." : "Save Settings"}
                  </button>

                  <button
                    type="button"
                    onClick={resetDefaults}
                    disabled={!defaults}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 font-extrabold disabled:opacity-60"
                  >
                    <RefreshCcw size={18} />
                    Reset Default Settings
                  </button>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-base font-extrabold text-slate-900">
                    Preview
                  </div>
                  <div className="text-sm text-slate-600 mt-1">
                    Ye sirf template image preview hai.
                  </div>

                  <div className="mt-4 rounded-2xl border border-gray-200 bg-slate-50 overflow-hidden">
                    {previewSrc && !previewBroken ? (
                      <img
                        src={previewSrc}
                        alt="PYQ Master Template Preview"
                        className="w-full h-auto object-contain"
                        onError={() => setPreviewBroken(true)}
                      />
                    ) : (
                      <div className="aspect-[768/1024] flex items-center justify-center text-center px-6 text-sm font-semibold text-slate-500">
                        No valid template image preview available.
                      </div>
                    )}
                  </div>

                  {previewBroken ? (
                    <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
                      Preview load nahi hua. Saved URL broken hai ya image publicly accessible nahi hai.
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <div className="text-base font-extrabold text-emerald-900">
                    Current Status
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm font-bold text-emerald-900">
                    {form.isEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    {form.isEnabled ? "PYQ Master Thumbnail Enabled" : "PYQ Master Thumbnail Disabled"}
                  </div>
                  <div className="mt-2 text-sm text-emerald-900 leading-7 font-medium break-all">
                    {rawSavedUrl || "No template image URL saved yet."}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}