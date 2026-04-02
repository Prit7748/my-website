import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Course from "@/models/Course";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeText(x: any) {
  return String(x ?? "").trim();
}

function normCode(code: any) {
  return safeText(code).replace(/\s+/g, " ").toUpperCase();
}

type Row = {
  code: string;
  title: string;
};

type AggregatedRow = {
  rowNumber: number;
  code: string;
  title: string;
};

function aggregate(rows: Row[]) {
  const map = new Map<string, AggregatedRow>();
  const invalidRows: Array<{ rowNumber: number; reason: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i] || { code: "", title: "" };
    const rowNumber = i + 1;
    const code = normCode(raw.code);
    const title = safeText(raw.title);

    if (!code && !title) {
      invalidRows.push({ rowNumber, reason: "Code and title both empty" });
      continue;
    }
    if (!code) {
      invalidRows.push({ rowNumber, reason: "Code missing" });
      continue;
    }
    if (!title) {
      invalidRows.push({ rowNumber, reason: "Title missing" });
      continue;
    }

    // last wins
    map.set(code, { rowNumber, code, title });
  }

  return {
    aggregated: Array.from(map.values()),
    invalidRows,
  };
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    await dbConnect();

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const mode = safeText(body?.mode).toLowerCase(); // skip | replace
    const dryRun = Boolean(body?.dryRun ?? true);
    const rows: Row[] = Array.isArray(body?.rows) ? body.rows : [];

    if (!rows.length) {
      return NextResponse.json({ error: "rows are required" }, { status: 400 });
    }

    const { aggregated, invalidRows } = aggregate(rows);

    if (!aggregated.length) {
      return NextResponse.json({ error: "No valid rows found" }, { status: 400 });
    }

    const codes = aggregated.map((x) => x.code);
    const existing = await Course.find({ code: { $in: codes } }, { code: 1, title: 1 })
      .lean();

    const existingSet = new Set(
      existing.map((x: any) => normCode(x.code))
    );

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
          invalidCount: invalidRows.length,
          invalidRows: invalidRows.slice(0, 20),
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
      await Course.insertMany(
        fresh.map((x) => ({
          code: x.code,
          title: x.title,
          isActive: true,
        })),
        { ordered: false }
      );
      created = fresh.length;
    }

    if (duplicates.length) {
      if (mode === "skip") {
        skipped = duplicates.length;
      } else {
        const ops = duplicates.map((x) => ({
          updateOne: {
            filter: { code: x.code },
            update: {
              $set: {
                title: x.title,
              },
            },
            upsert: false,
          },
        }));

        const result = await Course.bulkWrite(ops, { ordered: false });
        updated = Number(result.matchedCount || result.modifiedCount || 0);
      }
    }

    return NextResponse.json(
      {
        dryRun: false,
        message: "Bulk upload applied",
        summary: {
          totalCodes: aggregated.length,
          created,
          updated,
          skipped,
          invalid: invalidRows.length,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Admin courses bulk POST error:", error);
    return NextResponse.json(
      { error: error?.message || "Bulk upload failed" },
      { status: 500 }
    );
  }
}