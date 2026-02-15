import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/db";
import User from "@/models/User";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const seedKey = (body?.seedKey || "").toString();

    if (!process.env.MASTER_SEED_KEY) {
      return NextResponse.json({ error: "MASTER_SEED_KEY missing" }, { status: 500 });
    }
    if (seedKey !== process.env.MASTER_SEED_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = (process.env.MASTER_ADMIN_EMAIL || "").toString().trim().toLowerCase();
    const password = (process.env.MASTER_ADMIN_PASSWORD || "").toString();

    if (!email || !password) {
      return NextResponse.json(
        { error: "MASTER_ADMIN_EMAIL / MASTER_ADMIN_PASSWORD missing" },
        { status: 500 }
      );
    }

    await dbConnect();

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.findOneAndUpdate(
      { email },
      {
        $set: {
          name: "Master Admin",
          email,
          passwordHash,
          role: "master_admin",
        },
      },
      { upsert: true, new: true }
    );

    return NextResponse.json(
      { message: "Master admin seeded", user: { id: String(user._id), email: user.email, role: user.role } },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: "Server error", details: String(err?.message || err) }, { status: 500 });
  }
}
