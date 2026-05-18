import type { MetadataRoute } from "next";
import dbConnect from "@/lib/db";
import Blog from "@/models/Blog";
import Product from "@/models/Product";
import { productHref } from "@/lib/productHref";

const BASE_URL = "https://istudentsportal.com";

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
  if (/^https?:\/\//i.test(clean)) return clean;

  return `${BASE_URL}${clean.startsWith("/") ? clean : `/${clean}`}`;
}

function toDate(value: unknown) {
  const date = value ? new Date(String(value)) : null;
  return date && !Number.isNaN(date.getTime()) ? date : undefined;
}

function latestDate(values: unknown[]) {
  let best: Date | undefined;

  for (const value of values) {
    const date = toDate(value);
    if (!date) continue;

    if (!best || date.getTime() > best.getTime()) {
      best = date;
    }
  }

  return best;
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

  // Old fallback/redirect route must never be in sitemap.
  if (href === "/products" || href.startsWith("/products/")) return "";

  if (!isIndexableProductPath(href)) return "";

  return href;
}

function productPriority(path: string) {
  const prefix = firstPathSegment(path);

  if (prefix === "solved-assignments") return 0.8;
  if (prefix === "question-papers") return 0.78;
  if (prefix === "handwritten-hardcopy") return 0.78;
  if (prefix === "guess-papers") return 0.76;
  if (prefix === "handwritten-pdfs") return 0.74;
  if (prefix === "ebooks") return 0.72;
  if (prefix === "projects") return 0.72;
  if (prefix === "combo") return 0.7;

  return 0.7;
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await dbConnect();

  const now = new Date();

  const [blogs, products] = await Promise.all([
    Blog.find({
      isPublished: true,
      slug: { $exists: true, $ne: "" },
      $or: [{ publishedAt: null }, { publishedAt: { $lte: now } }],
    })
      .select("slug publishedAt updatedAt createdAt")
      .sort({ publishedAt: -1, updatedAt: -1, _id: -1 })
      .lean(),

    Product.find({
      isActive: true,
      slug: { $exists: true, $ne: "" },
      category: { $exists: true, $ne: "" },
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    })
      .select("slug category updatedAt createdAt")
      .sort({ updatedAt: -1, _id: -1 })
      .lean(),
  ]);

  const latestBlogDate = latestDate(
    (blogs || []).flatMap((blog: any) => [
      blog?.updatedAt,
      blog?.publishedAt,
      blog?.createdAt,
    ])
  );

  const latestProductDate = latestDate(
    (products || []).flatMap((product: any) => [
      product?.updatedAt,
      product?.createdAt,
    ])
  );

  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: absUrl("/"),
      lastModified: latestDate([latestProductDate, latestBlogDate]),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: absUrl("/products"),
      lastModified: latestProductDate,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: absUrl("/solved-assignments"),
      lastModified: latestProductDate,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: absUrl("/handwritten-hardcopy"),
      lastModified: latestProductDate,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absUrl("/handwritten-pdfs"),
      lastModified: latestProductDate,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absUrl("/question-papers"),
      lastModified: latestProductDate,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absUrl("/guess-papers"),
      lastModified: latestProductDate,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absUrl("/ebooks"),
      lastModified: latestProductDate,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: absUrl("/projects"),
      lastModified: latestProductDate,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: absUrl("/combo"),
      lastModified: latestProductDate,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: absUrl("/courses"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...(blogs.length
      ? [
          {
            url: absUrl("/blog"),
            lastModified: latestBlogDate,
            changeFrequency: "daily" as const,
            priority: 0.8,
          },
        ]
      : []),
    {
      url: absUrl("/about"),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: absUrl("/contact"),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: absUrl("/faq"),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: absUrl("/privacy"),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: absUrl("/terms"),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: absUrl("/refund-policy"),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  const productUrls: MetadataRoute.Sitemap = (products || [])
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

  const blogUrls: MetadataRoute.Sitemap = (blogs || [])
    .map((blog: any) => {
      const slug = safeStr(blog?.slug);
      if (!slug) return null;

      return {
        url: absUrl(`/blog/${slug}`),
        lastModified: toDate(blog?.updatedAt || blog?.publishedAt || blog?.createdAt),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      };
    })
    .filter(Boolean) as MetadataRoute.Sitemap;

  return mergeUniqueUrls([...staticUrls, ...productUrls, ...blogUrls]);
}