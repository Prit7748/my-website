import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";

function upperTrim(v: any) {
  return String(v || "").trim().toUpperCase();
}

function parseSubjectCode(raw: any) {
  const s = upperTrim(raw);
  const cleaned = s.replace(/[^A-Z0-9\s-]/g, " ");

  const alphaMatch = cleaned.match(/[A-Z]+/);
  const numMatch = cleaned.match(/\d+/);

  const alpha = alphaMatch ? alphaMatch[0] : "";
  const numRaw = numMatch ? numMatch[0] : "";
  const num = numRaw ? String(Number(numRaw)) : "";
  const padded = num ? num.padStart(3, "0") : "";

  const norm = alpha && padded ? `${alpha}${padded}` : upperTrim(s).replace(/[^A-Z0-9]/g, "");

  const variants = new Set<string>();
  if (alpha) variants.add(alpha);
  if (num) variants.add(num);
  if (padded) variants.add(padded);

  if (alpha && num) {
    variants.add(`${alpha}${num}`);
    variants.add(`${alpha} ${num}`);
    variants.add(`${alpha}-${num}`);
  }
  if (alpha && padded) {
    variants.add(`${alpha}${padded}`);
    variants.add(`${alpha} ${padded}`);
    variants.add(`${alpha}-${padded}`);
  }
  if (s) variants.add(s);

  return {
    alpha,
    num,
    padded,
    norm,
    variants: Array.from(variants).filter(Boolean),
  };
}

export async function GET() {
  try {
    await dbConnect();

    // Only update active or all? Here: all docs
    const cursor = Product.find({}, { _id: 1, subjectCode: 1, courseCodes: 1 }).cursor();

    let updated = 0;
    let scanned = 0;

    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      scanned++;

      const parsed = parseSubjectCode((doc as any).subjectCode);

      const nextCourseCodes = Array.isArray((doc as any).courseCodes)
        ? (doc as any).courseCodes.map((x: any) => upperTrim(x)).filter(Boolean)
        : [];

      await Product.updateOne(
        { _id: (doc as any)._id },
        {
          $set: {
            subjectCodeAlpha: parsed.alpha,
            subjectCodeNum: parsed.num,
            subjectCodeNumPadded: parsed.padded,
            subjectCodeNorm: parsed.norm,
            subjectCodeSearch: parsed.variants,
            courseCodes: nextCourseCodes,
            lastModifiedAt: new Date(),
          },
        }
      );

      updated++;
    }

    return NextResponse.json(
      { ok: true, message: "Backfill complete", scanned, updated },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "backfill failed" },
      { status: 500 }
    );
  }
}
