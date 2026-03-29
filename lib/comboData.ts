import type { ComboBundleCardData } from "@/components/combo/ComboBundleCard";

export type ComboCategorySlug =
  | "solved-assignments"
  | "question-papers"
  | "guess-papers"
  | "ebooks-notes"
  | "handwritten-pdfs"
  | "handwritten-hardcopy"
  | "projects-synopsis";

export type ComboApiItem = {
  title?: string;
  subtitle?: string;
  thumbnailUrl?: string;
  slug?: string;
  courseCodes?: string[];
};

export type ComboApiRecord = {
  id?: string;
  slug?: string;
  categorySlug?: ComboCategorySlug | string;
  title?: string;
  description?: string;
  badge?: string;
  itemsLabel?: string;
  priceLabel?: string;
  saveLabel?: string;
  mediumLabel?: string;
  sessionLabel?: string;
  subjectCodesLabel?: string;
  courseCodesLabel?: string;
  variant?: "default" | "pyq" | "hardcopy";
  accentClass?: string;
  thumbnailUrl?: string;
  items?: ComboApiItem[];
};

function safeText(x: any) {
  return String(x ?? "").trim();
}

function normalizeCommaList(value: any) {
  const raw = safeText(value);
  if (!raw) return "";

  const parts = raw
    .split(",")
    .map((x) => safeText(x))
    .filter(Boolean);

  const unique = Array.from(new Set(parts));
  return unique.join(", ");
}

export function mapComboRecordToCardData(
  record?: ComboApiRecord | null
): ComboBundleCardData | null {
  if (!record) return null;

  const title = safeText(record.title);
  if (!title) return null;

  return {
    id: safeText(record.id),
    slug: safeText(record.slug),
    categorySlug: safeText(record.categorySlug),
    title,
    description: safeText(record.description),
    badge: safeText(record.badge) || "Combo",
    itemsLabel: safeText(record.itemsLabel) || "Included Bundle Items",
    priceLabel: safeText(record.priceLabel),
    saveLabel: safeText(record.saveLabel),
    mediumLabel: safeText(record.mediumLabel),
    sessionLabel: safeText(record.sessionLabel),
    subjectCodesLabel: normalizeCommaList(record.subjectCodesLabel),
    courseCodesLabel: normalizeCommaList(record.courseCodesLabel),
    variant: record.variant || "default",
    accentClass: safeText(record.accentClass),
    thumbnailUrl: safeText(record.thumbnailUrl),
    items: Array.isArray(record.items)
      ? record.items.map((item) => ({
          title: safeText(item?.title),
          subtitle: safeText(item?.subtitle),
          thumbnailUrl: safeText(item?.thumbnailUrl),
          slug: safeText(item?.slug),
          courseCodes: Array.isArray(item?.courseCodes)
            ? item.courseCodes.map((x) => safeText(x)).filter(Boolean)
            : [],
        }))
      : [],
  };
}