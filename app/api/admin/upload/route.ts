import { NextResponse } from "next/server";
import crypto from "crypto";
import path from "path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getAuthUser, hasPermission } from "@/lib/auth";

export const runtime = "nodejs";

const REGION = process.env.AWS_REGION || "ap-south-1";
const BUCKET_PRIVATE = process.env.AWS_S3_BUCKET_PRIVATE || "";

const BUCKET_PUBLIC =
  process.env.AWS_S3_BUCKET_IMAGES ||
  process.env.AWS_S3_BUCKET_PUBLIC ||
  "";

const PUBLIC_BASE_URL =
  process.env.AWS_PUBLIC_BASE_URL ||
  process.env.AWS_S3_PUBLIC_BASE_URL ||
  "";

const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID || "";
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY || "";

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm"]);

const HERO_IMAGE_MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const HERO_VIDEO_MAX_BYTES = 30 * 1024 * 1024; // 30 MB
const BLOG_IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const PYQ_TEMPLATE_IMAGE_MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const DEFAULT_IMAGE_MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const DEFAULT_PDF_MAX_BYTES = 100 * 1024 * 1024; // 100 MB

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

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
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "file"
  );
}

function normalizePublicBaseUrl(input: string) {
  const raw = safeStr(input);
  return raw ? raw.replace(/\/+$/, "") : "";
}

function publicS3Url(bucket: string, region: string, key: string) {
  const base = normalizePublicBaseUrl(PUBLIC_BASE_URL);
  if (base) {
    return `${base}/${encodeURIComponent(key).replace(/%2F/g, "/")}`;
  }

  return `https://${bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(
    key
  ).replace(/%2F/g, "/")}`;
}

function normalizeDestination(input: string) {
  return safeStr(input).toLowerCase().replace(/\\/g, "/");
}

function isHeroSliderDestination(destination: string) {
  const d = normalizeDestination(destination);
  return (
    d === "hero-slider" ||
    d === "hero_slides" ||
    d === "hero-slides" ||
    d === "site-settings/hero-slider" ||
    d === "site-settings/hero-slides"
  );
}

function isBlogDestination(destination: string) {
  const d = normalizeDestination(destination);
  return (
    d === "blog" ||
    d === "blogs" ||
    d === "blog-cover" ||
    d === "blog-covers" ||
    d === "uploads/images/blogs"
  );
}

function isPyqThumbnailDestination(destination: string) {
  const d = normalizeDestination(destination);
  return (
    d === "pyq-thumbnail" ||
    d === "pyq_thumbnail" ||
    d === "pyq-thumbnail-template" ||
    d === "site-settings/pyq-thumbnail" ||
    d === "site-settings/pyq-thumbnail-template"
  );
}

function getImageContentType(ext: string, fallback: string) {
  if (fallback && fallback.startsWith("image/")) return fallback;
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".avif") return "image/avif";
  return "image/jpeg";
}

function getVideoContentType(ext: string, fallback: string) {
  if (fallback && fallback.startsWith("video/")) return fallback;
  if (ext === ".webm") return "video/webm";
  return "video/mp4";
}

function buildPublicKey(params: {
  outName: string;
  destination: string;
  folder: string;
  device: string;
  isVideo: boolean;
}) {
  const { outName, destination, folder, device, isVideo } = params;

  const destinationValue = normalizeDestination(destination);
  const folderValue = normalizeDestination(folder);

  const heroSliderMode =
    isHeroSliderDestination(destinationValue) ||
    isHeroSliderDestination(folderValue);

  const blogMode =
    isBlogDestination(destinationValue) || isBlogDestination(folderValue);

  const pyqThumbnailMode =
    isPyqThumbnailDestination(destinationValue) ||
    isPyqThumbnailDestination(folderValue);

  if (heroSliderMode) {
    const normalizedDevice = device === "mobile" ? "mobile" : "desktop";
    const mediaType = isVideo ? "videos" : "images";

    return {
      key: `uploads/site-settings/hero-slider/${normalizedDevice}/${mediaType}/${outName}`,
      destinationLabel: "hero-slider",
      heroSliderMode: true,
      blogMode: false,
      pyqThumbnailMode: false,
    };
  }

  if (blogMode) {
    return {
      key: `uploads/images/blogs/${outName}`,
      destinationLabel: "blogs",
      heroSliderMode: false,
      blogMode: true,
      pyqThumbnailMode: false,
    };
  }

  if (pyqThumbnailMode) {
    return {
      key: `uploads/site-settings/pyq-thumbnail/${outName}`,
      destinationLabel: "pyq-thumbnail",
      heroSliderMode: false,
      blogMode: false,
      pyqThumbnailMode: true,
    };
  }

  return {
    key: `uploads/images/${outName}`,
    destinationLabel: "default",
    heroSliderMode: false,
    blogMode: false,
    pyqThumbnailMode: false,
  };
}

