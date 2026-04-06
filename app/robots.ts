import type { MetadataRoute } from "next";

const BASE_URL = "https://istudentsportal.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/products",
          "/solved-assignments",
          "/handwritten-hardcopy",
          "/handwritten-pdfs",
          "/question-papers",
          "/guess-papers",
          "/ebooks",
          "/projects",
          "/combo",
          "/courses",
          "/blog",
          "/about",
          "/contact",
          "/faq",
          "/privacy",
          "/terms",
          "/refund-policy",
          "/api/thumb/",
        ],
        disallow: [
          "/admin",
          "/dashboard",
          "/orders",
          "/wallet",
          "/checkout",
          "/cart",
          "/login",
          "/order-success",
          "/api/admin",
          "/api/auth",
          "/api/orders",
          "/api/payments",
          "/api/wallet",
          "/api/upload",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}