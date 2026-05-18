import type { Metadata } from "next";
import { Suspense } from "react";
import BlogClient from "./BlogClient";

import dbConnect from "@/lib/db";
import Blog from "@/models/Blog";

export const dynamic = "force-dynamic";

const BASE_URL = "https://istudentsportal.com";
const PAGE_URL = `${BASE_URL}/blog`;

type PageProps = {
  searchParams?: Promise<{
    tag?: string;
    category?: string;
    search?: string;
    sort?: string;
    page?: string;
  }>;
};

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

async function getPublishedBlogCount() {
  try {
    await dbConnect();

    const now = new Date();

    return await Blog.countDocuments({
      isPublished: true,
      slug: { $exists: true, $ne: "" },
      $or: [{ publishedAt: null }, { publishedAt: { $lte: now } }],
    });
  } catch {
    return null;
  }
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const sp = (await searchParams) || {};

  const tag = safeStr(sp.tag);
  const category = safeStr(sp.category);
  const search = safeStr(sp.search);
  const sort = safeStr(sp.sort);
  const page = safeStr(sp.page);

  const hasNonCanonicalParams = Boolean(
    tag ||
      category ||
      search ||
      (sort && sort !== "newest") ||
      (page && page !== "1")
  );

  const publishedBlogCount = await getPublishedBlogCount();
  const hasPublishedBlogs = publishedBlogCount === null ? true : publishedBlogCount > 0;

  const shouldIndex = hasPublishedBlogs && !hasNonCanonicalParams;

  const title = "IGNOU Blog: Updates, Guides, Exam Tips & Assignment Help";
  const description = hasNonCanonicalParams
    ? `Browse filtered IGNOU blog articles${category ? ` in ${category}` : ""}${
        tag ? ` tagged ${tag}` : ""
      }${search ? ` matching "${search}"` : ""}.`
    : "Read IGNOU blog articles on assignments, exams, submissions, results, practical study tips, and important student updates at IGNOU Students Portal.";

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
      canonical: PAGE_URL,
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
      url: PAGE_URL,
      title,
      description,
      siteName: "IGNOU Students Portal",
      images: [
        {
          url: "/og.jpg",
          width: 1200,
          height: 630,
          alt: "IGNOU Blog - IGNOU Students Portal",
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

export default function BlogPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <BlogClient />
    </Suspense>
  );
}