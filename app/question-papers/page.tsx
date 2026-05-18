// ✅ FILE: app/question-papers/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import QuestionPapersClient from "./QuestionPapersClient";

const BASE_URL = "https://istudentsportal.com";
const PAGE_PATH = "/question-papers";
const PAGE_URL = `${BASE_URL}${PAGE_PATH}`;

type PageProps = {
  searchParams?: Promise<{
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

  const course = safeStr(sp.course);
  const session = safeStr(sp.session);
  const language = safeStr(sp.language);
  const search = safeStr(sp.search);
  const page = safeStr(sp.page);

  const hasNonCanonicalParams = Boolean(
    course || session || language || search || (page && page !== "1")
  );

  const baseTitle = "Question Papers";
  const parts = [course, session, language].filter(Boolean);
  const dynamicTitle = parts.length
    ? `${baseTitle} - ${parts.join(" - ")}`
    : "IGNOU Previous Year Question Papers";

  const description = hasNonCanonicalParams
    ? `Browse IGNOU previous year question papers${course ? ` for ${course}` : ""}${
        session ? ` (${session})` : ""
      }${language ? ` in ${language}` : ""}${search ? ` matching "${search}"` : ""}.`
    : "Browse IGNOU previous year question papers by subject code, course, session, and medium. Find PYQ papers quickly for exam preparation.";

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
          alt: "IGNOU Question Papers - IGNOU Students Portal",
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
      <QuestionPapersClient />
    </Suspense>
  );
}