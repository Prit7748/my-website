import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt, { Secret, SignOptions } from "jsonwebtoken";
import dbConnect from "@/lib/db";
import User from "@/models/User";

export const runtime = "nodejs";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function normalizeEmail(x: any) {
  return safeStr(x).toLowerCase();
}

function isPrivilegedRole(role: string) {
  const r = safeStr(role).toLowerCase();
  return r === "admin" || r === "co_admin" || r === "master_admin";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const email = normalizeEmail(body?.email);
    const password = safeStr(body?.password);
    const adminKey = safeStr(body?.adminKey);

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    await dbConnect();

    const user: any = await User.findOne({ email }).lean();

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

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

    const role = safeStr(user.role || "user") || "user";

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
        { error: "JWT_SECRET missing in environment variables" },
        { status: 500 }
      );
    }

    const isAdminSession = isPrivilegedRole(role);
    const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
    const options: SignOptions = { expiresIn: expiresIn as any };

    const token = jwt.sign(
      {
        sub: String(user._id),
        email: safeStr(user.email),
        role,
      },
      secret as Secret,
      options
    );

    const res = NextResponse.json(
      {
        message: "Login successful",
        sessionType: isAdminSession ? "browser-session" : "persistent",
        user: {
          id: String(user._id),
          name: safeStr(user.name),
          email: safeStr(user.email),
          role,
        },
      },
      { status: 200 }
    );

    if (isAdminSession) {
      res.cookies.set("token", token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      });
    } else {
      res.cookies.set("token", token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
        secure: process.env.NODE_ENV === "production",
      });
    }

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}