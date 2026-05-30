// app/combo/[category]/[slug]/page.tsx
import type { Metadata } from "next";
import Script from "next/script";
import { notFound, permanentRedirect } from "next/navigation";
import ComboDetailsClient from "./ComboDetailsClient";

import dbConnect from "@/lib/db";
import Combo from "@/models/Combo";

const BASE_URL = "https://istudentsportal.com";
const SITE_NAME = "IGNOU Students Portal";

const ALLOWED_CATEGORY_SLUGS = new Set([
  "solved-assignments",
  "question-papers",
  "guess-papers",
  "ebooks-notes",
  "handwritten-pdfs",
  "handwritten-hardcopy",
  "projects-synopsis",
]);

const INDEXABLE_CATEGORY_SLUGS = new Set([
  "solved-assignments",
  "question-papers",
  "guess-papers",
  "ebooks-notes",
  "handwritten-pdfs",
  "handwritten-hardcopy",
]);

const CATEGORY_LABELS: Record<string, string> = {
  "solved-assignments": "Solved Assignments",
  "question-papers": "Question Papers (PYQ)",
  "guess-papers": "Guess Papers",
  "ebooks-notes": "Ebooks and Notes",
  "handwritten-pdfs": "Handwritten PDFs",
  "handwritten-hardcopy": "Handwritten Hardcopy Delivery",
  "projects-synopsis": "Project and Synopsis",
};

type Params = {
  category?: string;
  slug?: string;
};

type SearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  params: Promise<Params> | Params;
  searchParams?: Promise<SearchParams> | SearchParams;
};

type ComboSeoDoc = {
  _id?: unknown;
  title?: string;
  shortTitle?: string;
  slug?: string;
  categorySlug?: string;
  categoryLabel?: string;

  description?: string;
  shortDescription?: string;
  metaTitle?: string;
  metaDescription?: string;

  badge?: string;
  itemsLabel?: string;
  thumbUrl?: string;

  subjectCode?: string;
  medium?: string;
  mediumLabel?: string;
  sessionLabel?: string;
  sessionRangeLabel?: string;
  courseCodes?: string[];

  totalMrp?: number;
  offerPrice?: number;
  saveAmount?: number;
  savePercent?: number;
  priceLabel?: string;
  saveLabel?: string;

  itemsSnapshot?: Array<{
    title?: string;
    slug?: string;
    category?: string;
    subjectCode?: string;
    subjectTitleEn?: string;
    subjectTitleHi?: string;
    medium?: string;
    session?: string;
    courseCodes?: string[];
    price?: number;
    thumbUrl?: string;
  }>;

  updatedAt?: Date | string | null;
  createdAt?: Date | string | null;
};

type ComboItemSnapshot = NonNullable<ComboSeoDoc["itemsSnapshot"]>[number];

export const dynamic = "force-dynamic";

function safeText(value: unknown) {
  return String(value ?? "").trim();
}

function compactText(value: unknown) {
  return safeText(value).replace(/\s+/g, " ").trim();
}

function safeNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeSlug(value: unknown) {
  return safeText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function titleCaseFromSlug(slug: string) {
  return safeText(slug)
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function truncateText(value: unknown, maxLength: number) {
  const text = compactText(value);

  if (!text) return "";
  if (text.length <= maxLength) return text;

  const sliced = text.slice(0, maxLength).trim();
  const lastSpace = sliced.lastIndexOf(" ");

  if (lastSpace > Math.floor(maxLength * 0.65)) {
    return sliced.slice(0, lastSpace).trim();
  }

  return sliced;
}

async function resolveParams(params: Promise<Params> | Params) {
  if (params && typeof (params as any).then === "function") {
    return await params;
  }

  return params as Params;
}

async function resolveSearchParams(searchParams?: Promise<SearchParams> | SearchParams) {
  if (searchParams && typeof (searchParams as any).then === "function") {
    return await searchParams;
  }

  return (searchParams || {}) as SearchParams;
}

function hasUsefulSearchParams(searchParams?: SearchParams | null) {
  if (!searchParams) return false;

  return Object.entries(searchParams).some(([key, value]) => {
    const cleanKey = safeText(key);
    if (!cleanKey) return false;

    if (Array.isArray(value)) {
      return value.some((item) => safeText(item));
    }

    return !!safeText(value);
  });
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
        return `${BASE_URL}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }

      return value;
    } catch {
      return "";
    }
  }

  return `${BASE_URL}${value.startsWith("/") ? value : `/${value}`}`;
}

function comboImage(combo: ComboSeoDoc | null) {
  if (!combo) return "";

  const direct = safeText(combo.thumbUrl);
  if (direct) return absoluteUrl(direct);

  const firstItemThumb = Array.isArray(combo.itemsSnapshot)
    ? safeText(combo.itemsSnapshot.find((item) => safeText(item?.thumbUrl))?.thumbUrl)
    : "";

  return firstItemThumb ? absoluteUrl(firstItemThumb) : "";
}

function isAllowedCategory(category: string) {
  return ALLOWED_CATEGORY_SLUGS.has(category);
}

function isIndexableCategory(category: string) {
  return INDEXABLE_CATEGORY_SLUGS.has(category);
}

function buildComboTitle(combo: ComboSeoDoc, categoryLabel: string, finalSlug: string) {
  const customMetaTitle = truncateText(combo.metaTitle, 95);
  if (customMetaTitle) return customMetaTitle;

  const title = truncateText(combo.title || combo.shortTitle, 90);
  if (title) return title;

  return truncateText(`${titleCaseFromSlug(finalSlug)} | IGNOU ${categoryLabel} Combo`, 95);
}

function buildComboDescription(combo: ComboSeoDoc, categoryLabel: string) {
  const customMetaDescription = truncateText(combo.metaDescription, 180);
  if (customMetaDescription) return customMetaDescription;

  const shortDescription = truncateText(combo.shortDescription, 180);
  if (shortDescription) return shortDescription;

  const description = truncateText(combo.description, 180);
  if (description) return description;

  const courseCodes = Array.isArray(combo.courseCodes)
    ? combo.courseCodes.map((item) => safeText(item)).filter(Boolean).join(", ")
    : "";

  return truncateText(
    [
      `View IGNOU ${categoryLabel} combo pack details`,
      courseCodes ? `for ${courseCodes}` : "",
      safeText(combo.mediumLabel || combo.medium),
      safeText(combo.sessionLabel || combo.sessionRangeLabel),
      `on ${SITE_NAME}.`,
    ]
      .filter(Boolean)
      .join(" "),
    180
  );
}

function priceValue(combo: ComboSeoDoc) {
  const offerPrice = safeNumber(combo.offerPrice, 0);
  if (offerPrice > 0) return offerPrice;

  const totalMrp = safeNumber(combo.totalMrp, 0);
  if (totalMrp > 0) return totalMrp;

  return 0;
}

function buildSku(combo: ComboSeoDoc, category: string, slug: string) {
  const raw = ["COMBO", category, safeText(combo.subjectCode), slug]
    .filter(Boolean)
    .join("-");

  const sku = raw
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 70);

  return sku || undefined;
}

function productItemUrl(item: ComboItemSnapshot) {
  const slug = normalizeSlug(item?.slug);
  const category = safeText(item?.category);

  if (!slug || !category) return "";

  const categoryMap: Record<string, string> = {
    "Solved Assignments": "solved-assignments",
    "Question Papers (PYQ)": "question-papers",
    "Question Papers": "question-papers",
    "Guess Papers": "guess-papers",
    "Handwritten PDFs": "handwritten-pdfs",
    "Handwritten Hardcopy (Delivery)": "handwritten-hardcopy",
    "Handwritten Hardcopy": "handwritten-hardcopy",
    "eBooks/Notes": "ebooks",
    Ebooks: "ebooks",
    Projects: "projects",
    "Projects & Synopsis": "projects",
  };

  const categorySlug = categoryMap[category] || normalizeSlug(category);
  if (!categorySlug) return "";

  return `${BASE_URL}/${categorySlug}/${slug}`;
}

function buildComboItemList(combo: ComboSeoDoc) {
  const items: ComboItemSnapshot[] = Array.isArray(combo.itemsSnapshot)
    ? combo.itemsSnapshot
    : [];

  return items
    .map((item, index) => {
      const name = safeText(item?.title);
      if (!name) return null;

      const url = productItemUrl(item);
      const image = absoluteUrl(item?.thumbUrl);

      return {
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Product",
          name,
          url: url || undefined,
          image: image || undefined,
          sku: safeText(item?.subjectCode) || undefined,
          category: safeText(item?.category) || undefined,
        },
      };
    })
    .filter(Boolean);
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

async function fetchCombo(category: string, slug: string): Promise<ComboSeoDoc | null> {
  if (!category || !slug || !isAllowedCategory(category)) return null;

  await dbConnect();

  const doc = await Combo.findOne({
    categorySlug: category,
    slug,
    isActive: true,
    status: "active",
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  })
    .select(
      [
        "title",
        "shortTitle",
        "slug",
        "categorySlug",
        "categoryLabel",

        "description",
        "shortDescription",
        "metaTitle",
        "metaDescription",

        "badge",
        "itemsLabel",
        "thumbUrl",

        "subjectCode",
        "medium",
        "mediumLabel",
        "sessionLabel",
        "sessionRangeLabel",
        "courseCodes",

        "totalMrp",
        "offerPrice",
        "saveAmount",
        "savePercent",
        "priceLabel",
        "saveLabel",

        "itemsSnapshot.title",
        "itemsSnapshot.slug",
        "itemsSnapshot.category",
        "itemsSnapshot.subjectCode",
        "itemsSnapshot.subjectTitleEn",
        "itemsSnapshot.subjectTitleHi",
        "itemsSnapshot.medium",
        "itemsSnapshot.session",
        "itemsSnapshot.courseCodes",
        "itemsSnapshot.price",
        "itemsSnapshot.thumbUrl",

        "updatedAt",
        "createdAt",
      ].join(" ")
    )
    .lean();

  return doc as ComboSeoDoc | null;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const p = await resolveParams(params);
  const sp = await resolveSearchParams(searchParams);

  const category = normalizeSlug(p?.category);
  const slug = normalizeSlug(p?.slug);

  if (!category || !slug || !isAllowedCategory(category)) {
    return {
      title: "Combo Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const combo = await fetchCombo(category, slug);

  if (!combo) {
    return {
      title: "Combo Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const finalCategory = normalizeSlug(combo.categorySlug) || category;
  const finalSlug = normalizeSlug(combo.slug) || slug;

  if (!isAllowedCategory(finalCategory)) {
    return {
      title: "Combo Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const categoryLabel =
    safeText(combo.categoryLabel) ||
    CATEGORY_LABELS[finalCategory] ||
    titleCaseFromSlug(finalCategory);

  const canonicalPath = `/combo/${finalCategory}/${finalSlug}`;
  const canonicalUrl = `${BASE_URL}${canonicalPath}`;
  const hasFilters = hasUsefulSearchParams(sp);
  const shouldIndex = isIndexableCategory(finalCategory) && !hasFilters;

  const title = buildComboTitle(combo, categoryLabel, finalSlug);
  const description = buildComboDescription(combo, categoryLabel);
  const image = comboImage(combo);

  return {
    metadataBase: new URL(BASE_URL),
    title: `${title} | ${SITE_NAME}`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: shouldIndex
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
      url: canonicalUrl,
      siteName: SITE_NAME,
      title,
      description,
      images: image
        ? [
            {
              url: image,
              alt: title,
            },
          ]
        : [
            {
              url: "/og.jpg",
              width: 1200,
              height: 630,
              alt: title,
            },
          ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : ["/og.jpg"],
    },
  };
}

export default async function Page({ params }: PageProps) {
  const p = await resolveParams(params);

  const rawCategory = safeText(p?.category);
  const rawSlug = safeText(p?.slug);

  const category = normalizeSlug(rawCategory);
  const slug = normalizeSlug(rawSlug);

  if (!category || !slug || !isAllowedCategory(category)) {
    notFound();
  }

  const combo = await fetchCombo(category, slug);

  if (!combo) {
    notFound();
  }

  const finalCategory = normalizeSlug(combo.categorySlug) || category;
  const finalSlug = normalizeSlug(combo.slug) || slug;

  if (!isAllowedCategory(finalCategory) || !finalSlug) {
    notFound();
  }

  const canonicalPath = `/combo/${finalCategory}/${finalSlug}`;

  if (rawCategory !== finalCategory || rawSlug !== finalSlug) {
    permanentRedirect(canonicalPath);
  }

  const categoryLabel =
    safeText(combo.categoryLabel) ||
    CATEGORY_LABELS[finalCategory] ||
    titleCaseFromSlug(finalCategory);

  const canonicalUrl = `${BASE_URL}${canonicalPath}`;
  const title = buildComboTitle(combo, categoryLabel, finalSlug);
  const description = buildComboDescription(combo, categoryLabel);
  const image = comboImage(combo);
  const itemList = buildComboItemList(combo);
  const price = priceValue(combo);

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: title,
    description,
    image: image ? [image] : undefined,
    sku: buildSku(combo, finalCategory, finalSlug),
    brand: {
      "@type": "Brand",
      name: SITE_NAME,
    },
    category: categoryLabel,
    url: canonicalUrl,
    mainEntityOfPage: canonicalUrl,
    isRelatedTo: itemList.length
      ? itemList.map((entry: any) => entry.item)
      : undefined,
    offers: price
      ? {
          "@type": "Offer",
          url: canonicalUrl,
          priceCurrency: "INR",
          price,
          availability: "https://schema.org/InStock",
          itemCondition: "https://schema.org/NewCondition",
          seller: {
            "@type": "Organization",
            name: SITE_NAME,
            url: BASE_URL,
          },
        }
      : undefined,
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "Combo Category",
        value: categoryLabel,
      },
      {
        "@type": "PropertyValue",
        name: "Subject Code",
        value: safeText(combo.subjectCode),
      },
      {
        "@type": "PropertyValue",
        name: "Course Codes",
        value: Array.isArray(combo.courseCodes)
          ? combo.courseCodes.map((item) => safeText(item)).filter(Boolean).join(", ")
          : "",
      },
      {
        "@type": "PropertyValue",
        name: "Medium",
        value: safeText(combo.mediumLabel || combo.medium),
      },
      {
        "@type": "PropertyValue",
        name: "Session",
        value: safeText(combo.sessionLabel || combo.sessionRangeLabel),
      },
    ],
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${BASE_URL}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Combo",
        item: `${BASE_URL}/combo`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: categoryLabel,
        item: `${BASE_URL}/combo/${finalCategory}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: title,
        item: canonicalUrl,
      },
    ],
  };

  const itemListJsonLd = itemList.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: `${title} Included Items`,
        itemListElement: itemList,
      }
    : null;

  return (
    <>
      <Script
        id="isp-combo-jsonld-product"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(productJsonLd) }}
      />
      <Script
        id="isp-combo-jsonld-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd) }}
      />
      {itemListJsonLd ? (
        <Script
          id="isp-combo-jsonld-itemlist"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(itemListJsonLd) }}
        />
      ) : null}

      <ComboDetailsClient />
    </>
  );
}