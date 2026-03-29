import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import PdfVaultFolder from "@/models/PdfVaultFolder";
import { getAuthUser, hasPermission } from "@/lib/auth";
import { cleanFolderPath, ensureRootFolder, safeStr } from "@/lib/pdfVault";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!hasPermission(user, "products:read") && !hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();
  await ensureRootFolder();

  const url = new URL(req.url);
  const parentPathInput = safeStr(url.searchParams.get("parentPath") || "root");
  const parentPath = cleanFolderPath(parentPathInput) || "root";

  const parent: any = await PdfVaultFolder.findOne({
    path: parentPath,
    deletedAt: null,
  }).lean();

  if (!parent) {
    return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
  }

  const folders: any[] = await PdfVaultFolder.find({
    parentId: parent._id,
    deletedAt: null,
  })
    .sort({ name: 1, _id: 1 })
    .lean();

  const breadcrumbs: Array<{ name: string; path: string }> = [];
  const parts = parentPath.split("/").filter(Boolean);

  for (let i = 0; i < parts.length; i += 1) {
    breadcrumbs.push({
      name: parts[i],
      path: parts.slice(0, i + 1).join("/"),
    });
  }

  return NextResponse.json(
    {
      ok: true,
      parent: {
        _id: String(parent._id),
        name: safeStr(parent.name),
        path: safeStr(parent.path),
        level: Number(parent.level || 0),
      },
      breadcrumbs,
      folders: folders.map((f: any) => ({
        _id: String(f._id),
        name: safeStr(f.name),
        slug: safeStr(f.slug),
        path: safeStr(f.path),
        level: Number(f.level || 0),
        sortOrder: Number(f.sortOrder || 0),
        isLocked: Boolean(f.isLocked),
        createdAt: f.createdAt || null,
        updatedAt: f.updatedAt || null,
      })),
    },
    { status: 200 }
  );
}