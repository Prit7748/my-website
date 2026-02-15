// ✅ FILE: components/product/ProductDetailsClient.tsx (Complete Replace - UPDATED with availability + Want to Buy flow)
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/context/CartContext";

import TopBar from "@/components/TopBar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingButtons from "@/components/FloatingButtons";
import ProductCard from "@/components/ProductCard";

import {
  Star,
  ShoppingCart,
  Truck,
  ShieldCheck,
  ChevronRight,
  Minus,
  Plus,
  Share2,
  Download,
  FileText,
  AlertCircle,
  X,
  FileSignature,
  PenTool,
  Sparkles,
  Clock4,
  Package,
  MapPin,
  MessageCircle,
  BadgeCheck,
  Info,
  BookOpen,
  ExternalLink,
  CheckCircle2,
  Zap,
  Loader2,
} from "lucide-react";

type Product = {
  _id: string;
  title: string;
  slug: string;
  sku?: string;
  category?: string;

  subjectCode?: string;
  subjectTitleHi?: string;
  subjectTitleEn?: string;

  courseCodes?: string[];
  courseTitles?: string[];

  session?: string;
  language?: string;

  price: number;
  oldPrice?: number | null;

  shortDesc?: string;
  descriptionHtml?: string;
  pages?: number;
  importantNote?: string;

  // ✅ availability from API: "out_of_stock" / "available" / "coming_soon" etc.
  availability?: string;

  isDigital?: boolean;
  pdfUrl?: string;

  images?: string[];
  thumbnailUrl?: string;
  quickUrl?: string;

  // ✅ optional future fields (safe)
  videoUrl?: string;
  comboItems?: Array<{
    title: string;
    slug: string;
    category?: string;
    price?: number;
    thumbUrl?: string;
  }>;
};

type ApiProductCard = {
  title: string;
  slug: string;
  category?: string;
  courseCodes?: string[];
  session?: string;
  language?: string;
  price: number;
  oldPrice?: number | null;
  images?: string[];
  thumbUrl?: string;
  quickUrl?: string;
  isDigital?: boolean;
};

type ApiProductsResponse = { products: ApiProductCard[] };

function safeArr(x: any): string[] {
  return Array.isArray(x) ? x.filter(Boolean) : [];
}
function safeStr(x: any): string {
  return String(x || "").trim();
}
function safeJsonParse<T>(v: string, fallback: T): T {
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}
function money(n: number) {
  try {
    return new Intl.NumberFormat("en-IN").format(Number(n || 0));
  } catch {
    return String(n);
  }
}
function isHindiLike(lang: string) {
  const s = safeStr(lang).toLowerCase();
  return s.includes("hindi") || s === "hi";
}
function pickSubjectTitleByLanguage(p: Product) {
  const lang = safeStr(p.language);
  if (isHindiLike(lang)) return safeStr(p.subjectTitleHi) || safeStr(p.subjectTitleEn) || "";
  return safeStr(p.subjectTitleEn) || safeStr(p.subjectTitleHi) || "";
}
function pickCourseTitleByLanguage(p: Product) {
  const titles = Array.isArray(p.courseTitles) ? p.courseTitles.filter(Boolean) : [];
  return titles[0] ? safeStr(titles[0]) : "";
}
function isVideoUrl(url: string) {
  const u = safeStr(url).toLowerCase().split("?")[0];
  return u.endsWith(".mp4") || u.endsWith(".webm") || u.endsWith(".ogg");
}
function fileNameFromUrl(url: string) {
  try {
    const clean = (url || "").split("?")[0];
    const parts = clean.split("/");
    return (parts[parts.length - 1] || "image.jpg").trim() || "image.jpg";
  } catch {
    return "image.jpg";
  }
}
async function downloadImageSmart(url: string, filenameHint?: string) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filenameHint || fileNameFromUrl(url);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function normAvail(v?: string) {
  return safeStr(v).toLowerCase();
}
function isOutOfStock(p: Product) {
  const a = normAvail(p.availability);
  return a === "out_of_stock" || a === "outofstock" || a === "out-of-stock";
}

const RV_KEY = "isp_recently_viewed_v1";
const RV_MAX = 18;

function categoryLabelFromSlug(categorySlug: string) {
  const map: Record<string, string> = {
    "solved-assignments": "Solved Assignments",
    "handwritten-pdfs": "Handwritten PDFs",
    "handwritten-hardcopy": "Handwritten Hardcopy (Delivery)",
    "question-papers": "Question Papers (PYQ)",
    "guess-papers": "Guess Papers",
    ebooks: "eBooks/Notes",
    projects: "Projects & Synopsis",
    combo: "Combo",
    products: "Products",
  };
  return map[categorySlug] || categorySlug.replaceAll("-", " ");
}

