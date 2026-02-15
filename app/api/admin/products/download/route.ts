// app/api/products/download/route.ts
import { NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";

const REGION = process.env.AWS_REGION || "ap-south-1";
const BUCKET_PRIVATE = process.env.AWS_S3_BUCKET_PRIVATE || "";

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!BUCKET_PRIVATE) {
    return NextResponse.json({ error: "Private bucket missing in env" }, { status: 500 });
  }

  const url = new URL(req.url);
  const key = String(url.searchParams.get("key") || "").trim();
  if (!key || !key.startsWith("uploads/pdfs/")) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  // 60 seconds signed URL
  const signed = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: BUCKET_PRIVATE,
      Key: key,
      ResponseContentDisposition: "inline",
    }),
    { expiresIn: 60 }
  );

  return NextResponse.json({ ok: true, url: signed, expiresIn: 60 }, { status: 200 });
}
