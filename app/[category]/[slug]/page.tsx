// ✅ FILE: app/[category]/[slug]/page.tsx  (Complete Replace)
// NOTE: fetchProduct() is DB-direct (NO internal API fetch).
// FIX: availability fields are now passed to ProductDetailsClient + JSON-LD offer availability is dynamic.

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
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

  // ✅ availability support (IMPORTANT for details page)
  availability?: string;
  effectiveAvailability?: string;
  comingSoonSalesEnabled?: boolean;

  // optional
  videoUrl?: string;
  comboItems?: Array<{ title: string; slug: string; category?: string; price?: number; thumbUrl?: string }>;
};

function siteUrl() {
  let base = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://localhost:3000";
  base = String(base || "").trim().replace(/\/+$/, "");

  if (!/^https?:\/\//i.test(base)) {
    if (base.startsWith("localhost") || base.startsWith("127.0.0.1")) base = `http://${base}`;
    else base = `https://${base}`;
  }

  return base.replace(/\/+$/, "");
}

function safeText(input: any) {
  return String(input || "").trim();
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

function variantFromCategorySlug(categorySlug: string): "digital" | "hardcopy" | "pyq" | "projects" | "combo" {
  if (categorySlug === "handwritten-hardcopy") return "hardcopy";
  if (categorySlug === "combo") return "combo";
  if (categorySlug === "projects") return "projects";
  if (categorySlug === "question-papers") return "pyq";
  return "digital";
}

function normAvail(v?: string) {
  return safeText(v).toLowerCase();
}

async function fetchProduct(slug: string) {
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

    // ✅ pass availability to client (CRITICAL)
    availability: safeText(doc.availability),
    effectiveAvailability: safeText(doc.effectiveAvailability),
    comingSoonSalesEnabled: Boolean(doc.comingSoonSalesEnabled ?? false),
  };

  return { product, status: 200 };
}

export async function generateMetadata({ params }: { params: any }): Promise<Metadata> {
  const p = await resolveParams<{ category: string; slug: string }>(params);
  const categorySlug = decodeURIComponent(p?.category || "").trim();
  const slug = decodeURIComponent(p?.slug || "").trim();

  const { product } = await fetchProduct(slug);
  if (!product) return { title: "Product Not Found", robots: { index: false, follow: false } };

  const base = siteUrl();
  const canonical = `${base}/${categorySlug}/${product.slug}`;

  const title = safeText(product.title);
  const description = (
    safeText(product.shortDesc) ||
    stripHtml(safeText(product.descriptionHtml)).slice(0, 180) ||
    "IGNOU study material product."
  ).slice(0, 180);

  const ogImage = safeText(product.thumbnailUrl) || safeText(product.quickUrl) || (product.images?.[0] || "");

  return {
    title: `${title} | ${categoryLabelFromSlug(categorySlug)}`,
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
  const p = await resolveParams<{ category: string; slug: string }>(params);
  const categorySlug = decodeURIComponent(p?.category || "").trim();
  const slug = decodeURIComponent(p?.slug || "").trim();

  const { product } = await fetchProduct(slug);
  if (!product) notFound();

  const label = safeText(product.category);

  const expectedSlugByLabel: Record<string, string> = {
    "Solved Assignments": "solved-assignments",
    "Handwritten PDFs": "handwritten-pdfs",
    "Handwritten Hardcopy (Delivery)": "handwritten-hardcopy",
    "Question Papers (PYQ)": "question-papers",
    "Guess Papers": "guess-papers",
    "eBooks/Notes": "ebooks",
    "Projects & Synopsis": "projects",
    Combo: "combo",
    Products: "products",
  };

  const expectedCategorySlug = expectedSlugByLabel[label] || categorySlug;
  if (expectedCategorySlug && expectedCategorySlug !== categorySlug) {
    redirect(`/${expectedCategorySlug}/${product.slug}`);
  }

  const base = siteUrl();
  const productUrl = `${base}/${expectedCategorySlug}/${product.slug}`;
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

  // ✅ JSON-LD offer availability (SEO)
  const rawAvail = normAvail(product.availability);
  const schemaAvailability =
    rawAvail === "out_of_stock" || rawAvail === "outofstock" || rawAvail === "out-of-stock"
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
      { "@type": "ListItem", position: 2, name: categoryLabel, item: `${base}/${expectedCategorySlug}` },
      { "@type": "ListItem", position: 3, name: safeText(product.title), item: productUrl },
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

      <ProductDetailsClient initialProduct={product as any} categorySlug={expectedCategorySlug} variant={variant} />
    </>
  );
}