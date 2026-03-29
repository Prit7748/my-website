import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import { getAuthUser, hasPermission } from "@/lib/auth";

export const runtime = "nodejs";

type AvailabilityKey = "available" | "on_demand" | "want_to_buy";

type LeanProduct = {
  category?: string;
  sku?: string;
  images?: string[];
  thumbnailUrl?: string;
  quickUrl?: string;
  availability?: string;
};

type AvailabilityBucket = {
  total: number;
  withImages: number;
  withoutImages: number;
  missingSkus: string[];
};

type CategoryBucket = {
  category: string;
  totalProducts: number;
  withImages: number;
  withoutImages: number;
  availability: Record<AvailabilityKey, AvailabilityBucket>;
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function uniqueStrings(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of arr) {
    const v = safeStr(item);
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }

  return out;
}

function slugifyFileName(input: string) {
  return safeStr(input)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeAvailabilityValue(input: any): AvailabilityKey {
  const av = String(input || "").trim().toLowerCase();

  if (av === "coming_soon" || av === "comingsoon" || av === "coming-soon") {
    return "on_demand";
  }

  if (av === "out_of_stock" || av === "outofstock" || av === "out-of-stock") {
    return "want_to_buy";
  }

  if (av === "on_demand" || av === "on demand" || av === "ondemand" || av === "on-demand") {
    return "on_demand";
  }

  if (av === "want_to_buy" || av === "want to buy" || av === "wanttobuy" || av === "want-to-buy") {
    return "want_to_buy";
  }

  return "available";
}

function makeAvailabilityBucket(): AvailabilityBucket {
  return {
    total: 0,
    withImages: 0,
    withoutImages: 0,
    missingSkus: [],
  };
}

function makeCategoryBucket(category: string): CategoryBucket {
  return {
    category,
    totalProducts: 0,
    withImages: 0,
    withoutImages: 0,
    availability: {
      available: makeAvailabilityBucket(),
      on_demand: makeAvailabilityBucket(),
      want_to_buy: makeAvailabilityBucket(),
    },
  };
}

function hasAttachedImages(product: LeanProduct) {
  const images = Array.isArray(product?.images)
    ? product.images.map((x) => safeStr(x)).filter(Boolean)
    : [];

  const thumbnailUrl = safeStr(product?.thumbnailUrl);
  const quickUrl = safeStr(product?.quickUrl);

  return images.length > 0 || Boolean(thumbnailUrl) || Boolean(quickUrl);
}

function makeSkuSheetRows(skus: string[]) {
  return [["SKU"], ...skus.map((sku) => [sku])];
}

function getAvailabilityLabel(key: AvailabilityKey) {
  if (key === "available") return "available";
  if (key === "on_demand") return "on-demand";
  return "want-to-buy";
}

function createExcelBytesFromSkus(skus: string[]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(makeSkuSheetRows(skus)),
    "Missing SKU"
  );

  const base64 = XLSX.write(workbook, {
    type: "base64",
    bookType: "xlsx",
  }) as string;

  const nodeBuffer = Buffer.from(base64, "base64");
  const bytes = Uint8Array.from(Array.from(nodeBuffer));

  return bytes;
}

