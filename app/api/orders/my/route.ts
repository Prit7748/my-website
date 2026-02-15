// app/api/orders/my/route.ts  (NEW FILE) - Dashboard ke liye purchased list
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import Order from "@/models/Order";

export const runtime = "nodejs";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  await dbConnect();

  const now = new Date();

  const orders = await Order.find({
    userId: user.id,
    status: "paid",
    expiresAt: { $gt: now },
  })
    .select("items totalAmount currency paidAt expiresAt createdAt orderRef")
    .sort({ paidAt: -1, createdAt: -1 })
    .limit(100)
    .lean();

  return NextResponse.json({ ok: true, orders }, { status: 200 });
}
