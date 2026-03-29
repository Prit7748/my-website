import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import WantToBuy from "@/models/WantToBuy";
import Product from "@/models/Product";
import { getAuthUser, hasPermission } from "@/lib/auth";

export const runtime = "nodejs";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ productId: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!hasPermission(user, "products:read") && !hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { productId } = await ctx.params;
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return NextResponse.json({ error: "Invalid productId" }, { status: 400 });
  }

  await dbConnect();

  const url = new URL(req.url);
  const status = safeStr(url.searchParams.get("status")).toLowerCase();
  const page = Math.max(1, Math.trunc(safeNum(url.searchParams.get("page"), 1)));
  const limit = Math.min(200, Math.max(1, Math.trunc(safeNum(url.searchParams.get("limit"), 100))));
  const skip = (page - 1) * limit;

  const query: any = {
    productId: new mongoose.Types.ObjectId(productId),
  };

  if (status && ["new", "contacted", "closed"].includes(status)) {
    query.status = status;
  }

  const [product, enquiries, total, totalPending, uniqueCustomersAgg] = await Promise.all([
    Product.findById(productId)
      .select("_id title slug category price deletedAt isActive")
      .lean(),

    WantToBuy.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    WantToBuy.countDocuments(query),

    WantToBuy.countDocuments({
      productId: new mongoose.Types.ObjectId(productId),
      status: "new",
    }),

    WantToBuy.aggregate([
      {
        $match: {
          productId: new mongoose.Types.ObjectId(productId),
        },
      },
      {
        $group: {
          _id: "$userEmail",
        },
      },
      {
        $match: {
          _id: { $ne: "" },
        },
      },
      {
        $count: "count",
      },
    ]),
  ]);

  return NextResponse.json(
    {
      ok: true,
      product: product
        ? {
            _id: String((product as any)._id),
            title: safeStr((product as any).title),
            slug: safeStr((product as any).slug),
            category: safeStr((product as any).category),
            price: Number((product as any).price || 0),
            deletedAt: (product as any).deletedAt || null,
            isActive: !!(product as any).isActive,
          }
        : null,
      enquiries: (enquiries || []).map((x: any) => ({
        _id: String(x._id),
        userId: x.userId ? String(x.userId) : "",
        userEmail: safeStr(x.userEmail),
        phone: safeStr(x.phone),
        message: safeStr(x.message),
        status: safeStr(x.status || "new"),
        productId: x.productId ? String(x.productId) : "",
        productSlug: safeStr(x.productSlug),
        productTitle: safeStr(x.productTitle),
        category: safeStr(x.category),
        price: Number(x.price || 0),
        createdAt: x.createdAt || null,
        updatedAt: x.updatedAt || null,
      })),
      meta: {
        page,
        limit,
        total,
        totalPending,
        uniqueCustomers: Number(uniqueCustomersAgg?.[0]?.count || 0),
      },
      filters: {
        status: status || "",
      },
    },
    { status: 200 }
  );
}