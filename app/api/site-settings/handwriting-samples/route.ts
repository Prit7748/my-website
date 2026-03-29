import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

import dbConnect from "@/lib/db";
import { getAuthUser, type AuthUser } from "@/lib/auth";
import HandwritingSample from "@/models/HandwritingSample";

export const runtime = "nodejs";

const PUBLIC_URL_BASE = "/uploads/site-settings/handwriting-samples";
const PUBLIC_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "site-settings",
  "handwriting-samples"
);

function asString(v: unknown, def = ""): string {
  return typeof v === "string" ? v.trim() : def;
}

function asNumber(v: unknown, def = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function asBoolean(v: unknown, def = false): boolean {
  if (typeof v === "boolean") return v;

  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(s)) return true;
    if (["false", "0", "no", "off"].includes(s)) return false;
  }

  return def;
}

function getFileExtension(file: File): string {
  const rawName = String(file.name || "").trim();
  const dotIdx = rawName.lastIndexOf(".");

  if (dotIdx !== -1) {
    const ext = rawName.slice(dotIdx + 1).toLowerCase();
    if (ext) return ext;
  }

  const mime = String(file.type || "").toLowerCase();
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("jpg")) return "jpg";
  return "jpg";
}

function toItem(doc: any) {
  return {
    id: String(doc._id),
    imageUrl: String(doc.imageUrl || ""),
    alt: String(doc.alt || ""),
    sortOrder: Number(doc.sortOrder || 0),
    isActive: Boolean(doc.isActive),
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

function canManageHandwritingSamples(user: AuthUser | null): boolean {
  if (!user) return false;

  if (user.role === "master_admin") return true;

  // फिलहाल co_admin ko bhi allow kar rahe hain
  // agar baad me strict permission based control chahiye ho to isko tighten kar denge
  if (user.role === "co_admin") return true;

  // optional future-safe permission support
  const perms = Array.isArray(user.permissions) ? user.permissions : [];
  if (
    perms.includes("site_settings.manage") ||
    perms.includes("site_settings") ||
    perms.includes("handwriting_samples.manage")
  ) {
    return true;
  }

  return false;
}

async function ensureAdmin(): Promise<AuthUser | null> {
  await dbConnect();
  const user = await getAuthUser();

  if (!canManageHandwritingSamples(user)) {
    return null;
  }

  return user;
}

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const scope = req.nextUrl.searchParams.get("scope");

    if (scope === "admin") {
      const admin = await ensureAdmin();
      if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const rows = await HandwritingSample.find({})
        .sort({ sortOrder: 1, createdAt: -1 })
        .lean();

      return NextResponse.json({
        items: rows.map(toItem),
      });
    }

    const rows = await HandwritingSample.find({ isActive: true })
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();

    return NextResponse.json({
      items: rows.map(toItem),
    });
  } catch (error) {
    console.error("GET handwriting samples error:", error);
    return NextResponse.json(
      { error: "Failed to load handwriting samples" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await ensureAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const alt = asString(formData.get("alt"), "");
    const sortOrder = asNumber(formData.get("sortOrder"), 0);
    const isActive = asBoolean(formData.get("isActive"), true);

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Image file is required" },
        { status: 400 }
      );
    }

    if (!String(file.type || "").startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 }
      );
    }

    const maxSize = 8 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Image size must be 8MB or less" },
        { status: 400 }
      );
    }

    await fs.mkdir(PUBLIC_DIR, { recursive: true });

    const ext = getFileExtension(file);
    const fileName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
    const publicUrl = `${PUBLIC_URL_BASE}/${fileName}`;
    const absolutePath = path.join(PUBLIC_DIR, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(absolutePath, buffer);

    const created = await HandwritingSample.create({
      imageUrl: publicUrl,
      alt,
      sortOrder,
      isActive,
    });

    return NextResponse.json(
      {
        ok: true,
        item: toItem(created),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST handwriting samples error:", error);
    return NextResponse.json(
      { error: "Failed to upload handwriting sample" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await ensureAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const id = asString(body?.id);

    if (!id) {
      return NextResponse.json(
        { error: "Sample id is required" },
        { status: 400 }
      );
    }

    const updateData = {
      alt: asString(body?.alt, ""),
      sortOrder: asNumber(body?.sortOrder, 0),
      isActive: asBoolean(body?.isActive, true),
    };

    const updated = await HandwritingSample.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Sample not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      item: toItem(updated),
    });
  } catch (error) {
    console.error("PATCH handwriting samples error:", error);
    return NextResponse.json(
      { error: "Failed to update handwriting sample" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await ensureAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = asString(req.nextUrl.searchParams.get("id"));
    if (!id) {
      return NextResponse.json(
        { error: "Sample id is required" },
        { status: 400 }
      );
    }

    const existing = await HandwritingSample.findById(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Sample not found" },
        { status: 404 }
      );
    }

    const imageUrl = asString(existing.imageUrl, "");
    if (imageUrl.startsWith(PUBLIC_URL_BASE + "/")) {
      const absFilePath = path.join(
        process.cwd(),
        "public",
        imageUrl.replace(/^\//, "")
      );

      try {
        await fs.unlink(absFilePath);
      } catch {
        // ignore if file already missing
      }
    }

    await HandwritingSample.findByIdAndDelete(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE handwriting samples error:", error);
    return NextResponse.json(
      { error: "Failed to delete handwriting sample" },
      { status: 500 }
    );
  }
}