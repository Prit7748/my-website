// app/combo/[category]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ComboCategoryClient from "./ComboCategoryClient";

const BASE_URL = "https://istudentsportal.com";

const CATEGORY_CONFIGS: Record<
  string,
  {
    title: string;
    description: string;
    indexable: boolean;
  }
> = {
  "solved-assignments": {
    title: "IGNOU Solved Assignments Combo Packs",
    description:
      "Browse IGNOU solved assignment combo packs with category-wise bundles, easier comparison, and faster access to study material.",
    indexable: true,
  },
  "question-papers": {
    title: "IGNOU PYQ Combo Packs",
    description:
      "Explore IGNOU previous year question paper combo packs for exam preparation, session-wise revision, and faster PYQ discovery.",
    indexable: true,
  },
  "guess-papers": {
    title: "IGNOU Guess Papers Combo Packs",
    description:
      "Browse IGNOU guess paper combo packs designed for focused exam preparation, revision support, and quick subject-wise selection.",
    indexable: true,
  },
  "ebooks-notes": {
    title: "IGNOU Ebooks and Notes Combo Packs",
    description:
      "Explore IGNOU ebooks and notes combo packs with digital study material bundles in one organized section.",
    indexable: true,
  },
  "handwritten-pdfs": {
    title: "IGNOU Handwritten PDF Combo Packs",
    description:
      "Browse IGNOU handwritten PDF combo packs for digital handwritten study material bundles and easy category-wise selection.",
    indexable: true,
  },
  "handwritten-hardcopy": {
    title: "IGNOU Handwritten Hardcopy Delivery Combo Packs",
    description:
      "Explore IGNOU handwritten hardcopy delivery combo packs with physical bundle options and delivery-focused browsing.",
    indexable: true,
  },
  "projects-synopsis": {
    title: "IGNOU Project and Synopsis Combo Packs",
    description:
      "IGNOU project and synopsis combo section. This category is currently unavailable.",
    indexable: false,
  },
};

type Params = {
  category?: string;
};

type SearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  params: Promise<Params> | Params;
  searchParams?: Promise<SearchParams> | SearchParams;
};

function safeText(value: unknown) {
  return String(value ?? "").trim();
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

function getCategoryConfig(category: string) {
  return CATEGORY_CONFIGS[category] || null;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const p = await resolveParams(params);
  const sp = await resolveSearchParams(searchParams);

  const category = safeText(p?.category);
  const config = getCategoryConfig(category);

  if (!config) {
    return {
      title: "Combo Category Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const canonicalPath = `/combo/${category}`;
  const canonicalUrl = `${BASE_URL}${canonicalPath}`;
  const hasFilters = hasUsefulSearchParams(sp);
  const shouldIndex = config.indexable && !hasFilters;

  return {
    metadataBase: new URL(BASE_URL),
    title: `${config.title} | IGNOU Students Portal`,
    description: config.description,

    // ✅ Clean category URL is canonical for all query/filter versions.
    alternates: {
      canonical: canonicalPath,
    },

    // ✅ /combo/category is indexable.
    // ✅ /combo/category?search=... is noindex + follow.
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
      siteName: "IGNOU Students Portal",
      title: config.title,
      description: config.description,
      images: [
        {
          url: "/og.jpg",
          width: 1200,
          height: 630,
          alt: config.title,
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title: config.title,
      description: config.description,
      images: ["/og.jpg"],
    },
  };
}

export default async function Page({ params, searchParams }: PageProps) {
  const p = await resolveParams(params);
  const sp = await resolveSearchParams(searchParams);

  const category = safeText(p?.category);

  if (!getCategoryConfig(category)) {
    notFound();
  }

  return (
    <ComboCategoryClient
      categorySlug={category}
      initialSearchParam={typeof sp?.search === "string" ? sp.search : ""}
    />
  );
}