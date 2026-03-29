// ✅ FILE: app/api/auth/register/route.ts (COMPLETE REPLACE)
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/db";
import User from "@/models/User";

export const runtime = "nodejs";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function normPhone(x: any) {
  // keep digits and + only
  return safeStr(x).replace(/[^\d+]/g, "");
}

function isValidPhone(p: string) {
  // minimal safe validation: 10-15 digits (optionally + at start)
  const digits = p.startsWith("+") ? p.slice(1) : p;
  if (!/^\d+$/.test(digits)) return false;
  return digits.length >= 10 && digits.length <= 15;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const name = safeStr(body?.name);
    const email = safeStr(body?.email).toLowerCase();
    const phone = normPhone(body?.phone);
    const password = String(body?.password ?? "");

    if (!email || !phone || !password) {
      return NextResponse.json(
        { error: "Email, phone and password are required" },
        { status: 400 }
      );
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json(
        { error: "Please enter a valid phone number (10-15 digits)" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    await dbConnect();

    const existingEmail = await User.findOne({ email }).lean();
    if (existingEmail) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const existingPhone = await User.findOne({ phone }).lean();
    if (existingPhone) {
      return NextResponse.json({ error: "Phone already registered" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      phone,
      passwordHash,
      role: "user",
    });

    return NextResponse.json(
      {
        message: "Registered successfully",
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", details: err?.message || "unknown" },
      { status: 500 }
    );
  }
}
