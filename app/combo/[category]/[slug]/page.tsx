// app/combo/[category]/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ComboDetailsClient from "./ComboDetailsClient";

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

function safeText(value: unknown) {
  return String(value ?? "").trim();
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

function isAllowedCategory(category: string) {
  return ALLOWED_CATEGORY_SLUGS.has(category);
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const p = await resolveParams(params);
  const sp = await resolveSearchParams(searchParams);

  const category = safeText(p?.category);
  const slug = safeText(p?.slug);

  if (!category || !slug || !isAllowedCategory(category)) {
    return {
      title: "Combo Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const categoryLabel = CATEGORY_LABELS[category] || titleCaseFromSlug(category);
  const readableTitle = titleCaseFromSlug(slug);
  const canonicalPath = `/combo/${category}/${slug}`;
  const canonicalUrl = `${BASE_URL}${canonicalPath}`;
  const hasFilters = hasUsefulSearchParams(sp);

  const title = `${readableTitle} | IGNOU ${categoryLabel} Combo`;
  const description = `View IGNOU ${categoryLabel} combo details, included items, pricing, medium, session and bundle information on IGNOU Students Portal.`;

  return {
    metadataBase: new URL(BASE_URL),
    title: `${title} | IGNOU Students Portal`,
    description,

    // ✅ Clean combo detail URL is canonical.
    alternates: {
      canonical: canonicalPath,
    },

    // ✅ Detail page is indexable.
    // ✅ Detail page query versions are noindex + follow.
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
      description,
      images: [
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
      images: ["/og.jpg"],
    },
  };
}

export default async function Page({ params }: PageProps) {
  const p = await resolveParams(params);

  const category = safeText(p?.category);
  const slug = safeText(p?.slug);

  if (!category || !slug || !isAllowedCategory(category)) {
    notFound();
  }

  return <ComboDetailsClient />;
}