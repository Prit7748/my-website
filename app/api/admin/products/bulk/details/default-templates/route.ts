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
  "Please verify the subject code, course title, medium, session, preview/thumbnail and product details before purchasing. Buy only if all details match your requirement.";

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
      importantNoteTemplate:
        "Please verify subject code %B, subject title %F, course code %E, course title %G, session %C and %D medium before purchasing this solved assignment PDF.",
      shortDescTemplate:
        "Download IGNOU %B solved assignment for %C session in %D medium. Subject: %F. Course: %G.",
      longDescTemplate:
        "IGNOU %B Solved Assignment %C (%D Medium) is prepared for students who need a clear, well-organized and exam-oriented assignment reference for their IGNOU course. This product is mapped with subject code %B and subject title %F. The course code linked with this material is %E and the course title is %G.\n\nThis solved assignment is useful for understanding the expected answer style, important points, answer structure and presentation method for the %C session. Students can use it as a study support document while preparing their own assignment answers in neat and proper format.\n\nKey details: Subject Code: %B. Subject Title: %F. Course Code: %E. Course Title: %G. Session: %C. Medium: %D. The material is arranged to help IGNOU learners save time, revise concepts and prepare assignment answers with better clarity.\n\nBefore purchasing, please check the preview/thumbnail and confirm that the subject code, session and medium match your requirement. This product is provided by IGNOU Students Portal for educational support and student guidance.",
      slugTemplate: "",
      metaTitleTemplate:
        "IGNOU %B Solved Assignment %C (%D Medium) PDF Download",
      metaDescriptionTemplate:
        "Download IGNOU %B solved assignment for %C session in %D medium. Subject %F, course %G, verified mapping and instant student support.",
      publishNow: false,
    },

    "Question Papers (PYQ)": {
      category: "Question Papers (PYQ)",
      titleTemplate:
        "IGNOU %B Solved Previous Year Paper %C (%D Medium)",
      importantNoteTemplate:
        "Please verify the preview/thumbnail, subject code %B, subject title %F, session %C and %D medium before purchasing this previous year paper.",
      shortDescTemplate:
        "Download IGNOU %B solved previous year question paper for %C in %D medium. Subject: %F. Course: %G.",
      longDescTemplate:
        "IGNOU %B Solved Previous Year Paper %C (%D Medium) is useful for students who want to understand exam pattern, repeated question style and important areas for revision. This PYQ product is mapped with subject code %B and subject title %F. The linked course code is %E and course title is %G.\n\nPrevious year papers help learners identify the type of questions asked in term-end examinations, the depth of answers expected and the way topics are distributed across the paper. This material can be used for practice, revision and focused exam preparation.\n\nKey details: Subject Code: %B. Subject Title: %F. Course Code: %E. Course Title: %G. Session: %C. Medium: %D. Students can use this paper to improve answer planning, time management and confidence before the examination.\n\nBefore purchasing, please verify the preview/thumbnail and confirm that the subject code, session, medium and paper details match your requirement.",
      slugTemplate: "",
      metaTitleTemplate:
        "IGNOU %B Solved Previous Year Paper %C (%D Medium)",
      metaDescriptionTemplate:
        "Download IGNOU %B solved previous year paper for %C in %D medium. Subject %F, course %G, exam pattern and PYQ revision support.",
      publishNow: true,
    },

    "Handwritten PDFs": {
      category: "Handwritten PDFs",
      titleTemplate: "IGNOU %B Handwritten PDF %C (%D Medium)",
      importantNoteTemplate:
        "Please verify subject code %B, subject title %F, course code %E, session %C, medium %D and preview/thumbnail before purchasing this handwritten PDF.",
      shortDescTemplate:
        "Download IGNOU %B handwritten PDF for %C session in %D medium. Subject: %F. Course: %G.",
      longDescTemplate:
        "IGNOU %B Handwritten PDF %C (%D Medium) is prepared for students who prefer handwritten-style study material for assignment preparation, revision and exam support. This product is mapped with subject code %B and subject title %F. The course code linked with this PDF is %E and the course title is %G.\n\nHandwritten PDFs are useful for learners who want material in a natural notebook-style format. The content can help students understand answer presentation, important headings, points and flow of writing for their IGNOU subject.\n\nKey details: Subject Code: %B. Subject Title: %F. Course Code: %E. Course Title: %G. Session: %C. Medium: %D. This material is designed to support study, revision and assignment writing in an easy-to-follow format.\n\nBefore purchasing, please check the preview/thumbnail carefully and confirm that the subject code, session and medium match your requirement.",
      slugTemplate: "",
      metaTitleTemplate:
        "IGNOU %B Handwritten PDF %C (%D Medium) Download",
      metaDescriptionTemplate:
        "Download IGNOU %B handwritten PDF for %C session in %D medium. Subject %F, course %G, notebook-style study material.",
      publishNow: false,
    },

    Ebooks: {
      category: "Ebooks",
      titleTemplate: "IGNOU %B Ebook Notes %C (%D Medium)",
      importantNoteTemplate:
        "Please verify subject code %B, subject title %F, course code %E, session %C and %D medium before purchasing this ebook/notes material.",
      shortDescTemplate:
        "Download IGNOU %B ebook notes for %C session in %D medium. Subject: %F. Course: %G.",
      longDescTemplate:
        "IGNOU %B Ebook Notes %C (%D Medium) is created for students who need organized digital study material for quick reading, revision and concept clarity. This product is mapped with subject code %B and subject title %F. The course code linked with this ebook is %E and the course title is %G.\n\nEbook notes can help learners revise important topics, understand chapter-wise ideas and prepare short notes before exams or assignments. The material is suitable for students who want subject-related support in a convenient digital format.\n\nKey details: Subject Code: %B. Subject Title: %F. Course Code: %E. Course Title: %G. Session: %C. Medium: %D. This ebook/notes material is intended to support learning, revision and better organization of study content.\n\nBefore purchasing, please verify the preview/thumbnail and confirm that the subject code, course, session and medium are correct.",
      slugTemplate: "",
      metaTitleTemplate:
        "IGNOU %B Ebook Notes %C (%D Medium) Download",
      metaDescriptionTemplate:
        "Download IGNOU %B ebook notes for %C session in %D medium. Subject %F, course %G, digital study and revision material.",
      publishNow: false,
    },

    projects: {
      category: "projects",
      titleTemplate: "IGNOU %B Project Synopsis %C (%D Medium)",
      importantNoteTemplate:
        "Please verify subject code %B, subject title %F, course code %E, session %C, medium %D and project details before purchasing this project/synopsis material.",
      shortDescTemplate:
        "Download IGNOU %B project/synopsis material for %C session in %D medium. Subject: %F. Course: %G.",
      longDescTemplate:
        "IGNOU %B Project Synopsis %C (%D Medium) is prepared for students who need project-related study support, topic understanding and structured reference material. This product is mapped with subject code %B and subject title %F. The course code linked with this material is %E and the course title is %G.\n\nProject and synopsis material can help learners understand the expected structure, presentation style, academic flow and important sections of project work. It is useful as a reference while preparing your own project document according to IGNOU guidelines.\n\nKey details: Subject Code: %B. Subject Title: %F. Course Code: %E. Course Title: %G. Session: %C. Medium: %D. This material is designed to support project planning, topic clarity and document preparation.\n\nBefore purchasing, please verify the preview/thumbnail and confirm that the subject code, session, medium and project details match your requirement.",
      slugTemplate: "",
      metaTitleTemplate:
        "IGNOU %B Project Synopsis %C (%D Medium) Download",
      metaDescriptionTemplate:
        "Download IGNOU %B project/synopsis material for %C session in %D medium. Subject %F, course %G, project reference support.",
      publishNow: false,
    },

    "Guess Papers": {
      category: "Guess Papers",
      titleTemplate: "IGNOU %B Guess Paper %C (%D Medium)",
      importantNoteTemplate:
        "Please verify subject code %B, subject title %F, course code %E, session %C and %D medium before purchasing this guess paper.",
      shortDescTemplate:
        "Download IGNOU %B guess paper for %C session in %D medium. Subject: %F. Course: %G.",
      longDescTemplate:
        "IGNOU %B Guess Paper %C (%D Medium) is prepared for students who want focused exam practice and important question-based revision support. This product is mapped with subject code %B and subject title %F. The course code linked with this material is %E and the course title is %G.\n\nGuess papers can help learners revise important topics, practice possible question patterns and improve exam preparation strategy. This material is useful for quick revision, self-practice and understanding the type of answers that may be expected in the examination.\n\nKey details: Subject Code: %B. Subject Title: %F. Course Code: %E. Course Title: %G. Session: %C. Medium: %D. Students can use this guess paper as a focused preparation support document before the exam.\n\nBefore purchasing, please verify the preview/thumbnail and confirm that the subject code, session and medium match your requirement.",
      slugTemplate: "",
      metaTitleTemplate:
        "IGNOU %B Guess Paper %C (%D Medium) Download",
      metaDescriptionTemplate:
        "Download IGNOU %B guess paper for %C session in %D medium. Subject %F, course %G, focused exam preparation support.",
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