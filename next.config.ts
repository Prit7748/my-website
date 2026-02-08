import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",   // 👈 static export enable

  images: {
    unoptimized: true,   // 👈 IMPORTANT for S3
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "ignoustudentsportal.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

export default nextConfig;
