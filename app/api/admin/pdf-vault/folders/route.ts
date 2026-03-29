import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  buildFolderPath,
  cleanFolderPath,
  createFolderZipBufferByPath,
  ensureRootFolder,
  hasPdfVaultPageAccess,
  safeStr,
  slugify,
} from "@/lib/pdfVault";
import dbConnect from "@/lib/db";
import PdfVaultFolder from "@/models/PdfVaultFolder";
import PdfVaultFile from "@/models/PdfVaultFile";

export const runtime = "nodejs";

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function getUserId(user: any) {
  return safeStr(user?._id || user?.id || user?.userId || user?.email || "");
}

async function assertVaultAccess(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false as const, res: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }

  if (!hasPermission(user, "products:write")) {
    return { ok: false as const, res: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const allowed = await hasPdfVaultPageAccess(user.id);
  if (!allowed) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Vault access expired", needsPuzzle: true }, { status: 403 }),
    };
  }

  return { ok: true as const, user };
}

async function collectFolderTreeIds(rootId: any) {
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
  const guard = await assertVaultAccess(req);
  if (!guard.ok) return guard.res;

  await dbConnect();
  await ensureRootFolder();

  const url = new URL(req.url);
  const parentPathInput = safeStr(url.searchParams.get("parentPath") || "root");
  const q = safeStr(url.searchParams.get("q")).toLowerCase();
  const sortBy = safeStr(url.searchParams.get("sortBy") || "name");
  const sortDir = safeStr(url.searchParams.get("sortDir") || "asc").toLowerCase() === "desc" ? -1 : 1;
  const trash = url.searchParams.get("trash") === "1";

  const parentPath = cleanFolderPath(parentPathInput) || "root";

  const parent: any = await PdfVaultFolder.findOne({
    path: parentPath,
    deletedAt: null,
  }).lean();

  if (!parent) {
    return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
  }

  const query: any = {
    parentId: parent._id,
    deletedAt: trash ? { $ne: null } : null,
  };

  if (q) {
    query.$or = [
      { name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
      { slug: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
      { path: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
    ];
  }

  const sort: any =
    sortBy === "createdAt"
      ? { createdAt: sortDir, _id: sortDir }
      : sortBy === "updatedAt"
      ? { updatedAt: sortDir, _id: sortDir }
      : sortBy === "sortOrder"
      ? { sortOrder: sortDir, name: 1 }
      : { name: sortDir, _id: sortDir };

  const folders: any[] = await PdfVaultFolder.find(query).sort(sort).lean();

  const breadcrumbs = [];
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
      trash,
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
        deletedAt: f.deletedAt || null,
      })),
    },
    { status: 200 }
  );
}

