import { NextRequest, NextResponse } from "next/server";

import dbConnect from "@/lib/db";
import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  ensureRootFolder,
  hasPdfVaultPageAccess,
  safeStr,
} from "@/lib/pdfVault";
import Product from "@/models/Product";
import PdfVaultFile from "@/models/PdfVaultFile";
import { normalizeProductCategory, PHYSICAL_CATEGORY } from "@/lib/productCatalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProductLite = {
  _id: string;
  sku: string;
  category: string;
  title: string;
  slug: string;
};

type VaultLite = {
  _id: string;
  skuNormalized: string;
  fileName: string;
  uploadedAt: Date | string | null;
  pageCount: number;
  sizeBytes: number;
  folderId: string;
  productExists?: boolean;
};

function escapeCsvValue(input: any) {
  const text = String(input ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function normalizeSkuLike(input: string) {
  return safeStr(input).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function assertVaultAccess() {
  const user = await getAuthUser();

  if (!user) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
      user: null,
    };
  }

  if (!hasPermission(user, "products:write")) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      user: null,
    };
  }

  const allowed = await hasPdfVaultPageAccess(user.id);
  if (!allowed) {
    return {
      ok: false as const,
      res: NextResponse.json(
        { error: "Vault access expired", needsPuzzle: true },
        { status: 403 }
      ),
      user: null,
    };
  }

  return {
    ok: true as const,
    res: null,
    user,
  };
}

async function getFolderPathMap(folderIds: string[]) {
  const uniqueIds = Array.from(new Set(folderIds.map((x) => safeStr(x)).filter(Boolean)));

  if (!uniqueIds.length) {
    return new Map<string, string>();
  }

  const PdfVaultFolder = (await import("@/models/PdfVaultFolder")).default;

  const folders: any[] = await PdfVaultFolder.find({
    _id: { $in: uniqueIds },
  })
    .select("_id path")
    .lean();

  const map = new Map<string, string>();
  for (const row of folders) {
    map.set(String(row._id), safeStr(row.path));
  }

  return map;
}

