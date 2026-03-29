import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import PromoCode from "@/models/PromoCode";
import { requireAdmin } from "@/lib/adminAuth";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function parseCsv(input: any) {
  return Array.from(
    new Set(
      safeStr(input)
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    )
  );
}

function parseRequiredCategoryRules(input: any) {
  const rows = Array.isArray(input)
    ? input
    : safeStr(input)
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean)
        .map((line) => {
          const [categoryKey, minQtyRaw] = line.split("|");
          return { categoryKey: safeStr(categoryKey), minQty: safeNum(minQtyRaw, 1) };
        });

  return rows
    .map((x: any) => ({
      categoryKey: safeStr(x?.categoryKey),
      minQty: Math.max(1, Math.trunc(safeNum(x?.minQty, 1))),
    }))
    .filter((x: any) => x.categoryKey);
}

async function getAdminOrFail() {
  const auth = await requireAdmin();

  if (!auth.ok) {
    return {
      denied: NextResponse.json({ error: auth.error }, { status: auth.status }),
      auth: null,
    };
  }

  return { denied: null, auth };
}

function buildPatch(body: any, adminId: string) {
  const patch: any = {};

  if (body?.code !== undefined) patch.code = safeStr(body.code).toUpperCase();
  if (body?.title !== undefined) patch.title = safeStr(body.title);
  if (body?.description !== undefined) patch.description = safeStr(body.description);
  if (body?.badgeText !== undefined) patch.badgeText = safeStr(body.badgeText);

  if (body?.isActive !== undefined) patch.isActive = !!body.isActive;
  if (body?.startsAt !== undefined) patch.startsAt = safeStr(body.startsAt) ? new Date(body.startsAt) : null;
  if (body?.endsAt !== undefined) patch.endsAt = safeStr(body.endsAt) ? new Date(body.endsAt) : null;

  if (body?.discountType !== undefined) patch.discountType = safeStr(body.discountType).toLowerCase();
  if (body?.discountValue !== undefined) patch.discountValue = safeNum(body.discountValue, 0);
  if (body?.maxDiscountAmount !== undefined) patch.maxDiscountAmount = safeNum(body.maxDiscountAmount, 0);

  if (body?.totalUsageLimit !== undefined) patch.totalUsageLimit = Math.max(0, Math.trunc(safeNum(body.totalUsageLimit, 0)));
  if (body?.perUserUsageLimit !== undefined) patch.perUserUsageLimit = Math.max(0, Math.trunc(safeNum(body.perUserUsageLimit, 1)));

  if (body?.firstOrderOnly !== undefined) patch.firstOrderOnly = !!body.firstOrderOnly;
  if (body?.minOrderAmount !== undefined) patch.minOrderAmount = safeNum(body.minOrderAmount, 0);
  if (body?.minCartQuantity !== undefined) patch.minCartQuantity = Math.max(0, Math.trunc(safeNum(body.minCartQuantity, 0)));
  if (body?.minDistinctProducts !== undefined) patch.minDistinctProducts = Math.max(0, Math.trunc(safeNum(body.minDistinctProducts, 0)));
  if (body?.minDistinctCategories !== undefined) patch.minDistinctCategories = Math.max(0, Math.trunc(safeNum(body.minDistinctCategories, 0)));

  if (body?.allowCombos !== undefined) patch.allowCombos = !!body.allowCombos;
  if (body?.allowResellers !== undefined) patch.allowResellers = !!body.allowResellers;
  if (body?.isAutoApply !== undefined) patch.isAutoApply = !!body.isAutoApply;
  if (body?.isStackable !== undefined) patch.isStackable = !!body.isStackable;

  if (body?.allowedCategories !== undefined) patch.allowedCategories = Array.isArray(body.allowedCategories) ? body.allowedCategories : parseCsv(body.allowedCategories);
  if (body?.blockedCategories !== undefined) patch.blockedCategories = Array.isArray(body.blockedCategories) ? body.blockedCategories : parseCsv(body.blockedCategories);
  if (body?.allowedProductIds !== undefined) patch.allowedProductIds = Array.isArray(body.allowedProductIds) ? body.allowedProductIds : parseCsv(body.allowedProductIds);
  if (body?.blockedProductIds !== undefined) patch.blockedProductIds = Array.isArray(body.blockedProductIds) ? body.blockedProductIds : parseCsv(body.blockedProductIds);
  if (body?.requiredProductIds !== undefined) patch.requiredProductIds = Array.isArray(body.requiredProductIds) ? body.requiredProductIds : parseCsv(body.requiredProductIds);
  if (body?.requiredCategoryRules !== undefined) patch.requiredCategoryRules = parseRequiredCategoryRules(body.requiredCategoryRules);

  if (body?.customerTag !== undefined) patch.customerTag = safeStr(body.customerTag);
  if (body?.priority !== undefined) patch.priority = Math.trunc(safeNum(body.priority, 0));
  if (body?.publicNote !== undefined) patch.publicNote = safeStr(body.publicNote);
  if (body?.internalNote !== undefined) patch.internalNote = safeStr(body.internalNote);

  patch.updatedBy = adminId;

  return patch;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { denied } = await getAdminOrFail();
    if (denied) return denied;

    await dbConnect();

    const { id } = await ctx.params;
    const item = await PromoCode.findById(id).lean();

    if (!item) {
      return NextResponse.json({ error: "Promo code not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load promo code" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { denied, auth } = await getAdminOrFail();
    if (denied || !auth) return denied!;

    await dbConnect();

    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const adminId = safeStr(auth?.decoded?.email || auth?.decoded?.sub || "admin");
    const patch = buildPatch(body, adminId);

    if (patch.code) {
      const exists = await PromoCode.findOne({ code: patch.code, _id: { $ne: id } }).lean();
      if (exists) {
        return NextResponse.json({ error: "Another promo code already uses this code" }, { status: 409 });
      }
    }

    const updated = await PromoCode.findByIdAndUpdate(id, { $set: patch }, { new: true });

    if (!updated) {
      return NextResponse.json({ error: "Promo code not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to update promo code" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { denied } = await getAdminOrFail();
    if (denied) return denied;

    await dbConnect();

    const { id } = await ctx.params;
    const deleted = await PromoCode.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json({ error: "Promo code not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to delete promo code" }, { status: 500 });
  }
}