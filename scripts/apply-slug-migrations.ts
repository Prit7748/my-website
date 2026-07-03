import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { productHref } from "../lib/productHref";
import {
  invalidateRedirectionCache,
  isBlockedFromPath,
  normalizeFromPath,
  normalizeToPath,
} from "../lib/redirections";

const SUGGESTIONS_PATH = join(process.cwd(), "data", "slug-suggestions.json");
const REPORT_PATH = join(process.cwd(), "data", "slug-migration-report.json");
const MIGRATION_NOTE = "slug-migration-2026";
const BATCH_SIZE = 500;

type SuggestionRow = {
  title: string;
  category: string;
  currentSlug: string;
  suggestedSlug: string;
};

type SuggestionsFile = {
  total: number;
  suggestions: SuggestionRow[];
};

type RowStatus =
  | "ok"
  | "skipped_already_migrated"
  | "skipped_redirect_exists"
  | "not_found"
  | "conflict_slug_taken"
  | "conflict_same_slug"
  | "validation_error"
  | "error";

type ReportRow = {
  title: string;
  category: string;
  currentSlug: string;
  suggestedSlug: string;
  fromPath: string;
  toPath: string;
  status: RowStatus;
  message?: string;
  productId?: string;
};

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
    // optional
  }
}

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function parseFlag(argv: string[], name: string) {
  const prefix = `--${name}=`;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === `--${name}`) return Number(argv[i + 1] || 0);
    if (arg.startsWith(prefix)) return Number(arg.slice(prefix.length) || 0);
  }
  return 0;
}

function parseArgs(argv: string[]) {
  return {
    dryRun: argv.includes("--dry-run"),
    limit: parseFlag(argv, "limit"),
    skip: parseFlag(argv, "skip"),
  };
}

