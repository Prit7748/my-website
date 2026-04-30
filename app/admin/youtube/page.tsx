"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clipboard,
  Copy,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Info,
  LoaderCircle,
  RefreshCcw,
  Save,
  Search,
  Settings2,
  Upload,
  Youtube,
  X,
} from "lucide-react";

type YoutubeContentKind = "assignment" | "pyq";

type YoutubeTextBlock = {
  isEnabled: boolean;
  titleTemplate: string;
  descriptionTemplate: string;
  pinnedCommentTemplate: string;
};

type YoutubeThumbField = {
  key: string;
  label: string;
  enabled: boolean;
  token: string;
  fallbackText: string;
  x: number;
  y: number;
  width: number;
  maxLines: number;
  fontSize: number;
  minFontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontFamily: string;
  fontWeight: number;
  color: string;
  align: "left" | "center" | "right";
  uppercase: boolean;
};

type YoutubeThumbBlock = {
  isEnabled: boolean;
  templateImageUrl: string;
  width: number;
  height: number;
  outputFilePrefix: string;
  fields: YoutubeThumbField[];
};

type YoutubeConfig = {
  assignment: YoutubeTextBlock;
  pyq: YoutubeTextBlock;
  assignmentThumbnail: YoutubeThumbBlock;
  pyqThumbnail: YoutubeThumbBlock;
  updatedBy?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type TokenInfo = {
  token: string;
  label: string;
  description: string;
};

type ProductOption = {
  _id: string;
  kind: YoutubeContentKind;
  kindLabel: string;
  title: string;
  sku: string;
  slug: string;
  category: string;
  subjectCode: string;
  subjectTitle: string;
  courseCodes: string;
  courseTitles: string;
  session: string;
  medium: string;
  productLink: string;
  isActive: boolean;
  availability: string;
};

type ProductsResponse = {
  ok?: boolean;
  error?: string;
  products?: ProductOption[];
  filterOptions?: {
    sessions?: Array<{ _id: string; name: string; slug: string }>;
    mediums?: string[];
    categories?: Array<{ label: string; kind: string; slugKey: string }>;
  };
  pagination?: {
    page: number;
    limit: number;
    totalPages: number;
    total: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
  };
};

type GeneratedItem = {
  kind: YoutubeContentKind;
  product: {
    id: string;
    title: string;
    sku: string;
    slug: string;
    category: string;
    subjectCode: string;
    subjectTitle: string;
    courseCodes: string;
    courseTitles: string;
    session: string;
    medium: string;
    productLink: string;
  };
  generated: {
    title: string;
    description: string;
    pinnedComment: string;
  };
  thumbnail: {
    previewUrl: string;
    svgUrl: string;
    downloadFileName: string;
    width: number;
    height: number;
  };
  tokens: Record<string, string>;
};

type GenerateResponse = {
  ok?: boolean;
  error?: string;
  item?: GeneratedItem;
};

type TemplateResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  item?: YoutubeConfig;
  defaults?: YoutubeConfig;
  tokens?: TokenInfo[];
};

type ActiveTab = "generator" | "templates" | "thumbnails";
type TemplateKindTab = YoutubeContentKind;

const DEFAULT_TEXT_BLOCK: YoutubeTextBlock = {
  isEnabled: true,
  titleTemplate: "",
  descriptionTemplate: "",
  pinnedCommentTemplate: "",
};

const DEFAULT_THUMB_BLOCK: YoutubeThumbBlock = {
  isEnabled: true,
  templateImageUrl: "",
  width: 1280,
  height: 720,
  outputFilePrefix: "ignou-youtube-thumbnail",
  fields: [],
};

const DEFAULT_CONFIG: YoutubeConfig = {
  assignment: DEFAULT_TEXT_BLOCK,
  pyq: DEFAULT_TEXT_BLOCK,
  assignmentThumbnail: DEFAULT_THUMB_BLOCK,
  pyqThumbnail: DEFAULT_THUMB_BLOCK,
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def: number) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function withCacheBust(url: string, nonce: number) {
  const raw = safeStr(url);
  if (!raw) return "";
  return `${raw}${raw.includes("?") ? "&" : "?"}cb=${nonce}`;
}

function copyLabel(text: string) {
  return text.length > 28 ? `${text.slice(0, 28)}...` : text;
}

function normalizeTemplateConfig(input: any): YoutubeConfig {
  return {
    assignment: {
      ...DEFAULT_TEXT_BLOCK,
      ...(input?.assignment || {}),
    },
    pyq: {
      ...DEFAULT_TEXT_BLOCK,
      ...(input?.pyq || {}),
    },
    assignmentThumbnail: {
      ...DEFAULT_THUMB_BLOCK,
      ...(input?.assignmentThumbnail || {}),
      fields: Array.isArray(input?.assignmentThumbnail?.fields)
        ? input.assignmentThumbnail.fields
        : [],
    },
    pyqThumbnail: {
      ...DEFAULT_THUMB_BLOCK,
      ...(input?.pyqThumbnail || {}),
      fields: Array.isArray(input?.pyqThumbnail?.fields)
        ? input.pyqThumbnail.fields
        : [],
    },
    updatedBy: safeStr(input?.updatedBy),
    createdAt: input?.createdAt || null,
    updatedAt: input?.updatedAt || null,
  };
}

