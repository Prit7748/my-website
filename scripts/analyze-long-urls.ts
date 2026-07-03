import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { productHref, slugifyCategory } from "../lib/productHref";

const INPUT_PATH = join(process.cwd(), "data", "product-urls.json");
const OUTPUT_PATH = join(process.cwd(), "data", "long-url-analysis.json");
const SLUG_SUGGESTIONS_PATH = join(process.cwd(), "data", "slug-suggestions.json");
const MAX_URL_LENGTH = 70;

type ProductEntry = {
  id: string;
  slug: string;
  sku: string;
  title: string;
  category: string;
  path: string;
  url: string;
};

type ProductUrlsFile = {
  baseUrl: string;
  total: number;
  products: ProductEntry[];
};

const MONTHS: Record<string, string> = {
  january: "jan",
  february: "feb",
  march: "mar",
  april: "apr",
  may: "may",
  june: "jun",
  july: "jul",
  august: "aug",
  september: "sep",
  october: "oct",
  november: "nov",
  december: "dec",
};

const CATEGORY_KEYWORD: Record<string, string> = {
  "Guess Papers": "guess-paper",
  "Solved Assignments": "solved-assignment",
  "Question Papers (PYQ)": "pyq",
  "Question Papers": "pyq",
  "Handwritten Hardcopy (Delivery)": "hardcopy",
  "Handwritten Hardcopy": "hardcopy",
  "Handwritten PDFs": "hw-pdf",
  "eBooks/Notes": "ebook",
  "Ebooks/Notes": "ebook",
  "Projects & Synopsis": "project",
  "Combo": "combo",
};

const ABBREVIATIONS: [RegExp, string][] = [
  [/solved-assignment/g, "assignment"],
  [/solved-previous-year-paper/g, "pyq"],
  [/previous-year-paper/g, "pyq"],
  [/guess-paper/g, "guess"],
  [/handwritten-hardcopy-delivery/g, "hardcopy"],
  [/handwritten-hardcopy/g, "hardcopy"],
  [/handwritten-pdf/g, "hw-pdf"],
  [/english-medium/g, "english"],
  [/hindi-medium/g, "hindi"],
  [/sanskrit-medium/g, "sanskrit"],
  [/urdu-medium/g, "urdu"],
  [/english/g, "eng"],
  [/hindi/g, "hin"],
  [/sanskrit/g, "san"],
  [/urdu/g, "urd"],
  [/assignment/g, "asgn"],
  [/delivery/g, "del"],
  [/december/g, "dec"],
  [/november/g, "nov"],
  [/october/g, "oct"],
  [/september/g, "sep"],
  [/august/g, "aug"],
  [/february/g, "feb"],
];

