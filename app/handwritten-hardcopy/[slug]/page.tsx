// ✅ FILE: app/handwritten-hardcopy/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import ProductDetailsClient from "@/components/product/ProductDetailsClient";

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
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://localhost:3000";
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
async function resolveParams<T extends Record<string, any>>(params: any): Promise<T> {
  if (params && typeof params.then === "function") return await params;
  return params as T;
}

async function fetchProduct(slug: string) {
  const url = `${siteUrl()}/api/products/${encodeURIComponent(slug)}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  return { product: (data?.product || null) as ApiProduct | null, status: res.status };
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

/**
 * ✅ REQUIRED for output:"export"
 * Next.js needs to know which [slug] pages to pre-render at build time.
 * For now (safe), we generate no dynamic pages and show 404 for unknown slugs.
 * Later, you can return real slugs from a JSON/API.
 */
export const dynamic = "force-static";

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: any }): Promise<Metadata> {
  const p = await resolveParams<{ slug: string }>(params);
  const slug = decodeURIComponent(p?.slug || "").trim();

  const { product } = await fetchProduct(slug);
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

  const { product } = await fetchProduct(slug);
  if (!product) notFound();

  // ✅ Redirect if product category says something else (canonical + correct category)
  const correct = productCategoryToSlug(product.category || "");
  if (correct !== "handwritten-hardcopy") {
    redirect(`/${correct}/${product.slug}`);
  }

  // ✅ IMPORTANT: hardcopy variant pass karo
  return (
    <ProductDetailsClient
      initialProduct={product as any}
      categorySlug="handwritten-hardcopy"
      variant="hardcopy"
    />
  );
}
