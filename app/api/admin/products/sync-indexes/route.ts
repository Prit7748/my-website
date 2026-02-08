import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";

export async function GET() {
  try {
    await dbConnect();

    const col = Product.collection;

    // 1) Read existing indexes
    const idx = await col.indexes();
    const names = new Set(idx.map((i: any) => i.name));

    // 2) Drop problematic / old SKU index (very common: "sku_1")
    if (names.has("sku_1")) {
      await col.dropIndex("sku_1");
    }

    // If you previously created a bad partial index, drop it too (safe)
    if (names.has("sku_unique_nonempty_v1")) {
      await col.dropIndex("sku_unique_nonempty_v1");
    }

    // (optional) if you want stable slug unique naming, you can drop old slug index names too.
    // Usually slug_1 exists; if it conflicts you can manage similarly, but not necessary right now.

    // 3) Create required indexes
    // ✅ Unique SKU only when sku is a non-empty string
    await col.createIndex(
      { sku: 1 },
      {
        name: "sku_unique_nonempty_v1",
        unique: true,
        partialFilterExpression: {
          sku: { $type: "string", $ne: "" },
        },
      }
    );

    // ✅ Ensure text index exists (if already exists, MongoDB will error -> so we guard)
    // We only create if missing by name
    if (!names.has("product_text_search_v1")) {
      await col.createIndex(
        {
          subjectCode: "text",
          title: "text",
          subjectTitleEn: "text",
          subjectTitleHi: "text",
          courseCodes: "text",
          courseTitles: "text",
          slug: "text",
          category: "text",
          session: "text",
          language: "text",
        },
        {
          name: "product_text_search_v1",
          weights: {
            subjectCode: 20,
            title: 12,
            courseCodes: 10,
            courseTitles: 8,
            subjectTitleEn: 7,
            subjectTitleHi: 6,
            slug: 5,
            category: 3,
            session: 2,
            language: 1,
          },
          default_language: "none",
        }
      );
    }

    return NextResponse.json(
      { ok: true, message: "Indexes synced successfully (sku partial unique fixed)." },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Index sync failed" },
      { status: 500 }
    );
  }
}
