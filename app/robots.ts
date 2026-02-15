// app/robots.ts
export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/admin"],
      },
    ],
    sitemap: "https://www.ignoustudentsportal.com/sitemap.xml",
  };
}