async function buildReport() {
  await dbConnect();

  const products = (await Product.find({ deletedAt: null })
    .select("category sku images thumbnailUrl quickUrl availability")
    .lean()) as LeanProduct[];

  const categoryMap = new Map<string, CategoryBucket>();

  const summary = {
    totalProducts: 0,
    productsWithImages: 0,
    productsWithoutImages: 0,
    totalCategories: 0,
    availability: {
      available: makeAvailabilityBucket(),
      on_demand: makeAvailabilityBucket(),
      want_to_buy: makeAvailabilityBucket(),
    } as Record<AvailabilityKey, AvailabilityBucket>,
  };

  for (const product of products) {
    const category = safeStr(product?.category) || "Uncategorized";
    const sku = safeStr(product?.sku);
    const availability = normalizeAvailabilityValue(product?.availability);
    const imageExists = hasAttachedImages(product);

    if (!categoryMap.has(category)) {
      categoryMap.set(category, makeCategoryBucket(category));
    }

    const categoryRow = categoryMap.get(category)!;
    const categoryAvailabilityRow = categoryRow.availability[availability];
    const summaryAvailabilityRow = summary.availability[availability];

    categoryRow.totalProducts += 1;
    categoryAvailabilityRow.total += 1;

    summary.totalProducts += 1;
    summaryAvailabilityRow.total += 1;

    if (imageExists) {
      categoryRow.withImages += 1;
      categoryAvailabilityRow.withImages += 1;

      summary.productsWithImages += 1;
      summaryAvailabilityRow.withImages += 1;
    } else {
      categoryRow.withoutImages += 1;
      categoryAvailabilityRow.withoutImages += 1;

      summary.productsWithoutImages += 1;
      summaryAvailabilityRow.withoutImages += 1;

      if (sku) {
        categoryAvailabilityRow.missingSkus.push(sku);
        summaryAvailabilityRow.missingSkus.push(sku);
      }
    }
  }

  const categories = Array.from(categoryMap.values())
    .map((row) => ({
      ...row,
      availability: {
        available: {
          ...row.availability.available,
          missingSkus: uniqueStrings(row.availability.available.missingSkus).sort((a, b) =>
            a.localeCompare(b)
          ),
        },
        on_demand: {
          ...row.availability.on_demand,
          missingSkus: uniqueStrings(row.availability.on_demand.missingSkus).sort((a, b) =>
            a.localeCompare(b)
          ),
        },
        want_to_buy: {
          ...row.availability.want_to_buy,
          missingSkus: uniqueStrings(row.availability.want_to_buy.missingSkus).sort((a, b) =>
            a.localeCompare(b)
          ),
        },
      },
    }))
    .sort((a, b) => a.category.localeCompare(b.category, "en", { sensitivity: "base" }));

  summary.totalCategories = categories.length;

  summary.availability.available.missingSkus = uniqueStrings(
    summary.availability.available.missingSkus
  ).sort((a, b) => a.localeCompare(b));

  summary.availability.on_demand.missingSkus = uniqueStrings(
    summary.availability.on_demand.missingSkus
  ).sort((a, b) => a.localeCompare(b));

  summary.availability.want_to_buy.missingSkus = uniqueStrings(
    summary.availability.want_to_buy.missingSkus
  ).sort((a, b) => a.localeCompare(b));

  return {
    summary,
    categories,
  };
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!hasPermission(user, "products:read") && !hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden (products permission missing)" }, { status: 403 });
  }

  const url = new URL(req.url);
  const shouldDownload = url.searchParams.get("download") === "1";
  const requestedCategory = safeStr(url.searchParams.get("category"));
  const requestedAvailability = safeStr(url.searchParams.get("availability")) as AvailabilityKey;

  const report = await buildReport();

  if (shouldDownload) {
    if (!requestedCategory) {
      return NextResponse.json({ error: "Category required for download" }, { status: 400 });
    }

    if (!["available", "on_demand", "want_to_buy"].includes(requestedAvailability)) {
      return NextResponse.json(
        { error: "availability must be available, on_demand or want_to_buy" },
        { status: 400 }
      );
    }

    const categoryRow = report.categories.find((item) => item.category === requestedCategory);

    if (!categoryRow) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const missingSkus = categoryRow.availability[requestedAvailability].missingSkus;
    const bytes = createExcelBytesFromSkus(missingSkus);

    const fileName = `missing-product-images-${slugifyFileName(requestedCategory) || "category"}-${getAvailabilityLabel(requestedAvailability)}.xlsx`;

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json(
    {
      ok: true,
      summary: {
        totalProducts: report.summary.totalProducts,
        productsWithImages: report.summary.productsWithImages,
        productsWithoutImages: report.summary.productsWithoutImages,
        totalCategories: report.summary.totalCategories,
        availability: {
          available: {
            total: report.summary.availability.available.total,
            withImages: report.summary.availability.available.withImages,
            withoutImages: report.summary.availability.available.withoutImages,
          },
          on_demand: {
            total: report.summary.availability.on_demand.total,
            withImages: report.summary.availability.on_demand.withImages,
            withoutImages: report.summary.availability.on_demand.withoutImages,
          },
          want_to_buy: {
            total: report.summary.availability.want_to_buy.total,
            withImages: report.summary.availability.want_to_buy.withImages,
            withoutImages: report.summary.availability.want_to_buy.withoutImages,
          },
        },
      },
      categories: report.categories.map((row) => ({
        category: row.category,
        totalProducts: row.totalProducts,
        withImages: row.withImages,
        withoutImages: row.withoutImages,
        availability: {
          available: {
            total: row.availability.available.total,
            withImages: row.availability.available.withImages,
            withoutImages: row.availability.available.withoutImages,
          },
          on_demand: {
            total: row.availability.on_demand.total,
            withImages: row.availability.on_demand.withImages,
            withoutImages: row.availability.on_demand.withoutImages,
          },
          want_to_buy: {
            total: row.availability.want_to_buy.total,
            withImages: row.availability.want_to_buy.withImages,
            withoutImages: row.availability.want_to_buy.withoutImages,
          },
        },
      })),
      imageDetectionRule:
        "Product ko image-attached tab maana gaya hai jab images array me image ho ya thumbnailUrl/quickUrl available ho.",
      availabilityRule:
        "Availability breakdown me available, on_demand aur want_to_buy tino states alag-alag category wise count ki gayi hain.",
      downloadRule:
        "Har category me available, on_demand aur want_to_buy ke missing-image SKU lists alag-alag Excel download hongi.",
    },
    { status: 200 }
  );
}