import { cache } from "react";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Script from "next/script";
import ProductDetailsClient from "@/components/product/ProductDetailsClient";

import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import { productHref } from "@/lib/productHref";
import {
  buildAssignmentMasterThumbUrl,
  buildHardcopyMasterThumbUrl,
  buildQuestionPaperMasterThumbUrl,
  isHandwrittenHardcopyProduct,
  isQuestionPaperProduct,
  isSolvedAssignmentProduct,
} from "@/lib/thumbUrls";

export const runtime = "nodejs";
export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

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

  availability?: string;
  effectiveAvailability?: string;
  comingSoonSalesEnabled?: boolean;

  videoUrl?: string;
  comboItems?: Array<{
    title: string;
    slug: string;
    category?: string;
    price?: number;
    thumbUrl?: string;
  }>;
};

function safeText(input: unknown) {
  return String(input ?? "").trim();
}

function stripHtml(html: string) {
  return safeText(html)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?[^>]+(>|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBaseUrl(input?: string) {
  const raw = safeText(input) || "https://istudentsportal.com";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const normalized = withProtocol.replace(/\/+$/, "");

  try {
    const url = new URL(normalized);

    if (
      url.hostname === "www.istudentsportal.com" ||
      url.hostname === "istudentsportal.com"
    ) {
      return "https://istudentsportal.com";
    }

    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return normalized;
    }

    return normalized;
  } catch {
    return "https://istudentsportal.com";
  }
}

function siteUrl() {
  return normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL);
}

function absoluteUrl(pathOrUrl?: string) {
  const value = safeText(pathOrUrl);
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;

  const base = siteUrl();
  return `${base}${value.startsWith("/") ? value : `/${value}`}`;
}

async function resolveParams<T extends Record<string, any>>(params: any): Promise<T> {
  if (params && typeof params.then === "function") return await params;
  return params as T;
}

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

function variantFromCategorySlug(
  categorySlug: string
): "digital" | "hardcopy" | "pyq" | "projects" | "combo" {
  if (categorySlug === "handwritten-hardcopy") return "hardcopy";
  if (categorySlug === "combo") return "combo";
  if (categorySlug === "projects") return "projects";
  if (categorySlug === "question-papers") return "pyq";
  return "digital";
}

function normAvail(v?: string) {
  return safeText(v).toLowerCase();
}

function categorySlugFromHref(href: string, fallback = "products") {
  const clean = safeText(href);
  if (!clean.startsWith("/")) return fallback;
  const parts = clean.split("/").filter(Boolean);
  return parts[0] || fallback;
}

function buildMasterThumbnailFallback(product: ApiProduct) {
  if (safeText(product.thumbnailUrl)) return safeText(product.thumbnailUrl);
  if (safeText(product.quickUrl)) return safeText(product.quickUrl);

  const firstImage = Array.isArray(product.images)
    ? safeText(product.images.find((x) => safeText(x)))
    : "";
  if (firstImage) return firstImage;

  if (isSolvedAssignmentProduct(product as any)) {
    return buildAssignmentMasterThumbUrl(product as any);
  }

  if (isHandwrittenHardcopyProduct(product as any)) {
    return buildHardcopyMasterThumbUrl(product as any);
  }

  if (isQuestionPaperProduct(product as any)) {
    return buildQuestionPaperMasterThumbUrl(product as any);
  }

  return "";
}

const fetchProduct = cache(async (slug: string) => {
  await dbConnect();

  const doc: any = await Product.findOne({
    slug,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  }).lean();

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

    courseCodes: Array.isArray(doc.courseCodes)
      ? doc.courseCodes.map((x: any) => safeText(x)).filter(Boolean)
      : [],
    courseTitles: Array.isArray(doc.courseTitles)
      ? doc.courseTitles.map((x: any) => safeText(x)).filter(Boolean)
      : [],

    session: safeText(doc.session),
    language: safeText(doc.language),

    price: Number(doc.price || 0),
    oldPrice:
      doc.oldPrice === undefined || doc.oldPrice === null
        ? null
        : Number(doc.oldPrice || 0),

    shortDesc: safeText(doc.shortDesc),
    descriptionHtml: safeText(doc.descriptionHtml),
    pages: Number(doc.pages || 0),
    importantNote: safeText(doc.importantNote),

    isDigital: Boolean(doc.isDigital ?? true),
    pdfUrl: safeText(doc.pdfUrl),

    images: Array.isArray(doc.images)
      ? doc.images.map((x: any) => safeText(x)).filter(Boolean)
      : [],
    thumbnailUrl: safeText(doc.thumbnailUrl),
    quickUrl: safeText(doc.quickUrl),

    availability: safeText(doc.availability),
    effectiveAvailability: safeText(doc.effectiveAvailability),
    comingSoonSalesEnabled: Boolean(doc.comingSoonSalesEnabled ?? false),
  };

  return { product, status: 200 };
});

