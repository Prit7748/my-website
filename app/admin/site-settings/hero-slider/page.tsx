"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Image as ImageIcon,
  Monitor,
  Smartphone,
  Plus,
  Save,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Upload,
  Link2,
  RefreshCcw,
  Copy,
  LoaderCircle,
  Video,
  AlertTriangle,
  Clock3,
} from "lucide-react";

type Device = "desktop" | "mobile";
type SlideType = "image" | "video";
type InputMode = "upload" | "url";

type Slide = {
  _id: string;
  device: Device;
  type: SlideType;
  src: string;
  link?: string;
  alt?: string;
  isActive?: boolean;
  order?: number;
  durationSeconds?: number;
};

type MediaMeta = {
  width: number;
  height: number;
  ratio: number;
};

function cn(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function safeStr(x: unknown) {
  return String(x ?? "").trim();
}

function safeNum(x: unknown, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function clampDurationSeconds(x: unknown, fallback = 5) {
  const n = Math.trunc(safeNum(x, fallback));
  if (n < 1) return 1;
  if (n > 60) return 60;
  return n;
}

function formatRatio(meta: MediaMeta | null) {
  if (!meta?.width || !meta?.height) return "";
  return `${meta.width} × ${meta.height} (~${meta.ratio.toFixed(3)}:1)`;
}

function isNearDesktop16By9(meta: MediaMeta | null) {
  if (!meta?.width || !meta?.height) return false;
  const ratio = meta.width / meta.height;
  return Math.abs(ratio - 16 / 9) <= 0.18;
}

function acceptByType(type: SlideType) {
  return type === "video"
    ? "video/mp4,video/webm"
    : "image/png,image/jpeg,image/jpg,image/webp,image/avif";
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
  if (!res.ok) throw new Error(buildErrorMessage(data, "Request failed"));
  return data;
}

async function uploadHeroMedia(file: File, type: SlideType, device: Device) {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", type);
  form.append("destination", "hero-slider");
  form.append("device", device);

  const res = await fetch("/api/admin/upload", {
    method: "POST",
    credentials: "include",
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(buildErrorMessage(data, "Upload failed"));
  return data;
}

async function readImageMeta(file: File): Promise<MediaMeta> {
  const url = URL.createObjectURL(file);

  try {
    const meta = await new Promise<MediaMeta>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        resolve({
          width: img.naturalWidth || 0,
          height: img.naturalHeight || 0,
          ratio:
            img.naturalWidth && img.naturalHeight
              ? img.naturalWidth / img.naturalHeight
              : 0,
        });
      };
      img.onerror = () => reject(new Error("Failed to read image dimensions"));
      img.src = url;
    });

    return meta;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function readVideoMeta(file: File): Promise<MediaMeta> {
  const url = URL.createObjectURL(file);

  try {
    const meta = await new Promise<MediaMeta>((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;

      video.onloadedmetadata = () => {
        resolve({
          width: video.videoWidth || 0,
          height: video.videoHeight || 0,
          ratio:
            video.videoWidth && video.videoHeight
              ? video.videoWidth / video.videoHeight
              : 0,
        });
      };

      video.onerror = () => reject(new Error("Failed to read video dimensions"));
      video.src = url;
    });

    return meta;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function readMediaMeta(file: File, type: SlideType): Promise<MediaMeta | null> {
  try {
    if (type === "video") return await readVideoMeta(file);
    return await readImageMeta(file);
  } catch {
    return null;
  }
}

export default function HeroSliderAdminPage() {
  const [device, setDevice] = useState<Device>("desktop");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [type, setType] = useState<SlideType>("image");
  const [src, setSrc] = useState("");
  const [link, setLink] = useState("");
  const [alt, setAlt] = useState("");
  const [order, setOrder] = useState<number>(1000);
  const [durationInput, setDurationInput] = useState<string>("5");
  const [isActive, setIsActive] = useState(true);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState("");
  const [mediaMeta, setMediaMeta] = useState<MediaMeta | null>(null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const sortedSlides = useMemo(() => {
    return [...slides].sort((a, b) => (a.order || 1000) - (b.order || 1000));
  }, [slides]);

  const activeCount = useMemo(() => {
    return sortedSlides.filter((x) => !!x.isActive).length;
  }, [sortedSlides]);

  useEffect(() => {
    return () => {
      if (localPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  async function load() {
    setLoading(true);
    try {
      const data = await adminFetchJSON(
        `/api/site-settings/hero-slides?admin=1&device=${device}`
      );
      setSlides(Array.isArray(data) ? data : []);
    } catch (e: any) {
      alert(e?.message || "Failed to load slides");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device, refreshTick]);

  function resetForm() {
    if (localPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(localPreviewUrl);
    }

    setInputMode("upload");
    setType("image");
    setSrc("");
    setLink("");
    setAlt("");
    setOrder(1000);
    setDurationInput("5");
    setIsActive(true);
    setSelectedFile(null);
    setLocalPreviewUrl("");
    setMediaMeta(null);
  }

  async function onPickFile(file: File | null) {
    if (localPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(localPreviewUrl);
    }

    if (!file) {
      setSelectedFile(null);
      setLocalPreviewUrl("");
      setMediaMeta(null);
      return;
    }

    const inferredType: SlideType = file.type.startsWith("video/") ? "video" : "image";

    setSelectedFile(file);
    setType(inferredType);
    setLocalPreviewUrl(URL.createObjectURL(file));

    const meta = await readMediaMeta(file, inferredType);
    setMediaMeta(meta);
  }

  async function addSlide() {
    if (saving || uploading) return;

    try {
      setSaving(true);

      let finalSrc = safeStr(src);

      if (inputMode === "upload") {
        if (!selectedFile) {
          alert("Please select an image or video file.");
          return;
        }

        setUploading(true);
        const uploaded = await uploadHeroMedia(selectedFile, type, device);
        finalSrc = safeStr(uploaded?.src || uploaded?.url);
      } else {
        if (!finalSrc) {
          alert("Please enter image/video URL or public path.");
          return;
        }
      }

      if (!finalSrc) {
        alert("SRC missing.");
        return;
      }

      await adminFetchJSON(`/api/site-settings/hero-slides`, {
        method: "POST",
        body: JSON.stringify({
          device,
          type,
          src: finalSrc,
          link: safeStr(link),
          alt: safeStr(alt),
          order,
          durationSeconds: clampDurationSeconds(durationInput, 5),
          isActive,
        }),
      });

      resetForm();
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to add slide");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  async function updateSlide(id: string, patch: Partial<Slide>) {
    try {
      await adminFetchJSON(`/api/site-settings/hero-slides/${id}`, {
        method: "PUT",
        body: JSON.stringify(patch),
      });
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to update slide");
    }
  }

  async function deleteSlide(id: string) {
    const ok = confirm("Delete this slide?");
    if (!ok) return;

    try {
      await adminFetchJSON(`/api/site-settings/hero-slides/${id}`, {
        method: "DELETE",
      });
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to delete slide");
    }
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      alert("Copied");
    } catch {
      alert("Copy failed");
    }
  }

  const previewSrc = inputMode === "upload" ? localPreviewUrl : safeStr(src);
  const previewDurationSeconds = clampDurationSeconds(durationInput, 5);

  const desktopRatioWarning =
    device === "desktop" && inputMode === "upload" && selectedFile && mediaMeta
      ? !isNearDesktop16By9(mediaMeta)
      : false;

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-2xl font-extrabold">
                <ImageIcon className="text-slate-700" />
                Hero Slider
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Upload or add by URL • Desktop + Mobile separate slides • Order, active, link, SEO alt, timing
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setRefreshTick((v) => v + 1)}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 font-semibold shadow-sm transition hover:bg-gray-50"
              >
                <RefreshCcw size={18} /> Refresh
              </button>

              <Link
                href="/admin/site-settings"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 font-semibold shadow-sm transition hover:bg-gray-50"
              >
                <ArrowLeft size={18} /> Back
              </Link>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setDevice("desktop")}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-4 py-2 font-bold shadow-sm transition",
                device === "desktop"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-gray-200 bg-white text-slate-700 hover:bg-gray-50"
              )}
            >
              <Monitor size={18} /> Desktop
            </button>

            <button
              onClick={() => setDevice("mobile")}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-4 py-2 font-bold shadow-sm transition",
                device === "mobile"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-gray-200 bg-white text-slate-700 hover:bg-gray-50"
              )}
            >
              <Smartphone size={18} /> Mobile
            </button>

            <div className="ml-auto rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
              Total: {sortedSlides.length} • Active: {activeCount}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_0.9fr]">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 shadow-sm">
              <div className="flex items-center gap-2 font-extrabold text-slate-800">
                <Plus size={18} /> Add New Slide ({device})
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setInputMode("upload")}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition",
                    inputMode === "upload"
                      ? "border-blue-700 bg-blue-700 text-white"
                      : "border-gray-200 bg-white text-slate-700 hover:bg-gray-50"
                  )}
                >
                  <Upload size={16} /> Upload from PC
                </button>

                <button
                  onClick={() => setInputMode("url")}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition",
                    inputMode === "url"
                      ? "border-blue-700 bg-blue-700 text-white"
                      : "border-gray-200 bg-white text-slate-700 hover:bg-gray-50"
                  )}
                >
                  <Link2 size={16} /> Add by URL / Path
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-bold text-slate-600">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as SlideType)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="image">image</option>
                    <option value="video">video</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600">
                    Order (lower = first)
                  </label>
                  <input
                    value={order}
                    onChange={(e) => setOrder(Number(e.target.value || 1000))}
                    type="number"
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    placeholder="1000"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600">
                    Stay Duration (seconds)
                  </label>
                  <input
                    value={durationInput}
                    onChange={(e) => setDurationInput(e.target.value)}
                    onBlur={() =>
                      setDurationInput(String(clampDurationSeconds(durationInput, 5)))
                    }
                    type="number"
                    min={1}
                    max={60}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    placeholder="5"
                  />
                  <div className="mt-1 text-[11px] text-slate-500">
                    Har slide kitne second tak dikhegi. Allowed: 1 to 60 seconds.
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-5">
                  <label className="text-xs font-bold text-slate-600">Active</label>
                  <button
                    onClick={() => setIsActive((v) => !v)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition",
                      isActive
                        ? "border-gray-200 bg-white text-slate-800"
                        : "border-gray-200 bg-gray-200 text-gray-600"
                    )}
                  >
                    {isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    {isActive ? "ON" : "OFF"}
                  </button>
                </div>

                {inputMode === "upload" ? (
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-600">
                      Upload File
                    </label>
                    <input
                      type="file"
                      accept={acceptByType(type)}
                      onChange={(e) => onPickFile(e.target.files?.[0] || null)}
                      className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    />
                    <div className="mt-1 text-[11px] text-slate-500">
                      {device === "desktop"
                        ? "Desktop UI 16:9 me dikhegi. Upload ke time exact 16:9 zaroori nahi hai; image/video object-cover se auto crop ho sakta hai."
                        : "Mobile ke liye portrait ya square media use kar sakte hain."}
                    </div>
                  </div>
                ) : (
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-600">SRC</label>
                    <input
                      value={src}
                      onChange={(e) => setSrc(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                      placeholder="/uploads/... or https://..."
                    />
                    <div className="mt-1 text-[11px] text-slate-500">
                      {device === "desktop"
                        ? "Desktop URL/path ki image 16:9 na ho tab bhi UI me crop hokar show ho sakti hai."
                        : "Mobile URL/path ke liye portrait ya square media recommended hai."}
                    </div>
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-600">
                    Click Link (optional)
                  </label>
                  <input
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    placeholder="/products?sort=latest"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-600">
                    ALT / SEO Text
                  </label>
                  <input
                    value={alt}
                    onChange={(e) => setAlt(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    placeholder="IGNOU Solved Assignments Latest Session Banner"
                  />
                </div>

                <div className="md:col-span-2 flex flex-wrap items-center gap-2">
                  <button
                    onClick={addSlide}
                    disabled={saving || uploading}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl px-4 py-2 font-extrabold text-white shadow-sm transition",
                      saving || uploading
                        ? "cursor-not-allowed bg-slate-500"
                        : "bg-slate-900 hover:bg-slate-950"
                    )}
                  >
                    {saving || uploading ? (
                      <LoaderCircle size={18} className="animate-spin" />
                    ) : (
                      <Save size={18} />
                    )}
                    {uploading
                      ? "Uploading..."
                      : saving
                      ? "Saving..."
                      : "Save Slide"}
                  </button>

                  <button
                    onClick={resetForm}
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 font-bold text-slate-700 shadow-sm transition hover:bg-gray-50"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-extrabold text-slate-800">Preview</div>

              <div
                className={cn(
                  "mt-3 overflow-hidden rounded-2xl border border-gray-200 bg-slate-100",
                  device === "desktop" ? "aspect-video" : "aspect-[713/620]"
                )}
              >
                {previewSrc ? (
                  type === "video" ? (
                    <video
                      src={previewSrc}
                      className="h-full w-full object-cover"
                      controls
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={previewSrc}
                      alt={safeStr(alt) || "Preview"}
                      className="h-full w-full object-cover"
                    />
                  )
                ) : (
                  <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm font-semibold text-slate-500">
                    {device === "desktop"
                      ? "Desktop preview area (16:9 visible frame)"
                      : "Mobile preview area"}
                  </div>
                )}
              </div>

              <div className="mt-3 space-y-2 text-xs text-slate-600">
                {selectedFile ? (
                  <div>
                    <span className="font-bold">File:</span> {selectedFile.name}
                  </div>
                ) : null}

                {mediaMeta ? (
                  <div>
                    <span className="font-bold">Dimensions:</span> {formatRatio(mediaMeta)}
                  </div>
                ) : null}

                <div>
                  <span className="font-bold">Stay Duration:</span> {previewDurationSeconds} sec
                </div>

                {desktopRatioWarning ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                      <div>
                        Exact 16:9 nahi hai, lekin ye upload ho sakti hai. Desktop UI me image/video thoda crop hokar fit ho jayega.
                      </div>
                    </div>
                  </div>
                ) : device === "desktop" && mediaMeta ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
                    Desktop ratio looks good for hero slider.
                  </div>
                ) : null}

                <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-slate-700">
                  <div className="font-bold text-blue-800">Speed Tips</div>
                  <div className="mt-1">
                    Images ke liye WebP/AVIF aur videos ke liye short compressed MP4/WebM best rehte hain.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="text-lg font-extrabold text-slate-800">
              Slides ({device})
            </div>

            <div className="mt-3 overflow-hidden rounded-2xl border border-gray-200">
              {loading ? (
                <div className="p-5 text-sm text-slate-600">Loading...</div>
              ) : sortedSlides.length === 0 ? (
                <div className="p-5 text-sm text-slate-600">
                  No slides found for {device}. Add your first slide above.
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {sortedSlides.map((s) => (
                    <div key={s._id} className="bg-white p-4">
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
                        <div>
                          <div
                            className={cn(
                              "overflow-hidden rounded-2xl border border-gray-200 bg-slate-100",
                              s.device === "desktop" ? "aspect-video" : "aspect-[713/620]"
                            )}
                          >
                            {s.type === "video" ? (
                              <video
                                src={s.src}
                                className="h-full w-full object-cover"
                                controls
                                muted
                                playsInline
                              />
                            ) : (
                              <img
                                src={s.src}
                                alt={s.alt || "Hero slide"}
                                className="h-full w-full object-cover"
                              />
                            )}
                          </div>

                          <button
                            onClick={() => copyText(s.src)}
                            className="mt-2 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-gray-50"
                          >
                            <Copy size={14} /> Copy SRC
                          </button>
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="font-extrabold text-slate-900">
                                {s.type === "video" ? (
                                  <span className="inline-flex items-center gap-2">
                                    <Video size={16} /> VIDEO
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-2">
                                    <ImageIcon size={16} /> IMAGE
                                  </span>
                                )}{" "}
                                • Order: {s.order ?? 1000} • Duration:{" "}
                                <span className="inline-flex items-center gap-1">
                                  <Clock3 size={14} />
                                  {clampDurationSeconds(s.durationSeconds, 5)} sec
                                </span>{" "}
                                • {s.isActive ? "ACTIVE" : "INACTIVE"}
                              </div>

                              <div className="mt-1 break-all text-xs text-slate-600">
                                <span className="font-bold">src:</span> {s.src}
                              </div>

                              {!!s.link && (
                                <div className="mt-1 break-all text-xs text-slate-600">
                                  <span className="font-bold">link:</span> {s.link}
                                </div>
                              )}

                              {!!s.alt && (
                                <div className="mt-1 text-xs text-slate-600">
                                  <span className="font-bold">alt:</span> {s.alt}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateSlide(s._id, { isActive: !s.isActive })}
                                className={cn(
                                  "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition",
                                  s.isActive
                                    ? "border-gray-200 bg-white text-slate-800 hover:bg-gray-50"
                                    : "border-gray-200 bg-gray-200 text-gray-700 hover:bg-gray-300"
                                )}
                              >
                                {s.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                {s.isActive ? "Disable" : "Enable"}
                              </button>

                              <button
                                onClick={() => deleteSlide(s._id)}
                                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-red-700"
                              >
                                <Trash2 size={18} /> Delete
                              </button>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div>
                              <label className="text-[11px] font-bold text-slate-600">
                                Change order
                              </label>
                              <input
                                defaultValue={s.order ?? 1000}
                                type="number"
                                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                                onKeyDown={async (e) => {
                                  if (e.key !== "Enter") return;
                                  const val = Number(
                                    (e.target as HTMLInputElement).value || 1000
                                  );
                                  await updateSlide(s._id, { order: val });
                                }}
                              />
                            </div>

                            <div>
                              <label className="text-[11px] font-bold text-slate-600">
                                Stay duration (seconds)
                              </label>
                              <input
                                defaultValue={clampDurationSeconds(s.durationSeconds, 5)}
                                type="number"
                                min={1}
                                max={60}
                                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                                onKeyDown={async (e) => {
                                  if (e.key !== "Enter") return;
                                  const val = clampDurationSeconds(
                                    (e.target as HTMLInputElement).value,
                                    5
                                  );
                                  await updateSlide(s._id, { durationSeconds: val });
                                }}
                              />
                            </div>

                            <div>
                              <label className="text-[11px] font-bold text-slate-600">
                                Edit link
                              </label>
                              <input
                                defaultValue={s.link || ""}
                                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                                onKeyDown={async (e) => {
                                  if (e.key !== "Enter") return;
                                  const val = safeStr(
                                    (e.target as HTMLInputElement).value
                                  );
                                  await updateSlide(s._id, { link: val });
                                }}
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label className="text-[11px] font-bold text-slate-600">
                                Edit ALT / SEO text
                              </label>
                              <input
                                defaultValue={s.alt || ""}
                                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                                onKeyDown={async (e) => {
                                  if (e.key !== "Enter") return;
                                  const val = safeStr(
                                    (e.target as HTMLInputElement).value
                                  );
                                  await updateSlide(s._id, { alt: val });
                                }}
                              />
                            </div>
                          </div>

                          <div className="mt-2 text-[11px] text-slate-500">
                            Order / Duration / Link / ALT field me value change karke{" "}
                            <span className="font-bold">Enter</span> press karo, save ho jayega.
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-slate-50 p-4 text-xs text-slate-600">
            <div className="font-extrabold text-slate-800">Important Notes</div>
            <div className="mt-2 space-y-1">
              <div>• Hardcoded sample slides already frontend se remove kiye ja chuke hain.</div>
              <div>• Agar database me old slides hain to unhe neeche list se delete kar sakte ho.</div>
              <div>• Desktop UI 16:9 frame me show hogi, lekin non-16:9 media bhi upload ki ja sakti hai.</div>
              <div>• UI me media `object-cover` ke saath auto crop hokar fit ho sakti hai.</div>
              <div>• Better homepage speed ke liye lightweight images/videos use karo.</div>
              <div>• Timing seconds me set hoti hai. Recommended range: 3 to 8 seconds.</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
