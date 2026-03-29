import { NextRequest, NextResponse } from "next/server";
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

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!hasPermission(user, "products:read") && !hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();

  const url = new URL(req.url);
  const q = safeStr(url.searchParams.get("q")).toLowerCase();
  const status = safeStr(url.searchParams.get("status")).toLowerCase();

  const matchStage: any = {};
  if (status && ["new", "contacted", "closed"].includes(status)) {
    matchStage.status = status;
  }

  const rows = await WantToBuy.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$productId",
        totalEnquiries: { $sum: 1 },
        uniqueEmails: { $addToSet: "$userEmail" },
        pending: {
          $sum: {
            $cond: [{ $eq: ["$status", "new"] }, 1, 0],
          },
        },
        latestAt: { $max: "$createdAt" },
        productTitle: { $first: "$productTitle" },
        productSlug: { $first: "$productSlug" },
        category: { $first: "$category" },
      },
    },
    { $sort: { latestAt: -1, _id: -1 } },
  ]);

  const productIds = rows.map((x: any) => x._id).filter(Boolean);

  const products = await Product.find({ _id: { $in: productIds } })
    .select("_id sku slug category title")
    .lean();

  const productMap = new Map<string, any>();
  for (const p of products) {
    productMap.set(String((p as any)._id), p);
  }

  let items = rows.map((row: any) => {
    const product = productMap.get(String(row._id));

    return {
      productId: String(row._id),
      uniqueProductId: safeStr(product?.sku) || safeStr(row.productSlug) || String(row._id),
      productName: safeStr(product?.title) || safeStr(row.productTitle),
      productSlug: safeStr(product?.slug) || safeStr(row.productSlug),
      category: safeStr(product?.category) || safeStr(row.category),
      totalEnquiries: Number(row.totalEnquiries || 0),
      uniqueCustomers: (Array.isArray(row.uniqueEmails) ? row.uniqueEmails : []).filter((x: any) => safeStr(x)).length,
      pending: Number(row.pending || 0),
      latestAt: row.latestAt || null,
    };
  });

  if (q) {
    items = items.filter((item: any) => {
      const hay =
        [
          item.productName,
          item.productSlug,
          item.uniqueProductId,
          item.category,
        ]
          .join(" ")
          .toLowerCase();

      return hay.includes(q);
    });
  }

  const totalProducts = items.length;
  const totalEnquiries = items.reduce((acc: number, item: any) => acc + Number(item.totalEnquiries || 0), 0);

  return NextResponse.json(
    {
      ok: true,
      items,
      stats: {
        totalProducts,
        totalEnquiries,
      },
      filters: {
        q: safeStr(url.searchParams.get("q")),
        status: status || "",
      },
    },
    { status: 200 }
  );
}