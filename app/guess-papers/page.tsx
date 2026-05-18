// ✅ FILE PATH: app/guess-papers/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import GuessPapersClient from "./GuessPapersClient";

const BASE_URL = "https://istudentsportal.com";
const PAGE_PATH = "/guess-papers";
const PAGE_URL = `${BASE_URL}${PAGE_PATH}`;

const PAGE_TITLE = "IGNOU Guess Papers for All Courses and Sessions";
const PAGE_DESCRIPTION =
  "Browse IGNOU guess papers by subject code, course, session, and medium. Find exam-focused IGNOU guess papers quickly for your subject and programme.";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: PAGE_URL,
  },
  robots: {
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
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "IGNOU Guess Papers - IGNOU Students Portal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/og.jpg"],
  },
};

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <GuessPapersClient />
    </Suspense>
  );
}