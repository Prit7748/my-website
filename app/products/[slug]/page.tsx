import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import { productHref } from "@/lib/productHref";

type ProductDoc = {
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

export const dynamic = "force-dynamic";

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

function bestOgImage(product: ProductDoc) {
  return (
    safeText(product.thumbnailUrl) ||
    safeText(product.quickUrl) ||
    (Array.isArray(product.images) ? safeText(product.images[0]) : "") ||
    ""
  );
}

async function resolveParams<T extends Record<string, any>>(params: any): Promise<T> {
  if (params && typeof params.then === "function") return await params;
  return params as T;
}

async function fetchProduct(slug: string): Promise<ProductDoc | null> {
  await dbConnect();

  const doc: any = await Product.findOne({
    slug,
    isActive: true,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  })
    .select({
      slug: 1,
      title: 1,
      category: 1,
      shortDesc: 1,
      descriptionHtml: 1,
      thumbnailUrl: 1,
      quickUrl: 1,
      images: 1,
      subjectCode: 1,
      session: 1,
    })
    .lean();

  if (!doc) return null;

  return {
    slug: safeText(doc.slug),
    title: safeText(doc.title),
    category: safeText(doc.category),
    shortDesc: safeText(doc.shortDesc),
    descriptionHtml: safeText(doc.descriptionHtml),
    thumbnailUrl: safeText(doc.thumbnailUrl),
    quickUrl: safeText(doc.quickUrl),
    images: Array.isArray(doc.images)
      ? doc.images.map((x: any) => safeText(x)).filter(Boolean)
      : [],
    subjectCode: safeText(doc.subjectCode),
    session: safeText(doc.session),
  };
}

export async function generateMetadata({ params }: { params: any }): Promise<Metadata> {
  const p = await resolveParams<{ slug: string }>(params);
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

  const product = await fetchProduct(slug);

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

  const canonicalPath = productHref({
    slug: product.slug,
    category: product.category,
  });

  const hasValidCanonical =
    Boolean(canonicalPath) &&
    canonicalPath !== "/products" &&
    canonicalPath !== `/products/${product.slug}`;

  const canonical = hasValidCanonical
    ? `${base}${canonicalPath}`
    : `${base}/products/${product.slug}`;

  const title = safeText(product.title) || "Product";

  const description = (
    safeText(product.shortDesc) ||
    stripHtml(safeText(product.descriptionHtml)).slice(0, 180) ||
    `IGNOU study material for ${safeText(product.subjectCode) || "your subject"}${
      safeText(product.session) ? ` (${safeText(product.session)})` : ""
    }.`
  ).slice(0, 180);

  const ogImage = absoluteUrl(bestOgImage(product));

  return {
    metadataBase: new URL(base),
    title,
    description,
    alternates: {
      canonical,
    },
    robots: {
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
      siteName: "IGNOU Students Portal",
      images: ogImage
        ? [
            {
              url: ogImage,
              alt: title,
            },
          ]
        : [],
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

  if (!slug) notFound();

  const product = await fetchProduct(slug);
  if (!product) notFound();

  const canonicalPath = productHref({
    slug: product.slug,
    category: product.category,
  });

  if (
    !canonicalPath ||
    canonicalPath === "/products" ||
    canonicalPath === `/products/${product.slug}`
  ) {
    notFound();
  }

  permanentRedirect(canonicalPath);
}