function buildPaths(row: SuggestionRow) {
  const fromPath = productHref({ slug: row.currentSlug, category: row.category });
  const toPath = productHref({ slug: row.suggestedSlug, category: row.category });
  return { fromPath, toPath };
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const args = parseArgs(process.argv.slice(2));

  if (!existsSync(SUGGESTIONS_PATH)) {
    console.error(`Missing ${SUGGESTIONS_PATH}`);
    console.error("Run: npm run analyze-long-urls");
    process.exit(1);
  }

  const suggestionsFile = JSON.parse(
    readFileSync(SUGGESTIONS_PATH, "utf8")
  ) as SuggestionsFile;

  const allRows = Array.isArray(suggestionsFile.suggestions)
    ? suggestionsFile.suggestions
    : [];

  const sliceEnd = args.limit > 0 ? args.skip + args.limit : undefined;
  const rows = allRows.slice(args.skip, sliceEnd);

  if (!rows.length) {
    console.error("No rows to process. Check --skip / --limit values.");
    process.exit(1);
  }

  const { default: dbConnect } = await import("../lib/db");
  const { default: Product } = await import("../models/Product");
  const { default: Redirection } = await import("../models/Redirection");

  await dbConnect();

  const currentSlugs = [...new Set(rows.map((row) => safeStr(row.currentSlug)).filter(Boolean))];
  const suggestedSlugs = [...new Set(rows.map((row) => safeStr(row.suggestedSlug)).filter(Boolean))];
  const fromPaths = [
    ...new Set(
      rows.map((row) => normalizeFromPath(buildPaths(row).fromPath)).filter(Boolean)
    ),
  ];

  const [productsByCurrentSlug, productsBySuggestedSlug, redirectsByFromPath] =
    await Promise.all([
      Product.find({ slug: { $in: currentSlugs } })
        .select("_id slug category title")
        .lean()
        .then((docs) => {
          const map = new Map<string, any>();
          for (const doc of docs || []) map.set(safeStr(doc.slug), doc);
          return map;
        }),
      Product.find({ slug: { $in: suggestedSlugs } })
        .select("_id slug title")
        .lean()
        .then((docs) => {
          const map = new Map<string, any>();
          for (const doc of docs || []) map.set(safeStr(doc.slug), doc);
          return map;
        }),
      Redirection.find({ fromPath: { $in: fromPaths } })
        .select("fromPath toPath note isActive")
        .lean()
        .then((docs) => {
          const map = new Map<string, any>();
          for (const doc of docs || []) {
            map.set(normalizeFromPath(safeStr(doc.fromPath)), doc);
          }
          return map;
        }),
    ]);

  const reportRows: ReportRow[] = [];
  const okRows: Array<ReportRow & { productId: string }> = [];

  const summary: Record<RowStatus, number> = {
    ok: 0,
    skipped_already_migrated: 0,
    skipped_redirect_exists: 0,
    not_found: 0,
    conflict_slug_taken: 0,
    conflict_same_slug: 0,
    validation_error: 0,
    error: 0,
  };

  console.log(
    `${args.dryRun ? "[DRY RUN] " : ""}Processing ${rows.length} rows` +
      (args.skip ? ` (skip=${args.skip})` : "") +
      (args.limit ? ` (limit=${args.limit})` : "")
  );

  for (const row of rows) {
    const currentSlug = safeStr(row.currentSlug);
    const suggestedSlug = safeStr(row.suggestedSlug);
    const category = safeStr(row.category);
    const { fromPath, toPath } = buildPaths(row);

    const base: ReportRow = {
      title: safeStr(row.title),
      category,
      currentSlug,
      suggestedSlug,
      fromPath,
      toPath,
      status: "error",
    };

    if (!currentSlug || !suggestedSlug || !category) {
      base.status = "validation_error";
      base.message = "Missing currentSlug, suggestedSlug, or category";
      summary[base.status] += 1;
      reportRows.push(base);
      continue;
    }

    if (currentSlug === suggestedSlug) {
      base.status = "conflict_same_slug";
      base.message = "Current and suggested slug are identical";
      summary[base.status] += 1;
      reportRows.push(base);
      continue;
    }

    const product = productsByCurrentSlug.get(currentSlug);

    if (!product) {
      const alreadyNew = productsBySuggestedSlug.get(suggestedSlug);

      if (alreadyNew) {
        base.status = "skipped_already_migrated";
        base.message = "Product already uses suggested slug";
        base.productId = String(alreadyNew._id);
        summary[base.status] += 1;
        reportRows.push(base);
        continue;
      }

      base.status = "not_found";
      base.message = "No product found with current slug";
      summary[base.status] += 1;
      reportRows.push(base);
      continue;
    }

    const productId = String(product._id);

    if (safeStr(product.slug) === suggestedSlug) {
      base.status = "skipped_already_migrated";
      base.message = "Product already migrated";
      base.productId = productId;
      summary[base.status] += 1;
      reportRows.push(base);
      continue;
    }

    const slugConflict = productsBySuggestedSlug.get(suggestedSlug);
    if (slugConflict && String(slugConflict._id) !== productId) {
      base.status = "conflict_slug_taken";
      base.message = `Suggested slug already used by ${slugConflict._id}`;
      base.productId = productId;
      summary[base.status] += 1;
      reportRows.push(base);
      continue;
    }

    const normalizedFrom = normalizeFromPath(fromPath);
    const existingRedirect = redirectsByFromPath.get(normalizedFrom);

    if (existingRedirect) {
      const existingTo = normalizeFromPath(safeStr(existingRedirect.toPath));
      const expectedTo = normalizeFromPath(toPath);

      if (existingTo === expectedTo) {
        base.status = "skipped_redirect_exists";
        base.message = "Matching redirect already exists";
        base.productId = productId;
        summary[base.status] += 1;
        reportRows.push(base);
        continue;
      }

      base.status = "validation_error";
      base.message = `Redirect exists for fromPath but points elsewhere: ${existingTo}`;
      base.productId = productId;
      summary[base.status] += 1;
      reportRows.push(base);
      continue;
    }

    const normalizedTo = normalizeFromPath(toPath);

    if (!normalizedFrom || !normalizeToPath(toPath)) {
      base.status = "validation_error";
      base.message = "Invalid fromPath or toPath";
      base.productId = productId;
      summary[base.status] += 1;
      reportRows.push(base);
      continue;
    }

    if (isBlockedFromPath(normalizedFrom)) {
      base.status = "validation_error";
      base.message = "fromPath targets a blocked route";
      base.productId = productId;
      summary[base.status] += 1;
      reportRows.push(base);
      continue;
    }

    if (normalizedFrom === normalizedTo) {
      base.status = "validation_error";
      base.message = "fromPath and toPath are the same";
      base.productId = productId;
      summary[base.status] += 1;
      reportRows.push(base);
      continue;
    }

    base.status = "ok";
    base.productId = productId;
    summary.ok += 1;
    reportRows.push(base);
    okRows.push({ ...base, productId });
  }

  let appliedProducts = 0;
  let appliedRedirects = 0;

  if (!args.dryRun && okRows.length > 0) {
    for (let i = 0; i < okRows.length; i += BATCH_SIZE) {
      const batch = okRows.slice(i, i + BATCH_SIZE);

      const productOps = batch.map((row) => ({
        updateOne: {
          filter: { _id: row.productId, slug: row.currentSlug },
          update: { $set: { slug: row.suggestedSlug } },
        },
      }));

      const productResult = await Product.bulkWrite(productOps, { ordered: false });
      appliedProducts += productResult.modifiedCount || 0;

      const redirectDocs = batch.map((row) => ({
        fromPath: normalizeFromPath(row.fromPath),
        toPath: row.toPath,
        statusCode: 301 as const,
        isActive: true,
        note: MIGRATION_NOTE,
      }));

      try {
        const redirectResult = await Redirection.insertMany(redirectDocs, {
          ordered: false,
        });
        appliedRedirects += redirectResult.length;
      } catch (error: any) {
        if (error?.writeErrors?.length) {
          appliedRedirects += redirectDocs.length - error.writeErrors.length;
          console.warn(
            `Batch ${i / BATCH_SIZE + 1}: ${error.writeErrors.length} redirect insert errors`
          );
        } else {
          throw error;
        }
      }

      console.log(
        `Batch ${Math.floor(i / BATCH_SIZE) + 1}: updated ${productResult.modifiedCount || 0} products`
      );
    }

    invalidateRedirectionCache();
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: args.dryRun ? "dry-run" : "apply",
    sourceFile: "data/slug-suggestions.json",
    processed: rows.length,
    skip: args.skip,
    limit: args.limit || null,
    summary,
    applied: args.dryRun
      ? { products: 0, redirects: 0, ready: okRows.length }
      : { products: appliedProducts, redirects: appliedRedirects },
    failures: reportRows.filter(
      (row) => row.status !== "ok" && !row.status.startsWith("skipped")
    ),
    rows: reportRows,
  };

  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");

  console.log("");
  console.log("Summary:");
  for (const [status, count] of Object.entries(summary)) {
    if (count > 0) console.log(`  ${status}: ${count}`);
  }
  console.log("");
  if (args.dryRun) {
    console.log(`Ready to apply: ${okRows.length}`);
    console.log("No database changes were made.");
  } else {
    console.log(`Products updated: ${appliedProducts}`);
    console.log(`Redirects created: ${appliedRedirects}`);
  }
  console.log(`Report written to ${REPORT_PATH}`);

  process.exit(summary.conflict_slug_taken > 0 || summary.not_found > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Slug migration failed:", error);
  process.exit(1);
});
