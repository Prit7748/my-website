// ✅ FILE: app/handwritten-hardcopy/[slug]/page.tsx  (Complete Replace)
// Fix 1: Next.js 16 params Promise -> always unwrap using resolveParams()
// Fix 2: Remove internal API fetch -> DB direct read (no fetch failed / scheme issues)

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import ProductDetailsClient from "@/components/product/ProductDetailsClient";

import dbConnect from "@/lib/db";
import Product from "@/models/Product";

type ApiProduct = {
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

  isDigital?: boolean;
  pdfUrl?: string;

  images?: string[];
  thumbnailUrl?: string;
  quickUrl?: string;

  videoUrl?: string;
  comboItems?: Array<{ title: string; slug: string; category?: string; price?: number; thumbUrl?: string }>;
};

function siteUrl() {
  let base = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://localhost:3000";
  base = String(base || "").trim().replace(/\/+$/, "");
  // auto-fix scheme if missing
  if (!/^https?:\/\//i.test(base)) {
    if (base.startsWith("localhost") || base.startsWith("127.0.0.1")) base = `http://${base}`;
    else base = `https://${base}`;
  }
  return base.replace(/\/+$/, "");
}

function safeText(v: any) {
  return String(v || "").trim();
}

function stripHtml(html: string) {
  return safeText(html)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?[^>]+(>|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ✅ Next.js 16 params can be Promise
async function resolveParams<T extends Record<string, any>>(params: any): Promise<T> {
  if (params && typeof params.then === "function") return await params;
  return params as T;
}

// ✅ If someone opens wrong category url, redirect to correct one (your rule)
function productCategoryToSlug(productCategory: string) {
  const s = safeText(productCategory).toLowerCase();
  if (s.includes("handwritten") && (s.includes("hardcopy") || s.includes("delivery"))) return "handwritten-hardcopy";
  if (s.includes("handwritten") && s.includes("pdf")) return "handwritten-pdfs";
  if (s.includes("solved")) return "solved-assignments";
  if (s.includes("question")) return "question-papers";
  if (s.includes("guess")) return "guess-papers";
  if (s.includes("ebook")) return "ebooks";
  if (s.includes("project") || s.includes("synopsis")) return "projects";
  if (s.includes("combo")) return "combo";
  return "products";
}

// ✅ keep same behavior (don’t break your build mode assumptions)
export const dynamic = "force-dynamic";

// ✅ DB direct fetch
async function fetchProductFromDB(slug: string) {
  await dbConnect();
  const doc: any = await Product.findOne({ slug, deletedAt: null }).lean();

  if (!doc) return { product: null as ApiProduct | null, status: 404 };

  const product: ApiProduct = {
    _id: String(doc._id),
    title: safeText(doc.title),
    slug: safeText(doc.slug),
    sku: safeText(doc.sku),
    category: safeText(doc.category),

    subjectCode: safeText(doc.subjectCode),
    subjectTitleHi: safeText(doc.subjectTitleHi),
    subjectTitleEn: safeText(doc.subjectTitleEn),

    courseCodes: Array.isArray(doc.courseCodes) ? doc.courseCodes.map((x: any) => safeText(x)).filter(Boolean) : [],
    courseTitles: Array.isArray(doc.courseTitles) ? doc.courseTitles.map((x: any) => safeText(x)).filter(Boolean) : [],

    session: safeText(doc.session),
    language: safeText(doc.language),

    price: Number(doc.price || 0),
    oldPrice: doc.oldPrice === undefined || doc.oldPrice === null ? null : Number(doc.oldPrice || 0),

    shortDesc: safeText(doc.shortDesc),
    descriptionHtml: safeText(doc.descriptionHtml),
    pages: Number(doc.pages || 0),
    importantNote: safeText(doc.importantNote),

    isDigital: Boolean(doc.isDigital ?? true),
    pdfUrl: safeText(doc.pdfUrl),

    images: Array.isArray(doc.images) ? doc.images.map((x: any) => safeText(x)).filter(Boolean) : [],
    thumbnailUrl: safeText(doc.thumbnailUrl),
    quickUrl: safeText(doc.quickUrl),
  };

  return { product, status: 200 };
}

export async function generateMetadata({ params }: { params: any }): Promise<Metadata> {
  const p = await resolveParams<{ slug: string }>(params);
  const slug = decodeURIComponent(p?.slug || "").trim();

  const { product } = await fetchProductFromDB(slug);
  if (!product) return { title: "Product Not Found", robots: { index: false, follow: false } };

  const base = siteUrl();
  const canonical = `${base}/handwritten-hardcopy/${product.slug}`;

  const title = safeText(product.title);
  const description = (
    safeText(product.shortDesc) ||
    stripHtml(safeText(product.descriptionHtml)).slice(0, 180) ||
    "Handwritten hardcopy delivery for IGNOU students."
  ).slice(0, 180);

  const ogImage = safeText(product.thumbnailUrl) || safeText(product.quickUrl) || (product.images?.[0] || "");

  return {
    title: `${title} | Handwritten Hardcopy Delivery`,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      url: canonical,
      title,
      description,
      siteName: "IGNOU Students Portal",
      images: ogImage ? [{ url: ogImage, alt: title }] : [],
    },
    twitter: { card: "summary_large_image", title, description, images: ogImage ? [ogImage] : [] },
  };
}

export default async function Page({ params }: { params: any }) {
  const p = await resolveParams<{ slug: string }>(params);
  const slug = decodeURIComponent(p?.slug || "").trim();

  const { product } = await fetchProductFromDB(slug);
  if (!product) notFound();

  // ✅ Redirect if product category says something else (canonical + correct category)
  const correct = productCategoryToSlug(product.category || "");
  if (correct !== "handwritten-hardcopy") {
    redirect(`/${correct}/${product.slug}`);
  }

  return (
    <ProductDetailsClient initialProduct={product as any} categorySlug="handwritten-hardcopy" variant="hardcopy" />
  );
}
