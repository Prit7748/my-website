// ✅ FILE: next.config.ts  (COMPLETE REPLACE)
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ IMPORTANT: remove static export for API routes + MongoDB
  // output: "export",

  images: {
    unoptimized: false,
    formats: ["image/avif", "image/webp"],

    // ✅ REQUIRED for /api/thumb/... (SVG)
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",

    // ✅ Allow BOTH:
    // 1) normal public images like /logo.png, /images/cover1.jpg, etc.
    // 2) dynamic api thumbs like /api/thumb/assignment?... (querystring)
    localPatterns: [
      { pathname: "/**" },
      { pathname: "/api/thumb/**", search: "**" },
    ],

    remotePatterns: [
      { protocol: "https", hostname: "istudentsportal.com" },
      { protocol: "https", hostname: "ignoustudentsportal.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "*.amazonaws.com" },
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
    ],
  },
};

export default nextConfig;
