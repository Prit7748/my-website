import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { getAuthUser, hasPermission } from "@/lib/auth";
import BulkProductTemplateConfig, {
  BULK_PRODUCT_TEMPLATE_CONFIG_KEY,
} from "@/models/BulkProductTemplateConfig";
import { CATEGORY_CONFIG, PHYSICAL_CATEGORY } from "@/lib/productCatalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TemplateItem = {
  category: string;
  titleTemplate: string;
  importantNoteTemplate: string;
  shortDescTemplate: string;
  longDescTemplate: string;
  slugTemplate: string;
  metaTitleTemplate: string;
  metaDescriptionTemplate: string;
  publishNow: boolean;
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeBool(x: any, def = false) {
  if (typeof x === "boolean") return x;
  if (typeof x === "string") {
    const v = x.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(v)) return true;
    if (["false", "0", "no", "off"].includes(v)) return false;
  }
  if (typeof x === "number") {
    if (x === 1) return true;
    if (x === 0) return false;
  }
  return def;
}

function getUserId(user: any) {
  return safeStr(user?._id || user?.id || user?.userId || user?.email || "");
}

const DEFAULT_IMPORTANT_NOTE =
  "Please verify the question paper shown in the preview/thumbnail before purchasing. Purchase only if it matches your subject code, medium, session, and questions.";

function allowedBulkCategories() {
  return CATEGORY_CONFIG.map((x) => x.label).filter(
    (label) => label !== PHYSICAL_CATEGORY
  );
}

function buildCategoryDefaults(): Record<string, TemplateItem> {
  return {
    "Solved Assignments": {
      category: "Solved Assignments",
      titleTemplate: "IGNOU %B Solved Assignment %C (%D Medium)",
      importantNoteTemplate: DEFAULT_IMPORTANT_NOTE,
      shortDescTemplate:
        "Download IGNOU %B (%F) solved assignment for session %C in %D medium.",
      longDescTemplate:
        "This IGNOU %B (%F) solved assignment is prepared for session %C in %D medium. Course title is auto-matched from master data: %G.",
      slugTemplate: "",
      metaTitleTemplate:
        "IGNOU %B Solved Assignment %C (%D Medium) PDF Download",
      metaDescriptionTemplate:
        "Download IGNOU %B (%F) solved assignment for session %C in %D medium. Course title: %G. Instant access and verified subject mapping.",
      publishNow: false,
    },

    "Question Papers (PYQ)": {
      category: "Question Papers (PYQ)",
      titleTemplate: "IGNOU %B Question Paper %C (%D Medium)",
      importantNoteTemplate: DEFAULT_IMPORTANT_NOTE,
      shortDescTemplate:
        "Download IGNOU %B (%F) question paper for session %C in %D medium.",
      longDescTemplate:
        "This IGNOU %B (%F) question paper is mapped for session %C in %D medium. Course title is auto-matched from master data: %G.",
      slugTemplate: "",
      metaTitleTemplate: "IGNOU %B Question Paper %C (%D Medium) PDF Download",
      metaDescriptionTemplate:
        "Download IGNOU %B (%F) question paper for session %C in %D medium. Course title: %G. Instant access and verified subject mapping.",
      publishNow: true,
    },

    "Handwritten PDFs": {
      category: "Handwritten PDFs",
      titleTemplate: "IGNOU %B Handwritten PDF %C (%D Medium)",
      importantNoteTemplate:
        "Please verify subject code, medium, session, and course details before purchasing this handwritten PDF.",
      shortDescTemplate:
        "Download IGNOU %B (%F) handwritten PDF for session %C in %D medium.",
      longDescTemplate:
        "This IGNOU %B (%F) handwritten PDF is prepared for session %C in %D medium. Course title is auto-matched from master data: %G.",
      slugTemplate: "",
      metaTitleTemplate: "IGNOU %B Handwritten PDF %C (%D Medium) Download",
      metaDescriptionTemplate:
        "Download IGNOU %B (%F) handwritten PDF for session %C in %D medium. Course title: %G. Instant access and verified subject mapping.",
      publishNow: false,
    },

    Ebooks: {
      category: "Ebooks",
      titleTemplate: "IGNOU %B Ebook %C (%D Medium)",
      importantNoteTemplate:
        "Please verify subject code, medium, session, and course details before purchasing this ebook.",
      shortDescTemplate:
        "Download IGNOU %B (%F) ebook for session %C in %D medium.",
      longDescTemplate:
        "This IGNOU %B (%F) ebook is prepared for session %C in %D medium. Course title is auto-matched from master data: %G.",
      slugTemplate: "",
      metaTitleTemplate: "IGNOU %B Ebook %C (%D Medium) Download",
      metaDescriptionTemplate:
        "Download IGNOU %B (%F) ebook for session %C in %D medium. Course title: %G. Instant access and verified subject mapping.",
      publishNow: false,
    },

    projects: {
      category: "projects",
      titleTemplate: "IGNOU %B Project %C (%D Medium)",
      importantNoteTemplate:
        "Please verify subject code, medium, session, and course details before purchasing this project file.",
      shortDescTemplate:
        "Download IGNOU %B (%F) project material for session %C in %D medium.",
      longDescTemplate:
        "This IGNOU %B (%F) project material is prepared for session %C in %D medium. Course title is auto-matched from master data: %G.",
      slugTemplate: "",
      metaTitleTemplate: "IGNOU %B Project %C (%D Medium) Download",
      metaDescriptionTemplate:
        "Download IGNOU %B (%F) project material for session %C in %D medium. Course title: %G. Instant access and verified subject mapping.",
      publishNow: false,
    },

    "Guess Papers": {
      category: "Guess Papers",
      titleTemplate: "IGNOU %B Guess Paper %C (%D Medium)",
      importantNoteTemplate:
        "Please verify subject code, medium, session, and course details before purchasing this guess paper.",
      shortDescTemplate:
        "Download IGNOU %B (%F) guess paper for session %C in %D medium.",
      longDescTemplate:
        "This IGNOU %B (%F) guess paper is prepared for session %C in %D medium. Course title is auto-matched from master data: %G.",
      slugTemplate: "",
      metaTitleTemplate: "IGNOU %B Guess Paper %C (%D Medium) Download",
      metaDescriptionTemplate:
        "Download IGNOU %B (%F) guess paper for session %C in %D medium. Course title: %G. Instant access and verified subject mapping.",
      publishNow: false,
    },
  };
}

