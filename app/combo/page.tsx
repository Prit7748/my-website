import type { Metadata } from "next";
import ComboPageClient from "./ComboPageClient";

const BASE_URL = "https://istudentsportal.com";
const CANONICAL_PATH = "/combo";
const CANONICAL_URL = `${BASE_URL}${CANONICAL_PATH}`;

type SearchParams = Record<string, string | string[] | undefined>;

function hasUsefulSearchParams(searchParams?: SearchParams | null) {
  if (!searchParams) return false;

  return Object.entries(searchParams).some(([key, value]) => {
    const cleanKey = String(key || "").trim();
    if (!cleanKey) return false;

    if (Array.isArray(value)) {
      return value.some((item) => String(item ?? "").trim());
    }

    return String(value ?? "").trim();
  });
}

async function resolveSearchParams(searchParams?: Promise<SearchParams> | SearchParams) {
  if (searchParams && typeof (searchParams as any).then === "function") {
    return await searchParams;
  }

  return (searchParams || {}) as SearchParams;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}): Promise<Metadata> {
  const sp = await resolveSearchParams(searchParams);
  const hasFilters = hasUsefulSearchParams(sp);

  const title = "IGNOU Combo Packs | IGNOU Students Portal";
  const description =
    "Browse IGNOU combo packs for solved assignments, PYQs, guess papers, handwritten PDFs, hardcopy delivery, ebooks and notes.";

  return {
    metadataBase: new URL(BASE_URL),
    title,
    description,

    // ✅ All /combo query URLs point to the clean SEO URL
    alternates: {
      canonical: CANONICAL_PATH,
    },

    // ✅ /combo is indexable, but /combo?subject=... filter/query URLs are noindex
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
      url: CANONICAL_URL,
      siteName: "IGNOU Students Portal",
      title,
      description,
      images: [
        {
          url: "/og.jpg",
          width: 1200,
          height: 630,
          alt: "IGNOU Combo Packs",
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

export default function ComboPage() {
  return <ComboPageClient />;
}