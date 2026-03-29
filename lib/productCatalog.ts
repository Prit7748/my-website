export type CategoryConfigItem = {
  label: string;
  skuSuffix: string;
  slugKey: string;
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function slugify(input: string) {
  return safeStr(input)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeLoose(input: any) {
  return safeStr(input).toLowerCase().replace(/\s+/g, " ").trim();
}

export const CATEGORY_CONFIG: CategoryConfigItem[] = [
  { label: "Solved Assignments", skuSuffix: "A", slugKey: "solved-assignments" },
  { label: "Question Papers (PYQ)", skuSuffix: "Q", slugKey: "question-papers" },
  { label: "Handwritten PDFs", skuSuffix: "H", slugKey: "handwritten-pdfs" },
  { label: "Ebooks", skuSuffix: "E", slugKey: "ebooks" },
  { label: "projects", skuSuffix: "P", slugKey: "projects" },
  { label: "Guess Papers", skuSuffix: "G", slugKey: "guess-papers" },
  { label: "Handwritten Hardcopy (Delivery)", skuSuffix: "D", slugKey: "handwritten-hardcopy-delivery" },
];

export const CATEGORY_LABELS = CATEGORY_CONFIG.map((x) => x.label);
export const PHYSICAL_CATEGORY = "Handwritten Hardcopy (Delivery)";

const CATEGORY_ALIASES: Record<string, string> = {
  "solved assignment": "Solved Assignments",
  "solved assignments": "Solved Assignments",

  "question paper": "Question Papers (PYQ)",
  "question papers": "Question Papers (PYQ)",
  "question paper (pyq)": "Question Papers (PYQ)",
  "question papers (pyq)": "Question Papers (PYQ)",
  pyq: "Question Papers (PYQ)",
  pyqs: "Question Papers (PYQ)",
  "previous year paper": "Question Papers (PYQ)",
  "previous year papers": "Question Papers (PYQ)",

  "handwritten pdf": "Handwritten PDFs",
  "handwritten pdfs": "Handwritten PDFs",

  ebook: "Ebooks",
  ebooks: "Ebooks",
  "ebooks/notes": "Ebooks",
  "ebook/notes": "Ebooks",
  "ebooks notes": "Ebooks",
  "ebook notes": "Ebooks",
  notes: "Ebooks",

  project: "projects",
  projects: "projects",
  "project & synopsis": "projects",
  "projects & synopsis": "projects",
  synopsis: "projects",

  "guess paper": "Guess Papers",
  "guess papers": "Guess Papers",

  "handwritten hardcopy (delivery)": "Handwritten Hardcopy (Delivery)",
  "handwritten hardcopy delivery": "Handwritten Hardcopy (Delivery)",
  "handwritten hardcopy": "Handwritten Hardcopy (Delivery)",
  "hardcopy delivery": "Handwritten Hardcopy (Delivery)",
  "hardcopy": "Handwritten Hardcopy (Delivery)",
};

export function normalizeProductCategory(input: any) {
  const raw = safeStr(input);
  if (!raw) return "";

  const loose = normalizeLoose(raw);
  const rawSlug = slugify(raw);

  for (const item of CATEGORY_CONFIG) {
    if (raw === item.label) return item.label;
    if (loose === normalizeLoose(item.label)) return item.label;
    if (rawSlug === slugify(item.label)) return item.label;
    if (rawSlug === slugify(item.slugKey)) return item.label;
  }

  if (CATEGORY_ALIASES[loose]) return CATEGORY_ALIASES[loose];

  return raw;
}

export function getCategoryConfig(input: any) {
  const normalized = normalizeProductCategory(input);
  return CATEGORY_CONFIG.find((x) => x.label === normalized) || null;
}

export function isPhysicalCategory(input: any) {
  return normalizeProductCategory(input) === PHYSICAL_CATEGORY;
}

export function deriveIsDigitalFromCategory(input: any) {
  return !isPhysicalCategory(input);
}

export function categoryLabelToSessionSlugCandidates(input: any) {
  const normalized = normalizeProductCategory(input);
  const found = getCategoryConfig(normalized);

  const rawLabel = safeStr(normalized);
  const labelSlug = slugify(rawLabel);
  const configSlug = slugify(found?.slugKey || "");
  const configLabelSlug = slugify(found?.label || "");

  const singularVariants = [
    labelSlug.replace(/-assignments\b/, "-assignment"),
    labelSlug.replace(/-papers\b/, "-paper"),
    configSlug.replace(/-assignments\b/, "-assignment"),
    configSlug.replace(/-papers\b/, "-paper"),
  ];

  return Array.from(
    new Set(
      [
        rawLabel,
        rawLabel.toLowerCase(),
        labelSlug,
        configSlug,
        configLabelSlug,
        ...singularVariants,
      ].filter(Boolean)
    )
  );
}