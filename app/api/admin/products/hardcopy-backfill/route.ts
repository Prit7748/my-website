import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, hasPermission } from "@/lib/auth";
import { backfillGeneratedHardcopies } from "@/lib/hardcopyAutoSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

async function assertAdminWriteAccess() {
  const user = await getAuthUser();

  if (!user) {
    return {
      ok: false as const,
      res: NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      ),
    };
  }

  if (!hasPermission(user, "products:write")) {
    return {
      ok: false as const,
      res: NextResponse.json(
        { ok: false, error: "Forbidden (products:write missing)" },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, user };
}

function normalizeLimit(input: any) {
  return Math.min(Math.max(Math.trunc(safeNum(input, 250)), 1), 1000);
}

function normalizeSkip(input: any) {
  return Math.max(Math.trunc(safeNum(input, 0)), 0);
}

export async function GET(req: NextRequest) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  const url = new URL(req.url);
  const dryRun =
    safeStr(url.searchParams.get("dryRun")).toLowerCase() === "1" ||
    safeStr(url.searchParams.get("dryRun")).toLowerCase() === "true";

  const limit = normalizeLimit(url.searchParams.get("limit"));
  const skip = normalizeSkip(url.searchParams.get("skip"));

  try {
    const result = await backfillGeneratedHardcopies({
      dryRun,
      limit,
      skip,
    });

    return NextResponse.json(
      {
        mode: dryRun ? "preview" : "execute",
        message: dryRun
          ? "Hardcopy backfill preview completed."
          : "Hardcopy backfill executed successfully.",
        ...result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Hardcopy backfill GET error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message || "Hardcopy backfill failed"),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const dryRun = Boolean(body?.dryRun);
  const limit = normalizeLimit(body?.limit);
  const skip = normalizeSkip(body?.skip);

  try {
    const result = await backfillGeneratedHardcopies({
      dryRun,
      limit,
      skip,
    });

    return NextResponse.json(
      {
        mode: dryRun ? "preview" : "execute",
        message: dryRun
          ? "Hardcopy backfill preview completed."
          : "Hardcopy backfill executed successfully.",
        ...result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Hardcopy backfill POST error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message || "Hardcopy backfill failed"),
      },
      { status: 500 }
    );
  }
}