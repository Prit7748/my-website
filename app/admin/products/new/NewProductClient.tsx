// app/admin/products/new/page.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Sparkles, Upload } from "lucide-react";

type CategoryOpt = { label: string; skuSuffix: string; slugKey: string };

// ✅ Combo removed (you will make separate UI for it)
const CATEGORIES: CategoryOpt[] = [
  { label: "Solved Assignments", skuSuffix: "A", slugKey: "solved-assignment" },
  { label: "Question Papers (PYQ)", skuSuffix: "Q", slugKey: "question-paper" },
  { label: "Handwritten PDFs", skuSuffix: "H", slugKey: "handwritten-pdf" },
  { label: "Ebooks", skuSuffix: "E", slugKey: "ebook" },
  { label: "projects", skuSuffix: "P", slugKey: "projects" },
  { label: "Guess Papers", skuSuffix: "G", slugKey: "guess-paper" },
  { label: "Handwritten Hardcopy (Delivery)", skuSuffix: "D", slugKey: "hardcopy-delivery" },
];

const AVAILABILITY = [
  { value: "available", label: "Available (Buy Now)" },
  { value: "coming_soon", label: "Coming Soon" },
  { value: "out_of_stock", label: "Out of Stock" },
] as const;

// ✅ For now hardcoded (later: Master Sessions page + API se load karenge)
const MASTER_SESSIONS = ["2025-2026", "2024-2025", "2023-2024", "2022-2023"];

// ✅ For now basic (later: Indian languages list + master page)
const BASE_LANGS = ["Hindi", "English"] as const;

