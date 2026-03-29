// app/api/admin/promo-codes/route.ts
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

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error) return safeStr(err.message) || fallback;
  if (typeof err === "string") return safeStr(err) || fallback;

  if (err && typeof err === "object" && "message" in err) {
    return safeStr((err as { message?: unknown }).message) || fallback;
  }

  return fallback;
}

function parseCsv(input: any, upper = false) {
  return Array.from(
    new Set(
      safeStr(input)
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => (upper ? x.toUpperCase() : x))
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

function buildPayload(body: any, adminId: string, isPatch = false) {
  const payload: any = {};

  const set = (key: string, value: any) => {
    if (!isPatch || value !== undefined) payload[key] = value;
  };

  set("code", body?.code !== undefined ? safeStr(body.code).toUpperCase() : undefined);
  set("title", body?.title !== undefined ? safeStr(body.title) : undefined);
  set("description", body?.description !== undefined ? safeStr(body.description) : undefined);
  set("badgeText", body?.badgeText !== undefined ? safeStr(body.badgeText) : undefined);

  set("isActive", body?.isActive !== undefined ? !!body.isActive : undefined);
  set(
    "startsAt",
    body?.startsAt !== undefined ? (safeStr(body.startsAt) ? new Date(body.startsAt) : null) : undefined
  );
  set(
    "endsAt",
    body?.endsAt !== undefined ? (safeStr(body.endsAt) ? new Date(body.endsAt) : null) : undefined
  );

  set("discountType", body?.discountType !== undefined ? safeStr(body.discountType).toLowerCase() : undefined);
  set("discountValue", body?.discountValue !== undefined ? safeNum(body.discountValue, 0) : undefined);
  set(
    "maxDiscountAmount",
    body?.maxDiscountAmount !== undefined ? safeNum(body.maxDiscountAmount, 0) : undefined
  );

  set(
    "totalUsageLimit",
    body?.totalUsageLimit !== undefined ? Math.max(0, Math.trunc(safeNum(body.totalUsageLimit, 0))) : undefined
  );
  set(
    "perUserUsageLimit",
    body?.perUserUsageLimit !== undefined ? Math.max(0, Math.trunc(safeNum(body.perUserUsageLimit, 1))) : undefined
  );

  set("firstOrderOnly", body?.firstOrderOnly !== undefined ? !!body.firstOrderOnly : undefined);
  set("minOrderAmount", body?.minOrderAmount !== undefined ? safeNum(body.minOrderAmount, 0) : undefined);
  set(
    "minCartQuantity",
    body?.minCartQuantity !== undefined ? Math.max(0, Math.trunc(safeNum(body.minCartQuantity, 0))) : undefined
  );
  set(
    "minDistinctProducts",
    body?.minDistinctProducts !== undefined
      ? Math.max(0, Math.trunc(safeNum(body.minDistinctProducts, 0)))
      : undefined
  );
  set(
    "minDistinctCategories",
    body?.minDistinctCategories !== undefined
      ? Math.max(0, Math.trunc(safeNum(body.minDistinctCategories, 0)))
      : undefined
  );

  set("allowCombos", body?.allowCombos !== undefined ? !!body.allowCombos : undefined);
  set("allowResellers", body?.allowResellers !== undefined ? !!body.allowResellers : undefined);
  set("isAutoApply", body?.isAutoApply !== undefined ? !!body.isAutoApply : undefined);
  set("isStackable", body?.isStackable !== undefined ? !!body.isStackable : undefined);

  set(
    "allowedCategories",
    body?.allowedCategories !== undefined
      ? Array.isArray(body.allowedCategories)
        ? body.allowedCategories
        : parseCsv(body.allowedCategories)
      : undefined
  );
  set(
    "blockedCategories",
    body?.blockedCategories !== undefined
      ? Array.isArray(body.blockedCategories)
        ? body.blockedCategories
        : parseCsv(body.blockedCategories)
      : undefined
  );
  set(
    "allowedProductIds",
    body?.allowedProductIds !== undefined
      ? Array.isArray(body.allowedProductIds)
        ? body.allowedProductIds
        : parseCsv(body.allowedProductIds)
      : undefined
  );
  set(
    "blockedProductIds",
    body?.blockedProductIds !== undefined
      ? Array.isArray(body.blockedProductIds)
        ? body.blockedProductIds
        : parseCsv(body.blockedProductIds)
      : undefined
  );
  set(
    "requiredProductIds",
    body?.requiredProductIds !== undefined
      ? Array.isArray(body.requiredProductIds)
        ? body.requiredProductIds
        : parseCsv(body.requiredProductIds)
      : undefined
  );
  set(
    "requiredCategoryRules",
    body?.requiredCategoryRules !== undefined
      ? parseRequiredCategoryRules(body.requiredCategoryRules)
      : undefined
  );

  set("customerTag", body?.customerTag !== undefined ? safeStr(body.customerTag) : undefined);
  set("priority", body?.priority !== undefined ? Math.trunc(safeNum(body.priority, 0)) : undefined);
  set("publicNote", body?.publicNote !== undefined ? safeStr(body.publicNote) : undefined);
  set("internalNote", body?.internalNote !== undefined ? safeStr(body.internalNote) : undefined);

  if (isPatch) {
    payload.updatedBy = adminId;
  } else {
    payload.createdBy = adminId;
    payload.updatedBy = adminId;
  }

  return payload;
}

export async function GET(req: NextRequest) {
  try {
    const { denied } = await getAdminOrFail();
    if (denied) return denied;

    await dbConnect();

    const { searchParams } = new URL(req.url);
    const q = safeStr(searchParams.get("q"));
    const status = safeStr(searchParams.get("status")).toLowerCase();
    const page = Math.max(1, Math.trunc(safeNum(searchParams.get("page"), 1)));
    const limit = Math.min(100, Math.max(1, Math.trunc(safeNum(searchParams.get("limit"), 20))));
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (q) {
      filter.$or = [
        { code: { $regex: q, $options: "i" } },
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ];
    }

    if (status === "active") filter.isActive = true;
    if (status === "inactive") filter.isActive = false;

    const [items, total] = await Promise.all([
      PromoCode.find(filter)
        .sort({ priority: -1, createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PromoCode.countDocuments(filter),
    ]);

    return NextResponse.json({
      ok: true,
      items: items || [],
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(err, "Failed to load promo codes") },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { denied, auth } = await getAdminOrFail();
    if (denied || !auth) return denied!;

    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const adminId = safeStr(auth?.decoded?.email || auth?.decoded?.sub || "admin");
    const payload = buildPayload(body, adminId, false);

    if (!safeStr(payload.code)) {
      return NextResponse.json({ error: "Promo code is required" }, { status: 400 });
    }

    if (!safeStr(payload.title)) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (!(safeNum(payload.discountValue, 0) > 0)) {
      return NextResponse.json({ error: "Discount value must be greater than 0" }, { status: 400 });
    }

    const exists = await PromoCode.findOne({ code: payload.code }).lean();
    if (exists) {
      return NextResponse.json({ error: "Promo code already exists" }, { status: 409 });
    }

    const saved = await PromoCode.create(payload);

    return NextResponse.json({ ok: true, item: saved }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(err, "Failed to create promo code") },
      { status: 500 }
    );
  }
}