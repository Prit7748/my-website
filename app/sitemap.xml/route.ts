import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";

export const runtime = "nodejs";
export const revalidate = 21600;

const BASE_URL = "https://istudentsportal.com";
const URLS_PER_PRODUCT_SITEMAP = 2500;

const INDEXABLE_CATEGORY_VALUES = [
  "Solved Assignments",
  "solved-assignments",

  "Handwritten PDFs",
  "handwritten-pdfs",

  "Handwritten Hardcopy (Delivery)",
  "Handwritten Hardcopy",
  "handwritten-hardcopy",

  "Question Papers (PYQ)",
  "Question Papers",
  "question-papers",

  "Guess Papers",
  "guess-papers",

  "eBooks/Notes",
  "Ebooks/Notes",
  "eBooks",
  "Ebooks",
  "ebooks",

  "Projects & Synopsis",
  "Projects",
  "projects",
];

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function productFilter() {
  return {
    isActive: true,
    slug: { $exists: true, $ne: "" },
    category: { $in: INDEXABLE_CATEGORY_VALUES },
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  };
}

function buildSitemapIndexXml(sitemapUrls: string[]) {
  const now = new Date().toISOString();

  const uniqueUrls = Array.from(
    new Set(
      sitemapUrls
        .map((url) => String(url || "").trim())
        .filter(Boolean)
    )
  );

  const entries = uniqueUrls
    .map((url) => {
      return [
        "  <sitemap>",
        `    <loc>${escapeXml(url)}</loc>`,
        `    <lastmod>${now}</lastmod>`,
        "  </sitemap>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    "</sitemapindex>",
  ].join("\n");
}

export async function GET() {
  await dbConnect();

  const totalProducts = await Product.countDocuments(productFilter());

  const productSitemapCount = Math.max(
    1,
    Math.ceil(totalProducts / URLS_PER_PRODUCT_SITEMAP)
  );

  const coreSitemaps = [
    `${BASE_URL}/sitemaps/static.xml`,
    `${BASE_URL}/sitemaps/blogs.xml`,
    `${BASE_URL}/sitemaps/combos.xml`,
  ];

  const productSitemaps = Array.from(
    { length: productSitemapCount },
    (_, index) => `${BASE_URL}/products/sitemap/${index}.xml`
  );

  const sitemapUrls = [...coreSitemaps, ...productSitemaps];

  const xml = buildSitemapIndexXml(sitemapUrls);

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
      "X-Robots-Tag": "noindex, follow",
    },
  });
}