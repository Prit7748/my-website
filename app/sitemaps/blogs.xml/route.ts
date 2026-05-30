import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Blog from "@/models/Blog";

export const runtime = "nodejs";
export const revalidate = 21600;

const BASE_URL = "https://istudentsportal.com";
const MAX_BLOG_URLS = 10000;

type BlogSitemapDoc = {
  slug?: string;
  publishedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  createdAt?: Date | string | null;
};

function safeText(value: unknown) {
  return String(value ?? "").trim();
}

function escapeXml(value: unknown) {
  return safeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cleanSlug(value: unknown) {
  const slug = safeText(value)
    .replace(/^\/+/, "")
    .replace(/^blog\/+/i, "")
    .replace(/\/+$/, "");

  if (!slug) return "";
  if (slug.includes("?") || slug.includes("#")) return "";
  if (slug.toLowerCase() === "undefined" || slug.toLowerCase() === "null") return "";

  return encodeURIComponent(decodeURIComponent(slug));
}

function toDate(value: unknown) {
  if (!value) return null;

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function lastModifiedOf(blog: BlogSitemapDoc) {
  return (
    toDate(blog.updatedAt) ||
    toDate(blog.publishedAt) ||
    toDate(blog.createdAt) ||
    new Date()
  );
}

function blogFilter() {
  const now = new Date();

  return {
    isPublished: true,
    slug: { $exists: true, $ne: "" },
    $or: [{ publishedAt: null }, { publishedAt: { $lte: now } }],
  };
}

function buildBlogUrl(slug: string) {
  return `${BASE_URL}/blog/${slug}`;
}

function buildUrlsetXml(blogs: BlogSitemapDoc[]) {
  const uniqueBlogs = new Map<string, BlogSitemapDoc>();

  for (const blog of blogs) {
    const slug = cleanSlug(blog.slug);
    if (!slug) continue;

    const existing = uniqueBlogs.get(slug);
    if (!existing) {
      uniqueBlogs.set(slug, blog);
      continue;
    }

    const existingDate = lastModifiedOf(existing);
    const nextDate = lastModifiedOf(blog);

    if (nextDate.getTime() > existingDate.getTime()) {
      uniqueBlogs.set(slug, blog);
    }
  }

  const entries = Array.from(uniqueBlogs.entries())
    .map(([slug, blog]) => {
      const lastModified = lastModifiedOf(blog).toISOString();

      return [
        "  <url>",
        `    <loc>${escapeXml(buildBlogUrl(slug))}</loc>`,
        `    <lastmod>${escapeXml(lastModified)}</lastmod>`,
        "    <changefreq>weekly</changefreq>",
        "    <priority>0.68</priority>",
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    "</urlset>",
  ].join("\n");
}

export async function GET() {
  await dbConnect();

  const blogs: BlogSitemapDoc[] = await Blog.find(blogFilter())
    .select("slug publishedAt updatedAt createdAt")
    .sort({ publishedAt: -1, updatedAt: -1, createdAt: -1, _id: -1 })
    .limit(MAX_BLOG_URLS)
    .lean();

  const xml = buildUrlsetXml(blogs || []);

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
      "X-Robots-Tag": "noindex, follow",
    },
  });
}