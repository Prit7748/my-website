import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Combo from "@/models/Combo";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function escapeRegex(str: string) {
  return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeQuery(q: string) {
  return safeStr(q)
    .toLowerCase()
    .replace(/[_:]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(q: string) {
  const n = normalizeQuery(q);
  if (!n) return [];
  return n
    .split(" ")
    .map((t) => t.trim())
    .filter(Boolean);
}

function uniqueUpper(arr: any[]) {
  return Array.from(
    new Set(
      (Array.isArray(arr) ? arr : [])
        .map((x) => safeStr(x).toUpperCase())
        .filter(Boolean)
    )
  );
}

function uniqueText(arr: any[]) {
  return Array.from(
    new Set(
      (Array.isArray(arr) ? arr : [])
        .map((x) => safeStr(x))
        .filter(Boolean)
    )
  );
}

function scoreComboForQuery(c: any, q: string) {
  const nq = normalizeQuery(q).replace(/\s+/g, "");

  const title = normalizeQuery(c?.title || "");
  const shortTitle = normalizeQuery(c?.shortTitle || "");
  const subjectCode = normalizeQuery(c?.subjectCode || "");
  const medium = normalizeQuery(c?.medium || "");
  const categorySlug = normalizeQuery(c?.categorySlug || "");
  const categoryLabel = normalizeQuery(c?.categoryLabel || "");
  const metaTitle = normalizeQuery(c?.metaTitle || "");
  const generationKey = normalizeQuery(c?.generationKey || "");

  let s = 0;

  if (subjectCode && nq && subjectCode.replace(/\s+/g, "") === nq) s += 160;
  if (title && nq && title.replace(/\s+/g, "") === nq) s += 120;
  if (shortTitle && nq && shortTitle.replace(/\s+/g, "") === nq) s += 90;

  if (subjectCode && nq && subjectCode.replace(/\s+/g, "").includes(nq)) s += 85;
  if (title && nq && title.replace(/\s+/g, "").includes(nq)) s += 65;
  if (shortTitle && nq && shortTitle.replace(/\s+/g, "").includes(nq)) s += 48;
  if (metaTitle && nq && metaTitle.replace(/\s+/g, "").includes(nq)) s += 24;
  if (generationKey && nq && generationKey.replace(/\s+/g, "").includes(nq)) s += 10;
  if (categorySlug && nq && categorySlug.includes(nq)) s += 15;
  if (categoryLabel && nq && categoryLabel.includes(nq)) s += 15;
  if (medium && nq && medium.includes(nq)) s += 12;

  const tokens = tokenize(q);
  for (const t of tokens) {
    if (t.length < 2) continue;
    if (subjectCode.includes(t)) s += 18;
    if (title.includes(t)) s += 14;
    if (shortTitle.includes(t)) s += 10;
    if (metaTitle.includes(t)) s += 6;
    if (categoryLabel.includes(t)) s += 4;
    if (medium.includes(t)) s += 3;
  }

  return s;
}

function buildDynamicThumbFromSnapshot(item: any) {
  const category = safeStr(item?.category);
  const subjectCode = safeStr(item?.subjectCode).toUpperCase();
  const title =
    safeStr(item?.subjectTitleEn) ||
    safeStr(item?.subjectTitleHi) ||
    safeStr(item?.title);
  const session = safeStr(item?.session);
  const medium = safeStr(item?.medium);
  const firstCourseCode =
    Array.isArray(item?.courseCodes) && item.courseCodes[0]
      ? safeStr(item.courseCodes[0]).toUpperCase()
      : "";

  const params = new URLSearchParams();
  if (subjectCode) params.set("code", subjectCode);
  if (title) params.set("title", title);
  if (session) params.set("session", session);
  if (medium) params.set("medium", medium);
  if (firstCourseCode) params.set("course", firstCourseCode);

  if (category === "Solved Assignments") {
    return `/api/thumb/assignment?${params.toString()}`;
  }

  if (category === "Handwritten Hardcopy (Delivery)") {
    return `/api/thumb/hardcopy?${params.toString()}`;
  }

  return "";
}

function resolveItemThumb(item: any) {
  return (
    safeStr(item?.thumbUrl) ||
    safeStr(item?.thumbnailUrl) ||
    safeStr(item?.quickUrl) ||
    (Array.isArray(item?.images) && item.images[0] ? safeStr(item.images[0]) : "") ||
    buildDynamicThumbFromSnapshot(item)
  );
}

function isAutoPyqLatestCombo(c: any) {
  const comboKind = safeStr(c?.comboKind).toLowerCase();
  const variant = safeStr(c?.variant).toLowerCase();

  return variant === "pyq" && (comboKind === "pyq_3y" || comboKind === "pyq_5y");
}

function resolveComboSessionLabel(c: any) {
  if (isAutoPyqLatestCombo(c)) return "Latest";
  return safeStr(c?.sessionLabel || c?.sessionRangeLabel || "");
}

function resolveComboSessionRangeLabel(c: any) {
  if (isAutoPyqLatestCombo(c)) return "Latest";
  return safeStr(c?.sessionRangeLabel || "");
}

function mapComboForClient(c: any) {
  const items = Array.isArray(c?.itemsSnapshot) ? c.itemsSnapshot : [];

  const snapshotSubjectCodes = uniqueUpper(items.map((item: any) => item?.subjectCode));
  const subjectCodes = uniqueUpper([c?.subjectCode, ...snapshotSubjectCodes]);

  const snapshotCourseCodes = uniqueUpper(
    items.flatMap((item: any) => (Array.isArray(item?.courseCodes) ? item.courseCodes : []))
  );

  const modelCourseCodes = uniqueUpper(c?.courseCodes || []);
  const courseCodes = uniqueUpper([...modelCourseCodes, ...snapshotCourseCodes]);

  const snapshotCourseTitles = uniqueText(
    items.flatMap((item: any) => (Array.isArray(item?.courseTitles) ? item.courseTitles : []))
  );

  const mappedItems = items.map((item: any) => ({
    title: safeStr(item?.title),
    subtitle: [
      safeStr(item?.subjectCode),
      safeStr(item?.medium),
      safeStr(item?.session),
    ]
      .filter(Boolean)
      .join(" • "),
    slug: safeStr(item?.slug),
    thumbnailUrl: resolveItemThumb(item),
    courseCodes: uniqueUpper(item?.courseCodes || []),
  }));

  const comboThumb =
    safeStr(c?.thumbUrl) ||
    mappedItems.find((x: any) => safeStr(x?.thumbnailUrl))?.thumbnailUrl ||
    "";

  return {
    id: String(c?._id || ""),
    slug: safeStr(c?.slug),
    categorySlug: safeStr(c?.categorySlug),
    title: safeStr(c?.title),
    shortTitle: safeStr(c?.shortTitle),
    description: safeStr(c?.description || c?.shortDescription),
    shortDescription: safeStr(c?.shortDescription),
    badge: safeStr(c?.badge || "Combo"),
    itemsLabel: safeStr(c?.itemsLabel || "Included Bundle Items"),

    priceLabel:
      safeStr(c?.priceLabel) ||
      (Number(c?.offerPrice || 0) > 0 ? `₹${Number(c.offerPrice)}` : ""),

    saveLabel:
      safeStr(c?.saveLabel) ||
      (Number(c?.savePercent || 0) > 0 ? `Save ${Number(c.savePercent)}%` : ""),

    totalMrpLabel:
      Number(c?.totalMrp || 0) > 0 ? `₹${Number(c.totalMrp)}` : "",

    mediumLabel: safeStr(c?.mediumLabel || c?.medium || ""),
    sessionLabel: resolveComboSessionLabel(c),
    variant: safeStr(c?.variant || "default"),
    accentClass: safeStr(c?.accentClass || ""),
    thumbnailUrl: comboThumb,

    comboKind: safeStr(c?.comboKind),
    status: safeStr(c?.status),
    isAutoGenerated: !!c?.isAutoGenerated,
    isMakeOwnComboAllowed: !!c?.isMakeOwnComboAllowed,
    sourceType: safeStr(c?.sourceType || ""),
    generationKey: safeStr(c?.generationKey || ""),
    generationGroupKey: safeStr(c?.generationGroupKey || ""),
    sortOrder: Number(c?.sortOrder || 0),

    subjectCode: safeStr(c?.subjectCode),
    medium: safeStr(c?.medium),
    lang3: safeStr(c?.lang3),
    sessionRangeLabel: resolveComboSessionRangeLabel(c),

    subjectCodesLabel: subjectCodes.join(", "),
    courseCodesLabel: courseCodes.join(", "),
    courseTitlesLabel: snapshotCourseTitles.join(", "),

    totalMrp: Number(c?.totalMrp || 0),
    offerPrice: Number(c?.offerPrice || 0),
    saveAmount: Number(c?.saveAmount || 0),
    savePercent: Number(c?.savePercent || 0),

    items: mappedItems,
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const category = safeStr(url.searchParams.get("category")).toLowerCase();
  const slug = safeStr(url.searchParams.get("slug")).toLowerCase();
  const q = safeStr(url.searchParams.get("search"));
  const comboKind = safeStr(url.searchParams.get("type")).toLowerCase();
  const medium = safeStr(url.searchParams.get("medium"));
  const subjectCode = safeStr(url.searchParams.get("subjectCode")).toUpperCase();
  const lang3 = safeStr(url.searchParams.get("lang3")).toUpperCase();
  const sourceType = safeStr(url.searchParams.get("sourceType")).toLowerCase();

  const page = Math.max(1, Math.trunc(safeNum(url.searchParams.get("page"), 1)));
  const limit = Math.min(48, Math.max(1, Math.trunc(safeNum(url.searchParams.get("limit"), 24))));
  const skip = (page - 1) * limit;

  await dbConnect();

  const baseFilter: any = {
    isActive: true,
    status: "active",
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  };

  if (category) baseFilter.categorySlug = category;
  if (comboKind) baseFilter.comboKind = comboKind;
  if (sourceType) baseFilter.sourceType = sourceType;

  if (medium) {
    baseFilter.$and = baseFilter.$and || [];
    baseFilter.$and.push({
      $or: [{ medium }, { mediumLabel: medium }, { lang3: medium.toUpperCase() }],
    });
  }

  if (subjectCode) baseFilter.subjectCode = subjectCode;
  if (lang3) baseFilter.lang3 = lang3;

  const projection: any = {
    title: 1,
    slug: 1,
    shortTitle: 1,
    categorySlug: 1,
    categoryLabel: 1,
    comboKind: 1,
    variant: 1,
    status: 1,
    isActive: 1,
    isAutoGenerated: 1,
    isMakeOwnComboAllowed: 1,
    sourceType: 1,
    generationKey: 1,
    generationGroupKey: 1,
    subjectCode: 1,
    medium: 1,
    lang3: 1,
    sessionRangeLabel: 1,
    courseCodes: 1,
    description: 1,
    shortDescription: 1,
    badge: 1,
    itemsLabel: 1,
    accentClass: 1,
    thumbUrl: 1,
    priceLabel: 1,
    saveLabel: 1,
    mediumLabel: 1,
    sessionLabel: 1,
    totalMrp: 1,
    offerPrice: 1,
    saveAmount: 1,
    savePercent: 1,
    itemsSnapshot: 1,
    sortOrder: 1,
    metaTitle: 1,
    createdAt: 1,
    updatedAt: 1,
  };

  if (slug) {
    const doc = await Combo.findOne({
      ...baseFilter,
      slug,
    })
      .select(projection)
      .lean();

    const combos = doc ? [mapComboForClient(doc)] : [];

    return NextResponse.json(
      {
        ok: true,
        category: category || "",
        source: "database",
        combos,
        pagination: {
          page: 1,
          limit: 1,
          total: combos.length,
          totalPages: 1,
        },
        applied: {
          category: category || "",
          slug: slug || "",
          search: "",
          type: comboKind || "",
          medium: medium || "",
          subjectCode: subjectCode || "",
          lang3: lang3 || "",
          sourceType: sourceType || "",
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  let rawCombos: any[] = [];
  let total = 0;

  if (q.length >= 2) {
    const textFilter = { ...baseFilter, $text: { $search: q } };
    const textProjection = { ...projection, score: { $meta: "textScore" } };
    const textSortObj: any = {
      score: { $meta: "textScore" },
      sortOrder: 1,
      createdAt: -1,
      _id: -1,
    };

    try {
      [rawCombos, total] = await Promise.all([
        Combo.find(textFilter)
          .select(textProjection)
          .sort(textSortObj)
          .skip(skip)
          .limit(limit)
          .lean(),
        Combo.countDocuments(textFilter),
      ]);
    } catch (err: any) {
      const msg = String(err?.message || "").toLowerCase();
      const isTextIndexMissing =
        msg.includes("text index required") ||
        msg.includes("no text index") ||
        msg.includes("failed to use text index");

      if (!isTextIndexMissing) throw err;

      const tokens = tokenize(q).filter((t) => t.length >= 2).slice(0, 6);
      const tokenRegexes = tokens.map((t) => new RegExp(escapeRegex(t), "i"));

      const fieldsToSearch = [
        "title",
        "shortTitle",
        "description",
        "shortDescription",
        "subjectCode",
        "medium",
        "categorySlug",
        "categoryLabel",
        "metaTitle",
        "metaDescription",
        "courseCodes",
        "generationKey",
        "generationGroupKey",
      ];

      const regexFilter: any = { ...baseFilter };
      const andParts: any[] = [];

      for (const rx of tokenRegexes) {
        andParts.push({
          $or: fieldsToSearch.map((f) => ({ [f]: rx })),
        });
      }

      if (andParts.length) {
        regexFilter.$and = [...(regexFilter.$and || []), ...andParts];
      } else {
        const rx = new RegExp(escapeRegex(q), "i");
        regexFilter.$and = [
          ...(regexFilter.$and || []),
          {
            $or: [
              { title: rx },
              { shortTitle: rx },
              { subjectCode: rx },
              { courseCodes: rx },
              { generationKey: rx },
            ],
          },
        ];
      }

      [rawCombos, total] = await Promise.all([
        Combo.find(regexFilter)
          .select(projection)
          .sort({ sortOrder: 1, createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Combo.countDocuments(regexFilter),
      ]);

      rawCombos.sort((a, b) => scoreComboForQuery(b, q) - scoreComboForQuery(a, q));
    }
  } else {
    [rawCombos, total] = await Promise.all([
      Combo.find(baseFilter)
        .select(projection)
        .sort({ sortOrder: 1, createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Combo.countDocuments(baseFilter),
    ]);
  }

  const combos = (rawCombos || []).map(mapComboForClient);

  return NextResponse.json(
    {
      ok: true,
      category: category || "",
      source: "database",
      combos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      applied: {
        category: category || "",
        slug: "",
        search: q || "",
        type: comboKind || "",
        medium: medium || "",
        subjectCode: subjectCode || "",
        lang3: lang3 || "",
        sourceType: sourceType || "",
      },
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}