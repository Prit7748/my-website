import dbConnect from "@/lib/db";
import Blog from "@/models/Blog";

export default async function sitemap() {
  const baseUrl = "https://www.ignoustudentsportal.com"; 
  // ⚠️ production domain, localhost nahi

  await dbConnect();

  const blogs = await Blog.find({ isPublished: true })
    .select("slug updatedAt")
    .lean();

  const blogUrls =
    blogs?.map((b: any) => ({
      url: `${baseUrl}/blog/${b.slug}`,
      lastModified: b.updatedAt || new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    })) || [];

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...blogUrls,
  ];
}