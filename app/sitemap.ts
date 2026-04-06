import type { MetadataRoute } from "next";
import dbConnect from "@/lib/db";
import Blog from "@/models/Blog";
import Product from "@/models/Product";
import { productHref } from "@/lib/productHref";

const BASE_URL = "https://istudentsportal.com";

function toAbsolute(path: string) {
  const cleanPath = String(path || "").trim();
  if (!cleanPath) return BASE_URL;
  return `${BASE_URL}${cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: toAbsolute("/"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: toAbsolute("/products"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: toAbsolute("/solved-assignments"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: toAbsolute("/handwritten-hardcopy"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: toAbsolute("/handwritten-pdfs"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: toAbsolute("/question-papers"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: toAbsolute("/guess-papers"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: toAbsolute("/ebooks"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: toAbsolute("/projects"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: toAbsolute("/combo"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: toAbsolute("/courses"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: toAbsolute("/blog"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: toAbsolute("/about"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: toAbsolute("/contact"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: toAbsolute("/faq"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.55,
    },
    {
      url: toAbsolute("/offers"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.65,
    },
    {
      url: toAbsolute("/handwriting-samples"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.45,
    },
    {
      url: toAbsolute("/privacy"),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: toAbsolute("/terms"),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: toAbsolute("/refund-policy"),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  try {
    await dbConnect();

    const [blogs, products] = await Promise.all([
      Blog.find({
        isPublished: true,
        slug: { $exists: true, $ne: "" },
      })
        .select("slug updatedAt createdAt")
        .lean(),
      Product.find({
        isActive: true,
        slug: { $exists: true, $ne: "" },
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      })
        .select("slug category updatedAt createdAt")
        .lean(),
    ]);

    const blogUrls: MetadataRoute.Sitemap = (blogs || [])
      .map((b: any) => {
        const slug = String(b?.slug || "").trim();
        if (!slug) return null;

        return {
          url: toAbsolute(`/blog/${encodeURIComponent(slug)}`),
          lastModified: b?.updatedAt || b?.createdAt || now,
          changeFrequency: "weekly" as const,
          priority: 0.75,
        };
      })
      .filter(Boolean) as MetadataRoute.Sitemap;

    const productUrlsRaw: MetadataRoute.Sitemap = (products || [])
      .map((p: any) => {
        const slug = String(p?.slug || "").trim();
        if (!slug) return null;

        const href = productHref({
          slug,
          category: String(p?.category || "").trim(),
        });

        return {
          url: toAbsolute(href),
          lastModified: p?.updatedAt || p?.createdAt || now,
          changeFrequency: "daily" as const,
          priority: 0.85,
        };
      })
      .filter(Boolean) as MetadataRoute.Sitemap;

    const seen = new Set<string>();
    const productUrls = productUrlsRaw.filter((item) => {
      if (!item?.url) return false;
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });

    return [...staticRoutes, ...blogUrls, ...productUrls];
  } catch {
    return staticRoutes;
  }
}