function normalizeTemplateItem(input: any, fallbackCategory = ""): TemplateItem {
  return {
    category: safeStr(input?.category || fallbackCategory),
    titleTemplate: safeStr(input?.titleTemplate),
    importantNoteTemplate: safeStr(input?.importantNoteTemplate),
    shortDescTemplate: safeStr(input?.shortDescTemplate),
    longDescTemplate: safeStr(input?.longDescTemplate),
    slugTemplate: safeStr(input?.slugTemplate),
    metaTitleTemplate: safeStr(input?.metaTitleTemplate),
    metaDescriptionTemplate: safeStr(input?.metaDescriptionTemplate),
    publishNow: safeBool(input?.publishNow, false),
  };
}

function mergeWithDefaults(
  rawItems: any[] | undefined | null
): Record<string, TemplateItem> {
  const defaults = buildCategoryDefaults();
  const allowed = new Set(allowedBulkCategories());
  const output: Record<string, TemplateItem> = {};

  for (const category of allowed) {
    output[category] = normalizeTemplateItem(defaults[category], category);
  }

  for (const item of Array.isArray(rawItems) ? rawItems : []) {
    const category = safeStr(item?.category);
    if (!category || !allowed.has(category)) continue;

    output[category] = {
      ...output[category],
      ...normalizeTemplateItem(item, category),
      category,
    };
  }

  return output;
}

