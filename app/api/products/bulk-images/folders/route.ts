import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import PdfVaultFolder from "@/models/PdfVaultFolder";
import ProductImageVaultFile from "@/models/ProductImageVaultFile";
import { getAuthUser, hasPermission } from "@/lib/auth";
import { safeStr, slugify, cleanFolderPath, buildFolderPath } from "@/lib/pdfVault";

export const runtime = "nodejs";

function getUserId(user: any) {
  return safeStr(user?._id || user?.id || user?.email || "");
}

async function getFolderByPathOrThrow(folderPath: string) {
  await dbConnect();
  const row: any = await PdfVaultFolder.findOne({ path: folderPath, deletedAt: null }).lean();
  if (!row) throw new Error("Folder not found");
  return row;
}

async function buildBreadcrumbs(folderPath: string) {
  await dbConnect();

  if (!folderPath) return [];

  const parts = folderPath.split("/").filter(Boolean);
  const paths: string[] = [];
  for (let i = 1; i <= parts.length; i++) {
    paths.push(parts.slice(0, i).join("/"));
  }

  const rows: any[] = await PdfVaultFolder.find({
    path: { $in: paths },
    deletedAt: null,
  })
    .select("name path level")
    .lean();

  const map = new Map<string, any>();
  for (const r of rows) map.set(String(r.path), r);

  return paths
    .map((p) => map.get(p))
    .filter(Boolean)
    .map((x) => ({ name: safeStr(x.name), path: safeStr(x.path) }));
}

async function collectFolderTreeIds(rootId: string) {
  const ids: string[] = [String(rootId)];
  const queue: string[] = [String(rootId)];

  while (queue.length) {
    const currentId = queue.shift() as string;

    const children: any[] = await PdfVaultFolder.find({
      parentId: currentId,
    })
      .select("_id")
      .lean();

    for (const child of children) {
      const cid = String(child._id);
      if (!ids.includes(cid)) {
        ids.push(cid);
        queue.push(cid);
      }
    }
  }

  return ids;
}

