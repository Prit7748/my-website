// app/api/promo-codes/validate/route.ts
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { evaluatePromoCode } from "@/lib/promoEngine";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const coupon = safeStr(body?.coupon).toUpperCase();
    const items = Array.isArray(body?.items) ? body.items : [];

    await dbConnect();

    const result = await evaluatePromoCode({
      coupon,
      items,
      userId: safeStr(user.id),
      isReseller: Boolean(user?.reseller?.isReseller),
    });

    return NextResponse.json({
      ok: true,
      valid: Boolean(result.valid),
      code: result.code,
      reason: result.reason,
      discountAmount: safeNum(result.discountAmount, 0),
      eligibleSubtotal: safeNum(result.eligibleSubtotal, 0),
      cartSubtotal: safeNum(result.cartSubtotal, 0),
      finalTotal: safeNum(result.finalTotal, 0),
      matchedProductIds: Array.isArray(result.matchedProductIds) ? result.matchedProductIds : [],
      matchedCategories: Array.isArray(result.matchedCategories) ? result.matchedCategories : [],
      promo: result.promo,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: safeStr(e?.message) || "Promo validation failed" },
      { status: 500 }
    );
  }
}