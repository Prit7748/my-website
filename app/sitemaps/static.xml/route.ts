import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 21600;

const BASE_URL = "https://istudentsportal.com";

type StaticSitemapItem = {
  path: string;
  changeFrequency:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority: number;
};

const STATIC_URLS: StaticSitemapItem[] = [
  {
    path: "/",
    changeFrequency: "daily",
    priority: 1.0,
  },
  {
    path: "/solved-assignments",
    changeFrequency: "daily",
    priority: 0.95,
  },
  {
    path: "/question-papers",
    changeFrequency: "daily",
    priority: 0.92,
  },
  {
    path: "/handwritten-hardcopy",
    changeFrequency: "daily",
    priority: 0.9,
  },
  {
    path: "/handwritten-pdfs",
    changeFrequency: "daily",
    priority: 0.88,
  },
  {
    path: "/guess-papers",
    changeFrequency: "daily",
    priority: 0.86,
  },
  {
    path: "/ebooks",
    changeFrequency: "weekly",
    priority: 0.82,
  },
  {
    path: "/projects",
    changeFrequency: "weekly",
    priority: 0.82,
  },
  {
    path: "/combo",
    changeFrequency: "daily",
    priority: 0.84,
  },
  {
    path: "/combo/solved-assignments",
    changeFrequency: "daily",
    priority: 0.82,
  },
  {
    path: "/combo/question-papers",
    changeFrequency: "daily",
    priority: 0.8,
  },
  {
    path: "/combo/guess-papers",
    changeFrequency: "daily",
    priority: 0.78,
  },
  {
    path: "/combo/handwritten-pdfs",
    changeFrequency: "daily",
    priority: 0.78,
  },
  {
    path: "/combo/handwritten-hardcopy",
    changeFrequency: "daily",
    priority: 0.78,
  },
  {
    path: "/combo/ebooks-notes",
    changeFrequency: "weekly",
    priority: 0.74,
  },
  {
    path: "/courses",
    changeFrequency: "weekly",
    priority: 0.72,
  },
  {
    path: "/blog",
    changeFrequency: "weekly",
    priority: 0.7,
  },
  {
    path: "/about",
    changeFrequency: "monthly",
    priority: 0.45,
  },
  {
    path: "/contact",
    changeFrequency: "monthly",
    priority: 0.45,
  },
  {
    path: "/faq",
    changeFrequency: "monthly",
    priority: 0.42,
  },
  {
    path: "/privacy",
    changeFrequency: "yearly",
    priority: 0.25,
  },
  {
    path: "/terms",
    changeFrequency: "yearly",
    priority: 0.25,
  },
  {
    path: "/refund-policy",
    changeFrequency: "yearly",
    priority: 0.25,
  },
];

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizePath(path: string) {
  const clean = String(path || "").trim();

  if (!clean) return "/";
  if (clean === "/") return "/";

  return `/${clean.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

function absoluteUrl(path: string) {
  return `${BASE_URL}${normalizePath(path) === "/" ? "/" : normalizePath(path)}`;
}

function buildUrlsetXml(items: StaticSitemapItem[]) {
  const now = new Date().toISOString();

  const entries = items
    .map((item) => {
      return [
        "  <url>",
        `    <loc>${escapeXml(absoluteUrl(item.path))}</loc>`,
        `    <lastmod>${now}</lastmod>`,
        `    <changefreq>${escapeXml(item.changeFrequency)}</changefreq>`,
        `    <priority>${Number(item.priority).toFixed(2)}</priority>`,
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
  const uniqueItems = Array.from(
    new Map(
      STATIC_URLS.map((item) => [normalizePath(item.path), item])
    ).values()
  );

  const xml = buildUrlsetXml(uniqueItems);

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}