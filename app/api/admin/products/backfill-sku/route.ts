import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";

function cleanSku(s: string) {
  return (s || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET() {
  await dbConnect();

  const docs = await Product.find({
    $or: [{ sku: { $exists: false } }, { sku: null }, { sku: "" }],
  })
    .select({ _id: 1, subjectCode: 1, session6: 1, lang3: 1, session: 1, language: 1 })
    .lean();

  let updated = 0;

  for (const d of docs) {
    const base =
      `${d.subjectCode || "GEN"}-${d.session6 || d.session || "NA"}-${d.lang3 || d.language || "NA"}-${String(
        d._id
      ).slice(-6)}`;

    const sku = cleanSku(base);

    await Product.updateOne({ _id: d._id }, { $set: { sku } });
    updated++;
  }

  return NextResponse.json(
    { ok: true, message: "SKU backfill complete", scanned: docs.length, updated },
    { status: 200 }
  );
}
