import type { NextConfig } from "next";

const publicBaseUrl =
  process.env.AWS_PUBLIC_BASE_URL ||
  process.env.AWS_S3_PUBLIC_BASE_URL ||
  "";

const publicBucket =
  process.env.AWS_S3_BUCKET_IMAGES ||
  process.env.AWS_S3_BUCKET_PUBLIC ||
  "";

const awsRegion = process.env.AWS_REGION || "ap-south-1";

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function buildBucketHostname(bucketName?: string) {
  const bucket = safeStr(bucketName || publicBucket);
  if (!bucket) return "";
  return `${bucket}.s3.${awsRegion}.amazonaws.com`;
}

function hostFromUrl(input: string) {
  const raw = safeStr(input);
  if (!raw) return "";

  try {
    return new URL(raw).hostname;
  } catch {
    return "";
  }
}

const publicBaseHostname = hostFromUrl(publicBaseUrl);
const publicBucketHostname = buildBucketHostname();

const staticAllowedImageHostnames = [
  "istudentsportal.com",
  "www.istudentsportal.com",
  "res.cloudinary.com",

  // Current live product image bucket
  "istudentsportal-images.s3.ap-south-1.amazonaws.com",

  publicBaseHostname,
  publicBucketHostname,
].filter(Boolean);

const uniqueHostnames = Array.from(new Set(staticAllowedImageHostnames));

const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] =
  uniqueHostnames.map((hostname) => ({
    protocol: "https",
    hostname,
    pathname: "/**",
  }));

remotePatterns.push({
  protocol: "https",
  hostname: "*.s3.ap-south-1.amazonaws.com",
  pathname: "/**",
});

const nextConfig: NextConfig = {
  images: {
    /*
      IMPORTANT LIVE FIX:
      Browser console me images /_next/image?... se load ho rahi thi
      aur Vercel live deployment par 402 Payment Required aa raha tha.
      Iska matlab Next/Vercel Image Optimization quota/billing block ho raha hai.

      unoptimized: true karne se product images direct S3 URL se load hongi,
      /_next/image optimizer use nahi hoga, aur 402 issue solve hoga.
    */
    unoptimized: true,

    formats: ["image/avif", "image/webp"],

    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",

    localPatterns: [
      {
        pathname: "/**",
      },
      {
        pathname: "/api/thumb/**",
      },
    ],

    remotePatterns,
  },
};

export default nextConfig;