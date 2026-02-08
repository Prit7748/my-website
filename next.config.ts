import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ IMPORTANT: remove static export for API routes + MongoDB
  // output: "export",

  images: {
    // ✅ If you truly need static image export behavior you can keep unoptimized,
    // but for Vercel it's better to allow optimization.
    // If you face image issues later, we can toggle this.
    unoptimized: false,
    formats: ["image/avif", "image/webp"],
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
