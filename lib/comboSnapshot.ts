// lib/comboSnapshot.ts
import Product from "@/models/Product";

export type ComboSnapshotItem = {
  productId: string;
  title: string;
  slug: string;
  category: string;
  subjectCode: string;
  subjectTitleEn: string;
  subjectTitleHi: string;
  medium: string;
  lang3: string;
  session: string;
  session6: string;
  courseCodes: string[];
  courseTitles: string[];
  price: number;
  thumbUrl: string;
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function toSlug(input: any) {
  return safeStr(input)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function uniqueStrings(arr: any[], upper = false) {
  return Array.from(
    new Set(
      (Array.isArray(arr) ? arr : [])
        .map((x) => (upper ? safeStr(x).toUpperCase() : safeStr(x)))
        .filter(Boolean)
    )
  );
}

function buildThumbUrl(p: any) {
  return (
    safeStr(p?.thumbnailUrl) ||
    safeStr(p?.quickUrl) ||
    (Array.isArray(p?.images) && p.images[0] ? safeStr(p.images[0]) : "")
  );
}

function normalizeMedium(language: string, lang3: string) {
  const l = safeStr(language);
  if (l) return l;

  const x = safeStr(lang3).toUpperCase();
  if (x === "HIN") return "Hindi";
  if (x === "ENG") return "English";
  return x || "";
}

export function mapProductToComboSnapshotItem(p: any): ComboSnapshotItem {
  return {
    productId: String(p?._id || p?.productId || ""),
    title: safeStr(p?.title),
    slug: toSlug(p?.slug || p?.title),
    category: safeStr(p?.category),
    subjectCode: safeStr(p?.subjectCode).toUpperCase(),
    subjectTitleEn: safeStr(p?.subjectTitleEn),
    subjectTitleHi: safeStr(p?.subjectTitleHi),
    medium: normalizeMedium(safeStr(p?.language || p?.medium), safeStr(p?.lang3)),
    lang3: safeStr(p?.lang3).toUpperCase(),
    session: safeStr(p?.session),
    session6: safeStr(p?.session6),
    courseCodes: uniqueStrings(p?.courseCodes || [], true),
    courseTitles: uniqueStrings(p?.courseTitles || [], false),
    price: Math.max(0, safeNum(p?.price, 0)),
    thumbUrl: safeStr(p?.thumbUrl) || buildThumbUrl(p),
  };
}

export async function buildSnapshotFromProductIds(productIds: string[]) {
  const ids = uniqueStrings(productIds || [], false);
  if (!ids.length) return [];

  const docs: any[] = await Product.find({
    _id: { $in: ids },
    isActive: true,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  })
    .select({
      _id: 1,
      title: 1,
      slug: 1,
      category: 1,
      subjectCode: 1,
      subjectTitleEn: 1,
      subjectTitleHi: 1,
      courseCodes: 1,
      courseTitles: 1,
      language: 1,
      lang3: 1,
      session: 1,
      session6: 1,
      price: 1,
      thumbnailUrl: 1,
      quickUrl: 1,
      images: 1,
    })
    .lean();

  const order = new Map(ids.map((id, idx) => [String(id), idx]));
  docs.sort((a, b) => (order.get(String(a._id)) ?? 0) - (order.get(String(b._id)) ?? 0));

  return docs.map(mapProductToComboSnapshotItem);
}

export function deriveCourseCodesFromSnapshot(items: any[]) {
  return uniqueStrings(
    (Array.isArray(items) ? items : []).flatMap((item: any) =>
      Array.isArray(item?.courseCodes) ? item.courseCodes : []
    ),
    true
  );
}

export function deriveCourseTitlesFromSnapshot(items: any[]) {
  return uniqueStrings(
    (Array.isArray(items) ? items : []).flatMap((item: any) =>
      Array.isArray(item?.courseTitles) ? item.courseTitles : []
    ),
    false
  );
}

export function deriveSubjectCodesFromSnapshot(items: any[]) {
  return uniqueStrings(
    (Array.isArray(items) ? items : []).map((item: any) => item?.subjectCode),
    true
  );
}