export async function POST(req: Request) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!hasPermission(user, "products:write")) {
    return NextResponse.json(
      { error: "Forbidden (products:write missing)" },
      { status: 403 }
    );
  }

  if (!ACCESS_KEY || !SECRET_KEY) {
    return NextResponse.json(
      {
        error:
          "AWS credentials missing (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)",
      },
      { status: 500 }
    );
  }

  try {
    const form = await req.formData();

    const file = form.get("file") as File | null;
    const kind = safeStr(form.get("kind")).toLowerCase() || "image";
    const destination = safeStr(form.get("destination"));
    const folder = safeStr(form.get("folder"));
    const deviceRaw = safeStr(form.get("device")).toLowerCase();

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const ext = safeExt(file.name);
    const bytes = Buffer.from(await file.arrayBuffer());

    const isPdf = kind === "pdf";
    const isVideo = kind === "video";
    const isImage = !isPdf && !isVideo;

    if (!ext) {
      return NextResponse.json(
        { error: "File extension is missing" },
        { status: 400 }
      );
    }

    if (isPdf) {
      if (ext !== ".pdf") {
        return NextResponse.json(
          { error: "Only .pdf allowed for PDF upload" },
          { status: 400 }
        );
      }

      if (bytes.length > DEFAULT_PDF_MAX_BYTES) {
        return NextResponse.json(
          { error: "PDF too large. Max allowed size is 100 MB." },
          { status: 400 }
        );
      }

      if (!BUCKET_PRIVATE) {
        return NextResponse.json(
          { error: "AWS_S3_BUCKET_PRIVATE missing" },
          { status: 500 }
        );
      }

      const id = crypto.randomBytes(10).toString("hex");
      const outName = `${safeBase(file.name)}-${id}${ext}`;
      const key = `uploads/pdfs/${outName}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET_PRIVATE,
          Key: key,
          Body: bytes,
          ContentType: file.type || "application/pdf",
        })
      );

      return NextResponse.json(
        { ok: true, kind: "pdf", key },
        { status: 200 }
      );
    }

    if (!BUCKET_PUBLIC) {
      return NextResponse.json(
        {
          error:
            "Public images bucket missing. Add AWS_S3_BUCKET_IMAGES or AWS_S3_BUCKET_PUBLIC in env.",
        },
        { status: 500 }
      );
    }

    if (isVideo) {
      if (!VIDEO_EXTENSIONS.has(ext)) {
        return NextResponse.json(
          { error: "Only .mp4 and .webm allowed for video upload" },
          { status: 400 }
        );
      }
    } else if (isImage) {
      if (!IMAGE_EXTENSIONS.has(ext)) {
        return NextResponse.json(
          { error: "Only jpg/jpeg/png/webp/avif allowed for image upload" },
          { status: 400 }
        );
      }
    }

    const id = crypto.randomBytes(10).toString("hex");
    const outName = `${safeBase(file.name)}-${id}${ext}`;

    const publicTarget = buildPublicKey({
      outName,
      destination,
      folder,
      device: deviceRaw,
      isVideo,
    });

    if (publicTarget.heroSliderMode) {
      if (isVideo && bytes.length > HERO_VIDEO_MAX_BYTES) {
        return NextResponse.json(
          {
            error:
              "Hero slider video too large. Max allowed size is 30 MB. Better site speed ke liye compressed MP4/WebM use karein.",
          },
          { status: 400 }
        );
      }

      if (isImage && bytes.length > HERO_IMAGE_MAX_BYTES) {
        return NextResponse.json(
          {
            error:
              "Hero slider image too large. Max allowed size is 8 MB. Better site speed ke liye WebP/AVIF preferred hai.",
          },
          { status: 400 }
        );
      }
    } else if (publicTarget.blogMode) {
      if (!isImage) {
        return NextResponse.json(
          { error: "Blog upload currently supports image files only." },
          { status: 400 }
        );
      }

      if (bytes.length > BLOG_IMAGE_MAX_BYTES) {
        return NextResponse.json(
          {
            error:
              "Blog image too large. Max allowed size is 10 MB. Better SEO and speed ke liye compressed WebP/AVIF preferred hai.",
          },
          { status: 400 }
        );
      }
    } else if (publicTarget.pyqThumbnailMode) {
      if (!isImage) {
        return NextResponse.json(
          {
            error:
              "PYQ master thumbnail upload currently supports image files only.",
          },
          { status: 400 }
        );
      }

      if (bytes.length > PYQ_TEMPLATE_IMAGE_MAX_BYTES) {
        return NextResponse.json(
          {
            error:
              "PYQ master template image too large. Max allowed size is 25 MB. Better result ke liye compressed PNG/WebP/AVIF use karein.",
          },
          { status: 400 }
        );
      }
    } else if (isImage && bytes.length > DEFAULT_IMAGE_MAX_BYTES) {
      return NextResponse.json(
        { error: "Image too large. Max allowed size is 15 MB." },
        { status: 400 }
      );
    }

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_PUBLIC,
        Key: publicTarget.key,
        Body: bytes,
        ContentType: isVideo
          ? getVideoContentType(ext, file.type || "")
          : getImageContentType(ext, file.type || ""),
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    const url = publicS3Url(BUCKET_PUBLIC, REGION, publicTarget.key);

    return NextResponse.json(
      {
        ok: true,
        kind: isVideo ? "video" : "image",
        url,
        src: url,
        key: publicTarget.key,
        bucket: BUCKET_PUBLIC,
        destination: publicTarget.destinationLabel,
      },
      { status: 200 }
    );
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