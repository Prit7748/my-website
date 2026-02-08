// ✅ FILE: lib/productRouting.ts
import { notFound } from "next/navigation";

export type Product = {
  _id: string;
  title: string;
  slug: string;
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
  comboItems?: Array<{
    title: string;
    slug: string;
    category?: string;
    price?: number;
    thumbUrl?: string;
  }>;
};

function safeStr(x: any) {
  return String(x || "").trim();
}

function normalizeCategoryName(category?: string) {
  return safeStr(category).toLowerCase();
}

export function categorySlugFromProductCategory(category?: string): string {
  const c = normalizeCategoryName(category);

  // ✅ keep these aligned with your listing routes in /app
  if (c.includes("solved")) return "solved-assignments";
  if (c.includes("handwritten") && (c.includes("hardcopy") || c.includes("delivery"))) return "handwritten-hardcopy";
  if (c.includes("handwritten") && c.includes("pdf")) return "handwritten-pdfs";
  if (c.includes("question") || c.includes("pyq")) return "question-papers";
  if (c.includes("guess")) return "guess-papers";
  if (c.includes("ebook") || c.includes("notes")) return "ebooks";
  if (c.includes("project") || c.includes("synopsis")) return "projects";
  if (c.includes("combo")) return "combo";

  // fallback (generic)
  return "products";
}

export function variantFromCategorySlug(categorySlug: string): "digital" | "hardcopy" | "pyq" | "projects" | "combo" {
  if (categorySlug === "handwritten-hardcopy") return "hardcopy";
  if (categorySlug === "question-papers") return "pyq";
  if (categorySlug === "projects") return "projects";
  if (categorySlug === "combo") return "combo";
  return "digital";
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getProductBySlug(slug: string): Promise<Product> {
  const s = safeStr(slug);
  if (!s) notFound();

  // ✅ CHANGE FIRST ONE to your REAL single-product API (most important)
  const tries = [
    `/api/products/${encodeURIComponent(s)}`,                 // common
    `/api/products/slug/${encodeURIComponent(s)}`,            // common alt
    `/api/product?slug=${encodeURIComponent(s)}`,             // common alt
    `/api/products?slug=${encodeURIComponent(s)}&limit=1`,    // fallback if your list API supports slug filter
  ];

  for (const u of tries) {
    const data: any = await fetchJson<any>(u);
    if (!data) continue;

    // handle possible shapes
    const p = data.product || data?.data?.product || (Array.isArray(data.products) ? data.products[0] : null) || data;
    if (p && p.slug) return p as Product;
  }

  notFound();
}
