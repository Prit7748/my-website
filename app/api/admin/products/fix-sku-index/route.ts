import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";

export async function GET() {
  try {
    await dbConnect();

    const col = Product.collection;

    // 1) Drop old problematic indexes if exist
    const indexes = await col.indexes();
    const names = new Set(indexes.map((i: any) => i.name));

    // Old auto index created by unique:true (or earlier)
    if (names.has("sku_1")) {
      await col.dropIndex("sku_1");
    }

    // Our target index (recreate clean)
    if (names.has("sku_unique_nonempty_v1")) {
      await col.dropIndex("sku_unique_nonempty_v1");
    }

    // 2) Create MongoDB-compatible partial unique index (NO $not)
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

    return NextResponse.json({ ok: true, message: "SKU partial unique index fixed" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}
