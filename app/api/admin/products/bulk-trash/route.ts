import { NextRequest, NextResponse } from "next/server";

import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import { getAuthUser, hasPermission } from "@/lib/auth";
import { syncGeneratedCombosForProductChange } from "@/lib/comboAutoSync";
import { syncGeneratedHardcopyForProductChange } from "@/lib/hardcopyAutoSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

async function assertAdminWriteAccess() {
  const user = await getAuthUser();

  if (!user) {
    return {
      ok: false as const,
      res: NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 }),
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

export async function POST(req: NextRequest) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = safeStr(body?.action).toLowerCase();
  const confirmText = safeStr(body?.confirmText);

  if (action !== "purge_all") {
    return NextResponse.json(
      { ok: false, error: "Unsupported action" },
      { status: 400 }
    );
  }

  if (confirmText !== "DELETE ALL TRASH PRODUCTS") {
    return NextResponse.json(
      {
        ok: false,
        error: 'Confirmation text mismatch. Type exactly: DELETE ALL TRASH PRODUCTS',
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const trashedProducts: any[] = await Product.find({
    deletedAt: { $ne: null },
  }).lean();

  if (!trashedProducts.length) {
    return NextResponse.json(
      {
        ok: true,
        message: "Trash is already empty.",
        deletedCount: 0,
        comboSync: { ok: true, skipped: true },
        hardcopySync: { ok: true, skipped: true },
      },
      { status: 200 }
    );
  }

  const ids = trashedProducts.map((p) => p._id);

  const deleteResult = await Product.deleteMany({
    _id: { $in: ids },
    deletedAt: { $ne: null },
  });

  let comboSync: any = { ok: true, skipped: true };
  let hardcopySync: any = { ok: true, skipped: true };

  try {
    const beforeSamples = trashedProducts.slice(0, 100);
    for (const before of beforeSamples) {
      await syncGeneratedCombosForProductChange({ before });
    }
    comboSync = {
      ok: true,
      sampled: beforeSamples.length,
      reason: "Generated combo sync executed for deleted product samples.",
    };
  } catch (error: any) {
    comboSync = {
      ok: false,
      error: safeStr(error?.message || "Combo sync failed"),
    };
  }

  try {
    const beforeSamples = trashedProducts.slice(0, 100);
    for (const before of beforeSamples) {
      await syncGeneratedHardcopyForProductChange({ before });
    }
    hardcopySync = {
      ok: true,
      sampled: beforeSamples.length,
      reason: "Generated hardcopy sync executed for deleted product samples.",
    };
  } catch (error: any) {
    hardcopySync = {
      ok: false,
      error: safeStr(error?.message || "Hardcopy sync failed"),
    };
  }

  return NextResponse.json(
    {
      ok: true,
      message: "All trashed products permanently deleted.",
      deletedCount: Number(deleteResult?.deletedCount || 0),
      comboSync,
      hardcopySync,
    },
    { status: 200 }
  );
}