// ✅ FILE: app/api/auth/google/route.ts (NEW)
import { NextResponse } from "next/server";
import jwt, { Secret, SignOptions } from "jsonwebtoken";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import { OAuth2Client } from "google-auth-library";

export const runtime = "nodejs";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function isAdminRole(role: string) {
  const r = (role || "").toLowerCase();
  return r === "master_admin" || r === "co_admin" || r === "admin";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const credential = safeStr(body?.credential);

    if (!credential) {
      return NextResponse.json({ error: "Google credential is required" }, { status: 400 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: "GOOGLE_CLIENT_ID missing in .env.local" },
        { status: 500 }
      );
    }

    const client = new OAuth2Client(clientId);

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    const email = String(payload?.email || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Google email not found" }, { status: 400 });
    }

    await dbConnect();

    const user: any = await User.findOne({ email }).lean();
    if (!user) {
      return NextResponse.json(
        { error: "Account not found. Please sign up with Email + Phone first." },
        { status: 409 }
      );
    }

    // ✅ phone mandatory policy guard
    if (!user.phone) {
      return NextResponse.json(
        { error: "Phone is missing in your account. Please login with password and update profile." },
        { status: 403 }
      );
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "JWT_SECRET missing in .env.local" }, { status: 500 });
    }

    const role = (user.role || "user").toString();
    const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
    const options: SignOptions = { expiresIn: expiresIn as any };

    const token = jwt.sign(
      { sub: String(user._id), email: user.email, role },
      secret as Secret,
      options
    );

    const res = NextResponse.json(
      {
        message: "Google login successful",
        user: {
          id: String(user._id),
          name: user.name || "",
          email: user.email || "",
          phone: user.phone || "",
          role,
          redirectTo: isAdminRole(role) ? "/admin" : "/dashboard",
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