function slugify(input: string) {
  return String(input ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function absUrl(baseUrl: string, path: string) {
  const clean = String(path ?? "").trim();
  if (!clean || clean === "/") return `${baseUrl}/`;
  return `${baseUrl}${clean.startsWith("/") ? clean : `/${clean}`}`;
}

function extractSubjectCode(title: string, sku: string) {
  const titleMatch = title.match(/\bignou\s+([a-z]{2,8})\s*(\d{1,3})?\b/i);
  if (titleMatch) {
    const letters = titleMatch[1].toLowerCase();
    const digits = titleMatch[2];
    return digits ? `${letters}-${digits}` : letters;
  }

  const skuMatch = sku.match(/^([A-Z]{2,8})(\d{1,3})/i);
  if (skuMatch) {
    const letters = skuMatch[1].toLowerCase();
    const digits = skuMatch[2];
    return digits ? `${letters}-${digits}` : letters;
  }

  return "";
}

function extractMediumFromSku(sku: string) {
  const s = sku.toUpperCase();
  if (/HIN(?:DEC|G|D|Q|P|\d)|HING/.test(s)) return "hindi";
  if (/ENG(?:DEC|G|D|Q|P|\d)|ENGG/.test(s)) return "english";
  if (/SAN(?:DEC|G|D|Q|P|\d)/.test(s)) return "sanskrit";
  if (/URD(?:DEC|G|D|Q|P|\d)/.test(s)) return "urdu";
  return "";
}

function extractMedium(title: string, slug: string, sku = "") {
  const fromSku = extractMediumFromSku(sku);
  if (fromSku) return fromSku;

  const titleLower = title.toLowerCase();
  if (/\bhindi\s+medium\b|\(hindi\s+medium\)/i.test(titleLower)) return "hindi";
  if (/\benglish\s+medium\b|\(english\s+medium\)/i.test(titleLower)) return "english";
  if (/\bsanskrit\s+medium\b/i.test(titleLower)) return "sanskrit";
  if (/\burdu\s+medium\b/i.test(titleLower)) return "urdu";

  const slugLower = slug.toLowerCase();
  if (/(?:^|-)hindi(?:-|$)|(?:^|-)hin(?:-|$)|hing$|hindec/i.test(slugLower)) {
    return "hindi";
  }
  if (/(?:^|-)english(?:-|$)|(?:^|-)eng(?:-|$)|engg$|engdec/i.test(slugLower)) {
    return "english";
  }
  if (/(?:^|-)sanskrit(?:-|$)|(?:^|-)san(?:-|$)/i.test(slugLower)) return "sanskrit";
  if (/(?:^|-)urdu(?:-|$)|(?:^|-)urd(?:-|$)/i.test(slugLower)) return "urdu";

  return "";
}

function skuSlugSuffix(sku: string) {
  const raw = sku.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!raw) return "";

  const beforeYear = raw.match(/^([a-z]+\d+[a-z0-9]*?)(?=20\d{2}|$)/);
  if (beforeYear?.[1] && beforeYear[1].length >= 5) {
    return compactSlug(beforeYear[1]);
  }

  return raw.length <= 20 ? raw : raw.slice(0, 20);
}

function extractSession(title: string, slug: string) {
  const hay = `${title} ${slug}`;

  const sessionRange = hay.match(/\b(20\d{2})[-/](\d{2})\b/);
  if (sessionRange) return `${sessionRange[1]}-${sessionRange[2]}`;

  const monthYear = hay.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d{2})\b/i
  );
  if (monthYear) {
    const month = MONTHS[monthYear[1].toLowerCase()] || monthYear[1].slice(0, 3).toLowerCase();
    return `${month}-${monthYear[2]}`;
  }

  const yearOnly = hay.match(/\b(20\d{2})\b/);
  if (yearOnly) return yearOnly[1];

  return "";
}

function extractTitleKeywords(title: string) {
  return title
    .toLowerCase()
    .replace(/[|–—]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 1 &&
        ![
          "ignou",
          "the",
          "for",
          "and",
          "of",
          "on",
          "in",
          "a",
          "an",
          "to",
          "with",
          "latest",
          "pdf",
          "medium",
          "students",
          "portal",
          "course",
        ].includes(word)
    );
}

