import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/db";
import User from "@/models/User";

function isStrongPassword(p: string) {
  return (
    p.length >= 8 &&
    /[A-Z]/.test(p) &&
    /[a-z]/.test(p) &&
    /[0-9]/.test(p) &&
    /[^A-Za-z0-9]/.test(p)
  );
}

async function requireMasterAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) return { ok: false, status: 401, error: "Not authenticated" as const };

  const secret = process.env.JWT_SECRET;
  if (!secret) return { ok: false, status: 500, error: "JWT_SECRET missing" as const };

  try {
    const decoded: any = jwt.verify(token, secret);
    const role = (decoded?.role || "").toString();

    if (role !== "master_admin") {
      return { ok: false, status: 403, error: "Master admin only" as const };
    }
    return { ok: true as const, decoded };
  } catch {
    return { ok: false, status: 401, error: "Invalid token" as const };
  }
}

// ✅ GET: list all co_admins
export async function GET() {
  const auth = await requireMasterAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await dbConnect();
  const admins = await User.find({ role: "co_admin" })
    .select("_id name email role permissions createdAt")
    .sort({ createdAt: -1 });

  return NextResponse.json({ admins }, { status: 200 });
}

// ✅ POST: create a new co_admin
export async function POST(req: Request) {
  const auth = await requireMasterAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  const name = (body?.name || "").toString().trim();
  const email = (body?.email || "").toString().trim().toLowerCase();
  const password = (body?.password || "").toString();
  const adminKey = (body?.adminKey || "").toString();
  const permissions = Array.isArray(body?.permissions) ? body.permissions.map((x: any) => String(x)) : [];

  if (!name || !email || !password || !adminKey) {
    return NextResponse.json(
      { error: "name, email, password, adminKey are required" },
      { status: 400 }
    );
  }

  if (!isStrongPassword(password)) {
    return NextResponse.json(
      { error: "Password must be 8+ chars with uppercase, lowercase, number, special character." },
      { status: 400 }
    );
  }

  if (adminKey.length < 8) {
    return NextResponse.json(
      { error: "Admin Key must be at least 8 characters" },
      { status: 400 }
    );
  }

  await dbConnect();

  const exists = await User.findOne({ email });
  if (exists) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const adminKeyHash = await bcrypt.hash(adminKey, 10);

  const user = await User.create({
    name,
    email,
    passwordHash,
    role: "co_admin",
    adminKeyHash,
    permissions,
  });

  return NextResponse.json(
    {
      message: "Co-Admin created",
      admin: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions || [],
      },
    },
    { status: 201 }
  );
}

// ✅ DELETE: remove a co_admin (by id)
export async function DELETE(req: Request) {
  const auth = await requireMasterAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(req.url);
  const id = (searchParams.get("id") || "").trim();

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  await dbConnect();

  const target: any = await User.findById(id).select("_id role email");
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (target.role === "master_admin") {
    return NextResponse.json({ error: "Cannot delete master admin" }, { status: 403 });
  }

  if (target.role !== "co_admin") {
    return NextResponse.json({ error: "Only co_admin can be deleted here" }, { status: 400 });
  }

  await User.deleteOne({ _id: id });

  return NextResponse.json({ message: "Co-Admin deleted" }, { status: 200 });
}
