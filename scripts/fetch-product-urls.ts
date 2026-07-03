import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const OUTPUT_PATH = join(process.cwd(), "data", "product-urls.json");

function loadEnvFile(filename: string) {
  try {
    const content = readFileSync(join(process.cwd(), filename), "utf8");

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;

      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env.local is optional when env vars are already set
  }
}

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function absUrl(baseUrl: string, path: string) {
  const clean = safeStr(path);
  if (!clean || clean === "/") return `${baseUrl}/`;
  return `${baseUrl}${clean.startsWith("/") ? clean : `/${clean}`}`;
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const { default: dbConnect } = await import("../lib/db");
  const { default: Product } = await import("../models/Product");
  const { productHref } = await import("../lib/productHref");

  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "https://istudentsportal.com"
  ).replace(/\/+$/, "");

  const dbName = safeStr(process.env.MONGODB_DB) || "ignoucluster";

  await dbConnect();

  const products = await Product.find({
    slug: { $exists: true, $ne: "" },
  })
    .select("_id slug sku category title isActive deletedAt updatedAt createdAt")
    .sort({ category: 1, slug: 1 })
    .lean();

  const items = (products || []).map((product: any) => {
    const slug = safeStr(product.slug);
    const category = safeStr(product.category);
    const path = productHref({ slug, category });

    return {
      id: String(product._id),
      slug,
      sku: safeStr(product.sku),
      title: safeStr(product.title),
      category,
      path,
      url: absUrl(baseUrl, path),
      isActive: Boolean(product.isActive),
      deletedAt: product.deletedAt ? new Date(product.deletedAt).toISOString() : null,
      updatedAt: product.updatedAt
        ? new Date(product.updatedAt).toISOString()
        : null,
    };
  });

  const output = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    database: dbName,
    total: items.length,
    products: items,
  };

  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf8");

  console.log(`Connected to database: ${dbName}`);
  console.log(`Wrote ${items.length} product URLs to ${OUTPUT_PATH}`);
  process.exit(0);
}

main().catch((error) => {
  console.error("Failed to fetch product URLs:", error);
  process.exit(1);
});
