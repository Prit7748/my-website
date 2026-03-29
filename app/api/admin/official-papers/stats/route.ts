import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import OfficialPaper from "@/models/OfficialPaper";
import PdfVaultFile from "@/models/PdfVaultFile";
import { getAuthUser, hasPermission } from "@/lib/auth";

export const runtime = "nodejs";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

async function assertAdminWriteAccess() {
  const user = await getAuthUser();

  if (!user) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  if (!hasPermission(user, "products:write")) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, user };
}

export async function GET(_req: NextRequest) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  await dbConnect();

  const [liveOfficialRows, liveSolvedRows, latestOfficialPaper] = await Promise.all([
    OfficialPaper.find({ deletedAt: null })
      .select("skuNormalized productExists uploadedAt")
      .lean(),
    PdfVaultFile.find({ deletedAt: null }).select("skuNormalized").lean(),
    OfficialPaper.findOne({ deletedAt: null })
      .sort({ uploadedAt: -1, _id: -1 })
      .select("uploadedAt fileName skuNormalized")
      .lean(),
  ]);

  const solvedSkuSet = new Set(
    (Array.isArray(liveSolvedRows) ? liveSolvedRows : [])
      .map((x: any) => safeStr(x?.skuNormalized).toUpperCase())
      .filter(Boolean)
  );

  const liveOfficialList = Array.isArray(liveOfficialRows) ? liveOfficialRows : [];

  const onlyUnsolvedWithoutSolvedCount = liveOfficialList.filter((row: any) => {
    const sku = safeStr(row?.skuNormalized).toUpperCase();
    return sku && !solvedSkuSet.has(sku);
  }).length;

  const matchedProductsCount = liveOfficialList.filter((row: any) => Boolean(row?.productExists)).length;
  const unmatchedProductsCount = liveOfficialList.filter((row: any) => !Boolean(row?.productExists)).length;

  return NextResponse.json(
    {
      ok: true,
      stats: {
        totalLiveOfficialPapers: liveOfficialList.length,
        onlyUnsolvedWithoutSolvedCount,
        matchedProductsCount,
        unmatchedProductsCount,
        lastUploadDate: latestOfficialPaper?.uploadedAt || null,
        lastUploadFileName: safeStr((latestOfficialPaper as any)?.fileName),
        lastUploadSku: safeStr((latestOfficialPaper as any)?.skuNormalized),
      },
    },
    { status: 200 }
  );
}