import type { MetadataRoute } from "next";
import dbConnect from "@/lib/db";
import Blog from "@/models/Blog";
import Product from "@/models/Product";
import { productHref } from "@/lib/productHref";

const BASE_URL = "https://istudentsportal.com";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function absUrl(path: string) {
  const clean = safeStr(path);
  if (!clean) return BASE_URL;
  if (/^https?:\/\//i.test(clean)) return clean;
  return `${BASE_URL}${clean.startsWith("/") ? clean : `/${clean}`}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await dbConnect();

  const [blogs, products] = await Promise.all([
    Blog.find({ isPublished: true, slug: { $exists: true, $ne: "" } })
      .select("slug updatedAt")
      .sort({ updatedAt: -1, _id: -1 })
      .lean(),

    Product.find({
      isActive: true,
      slug: { $exists: true, $ne: "" },
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    })
      .select("slug category updatedAt")
      .sort({ updatedAt: -1, _id: -1 })
      .lean(),
  ]);

  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: absUrl("/"),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: absUrl("/products"),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: absUrl("/solved-assignments"),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: absUrl("/handwritten-hardcopy"),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absUrl("/handwritten-pdfs"),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absUrl("/question-papers"),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absUrl("/guess-papers"),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absUrl("/ebooks"),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: absUrl("/projects"),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: absUrl("/combo"),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: absUrl("/courses"),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: absUrl("/blog"),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: absUrl("/about"),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: absUrl("/contact"),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: absUrl("/faq"),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: absUrl("/privacy"),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: absUrl("/terms"),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: absUrl("/refund-policy"),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  const productUrls: MetadataRoute.Sitemap = (products || [])
    .map((p: any) => {
      const slug = safeStr(p?.slug);
      const category = safeStr(p?.category);
      if (!slug) return null;

      const href = productHref({ slug, category });
      if (!href || href === "/products") return null;

      return {
        url: absUrl(href),
        lastModified: p?.updatedAt ? new Date(p.updatedAt) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      };
    })
    .filter(Boolean) as MetadataRoute.Sitemap;

  const blogUrls: MetadataRoute.Sitemap = (blogs || [])
    .map((b: any) => {
      const slug = safeStr(b?.slug);
      if (!slug) return null;

      return {
        url: absUrl(`/blog/${slug}`),
        lastModified: b?.updatedAt ? new Date(b.updatedAt) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      };
    })
    .filter(Boolean) as MetadataRoute.Sitemap;

  return [...staticUrls, ...productUrls, ...blogUrls];
}