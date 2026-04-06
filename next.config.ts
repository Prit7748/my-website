import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: false,
    formats: ["image/avif", "image/webp"],

    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",

    localPatterns: [
      { pathname: "/**" },
      { pathname: "/api/thumb/**" },
    ],

    remotePatterns: [
      { protocol: "https", hostname: "istudentsportal.com" },
      { protocol: "https", hostname: "www.istudentsportal.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
    ],
  },
};

export default nextConfig;