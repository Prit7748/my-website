// ✅ FILE: app/api/admin/subjects/bulk/route.ts (COMPLETE REPLACE)
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Subject from "@/models/Subject";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

function safeText(x: any) {
  return String(x ?? "").trim();
}
function normCode(code: string) {
  return safeText(code).replace(/\s+/g, " ").toUpperCase();
}

function normLang(lang: string) {
  const s = safeText(lang).toLowerCase();
  if (!s) return { bucket: "" as const, raw: "" };
  if (s.includes("hin") || s === "hi" || s.includes("hindi") || s.includes("हिं")) return { bucket: "hi" as const, raw: lang };
  if (s.includes("eng") || s === "en" || s.includes("english")) return { bucket: "en" as const, raw: lang };
  return { bucket: "other" as const, raw: lang }; // keep raw for other language name
}

type Row = { code: string; language: string; title: string };

function aggregate(rows: Row[]) {
  const map = new Map<
    string,
    { code: string; titleEn: string; titleHi: string; otherLangName: string; titleOther: string }
  >();

  for (const r of rows) {
    const code = normCode(r.code);
    const title = safeText(r.title);
    const langInfo = normLang(r.language);

    if (!code || !title || !langInfo.bucket) continue;

    const cur =
      map.get(code) || {
        code,
        titleEn: "",
        titleHi: "",
        otherLangName: "",
        titleOther: "",
      };

    if (langInfo.bucket === "en") cur.titleEn = title;
    else if (langInfo.bucket === "hi") cur.titleHi = title;
    else {
      cur.otherLangName = safeText(r.language); // store language name from sheet
      cur.titleOther = title;
    }

    map.set(code, cur);
  }

  return Array.from(map.values());
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  await dbConnect();

  const body = await req.json();
  const mode = safeText(body?.mode).toLowerCase(); // "skip" | "replace"
  const dryRun = Boolean(body?.dryRun ?? true);

  const rows: Row[] = Array.isArray(body?.rows) ? body.rows : [];
  if (!rows.length) return NextResponse.json({ error: "rows are required" }, { status: 400 });

  const aggregated = aggregate(rows);
  if (!aggregated.length) return NextResponse.json({ error: "No valid rows found" }, { status: 400 });

  const codes = aggregated.map((x) => x.code);
  const existing = await Subject.find({ code: { $in: codes } }, { code: 1 }).lean();
  const existingSet = new Set(existing.map((x: any) => String(x.code).toUpperCase()));

  const duplicates = aggregated.filter((x) => existingSet.has(x.code));
  const fresh = aggregated.filter((x) => !existingSet.has(x.code));

  if (dryRun) {
    return NextResponse.json(
      {
        dryRun: true,
        totalCodes: aggregated.length,
        newCount: fresh.length,
        duplicateCount: duplicates.length,
        duplicatesSample: duplicates.slice(0, 25).map((x) => x.code),
        note: duplicates.length
          ? "Duplicates found. Choose SKIP or REPLACE and apply."
          : "No duplicates found. You can apply safely.",
      },
      { status: 200 }
    );
  }

  if (mode !== "skip" && mode !== "replace") {
    return NextResponse.json({ error: "mode must be 'skip' or 'replace'" }, { status: 400 });
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  if (fresh.length) {
    await Subject.insertMany(
      fresh.map((x) => ({ ...x, isActive: true })),
      { ordered: false }
    );
    created = fresh.length;
  }

  if (duplicates.length) {
    if (mode === "skip") {
      skipped = duplicates.length;
    } else {
      const ops = duplicates.map((x) => {
        const set: any = {};
        if (x.titleEn) set.titleEn = x.titleEn;
        if (x.titleHi) set.titleHi = x.titleHi;

        // replace other only if provided
        if (x.otherLangName) set.otherLangName = x.otherLangName;
        if (x.titleOther) set.titleOther = x.titleOther;

        return { updateOne: { filter: { code: x.code }, update: { $set: set }, upsert: false } };
      });

      const r = await Subject.bulkWrite(ops, { ordered: false });
      updated = Number(r.modifiedCount || 0);
    }
  }

  return NextResponse.json(
    {
      dryRun: false,
      message: "Bulk upload applied",
      summary: { totalCodes: aggregated.length, created, updated, skipped },
    },
    { status: 200 }
  );
}
