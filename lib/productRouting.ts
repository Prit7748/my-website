// ✅ FILE: lib/productRouting.ts (COMPLETE REPLACE)
import { notFound } from "next/navigation";
import { headers } from "next/headers";

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
  pdfKey?: string;

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
  return String(x ?? "").trim();
}

function normalizeCategoryName(category?: string) {
  return safeStr(category).toLowerCase();
}

export function categorySlugFromProductCategory(category?: string): string {
  const c = normalizeCategoryName(category);

  if (c.includes("solved")) return "solved-assignments";
  if (c.includes("handwritten") && (c.includes("hardcopy") || c.includes("delivery"))) return "handwritten-hardcopy";
  if (c.includes("handwritten") && c.includes("pdf")) return "handwritten-pdfs";
  if (c.includes("question") || c.includes("pyq")) return "question-papers";
  if (c.includes("guess")) return "guess-papers";
  if (c.includes("ebook") || c.includes("notes")) return "ebooks";
  if (c.includes("project") || c.includes("synopsis")) return "projects";
  if (c.includes("combo")) return "combo";

  return "products";
}

export function variantFromCategorySlug(
  categorySlug: string
): "digital" | "hardcopy" | "pyq" | "projects" | "combo" {
  if (categorySlug === "handwritten-hardcopy") return "hardcopy";
  if (categorySlug === "question-papers") return "pyq";
  if (categorySlug === "projects") return "projects";
  if (categorySlug === "combo") return "combo";
  return "digital";
}

async function getBaseUrl() {
  // ✅ Next.js (your version) headers() can be Promise
  const h = await headers();

  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const dynamicBase = `${proto}://${host}`.replace(/\/+$/, "");

  // ✅ If current request is localhost, ignore NEXT_PUBLIC_SITE_URL
  if (host.includes("localhost") || host.startsWith("127.0.0.1") || host.includes(":3000")) {
    return dynamicBase;
  }

  // ✅ Production: allow env override
  const env = safeStr(process.env.NEXT_PUBLIC_SITE_URL);
  if (env) return env.replace(/\/+$/, "");

  return dynamicBase;
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

  const base = await getBaseUrl();
  const url = `${base}/api/products/${encodeURIComponent(s)}`;

  const data: any = await fetchJson<any>(url);
  const p = data?.product || null;

  if (p && p.slug) return p as Product;

  notFound();
}
