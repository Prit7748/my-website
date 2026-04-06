export type ProductHrefInput = {
  slug?: string;
  category?: string;
  categorySlug?: string;
  href?: string;
};

function safeText(input: unknown) {
  return String(input ?? "").trim();
}

const CATEGORY_TO_SLUG: Record<string, string> = {
  "Solved Assignments": "solved-assignments",
  "Handwritten PDFs": "handwritten-pdfs",
  "Handwritten Hardcopy (Delivery)": "handwritten-hardcopy",
  "Handwritten Hardcopy": "handwritten-hardcopy",
  "Question Papers (PYQ)": "question-papers",
  "Question Papers": "question-papers",
  "Guess Papers": "guess-papers",
  "eBooks/Notes": "ebooks",
  "Ebooks/Notes": "ebooks",
  "eBooks": "ebooks",
  "Ebooks": "ebooks",
  "Projects & Synopsis": "projects",
  Projects: "projects",
  Combo: "combo",
  Products: "products",
};

function normalizeCategory(input: string) {
  return safeText(input)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\//g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugifyCategory(input: string) {
  const raw = safeText(input);

  if (!raw) return "";

  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(raw)) {
    return raw.toLowerCase();
  }

  if (CATEGORY_TO_SLUG[raw]) {
    return CATEGORY_TO_SLUG[raw];
  }

  const normalized = normalizeCategory(raw);

  const normalizedMap: Record<string, string> = {
    "solved assignments": "solved-assignments",
    "handwritten pdfs": "handwritten-pdfs",
    "handwritten hardcopy delivery": "handwritten-hardcopy",
    "handwritten hardcopy": "handwritten-hardcopy",
    "question papers pyq": "question-papers",
    "question papers": "question-papers",
    "guess papers": "guess-papers",
    "ebooks notes": "ebooks",
    "ebooks": "ebooks",
    "projects synopsis": "projects",
    "projects": "projects",
    "combo": "combo",
    "products": "products",
  };

  if (normalizedMap[normalized]) {
    return normalizedMap[normalized];
  }

  return normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function productHref(input: ProductHrefInput) {
  const explicitHref = safeText(input?.href);
  if (explicitHref.startsWith("/")) {
    return explicitHref;
  }

  const slug = safeText(input?.slug);
  if (!slug) return "/products";

  const directCategorySlug = safeText(input?.categorySlug);
  const resolvedCategorySlug = directCategorySlug || slugifyCategory(safeText(input?.category));

  if (!resolvedCategorySlug) {
    return `/products/${encodeURIComponent(slug)}`;
  }

  return `/${resolvedCategorySlug}/${encodeURIComponent(slug)}`;
}