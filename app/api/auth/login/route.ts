import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt, { Secret, SignOptions } from "jsonwebtoken";
import dbConnect from "@/lib/db";
import User from "@/models/User";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const email = (body?.email || "").toString().trim().toLowerCase();
    const password = (body?.password || "").toString();
    const adminKey = (body?.adminKey || "").toString(); // ✅ co_admin ke liye

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    await dbConnect();

    const user: any = await User.findOne({ email });
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const okPass = await bcrypt.compare(password, user.passwordHash);
    if (!okPass) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // ✅ Co-Admin login = password + adminKey
    const role = (user.role || "user").toString();

    if (role === "co_admin") {
      if (!user.adminKeyHash) {
        return NextResponse.json(
          { error: "Admin key not set. Contact Master Admin." },
          { status: 403 }
        );
      }
      if (!adminKey) {
        return NextResponse.json({ error: "Admin key is required" }, { status: 400 });
      }
      const okKey = await bcrypt.compare(adminKey, user.adminKeyHash);
      if (!okKey) {
        return NextResponse.json({ error: "Invalid admin key" }, { status: 401 });
      }
    }

    // master_admin: abhi normal login allowed (OTP phase baad me)
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
      { sub: user._id.toString(), email: user.email, role: role },
      secret as Secret,
      options
    );

    const res = NextResponse.json(
      {
        message: "Login successful",
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: role,
        },
      },
      { status: 200 }
    );

    // cookie set (httpOnly)
    res.cookies.set("token", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", details: err?.message || "unknown" },
      { status: 500 }
    );
  }
}