export async function POST(req: NextRequest) {
  const guard = await assertVaultAccess(req);
  if (!guard.ok) return guard.res;

  const action = safeStr(req.nextUrl.searchParams.get("action")).toLowerCase();

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  await dbConnect();
  await ensureRootFolder();

  if (action === "restore") {
    const folderId = safeStr(body?.folderId);
    if (!folderId) {
      return NextResponse.json({ error: "folderId required" }, { status: 400 });
    }

    const folder: any = await PdfVaultFolder.findById(folderId);
    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    if (!folder.deletedAt) {
      return NextResponse.json({ ok: true, message: "Folder already active", folderId }, { status: 200 });
    }

    const ids = await collectFolderTreeIds(folder._id);

    await PdfVaultFolder.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          deletedAt: null,
          updatedBy: getUserId(guard.user),
          updatedAt: new Date(),
        },
      }
    );

    await PdfVaultFile.updateMany(
      { folderId: { $in: ids } },
      {
        $set: {
          deletedAt: null,
        },
      }
    );

    return NextResponse.json({ ok: true, message: "Folder restored", folderId }, { status: 200 });
  }

  if (action === "purge") {
    const folderId = safeStr(body?.folderId);
    if (!folderId) {
      return NextResponse.json({ error: "folderId required" }, { status: 400 });
    }

    const folder: any = await PdfVaultFolder.findById(folderId);
    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    if (safeStr(folder.path) === "root" || !folder.parentId) {
      return NextResponse.json({ error: "Root folder cannot be purged" }, { status: 400 });
    }

    if (!folder.deletedAt) {
      return NextResponse.json({ error: "Folder must be in trash before purge" }, { status: 400 });
    }

    const ids = await collectFolderTreeIds(folder._id);

    await PdfVaultFile.deleteMany({ folderId: { $in: ids } });
    await PdfVaultFolder.deleteMany({ _id: { $in: ids } });

    return NextResponse.json({ ok: true, message: "Folder permanently deleted", folderId }, { status: 200 });
  }

  if (action === "download") {
    const folderPath = cleanFolderPath(body?.folderPath || "");
    const password = safeStr(body?.password);
    const expected = safeStr(process.env.ADMIN_FILE_DOWNLOAD_PASSWORD);

    if (!folderPath) {
      return NextResponse.json({ error: "folderPath required" }, { status: 400 });
    }

    if (!expected) {
      return NextResponse.json({ error: "ADMIN_FILE_DOWNLOAD_PASSWORD missing in env" }, { status: 500 });
    }

    if (!password || password !== expected) {
      return NextResponse.json({ error: "Invalid download password" }, { status: 403 });
    }

    const zipped = await createFolderZipBufferByPath(folderPath);
    const zipName = `${safeStr(zipped.folder?.name || "folder")}.zip`;

    return new NextResponse(zipped.buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipName.replace(/"/g, "")}"`,
        "Content-Length": String(zipped.buffer.length),
        "Cache-Control": "no-store",
        "X-Vault-Files-Count": String(Number(zipped.filesCount || 0)),
      },
    });
  }

  const name = safeStr(body?.name);
  const parentPathInput = safeStr(body?.parentPath || "root");
  const sortOrder = Math.trunc(safeNum(body?.sortOrder, 0));

  if (!name) {
    return NextResponse.json({ error: "Folder name required" }, { status: 400 });
  }

  const parentPath = cleanFolderPath(parentPathInput) || "root";

  const parent: any = await PdfVaultFolder.findOne({
    path: parentPath,
    deletedAt: null,
  });

  if (!parent) {
    return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
  }

  const slug = slugify(name);
  if (!slug) {
    return NextResponse.json({ error: "Invalid folder name" }, { status: 400 });
  }

  const nextPath = buildFolderPath(parent.path, name);

  const exists = await PdfVaultFolder.findOne({
    path: nextPath,
    deletedAt: null,
  }).lean();

  if (exists) {
    return NextResponse.json(
      { error: "Folder already exists", field: "name", conflictValue: nextPath },
      { status: 409 }
    );
  }

  const created: any = await PdfVaultFolder.create({
    name,
    slug,
    parentId: parent._id,
    path: nextPath,
    level: Number(parent.level || 0) + 1,
    sortOrder,
    isLocked: false,
    notes: "",
    createdBy: getUserId(guard.user),
    updatedBy: getUserId(guard.user),
    deletedAt: null,
  });

  return NextResponse.json(
    {
      ok: true,
      message: "Folder created",
      folder: {
        _id: String(created._id),
        name: safeStr(created.name),
        slug: safeStr(created.slug),
        path: safeStr(created.path),
        level: Number(created.level || 0),
      },
    },
    { status: 201 }
  );
}

export async function PATCH(req: NextRequest) {
  const guard = await assertVaultAccess(req);
  if (!guard.ok) return guard.res;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  await dbConnect();
  await ensureRootFolder();

  const folderId = safeStr(body?.folderId);
  const name = safeStr(body?.name);

  if (!folderId) {
    return NextResponse.json({ error: "folderId required" }, { status: 400 });
  }

  if (!name) {
    return NextResponse.json({ error: "Folder name required" }, { status: 400 });
  }

  const folder: any = await PdfVaultFolder.findById(folderId);
  if (!folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  if (safeStr(folder.path) === "root" || !folder.parentId) {
    return NextResponse.json({ error: "Root folder cannot be renamed" }, { status: 400 });
  }

  if (folder.deletedAt) {
    return NextResponse.json({ error: "Trashed folder cannot be renamed" }, { status: 400 });
  }

  try {
    const updated = await renameFolderTree(folder, name, getUserId(guard.user));

    return NextResponse.json(
      {
        ok: true,
        message: "Folder renamed",
        folder: {
          _id: String(updated._id),
          name: safeStr(updated.name),
          slug: safeStr(updated.slug),
          path: safeStr(updated.path),
          level: Number(updated.level || 0),
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: safeStr(e?.message || "Rename failed") }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await assertVaultAccess(req);
  if (!guard.ok) return guard.res;

  await dbConnect();
  await ensureRootFolder();

  const url = new URL(req.url);
  const folderId = safeStr(url.searchParams.get("folderId"));

  if (!folderId) {
    return NextResponse.json({ error: "folderId required" }, { status: 400 });
  }

  const folder: any = await PdfVaultFolder.findById(folderId);
  if (!folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  if (safeStr(folder.path) === "root" || !folder.parentId) {
    return NextResponse.json({ error: "Root folder cannot be deleted" }, { status: 400 });
  }

  if (folder.deletedAt) {
    return NextResponse.json({ ok: true, message: "Folder already in trash", folderId }, { status: 200 });
  }

  const ids = await collectFolderTreeIds(folder._id);

  await PdfVaultFolder.updateMany(
    { _id: { $in: ids } },
    {
      $set: {
        deletedAt: new Date(),
        updatedBy: getUserId(guard.user),
        updatedAt: new Date(),
      },
    }
  );

  await PdfVaultFile.updateMany(
    { folderId: { $in: ids } },
    {
      $set: {
        deletedAt: new Date(),
      },
    }
  );

  return NextResponse.json(
    {
      ok: true,
      message: "Folder tree moved to trash",
      folderId,
      affectedFolders: ids.length,
    },
    { status: 200 }
  );
}