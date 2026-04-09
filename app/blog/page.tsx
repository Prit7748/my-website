import type { Metadata } from "next";
import { Suspense } from "react";
import BlogClient from "./BlogClient";

export const dynamic = "force-dynamic";

function siteUrl() {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "https://istudentsportal.com";
  return base.replace(/\/+$/, "");
}

export async function generateMetadata(): Promise<Metadata> {
  const base = siteUrl();
  const canonical = `${base}/blog`;
  const ogImage = `${base}/logo.png`;

  const title = "IGNOU Blog | Updates, Guides, Exam Tips & Assignment Help";
  const description =
    "Read IGNOU blog articles on assignments, exams, submissions, results, practical study tips, and important student updates at IGNOU Students Portal.";

  return {
    title,
    description,
    keywords: [
      "IGNOU blog",
      "IGNOU updates",
      "IGNOU assignment help",
      "IGNOU exam tips",
      "IGNOU submission guide",
      "IGNOU students portal",
    ],
    alternates: {
      canonical,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      type: "website",
      url: canonical,
      title,
      description,
      siteName: "IGNOU Students Portal",
      images: [
        {
          url: ogImage,
          alt: "IGNOU Students Portal",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default function BlogPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <BlogClient />
    </Suspense>
  );
}