// app/combo/[category]/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import ComboDetailsClient from "./ComboDetailsClient";

import dbConnect from "@/lib/db";
import Combo from "@/models/Combo";

const BASE_URL = "https://istudentsportal.com";

const ALLOWED_CATEGORY_SLUGS = new Set([
  "solved-assignments",
  "question-papers",
  "guess-papers",
  "ebooks-notes",
  "handwritten-pdfs",
  "handwritten-hardcopy",
  "projects-synopsis",
]);

const CATEGORY_LABELS: Record<string, string> = {
  "solved-assignments": "Solved Assignments",
  "question-papers": "PYQ",
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
  thumbUrl?: string;
  itemsSnapshot?: Array<{
    title?: string;
    thumbUrl?: string;
  }>;
};

export const dynamic = "force-dynamic";

function safeText(value: unknown) {
  return String(value ?? "").trim();
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

function absoluteUrl(pathOrUrl?: string) {
  const value = safeText(pathOrUrl);
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
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
        "thumbUrl",
        "itemsSnapshot.title",
        "itemsSnapshot.thumbUrl",
        "updatedAt",
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
  const categoryLabel =
    safeText(combo.categoryLabel) ||
    CATEGORY_LABELS[finalCategory] ||
    titleCaseFromSlug(finalCategory);

  const canonicalPath = `/combo/${finalCategory}/${finalSlug}`;
  const canonicalUrl = `${BASE_URL}${canonicalPath}`;
  const hasFilters = hasUsefulSearchParams(sp);

  const fallbackTitle = `${titleCaseFromSlug(finalSlug)} | IGNOU ${categoryLabel} Combo`;
  const title = safeText(combo.metaTitle) || safeText(combo.title) || fallbackTitle;

  const description =
    safeText(combo.metaDescription) ||
    safeText(combo.shortDescription) ||
    safeText(combo.description) ||
    `View IGNOU ${categoryLabel} combo details, included items, pricing, medium, session and bundle information on IGNOU Students Portal.`;

  const image = comboImage(combo);

  return {
    metadataBase: new URL(BASE_URL),
    title: `${title} | IGNOU Students Portal`,
    description: description.slice(0, 180),

    alternates: {
      canonical: canonicalPath,
    },

    robots: hasFilters
      ? {
          index: false,
          follow: true,
          googleBot: {
            index: false,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },

    openGraph: {
      type: "website",
      url: canonicalUrl,
      siteName: "IGNOU Students Portal",
      title,
      description: description.slice(0, 180),
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
      description: description.slice(0, 180),
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
  const canonicalPath = `/combo/${finalCategory}/${finalSlug}`;

  if (rawCategory !== finalCategory || rawSlug !== finalSlug) {
    permanentRedirect(canonicalPath);
  }

  return <ComboDetailsClient />;
}