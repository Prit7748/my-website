import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";

function safeStr(x: any) {
  return String(x || "").trim();
}

function normalizeCourse(code: string) {
  return safeStr(code).toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9]/g, "");
}

export async function GET(request: Request) {
  await dbConnect();

  const url = new URL(request.url);
  const search = safeStr(url.searchParams.get("search")).toLowerCase();
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") || 300)));

  // Only active products
  const match: any = { $or: [{ isActive: true }, { isActive: { $exists: false } }] };

  const pipeline: any[] = [
    { $match: match },
    { $project: { courseCodes: 1, courseTitles: 1 } },
    { $unwind: "$courseCodes" },
    {
      $group: {
        _id: "$courseCodes",
        count: { $sum: 1 },
        // optional: first title from courseTitles[0] if exists
        title: { $first: { $arrayElemAt: ["$courseTitles", 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        code: "$_id",
        title: { $ifNull: ["$title", ""] },
        count: 1,
      },
    },
  ];

  let rows: any[] = await Product.aggregate(pipeline);

  // Normalize + cleanup
  rows = rows
    .map((r) => ({
      code: normalizeCourse(r.code),
      title: safeStr(r.title),
      count: Number(r.count || 0),
    }))
    .filter((r) => r.code);

  // Merge duplicates after normalization
  const map = new Map<string, { code: string; title: string; count: number }>();
  for (const r of rows) {
    const prev = map.get(r.code);
    if (!prev) map.set(r.code, r);
    else map.set(r.code, { code: r.code, title: prev.title || r.title, count: prev.count + r.count });
  }

  let courses = Array.from(map.values());

  // Search filter
  if (search) {
    courses = courses.filter((c) => {
      const hay = `${c.code} ${c.title}`.toLowerCase();
      return hay.includes(search);
    });
  }

  // Sort A-Z
  courses.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  courses = courses.slice(0, limit);

  return NextResponse.json(
    {
      courses,
      meta: {
        total: courses.length,
      },
    },
    { status: 200 }
  );
}
