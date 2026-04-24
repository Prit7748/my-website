import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import PdfVaultFile from "@/models/PdfVaultFile";
import OfficialPaper from "@/models/OfficialPaper";
import { autoResolveWantToBuyForProduct } from "@/lib/wantToBuyAutoResolve";
import { syncGeneratedHardcopyForProductChange } from "@/lib/hardcopyAutoSync";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function normalizeSkuLike(input: string) {
  return safeStr(input).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

export type DerivedAvailability = "available" | "on_demand" | "want_to_buy";

export function deriveAvailabilityFromFlags(args: {
  hasSolvedPdf: boolean;
  hasOfficialPaper: boolean;
}): DerivedAvailability {
  if (args.hasSolvedPdf) return "available";
  if (args.hasOfficialPaper) return "on_demand";
  return "want_to_buy";
}

function buildLinkedRecordPatch(product: any | null) {
  const now = new Date();

  if (!product || product.deletedAt) {
    return {
      productExists: false,
      productId: null,
      productSku: "",
      productSlug: "",
      titleColor: "red",
      updatedAt: now,
    };
  }

  return {
    productExists: true,
    productId: product._id,
    productSku: safeStr(product.sku).toUpperCase(),
    productSlug: safeStr(product.slug),
    titleColor: "green",
    updatedAt: now,
  };
}

async function findLiveProductBySku(skuInput: string) {
  const skuNormalized = normalizeSkuLike(skuInput);
  if (!skuNormalized) return null;

  await dbConnect();

  const exactUpper = safeStr(skuInput).toUpperCase();

  let product: any = await Product.findOne({
    sku: exactUpper,
    deletedAt: null,
  });

  if (product) return product;

  product = await Product.findOne({
    sku: {
      $regex: `^${safeStr(skuInput).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      $options: "i",
    },
    deletedAt: null,
  });

  return product || null;
}

async function syncSolvedVaultRecordLinkBySku(skuInput: string, product: any | null) {
  const skuNormalized = normalizeSkuLike(skuInput);
  if (!skuNormalized) {
    return {
      ok: false,
      type: "solved_pdf",
      reason: "SKU missing",
      matchedCount: 0,
      linked: false,
      row: null,
    };
  }

  await dbConnect();

  const patch = buildLinkedRecordPatch(product);

  const updateRes: any = await PdfVaultFile.updateMany(
    {
      skuNormalized,
      deletedAt: null,
    },
    {
      $set: patch,
    }
  );

  const row: any = await PdfVaultFile.findOne({
    skuNormalized,
    deletedAt: null,
  })
    .select(
      "_id skuNormalized s3Key s3Bucket pageCount productExists productId productSku productSlug titleColor"
    )
    .lean();

  return {
    ok: true,
    type: "solved_pdf",
    matchedCount:
      Number(updateRes?.modifiedCount || 0) ||
      Number(updateRes?.matchedCount || 0) ||
      (row ? 1 : 0),
    linked: Boolean(product && !product.deletedAt && row),
    row: row || null,
  };
}

async function syncOfficialPaperRecordLinkBySku(skuInput: string, product: any | null) {
  const skuNormalized = normalizeSkuLike(skuInput);
  if (!skuNormalized) {
    return {
      ok: false,
      type: "official_paper",
      reason: "SKU missing",
      matchedCount: 0,
      linked: false,
      row: null,
    };
  }

  await dbConnect();

  const patch = buildLinkedRecordPatch(product);

  const updateRes: any = await OfficialPaper.updateMany(
    {
      skuNormalized,
      deletedAt: null,
    },
    {
      $set: patch,
    }
  );

  const row: any = await OfficialPaper.findOne({
    skuNormalized,
    deletedAt: null,
  })
    .select(
      "_id skuNormalized s3Key s3Bucket pageCount productExists productId productSku productSlug titleColor"
    )
    .lean();

  return {
    ok: true,
    type: "official_paper",
    matchedCount:
      Number(updateRes?.modifiedCount || 0) ||
      Number(updateRes?.matchedCount || 0) ||
      (row ? 1 : 0),
    linked: Boolean(product && !product.deletedAt && row),
    row: row || null,
  };
}

async function syncAllLinkedRecordsBySku(skuInput: string, product: any | null) {
  const [solvedPdfLink, officialPaperLink] = await Promise.all([
    syncSolvedVaultRecordLinkBySku(skuInput, product),
    syncOfficialPaperRecordLinkBySku(skuInput, product),
  ]);

  return {
    solvedPdfLink,
    officialPaperLink,
  };
}

export async function findSolvedVaultFileBySku(skuInput: string) {
  const skuNormalized = normalizeSkuLike(skuInput);
  if (!skuNormalized) return null;

  await dbConnect();

  const row: any = await PdfVaultFile.findOne({
    skuNormalized,
    deletedAt: null,
  })
    .select("_id skuNormalized s3Key s3Bucket pageCount productId productSku productSlug")
    .lean();

  return row || null;
}

export async function findOfficialPaperBySku(skuInput: string) {
  const skuNormalized = normalizeSkuLike(skuInput);
  if (!skuNormalized) return null;

  await dbConnect();

  const row: any = await OfficialPaper.findOne({
    skuNormalized,
    deletedAt: null,
  })
    .select("_id skuNormalized s3Key s3Bucket pageCount productId productSku productSlug")
    .lean();

  return row || null;
}

export async function getDerivedAvailabilitySnapshotBySku(skuInput: string) {
  const skuNormalized = normalizeSkuLike(skuInput);

  if (!skuNormalized) {
    return {
      skuNormalized: "",
      hasSolvedPdf: false,
      hasOfficialPaper: false,
      solvedPdfKey: "",
      solvedPdfPages: 0,
      officialPaperKey: "",
      officialPaperPages: 0,
      availability: "want_to_buy" as DerivedAvailability,
    };
  }

  const [solvedFile, officialPaper] = await Promise.all([
    findSolvedVaultFileBySku(skuNormalized),
    findOfficialPaperBySku(skuNormalized),
  ]);

  const solvedPdfKey = safeStr(solvedFile?.s3Key);
  const officialPaperKey = safeStr(officialPaper?.s3Key);

  const hasSolvedPdf = Boolean(solvedPdfKey);
  const hasOfficialPaper = Boolean(officialPaperKey);

  return {
    skuNormalized,
    hasSolvedPdf,
    hasOfficialPaper,
    solvedPdfKey,
    solvedPdfPages: Math.max(0, Math.trunc(safeNum(solvedFile?.pageCount, 0))),
    officialPaperKey,
    officialPaperPages: Math.max(0, Math.trunc(safeNum(officialPaper?.pageCount, 0))),
    availability: deriveAvailabilityFromFlags({
      hasSolvedPdf,
      hasOfficialPaper,
    }),
  };
}

export async function syncProductAvailabilityBySku(skuInput: string) {
  const skuNormalized = normalizeSkuLike(skuInput);

  if (!skuNormalized) {
    return {
      ok: false,
      reason: "SKU missing",
      skuNormalized: "",
    };
  }

  await dbConnect();

  const product: any = await findLiveProductBySku(skuNormalized);

  if (!product) {
    const snapshot = await getDerivedAvailabilitySnapshotBySku(skuNormalized);
    const linkedRecords = await syncAllLinkedRecordsBySku(skuNormalized, null);

    return {
      ok: true,
      reason: "Product not found. Linked records unlinked.",
      productId: "",
      productSku: "",
      skuNormalized,
      before: {
        availability: "",
        pdfKey: "",
        pages: 0,
      },
      after: {
        availability: "",
        pdfKey: "",
        pages: 0,
      },
      snapshot,
      linkedRecords,
      autoResolvedWantToBuy: {
        ok: true,
        reason: "product_missing",
        deletedCount: 0,
        emails: [] as string[],
      },
      hardcopySync: {
        ok: true,
        action: "skipped",
        reason: "Product not found",
      },
    };
  }

  return syncProductAvailabilityByProductId(String(product._id));
}

export async function syncProductAvailabilityByProductId(productId: string) {
  await dbConnect();

  const product: any = await Product.findById(productId);
  if (!product || product.deletedAt) {
    return {
      ok: false,
      reason: "Product not found",
      productId: safeStr(productId),
    };
  }

  const beforeProduct = product.toObject ? product.toObject() : { ...product };
  const skuNormalized = normalizeSkuLike(safeStr(product.sku));

  const snapshot = await getDerivedAvailabilitySnapshotBySku(skuNormalized);
  const beforeAvailability = safeStr(product.availability || "");
  const beforePdfKey = safeStr(product.pdfKey || "");
  const beforePages = Math.max(0, Math.trunc(safeNum(product.pages, 0)));

  const nextPdfKey = snapshot.hasSolvedPdf ? snapshot.solvedPdfKey : "";
  const nextPages =
    snapshot.hasSolvedPdf && snapshot.solvedPdfPages > 0 ? snapshot.solvedPdfPages : 0;

  product.pdfKey = nextPdfKey;
  product.pdfUrl = nextPdfKey ? "" : safeStr(product.pdfUrl || "");
  product.pages = nextPages;
  product.availability = snapshot.availability;
  product.lastModifiedAt = new Date();

  await product.save();

  const afterProductDoc: any = await Product.findById(product._id);
  const afterProduct = afterProductDoc?.toObject
    ? afterProductDoc.toObject()
    : product.toObject
    ? product.toObject()
    : product;

  const linkedRecords = await syncAllLinkedRecordsBySku(skuNormalized, afterProductDoc || product);

  const resolveResult = await autoResolveWantToBuyForProduct({
    productId: product._id,
    availability: product.availability,
    pdfKey: product.pdfKey,
    isActive: product.isActive,
  });

  let hardcopySync: any = { ok: true, action: "skipped" };
  try {
    hardcopySync = await syncGeneratedHardcopyForProductChange({
      before: beforeProduct,
      after: afterProduct,
    });
  } catch (error: any) {
    hardcopySync = {
      ok: false,
      action: "failed",
      reason: safeStr(error?.message || "Hardcopy sync failed"),
    };
  }

  return {
    ok: true,
    productId: String(product._id),
    productSku: safeStr(product.sku),
    before: {
      availability: beforeAvailability,
      pdfKey: beforePdfKey,
      pages: beforePages,
    },
    after: {
      availability: safeStr(product.availability),
      pdfKey: safeStr(product.pdfKey),
      pages: Math.max(0, Math.trunc(safeNum(product.pages, 0))),
    },
    snapshot,
    linkedRecords,
    autoResolvedWantToBuy: resolveResult,
    hardcopySync,
  };
}

export async function syncProductAvailabilityForAllBySkuList(skuList: string[]) {
  const normalized = Array.from(
    new Set(
      (Array.isArray(skuList) ? skuList : [])
        .map((x) => safeStr(x))
        .filter(Boolean)
    )
  );

  const results: any[] = [];

  for (const sku of normalized) {
    try {
      const one = await syncProductAvailabilityBySku(sku);
      results.push(one);
    } catch (err: any) {
      results.push({
        ok: false,
        skuNormalized: normalizeSkuLike(sku),
        reason: safeStr(err?.message || "Sync failed"),
      });
    }
  }

  return {
    ok: results.every((x) => x?.ok),
    total: results.length,
    synced: results.filter((x) => x?.ok).length,
    failed: results.filter((x) => !x?.ok).length,
    results,
  };
}