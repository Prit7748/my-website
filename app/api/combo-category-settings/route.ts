import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ComboCategorySetting from "@/models/ComboCategorySetting";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const url = new URL(req.url);
    const categorySlug = safeStr(url.searchParams.get("categorySlug")).toLowerCase();

    const query: any = {};
    if (categorySlug) {
      query.categorySlug = categorySlug;
    }

    const docs: any[] = await ComboCategorySetting.find(query)
      .sort({ sortOrder: 1, categorySlug: 1, _id: 1 })
      .lean();

    const settings = (docs || []).map((doc: any) => {
      const minProductsRequired = safeNum(
        doc?.builderRules?.minProductsRequired,
        0
      );
      const maxProductsAllowed = safeNum(
        doc?.builderRules?.maxProductsAllowed,
        0
      );
      const sameCategoryOnly = !!doc?.builderRules?.sameCategoryOnly;
      const sameSubjectOnly = !!doc?.builderRules?.sameSubjectOnly;
      const sameMediumOnly = !!doc?.builderRules?.sameMediumOnly;

      return {
        id: String(doc?._id || ""),
        categorySlug: safeStr(doc?.categorySlug),
        categoryLabel: safeStr(doc?.categoryLabel),

        isActive: !!doc?.isActive,
        comboEnabled: !!doc?.comboEnabled,
        manualCombosEnabled: !!doc?.manualCombosEnabled,
        makeOwnComboEnabled: !!doc?.makeOwnComboEnabled,

        discountType: safeStr(doc?.discountType || "percent"),
        discountValue: safeNum(doc?.discountValue, 0),

        defaultComboKind: safeStr(doc?.defaultComboKind || ""),

        defaultMinProductsRequired: minProductsRequired,
        defaultMaxProductsAllowed: maxProductsAllowed,
        sameCategoryOnly,
        sameSubjectOnly,
        sameMediumOnly,

        latestProductCount: safeNum(
          doc?.latestProductCount ?? doc?.autoRules?.latestProductCount,
          0
        ),
        useLatestSessionsOnly: !!(
          doc?.useLatestSessionsOnly ?? doc?.autoRules?.useLatestSessionsOnly
        ),

        sortOrder: safeNum(doc?.sortOrder, 0),

        builderRules: {
          minProductsRequired,
          maxProductsAllowed,
          sameCategoryOnly,
          sameSubjectOnly,
          sameMediumOnly,
        },

        ui: {
          title: safeStr(doc?.ui?.title),
          shortTitle: safeStr(doc?.ui?.shortTitle),
          badge: safeStr(doc?.ui?.badge),
          heroNote: safeStr(doc?.ui?.heroNote),
          searchPlaceholder: safeStr(doc?.ui?.searchPlaceholder),
          makeOwnComboText: safeStr(doc?.ui?.makeOwnComboText),
        },
      };
    });

    return NextResponse.json(
      {
        ok: true,
        count: settings.length,
        settings,
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
      { error: e?.message || "Failed to load combo category settings" },
      { status: 500 }
    );
  }
}