function fieldNumber(value: any, fallback: number) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function availabilityText(input: string) {
  const v = safeStr(input).toLowerCase();
  if (v === "available") return "Available";
  if (v === "on_demand") return "On Demand";
  if (v === "want_to_buy") return "Want to Buy";
  return v || "Unknown";
}

function kindText(kind: YoutubeContentKind | string) {
  if (kind === "assignment") return "Assignment";
  if (kind === "pyq") return "PYQ";
  return "YouTube";
}

function buildPublicPreview(url: string) {
  const raw = safeStr(url);
  if (!raw) return "";
  return raw;
}

export default function AdminYoutubePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("generator");
  const [templateKindTab, setTemplateKindTab] =
    useState<TemplateKindTab>("assignment");

  const [config, setConfig] = useState<YoutubeConfig>(DEFAULT_CONFIG);
  const [defaults, setDefaults] = useState<YoutubeConfig>(DEFAULT_CONFIG);
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesSaving, setTemplatesSaving] = useState(false);
  const [templateMessage, setTemplateMessage] = useState("");
  const [templateMessageType, setTemplateMessageType] = useState<
    "success" | "error" | "info"
  >("info");

  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState("");
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(
    null
  );
  const [generated, setGenerated] = useState<GeneratedItem | null>(null);
  const [generating, setGenerating] = useState(false);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");
  const [mediumFilter, setMediumFilter] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);
  const [sortBy, setSortBy] = useState("latest");
  const [page, setPage] = useState(1);

  const [sessionOptions, setSessionOptions] = useState<
    Array<{ _id: string; name: string; slug: string }>
  >([]);
  const [mediumOptions, setMediumOptions] = useState<string[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [copiedKey, setCopiedKey] = useState("");
  const [uploadingKey, setUploadingKey] = useState("");
  const [previewNonce, setPreviewNonce] = useState(Date.now());
  const [downloading, setDownloading] = useState(false);

  const searchSeq = useRef(0);

  const currentTextBlock = useMemo(() => {
    return templateKindTab === "pyq" ? config.pyq : config.assignment;
  }, [config, templateKindTab]);

  const currentThumbKey = useMemo(() => {
    return templateKindTab === "pyq" ? "pyqThumbnail" : "assignmentThumbnail";
  }, [templateKindTab]);

  const currentThumbBlock = useMemo(() => {
    return templateKindTab === "pyq"
      ? config.pyqThumbnail
      : config.assignmentThumbnail;
  }, [config, templateKindTab]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);

    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, categoryFilter, sessionFilter, mediumFilter, onlyActive, sortBy]);

  useEffect(() => {
    void loadTemplates();
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [
    debouncedQuery,
    categoryFilter,
    sessionFilter,
    mediumFilter,
    onlyActive,
    sortBy,
    page,
  ]);

  useEffect(() => {
    if (!copiedKey) return;
    const t = window.setTimeout(() => setCopiedKey(""), 1200);
    return () => window.clearTimeout(t);
  }, [copiedKey]);

  async function loadTemplates(showMessage = false) {
    setTemplatesLoading(true);

    try {
      const res = await fetch("/api/admin/youtube/templates", {
        credentials: "include",
        cache: "no-store",
      });

      const data: TemplateResponse = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to load YouTube templates");
      }

      setConfig(normalizeTemplateConfig(data.item));
      setDefaults(normalizeTemplateConfig(data.defaults));
      setTokens(Array.isArray(data.tokens) ? data.tokens : []);
      setPreviewNonce(Date.now());

      if (showMessage) {
        setTemplateMessage("YouTube templates loaded successfully.");
        setTemplateMessageType("info");
      }
    } catch (e: any) {
      setTemplateMessage(e?.message || "Failed to load YouTube templates");
      setTemplateMessageType("error");
    } finally {
      setTemplatesLoading(false);
    }
  }

  async function saveTemplates(nextConfig = config) {
    setTemplatesSaving(true);
    setTemplateMessage("");

    try {
      const res = await fetch("/api/admin/youtube/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(nextConfig),
      });

      const data: TemplateResponse = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to save YouTube templates");
      }

      setConfig(normalizeTemplateConfig(data.item));
      setDefaults(normalizeTemplateConfig(data.defaults));
      setTokens(Array.isArray(data.tokens) ? data.tokens : tokens);
      setPreviewNonce(Date.now());
      setTemplateMessage(data.message || "YouTube templates saved successfully.");
      setTemplateMessageType("success");

      if (selectedProduct) {
        await generateForProduct(selectedProduct, false);
      }
    } catch (e: any) {
      const msg = e?.message || "Failed to save YouTube templates";
      setTemplateMessage(msg);
      setTemplateMessageType("error");
      alert(msg);
    } finally {
      setTemplatesSaving(false);
    }
  }

  async function resetTemplates() {
    const ok = window.confirm(
      "Reset YouTube title, description, pinned comment and thumbnail settings to default?"
    );
    if (!ok) return;

    setTemplatesSaving(true);
    setTemplateMessage("");

    try {
      const res = await fetch("/api/admin/youtube/templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode: "reset" }),
      });

      const data: TemplateResponse = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to reset templates");
      }

      setConfig(normalizeTemplateConfig(data.item));
      setDefaults(normalizeTemplateConfig(data.defaults));
      setTokens(Array.isArray(data.tokens) ? data.tokens : []);
      setPreviewNonce(Date.now());
      setTemplateMessage(data.message || "Default templates restored.");
      setTemplateMessageType("success");

      if (selectedProduct) {
        await generateForProduct(selectedProduct, false);
      }
    } catch (e: any) {
      const msg = e?.message || "Failed to reset templates";
      setTemplateMessage(msg);
      setTemplateMessageType("error");
      alert(msg);
    } finally {
      setTemplatesSaving(false);
    }
  }

  async function loadProducts() {
    const seq = ++searchSeq.current;
    setProductsLoading(true);
    setProductsError("");

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      params.set("sortBy", sortBy);
      params.set("onlyActive", onlyActive ? "1" : "0");

      if (debouncedQuery) params.set("q", debouncedQuery);
      if (categoryFilter) params.set("category", categoryFilter);
      if (sessionFilter) params.set("session", sessionFilter);
      if (mediumFilter) params.set("medium", mediumFilter);

      const res = await fetch(`/api/admin/youtube/products?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });

      const data: ProductsResponse = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to load YouTube products");
      }

      if (seq !== searchSeq.current) return;

      setProducts(Array.isArray(data.products) ? data.products : []);
      setSessionOptions(
        Array.isArray(data.filterOptions?.sessions)
          ? data.filterOptions.sessions
          : []
      );
      setMediumOptions(
        Array.isArray(data.filterOptions?.mediums)
          ? data.filterOptions.mediums
          : []
      );

      const nextTotalPages = Math.max(1, Number(data.pagination?.totalPages || 1));
      setTotalPages(nextTotalPages);
      setTotalProducts(Number(data.pagination?.total || 0));

      if (page > nextTotalPages) {
        setPage(nextTotalPages);
      }
    } catch (e: any) {
      if (seq !== searchSeq.current) return;
      setProducts([]);
      setTotalProducts(0);
      setTotalPages(1);
      setProductsError(e?.message || "Failed to load products");
    } finally {
      if (seq === searchSeq.current) {
        setProductsLoading(false);
      }
    }
  }

  async function generateForProduct(product: ProductOption, switchTab = true) {
    setSelectedProduct(product);
    setGenerating(true);

    if (switchTab) {
      setActiveTab("generator");
    }

    try {
      const res = await fetch("/api/admin/youtube/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productId: product._id }),
      });

      const data: GenerateResponse = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok || !data.item) {
        throw new Error(data?.error || "Failed to generate YouTube content");
      }

      setGenerated(data.item);
      setPreviewNonce(Date.now());
    } catch (e: any) {
      alert(e?.message || "Failed to generate YouTube content");
      setGenerated(null);
    } finally {
      setGenerating(false);
    }
  }

  async function copyText(key: string, value: string) {
    const text = safeStr(value);
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedKey(key);
    }
  }

  async function uploadThumbnailTemplate(kind: TemplateKindTab, file: File | null) {
    if (!file) return;

    const key = kind === "pyq" ? "pyqThumbnail" : "assignmentThumbnail";
    setUploadingKey(key);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", "image");
      form.append("destination", "youtube-thumbnail");

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        credentials: "include",
        body: form,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = [data?.error, data?.details, data?.code]
          .map(safeStr)
          .filter(Boolean)
          .join(" | ");
        throw new Error(msg || "Image upload failed");
      }

      const url = safeStr(data?.src || data?.url);
      if (!url) throw new Error("Upload completed but URL not found.");

      const nextConfig = {
        ...config,
        [key]: {
          ...(config as any)[key],
          templateImageUrl: url,
        },
      } as YoutubeConfig;

      setConfig(nextConfig);
      setPreviewNonce(Date.now());
      setTemplateMessage("Thumbnail master image uploaded. Click Save Settings to store permanently.");
      setTemplateMessageType("info");
    } catch (e: any) {
      const msg = e?.message || "Thumbnail master image upload failed";
      setTemplateMessage(msg);
      setTemplateMessageType("error");
      alert(msg);
    } finally {
      setUploadingKey("");
    }
  }

  async function downloadThumbnailPng() {
    if (!generated?.thumbnail?.svgUrl) return;

    setDownloading(true);

    try {
      const svgUrl = withCacheBust(generated.thumbnail.svgUrl, Date.now());
      const res = await fetch(svgUrl, {
        credentials: "include",
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Failed to load thumbnail SVG.");
      }

      const svgText = await res.text();
      const svgBlob = new Blob([svgText], {
        type: "image/svg+xml;charset=utf-8",
      });
      const blobUrl = URL.createObjectURL(svgBlob);

      try {
        const image = new Image();
        image.decoding = "sync";

        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error("Failed to render thumbnail image."));
          image.src = blobUrl;
        });

        const canvas = document.createElement("canvas");
        canvas.width = 1280;
        canvas.height = 720;

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas not supported in this browser.");

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        const pngBlob: Blob = await new Promise((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error("PNG export failed."));
              return;
            }
            resolve(blob);
          }, "image/png", 1);
        });

        const downloadUrl = URL.createObjectURL(pngBlob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = generated.thumbnail.downloadFileName || "youtube-thumbnail.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    } catch (e: any) {
      alert(e?.message || "Thumbnail download failed");
    } finally {
      setDownloading(false);
    }
  }

  function updateTextBlock(kind: TemplateKindTab, patch: Partial<YoutubeTextBlock>) {
    setConfig((prev) => ({
      ...prev,
      [kind]: {
        ...(kind === "pyq" ? prev.pyq : prev.assignment),
        ...patch,
      },
    }));
  }

  function updateThumbBlock(kind: TemplateKindTab, patch: Partial<YoutubeThumbBlock>) {
    const key = kind === "pyq" ? "pyqThumbnail" : "assignmentThumbnail";

    setConfig((prev) => ({
      ...prev,
      [key]: {
        ...(prev as any)[key],
        ...patch,
      },
    }));
  }

  function updateThumbField(
    kind: TemplateKindTab,
    index: number,
    patch: Partial<YoutubeThumbField>
  ) {
    const key = kind === "pyq" ? "pyqThumbnail" : "assignmentThumbnail";

    setConfig((prev) => {
      const block = (prev as any)[key] as YoutubeThumbBlock;
      const fields = Array.isArray(block.fields) ? [...block.fields] : [];

      fields[index] = {
        ...fields[index],
        ...patch,
      };

      return {
        ...prev,
        [key]: {
          ...block,
          fields,
        },
      };
    });
  }

  function resetCurrentTextBlock() {
    const source = templateKindTab === "pyq" ? defaults.pyq : defaults.assignment;
    updateTextBlock(templateKindTab, source);
    setTemplateMessage(`${kindText(templateKindTab)} text templates restored in form. Click Save Settings.`);
    setTemplateMessageType("info");
  }

  function resetCurrentThumbBlock() {
    const source =
      templateKindTab === "pyq"
        ? defaults.pyqThumbnail
        : defaults.assignmentThumbnail;

    updateThumbBlock(templateKindTab, source);
    setPreviewNonce(Date.now());
    setTemplateMessage(`${kindText(templateKindTab)} thumbnail settings restored in form. Click Save Settings.`);
    setTemplateMessageType("info");
  }

  function renderCopyButton(key: string, value: string, label = "Copy") {
    const active = copiedKey === key;

    return (
      <button
        type="button"
        onClick={() => copyText(key, value)}
        disabled={!safeStr(value)}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-bold transition disabled:opacity-50 ${
          active
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-gray-200 bg-white hover:bg-gray-50 text-slate-700"
        }`}
      >
        {active ? <CheckCircle2 size={16} /> : <Copy size={16} />}
        {active ? "Copied" : label}
      </button>
    );
  }

  function renderGeneratedBlock(params: {
    title: string;
    value: string;
    copyKey: string;
    textarea?: boolean;
  }) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="font-extrabold text-slate-900">{params.title}</div>
          {renderCopyButton(params.copyKey, params.value)}
        </div>

        {params.textarea ? (
          <textarea
            readOnly
            value={params.value}
            className="mt-3 w-full min-h-[220px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 outline-none"
          />
        ) : (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold break-words">
            {params.value || "-"}
          </div>
        )}
      </div>
    );
  }

  const generatedThumbUrl = generated?.thumbnail?.previewUrl
    ? withCacheBust(generated.thumbnail.previewUrl, previewNonce)
    : "";

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-extrabold flex items-center gap-2">
                <Youtube className="text-red-600" />
                YouTube Content Generator
              </h1>
              <p className="text-sm text-slate-600 mt-1 leading-6">
                Assignment aur PYQ products ke liye ready YouTube title, description, pinned comment aur 16:9 thumbnail generate karo.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => void loadTemplates(true)}
                disabled={templatesLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm disabled:opacity-60"
              >
                {templatesLoading ? (
                  <LoaderCircle size={18} className="animate-spin" />
                ) : (
                  <RefreshCcw size={18} />
                )}
                Refresh
              </button>

              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <ArrowLeft size={18} />
                Back
              </Link>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2 flex-wrap">
            {[
              { key: "generator", label: "Generate Content", icon: Clipboard },
              { key: "templates", label: "Default Templates", icon: FileText },
              { key: "thumbnails", label: "Master Thumbnails", icon: ImageIcon },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as ActiveTab)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border font-extrabold transition ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-gray-200 bg-white hover:bg-gray-50 text-slate-700"
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {templateMessage ? (
            <div
              className={`mt-4 rounded-2xl border p-4 text-sm font-semibold ${
                templateMessageType === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : templateMessageType === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : "border-blue-200 bg-blue-50 text-blue-800"
              }`}
            >
              <div className="flex items-start gap-2">
                {templateMessageType === "success" ? (
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                ) : (
                  <Info size={18} className="mt-0.5 shrink-0" />
                )}
                <div>{templateMessage}</div>
              </div>
            </div>
          ) : null}

          {activeTab === "generator" ? (
            <div className="mt-6 grid grid-cols-1 xl:grid-cols-[0.95fr_1.2fr] gap-6">
              <div className="space-y-5">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-lg font-extrabold text-slate-900">
                        Search Product
                      </div>
                      <div className="text-sm text-slate-600 mt-1">
                        Subject code, SKU, title ya course code se product search karo.
                      </div>
                    </div>

                    {productsLoading ? (
                      <div className="inline-flex items-center gap-2 text-sm font-bold text-slate-500">
                        <LoaderCircle size={16} className="animate-spin" />
                        Searching...
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2 relative">
                      <Search
                        size={18}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by Subject Code / SKU / Title / Course..."
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white outline-none focus:border-blue-500"
                      />
                    </div>

                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none"
                    >
                      <option value="">Assignment + PYQ</option>
                      <option value="assignment">Only Assignments</option>
                      <option value="pyq">Only PYQ</option>
                    </select>

                    <select
                      value={sessionFilter}
                      onChange={(e) => setSessionFilter(e.target.value)}
                      className="px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none"
                    >
                      <option value="">All Sessions</option>
                      {sessionOptions.map((item) => (
                        <option key={item._id} value={item.name}>
                          {item.name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={mediumFilter}
                      onChange={(e) => setMediumFilter(e.target.value)}
                      className="px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none"
                    >
                      <option value="">All Medium</option>
                      {mediumOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>

                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none"
                    >
                      <option value="latest">Latest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="subject_asc">Subject Code A-Z</option>
                      <option value="sku_asc">SKU A-Z</option>
                    </select>
                  </div>

                  <label className="mt-4 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onlyActive}
                      onChange={(e) => setOnlyActive(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <div>
                      <div className="text-sm font-extrabold text-slate-800">
                        Only active products
                      </div>
                      <div className="text-xs text-slate-500">
                        YouTube upload ke liye normally active/live products best rahenge.
                      </div>
                    </div>
                  </label>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="font-extrabold text-slate-900">
                      Results: {totalProducts}
                    </div>
                    <div className="text-xs font-bold text-slate-500">
                      Page {page} / {totalPages}
                    </div>
                  </div>

                  <div className="mt-4 space-y-3 max-h-[720px] overflow-y-auto pr-1">
                    {productsError ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
                        {productsError}
                      </div>
                    ) : products.length === 0 ? (
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm font-semibold text-slate-500 text-center">
                        No product found.
                      </div>
                    ) : (
                      products.map((product) => {
                        const active = selectedProduct?._id === product._id;

                        return (
                          <button
                            type="button"
                            key={product._id}
                            onClick={() => generateForProduct(product)}
                            className={`w-full text-left rounded-2xl border p-4 transition ${
                              active
                                ? "border-blue-300 bg-blue-50"
                                : "border-gray-200 bg-white hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                                      product.kind === "pyq"
                                        ? "bg-red-50 text-red-700 border border-red-200"
                                        : "bg-blue-50 text-blue-700 border border-blue-200"
                                    }`}
                                  >
                                    {kindText(product.kind)}
                                  </span>

                                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold bg-slate-50 text-slate-700 border border-slate-200">
                                    {availabilityText(product.availability)}
                                  </span>

                                  {product.isActive ? (
                                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Active
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                                      Inactive
                                    </span>
                                  )}
                                </div>

                                <div className="mt-2 font-extrabold text-slate-900 break-words">
                                  {product.subjectCode} — {product.medium} — {product.session}
                                </div>
                                <div className="mt-1 text-sm text-slate-600 break-words">
                                  {product.subjectTitle || product.title}
                                </div>
                                <div className="mt-2 text-xs text-slate-500 break-all">
                                  SKU: <b>{product.sku}</b>
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-bold disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-bold disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-lg font-extrabold text-slate-900">
                        Generated YouTube Details
                      </div>
                      <div className="text-sm text-slate-600 mt-1">
                        Product select karte hi ready title, description, comment aur thumbnail yahan aa jayega.
                      </div>
                    </div>

                    {generating ? (
                      <div className="inline-flex items-center gap-2 text-sm font-bold text-slate-500">
                        <LoaderCircle size={16} className="animate-spin" />
                        Generating...
                      </div>
                    ) : null}
                  </div>

                  {!generated || !selectedProduct ? (
                    <div className="mt-5 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-slate-500 font-semibold">
                      Left side se product select karo.
                    </div>
                  ) : (
                    <div className="mt-5 space-y-5">
                      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                        <div className="font-extrabold text-blue-900">
                          {generated.product.subjectCode} — {generated.product.medium} — {generated.product.session}
                        </div>
                        <div className="text-sm text-blue-900 mt-1 break-words">
                          {generated.product.subjectTitle}
                        </div>
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          {renderCopyButton(
                            "product-link",
                            generated.product.productLink,
                            "Copy Product Link"
                          )}
                          <a
                            href={generated.product.productLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-blue-200 bg-white hover:bg-blue-50 text-sm font-bold text-blue-700"
                          >
                            <Eye size={16} />
                            Open Product
                          </a>
                        </div>
                      </div>

                      {renderGeneratedBlock({
                        title: "YouTube Title",
                        value: generated.generated.title,
                        copyKey: "youtube-title",
                      })}

                      {renderGeneratedBlock({
                        title: "YouTube Description",
                        value: generated.generated.description,
                        copyKey: "youtube-description",
                        textarea: true,
                      })}

                      {renderGeneratedBlock({
                        title: "Pinned Comment",
                        value: generated.generated.pinnedComment,
                        copyKey: "youtube-comment",
                        textarea: true,
                      })}

                      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <div className="font-extrabold text-slate-900">
                              YouTube Thumbnail
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              1280 × 720 landscape PNG download.
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <a
                              href={generatedThumbUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-bold"
                            >
                              <Eye size={16} />
                              Preview SVG
                            </a>

                            <button
                              type="button"
                              onClick={downloadThumbnailPng}
                              disabled={downloading}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-900 bg-slate-900 hover:bg-slate-950 text-white text-sm font-bold disabled:opacity-60"
                            >
                              {downloading ? (
                                <LoaderCircle size={16} className="animate-spin" />
                              ) : (
                                <Download size={16} />
                              )}
                              Download PNG
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl border border-gray-200 bg-slate-100 overflow-hidden">
                          {generatedThumbUrl ? (
                            <img
                              src={generatedThumbUrl}
                              alt="YouTube Thumbnail Preview"
                              className="w-full h-auto aspect-video object-contain bg-slate-100"
                            />
                          ) : (
                            <div className="aspect-video flex items-center justify-center text-sm font-semibold text-slate-500">
                              Thumbnail not available.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "templates" ? (
            <div className="mt-6">
              {templatesLoading ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm font-semibold text-slate-600">
                  Loading templates...
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-[0.8fr_1.2fr] gap-6">
                  <div className="space-y-5">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                      <div className="text-lg font-extrabold text-slate-900">
                        Template Type
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setTemplateKindTab("assignment")}
                          className={`px-4 py-3 rounded-xl border font-extrabold ${
                            templateKindTab === "assignment"
                              ? "border-blue-700 bg-blue-700 text-white"
                              : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                        >
                          Assignment
                        </button>
                        <button
                          type="button"
                          onClick={() => setTemplateKindTab("pyq")}
                          className={`px-4 py-3 rounded-xl border font-extrabold ${
                            templateKindTab === "pyq"
                              ? "border-red-700 bg-red-700 text-white"
                              : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                        >
                          PYQ
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                      <div className="text-lg font-extrabold text-blue-900">
                        Token Codes
                      </div>
                      <div className="text-sm text-blue-900 mt-1">
                        Template ke andar ye codes use karo. Product select hone par ye automatically replace ho jayenge.
                      </div>

                      <div className="mt-4 space-y-2">
                        {tokens.map((token) => (
                          <div
                            key={token.token}
                            className="rounded-xl border border-blue-100 bg-white/80 p-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <code className="font-extrabold text-blue-900">
                                {token.token}
                              </code>
                              {renderCopyButton(
                                `token-${token.token}`,
                                token.token,
                                "Copy"
                              )}
                            </div>
                            <div className="mt-1 text-sm font-bold text-slate-800">
                              {token.label}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {token.description}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="text-lg font-extrabold text-slate-900">
                          {kindText(templateKindTab)} Default Text Templates
                        </div>
                        <div className="text-sm text-slate-600 mt-1">
                          Ye templates selected product ke tokens se final YouTube content banayenge.
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={resetCurrentTextBlock}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 font-bold"
                      >
                        <RefreshCcw size={16} />
                        Reset This
                      </button>
                    </div>

                    <div className="mt-5 space-y-4">
                      <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(currentTextBlock.isEnabled)}
                          onChange={(e) =>
                            updateTextBlock(templateKindTab, {
                              isEnabled: e.target.checked,
                            })
                          }
                          className="h-4 w-4"
                        />
                        <div>
                          <div className="font-extrabold text-slate-900">
                            Enable this template
                          </div>
                          <div className="text-xs text-slate-500">
                            Future me multiple template mode add karne ke liye useful.
                          </div>
                        </div>
                      </label>

                      <div>
                        <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                          YouTube Title Template
                        </label>
                        <textarea
                          value={currentTextBlock.titleTemplate}
                          onChange={(e) =>
                            updateTextBlock(templateKindTab, {
                              titleTemplate: e.target.value,
                            })
                          }
                          className="mt-1 w-full min-h-[90px] rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-500 text-sm leading-6"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                          YouTube Description Template
                        </label>
                        <textarea
                          value={currentTextBlock.descriptionTemplate}
                          onChange={(e) =>
                            updateTextBlock(templateKindTab, {
                              descriptionTemplate: e.target.value,
                            })
                          }
                          className="mt-1 w-full min-h-[320px] rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-500 text-sm leading-6"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                          Pinned Comment Template
                        </label>
                        <textarea
                          value={currentTextBlock.pinnedCommentTemplate}
                          onChange={(e) =>
                            updateTextBlock(templateKindTab, {
                              pinnedCommentTemplate: e.target.value,
                            })
                          }
                          className="mt-1 w-full min-h-[150px] rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-500 text-sm leading-6"
                        />
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        <button
                          type="button"
                          onClick={() => saveTemplates()}
                          disabled={templatesSaving}
                          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-950 text-white font-extrabold disabled:opacity-60"
                        >
                          {templatesSaving ? (
                            <LoaderCircle size={18} className="animate-spin" />
                          ) : (
                            <Save size={18} />
                          )}
                          Save Settings
                        </button>

                        <button
                          type="button"
                          onClick={resetTemplates}
                          disabled={templatesSaving}
                          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 font-extrabold disabled:opacity-60"
                        >
                          <RefreshCcw size={18} />
                          Reset All Defaults
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {activeTab === "thumbnails" ? (
            <div className="mt-6">
              {templatesLoading ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm font-semibold text-slate-600">
                  Loading thumbnail settings...
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6">
                  <div className="space-y-5">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                      <div className="text-lg font-extrabold text-slate-900">
                        Thumbnail Type
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setTemplateKindTab("assignment")}
                          className={`px-4 py-3 rounded-xl border font-extrabold ${
                            templateKindTab === "assignment"
                              ? "border-blue-700 bg-blue-700 text-white"
                              : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                        >
                          Assignment
                        </button>
                        <button
                          type="button"
                          onClick={() => setTemplateKindTab("pyq")}
                          className={`px-4 py-3 rounded-xl border font-extrabold ${
                            templateKindTab === "pyq"
                              ? "border-red-700 bg-red-700 text-white"
                              : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                        >
                          PYQ
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <div className="text-lg font-extrabold text-slate-900">
                            Master Image
                          </div>
                          <div className="text-sm text-slate-600 mt-1">
                            1280 × 720 landscape blank thumbnail upload karo.
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={resetCurrentThumbBlock}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 font-bold"
                        >
                          <RefreshCcw size={16} />
                          Reset
                        </button>
                      </div>

                      <div className="mt-5 space-y-4">
                        <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(currentThumbBlock.isEnabled)}
                            onChange={(e) =>
                              updateThumbBlock(templateKindTab, {
                                isEnabled: e.target.checked,
                              })
                            }
                            className="h-4 w-4"
                          />
                          <div>
                            <div className="font-extrabold text-slate-900">
                              Enable {kindText(templateKindTab)} thumbnail
                            </div>
                            <div className="text-xs text-slate-500">
                              Disabled hone par fallback design still preview me aa sakta hai.
                            </div>
                          </div>
                        </label>

                        <div>
                          <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                            Upload Master Thumbnail Image
                          </label>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp,image/avif"
                            disabled={Boolean(uploadingKey)}
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              void uploadThumbnailTemplate(templateKindTab, file);
                              e.target.value = "";
                            }}
                            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none"
                          />
                          {uploadingKey === currentThumbKey ? (
                            <div className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-blue-700">
                              <LoaderCircle size={16} className="animate-spin" />
                              Uploading...
                            </div>
                          ) : null}
                        </div>

                        <div>
                          <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                            Master Image URL / Path
                          </label>
                          <input
                            value={currentThumbBlock.templateImageUrl}
                            onChange={(e) =>
                              updateThumbBlock(templateKindTab, {
                                templateImageUrl: e.target.value,
                              })
                            }
                            placeholder="https://... or /images/thumbs/youtube-assignment.png"
                            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                            PNG Download File Prefix
                          </label>
                          <input
                            value={currentThumbBlock.outputFilePrefix}
                            onChange={(e) =>
                              updateThumbBlock(templateKindTab, {
                                outputFilePrefix: e.target.value,
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <div className="text-sm font-extrabold text-slate-900">
                            Current Master Preview
                          </div>
                          <div className="mt-3 rounded-2xl border border-gray-200 bg-slate-100 overflow-hidden">
                            {buildPublicPreview(currentThumbBlock.templateImageUrl) ? (
                              <img
                                src={buildPublicPreview(currentThumbBlock.templateImageUrl)}
                                alt="Master Thumbnail Preview"
                                className="w-full aspect-video object-contain"
                              />
                            ) : (
                              <div className="aspect-video flex items-center justify-center text-sm font-semibold text-slate-500">
                                No master image uploaded yet. Fallback design will be used.
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => saveTemplates()}
                          disabled={templatesSaving}
                          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-950 text-white font-extrabold disabled:opacity-60"
                        >
                          {templatesSaving ? (
                            <LoaderCircle size={18} className="animate-spin" />
                          ) : (
                            <Save size={18} />
                          )}
                          Save Thumbnail Settings
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                          <Settings2 size={20} />
                          Dynamic Text Fields
                        </div>
                        <div className="text-sm text-slate-600 mt-1">
                          Text position, font size aur token yahan adjust kar sakte ho.
                        </div>
                      </div>

                      <div className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-extrabold bg-slate-50 text-slate-700 border border-slate-200">
                        1280 × 720
                      </div>
                    </div>

                    <div className="mt-5 space-y-4">
                      {currentThumbBlock.fields.length === 0 ? (
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm font-semibold text-slate-500">
                          No fields found. Reset thumbnail settings once.
                        </div>
                      ) : (
                        currentThumbBlock.fields.map((field, index) => (
                          <div
                            key={`${field.key}-${index}`}
                            className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                          >
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div>
                                <div className="font-extrabold text-slate-900">
                                  {field.label || field.key}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                  Token: <b>{field.token || "-"}</b>
                                </div>
                              </div>

                              <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={Boolean(field.enabled)}
                                  onChange={(e) =>
                                    updateThumbField(templateKindTab, index, {
                                      enabled: e.target.checked,
                                    })
                                  }
                                />
                                Enabled
                              </label>
                            </div>

                            <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                              <div>
                                <label className="text-[11px] font-extrabold uppercase text-slate-500">
                                  Token/Text
                                </label>
                                <input
                                  value={field.token}
                                  onChange={(e) =>
                                    updateThumbField(templateKindTab, index, {
                                      token: e.target.value,
                                    })
                                  }
                                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none"
                                />
                              </div>

                              <div>
                                <label className="text-[11px] font-extrabold uppercase text-slate-500">
                                  Fallback
                                </label>
                                <input
                                  value={field.fallbackText}
                                  onChange={(e) =>
                                    updateThumbField(templateKindTab, index, {
                                      fallbackText: e.target.value,
                                    })
                                  }
                                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none"
                                />
                              </div>

                              <div>
                                <label className="text-[11px] font-extrabold uppercase text-slate-500">
                                  X
                                </label>
                                <input
                                  type="number"
                                  value={field.x}
                                  onChange={(e) =>
                                    updateThumbField(templateKindTab, index, {
                                      x: fieldNumber(e.target.value, field.x),
                                    })
                                  }
                                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none"
                                />
                              </div>

                              <div>
                                <label className="text-[11px] font-extrabold uppercase text-slate-500">
                                  Y
                                </label>
                                <input
                                  type="number"
                                  value={field.y}
                                  onChange={(e) =>
                                    updateThumbField(templateKindTab, index, {
                                      y: fieldNumber(e.target.value, field.y),
                                    })
                                  }
                                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none"
                                />
                              </div>

                              <div>
                                <label className="text-[11px] font-extrabold uppercase text-slate-500">
                                  Width
                                </label>
                                <input
                                  type="number"
                                  value={field.width}
                                  onChange={(e) =>
                                    updateThumbField(templateKindTab, index, {
                                      width: fieldNumber(e.target.value, field.width),
                                    })
                                  }
                                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none"
                                />
                              </div>

                              <div>
                                <label className="text-[11px] font-extrabold uppercase text-slate-500">
                                  Font Size
                                </label>
                                <input
                                  type="number"
                                  value={field.fontSize}
                                  onChange={(e) =>
                                    updateThumbField(templateKindTab, index, {
                                      fontSize: fieldNumber(e.target.value, field.fontSize),
                                    })
                                  }
                                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none"
                                />
                              </div>

                              <div>
                                <label className="text-[11px] font-extrabold uppercase text-slate-500">
                                  Min Size
                                </label>
                                <input
                                  type="number"
                                  value={field.minFontSize}
                                  onChange={(e) =>
                                    updateThumbField(templateKindTab, index, {
                                      minFontSize: fieldNumber(
                                        e.target.value,
                                        field.minFontSize
                                      ),
                                    })
                                  }
                                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none"
                                />
                              </div>

                              <div>
                                <label className="text-[11px] font-extrabold uppercase text-slate-500">
                                  Lines
                                </label>
                                <input
                                  type="number"
                                  value={field.maxLines}
                                  onChange={(e) =>
                                    updateThumbField(templateKindTab, index, {
                                      maxLines: fieldNumber(e.target.value, field.maxLines),
                                    })
                                  }
                                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none"
                                />
                              </div>

                              <div>
                                <label className="text-[11px] font-extrabold uppercase text-slate-500">
                                  Color
                                </label>
                                <input
                                  value={field.color}
                                  onChange={(e) =>
                                    updateThumbField(templateKindTab, index, {
                                      color: e.target.value,
                                    })
                                  }
                                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none"
                                />
                              </div>

                              <div>
                                <label className="text-[11px] font-extrabold uppercase text-slate-500">
                                  Align
                                </label>
                                <select
                                  value={field.align}
                                  onChange={(e) =>
                                    updateThumbField(templateKindTab, index, {
                                      align: e.target.value as "left" | "center" | "right",
                                    })
                                  }
                                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none"
                                >
                                  <option value="left">Left</option>
                                  <option value="center">Center</option>
                                  <option value="right">Right</option>
                                </select>
                              </div>

                              <div>
                                <label className="text-[11px] font-extrabold uppercase text-slate-500">
                                  Font Weight
                                </label>
                                <input
                                  type="number"
                                  value={field.fontWeight}
                                  onChange={(e) =>
                                    updateThumbField(templateKindTab, index, {
                                      fontWeight: fieldNumber(e.target.value, field.fontWeight),
                                    })
                                  }
                                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none"
                                />
                              </div>

                              <label className="flex items-center gap-2 mt-6 text-sm font-bold text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={Boolean(field.uppercase)}
                                  onChange={(e) =>
                                    updateThumbField(templateKindTab, index, {
                                      uppercase: e.target.checked,
                                    })
                                  }
                                />
                                Uppercase
                              </label>
                            </div>
                          </div>
                        ))
                      )}

                      <div className="flex items-center gap-3 flex-wrap">
                        <button
                          type="button"
                          onClick={() => saveTemplates()}
                          disabled={templatesSaving}
                          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-950 text-white font-extrabold disabled:opacity-60"
                        >
                          {templatesSaving ? (
                            <LoaderCircle size={18} className="animate-spin" />
                          ) : (
                            <Save size={18} />
                          )}
                          Save Field Settings
                        </button>

                        {selectedProduct ? (
                          <button
                            type="button"
                            onClick={() => generateForProduct(selectedProduct)}
                            disabled={generating}
                            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 font-extrabold disabled:opacity-60"
                          >
                            <RefreshCcw size={18} />
                            Refresh Preview
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <div className="mt-6 text-xs text-slate-500 leading-6">
            Note: YouTube thumbnail PNG download browser canvas se generate hota hai. Master image publicly accessible URL par honi chahiye.
          </div>
        </div>
      </div>
    </main>
  );
}