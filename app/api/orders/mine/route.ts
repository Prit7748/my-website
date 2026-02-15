// app/api/orders/mine/route.ts  (NEW FILE)
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";

function asInt(x: any, def: number) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(20, Math.max(1, asInt(url.searchParams.get("limit"), 8)));

  await dbConnect();

  const orders: any[] = await Order.find({ userId: user.id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("status items totalAmount currency paidAt expiresAt createdAt")
    .lean();

  // Flatten items for dashboard convenience
  const items: any[] = [];
  for (const o of orders) {
    const orderId = String(o?._id || "");
    const status = String(o?.status || "pending");
    const currency = String(o?.currency || "INR");
    const paidAt = o?.paidAt ? new Date(o.paidAt).toISOString() : null;
    const expiresAt = o?.expiresAt ? new Date(o.expiresAt).toISOString() : null;

    const its = Array.isArray(o?.items) ? o.items : [];
    for (const it of its) {
      items.push({
        orderId,
        status,
        currency,
        paidAt,
        expiresAt,
        productId: String(it?.productId || ""),
        title: String(it?.title || ""),
        category: String(it?.category || ""),
        price: Number(it?.price || 0),
      });
    }
  }

  return NextResponse.json({ ok: true, items }, { status: 200 });
}
