import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt, { Secret, SignOptions } from "jsonwebtoken";
import dbConnect from "@/lib/db";
import User from "@/models/User";

export const runtime = "nodejs"; // ✅ ensures bcrypt/jwt run in node runtime

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const email = (body?.email || "").toString().trim().toLowerCase();
    const password = (body?.password || "").toString();
    const adminKey = (body?.adminKey || "").toString();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    await dbConnect();

    // ✅ lean() for faster + plain object
    const user: any = await User.findOne({ email }).lean();

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // ✅ explicit guard
    if (!user.passwordHash || typeof user.passwordHash !== "string") {
      return NextResponse.json(
        { error: "User password is not set (passwordHash missing)" },
        { status: 500 }
      );
    }

    const okPass = await bcrypt.compare(password, user.passwordHash);
    if (!okPass) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const role = (user.role || "user").toString();

    // ✅ Co-Admin requires adminKey
    if (role === "co_admin") {
      if (!user.adminKeyHash || typeof user.adminKeyHash !== "string") {
        return NextResponse.json(
          { error: "Admin key not set. Contact Master Admin." },
          { status: 403 }
        );
      }
      if (!adminKey) {
        return NextResponse.json(
          { error: "Admin key is required" },
          { status: 400 }
        );
      }
      const okKey = await bcrypt.compare(adminKey, user.adminKeyHash);
      if (!okKey) {
        return NextResponse.json({ error: "Invalid admin key" }, { status: 401 });
      }
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "JWT_SECRET missing in .env.local" },
        { status: 500 }
      );
    }

    const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
    const options: SignOptions = { expiresIn: expiresIn as any };

    const token = jwt.sign(
      { sub: String(user._id), email: user.email, role },
      secret as Secret,
      options
    );

    const res = NextResponse.json(
      {
        message: "Login successful",
        user: {
          id: String(user._id),
          name: user.name || "",
          email: user.email || "",
          role,
        },
      },
      { status: 200 }
    );

    res.cookies.set("token", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      secure: process.env.NODE_ENV === "production",
    });

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
