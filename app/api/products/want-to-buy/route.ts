import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import WantToBuy from "@/models/WantToBuy";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";

function asString(x: any) {
  return String(x ?? "").trim();
}

function normEmail(x: any) {
  return asString(x).toLowerCase();
}

function normAvail(v?: string) {
  return asString(v).toLowerCase();
}

function isWantToBuyAvailability(v?: string) {
  const a = normAvail(v);
  return (
    a === "want_to_buy" ||
    a === "wanttobuy" ||
    a === "want-to-buy" ||
    a === "out_of_stock" ||
    a === "outofstock" ||
    a === "out-of-stock"
  );
}

function clientIp(req: Request) {
  const xf =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "";
  return xf.split(",")[0]?.trim() || "unknown";
}

function userAgent(req: Request) {
  return asString(req.headers.get("user-agent"));
}

function guestFingerprint(req: Request) {
  return `guest:${clientIp(req)}:${userAgent(req)}`;
}

export async function POST(req: Request) {
  const user = await getAuthUser().catch(() => null);
  const body = await req.json().catch(() => ({}));

  const productId = asString(body?.productId);
  const message = asString(body?.message);
  const phone = asString(body?.phone);
  const email = normEmail(body?.email) || normEmail(user?.email);

  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    return NextResponse.json({ error: "Invalid productId" }, { status: 400 });
  }

  await dbConnect();

  const p: any = await Product.findById(productId)
    .select("title slug category price isActive availability")
    .lean();

  if (!p || p?.isActive === false) {
    return NextResponse.json({ error: "Product not found / inactive" }, { status: 404 });
  }

  if (!isWantToBuyAvailability(p?.availability)) {
    return NextResponse.json(
      {
        error: "Want to Buy is only available for products marked as Want to Buy.",
      },
      { status: 400 }
    );
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const activeStatusQuery = { $in: ["new", "contacted"] };

  if (user?.id && mongoose.Types.ObjectId.isValid(user.id)) {
    const existingByUser = await WantToBuy.findOne({
      productId: new mongoose.Types.ObjectId(productId),
      userId: new mongoose.Types.ObjectId(user.id),
      status: activeStatusQuery,
      createdAt: { $gte: since },
    }).lean();

    if (existingByUser) {
      return NextResponse.json(
        {
          ok: true,
          message:
            "Request already received. We are processing your submission and will upload the product shortly. Keep an eye on our website for updates.",
        },
        { status: 200 }
      );
    }
  }

  if (email) {
    const existingByEmail = await WantToBuy.findOne({
      productId: new mongoose.Types.ObjectId(productId),
      userEmail: email,
      status: activeStatusQuery,
      createdAt: { $gte: since },
    }).lean();

    if (existingByEmail) {
      return NextResponse.json(
        {
          ok: true,
          message:
            "Request already received. We are processing your submission and will upload the product shortly. Keep an eye on our website for updates.",
        },
        { status: 200 }
      );
    }
  }

  const fingerprint = !user?.id && !email ? guestFingerprint(req) : "";

  if (fingerprint) {
    const existingGuest = await WantToBuy.findOne({
      productId: new mongoose.Types.ObjectId(productId),
      fingerprint,
      status: activeStatusQuery,
      createdAt: { $gte: since },
    }).lean();

    if (existingGuest) {
      return NextResponse.json(
        {
          ok: true,
          message:
            "Request already received. We are processing your submission and will upload the product shortly. Keep an eye on our website for updates.",
        },
        { status: 200 }
      );
    }
  }

  await WantToBuy.create({
    userId:
      user?.id && mongoose.Types.ObjectId.isValid(user.id)
        ? new mongoose.Types.ObjectId(user.id)
        : null,
    userEmail: email || "",
    productId: new mongoose.Types.ObjectId(productId),
    productSlug: asString(p.slug),
    productTitle: asString(p.title),
    category: asString(p.category),
    price: Number(p.price || 0),
    message,
    phone: phone || "",
    fingerprint,
    status: "new",
  });

  return NextResponse.json(
    {
      ok: true,
      message:
        "Request Received. We are processing your submission and will upload the product shortly. Keep an eye on our website for updates.",
    },
    { status: 200 }
  );
}