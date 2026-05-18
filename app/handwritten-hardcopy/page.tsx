// ✅ FILE PATH: app/handwritten-hardcopy/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import HandwrittenHardcopyClient from "./HandwrittenHardcopyClient";

const BASE_URL = "https://istudentsportal.com";
const PAGE_PATH = "/handwritten-hardcopy";
const PAGE_URL = `${BASE_URL}${PAGE_PATH}`;

type PageProps = {
  searchParams?: Promise<{
    category?: string;
    course?: string;
    session?: string;
    language?: string;
    search?: string;
    page?: string;
  }>;
};

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const sp = (await searchParams) || {};

  const category = safeStr(sp.category);
  const course = safeStr(sp.course);
  const session = safeStr(sp.session);
  const language = safeStr(sp.language);
  const search = safeStr(sp.search);
  const page = safeStr(sp.page);

  const hasNonCanonicalParams = Boolean(
    category ||
      course ||
      session ||
      language ||
      search ||
      (page && page !== "1")
  );

  const baseTitle = "Handwritten Hardcopy Delivery";
  const parts = [course, session, language].filter(Boolean);
  const dynamicTitle = parts.length
    ? `${baseTitle} - ${parts.join(" - ")}`
    : "IGNOU Handwritten Hardcopy Delivery";

  const description = hasNonCanonicalParams
    ? `Browse IGNOU handwritten hardcopy delivery products${
        course ? ` for ${course}` : ""
      }${session ? ` (${session})` : ""}${language ? ` in ${language}` : ""}${
        search ? ` matching "${search}"` : ""
      }.`
    : "Browse IGNOU handwritten hardcopy delivery products by subject code, course, session, and medium. Find handwritten assignment hardcopy material with delivery support.";

  return {
    title: dynamicTitle,
    description,
    alternates: {
      canonical: PAGE_URL,
    },
    robots: hasNonCanonicalParams
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
      url: PAGE_URL,
      siteName: "IGNOU Students Portal",
      title: `${dynamicTitle} | IGNOU Students Portal`,
      description,
      images: [
        {
          url: "/og.jpg",
          width: 1200,
          height: 630,
          alt: "IGNOU Handwritten Hardcopy Delivery - IGNOU Students Portal",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${dynamicTitle} | IGNOU Students Portal`,
      description,
      images: ["/og.jpg"],
    },
  };
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <HandwrittenHardcopyClient />
    </Suspense>
  );
}