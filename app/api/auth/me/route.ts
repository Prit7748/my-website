import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import { getPublicResellerSnapshot } from "@/lib/reseller";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "JWT secret missing" }, { status: 500 });
    }

    const decoded: any = jwt.verify(token, secret);

    await dbConnect();

    const user: any = await User.findById(decoded.sub).select(
      [
        "name",
        "email",
        "phone",
        "role",
        "permissions",
        "createdAt",
        "updatedAt",
        "reseller",
      ].join(" ")
    );

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const reseller = getPublicResellerSnapshot(user);

    return NextResponse.json(
      {
        user: {
          _id: String(user._id),
          name: safeStr(user.name),
          email: safeStr(user.email),
          phone: safeStr(user.phone),
          role: safeStr(user.role || "user"),
          permissions: Array.isArray(user.permissions) ? user.permissions : [],
          createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : null,
          updatedAt: user.updatedAt ? new Date(user.updatedAt).toISOString() : null,
          reseller,
        },
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}