export async function generateMetadata({ params }: { params: any }): Promise<Metadata> {
  const p = await resolveParams<{ category: string; slug: string }>(params);
  const requestedCategorySlug = decodeURIComponent(p?.category || "").trim();
  const slug = decodeURIComponent(p?.slug || "").trim();

  if (!slug) {
    return { title: "Product Not Found", robots: { index: false, follow: false } };
  }

  const { product } = await fetchProduct(slug);
  if (!product) {
    return { title: "Product Not Found", robots: { index: false, follow: false } };
  }

  const base = siteUrl();
  const canonicalPath = productHref({ slug: product.slug, category: product.category });
  const canonical = `${base}${canonicalPath}`;
  const canonicalCategorySlug = categorySlugFromHref(
    canonicalPath,
    requestedCategorySlug || "products"
  );

  const title = safeText(product.title);
  const description = (
    safeText(product.shortDesc) ||
    stripHtml(safeText(product.descriptionHtml)).slice(0, 180) ||
    "IGNOU study material product."
  ).slice(0, 180);

  const ogImageRaw = buildMasterThumbnailFallback(product);
  const ogImage = absoluteUrl(ogImageRaw);

  return {
    title: `${title} | ${categoryLabelFromSlug(canonicalCategorySlug)}`,
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
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default async function Page({ params }: { params: any }) {
  const p = await resolveParams<{ category: string; slug: string }>(params);
  const requestedCategorySlug = decodeURIComponent(p?.category || "").trim();
  const slug = decodeURIComponent(p?.slug || "").trim();

  if (!slug) notFound();

  const { product } = await fetchProduct(slug);
  if (!product) notFound();

  const canonicalPath = productHref({ slug: product.slug, category: product.category });
  const expectedCategorySlug = categorySlugFromHref(
    canonicalPath,
    requestedCategorySlug || "products"
  );

  if (!expectedCategorySlug || expectedCategorySlug === "products") {
    notFound();
  }

  if (requestedCategorySlug !== expectedCategorySlug) {
    permanentRedirect(canonicalPath);
  }

  const base = siteUrl();
  const productUrl = `${base}${canonicalPath}`;
  const categoryLabel = categoryLabelFromSlug(expectedCategorySlug);
  const variant = variantFromCategorySlug(expectedCategorySlug);

  const desc =
    safeText(product.shortDesc) ||
    stripHtml(product.descriptionHtml || "").slice(0, 220) ||
    `${categoryLabel} product for IGNOU students.`;

  const fallbackThumb = buildMasterThumbnailFallback(product);

  const images = Array.from(
    new Set(
      [
        absoluteUrl(fallbackThumb),
        absoluteUrl(safeText(product.thumbnailUrl)),
        absoluteUrl(safeText(product.quickUrl)),
        ...(Array.isArray(product.images)
          ? product.images.map((x) => absoluteUrl(safeText(x)))
          : []),
      ].filter(Boolean)
    )
  );

  const rawAvail = normAvail(product.effectiveAvailability || product.availability);
  const schemaAvailability =
    rawAvail === "out_of_stock" ||
    rawAvail === "outofstock" ||
    rawAvail === "out-of-stock" ||
    rawAvail === "want_to_buy" ||
    rawAvail === "wanttobuy" ||
    rawAvail === "want-to-buy"
      ? "https://schema.org/OutOfStock"
      : "https://schema.org/InStock";

  const productJsonLd: any = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: safeText(product.title),
    image: images.length ? images : undefined,
    description: desc,
    sku: safeText(product.sku) || safeText(product.slug),
    mpn: safeText(product.slug),
    brand: { "@type": "Brand", name: "IGNOU Students Portal" },
    category: categoryLabel,
    url: productUrl,
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "INR",
      price: Number(product.price || 0),
      availability: schemaAvailability,
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${base}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: categoryLabel,
        item: `${base}/${expectedCategorySlug}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: safeText(product.title),
        item: productUrl,
      },
    ],
  };

  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: safeText(product.title),
    url: productUrl,
    isPartOf: { "@type": "WebSite", name: "IGNOU Students Portal", url: base },
  };

  return (
    <>
      <Script
        id="isp-jsonld-product"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <Script
        id="isp-jsonld-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Script
        id="isp-jsonld-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
      />

      <ProductDetailsClient
        initialProduct={product as any}
        categorySlug={expectedCategorySlug}
        variant={variant}
      />
    </>
  );
}