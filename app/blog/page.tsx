// app/blog/page.tsx  (NO CHANGE NEEDED — aapka sahi hai)
import type { Metadata } from "next";
import { Suspense } from "react";
import BlogClient from "./BlogClient";

function siteUrl() {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "http://localhost:3000";
  return base.replace(/\/+$/, "");
}

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const base = siteUrl();
  const canonical = `${base}/blog`;

  const title = "IGNOU Blog: Tips, News & Guides | IGNOU Students Portal";
  const description =
    "Latest IGNOU updates, exam tips, solved assignment guidance, study strategies, and student-friendly notes — all in one place.";

  const ogImage = `${base}/favicon.ico`;

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      url: canonical,
      title,
      description,
      siteName: "IGNOU Students Portal",
      images: [{ url: ogImage, alt: "IGNOU Students Portal" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <BlogClient />
    </Suspense>
  );
}
