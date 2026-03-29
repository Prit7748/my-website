import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import ComboCategorySetting from "@/models/ComboCategorySetting";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function uniqueStrings(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    const k = safeStr(v);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function normalizeCategoryLabelFromSlug(slug: string) {
  const s = safeStr(slug).toLowerCase();
  if (s === "solved-assignments") return "Solved Assignments";
  if (s === "question-papers") return "Question Papers (PYQ)";
  if (s === "guess-papers") return "Guess Papers";
  if (s === "ebooks-notes") return "eBooks/Notes";
  if (s === "handwritten-pdfs") return "Handwritten PDFs";
  if (s === "handwritten-hardcopy") return "Handwritten Hardcopy (Delivery)";
  if (s === "projects-synopsis") return "Projects & Synopsis";
  return "";
}

function buildThumbUrl(p: any) {
  return (
    safeStr(p?.thumbnailUrl) ||
    safeStr(p?.quickUrl) ||
    (Array.isArray(p?.images) && p.images[0] ? safeStr(p.images[0]) : "")
  );
}

function sessionSortValue(session6: string, session: string) {
  const s6 = safeStr(session6);
  if (/^\d{6}$/.test(s6)) return Number(s6);

  const raw = safeStr(session).toUpperCase();
  const m = raw.match(/(JUN|JUNE|DEC|DECEMBER)[\s\-]*(\d{2,4})/i);
  if (m) {
    const monRaw = m[1].toUpperCase();
    const yyRaw = m[2];
    const year = yyRaw.length === 2 ? Number(`20${yyRaw}`) : Number(yyRaw);
    const mm = monRaw.startsWith("JUN") ? 6 : 12;
    return year * 100 + mm;
  }

  const nums = raw.replace(/\D/g, "");
  if (nums.length >= 6) return Number(nums.slice(0, 6));
  if (nums.length === 4) return Number(`${nums}00`);
  return 0;
}

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const url = new URL(req.url);
    const categorySlug = safeStr(url.searchParams.get("categorySlug")).toLowerCase();
    const limit = Math.min(200, Math.max(1, Math.trunc(safeNum(url.searchParams.get("limit"), 120))));

    if (!categorySlug) {
      return NextResponse.json({ error: "categorySlug required" }, { status: 400 });
    }

    const categoryLabel = normalizeCategoryLabelFromSlug(categorySlug);
    if (!categoryLabel) {
      return NextResponse.json({ error: "Invalid categorySlug" }, { status: 400 });
    }

    const setting: any = await ComboCategorySetting.findOne({
      categorySlug,
      isActive: true,
      comboEnabled: true,
      makeOwnComboEnabled: true,
    }).lean();

    if (!setting) {
      return NextResponse.json(
        { error: "Builder is not enabled for this category" },
        { status: 403 }
      );
    }

    const query: any = {
      category: categoryLabel,
      isActive: true,
      availability: "available",
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    };

    const docs: any[] = await Product.find(query)
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
        session: 1,
        session6: 1,
        language: 1,
        lang3: 1,
        price: 1,
        thumbnailUrl: 1,
        quickUrl: 1,
        images: 1,
        createdAt: 1,
      })
      .lean();

    const products = (docs || [])
      .map((p: any) => ({
        id: String(p?._id || ""),
        title: safeStr(p?.title),
        slug: safeStr(p?.slug),
        category: safeStr(p?.category),
        subjectCode: safeStr(p?.subjectCode).toUpperCase(),
        subjectTitleEn: safeStr(p?.subjectTitleEn),
        subjectTitleHi: safeStr(p?.subjectTitleHi),
        courseCodes: uniqueStrings(
          (Array.isArray(p?.courseCodes) ? p.courseCodes : []).map((x: any) =>
            safeStr(x).toUpperCase()
          )
        ),
        courseTitles: uniqueStrings(
          (Array.isArray(p?.courseTitles) ? p.courseTitles : []).map((x: any) => safeStr(x))
        ),
        session: safeStr(p?.session),
        session6: safeStr(p?.session6),
        medium: safeStr(p?.language),
        lang3: safeStr(p?.lang3).toUpperCase(),
        price: Math.max(0, safeNum(p?.price, 0)),
        thumbUrl: buildThumbUrl(p),
        createdAt: p?.createdAt ? new Date(p.createdAt).toISOString() : "",
      }))
      .sort((a: any, b: any) => {
        const codeCmp = safeStr(a.subjectCode).localeCompare(safeStr(b.subjectCode));
        if (codeCmp !== 0) return codeCmp;

        const sessionCmp =
          sessionSortValue(b.session6, b.session) - sessionSortValue(a.session6, a.session);
        if (sessionCmp !== 0) return sessionCmp;

        return safeStr(a.title).localeCompare(safeStr(b.title));
      })
      .slice(0, limit);

    const builderRules = setting?.builderRules && typeof setting.builderRules === "object"
      ? setting.builderRules
      : {};

    return NextResponse.json(
      {
        ok: true,
        products,
        builderConfig: {
          categorySlug,
          categoryLabel: safeStr(setting?.categoryLabel) || categoryLabel,
          minProductsRequired: Math.max(0, Number(builderRules?.minProductsRequired || 0)),
          maxProductsAllowed: Math.max(0, Number(builderRules?.maxProductsAllowed || 0)),
          discountType: safeStr(setting?.discountType || "percent"),
          discountValue: Math.max(0, Number(setting?.discountValue || 0)),
          sameCategoryOnly: Boolean(builderRules?.sameCategoryOnly),
          sameSubjectOnly: Boolean(builderRules?.sameSubjectOnly),
          sameMediumOnly: Boolean(builderRules?.sameMediumOnly),
          useLatestSessionsOnly: false,
          latestProductCount: 0,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to load builder products" },
      { status: 500 }
    );
  }
}