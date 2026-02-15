// app/api/admin/upload/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import path from "path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getAuthUser, hasPermission } from "@/lib/auth";

export const runtime = "nodejs";

const REGION = process.env.AWS_REGION || "ap-south-1";
const BUCKET_PRIVATE = process.env.AWS_S3_BUCKET_PRIVATE || "";
const BUCKET_IMAGES = process.env.AWS_S3_BUCKET_IMAGES || "";

const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID || "";
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY || "";

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

function safeExt(name: string) {
  const ext = (path.extname(name || "") || "").toLowerCase();
  return ext.replace(/[^a-z0-9.]/g, "");
}

function safeBase(name: string) {
  const base = path.basename(name || "", path.extname(name || ""));
  return (
    base
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) || "file"
  );
}

function publicS3Url(bucket: string, region: string, key: string) {
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(key).replace(/%2F/g, "/")}`;
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden (products:write missing)" }, { status: 403 });
  }

  // ✅ Hard fail if creds missing (common mistake)
  if (!ACCESS_KEY || !SECRET_KEY) {
    return NextResponse.json(
      { error: "AWS credentials missing (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)" },
      { status: 500 }
    );
  }

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const kind = String(form.get("kind") || "image"); // "pdf" | "image"

    if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

    const isPdf = kind === "pdf";
    const ext = safeExt(file.name) || (isPdf ? ".pdf" : ".jpg");

    if (isPdf && ext !== ".pdf") {
      return NextResponse.json({ error: "Only .pdf allowed for PDF upload" }, { status: 400 });
    }
    if (!isPdf && ![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
      return NextResponse.json({ error: "Only jpg/jpeg/png/webp allowed for images" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const id = crypto.randomBytes(10).toString("hex");
    const outName = `${safeBase(file.name)}-${id}${ext}`;

    // ✅ PDF => Private bucket
    if (isPdf) {
      if (!BUCKET_PRIVATE) {
        return NextResponse.json({ error: "AWS_S3_BUCKET_PRIVATE missing" }, { status: 500 });
      }

      const key = `uploads/pdfs/${outName}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET_PRIVATE,
          Key: key,
          Body: bytes,
          ContentType: file.type || "application/pdf",
        })
      );

      return NextResponse.json({ ok: true, kind: "pdf", key }, { status: 200 });
    }

    // ✅ Images => Images bucket
    if (!BUCKET_IMAGES) {
      return NextResponse.json({ error: "AWS_S3_BUCKET_IMAGES missing" }, { status: 500 });
    }

    const key = `uploads/images/${outName}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_IMAGES,
        Key: key,
        Body: bytes,
        ContentType: file.type || "image/*",
      })
    );

    const url = publicS3Url(BUCKET_IMAGES, REGION, key);

    return NextResponse.json({ ok: true, kind: "image", url, key }, { status: 200 });
  } catch (e: any) {
    console.error("UPLOAD_ERROR:", e);
    return NextResponse.json(
      {
        error: "Upload failed",
        details: e?.message || String(e),
        name: e?.name || "",
        code: e?.code || "",
        httpStatus: e?.$metadata?.httpStatusCode || "",
      },
      { status: 500 }
    );
  }
}