async function renameFolderTree(folder: any, newName: string, updatedBy: string) {
  const oldPath = safeStr(folder.path);
  const oldPrefix = `${oldPath}/`;

  const slug = slugify(newName);
  if (!slug) throw new Error("Invalid folder name");

  if (!folder.parentId) throw new Error("Root folder cannot be renamed");

  const parent: any = await PdfVaultFolder.findById(folder.parentId).lean();
  if (!parent || parent.deletedAt) throw new Error("Parent folder not found");

  const nextPath = buildFolderPath(safeStr(parent.path), newName);

  const conflict = await PdfVaultFolder.findOne({
    _id: { $ne: folder._id },
    path: nextPath,
    deletedAt: null,
  })
    .select("_id")
    .lean();

  if (conflict) throw new Error("Folder already exists with same name");

  await PdfVaultFolder.updateOne(
    { _id: folder._id },
    {
      $set: {
        name: safeStr(newName),
        slug,
        path: nextPath,
        updatedBy,
        updatedAt: new Date(),
      },
    }
  );

  const descendants: any[] = await PdfVaultFolder.find({
    path: { $regex: `^${oldPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` },
  }).lean();

  for (const child of descendants) {
    const childPath = safeStr(child.path);
    const suffix = childPath.slice(oldPath.length);
    const updatedPath = `${nextPath}${suffix}`;

    await PdfVaultFolder.updateOne(
      { _id: child._id },
      {
        $set: {
          path: updatedPath,
          updatedBy,
          updatedAt: new Date(),
        },
      }
    );
  }

  const updated: any = await PdfVaultFolder.findById(folder._id).lean();
  return updated;
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const parentPath = cleanFolderPath(searchParams.get("parentPath") || "img-root") || "img-root";
  const sortBy = safeStr(searchParams.get("sortBy") || "name");
  const sortDir = safeStr(searchParams.get("sortDir") || "asc") === "desc" ? -1 : 1;

  const parent = await getFolderByPathOrThrow(parentPath);

  const sort: any =
    sortBy === "createdAt"
      ? { createdAt: sortDir, _id: sortDir }
      : sortBy === "updatedAt"
      ? { updatedAt: sortDir, _id: sortDir }
      : sortBy === "sortOrder"
      ? { sortOrder: sortDir, name: 1, _id: 1 }
      : { name: sortDir, _id: sortDir };

  await dbConnect();

  const folders: any[] = await PdfVaultFolder.find({
    parentId: parent._id,
    deletedAt: null,
  })
    .sort(sort)
    .lean();

  const breadcrumbs = await buildBreadcrumbs(parentPath);

  return NextResponse.json({
    ok: true,
    parent: {
      _id: String(parent._id),
      name: safeStr(parent.name),
      path: safeStr(parent.path),
      level: Number(parent.level || 0),
    },
    breadcrumbs,
    folders: folders.map((f) => ({
      _id: String(f._id),
      name: safeStr(f.name),
      slug: safeStr(f.slug),
      path: safeStr(f.path),
      level: Number(f.level || 0),
      sortOrder: Number(f.sortOrder || 0),
      isLocked: Boolean(f.isLocked),
      notes: safeStr(f.notes),
      createdAt: f.createdAt ? String(f.createdAt) : null,
      updatedAt: f.updatedAt ? String(f.updatedAt) : null,
      deletedAt: f.deletedAt ? String(f.deletedAt) : null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body: any = await req.json().catch(() => ({}));
  const parentPath = cleanFolderPath(body?.parentPath || "img-root") || "img-root";
  const name = safeStr(body?.name);

  if (!name) {
    return NextResponse.json({ ok: false, error: "Folder name required" }, { status: 400 });
  }

  await dbConnect();

  const parent: any = await PdfVaultFolder.findOne({ path: parentPath, deletedAt: null });
  if (!parent) {
    return NextResponse.json({ ok: false, error: "Parent folder not found" }, { status: 404 });
  }

  const nextPath = buildFolderPath(parentPath, name);

  const exists: any = await PdfVaultFolder.findOne({ path: nextPath, deletedAt: null }).lean();
  if (exists) {
    return NextResponse.json({
      ok: true,
      folder: {
        _id: String(exists._id),
        name: safeStr(exists.name),
        path: safeStr(exists.path),
      },
    });
  }

  const created: any = await PdfVaultFolder.create({
    name,
    slug: slugify(name),
    parentId: parent._id,
    path: nextPath,
    level: Number(parent.level || 0) + 1,
    sortOrder: 0,
    isLocked: false,
    notes: "",
    createdBy: safeStr(user.email),
    updatedBy: safeStr(user.email),
    deletedAt: null,
  });

  return NextResponse.json({
    ok: true,
    folder: {
      _id: String(created._id),
      name: safeStr(created.name),
      path: safeStr(created.path),
    },
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body: any = await req.json().catch(() => ({}));
  const folderId = safeStr(body?.folderId);
  const name = safeStr(body?.name);

  if (!folderId) {
    return NextResponse.json({ ok: false, error: "folderId required" }, { status: 400 });
  }

  if (!name) {
    return NextResponse.json({ ok: false, error: "Folder name required" }, { status: 400 });
  }

  await dbConnect();

  const folder: any = await PdfVaultFolder.findById(folderId);
  if (!folder) {
    return NextResponse.json({ ok: false, error: "Folder not found" }, { status: 404 });
  }

  if (!folder.parentId || safeStr(folder.path) === "img-root") {
    return NextResponse.json({ ok: false, error: "Root folder cannot be renamed" }, { status: 400 });
  }

  if (folder.deletedAt) {
    return NextResponse.json({ ok: false, error: "Deleted folder cannot be renamed" }, { status: 400 });
  }

  try {
    const updated = await renameFolderTree(folder, name, getUserId(user));

    return NextResponse.json({
      ok: true,
      folder: {
        _id: String(updated._id),
        name: safeStr(updated.name),
        slug: safeStr(updated.slug),
        path: safeStr(updated.path),
        level: Number(updated.level || 0),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: safeStr(err?.message || "Rename failed") },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const folderId = safeStr(searchParams.get("folderId"));

  if (!folderId) {
    return NextResponse.json({ ok: false, error: "folderId required" }, { status: 400 });
  }

  const folder: any = await PdfVaultFolder.findById(folderId);
  if (!folder) {
    return NextResponse.json({ ok: false, error: "Folder not found" }, { status: 404 });
  }

  if (!folder.parentId || safeStr(folder.path) === "img-root") {
    return NextResponse.json({ ok: false, error: "Root folder cannot be deleted" }, { status: 400 });
  }

  if (folder.deletedAt) {
    return NextResponse.json({ ok: true, message: "Folder already deleted", folderId });
  }

  const allIds = await collectFolderTreeIds(String(folder._id));
  const now = new Date();

  await PdfVaultFolder.updateMany(
    { _id: { $in: allIds } },
    {
      $set: {
        deletedAt: now,
        updatedAt: now,
        updatedBy: getUserId(user),
      },
    }
  );

  await ProductImageVaultFile.updateMany(
    { folderId: { $in: allIds }, deletedAt: null },
    {
      $set: {
        deletedAt: now,
        updatedAt: now,
      },
    }
  );

  return NextResponse.json({
    ok: true,
    folderId,
    affectedFolders: allIds.length,
  });
}