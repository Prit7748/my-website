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

function buildBucketHostname() {
  const bucket = safeStr(publicBucket);
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

const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
  {
    protocol: "https",
    hostname: "istudentsportal.com",
    pathname: "/**",
  },
  {
    protocol: "https",
    hostname: "www.istudentsportal.com",
    pathname: "/**",
  },
  {
    protocol: "https",
    hostname: "res.cloudinary.com",
    pathname: "/**",
  },
];

if (publicBaseHostname) {
  remotePatterns.push({
    protocol: "https",
    hostname: publicBaseHostname,
    pathname: "/**",
  });
}

if (
  publicBucketHostname &&
  publicBucketHostname !== publicBaseHostname
) {
  remotePatterns.push({
    protocol: "https",
    hostname: publicBucketHostname,
    pathname: "/**",
  });
}

const nextConfig: NextConfig = {
  images: {
    unoptimized: false,
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