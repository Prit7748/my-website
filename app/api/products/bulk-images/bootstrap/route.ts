import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import PdfVaultFolder from "@/models/PdfVaultFolder";
import { getAuthUser, hasPermission } from "@/lib/auth";
import { safeStr, slugify } from "@/lib/pdfVault";

export const runtime = "nodejs";

async function ensureImageRootFolder() {
  await dbConnect();

  const path = "img-root";

  const existing: any = await PdfVaultFolder.findOne({
    path,
    deletedAt: null,
  });

  if (existing) return existing;

  const created = await PdfVaultFolder.create({
    name: "Product Images",
    slug: "product-images",
    parentId: null,
    path,
    level: 0,
    sortOrder: 0,
    isLocked: true,
    notes: "System root for bulk product images vault",
    createdBy: "system",
    updatedBy: "system",
    deletedAt: null,
  });

  return created;
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const root = await ensureImageRootFolder();

  return NextResponse.json({
    ok: true,
    root: {
      _id: String(root._id),
      name: safeStr(root.name),
      path: safeStr(root.path),
      level: Number(root.level || 0),
      slug: safeStr(root.slug || slugify(root.name)),
    },
  });
}