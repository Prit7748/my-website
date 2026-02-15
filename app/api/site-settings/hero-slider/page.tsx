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
} from "lucide-react";

type Device = "desktop" | "mobile";
type SlideType = "image" | "video";

type Slide = {
  _id: string;
  device: Device;
  type: SlideType;
  src: string;
  link?: string;
  alt?: string;
  isActive?: boolean;
  order?: number;
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

export default function HeroSliderAdminPage() {
  const [device, setDevice] = useState<Device>("desktop");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);

  // form
  const [type, setType] = useState<SlideType>("image");
  const [src, setSrc] = useState("");
  const [link, setLink] = useState("");
  const [alt, setAlt] = useState("");
  const [order, setOrder] = useState<number>(1000);
  const [isActive, setIsActive] = useState(true);

  const sortedSlides = useMemo(() => {
    return [...slides].sort((a, b) => (a.order || 1000) - (b.order || 1000));
  }, [slides]);

  async function load() {
    setLoading(true);
    try {
      const data = await adminFetchJSON(
        `/api/site-settings/hero-slides?admin=1&device=${device}`
      );
      setSlides(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device]);

  async function addSlide() {
    if (!src.trim()) {
      alert("SRC required (image/video path or URL)");
      return;
    }
    await adminFetchJSON(`/api/site-settings/hero-slides`, {
      method: "POST",
      body: JSON.stringify({
        device,
        type,
        src: src.trim(),
        link: link.trim(),
        alt: alt.trim(),
        order,
        isActive,
      }),
    });
    setSrc("");
    setLink("");
    setAlt("");
    setOrder(1000);
    setIsActive(true);
    setType("image");
    await load();
  }

  async function updateSlide(id: string, patch: Partial<Slide>) {
    await adminFetchJSON(`/api/site-settings/hero-slides/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    });
    await load();
  }

  async function deleteSlide(id: string) {
    const ok = confirm("Delete this slide?");
    if (!ok) return;
    await adminFetchJSON(`/api/site-settings/hero-slides/${id}`, {
      method: "DELETE",
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
                <ImageIcon className="text-slate-700" />
                Hero Slider
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Manage Desktop + Mobile slides (order, active, link, src)
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href="/admin/site-settings"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <ArrowLeft size={18} /> Back
              </Link>
            </div>
          </div>

          {/* Device Tabs */}
          <div className="mt-6 flex items-center gap-2">
            <button
              onClick={() => setDevice("desktop")}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-xl border transition font-bold shadow-sm",
                device === "desktop"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white hover:bg-gray-50 border-gray-200 text-slate-700"
              )}
            >
              <Monitor size={18} /> Desktop
            </button>
            <button
              onClick={() => setDevice("mobile")}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-xl border transition font-bold shadow-sm",
                device === "mobile"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white hover:bg-gray-50 border-gray-200 text-slate-700"
              )}
            >
              <Smartphone size={18} /> Mobile
            </button>
          </div>

          {/* Add New Slide */}
          <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5 shadow-sm">
            <div className="font-extrabold text-slate-800 flex items-center gap-2">
              <Plus size={18} /> Add New Slide ({device})
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-600">
                  Type (image/video)
                </label>
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

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-600">
                  SRC (path/URL)
                </label>
                <input
                  value={src}
                  onChange={(e) => setSrc(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  placeholder="/slider1.png or /intro.mp4 or https://..."
                />
                <div className="text-[11px] text-slate-500 mt-1">
                  Desktop: landscape (ex 1920x600). Mobile: portrait/square ratio.
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-600">
                  Link (optional)
                </label>
                <input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  placeholder="/products or /courses etc."
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-600">
                  ALT (optional, recommended for SEO)
                </label>
                <input
                  value={alt}
                  onChange={(e) => setAlt(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  placeholder="IGNOU Solved Assignments - Latest Session"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-600">
                  Active
                </label>
                <button
                  onClick={() => setIsActive((v) => !v)}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-2 rounded-xl border font-bold text-sm transition",
                    isActive
                      ? "bg-white border-gray-200 text-slate-800"
                      : "bg-gray-200 border-gray-200 text-gray-600"
                  )}
                >
                  {isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  {isActive ? "ON" : "OFF"}
                </button>
              </div>

              <div className="md:col-span-2">
                <button
                  onClick={addSlide}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-extrabold shadow-sm"
                >
                  <Save size={18} /> Save Slide
                </button>
              </div>
            </div>
          </div>

          {/* Slides List */}
          <div className="mt-6">
            <div className="font-extrabold text-slate-800">
              Slides ({device})
            </div>

            <div className="mt-3 rounded-2xl border border-gray-200 overflow-hidden">
              {loading ? (
                <div className="p-5 text-sm text-slate-600">Loading...</div>
              ) : sortedSlides.length === 0 ? (
                <div className="p-5 text-sm text-slate-600">
                  No slides yet. Add first slide above.
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {sortedSlides.map((s) => (
                    <div key={s._id} className="p-4 bg-white">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                          <div className="font-extrabold text-slate-900">
                            {s.type.toUpperCase()} • Order: {s.order ?? 1000} •{" "}
                            {s.isActive ? "ACTIVE" : "INACTIVE"}
                          </div>
                          <div className="text-xs text-slate-600 mt-1 break-all">
                            <span className="font-bold">src:</span> {s.src}
                          </div>
                          {s.link ? (
                            <div className="text-xs text-slate-600 mt-1 break-all">
                              <span className="font-bold">link:</span> {s.link}
                            </div>
                          ) : null}
                          {s.alt ? (
                            <div className="text-xs text-slate-600 mt-1">
                              <span className="font-bold">alt:</span> {s.alt}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              updateSlide(s._id, { isActive: !s.isActive })
                            }
                            className={cn(
                              "inline-flex items-center gap-2 px-3 py-2 rounded-xl border font-bold text-sm transition",
                              s.isActive
                                ? "bg-white border-gray-200 text-slate-800 hover:bg-gray-50"
                                : "bg-gray-200 border-gray-200 text-gray-700 hover:bg-gray-300"
                            )}
                          >
                            {s.isActive ? (
                              <ToggleRight size={18} />
                            ) : (
                              <ToggleLeft size={18} />
                            )}
                            {s.isActive ? "Disable" : "Enable"}
                          </button>

                          <button
                            onClick={() => deleteSlide(s._id)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white transition font-bold text-sm"
                          >
                            <Trash2 size={18} /> Delete
                          </button>
                        </div>
                      </div>

                      {/* Quick edit: order */}
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <div className="text-xs font-bold text-slate-600">
                          Change order:
                        </div>
                        <input
                          defaultValue={s.order ?? 1000}
                          type="number"
                          className="w-32 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                          onKeyDown={async (e) => {
                            if (e.key !== "Enter") return;
                            const val = Number(
                              (e.target as HTMLInputElement).value || 1000
                            );
                            await updateSlide(s._id, { order: val });
                          }}
                        />
                        <div className="text-[11px] text-slate-500">
                          Enter press karke save hoga
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Next step: Notifications section backend (ticker/alerts) banayenge.
          </div>
        </div>
      </div>
    </main>
  );
}
