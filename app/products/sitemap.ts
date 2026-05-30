import type { MetadataRoute } from "next";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import { productHref, slugifyCategory } from "@/lib/productHref";

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
]);

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

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function resolveMaybe<T>(value: T | Promise<T>): Promise<T> {
  return Promise.resolve(value);
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

function absUrl(path: string) {
  const clean = cleanPath(path);

  if (!clean || clean === "/") return `${BASE_URL}/`;

  return `${BASE_URL}${clean}`;
}

function isValidProductSlug(slug: string) {
  const clean = safeStr(slug);

  if (!clean) return false;
  if (clean.toLowerCase() === "undefined") return false;
  if (clean.toLowerCase() === "null") return false;
  if (clean.includes("?") || clean.includes("#")) return false;
  if (clean.startsWith("/") || clean.endsWith("/")) return false;

  return true;
}

function isIndexableProductPath(path: string) {
  const clean = cleanPath(path);
  if (!clean) return false;

  const parts = clean.split("/").filter(Boolean);
  if (parts.length !== 2) return false;

  const prefix = parts[0];
  const slug = parts[1];

  if (!INDEXABLE_PRODUCT_PREFIXES.has(prefix)) return false;
  if (!isValidProductSlug(slug)) return false;

  return true;
}

function getProductCanonicalPath(product: any) {
  const slug = safeStr(product?.slug);
  const category = safeStr(product?.category);

  if (!isValidProductSlug(slug)) return "";
  if (!category) return "";

  const categorySlug = slugifyCategory(category);

  if (!INDEXABLE_PRODUCT_PREFIXES.has(categorySlug)) return "";

  const href = cleanPath(productHref({ slug, category }));

  if (!href) return "";

  if (href === "/products" || href.startsWith("/products/")) return "";
  if (href === "/combo" || href.startsWith("/combo/")) return "";

  if (!isIndexableProductPath(href)) return "";

  const hrefPrefix = firstPathSegment(href);

  if (hrefPrefix !== categorySlug) return "";

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

  return 0.7;
}

function productFilter() {
  return {
    isActive: true,
    slug: { $exists: true, $ne: "" },
    category: { $in: INDEXABLE_CATEGORY_VALUES },
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
  id: Promise<string | number> | string | number;
}): Promise<MetadataRoute.Sitemap> {
  const rawId = await resolveMaybe(props.id);
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