function slugify(input: string) {
  return (input || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeCode(input: string) {
  return (input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function lang3FromLabel(langLabel: string) {
  const x = (langLabel || "").trim().toUpperCase();
  if (x.startsWith("HIN") || x === "HINDI") return "HIN";
  if (x.startsWith("ENG") || x === "ENGLISH") return "ENG";
  const only = x.replace(/[^A-Z]/g, "");
  return (only.slice(0, 3) || "OTH").padEnd(3, "X");
}

// ✅ Fixed sessionTo6: 2025-2026 => 202526
function sessionTo6(input: string) {
  const s = (input || "").trim();
  if (/^\d{6}$/.test(s)) return s;

  const years4 = s.match(/\d{4}/g) || [];
  if (years4.length >= 2) {
    const y1 = years4[0];
    const y2 = years4[1];
    return `${y1}${y2.slice(-2)}`;
  }

  const m2 = s.match(/(\d{4}).*?(\d{2})\s*$/);
  if (m2) {
    const y1 = m2[1];
    const last2 = m2[2].padStart(2, "0");
    return `${y1}${last2}`;
  }

  const digits = s.replace(/\D/g, "");
  if (digits.length >= 8) return `${digits.slice(0, 4)}${digits.slice(-2)}`;
  if (digits.length >= 6) return digits.slice(0, 6);
  return digits;
}

function splitCsv(input: string) {
  return (input || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

type UploadResp = { ok: boolean; kind: "pdf" | "image"; url?: string; key?: string };

export default function NewProductClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const productId = (sp.get("id") || "").trim();
  const prefillCategory = sp.get("category") || "";
  const isEdit = Boolean(productId);

  const [saving, setSaving] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(false);

  // ✅ Upload busy states
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  // Session & Language mode
  const [sessionMode, setSessionMode] = useState<"master" | "other">("master");
  const [languageMode, setLanguageMode] = useState<"base" | "other">("base");

  const [form, setForm] = useState({
    title: "",
    slug: "",
    category: prefillCategory || "Solved Assignments",

    subjectCode: "",
    subjectTitleHi: "",
    subjectTitleEn: "",
    subjectTitleOther: "",

    courseCodes: "",
    courseTitles: "",

    session: "2025-2026",
    sessionOther: "",

    language: "Hindi",
    languageOther: "",

    price: "",
    oldPrice: "",

    pages: "",
    availability: "available",
    importantNote:
      "Please verify the question paper shown in the preview/thumbnail before purchasing. Purchase only if it matches your subject code, medium, session, and questions.",

    // ✅ Coming Soon config (NEW)
    deliverWithinMinutes: "20",
    comingSoonNote: "",
    autoMakeAvailableOnUpload: true,

    shortDesc: "",
    descriptionHtml: "",

    isDigital: true,

    // ✅ NEW: private S3 key (secure)
    pdfKey: "",

    // (optional legacy field kept in schema; not used now)
    pdfUrl: "",

    imagesText: "",
    isActive: false,

    sku: "",
    metaTitle: "",
    metaDescription: "",
  });

  const selectedSession = useMemo(() => {
    return sessionMode === "master" ? form.session : form.sessionOther;
  }, [sessionMode, form.session, form.sessionOther]);

  const selectedLanguage = useMemo(() => {
    return languageMode === "base" ? form.language : form.languageOther;
  }, [languageMode, form.language, form.languageOther]);

  const selectedCat = useMemo(
    () => CATEGORIES.find((c) => c.label === form.category) || CATEGORIES[0],
    [form.category]
  );

  const normalizedSubject = useMemo(() => normalizeCode(form.subjectCode), [form.subjectCode]);

  const sess6 = useMemo(() => sessionTo6(selectedSession), [selectedSession]);

  const l3 = useMemo(() => lang3FromLabel(selectedLanguage), [selectedLanguage]);

  const suggestedSKU = useMemo(() => {
    const suf = selectedCat.skuSuffix;
    const code = normalizedSubject || "CODE";
    return `${code}${l3}${sess6}${suf}`.slice(0, 40);
  }, [normalizedSubject, l3, sess6, selectedCat.skuSuffix]);

  const suggestedSlug = useMemo(() => {
    const code = normalizedSubject || "product";
    const sess = (selectedSession || "").trim();
    const lang = (selectedLanguage || "").toLowerCase().includes("hin") ? "hindi" : "english";
    const core = ["ignou", code, selectedCat.slugKey, sess, lang].filter(Boolean).join(" ");
    return slugify(core);
  }, [normalizedSubject, selectedSession, selectedLanguage, selectedCat.slugKey]);

  const suggestedMetaTitle = useMemo(() => {
    const code = normalizedSubject || "PRODUCT";
    const sess = (selectedSession || "").trim();
    const lang = (selectedLanguage || "").toLowerCase().includes("hin") ? "Hindi" : "English";
    const cat = form.category;
    return `IGNOU ${code} ${cat} ${sess} (${lang}) – Download PDF`;
  }, [normalizedSubject, selectedSession, selectedLanguage, form.category]);

  const suggestedMetaDesc = useMemo(() => {
    const code = normalizedSubject || "product";
    const sess = (selectedSession || "").trim();
    const lang = (selectedLanguage || "").toLowerCase().includes("hin") ? "Hindi" : "English";
    return `Download IGNOU ${code} ${form.category} for session ${sess} (${lang}). Verified content, instant access, and clear formatting.`;
  }, [normalizedSubject, selectedSession, selectedLanguage, form.category]);

  const imagesArray = useMemo(() => {
    return (form.imagesText || "")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
  }, [form.imagesText]);

  const activeSubjectTitle = useMemo(() => {
    if (languageMode === "other" && form.subjectTitleOther) return form.subjectTitleOther.trim();
    return (selectedLanguage || "").toLowerCase().includes("hin")
      ? form.subjectTitleHi.trim()
      : form.subjectTitleEn.trim();
  }, [selectedLanguage, form.subjectTitleHi, form.subjectTitleEn, languageMode, form.subjectTitleOther]);

  function applyAutoFill() {
    setForm((p) => ({
      ...p,
      slug: p.slug || suggestedSlug,
      sku: p.sku || suggestedSKU,
      metaTitle: p.metaTitle || suggestedMetaTitle,
      metaDescription: p.metaDescription || suggestedMetaDesc,
    }));
  }

  // ✅ Upload helper (expects /api/admin/upload returning { key, url(for images) })
  async function uploadFile(file: File, kind: "pdf" | "image") {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);

    const res = await fetch("/api/admin/upload", {
      method: "POST",
      credentials: "include",
      body: fd,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || data?.details || "Upload failed");
    return data as UploadResp;
  }

  async function handlePdfPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPdf(true);
    try {
      const out = await uploadFile(file, "pdf");
      const key = String(out?.key || "").trim();
      if (!key) throw new Error("Upload succeeded but key missing");
      setForm((p) => ({ ...p, pdfKey: key }));
      alert("PDF uploaded ✅ (private)");
    } catch (err: any) {
      alert(err?.message || "PDF upload failed");
    } finally {
      setUploadingPdf(false);
      e.target.value = "";
    }
  }

  async function handleImagesPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploadingImages(true);
    try {
      const urls: string[] = [];
      for (const f of files) {
        const out = await uploadFile(f, "image");
        const url = String(out?.url || "").trim();
        if (!url) throw new Error("Image upload succeeded but url missing");
        urls.push(url);
      }

      setForm((p) => {
        const existing = (p.imagesText || "")
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean);
        return { ...p, imagesText: [...existing, ...urls].join("\n") };
      });

      alert(`Images uploaded ✅ (${urls.length})`);
    } catch (err: any) {
      alert(err?.message || "Images upload failed");
    } finally {
      setUploadingImages(false);
      e.target.value = "";
    }
  }

  // ✅ EDIT MODE: load product by id
  useEffect(() => {
    if (!isEdit) return;

    (async () => {
      setLoadingProduct(true);
      try {
        const res = await fetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data?.error || "Failed to load product");
          return;
        }
        const p = data?.product;
        if (!p?._id) {
          alert("Product data missing");
          return;
        }

        // session mode
        const sess = String(p.session || "");
        const isMasterSess = MASTER_SESSIONS.includes(sess);
        setSessionMode(isMasterSess ? "master" : "other");

        // language mode
        const lang = String(p.language || "");
        const isBaseLang = (BASE_LANGS as readonly string[]).includes(lang);
        setLanguageMode(isBaseLang ? "base" : "other");

        setForm((prev) => ({
          ...prev,
          title: String(p.title || ""),
          slug: String(p.slug || ""),
          category: String(p.category || "Solved Assignments"),

          subjectCode: String(p.subjectCode || ""),
          subjectTitleHi: String(p.subjectTitleHi || ""),
          subjectTitleEn: String(p.subjectTitleEn || ""),
          subjectTitleOther: "",

          courseCodes: Array.isArray(p.courseCodes) ? p.courseCodes.join(", ") : "",
          courseTitles: Array.isArray(p.courseTitles) ? p.courseTitles.join(", ") : "",

          session: isMasterSess ? sess : prev.session,
          sessionOther: isMasterSess ? "" : sess,

          language: isBaseLang ? lang : prev.language,
          languageOther: isBaseLang ? "" : lang,

          price: String(p.price ?? ""),
          oldPrice: String(p.oldPrice ?? ""),

          pages: String(p.pages ?? ""),
          availability: String(p.availability || "available"),
          importantNote: String(p.importantNote || prev.importantNote),

          // ✅ Coming Soon config (NEW)
          deliverWithinMinutes: String(p.deliverWithinMinutes ?? prev.deliverWithinMinutes),
          comingSoonNote: String(p.comingSoonNote || ""),
          autoMakeAvailableOnUpload: Boolean(p.autoMakeAvailableOnUpload ?? true),

          shortDesc: String(p.shortDesc || ""),
          descriptionHtml: String(p.descriptionHtml || ""),

          isDigital: Boolean(p.isDigital ?? true),

          pdfKey: String(p.pdfKey || ""),
          pdfUrl: String(p.pdfUrl || ""),

          imagesText: Array.isArray(p.images) ? p.images.join("\n") : "",

          isActive: Boolean(p.isActive ?? false),

          sku: String(p.sku || ""),
          metaTitle: String(p.metaTitle || ""),
          metaDescription: String(p.metaDescription || ""),
        }));
      } catch (e: any) {
        alert(e?.message || "Load failed");
      } finally {
        setLoadingProduct(false);
      }
    })();
  }, [isEdit, productId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (!form.title.trim()) return alert("Title required hai.");
    if (!form.category) return alert("Category required hai.");
    if (!form.subjectCode.trim()) return alert("Subject Code required hai.");

    if (!selectedSession.trim()) return alert("Session required hai.");
    if (!sess6 || sess6.length !== 6) return alert("Session format galat hai. Example: 2025-2026");
    if (!selectedLanguage.trim()) return alert("Language required hai.");

    if (!form.price.trim() || Number(form.price) <= 0) return alert("Valid price required hai.");
    const skuFinal = (form.sku || suggestedSKU).trim();
    if (!skuFinal) return alert("Unique ID / SKU required hai.");

    const images = (form.imagesText || "")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);

    const finalSubjectTitleHi =
      languageMode === "other" && form.subjectTitleOther
        ? form.subjectTitleOther.trim()
        : form.subjectTitleHi || "";

    // ✅ UPDATED RULE: PDF only mandatory when (digital + availability=available)
    if (form.isDigital && String(form.availability) === "available" && !form.pdfKey.trim()) {
      return alert("Availability 'Available' ke liye PDF upload required hai (pdfKey missing).");
    }

    // ✅ Coming Soon minutes validation only when coming_soon
    if (String(form.availability) === "coming_soon") {
      const mins = Number(form.deliverWithinMinutes || 0);
      if (!Number.isFinite(mins) || mins < 1 || mins > 1440) {
        return alert("Coming Soon delivery minutes 1 se 1440 ke beech me hone chahiye.");
      }
    }

    const payload = {
      title: form.title.trim(),
      slug: (form.slug || suggestedSlug).trim(),
      sku: skuFinal,
      category: form.category,

      subjectCode: form.subjectCode.trim(),
      subjectTitleHi: finalSubjectTitleHi,
      subjectTitleEn: form.subjectTitleEn || "",

      courseCodes: splitCsv(form.courseCodes),
      courseTitles: splitCsv(form.courseTitles),

      session: selectedSession.trim(),
      session6: sess6,
      language: selectedLanguage.trim(),
      lang3: l3,

      price: Number(form.price),
      oldPrice: Number(form.oldPrice || 0),

      pages: Number(form.pages || 0),
      availability: form.availability,
      importantNote: form.importantNote || "",

      // ✅ Coming Soon config (NEW)
      deliverWithinMinutes:
        String(form.availability) === "coming_soon" ? Number(form.deliverWithinMinutes || 20) : Number(form.deliverWithinMinutes || 20),
      comingSoonNote: String(form.comingSoonNote || ""),
      autoMakeAvailableOnUpload: Boolean(form.autoMakeAvailableOnUpload),

      shortDesc: form.shortDesc || "",
      descriptionHtml: form.descriptionHtml || "",

      isDigital: Boolean(form.isDigital),

      pdfKey: form.pdfKey || "",
      pdfUrl: form.pdfUrl || "",

      images,

      metaTitle: form.metaTitle || suggestedMetaTitle,
      metaDescription: form.metaDescription || suggestedMetaDesc,

      isActive: Boolean(form.isActive),
    };

    setSaving(true);
    try {
      const url = isEdit
        ? `/api/admin/products/${encodeURIComponent(productId)}`
        : "/api/admin/products";

      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || "Failed to save product");
        return;
      }

      alert(isEdit ? "Product updated ✅" : "Product saved ✅");
      router.push("/admin/products");
      router.refresh(); // optionally refresh router cache
    } catch (err: any) {
      alert("Server error: " + (err?.message || "unknown"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <div className="max-w-[1200px] mx-auto px-4 py-8">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-extrabold">{isEdit ? "Edit Product" : "Add New Product"}</h1>
              <div className="text-sm text-slate-600 mt-1">
                {isEdit ? "Edit mode: product auto-load ho raha hai." : "Session dropdown + Language + Upload PDF/Images."}
              </div>
              {prefillCategory && !isEdit && (
                <p className="text-sm text-blue-600 font-semibold mt-1">Prefilled Category: {prefillCategory}</p>
              )}
              {loadingProduct && (
                <div className="text-xs text-slate-500 mt-2">Loading product...</div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <ArrowLeft size={18} />
                Back
              </Link>

              <button
                type="button"
                onClick={applyAutoFill}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 transition font-bold shadow-sm"
              >
                <Sparkles size={18} />
                Auto-fill SEO/SKU
              </button>
            </div>
          </div>

          <form onSubmit={handleSave} className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl border border-gray-200 p-5 bg-gray-50">
                <div className="text-sm font-extrabold mb-3">Core Details</div>

                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Title</label>
                <input
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                  placeholder="IGNOU BHIC-109 Solved Assignment 2025-2026 (Hindi)"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                      Category (Single)
                    </label>
                    <select
                      className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                      value={form.category}
                      onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.label} value={c.label}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <div className="text-[11px] text-slate-500 mt-1">
                      SKU last letter: <b>{selectedCat.skuSuffix}</b>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                      Unique ID (SKU, max 40)
                    </label>
                    <input
                      className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                      placeholder={suggestedSKU}
                      value={form.sku}
                      onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value.toUpperCase() }))}
                    />
                    <div className="text-[11px] text-slate-500 mt-1">
                      Suggested: <b>{suggestedSKU}</b>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                      Subject Code (single)
                    </label>
                    <input
                      className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                      placeholder="BHIC 109"
                      value={form.subjectCode}
                      onChange={(e) => setForm((p) => ({ ...p, subjectCode: e.target.value }))}
                    />
                    <div className="text-[11px] text-slate-500 mt-1">
                      Normalized: <b>{normalizedSubject || "—"}</b>
                    </div>
                  </div>

                  {/* SESSION */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Session</label>

                    <div className="mt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSessionMode("master");
                          setForm((p) => ({ ...p, sessionOther: "" }));
                        }}
                        className={`px-3 py-2 rounded-xl border text-sm font-bold transition ${
                          sessionMode === "master"
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        Master
                      </button>

                      <button
                        type="button"
                        onClick={() => setSessionMode("other")}
                        className={`px-3 py-2 rounded-xl border text-sm font-bold transition ${
                          sessionMode === "other"
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        Other
                      </button>
                    </div>

                    {sessionMode === "master" ? (
                      <select
                        className="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                        value={form.session}
                        onChange={(e) => setForm((p) => ({ ...p, session: e.target.value }))}
                      >
                        {MASTER_SESSIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                        placeholder="e.g. 2025-2026"
                        value={form.sessionOther}
                        onChange={(e) => setForm((p) => ({ ...p, sessionOther: e.target.value }))}
                      />
                    )}

                    <div className="text-[11px] text-slate-500 mt-1">
                      Session6: <b>{sess6 || "—"}</b>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Language</label>

                    <div className="mt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setLanguageMode("base");
                          setForm((p) => ({ ...p, languageOther: "" }));
                        }}
                        className={`px-3 py-2 rounded-xl border text-sm font-bold transition ${
                          languageMode === "base"
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        Hindi/English
                      </button>

                      <button
                        type="button"
                        onClick={() => setLanguageMode("other")}
                        className={`px-3 py-2 rounded-xl border text-sm font-bold transition ${
                          languageMode === "other"
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        Other
                      </button>
                    </div>

                    {languageMode === "base" ? (
                      <select
                        className="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                        value={form.language}
                        onChange={(e) => setForm((p) => ({ ...p, language: e.target.value }))}
                      >
                        {BASE_LANGS.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                        placeholder="e.g. Bengali / Marathi / Tamil"
                        value={form.languageOther}
                        onChange={(e) => setForm((p) => ({ ...p, languageOther: e.target.value }))}
                      />
                    )}

                    <div className="text-[11px] text-slate-500 mt-1">
                      Lang3: <b>{l3}</b> (SKU uses this)
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">No. of Pages</label>
                    <input
                      type="number"
                      min={1}
                      className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                      placeholder="e.g. 60"
                      value={form.pages}
                      onChange={(e) => setForm((p) => ({ ...p, pages: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Subject Title (Hindi)</label>
                    <input
                      className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                      placeholder="भारत का इतिहास -V (c.1550-1605)"
                      value={form.subjectTitleHi}
                      onChange={(e) => setForm((p) => ({ ...p, subjectTitleHi: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Subject Title (English)</label>
                    <input
                      className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                      placeholder="History of India-V (c.1550-1605)"
                      value={form.subjectTitleEn}
                      onChange={(e) => setForm((p) => ({ ...p, subjectTitleEn: e.target.value }))}
                    />
                  </div>
                </div>

                {languageMode === "other" && (
                  <div className="mt-3">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                      Subject Title (Other Language)
                    </label>
                    <input
                      className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                      placeholder="e.g. تاریخ (Urdu Title)"
                      value={form.subjectTitleOther}
                      onChange={(e) => setForm((p) => ({ ...p, subjectTitleOther: e.target.value }))}
                    />
                    <div className="text-[11px] text-slate-500 mt-1">
                      Note: This will be saved as the primary/vernacular title.
                    </div>
                  </div>
                )}

                <div className="text-[11px] text-slate-500 mt-2">
                  Current active title (based on language): <b>{activeSubjectTitle || "—"}</b>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 mt-4">
                  <div className="text-sm font-extrabold">Course Mapping (for filters)</div>

                  <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-3 block">
                    Course Code(s) (comma separated)
                  </label>
                  <input
                    className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-blue-500 transition font-medium"
                    placeholder="BAHIH, BAG"
                    value={form.courseCodes}
                    onChange={(e) => setForm((p) => ({ ...p, courseCodes: e.target.value.toUpperCase() }))}
                  />

                  <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-3 block">
                    Course Title(s) (optional, comma separated same order)
                  </label>
                  <input
                    className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-blue-500 transition font-medium"
                    placeholder="Bachelor of Arts (Honours) History (BAHIH), Bachelor of Arts (General) (BAG)"
                    value={form.courseTitles}
                    onChange={(e) => setForm((p) => ({ ...p, courseTitles: e.target.value }))}
                  />

                  <div className="text-[11px] text-slate-500 mt-2">
                    Parsed codes: <b>{splitCsv(form.courseCodes).join(", ") || "—"}</b>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Price</label>
                    <input
                      className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                      placeholder="35"
                      value={form.price}
                      onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Old Price</label>
                    <input
                      className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                      placeholder="50"
                      value={form.oldPrice}
                      onChange={(e) => setForm((p) => ({ ...p, oldPrice: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Availability</label>
                  <select
                    className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                    value={form.availability}
                    onChange={(e) => setForm((p) => ({ ...p, availability: e.target.value }))}
                  >
                    {AVAILABILITY.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>

                {String(form.availability) === "coming_soon" && (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="text-sm font-extrabold">Coming Soon Settings</div>

                    <label className="text-xs font-bold text-slate-600 uppercase ml-1 mt-3 block">
                      Deliver Within (minutes)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={1440}
                      className="w-full mt-1 px-4 py-3 rounded-xl border border-amber-200 bg-white outline-none focus:border-amber-500 transition font-medium"
                      placeholder="20"
                      value={form.deliverWithinMinutes}
                      onChange={(e) => setForm((p) => ({ ...p, deliverWithinMinutes: e.target.value }))}
                    />
                    <div className="text-[11px] text-slate-600 mt-1">
                      Tip: user dashboard me countdown/show trust UI isi minutes se driven hoga.
                    </div>

                    <label className="text-xs font-bold text-slate-600 uppercase ml-1 mt-3 block">
                      Trust Note (optional)
                    </label>
                    <textarea
                      className="w-full mt-1 px-4 py-3 rounded-xl border border-amber-200 bg-white outline-none focus:border-amber-500 transition font-medium min-h-[90px]"
                      placeholder="Example: Your material will be uploaded and available in your dashboard shortly after purchase."
                      value={form.comingSoonNote}
                      onChange={(e) => setForm((p) => ({ ...p, comingSoonNote: e.target.value }))}
                    />

                    <div className="flex items-center gap-3 mt-3">
                      <input
                        type="checkbox"
                        checked={form.autoMakeAvailableOnUpload}
                        onChange={(e) => setForm((p) => ({ ...p, autoMakeAvailableOnUpload: e.target.checked }))}
                        className="h-4 w-4"
                      />
                      <div className="font-bold">
                        Auto switch to <span className="underline">Available</span> after PDF upload
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-1">
                      Isse admin jab PDF upload karega to next time product normal “available” ki tarah behave karega (hum next steps me upload hook me implement karenge).
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Important Note</label>
                  <textarea
                    className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium min-h-[100px]"
                    value={form.importantNote}
                    onChange={(e) => setForm((p) => ({ ...p, importantNote: e.target.value }))}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 p-5 bg-white">
                <div className="text-sm font-extrabold mb-3">Descriptions</div>

                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Short Description</label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium min-h-[80px]"
                  value={form.shortDesc}
                  onChange={(e) => setForm((p) => ({ ...p, shortDesc: e.target.value }))}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                  Long Description
                </label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium min-h-[140px]"
                  value={form.descriptionHtml}
                  onChange={(e) => setForm((p) => ({ ...p, descriptionHtml: e.target.value }))}
                />
              </div>

              <div className="rounded-2xl border border-gray-200 p-5 bg-gray-50">
                <div className="text-sm font-extrabold mb-3">Digital + Images</div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={form.isDigital}
                    onChange={(e) => setForm((p) => ({ ...p, isDigital: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  <div className="font-bold">This is a Digital Product (PDF)</div>
                </div>

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                  Upload PDF (select file)
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handlePdfPick}
                  disabled={uploadingPdf}
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                />
                <div className="text-[11px] text-slate-500 mt-1">
                  {uploadingPdf
                    ? "Uploading PDF..."
                    : String(form.availability) === "available"
                    ? "Available mode me PDF must hai; upload ke baad pdfKey auto fill hoga."
                    : "Coming Soon/Out of Stock me PDF optional hai; baad me upload kar sakte ho."}
                </div>

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                  PDF Key (private)
                </label>
                <input
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                  placeholder="uploads/pdfs/....pdf"
                  value={form.pdfKey}
                  onChange={(e) => setForm((p) => ({ ...p, pdfKey: e.target.value }))}
                />
                <div className="text-[11px] text-slate-500 mt-1">
                  Note: Direct public URL store नहीं होगा. Download हमेशा secure API से होगा.
                </div>

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                  Upload Images (thumbnail first)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImagesPick}
                  disabled={uploadingImages}
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                />
                <div className="text-[11px] text-slate-500 mt-1">
                  {uploadingImages ? "Uploading images..." : "Rule: 1st = thumbnail, 2nd = quickview (upload order)."}
                </div>

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                  Image URLs (one per line)
                </label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium min-h-[120px]"
                  placeholder={"https://.../1.jpg\nhttps://.../2.jpg"}
                  value={form.imagesText}
                  onChange={(e) => setForm((p) => ({ ...p, imagesText: e.target.value }))}
                />
                <div className="text-[11px] text-slate-500 mt-1">
                  Total images: <b>{imagesArray.length}</b>
                </div>

                <div className="flex items-center gap-3 mt-4">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  <div className="font-bold">
                    Publish now (Active){" "}
                    <span className="text-xs text-slate-500 font-semibold">(Draft recommended)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 p-5 bg-white">
                <div className="text-sm font-extrabold mb-3">SEO</div>

                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Slug</label>
                <input
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                  placeholder={suggestedSlug}
                  value={form.slug}
                  onChange={(e) => setForm((p) => ({ ...p, slug: slugify(e.target.value) }))}
                />
                <div className="text-[11px] text-slate-500 mt-1">
                  Suggested: <b>{suggestedSlug}</b>
                </div>

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                  Meta Title
                </label>
                <input
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                  placeholder={suggestedMetaTitle}
                  value={form.metaTitle}
                  onChange={(e) => setForm((p) => ({ ...p, metaTitle: e.target.value }))}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                  Meta Description
                </label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium min-h-[110px]"
                  placeholder={suggestedMetaDesc}
                  value={form.metaDescription}
                  onChange={(e) => setForm((p) => ({ ...p, metaDescription: e.target.value }))}
                />

                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs font-bold text-slate-500 uppercase">Google Preview</div>
                  <div className="mt-2 text-blue-700 font-bold text-sm line-clamp-2">
                    {form.metaTitle || suggestedMetaTitle}
                  </div>
                  <div className="text-xs text-emerald-700 mt-1">
                    https://istudentsportal.com/product/{form.slug || suggestedSlug}
                  </div>
                  <div className="text-xs text-slate-600 mt-1 line-clamp-3">
                    {form.metaDescription || suggestedMetaDesc}
                  </div>
                </div>
              </div>

              <button
                disabled={saving || uploadingPdf || uploadingImages || loadingProduct}
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-950 text-white transition font-extrabold disabled:opacity-60"
              >
                <Save size={18} />
                {saving ? "Saving..." : isEdit ? "Update Product" : "Save Product"}
              </button>

              <div className="text-[11px] text-slate-500">
                Note: Master sessions abhi hardcoded hain. Next step me Sessions master page + API se real dropdown aayega.
              </div>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}