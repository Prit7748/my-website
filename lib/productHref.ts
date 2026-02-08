// ✅ FILE: lib/productHref.ts
// (Complete replace)

const CATEGORY_TO_SLUG: Record<string, string> = {
  // ✅ exact DB labels (recommended)
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
  "Projects": "projects",
  "Combo": "combo",
};

function normalizeCategory(input: string) {
  return (input || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\//g, " ")
    .replace(/\(|\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugifyCategory(input: string) {
  const raw = (input || "").trim();

  // ✅ if already a slug (like "solved-assignments") keep it
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(raw.toLowerCase())) {
    return raw.toLowerCase();
  }

  // ✅ direct match with DB labels
  if (CATEGORY_TO_SLUG[raw]) return CATEGORY_TO_SLUG[raw];

  // ✅ normalized match (covers: "Handwritten Hardcopy Delivery", "handwritten hardcopy (delivery)" etc.)
  const n = normalizeCategory(raw);
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
  };

  if (normalizedMap[n]) return normalizedMap[n];

  // ✅ fallback: slugify (but avoid random wrong slugs when category missing)
  return n
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function productHref(p: { slug?: string; category?: string }) {
  const prodSlug = (p.slug || "").trim();
  const cat = (p.category || "").trim();

  // ✅ if slug missing, safe fallback
  if (!prodSlug) return "/products";

  // ✅ if category missing/unknown => send to /products/:slug (your redirect page should handle it)
  const catSlug = slugifyCategory(cat);
  if (!catSlug) return `/products/${prodSlug}`;

  return `/${catSlug}/${prodSlug}`;
}
