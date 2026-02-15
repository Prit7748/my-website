// app/api/cron/purge-trash/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return false;

  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  const days30 = 30 * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - days30);

  const query = { deletedAt: { $ne: null, $lt: cutoff } };

  if (dryRun) {
    const count = await Product.countDocuments(query);
    return NextResponse.json({
      ok: true,
      mode: "dryRun",
      cutoffISO: cutoff.toISOString(),
      wouldDelete: count,
    });
  }

  const result = await Product.deleteMany(query);

  return NextResponse.json({
    ok: true,
    mode: "delete",
    cutoffISO: cutoff.toISOString(),
    deletedCount: result.deletedCount || 0,
  });
}