export default function ProductDetailsClient({
  initialProduct,
  categorySlug,
  variant = "digital",
}: {
  initialProduct: Product;
  categorySlug: string;
  variant?: "digital" | "hardcopy" | "pyq" | "projects" | "combo";
}) {
  const { addToCart } = useCart();
  const pathname = usePathname();

  const [product] = useState<Product>(initialProduct);
  const [quantity, setQuantity] = useState(1);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [isHandwrittenOpen, setIsHandwrittenOpen] = useState(false);

  const [related, setRelated] = useState<ApiProductCard[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<ApiProductCard[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  // ✅ Hardcopy focus: WhatsApp text loop (EN/HI)
  const [waPulseText, setWaPulseText] = useState<"en" | "hi">("en");

  // ✅ Want to Buy modal state (Out of Stock)
  const [wtbOpen, setWtbOpen] = useState(false);
  const [wtbLoading, setWtbLoading] = useState(false);
  const [wtbForm, setWtbForm] = useState({
    email: "",
    phone: "",
    message: "",
  });

  const categoryLabel = useMemo(() => categoryLabelFromSlug(categorySlug), [categorySlug]);

  const isHardcopy = useMemo(() => variant === "hardcopy", [variant]);
  const qtyLocked = useMemo(() => !isHardcopy, [isHardcopy]);

  useEffect(() => {
    if (qtyLocked) setQuantity(1);
  }, [qtyLocked]);

  // ✅ Media list
  const media = useMemo(() => {
    const list = safeArr(product?.images);
    const thumb = product?.thumbnailUrl ? [product.thumbnailUrl] : [];
    const quick = product?.quickUrl ? [product.quickUrl] : [];
    const vid = product?.videoUrl ? [product.videoUrl] : [];
    const merged = [...thumb, ...quick, ...vid, ...list].filter(Boolean);
    return Array.from(new Set(merged));
  }, [product]);

  useEffect(() => {
    if (selectedMediaIndex > Math.max(0, media.length - 1)) setSelectedMediaIndex(0);
  }, [media.length, selectedMediaIndex]);

  // ✅ Auto slider
  useEffect(() => {
    if (!isHardcopy) return;
    if (media.length <= 1) return;

    const t = setInterval(() => {
      setSelectedMediaIndex((prev) => (prev + 1) % media.length);
    }, 3000);

    return () => clearInterval(t);
  }, [isHardcopy, media.length]);

  // ✅ WhatsApp CTA loop (3 sec)
  useEffect(() => {
    if (!isHardcopy) return;
    const t = setInterval(() => {
      setWaPulseText((p) => (p === "en" ? "hi" : "en"));
    }, 3000);
    return () => clearInterval(t);
  }, [isHardcopy]);

  const heroUrl = media[selectedMediaIndex] || product?.thumbnailUrl || "/images/cover1.jpg";
  const heroIsVideo = isVideoUrl(heroUrl);
  const hasDiscount = !!product.oldPrice && Number(product.oldPrice) > Number(product.price || 0);
  const subjectTitle = useMemo(() => pickSubjectTitleByLanguage(product), [product]);
  const courseTitle = useMemo(() => pickCourseTitleByLanguage(product), [product]);

  const computedTitle = useMemo(() => {
    const t = safeStr(product.title);
    if (t) return t;
    const parts: string[] = [];
    if (safeStr(product.subjectCode)) parts.push(safeStr(product.subjectCode));
    if (safeStr(product.session)) parts.push(safeStr(product.session));
    if (safeStr(product.language)) parts.push(safeStr(product.language));
    return parts.length ? `IGNOU Combo (${parts.join(" • ")})` : "IGNOU Combo";
  }, [product.title, product.subjectCode, product.session, product.language]);

  const computedShortDesc = useMemo(() => {
    const s = safeStr(product.shortDesc);
    if (s) return s;
    const bits: string[] = [];
    if (safeStr(product.subjectCode)) bits.push(`Subject: ${safeStr(product.subjectCode)}`);
    if (safeStr(product.session)) bits.push(`Session: ${safeStr(product.session)}`);
    if (safeStr(product.language)) bits.push(`Medium: ${safeStr(product.language)}`);
    return bits.length
      ? `A curated combo pack for better value. ${bits.join(" | ")}`
      : `A curated combo pack for better value.`;
  }, [product.shortDesc, product.subjectCode, product.session, product.language]);

  const computedDescriptionHtml = useMemo(() => {
    const html = safeStr(product.descriptionHtml);
    if (html) return html;
    return `
      <p><strong>${computedTitle}</strong> is a value combo designed for students to save money and get everything required together.</p>
      <ul>
        <li>✅ Verified, student-friendly format</li>
        <li>✅ Best value vs. buying separately</li>
        <li>✅ Helpful for exam preparation and submissions</li>
      </ul>
      <p>For details, please contact us on WhatsApp.</p>
    `;
  }, [product.descriptionHtml, computedTitle]);

  // ✅ WhatsApp Logic (Hydration Safe)
  const waNumber = "7496865680";
  const [pageUrl, setPageUrl] = useState("");

  useEffect(() => {
    try {
      setPageUrl(window.location.href);
    } catch { }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("isp_user_email") || "";
      if (saved && !wtbForm.email) setWtbForm((p) => ({ ...p, email: saved }));
    } catch { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const waBuyMsg = encodeURIComponent(
    `Hi! I want to buy this product:\n\n${computedTitle}\n${pageUrl || pathname}\n\nPlease share details.`
  );
  const waSamplesMsg = encodeURIComponent(
    `Hi! Please share handwriting samples.\n\nProduct: ${computedTitle}\nSubject Code: ${safeStr(
      product.subjectCode
    )}\nSession: ${safeStr(product.session)}\nMedium: ${safeStr(product.language)}\n\nLink: ${pageUrl || pathname}`
  );
  const waReviewMsg = encodeURIComponent(
    `Hi! I purchased this product and want to share my review:\n\n${computedTitle}\n${pageUrl || pathname}\n\nRating: ⭐⭐⭐⭐⭐\nReview: `
  );

  const waBuyLink = `https://wa.me/91${waNumber}?text=${waBuyMsg}`;
  const waSamplesLink = `https://wa.me/91${waNumber}?text=${waSamplesMsg}`;
  const waReviewLink = `https://wa.me/91${waNumber}?text=${waReviewMsg}`;

  const handleAddToCart = () => {
    addToCart({
      id: product._id, // ✅ IMPORTANT: Mongo ObjectId
      title: computedTitle,
      price: Number(product.price || 0),
      image: product.thumbnailUrl || media[0] || "/images/cover1.jpg",
      quantity: qtyLocked ? 1 : quantity,
      category: safeStr(product.category),
      courseCode: (product.courseCodes?.[0] || "").toString(),
    });
    alert("Item added to cart successfully!");
  };


  const handleHardcopyWhatsApp = () => {
    window.open(waBuyLink, "_blank", "noopener,noreferrer");
  };

  const handleShare = async () => {
    try {
      const url = window.location.href;
      if (navigator.share) {
        await navigator.share({ title: computedTitle, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert("Link copied!");
      }
    } catch { }
  };

  async function submitWantToBuy() {
    const productId = safeStr(product?._id);
    const email = safeStr(wtbForm.email);
    const phone = safeStr(wtbForm.phone);
    const message = safeStr(wtbForm.message);

    if (!email) {
      alert("Email is required.");
      return;
    }

    setWtbLoading(true);
    try {
      const res = await fetch("/api/products/want-to-buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          productId,
          email,
          phone,
          message: message || `Interested in: ${computedTitle}\nLink: ${pageUrl || pathname}`,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data?.error || "Request failed");
        return;
      }

      try {
        localStorage.setItem("isp_user_email", email);
      } catch { }

      alert(data?.message || "Request submitted ✅");
      setWtbOpen(false);
      setWtbForm((p) => ({ ...p, message: "" }));
    } catch {
      alert("Server error. Try again.");
    } finally {
      setWtbLoading(false);
    }
  }

  const BuySection = ({ isMobile = false }: { isMobile?: boolean }) => {
    const oos = isOutOfStock(product);

    return (
      <div className={`flex gap-3 ${isMobile ? "" : "w-full"} ${isHardcopy ? "flex-col sm:flex-row" : ""}`}>
        {/* Quantity */}
        <div
          className={`flex items-center rounded-2xl bg-white h-14 border ${qtyLocked ? "border-gray-200 opacity-70" : "border-gray-200"
            } shadow-sm`}
        >
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className={`px-3 h-full rounded-l-2xl ${qtyLocked ? "cursor-not-allowed" : "hover:bg-gray-50 text-gray-800"
              }`}
            disabled={qtyLocked}
            aria-label="Decrease quantity"
          >
            <Minus size={16} />
          </button>

          <span className="px-2 font-extrabold text-base min-w-[2.5rem] text-center text-slate-900">
            {qtyLocked ? 1 : quantity}
          </span>

          <button
            onClick={() => setQuantity(quantity + 1)}
            className={`px-3 h-full rounded-r-2xl ${qtyLocked ? "cursor-not-allowed" : "hover:bg-gray-50 text-gray-800"
              }`}
            disabled={qtyLocked}
            aria-label="Increase quantity"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* CTA Buttons */}
        {isHardcopy ? (
          <div className={`flex-1 flex gap-3 ${isMobile ? "" : ""}`}>
            <button
              onClick={handleHardcopyWhatsApp}
              className="
                isp-wa-pulse
                relative flex-1 h-14 rounded-2xl font-extrabold text-sm md:text-base
                bg-emerald-600 text-white
                shadow-[0_14px_35px_-18px_rgba(16,185,129,0.85)]
                ring-2 ring-emerald-300/60
                hover:bg-emerald-700 transition
                active:scale-[0.98]
                overflow-hidden
              "
            >
              <span className="absolute inset-0 opacity-30 bg-[radial-gradient(600px_120px_at_20%_0%,rgba(255,255,255,0.6),transparent)]" />
              <span className="relative inline-flex items-center justify-center gap-2 w-full h-full">
                <MessageCircle size={20} />
                <span className="grid place-items-center">
                  <span
                    className={`col-start-1 row-start-1 transition-opacity duration-500 ease-in-out ${waPulseText === "en" ? "opacity-100" : "opacity-0"
                      }`}
                  >
                    Buy Direct from WhatsApp
                  </span>
                  <span
                    className={`col-start-1 row-start-1 transition-opacity duration-500 ease-in-out ${waPulseText === "hi" ? "opacity-100" : "opacity-0"
                      }`}
                  >
                    सीधा व्हाट्सएप से खरीदें
                  </span>
                </span>
              </span>
            </button>

            <button
              onClick={handleAddToCart}
              className="
                h-14 px-4 rounded-2xl font-extrabold text-sm md:text-base
                border border-slate-200 bg-white text-slate-900
                hover:bg-slate-50 hover:border-slate-300 transition
                shadow-sm active:scale-[0.99]
                inline-flex items-center justify-center gap-2
              "
              aria-label="Add to cart"
              title="Add to cart"
            >
              <ShoppingCart size={20} /> Add
            </button>
          </div>
        ) : oos ? (
          <button
            onClick={() => setWtbOpen(true)}
            className="
              flex-1 h-14 rounded-2xl font-extrabold text-base
              bg-emerald-600 text-white hover:bg-emerald-700 transition
              shadow-[0_14px_35px_-18px_rgba(16,185,129,0.65)]
              active:scale-[0.98]
              flex items-center justify-center gap-2
            "
          >
            <MessageCircle size={20} /> Want to Buy
          </button>
        ) : (
          <button
            onClick={handleAddToCart}
            className="
              flex-1 h-14 rounded-2xl font-extrabold text-base
              bg-blue-700 text-white hover:bg-blue-800 transition
              shadow-[0_14px_35px_-18px_rgba(37,99,235,0.65)]
              active:scale-[0.98]
              flex items-center justify-center gap-2
            "
          >
            <ShoppingCart size={20} /> Add to Cart
          </button>
        )}

        {!isMobile && (
          <button
            onClick={handleShare}
            className="h-14 w-14 flex items-center justify-center border-2 border-gray-200 rounded-2xl text-gray-600 hover:border-blue-500 hover:text-blue-700 transition bg-white shadow-sm"
            aria-label="Share"
          >
            <Share2 size={20} />
          </button>
        )}
      </div>
    );
  };

  useEffect(() => {
    const card: ApiProductCard = {
      title: computedTitle,
      slug: product.slug,
      category: product.category,
      courseCodes: Array.isArray(product.courseCodes) ? product.courseCodes : [],
      session: product.session || "",
      language: product.language || "",
      price: Number(product.price || 0),
      oldPrice: product.oldPrice ? Number(product.oldPrice) : null,
      images: Array.isArray(product.images) ? product.images : [],
      thumbUrl: product.thumbnailUrl || "",
      quickUrl: product.quickUrl || "",
      isDigital: !!product.isDigital,
    };
    try {
      const raw = localStorage.getItem(RV_KEY) || "[]";
      const prev = safeJsonParse<ApiProductCard[]>(raw, []);
      const cleaned = Array.isArray(prev) ? prev.filter((x) => x && x.slug) : [];
      const withoutCurrent = cleaned.filter((x) => x.slug !== card.slug);
      const next = [card, ...withoutCurrent].slice(0, RV_MAX);
      localStorage.setItem(RV_KEY, JSON.stringify(next));
      setRecentlyViewed(next.filter((x) => x.slug !== card.slug).slice(0, 12));
    } catch { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.slug]);

  useEffect(() => {
    (async () => {
      setRelatedLoading(true);
      try {
        const cat = safeStr(product.category);
        const primaryCourse = safeStr(product.courseCodes?.[0] || "");
        const q1 = new URLSearchParams();
        q1.set("page", "1");
        q1.set("limit", "18");
        q1.set("sort", "latest");
        if (cat) q1.set("category", cat);
        if (primaryCourse) q1.set("course", primaryCourse);
        const r1 = await fetch(`/api/products?${q1.toString()}`, { cache: "no-store" });
        const d1: ApiProductsResponse = await r1.json();
        const list1 = Array.isArray(d1.products) ? d1.products : [];
        const uniq: ApiProductCard[] = [];
        const seen = new Set<string>();
        for (const p of list1) {
          if (!p?.slug || p.slug === product.slug) continue;
          if (seen.has(p.slug)) continue;
          seen.add(p.slug);
          uniq.push(p);
          if (uniq.length >= 12) break;
        }
        setRelated(uniq);
      } catch {
        setRelated([]);
      } finally {
        setRelatedLoading(false);
      }
    })();
  }, [product.slug, product.category, product.courseCodes]);

  const comboHref = useMemo(() => {
    const q = new URLSearchParams();
    if (safeStr(product.subjectCode)) q.set("subject", safeStr(product.subjectCode));
    if (safeStr(product.session)) q.set("session", safeStr(product.session));
    if (safeStr(product.language)) q.set("medium", safeStr(product.language));
    return `/combo?${q.toString()}`;
  }, [product.subjectCode, product.session, product.language]);

  const showComboBanner = categorySlug !== "combo";
  const showSolvedHandwrittenBanner = safeStr(product.category) === "Solved Assignments";

  const TrustDeliverySection = () => (
    <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-emerald-100 text-emerald-700 p-2">
          <Zap size={18} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-extrabold text-slate-900">Fast Dispatch • Safe Packing • All India Delivery</div>
          <div className="mt-1 text-xs text-slate-700 font-semibold leading-relaxed">
            We pack carefully and ship fast. You’ll receive genuine handwritten hardcopy delivered to your address. For
            quickest confirmation and tracking support, prefer WhatsApp.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-[12px] font-extrabold text-emerald-800">
              <CheckCircle2 size={14} /> Verified Packing
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-white px-3 py-2 text-[12px] font-extrabold text-blue-800">
              <Truck size={14} /> Delivery Support
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-extrabold text-slate-800">
              <ShieldCheck size={14} /> Trusted Service
            </span>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            {/* ✅ Updated Safe Link: Samples */}
            <a
              href={pageUrl ? waSamplesLink : `https://wa.me/91${waNumber}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white border border-slate-200 px-4 py-3 text-sm font-extrabold text-slate-900 hover:bg-slate-50 transition shadow-sm"
            >
              <PenTool size={18} className="text-purple-700" />
              Our Handwriting Samples
              <ExternalLink size={14} className="text-slate-500" />
            </a>

            {/* ✅ Updated Safe Link: Priority Support */}
            <a
              href={pageUrl ? waBuyLink : `https://wa.me/91${waNumber}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-emerald-700 transition shadow-[0_14px_35px_-18px_rgba(16,185,129,0.85)]"
            >
              <MessageCircle size={18} />
              WhatsApp Priority Support
              <ExternalLink size={14} className="opacity-90" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );

  const ComboIncludedSection = () => {
    if (categorySlug !== "combo") return null;
    const items = Array.isArray(product.comboItems) ? product.comboItems.filter((x) => x && x.slug) : [];
    return (
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden transition hover:shadow-md">
        <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-blue-700" />
            <div className="text-sm font-extrabold text-slate-900">Included Products</div>
          </div>
          <div className="mt-1 text-xs text-slate-600 font-semibold">
            Combo details are shown here (auto). If you define combo items from backend, this becomes super powerful for SEO.
          </div>
        </div>

        {items.length === 0 ? (
          <div className="p-4 text-sm text-slate-700 font-semibold">
            No included items found yet. (Optional improvement: add <code>comboItems</code> from backend.)
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.slice(0, 12).map((it) => (
              <div key={it.slug} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 flex gap-3 items-start">
                <div className="relative w-14 h-20 rounded-xl overflow-hidden bg-white border border-slate-200 flex-shrink-0">
                  {it.thumbUrl ? <Image src={it.thumbUrl} alt={it.title} fill className="object-cover" /> : null}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-slate-900 line-clamp-2">{it.title}</div>
                  <div className="mt-1 text-[11px] font-bold text-slate-600">
                    {safeStr(it.category) ? safeStr(it.category) : "Product"}
                    {typeof it.price === "number" ? ` • ₹${money(it.price)}` : ""}
                  </div>
                  <Link
                    href={`/products/${it.slug}`}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-extrabold text-blue-700 hover:underline"
                  >
                    View <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <main className="min-h-screen font-sans text-slate-800 bg-[radial-gradient(1200px_600px_at_20%_0%,rgba(37,99,235,0.08),transparent),radial-gradient(900px_500px_at_90%_10%,rgba(16,185,129,0.08),transparent)]">
      <TopBar />
      <Navbar />

      <div className="bg-white/90 backdrop-blur border-b border-gray-200 py-3 sticky top-[80px] z-20 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 text-xs md:text-sm text-gray-600 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <Link href="/" className="hover:text-blue-700 font-extrabold">
            Home
          </Link>
          <ChevronRight size={12} className="text-gray-300" />
          <Link href={`/${categorySlug}`} className="hover:text-blue-700 font-extrabold">
            {categoryLabel}
          </Link>
          <ChevronRight size={12} className="text-gray-300" />
          <span className="text-gray-900 font-extrabold truncate">{computedTitle}</span>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          <div className="lg:col-span-5 flex flex-col gap-4 lg:sticky lg:top-32">
            <div className="relative aspect-[210/297] bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-md transition hover:shadow-xl hover:-translate-y-[2px]">
              {heroIsVideo ? (
                <video
                  src={heroUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <Image
                  src={heroUrl}
                  alt={computedTitle}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  priority
                />
              )}
              <div className="absolute top-3 left-3 z-10">
                <span className="inline-flex items-center gap-2 rounded-xl bg-white/90 backdrop-blur border border-slate-200 px-3 py-2 text-[11px] font-extrabold text-slate-900 shadow-sm">
                  <BadgeCheck size={14} className="text-blue-700" />
                  Official Format
                </span>
              </div>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2">
              {media.length === 0 ? (
                <div className="text-sm text-gray-500">No images</div>
              ) : (
                media.map((url, i) => (
                  <div key={url + i} className="relative w-16 h-24 flex-shrink-0">
                    <button
                      onClick={() => setSelectedMediaIndex(i)}
                      className={`relative w-16 h-24 rounded-xl overflow-hidden border-2 transition-all ${selectedMediaIndex === i
                        ? "border-blue-700 ring-2 ring-blue-100"
                        : "border-gray-200 hover:border-gray-300"
                        }`}
                      aria-label={`Media ${i + 1}`}
                      title={`Media ${i + 1}`}
                    >
                      {isVideoUrl(url) ? (
                        <div className="absolute inset-0 bg-slate-900 text-white flex items-center justify-center">
                          <span className="text-[10px] font-extrabold">VIDEO</span>
                        </div>
                      ) : (
                        <Image src={url} alt={`thumb-${i + 1}`} fill className="object-cover" />
                      )}
                    </button>
                    {!isHardcopy ? (
                      <button
                        onClick={() => downloadImageSmart(url, `${product.slug}-img-${i + 1}.jpg`)}
                        className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-700 hover:text-blue-700 hover:border-blue-200 transition"
                        aria-label="Download image"
                        title="Download image"
                      >
                        <Download size={14} />
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 rounded-xl p-2 ${isHardcopy ? "bg-orange-50 text-orange-700" : "bg-emerald-50 text-emerald-700"
                    }`}
                >
                  {isHardcopy ? <Truck size={18} /> : <FileText size={18} />}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-extrabold text-slate-900">
                    {isHardcopy ? "Hardcopy Delivery • WhatsApp Recommended" : "Digital Product • Instant Access"}
                  </div>
                  <div className="mt-1 text-xs text-gray-600 font-semibold leading-relaxed">
                    {isHardcopy
                      ? "Website order is available, but WhatsApp gives fastest confirmation, customization, and delivery support."
                      : "Digital categories allow only 1 quantity per product. This prevents duplicate purchases by mistake."}
                  </div>
                  {!isHardcopy ? (
                    <div className="mt-2 inline-flex items-center gap-2 text-[11px] font-extrabold text-gray-600">
                      <Info size={14} className="text-amber-600" /> Quantity locked to 1
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {isHardcopy ? <TrustDeliverySection /> : null}
          </div>

          <div className="lg:col-span-7 flex flex-col">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-800 text-xs font-extrabold rounded-full uppercase tracking-wider border border-blue-100">
                {categoryLabel}
              </span>

              {isHardcopy ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-800 text-xs font-extrabold rounded-full border border-orange-100">
                  <Truck size={14} /> Delivery
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 text-xs font-extrabold rounded-full border border-emerald-100">
                  <Download size={14} /> Digital
                </span>
              )}

              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-700 text-xs font-extrabold rounded-full border border-slate-200">
                <BadgeCheck size={14} className="text-blue-700" /> Verified
              </span>

              {isOutOfStock(product) ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 text-xs font-extrabold rounded-full border border-red-200">
                  <X size={14} /> Out of Stock
                </span>
              ) : null}
            </div>

            <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-slate-900 mb-3 leading-snug">
              {computedTitle}
            </h1>

            <div className="flex items-center gap-4 mb-5 pb-5 border-b border-gray-100">
              <div className="flex items-end gap-2">
                <span className="text-4xl font-extrabold text-green-700">₹{money(product.price)}</span>
                {hasDiscount ? (
                  <span className="text-lg text-gray-400 line-through mb-1">₹{money(Number(product.oldPrice))}</span>
                ) : null}
              </div>

              <div className="h-8 w-[1px] bg-gray-300 mx-2"></div>

              <div className="flex flex-col">
                <div className="flex text-yellow-500 text-xs">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} fill="currentColor" />
                  ))}
                </div>
                <span className="text-xs text-gray-500 font-semibold">Trusted by students</span>
              </div>
            </div>

            <div className="hidden lg:block mb-6">
              <BuySection />
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 text-xs text-gray-600 font-extrabold bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                {isHardcopy ? (
                  <>
                    <span className="flex items-center gap-1.5 text-orange-700">
                      <Package size={16} /> Safe Packing
                    </span>
                    <span className="flex items-center gap-1.5 text-blue-700">
                      <MapPin size={16} /> All India Delivery
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-700">
                      <MessageCircle size={16} /> WhatsApp Priority
                    </span>
                  </>
                ) : (
                  <span className="flex items-center gap-1.5 text-emerald-700">
                    <Download size={16} /> Single Quantity Only
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-blue-700">
                  <ShieldCheck size={16} /> Secure Checkout
                </span>
              </div>
            </div>

            {showSolvedHandwrittenBanner && (
              <div className="relative mb-6">
                <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-purple-100 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm transition hover:shadow-md hover:-translate-y-[1px]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                      <PenTool size={20} />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-purple-900 text-sm">Need Handwritten Version?</h4>
                      <p className="text-xs text-purple-700 font-semibold">Choose PDF or Hardcopy delivery.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsHandwrittenOpen(!isHandwrittenOpen)}
                    className="whitespace-nowrap px-4 py-2 bg-purple-700 text-white text-sm font-extrabold rounded-xl hover:bg-purple-800 transition shadow-sm flex items-center gap-1"
                  >
                    Check Options <ChevronRight size={14} />
                  </button>
                </div>

                {isHandwrittenOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-purple-100 rounded-2xl shadow-xl z-30 overflow-hidden">
                    <div className="flex justify-between items-center bg-purple-50 px-4 py-2 border-b border-purple-100">
                      <span className="text-xs font-extrabold text-purple-800 uppercase">Select Format</span>
                      <button onClick={() => setIsHandwrittenOpen(false)} aria-label="Close">
                        <X size={14} className="text-purple-400 hover:text-purple-800" />
                      </button>
                    </div>

                    <Link
                      href={`/handwritten-hardcopy`}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 border-b border-gray-50"
                    >
                      <div className="p-2 bg-orange-100 text-orange-700 rounded-full">
                        <Truck size={16} />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-xs">Handwritten Hardcopy</h4>
                        <p className="text-[10px] text-gray-500 font-semibold">Delivery all over India</p>
                      </div>
                    </Link>

                    <Link href={`/handwritten-pdfs`} className="flex items-center gap-3 p-3 hover:bg-gray-50">
                      <div className="p-2 bg-blue-100 text-blue-700 rounded-full">
                        <FileSignature size={16} />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-xs">Handwritten PDF</h4>
                        <p className="text-[10px] text-gray-500 font-semibold">Scanned PDF format</p>
                      </div>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {safeStr(product.shortDesc) || safeStr(computedShortDesc) ? (
              <p className="text-gray-700 mb-6 leading-relaxed text-sm md:text-base font-semibold">
                {safeStr(product.shortDesc) ? safeStr(product.shortDesc) : computedShortDesc}
              </p>
            ) : null}

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6 shadow-sm transition hover:shadow-md">
              <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-gray-200 font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <FileText size={16} className="text-blue-700" /> Product Details
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 text-sm md:divide-x border-gray-100">
                <div className="p-4 space-y-3">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400 font-extrabold">Subject Code</span>
                    <span className="font-extrabold text-slate-900">{safeStr(product.subjectCode) || "-"}</span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400 font-extrabold">
                      Subject Title ({safeStr(product.language) || "Medium"})
                    </span>
                    <span className="font-extrabold text-slate-900">{subjectTitle || "-"}</span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400 font-extrabold">Course Code</span>
                    <span className="font-extrabold text-slate-900">
                      {Array.isArray(product.courseCodes) && product.courseCodes.length
                        ? product.courseCodes.join(", ")
                        : "-"}
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400 font-extrabold">Course Title</span>
                    <span className="font-extrabold text-slate-900">{courseTitle || "-"}</span>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400 font-extrabold">Medium</span>
                    <span className="font-extrabold text-slate-900">{safeStr(product.language) || "-"}</span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400 font-extrabold">Session</span>
                    <span className="font-extrabold text-slate-900">{safeStr(product.session) || "-"}</span>
                  </div>

                  {!isHardcopy ? (
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-400 font-extrabold">No. of Pages</span>
                      <span className="font-extrabold text-slate-900">{String(product.pages || 0)}</span>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 text-emerald-700">
                          <Info size={16} />
                        </div>
                        <div className="text-xs text-emerald-900 font-semibold leading-relaxed">
                          Hardcopy category: pages are not shown here (as per delivery workflow).
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 text-amber-600">
                        <Info size={16} />
                      </div>
                      <div className="text-xs text-slate-700 font-semibold leading-relaxed">
                        {qtyLocked
                          ? "Digital / non-delivery: Only 1 quantity can be added to cart."
                          : "Hardcopy delivery: You can increase quantity as needed."}
                      </div>
                    </div>
                  </div>

                  {isOutOfStock(product) ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 text-red-700">
                          <X size={16} />
                        </div>
                        <div className="text-xs text-red-800 font-semibold leading-relaxed">
                          Currently Out of Stock. Tap <b>Want to Buy</b> to request availability.
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {!!safeStr(product.importantNote) && (
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 shadow-sm transition hover:shadow-md">
                <h3 className="font-extrabold text-amber-900 text-xs uppercase tracking-wide mb-2 flex items-center gap-2">
                  <AlertCircle size={14} className="text-amber-700" /> Important Note
                </h3>
                <div className="text-xs text-amber-900 whitespace-pre-line font-semibold leading-relaxed">
                  {safeStr(product.importantNote)}
                </div>
              </div>
            )}

            {isHardcopy ? (
              <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
                <div className="text-[12px] font-extrabold text-slate-800">Delivery Note</div>
                <div className="mt-1 text-[12px] text-slate-600 font-semibold leading-relaxed">
                  Dispatch & delivery time may vary by location. For quickest confirmation and delivery support, use WhatsApp.
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <ComboIncludedSection />

        {showComboBanner ? (
          <div className="mt-12">
            <Link
              href={comboHref}
              className="block rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-blue-50 p-5 shadow-sm transition hover:shadow-md hover:-translate-y-[1px]"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-emerald-800 uppercase tracking-wide">Save More</div>
                  <div className="text-lg md:text-xl font-extrabold text-slate-900">Purchase in Combo & Save Money</div>
                  <div className="mt-1 text-xs text-slate-700 font-semibold leading-relaxed">
                    Recommended: buy related products together for better value.
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-extrabold">
                  View Combo <ChevronRight size={16} />
                </div>
              </div>
            </Link>
          </div>
        ) : null}

        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-200 p-5 md:p-8 transition hover:shadow-md">
          <h2 className="text-xl font-extrabold text-slate-900 mb-4 flex items-center gap-2 border-b pb-3">
            <BookOpen className="text-blue-700" size={18} /> Description
          </h2>
          <div
            className="prose prose-sm prose-blue max-w-none text-slate-700"
            dangerouslySetInnerHTML={{
              __html: categorySlug === "combo" ? computedDescriptionHtml : safeStr(product.descriptionHtml) || computedDescriptionHtml,
            }}
          />
        </div>

        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-200 p-5 md:p-6 transition hover:shadow-md">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg md:text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Star className="text-yellow-500" size={18} /> Students Reviews
            </h2>
            {/* ✅ Updated Safe Link: Reviews */}
            <a
              href={pageUrl ? waReviewLink : `https://wa.me/91${waNumber}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2 text-xs font-extrabold hover:bg-slate-800 transition"
            >
              <MessageCircle size={14} /> Add Rating & Review
            </a>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-sm font-extrabold text-slate-900">Your feedback helps other students</div>
            <div className="mt-1 text-xs text-slate-700 font-semibold leading-relaxed">
              Students who purchased this product can submit rating & review. This improves trust and SEO naturally over time.
            </div>
          </div>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg md:text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Sparkles className="text-blue-700" size={18} /> Related Products
            </h2>
            <Link href="/products" className="text-sm font-extrabold text-blue-700 hover:underline">
              View all →
            </Link>
          </div>

          {relatedLoading ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 font-bold text-gray-600 shadow-sm">
              Loading related products...
            </div>
          ) : related.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 font-bold text-gray-600 shadow-sm">
              No related products found.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {related.map((p) => (
                <ProductCard key={p.slug} product={p as any} />
              ))}
            </div>
          )}
        </div>

        {recentlyViewed.length > 0 ? (
          <div className="mt-12">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg md:text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <Clock4 className="text-blue-700" size={18} /> Recently Viewed
              </h2>
              <button
                onClick={() => {
                  try {
                    localStorage.removeItem(RV_KEY);
                    setRecentlyViewed([]);
                  } catch { }
                }}
                className="text-sm font-extrabold text-gray-500 hover:text-red-600 transition"
              >
                Clear
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {recentlyViewed.map((p) => (
                <ProductCard key={p.slug} product={p as any} />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur p-3 border-t border-gray-200 lg:hidden z-50 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.35)]">
        <BuySection isMobile />
      </div>

      {/* ✅ Want to Buy Modal */}
      {wtbOpen ? (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !wtbLoading && setWtbOpen(false)} />
          <div className="relative w-full max-w-lg rounded-3xl bg-white border border-gray-200 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <div className="text-lg font-extrabold">Want to Buy</div>
                <div className="text-sm text-slate-600">
                  This item is currently out of stock. Share details and we’ll contact you.
                </div>
              </div>
              <button
                onClick={() => !wtbLoading && setWtbOpen(false)}
                className="h-10 w-10 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white flex items-center justify-center"
              >
                <X />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="text-xs font-extrabold text-emerald-900">Product</div>
                <div className="mt-1 text-sm font-extrabold text-slate-900">{computedTitle}</div>
                <div className="mt-1 text-xs text-slate-700 font-semibold">
                  Price: ₹{money(Number(product.price || 0))} • Category: {safeStr(product.category) || categoryLabel}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Email (required)</label>
                <input
                  value={wtbForm.email}
                  onChange={(e) => setWtbForm((p) => ({ ...p, email: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-emerald-500 transition font-medium"
                  placeholder="your@email.com"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Phone (optional)</label>
                <input
                  value={wtbForm.phone}
                  onChange={(e) => setWtbForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-emerald-500 transition font-medium"
                  placeholder="10 digit mobile"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Message (optional)</label>
                <textarea
                  value={wtbForm.message}
                  onChange={(e) => setWtbForm((p) => ({ ...p, message: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-emerald-500 transition font-medium min-h-[90px]"
                  placeholder="Any preference / urgency / quantity etc."
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setWtbOpen(false)}
                  disabled={wtbLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  onClick={submitWantToBuy}
                  disabled={wtbLoading}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition font-extrabold disabled:opacity-60"
                >
                  {wtbLoading ? <Loader2 className="animate-spin" size={18} /> : <MessageCircle size={18} />}
                  Submit
                </button>
              </div>

              <div className="text-xs text-slate-500 font-semibold">
                Note: Request submit होते ही हमारी team आपको email/phone पर contact करेगी.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="h-20 lg:h-0" />
      <Footer />
      <FloatingButtons />

      <style>{`
        @keyframes ispWaPulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(16,185,129,.45); }
          70% { transform: scale(1.03); box-shadow: 0 0 0 18px rgba(16,185,129,0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(16,185,129,0); }
        }
        .isp-wa-pulse {
          animation: ispWaPulse 1.6s ease-in-out infinite;
        }
      `}</style>
    </main>
  );
}
