import { revalidatePath } from "next/cache";
import { productHref } from "@/lib/productHref";

type ProductRevalidationInput = {
  slug?: string;
  category?: string;
};

type BulkProductRevalidationInput = {
  products?: Array<ProductRevalidationInput | null | undefined>;
  previousProducts?: Array<ProductRevalidationInput | null | undefined>;
  includeGlobalPages?: boolean;
  maxProductPaths?: number;
};

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function uniqueValues(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.map((x) => safeStr(x)).filter(Boolean)));
}

function firstPathSegment(path: string) {
  const clean = safeStr(path).replace(/^\/+/, "");
  return clean.split("/")[0] || "";
}

function safeRevalidatePath(path: string) {
  const clean = safeStr(path);
  if (!clean || !clean.startsWith("/")) return;

  try {
    revalidatePath(clean);
  } catch (err) {
    console.error("[productRevalidation] Failed:", clean, err);
  }
}

function collectProductPaths(product?: ProductRevalidationInput | null) {
  const slug = safeStr(product?.slug);
  const category = safeStr(product?.category);

  if (!slug || !category) return [];

  const canonicalPath = productHref({ slug, category });
  const categorySegment = firstPathSegment(canonicalPath);
  const categoryPath = categorySegment ? `/${categorySegment}` : "";

  return uniqueValues([canonicalPath, categoryPath]);
}

function collectProductDetailPaths(product?: ProductRevalidationInput | null) {
  const slug = safeStr(product?.slug);
  const category = safeStr(product?.category);

  if (!slug || !category) return [];

  const canonicalPath = productHref({ slug, category });
  if (!canonicalPath || canonicalPath === "/products") return [];
  if (!canonicalPath.startsWith("/")) return [];

  return [canonicalPath];
}

function collectCategoryPaths(product?: ProductRevalidationInput | null) {
  const slug = safeStr(product?.slug);
  const category = safeStr(product?.category);

  if (!slug || !category) return [];

  const canonicalPath = productHref({ slug, category });
  const categorySegment = firstPathSegment(canonicalPath);
  const categoryPath = categorySegment ? `/${categorySegment}` : "";

  return categoryPath ? [categoryPath] : [];
}

export function revalidateProductCache(options: {
  product?: ProductRevalidationInput | null;
  previousProduct?: ProductRevalidationInput | null;
  includeGlobalPages?: boolean;
}) {
  const includeGlobalPages = options.includeGlobalPages ?? true;

  const paths = uniqueValues([
    ...collectProductPaths(options.product),
    ...collectProductPaths(options.previousProduct),

    includeGlobalPages ? "/" : "",
    includeGlobalPages ? "/products" : "",
    includeGlobalPages ? "/sitemap.xml" : "",
  ]);

  for (const path of paths) {
    safeRevalidatePath(path);
  }

  return {
    ok: true,
    revalidatedPaths: paths,
    revalidatedCount: paths.length,
  };
}

export function revalidateBulkProductCache(options: BulkProductRevalidationInput) {
  const includeGlobalPages = options.includeGlobalPages ?? true;
  const maxProductPaths = Math.max(0, Number(options.maxProductPaths ?? 500));

  const products = Array.isArray(options.products) ? options.products : [];
  const previousProducts = Array.isArray(options.previousProducts)
    ? options.previousProducts
    : [];

  const allProducts = [...products, ...previousProducts];

  const productDetailPaths = uniqueValues(
    allProducts.flatMap((product) => collectProductDetailPaths(product))
  ).slice(0, maxProductPaths);

  const categoryPaths = uniqueValues(
    allProducts.flatMap((product) => collectCategoryPaths(product))
  );

  const globalPaths = includeGlobalPages ? ["/", "/products", "/sitemap.xml"] : [];

  const paths = uniqueValues([...productDetailPaths, ...categoryPaths, ...globalPaths]);

  for (const path of paths) {
    safeRevalidatePath(path);
  }

  return {
    ok: true,
    revalidatedPaths: paths,
    revalidatedCount: paths.length,
    productDetailPathCount: productDetailPaths.length,
    categoryPathCount: categoryPaths.length,
    globalPathCount: globalPaths.length,
    cappedProductPaths: productDetailPaths.length >= maxProductPaths,
  };
}