async function buildStatsPayload() {
  await dbConnect();
  await ensureRootFolder();

  const [liveVaultPdfCount, liveProductsRaw, liveVaultFilesRaw] = await Promise.all([
    PdfVaultFile.countDocuments({ deletedAt: null }),
    Product.find({
      deletedAt: null,
      category: { $ne: PHYSICAL_CATEGORY },
    })
      .select("_id sku category title slug")
      .lean(),
    PdfVaultFile.find({
      deletedAt: null,
    })
      .select("_id skuNormalized fileName uploadedAt pageCount sizeBytes folderId productExists")
      .lean(),
  ]);

  const liveProducts = (Array.isArray(liveProductsRaw) ? liveProductsRaw : []).map((row: any) => ({
    _id: String(row._id),
    sku: safeStr(row.sku).toUpperCase(),
    category: normalizeProductCategory(row.category),
    title: safeStr(row.title),
    slug: safeStr(row.slug),
  })) as ProductLite[];

  const liveVaultFiles = (Array.isArray(liveVaultFilesRaw) ? liveVaultFilesRaw : []).map((row: any) => ({
    _id: String(row._id),
    skuNormalized: normalizeSkuLike(row.skuNormalized),
    fileName: safeStr(row.fileName),
    uploadedAt: row.uploadedAt || null,
    pageCount: Math.max(0, Math.trunc(Number(row.pageCount || 0))),
    sizeBytes: Math.max(0, Math.trunc(Number(row.sizeBytes || 0))),
    folderId: safeStr(row.folderId),
    productExists: Boolean(row.productExists),
  })) as VaultLite[];

  const solvedVaultSkuSet = new Set<string>();
  for (const file of liveVaultFiles) {
    const sku = normalizeSkuLike(file.skuNormalized);
    if (sku) solvedVaultSkuSet.add(sku);
  }

  const liveProductSkuSet = new Set<string>();
  for (const product of liveProducts) {
    const sku = normalizeSkuLike(product.sku);
    if (sku) liveProductSkuSet.add(sku);
  }

  const missingPdfByCategoryMap = new Map<
    string,
    {
      category: string;
      productCount: number;
      sampleSkus: string[];
    }
  >();

  let missingPdfProductsTotal = 0;

  for (const product of liveProducts) {
    const category = normalizeProductCategory(product.category);
    const skuLike = normalizeSkuLike(product.sku);

    if (!skuLike) continue;
    if (category === PHYSICAL_CATEGORY) continue;

    const hasSolvedPdf = solvedVaultSkuSet.has(skuLike);
    if (hasSolvedPdf) continue;

    missingPdfProductsTotal += 1;

    const existing = missingPdfByCategoryMap.get(category) || {
      category,
      productCount: 0,
      sampleSkus: [],
    };

    existing.productCount += 1;

    if (existing.sampleSkus.length < 5) {
      existing.sampleSkus.push(product.sku);
    }

    missingPdfByCategoryMap.set(category, existing);
  }

  const orphanVaultFiles = liveVaultFiles.filter((file) => {
    const skuLike = normalizeSkuLike(file.skuNormalized);
    if (!skuLike) return true;
    return !liveProductSkuSet.has(skuLike);
  });

  const folderPathMap = await getFolderPathMap(orphanVaultFiles.map((x) => x.folderId));

  const orphanRows = orphanVaultFiles
    .map((file) => ({
      _id: file._id,
      skuNormalized: safeStr(file.skuNormalized),
      fileName: safeStr(file.fileName),
      folderPath: safeStr(folderPathMap.get(file.folderId) || ""),
      uploadedAt: file.uploadedAt || null,
      pageCount: Math.max(0, Math.trunc(Number(file.pageCount || 0))),
      sizeBytes: Math.max(0, Math.trunc(Number(file.sizeBytes || 0))),
      productExists: false,
    }))
    .sort((a, b) => {
      const ta = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
      const tb = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
      return tb - ta;
    });

  const missingPdfByCategory = Array.from(missingPdfByCategoryMap.values()).sort((a, b) => {
    if (b.productCount !== a.productCount) return b.productCount - a.productCount;
    return a.category.localeCompare(b.category);
  });

  return {
    ok: true,
    stats: {
      totalVaultPdfCount: Number(liveVaultPdfCount || 0),
      missingPdfProductsTotal,
      missingPdfByCategory,
      orphanVaultPdfCount: orphanRows.length,
    },
    orphanCsvRows: orphanRows,
  };
}

function buildOrphanCsv(rows: Array<any>) {
  const header = [
    "SKU",
    "File Name",
    "Folder Path",
    "Uploaded At",
    "Page Count",
    "Size (Bytes)",
    "Product Exists",
  ];

  const lines = [
    header.map(escapeCsvValue).join(","),
    ...rows.map((row) =>
      [
        safeStr(row.skuNormalized),
        safeStr(row.fileName),
        safeStr(row.folderPath),
        row.uploadedAt ? new Date(row.uploadedAt).toISOString() : "",
        Math.max(0, Math.trunc(Number(row.pageCount || 0))),
        Math.max(0, Math.trunc(Number(row.sizeBytes || 0))),
        "No",
      ]
        .map(escapeCsvValue)
        .join(",")
    ),
  ];

  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  const guard = await assertVaultAccess();
  if (!guard.ok) return guard.res as NextResponse;

  try {
    const payload = await buildStatsPayload();
    const url = new URL(req.url);
    const format = safeStr(url.searchParams.get("format")).toLowerCase();

    if (format === "csv") {
      const csv = buildOrphanCsv(payload.orphanCsvRows || []);
      const fileName = `pdf-vault-orphan-pdfs-${new Date().toISOString().slice(0, 10)}.csv`;

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        stats: payload.stats,
        orphanPreview: (payload.orphanCsvRows || []).slice(0, 20),
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message || "Failed to load PDF vault stats"),
      },
      { status: 500 }
    );
  }
}