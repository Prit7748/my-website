import { cache } from "react";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Script from "next/script";

import ProductDetailsClient from "@/components/product/ProductDetailsClient";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";

type ApiProduct = {
  _id: string;
  title: string;
  slug: string;
  sku?: string;
  category?: string;
  categorySlug?: string;

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

  availability?: string;
  effectiveAvailability?: string;
  onDemandSalesEnabled?: boolean;

  deliverWithinMinutes?: number;
  onDemandNote?: string;

  videoUrl?: string;
  comboItems?: Array<{
    title: string;
    slug: string;
    category?: string;
    price?: number;
    thumbUrl?: string;
  }>;

  createdAt?: string | null;
  updatedAt?: string | null;
};

function safeText(input: unknown) {
  return String(input ?? "").trim();
}

function safeNum(input: unknown, fallback = 0) {
  const n = Number(input);
  return Number.isFinite(n) ? n : fallback;
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

export const dynamic = "force-dynamic";

function categorySlugFromProductCategory(category?: string) {
  const c = safeText(category).toLowerCase();

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

function normalizeImages(images: any, thumbnailUrl?: string, quickUrl?: string) {
  const raw = Array.isArray(images) ? images : [];
  const urls = raw
    .map((x: any) => {
      if (typeof x === "string") return safeText(x);
      if (x && typeof x === "object" && typeof x.url === "string") return safeText(x.url);
      return "";
    })
    .filter(Boolean);

  const unique = Array.from(new Set(urls));
  const thumb = safeText(thumbnailUrl) || unique[0] || "";
  const quick = safeText(quickUrl) || unique[1] || unique[0] || "";

  return {
    images: unique,
    thumbnailUrl: thumb,
    quickUrl: quick,
  };
}

function schemaAvailabilityFromValue(value?: string) {
  const v = safeText(value).toLowerCase();

  if (
    v === "want_to_buy" ||
    v === "want-to-buy" ||
    v === "wanttobuy" ||
    v === "out_of_stock" ||
    v === "out-of-stock" ||
    v === "outofstock"
  ) {
    return "https://schema.org/OutOfStock";
  }

  if (
    v === "on_demand" ||
    v === "on-demand" ||
    v === "ondemand" ||
    v === "coming_soon" ||
    v === "coming-soon" ||
    v === "comingsoon"
  ) {
    return "https://schema.org/PreOrder";
  }

  return "https://schema.org/InStock";
}

const fetchProduct = cache(async (slug: string) => {
  await dbConnect();

  const doc: any = await Product.findOne({
    slug,
    $and: [
      { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] },
      { $or: [{ isActive: true }, { isActive: { $exists: false } }] },
    ],
  }).lean();

  if (!doc) return { product: null as ApiProduct | null, status: 404 };

  const normalizedImages = normalizeImages(doc.images, doc.thumbnailUrl, doc.quickUrl);
  const categorySlug = categorySlugFromProductCategory(doc.category);

  const product: ApiProduct = {
    _id: String(doc._id),
    title: safeText(doc.title),
    slug: safeText(doc.slug),
    sku: safeText(doc.sku),
    category: safeText(doc.category),
    categorySlug,

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

    price: safeNum(doc.price, 0),
    oldPrice:
      doc.oldPrice === undefined || doc.oldPrice === null ? null : safeNum(doc.oldPrice, 0),

    shortDesc: safeText(doc.shortDesc),
    descriptionHtml: safeText(doc.descriptionHtml),
    pages: safeNum(doc.pages, 0),
    importantNote: safeText(doc.importantNote),

    isDigital: Boolean(doc.isDigital ?? true),
    pdfUrl: safeText(doc.pdfUrl),
    pdfKey: safeText(doc.pdfKey),

    images: normalizedImages.images,
    thumbnailUrl: normalizedImages.thumbnailUrl,
    quickUrl: normalizedImages.quickUrl,

    availability: safeText(doc.availability),
    effectiveAvailability: safeText(doc.effectiveAvailability || doc.availability),
    onDemandSalesEnabled: Boolean(doc.onDemandSalesEnabled ?? false),

    deliverWithinMinutes: Math.max(1, safeNum(doc.deliverWithinMinutes, 20)),
    onDemandNote: safeText(doc.onDemandNote),

    videoUrl: safeText(doc.videoUrl),
    comboItems: Array.isArray(doc.comboItems) ? doc.comboItems : [],

    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };

  return { product, status: 200 };
});

export async function generateMetadata({ params }: { params: any }): Promise<Metadata> {
  const p = await resolveParams<{ category: string; slug: string }>(params);
  const slug = decodeURIComponent(p?.slug || "").trim();

  const { product } = await fetchProduct(slug);
  if (!product) {
    return {
      title: "Product Not Found",
      robots: { index: false, follow: false },
    };
  }

  const base = siteUrl();
  const expectedCategorySlug = product.categorySlug || categorySlugFromProductCategory(product.category);
  const canonical = `${base}/${expectedCategorySlug}/${encodeURIComponent(product.slug)}`;

  const title = safeText(product.title) || safeText(product.subjectCode) || "Product";
  const description = (
    safeText(product.shortDesc) ||
    stripHtml(safeText(product.descriptionHtml)).slice(0, 180) ||
    `${categoryLabelFromSlug(expectedCategorySlug)} product for IGNOU students.`
  ).slice(0, 180);

  const ogImage =
    safeText(product.thumbnailUrl) ||
    safeText(product.quickUrl) ||
    (Array.isArray(product.images) ? safeText(product.images[0]) : "");

  return {
    title: `${title} | ${categoryLabelFromSlug(expectedCategorySlug)}`,
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
  const categorySlug = decodeURIComponent(p?.category || "").trim();
  const slug = decodeURIComponent(p?.slug || "").trim();

  const { product } = await fetchProduct(slug);
  if (!product) notFound();

  const expectedCategorySlug = product.categorySlug || categorySlugFromProductCategory(product.category);
  if (expectedCategorySlug && expectedCategorySlug !== categorySlug) {
    permanentRedirect(`/${expectedCategorySlug}/${encodeURIComponent(product.slug)}`);
  }

  const base = siteUrl();
  const productUrl = `${base}/${expectedCategorySlug}/${encodeURIComponent(product.slug)}`;
  const categoryLabel = categoryLabelFromSlug(expectedCategorySlug);
  const variant = variantFromCategorySlug(expectedCategorySlug);

  const desc =
    safeText(product.shortDesc) ||
    stripHtml(product.descriptionHtml || "").slice(0, 220) ||
    `${categoryLabel} product for IGNOU students.`;

  const images = [
    safeText(product.thumbnailUrl),
    safeText(product.quickUrl),
    ...(Array.isArray(product.images) ? product.images : []),
  ].filter(Boolean);

  const schemaAvailability = schemaAvailabilityFromValue(
    safeText(product.effectiveAvailability || product.availability)
  );

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
      price: safeNum(product.price, 0),
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