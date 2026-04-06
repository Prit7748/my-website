import type { MetadataRoute } from "next";

function safeStr(x: unknown) {
  return String(x ?? "").trim();
}

function normalizeBaseUrl(input?: string) {
  const raw = safeStr(input) || "https://istudentsportal.com";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, "");
}

export default function robots(): MetadataRoute.Robots {
  const baseUrl = normalizeBaseUrl(
    process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://istudentsportal.com"
  );

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/admin"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}