function compactSlug(slug: string) {
  let out = slug;
  for (const [pattern, replacement] of ABBREVIATIONS) {
    out = out.replace(pattern, replacement);
  }
  return out.replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function trimSlugToLength(slug: string, maxLen: number) {
  if (slug.length <= maxLen) return slug;

  const parts = slug.split("-").filter(Boolean);
  while (parts.length > 2 && parts.join("-").length > maxLen) {
    parts.pop();
  }

  let trimmed = parts.join("-");
  if (trimmed.length <= maxLen) return trimmed;

  return trimmed.slice(0, maxLen).replace(/-+$/g, "");
}

function buildSlugWithRequiredSuffix(
  prefixParts: string[],
  suffix: string,
  maxLen: number
) {
  const suffixClean = compactSlug(suffix);
  if (!suffixClean) {
    return trimSlugToLength(compactSlug(prefixParts.join("-")), maxLen);
  }

  const reserved = suffixClean.length + 1;
  const maxPrefixLen = Math.max(6, maxLen - reserved);
  let prefix = compactSlug(prefixParts.join("-"));

  if (prefix.length > maxPrefixLen) {
    prefix = trimSlugToLength(prefix, maxPrefixLen);
  }

  let combined = `${prefix}-${suffixClean}`.replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (combined.length <= maxLen) return combined;

  prefix = trimSlugToLength(prefix, Math.max(4, maxLen - reserved));
  combined = `${prefix}-${suffixClean}`.replace(/-+/g, "-").replace(/^-|-$/g, "");
  return combined.length <= maxLen
    ? combined
    : combined.slice(0, maxLen).replace(/-+$/g, "");
}

function maxSlugLenForProduct(product: ProductEntry, baseUrl: string) {
  const categorySlug = slugifyCategory(product.category);
  const prefixLen = `${baseUrl}/${categorySlug}/`.length;
  return Math.max(12, MAX_URL_LENGTH - prefixLen);
}

function suggestAlternateSlug(product: ProductEntry, baseUrl: string) {
  const maxSlugLen = maxSlugLenForProduct(product, baseUrl);

  const subjectCode = extractSubjectCode(product.title, product.sku);
  const medium = extractMedium(product.title, product.slug, product.sku);
  const session = extractSession(product.title, product.slug);
  const categoryKeyword = CATEGORY_KEYWORD[product.category] || slugify(product.category);
  const skuSuffix = skuSlugSuffix(product.sku) || product.id.slice(-8);

  const keywordParts = ["ignou", subjectCode, categoryKeyword, session, medium].filter(Boolean);

  let candidate = buildSlugWithRequiredSuffix(keywordParts, skuSuffix, maxSlugLen);

  const categorySlug = slugifyCategory(product.category);
  if (absUrl(baseUrl, `/${categorySlug}/${candidate}`).length > MAX_URL_LENGTH) {
    const shorterParts = [subjectCode || "ignou", categoryKeyword, medium].filter(Boolean);
    candidate = buildSlugWithRequiredSuffix(shorterParts, skuSuffix, maxSlugLen);
  }

  if (!candidate) {
    candidate = trimSlugToLength(skuSuffix, maxSlugLen);
  }

  const keywordsKept = extractTitleKeywords(product.title).filter((word) =>
    candidate.includes(word.replace(/\s+/g, "-"))
  );

  const impliedKeywords = [subjectCode, categoryKeyword, medium, session, skuSuffix].filter(
    Boolean
  );
  const preservedKeywords = Array.from(new Set([...impliedKeywords, ...keywordsKept]));

  return {
    suggestedSlug: candidate,
    preservedKeywords,
    maxSlugLen,
  };
}

function ensureUniqueSlug(
  baseSlug: string,
  product: ProductEntry,
  maxSlugLen: number,
  used: Set<string>
) {
  if (!used.has(baseSlug)) {
    used.add(baseSlug);
    return baseSlug;
  }

  const discriminators = [
    compactSlug(extractMediumFromSku(product.sku)),
    skuSlugSuffix(product.sku),
    product.sku.toLowerCase(),
    product.id.slice(-8),
  ].filter(Boolean);

  const seenDisc = new Set<string>();
  for (const disc of discriminators) {
    if (seenDisc.has(disc)) continue;
    seenDisc.add(disc);

    const candidate = buildSlugWithRequiredSuffix([baseSlug], disc, maxSlugLen);
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }

  for (let n = 2; n < 10_000; n += 1) {
    const candidate = buildSlugWithRequiredSuffix([baseSlug], String(n), maxSlugLen);
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }

  const fallback = trimSlugToLength(`${baseSlug}-${product.id}`, maxSlugLen);
  used.add(fallback);
  return fallback;
}

function main() {
  const raw = readFileSync(INPUT_PATH, "utf8");
  const data = JSON.parse(raw) as ProductUrlsFile;
  const baseUrl = String(data.baseUrl || "").replace(/\/+$/, "");

  const longUrls = data.products.filter((product) => product.url.length > MAX_URL_LENGTH);

  const usedSlugs = new Set<string>();
  let dedupedCount = 0;

  const results = longUrls.map((product) => {
    const { suggestedSlug: baseSlug, preservedKeywords, maxSlugLen } =
      suggestAlternateSlug(product, baseUrl);
    const suggestedSlug = ensureUniqueSlug(baseSlug, product, maxSlugLen, usedSlugs);
    if (suggestedSlug !== baseSlug) dedupedCount += 1;

    const suggestedPath = productHref({ slug: suggestedSlug, category: product.category });
    const suggestedUrl = absUrl(baseUrl, suggestedPath);
    const savedChars = product.url.length - suggestedUrl.length;

    return {
      id: product.id,
      title: product.title,
      category: product.category,
      sku: product.sku,
      currentUrl: product.url,
      currentLength: product.url.length,
      currentSlug: product.slug,
      suggestedSlug,
      suggestedPath,
      suggestedUrl,
      suggestedLength: suggestedUrl.length,
      underLimit: suggestedUrl.length <= MAX_URL_LENGTH,
      savedChars,
      preservedKeywords,
    };
  });

  const underLimit = results.filter((item) => item.underLimit);
  const stillTooLong = results.filter((item) => !item.underLimit);

  const byCategory: Record<string, { total: number; fixed: number; avgSaved: number }> = {};
  for (const item of results) {
    if (!byCategory[item.category]) {
      byCategory[item.category] = { total: 0, fixed: 0, avgSaved: 0 };
    }
    byCategory[item.category].total += 1;
    if (item.underLimit) byCategory[item.category].fixed += 1;
    byCategory[item.category].avgSaved += item.savedChars;
  }
  for (const stats of Object.values(byCategory)) {
    stats.avgSaved = Number((stats.avgSaved / stats.total).toFixed(1));
  }

  const output = {
    analyzedAt: new Date().toISOString(),
    sourceFile: "data/product-urls.json",
    maxUrlLength: MAX_URL_LENGTH,
    baseUrl,
    summary: {
      totalProducts: data.total,
      overLimit: longUrls.length,
      suggestedUnderLimit: underLimit.length,
      stillOverLimit: stillTooLong.length,
      avgCurrentLength: Number(
        (results.reduce((sum, item) => sum + item.currentLength, 0) / results.length).toFixed(1)
      ),
      avgSuggestedLength: Number(
        (results.reduce((sum, item) => sum + item.suggestedLength, 0) / results.length).toFixed(1)
      ),
      avgCharsSaved: Number(
        (results.reduce((sum, item) => sum + item.savedChars, 0) / results.length).toFixed(1)
      ),
      uniqueSuggestedSlugs: usedSlugs.size,
      dedupedAfterCollision: dedupedCount,
      byCategory,
    },
    samples: {
      fixed: underLimit.slice(0, 5),
      stillTooLong: stillTooLong.slice(0, 5),
    },
    results,
  };

  const slugSuggestions = {
    generatedAt: new Date().toISOString(),
    sourceFile: "data/product-urls.json",
    total: results.length,
    suggestions: results.map((item) => ({
      title: item.title,
      category: item.category,
      currentSlug: item.currentSlug,
      suggestedSlug: item.suggestedSlug,
    })),
  };

  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf8");
  writeFileSync(SLUG_SUGGESTIONS_PATH, JSON.stringify(slugSuggestions, null, 2), "utf8");

  console.log(`Analyzed ${data.total} products from ${INPUT_PATH}`);
  console.log(`URLs over ${MAX_URL_LENGTH} chars: ${longUrls.length}`);
  console.log(`Suggested URLs under ${MAX_URL_LENGTH} chars: ${underLimit.length}`);
  console.log(`Still over limit after suggestion: ${stillTooLong.length}`);
  console.log(`Unique suggested slugs: ${usedSlugs.size}`);
  console.log(`Slugs adjusted for uniqueness: ${dedupedCount}`);
  console.log(`Average current length: ${output.summary.avgCurrentLength}`);
  console.log(`Average suggested length: ${output.summary.avgSuggestedLength}`);
  console.log(`Average chars saved: ${output.summary.avgCharsSaved}`);
  console.log("");
  console.log("By category:");
  for (const [category, stats] of Object.entries(byCategory)) {
    console.log(
      `  ${category}: ${stats.total} long, ${stats.fixed} fixable, avg save ${stats.avgSaved} chars`
    );
  }
  console.log("");
  console.log("Sample suggestions:");
  for (const item of underLimit.slice(0, 3)) {
    console.log(`  Title: ${item.title}`);
    console.log(`  Current (${item.currentLength}): ${item.currentUrl}`);
    console.log(`  Suggested (${item.suggestedLength}): ${item.suggestedUrl}`);
    console.log(`  Keywords kept: ${item.preservedKeywords.join(", ")}`);
    console.log("");
  }
  console.log(`Full report written to ${OUTPUT_PATH}`);
  console.log(`Slug suggestions written to ${SLUG_SUGGESTIONS_PATH}`);
}

main();
