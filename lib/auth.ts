import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import dbConnect from "@/lib/db";
import User from "@/models/User";

export type AuthUser = {
  id: string;
  email: string;
  role: "user" | "co_admin" | "master_admin";
  permissions: string[];
};

export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  try {
    const decoded: any = jwt.verify(token, secret);
    const userId = decoded?.sub?.toString();
    if (!userId) return null;

    await dbConnect();
    const user: any = await User.findById(userId).select("email role permissions");
    if (!user) return null;

    return {
      id: user._id.toString(),
      email: (user.email || "").toString(),
      role: (user.role || "user").toString(),
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
    } as AuthUser;
  } catch {
    return null;
  }
}

export function hasPermission(user: AuthUser, perm: string) {
  if (user.role === "master_admin") return true; // ✅ master can do everything
  return user.permissions.includes(perm);
}
