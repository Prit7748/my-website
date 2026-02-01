import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getAuthUser, hasPermission } from "@/lib/auth";

export const runtime = "nodejs"; // ✅ fs needs node runtime

function safeExt(name: string) {
  const ext = (path.extname(name || "") || "").toLowerCase();
  return ext.replace(/[^a-z0-9.]/g, "");
}

function safeBase(name: string) {
  const base = path.basename(name || "", path.extname(name || ""));
  return base.toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/-+/g, "-").slice(0, 60) || "file";
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden (products:write missing)" }, { status: 403 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const kind = (form.get("kind") || "image").toString(); // "pdf" | "image"

    if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

    const isPdf = kind === "pdf";
    const ext = safeExt(file.name) || (isPdf ? ".pdf" : ".jpg");

    // basic validations
    if (isPdf && ext !== ".pdf") {
      return NextResponse.json({ error: "Only .pdf allowed for PDF upload" }, { status: 400 });
    }
    if (!isPdf && ![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
      return NextResponse.json({ error: "Only jpg/jpeg/png/webp allowed for images" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    // folders under /public (dev friendly)
    const folder = isPdf ? "uploads/pdfs" : "uploads/images";
    const outDir = path.join(process.cwd(), "public", folder);
    await mkdir(outDir, { recursive: true });

    const id = crypto.randomBytes(8).toString("hex");
    const outName = `${safeBase(file.name)}-${id}${ext}`;
    const outPath = path.join(outDir, outName);

    await writeFile(outPath, bytes);

    const url = `/${folder}/${outName}`; // public URL

    return NextResponse.json(
      {
        ok: true,
        url,
        filename: outName,
        bytes: bytes.length,
        mime: file.type || (isPdf ? "application/pdf" : "image/*"),
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: "Upload failed", details: e?.message || "unknown" }, { status: 500 });
  }
}
