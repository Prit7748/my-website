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

const OFFICIAL_SITE_URL = "https://istudentsportal.com";
const SITE_NAME = "IGNOU Students Portal";

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

  metaTitle?: string;
  metaDescription?: string;

  isDigital?: boolean;
  pdfUrl?: string;
  isActive?: boolean;

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

function compactText(input: unknown) {
  return safeText(input).replace(/\s+/g, " ").trim();
}

function stripHtml(html: string) {
  return safeText(html)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?[^>]+(>|$)/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(input: unknown, maxLength: number) {
  const text = compactText(input);
  if (!text) return "";
  if (text.length <= maxLength) return text;

  const sliced = text.slice(0, maxLength).trim();
  const lastSpace = sliced.lastIndexOf(" ");

  if (lastSpace > Math.floor(maxLength * 0.65)) {
    return sliced.slice(0, lastSpace).trim();
  }

  return sliced;
}

function siteUrl() {
  return OFFICIAL_SITE_URL;
}

function isLocalHost(hostname: string) {
  const host = safeText(hostname).toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function absoluteUrl(pathOrUrl?: string) {
  const value = safeText(pathOrUrl);
  if (!value) return "";

  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);

      if (
        isLocalHost(parsed.hostname) ||
        parsed.hostname === "istudentsportal.com" ||
        parsed.hostname === "www.istudentsportal.com"
      ) {
        return `${OFFICIAL_SITE_URL}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }

      return value;
    } catch {
      return "";
    }
  }

  return `${OFFICIAL_SITE_URL}${value.startsWith("/") ? value : `/${value}`}`;
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

function buildSeoTitle(product: ApiProduct, categoryLabel: string) {
  const customMetaTitle = truncateText(product.metaTitle, 95);
  if (customMetaTitle) return customMetaTitle;

  const title = truncateText(product.title, 80);
  if (!title) return `${categoryLabel} | ${SITE_NAME}`;

  return truncateText(`${title} | ${categoryLabel}`, 105);
}

function buildSeoDescription(product: ApiProduct, categoryLabel: string) {
  const customMetaDescription = truncateText(product.metaDescription, 180);
  if (customMetaDescription) return customMetaDescription;

  const shortDesc = truncateText(product.shortDesc, 180);
  if (shortDesc) return shortDesc;

  const htmlDesc = truncateText(stripHtml(product.descriptionHtml || ""), 180);
  if (htmlDesc) return htmlDesc;

  const sessionText = safeText(product.session);
  const languageText = safeText(product.language);
  const subjectCodeText = safeText(product.subjectCode);

  return truncateText(
    [
      safeText(product.title),
      categoryLabel,
      subjectCodeText ? `Subject Code: ${subjectCodeText}` : "",
      sessionText ? `Session: ${sessionText}` : "",
      languageText ? `${languageText} Medium` : "",
      `available at ${SITE_NAME}.`,
    ]
      .filter(Boolean)
      .join(" "),
    180
  );
}

function buildSchemaDescription(product: ApiProduct, categoryLabel: string) {
  const description =
    compactText(product.metaDescription) ||
    compactText(product.shortDesc) ||
    stripHtml(product.descriptionHtml || "") ||
    `${safeText(product.title)} ${categoryLabel} for IGNOU students.`;

  return truncateText(description, 500);
}

function buildSchemaSku(product: ApiProduct) {
  const raw =
    safeText(product.sku) ||
    safeText(product.subjectCode) ||
    safeText(product.slug);

  const sku = raw
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 70);

  return sku || undefined;
}

function schemaAvailability(product: ApiProduct) {
  const rawAvail = normAvail(product.effectiveAvailability || product.availability);

  if (
    rawAvail === "out_of_stock" ||
    rawAvail === "outofstock" ||
    rawAvail === "out-of-stock" ||
    rawAvail === "want_to_buy" ||
    rawAvail === "wanttobuy" ||
    rawAvail === "want-to-buy"
  ) {
    return "https://schema.org/OutOfStock";
  }

  if (
    rawAvail === "on_demand" ||
    rawAvail === "ondemand" ||
    rawAvail === "on-demand" ||
    rawAvail === "coming_soon" ||
    rawAvail === "comingsoon" ||
    rawAvail === "coming-soon"
  ) {
    return "https://schema.org/PreOrder";
  }

  return "https://schema.org/InStock";
}

function productAdditionalProperties(product: ApiProduct) {
  const properties = [
    ["Subject Code", product.subjectCode],
    ["Subject Title", product.subjectTitleEn || product.subjectTitleHi],
    ["Course Codes", Array.isArray(product.courseCodes) ? product.courseCodes.join(", ") : ""],
    ["Session", product.session],
    ["Medium", product.language],
    ["Pages", product.pages && product.pages > 0 ? String(product.pages) : ""],
  ];

  return properties
    .map(([name, value]) => ({
      "@type": "PropertyValue",
      name: safeText(name),
      value: safeText(value),
    }))
    .filter((item) => item.name && item.value);
}

function cleanJsonLd(value: any): any {
  if (Array.isArray(value)) {
    const arr = value.map(cleanJsonLd).filter((item) => {
      if (item === undefined || item === null) return false;
      if (typeof item === "string" && !item.trim()) return false;
      if (Array.isArray(item) && item.length === 0) return false;
      if (
        typeof item === "object" &&
        !Array.isArray(item) &&
        Object.keys(item).length === 0
      ) {
        return false;
      }
      return true;
    });

    return arr.length ? arr : undefined;
  }

  if (value && typeof value === "object") {
    const output: Record<string, any> = {};

    Object.entries(value).forEach(([key, item]) => {
      const cleaned = cleanJsonLd(item);

      if (cleaned === undefined || cleaned === null) return;
      if (typeof cleaned === "string" && !cleaned.trim()) return;
      if (Array.isArray(cleaned) && cleaned.length === 0) return;
      if (
        typeof cleaned === "object" &&
        !Array.isArray(cleaned) &&
        Object.keys(cleaned).length === 0
      ) {
        return;
      }

      output[key] = cleaned;
    });

    return Object.keys(output).length ? output : undefined;
  }

  return value;
}

function jsonLdScript(data: any) {
  return JSON.stringify(cleanJsonLd(data)).replace(/</g, "\\u003c");
}

const fetchProduct = cache(async (slug: string) => {
  await dbConnect();

  const doc: any = await Product.findOne({
    slug,
    isActive: true,
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

    metaTitle: safeText(doc.metaTitle),
    metaDescription: safeText(doc.metaDescription),

    isDigital: Boolean(doc.isDigital ?? true),
    pdfUrl: safeText(doc.pdfUrl),
    isActive: Boolean(doc.isActive),

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
    return {
      title: "Product Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const { product } = await fetchProduct(slug);

  if (!product) {
    return {
      title: "Product Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const base = siteUrl();
  const canonicalPath = productHref({ slug: product.slug, category: product.category });
  const canonical = `${base}${canonicalPath}`;
  const canonicalCategorySlug = categorySlugFromHref(
    canonicalPath,
    requestedCategorySlug || "products"
  );
  const categoryLabel = categoryLabelFromSlug(canonicalCategorySlug);

  const canIndex = Boolean(canonicalCategorySlug && canonicalCategorySlug !== "products");

  const title = buildSeoTitle(product, categoryLabel);
  const description = buildSeoDescription(product, categoryLabel);

  const ogImageRaw = buildMasterThumbnailFallback(product);
  const ogImage = absoluteUrl(ogImageRaw);

  return {
    metadataBase: new URL(base),
    title,
    description,
    alternates: {
      canonical,
    },
    robots: canIndex
      ? {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        }
      : {
          index: false,
          follow: true,
          googleBot: {
            index: false,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
    openGraph: {
      type: "website",
      url: canonical,
      title,
      description,
      siteName: SITE_NAME,
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

  const seoTitle = buildSeoTitle(product, categoryLabel);
  const schemaDescription = buildSchemaDescription(product, categoryLabel);

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

  const additionalProperty = productAdditionalProperties(product);

  const productJsonLd: any = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: safeText(product.title),
    image: images.length ? images : undefined,
    description: schemaDescription,
    sku: buildSchemaSku(product),
    brand: {
      "@type": "Brand",
      name: SITE_NAME,
    },
    category: categoryLabel,
    url: productUrl,
    mainEntityOfPage: productUrl,
    additionalProperty: additionalProperty.length ? additionalProperty : undefined,
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "INR",
      price: Number(product.price || 0),
      availability: schemaAvailability(product),
      itemCondition: "https://schema.org/NewCondition",
      seller: {
        "@type": "Organization",
        name: SITE_NAME,
        url: base,
      },
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${base}/`,
      },
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
    name: seoTitle,
    url: productUrl,
    description: buildSeoDescription(product, categoryLabel),
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: base,
    },
    mainEntity: {
      "@id": productUrl,
    },
  };

  return (
    <>
      <Script
        id="isp-jsonld-product"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(productJsonLd) }}
      />
      <Script
        id="isp-jsonld-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd) }}
      />
      <Script
        id="isp-jsonld-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(webPageJsonLd) }}
      />

      <ProductDetailsClient
        initialProduct={product as any}
        categorySlug={expectedCategorySlug}
        variant={variant}
      />
    </>
  );
}