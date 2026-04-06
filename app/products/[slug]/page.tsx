// app/products/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";

type ApiProduct = {
  slug: string;
  title?: string;
  category?: string;
  shortDesc?: string;
  descriptionHtml?: string;
  thumbnailUrl?: string;
  quickUrl?: string;
  images?: string[];
  subjectCode?: string;
  session?: string;
};

function safeText(input: any) {
  return String(input || "").trim();
}

function normalizeBaseUrl(input?: string) {
  const raw = safeText(input) || "https://istudentsportal.com";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, "");
}

function siteUrl() {
  return normalizeBaseUrl(
    process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://istudentsportal.com"
  );
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

function categorySlugFromProductCategory(cat: string) {
  const c = safeText(cat).toLowerCase();
  if (c === "solved assignments") return "solved-assignments";
  if (c === "handwritten pdfs") return "handwritten-pdfs";
  if (c.includes("handwritten") && (c.includes("hardcopy") || c.includes("delivery"))) {
    return "handwritten-hardcopy";
  }
  if (c.includes("question") && (c.includes("paper") || c.includes("pyq"))) return "question-papers";
  if (c.includes("guess")) return "guess-papers";
  if (c.includes("ebook") || c.includes("notes")) return "ebooks";
  if (c.includes("project") || c.includes("synopsis")) return "projects";
  if (c.includes("combo")) return "combo";
  return "products";
}

function bestOgImage(p: ApiProduct) {
  return (
    safeText(p.thumbnailUrl) ||
    safeText(p.quickUrl) ||
    (Array.isArray(p.images) ? safeText(p.images[0]) : "") ||
    ""
  );
}

const fetchProduct = cache(async (slug: string) => {
  const url = `${siteUrl()}/api/products/${encodeURIComponent(slug)}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  return { product: (data?.product || null) as ApiProduct | null, status: res.status };
});

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: any }): Promise<Metadata> {
  const p = await resolveParams<{ slug: string }>(params);
  const slug = decodeURIComponent(p?.slug || "").trim();

  const { product } = await fetchProduct(slug);
  if (!product) {
    return {
      title: "Product Not Found",
      robots: { index: false, follow: false },
    };
  }

  const base = siteUrl();
  const realCat = categorySlugFromProductCategory(product.category || "");
  const canonical = `${base}/${realCat}/${encodeURIComponent(product.slug)}`;

  const title = safeText(product.title) || "Product";
  const description = (
    safeText(product.shortDesc) ||
    stripHtml(safeText(product.descriptionHtml)).slice(0, 180) ||
    `IGNOU study material for ${safeText(product.subjectCode) || "your subject"} (${safeText(product.session) || "latest session"}).`
  ).slice(0, 180);

  const ogImage = bestOgImage(product);

  return {
    title: `${title} | IGNOU Students Portal`,
    description,
    alternates: { canonical },
    robots: { index: false, follow: true },
    openGraph: {
      type: "website",
      url: canonical,
      title,
      description,
      siteName: "IGNOU Students Portal",
      images: ogImage ? [{ url: ogImage, alt: title }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default async function Page({ params }: { params: any }) {
  const p = await resolveParams<{ slug: string }>(params);
  const slug = decodeURIComponent(p?.slug || "").trim();

  const { product } = await fetchProduct(slug);
  if (!product) notFound();

  const realCat = categorySlugFromProductCategory(product.category || "");
  permanentRedirect(`/${realCat}/${encodeURIComponent(product.slug)}`);
}