function listResponseFromMap(
  itemsMap: Record<string, TemplateItem>,
  updatedBy = "",
  updatedAt: any = null,
  createdAt: any = null
) {
  const categories = allowedBulkCategories();

  return {
    ok: true,
    itemMap: itemsMap,
    items: categories.map((category) => itemsMap[category]),
    defaults: buildCategoryDefaults(),
    categories,
    meta: {
      key: BULK_PRODUCT_TEMPLATE_CONFIG_KEY,
      updatedBy: safeStr(updatedBy),
      updatedAt: updatedAt || null,
      createdAt: createdAt || null,
    },
  };
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  if (!hasPermission(user, "products:read") && !hasPermission(user, "products:write")) {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 }
    );
  }

  await dbConnect();

  const doc: any = await BulkProductTemplateConfig.findOne({
    key: BULK_PRODUCT_TEMPLATE_CONFIG_KEY,
  }).lean();

  const itemsMap = mergeWithDefaults(doc?.items);

  const category = safeStr(req.nextUrl.searchParams.get("category"));
  if (category) {
    const allowed = new Set(allowedBulkCategories());
    if (!allowed.has(category)) {
      return NextResponse.json(
        { ok: false, error: "Invalid category requested" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      item: itemsMap[category],
      defaultItem: buildCategoryDefaults()[category],
      category,
      categories: allowedBulkCategories(),
      meta: {
        key: BULK_PRODUCT_TEMPLATE_CONFIG_KEY,
        updatedBy: safeStr(doc?.updatedBy),
        updatedAt: doc?.updatedAt || null,
        createdAt: doc?.createdAt || null,
      },
    });
  }

  return NextResponse.json(
    listResponseFromMap(
      itemsMap,
      safeStr(doc?.updatedBy),
      doc?.updatedAt || null,
      doc?.createdAt || null
    )
  );
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  if (!hasPermission(user, "products:write")) {
    return NextResponse.json(
      { ok: false, error: "Forbidden (products:write missing)" },
      { status: 403 }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const allowed = new Set(allowedBulkCategories());
  const defaults = buildCategoryDefaults();

  let incomingItems: any[] = [];

  if (Array.isArray(body?.items)) {
    incomingItems = body.items;
  } else if (body?.item && safeStr(body?.item?.category)) {
    incomingItems = [body.item];
  } else if (safeStr(body?.category)) {
    incomingItems = [{ ...body, category: safeStr(body.category) }];
  } else {
    return NextResponse.json(
      {
        ok: false,
        error: "items array, item object, ya category-based payload required hai",
      },
      { status: 400 }
    );
  }

  const seen = new Set<string>();
  const normalizedItems: TemplateItem[] = [];

  for (const rawItem of incomingItems) {
    const category = safeStr(rawItem?.category);

    if (!category || !allowed.has(category)) {
      return NextResponse.json(
        { ok: false, error: `Invalid category: ${category || "blank"}` },
        { status: 400 }
      );
    }

    if (seen.has(category)) {
      return NextResponse.json(
        { ok: false, error: `Duplicate category in payload: ${category}` },
        { status: 400 }
      );
    }

    seen.add(category);

    const merged = {
      ...defaults[category],
      ...normalizeTemplateItem(rawItem, category),
      category,
    };

    if (!safeStr(merged.titleTemplate)) {
      return NextResponse.json(
        { ok: false, error: `Title Template required for ${category}` },
        { status: 400 }
      );
    }

    normalizedItems.push(merged);
  }

  await dbConnect();

  const existing: any = await BulkProductTemplateConfig.findOne({
    key: BULK_PRODUCT_TEMPLATE_CONFIG_KEY,
  }).lean();

  const existingMap = mergeWithDefaults(existing?.items);

  for (const item of normalizedItems) {
    existingMap[item.category] = item;
  }

  const finalItems = allowedBulkCategories().map((category) => ({
    ...defaults[category],
    ...existingMap[category],
    category,
  }));

  const updatedDoc: any = await BulkProductTemplateConfig.findOneAndUpdate(
    { key: BULK_PRODUCT_TEMPLATE_CONFIG_KEY },
    {
      $set: {
        key: BULK_PRODUCT_TEMPLATE_CONFIG_KEY,
        items: finalItems,
        updatedBy: getUserId(user),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  const finalMap = mergeWithDefaults(updatedDoc?.items);
  const responsePayload = listResponseFromMap(
    finalMap,
    safeStr(updatedDoc?.updatedBy),
    updatedDoc?.updatedAt || null,
    updatedDoc?.createdAt || null
  );

  return NextResponse.json({
    ...responsePayload,
    message: "Bulk product default templates saved successfully.",
  });
}