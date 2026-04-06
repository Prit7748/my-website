import type { MetadataRoute } from "next";

import dbConnect from "@/lib/db";
import Blog from "@/models/Blog";
import Product from "@/models/Product";
import ComboCategorySetting from "@/models/ComboCategorySetting";

function safeStr(x: unknown) {
  return String(x ?? "").trim();
}

function normalizeBaseUrl(input?: string) {
  const raw = safeStr(input) || "https://istudentsportal.com";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, "");
}

function toDate(value: unknown, fallback?: Date) {
  const d = value ? new Date(value as any) : fallback;
  return d && !Number.isNaN(d.getTime()) ? d : new Date();
}

function categorySlugFromProductCategory(category?: string) {
  const c = safeStr(category).toLowerCase();

  if (c === "solved assignments") return "solved-assignments";
  if (c === "handwritten pdfs") return "handwritten-pdfs";
  if (c.includes("handwritten") && (c.includes("hardcopy") || c.includes("delivery"))) {
    return "handwritten-hardcopy";
  }
  if (c.includes("question") && (c.includes("paper") || c.includes("pyq"))) return "question-papers";
  if (c.includes("guess")) return "guess-papers";
  if (c.includes("ebook") || c.includes("notes")) return "ebooks";
  if (c.includes("project") || c.includes("synopsis")) return "projects";
  if (c.includes("combo")) return "combo";

  return "products";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = normalizeBaseUrl(
    process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://istudentsportal.com"
  );

  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/products`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${baseUrl}/solved-assignments`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${baseUrl}/question-papers`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/guess-papers`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/ebooks`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/projects`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/handwritten-pdfs`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/handwritten-hardcopy`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/combo`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/courses`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/offers`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${baseUrl}/refund-policy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];

  try {
    await dbConnect();

    const [blogs, products, comboCategories] = await Promise.all([
      Blog.find({
        isPublished: true,
        slug: { $exists: true, $ne: "" },
      })
        .select("slug updatedAt publishedAt")
        .lean(),

      Product.find({
        isActive: true,
        slug: { $exists: true, $ne: "" },
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      })
        .select("slug updatedAt category")
        .sort({ updatedAt: -1, _id: -1 })
        .lean(),

      ComboCategorySetting.find({
        isActive: true,
        comboEnabled: true,
        categorySlug: { $exists: true, $ne: "" },
      })
        .select("categorySlug updatedAt")
        .lean(),
    ]);

    const blogUrls: MetadataRoute.Sitemap = (Array.isArray(blogs) ? blogs : [])
      .map((b: any) => {
        const slug = safeStr(b?.slug);
        if (!slug) return null;

        return {
          url: `${baseUrl}/blog/${encodeURIComponent(slug)}`,
          lastModified: toDate(b?.updatedAt || b?.publishedAt, now),
          changeFrequency: "weekly" as const,
          priority: 0.75,
        };
      })
      .filter(Boolean) as MetadataRoute.Sitemap;

    const productUrls: MetadataRoute.Sitemap = (Array.isArray(products) ? products : [])
      .map((p: any) => {
        const slug = safeStr(p?.slug);
        if (!slug) return null;

        const categorySlug = categorySlugFromProductCategory(p?.category);

        return {
          url: `${baseUrl}/${categorySlug}/${encodeURIComponent(slug)}`,
          lastModified: toDate(p?.updatedAt, now),
          changeFrequency: "weekly" as const,
          priority: 0.85,
        };
      })
      .filter(Boolean) as MetadataRoute.Sitemap;

    const comboUrls: MetadataRoute.Sitemap = (Array.isArray(comboCategories) ? comboCategories : [])
      .map((row: any) => {
        const slug = safeStr(row?.categorySlug);
        if (!slug) return null;

        return {
          url: `${baseUrl}/combo/${encodeURIComponent(slug)}`,
          lastModified: toDate(row?.updatedAt, now),
          changeFrequency: "weekly" as const,
          priority: 0.7,
        };
      })
      .filter(Boolean) as MetadataRoute.Sitemap;

    const deduped = new Map<string, MetadataRoute.Sitemap[number]>();

    for (const item of [...staticRoutes, ...comboUrls, ...blogUrls, ...productUrls]) {
      if (!item?.url) continue;
      deduped.set(item.url, item);
    }

    return Array.from(deduped.values());
  } catch {
    return staticRoutes;
  }
}