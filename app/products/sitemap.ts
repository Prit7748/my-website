import type { MetadataRoute } from "next";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import { productHref } from "@/lib/productHref";

export const runtime = "nodejs";
export const revalidate = 21600;

const BASE_URL = "https://istudentsportal.com";
const URLS_PER_SITEMAP = 2500;

const INDEXABLE_PRODUCT_PREFIXES = new Set([
  "solved-assignments",
  "handwritten-pdfs",
  "handwritten-hardcopy",
  "question-papers",
  "guess-papers",
  "ebooks",
  "projects",
  "combo",
]);

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function absUrl(path: string) {
  const clean = safeStr(path);

  if (!clean) return BASE_URL;

  if (/^https?:\/\//i.test(clean)) {
    try {
      const url = new URL(clean);

      if (
        url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "www.istudentsportal.com" ||
        url.hostname === "istudentsportal.com"
      ) {
        return `${BASE_URL}${url.pathname}${url.search}${url.hash}`;
      }

      return clean;
    } catch {
      return BASE_URL;
    }
  }

  return `${BASE_URL}${clean.startsWith("/") ? clean : `/${clean}`}`;
}

function toDate(value: unknown) {
  const date = value ? new Date(String(value)) : null;
  return date && !Number.isNaN(date.getTime()) ? date : undefined;
}

function cleanPath(path: string) {
  const raw = safeStr(path).split("?")[0].split("#")[0];

  if (!raw) return "";
  if (!raw.startsWith("/")) return "";
  if (raw === "/") return "/";

  return raw.replace(/\/+$/, "");
}

function firstPathSegment(path: string) {
  return cleanPath(path).split("/").filter(Boolean)[0] || "";
}

function isIndexableProductPath(path: string) {
  const clean = cleanPath(path);
  if (!clean) return false;

  const prefix = firstPathSegment(clean);
  if (!INDEXABLE_PRODUCT_PREFIXES.has(prefix)) return false;

  const parts = clean.split("/").filter(Boolean);
  return parts.length === 2 && Boolean(parts[1]);
}

function getProductCanonicalPath(product: any) {
  const slug = safeStr(product?.slug);
  const category = safeStr(product?.category);

  if (!slug || !category) return "";

  const href = cleanPath(productHref({ slug, category }));

  if (!href) return "";

  // Legacy/fallback route must never enter product sitemap.
  if (href === "/products" || href.startsWith("/products/")) return "";

  if (!isIndexableProductPath(href)) return "";

  return href;
}

function productPriority(path: string) {
  const prefix = firstPathSegment(path);

  if (prefix === "solved-assignments") return 0.82;
  if (prefix === "question-papers") return 0.8;
  if (prefix === "handwritten-hardcopy") return 0.78;
  if (prefix === "guess-papers") return 0.76;
  if (prefix === "handwritten-pdfs") return 0.74;
  if (prefix === "ebooks") return 0.72;
  if (prefix === "projects") return 0.72;
  if (prefix === "combo") return 0.7;

  return 0.7;
}

function productFilter() {
  return {
    isActive: true,
    slug: { $exists: true, $ne: "" },
    category: { $exists: true, $ne: "" },
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  };
}

function mergeUniqueUrls(items: MetadataRoute.Sitemap) {
  const map = new Map<string, MetadataRoute.Sitemap[number]>();

  for (const item of items) {
    const url = safeStr(item.url);
    if (!url) continue;

    const existing = map.get(url);

    if (!existing) {
      map.set(url, item);
      continue;
    }

    const existingDate = toDate(existing.lastModified);
    const nextDate = toDate(item.lastModified);

    map.set(url, {
      ...existing,
      ...item,
      lastModified:
        nextDate && (!existingDate || nextDate.getTime() > existingDate.getTime())
          ? nextDate
          : existing.lastModified,
      priority: Math.max(Number(existing.priority || 0), Number(item.priority || 0)),
    });
  }

  return Array.from(map.values());
}

export async function generateSitemaps() {
  await dbConnect();

  const total = await Product.countDocuments(productFilter());
  const sitemapCount = Math.max(1, Math.ceil(total / URLS_PER_SITEMAP));

  return Array.from({ length: sitemapCount }, (_, id) => ({ id }));
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const rawId = await props.id;
  const sitemapIndex = Math.max(0, Number.parseInt(String(rawId), 10) || 0);

  await dbConnect();

  const products = await Product.find(productFilter())
    .select("slug category updatedAt createdAt")
    .sort({ _id: 1 })
    .skip(sitemapIndex * URLS_PER_SITEMAP)
    .limit(URLS_PER_SITEMAP)
    .lean();

  const urls: MetadataRoute.Sitemap = (products || [])
    .map((product: any) => {
      const href = getProductCanonicalPath(product);
      if (!href) return null;

      return {
        url: absUrl(href),
        lastModified: toDate(product?.updatedAt || product?.createdAt),
        changeFrequency: "weekly" as const,
        priority: productPriority(href),
      };
    })
    .filter(Boolean) as MetadataRoute.Sitemap;

  return mergeUniqueUrls(urls);
}