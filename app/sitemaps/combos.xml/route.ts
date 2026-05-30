import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Combo from "@/models/Combo";

export const runtime = "nodejs";
export const revalidate = 21600;

const BASE_URL = "https://istudentsportal.com";
const MAX_COMBO_URLS = 20000;

const INDEXABLE_COMBO_CATEGORIES = new Set([
  "solved-assignments",
  "question-papers",
  "guess-papers",
  "ebooks-notes",
  "handwritten-pdfs",
  "handwritten-hardcopy",
]);

type ComboSitemapDoc = {
  slug?: string;
  categorySlug?: string;
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
    .toLowerCase()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  if (!slug) return "";
  if (slug.includes("?") || slug.includes("#")) return "";
  if (slug === "undefined" || slug === "null") return "";

  return slug;
}

function cleanCategory(value: unknown) {
  const category = cleanSlug(value);

  if (!INDEXABLE_COMBO_CATEGORIES.has(category)) return "";

  return category;
}

function toDate(value: unknown) {
  if (!value) return null;

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function lastModifiedOf(combo: ComboSitemapDoc) {
  return toDate(combo.updatedAt) || toDate(combo.createdAt) || new Date();
}

function comboFilter() {
  return {
    isActive: true,
    status: "active",
    categorySlug: { $in: Array.from(INDEXABLE_COMBO_CATEGORIES) },
    slug: { $exists: true, $ne: "" },
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  };
}

function buildComboUrl(category: string, slug: string) {
  return `${BASE_URL}/combo/${category}/${slug}`;
}

function buildUrlsetXml(combos: ComboSitemapDoc[]) {
  const uniqueCombos = new Map<string, ComboSitemapDoc>();

  for (const combo of combos) {
    const category = cleanCategory(combo.categorySlug);
    const slug = cleanSlug(combo.slug);

    if (!category || !slug) continue;

    const key = `${category}/${slug}`;
    const existing = uniqueCombos.get(key);

    if (!existing) {
      uniqueCombos.set(key, combo);
      continue;
    }

    const existingDate = lastModifiedOf(existing);
    const nextDate = lastModifiedOf(combo);

    if (nextDate.getTime() > existingDate.getTime()) {
      uniqueCombos.set(key, combo);
    }
  }

  const entries = Array.from(uniqueCombos.values())
    .map((combo) => {
      const category = cleanCategory(combo.categorySlug);
      const slug = cleanSlug(combo.slug);
      const lastModified = lastModifiedOf(combo).toISOString();

      return [
        "  <url>",
        `    <loc>${escapeXml(buildComboUrl(category, slug))}</loc>`,
        `    <lastmod>${escapeXml(lastModified)}</lastmod>`,
        "    <changefreq>weekly</changefreq>",
        "    <priority>0.76</priority>",
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

  const combos: ComboSitemapDoc[] = await Combo.find(comboFilter())
    .select("slug categorySlug updatedAt createdAt")
    .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
    .limit(MAX_COMBO_URLS)
    .lean();

  const xml = buildUrlsetXml(combos || []);

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
      "X-Robots-Tag": "noindex, follow",
    },
  });
}