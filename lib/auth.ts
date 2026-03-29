import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import {
  getPublicResellerSnapshot,
  normalizePlanCode,
  normalizeResellerStatus,
} from "@/lib/reseller";

export type AuthUser = {
  id: string;
  email: string;
  role: "user" | "co_admin" | "master_admin";
  permissions: string[];
  reseller: {
    isReseller: boolean;
    status: "inactive" | "active" | "paused" | "blocked";
    planCode: "" | "basic" | "standard" | "premium";
    planName: string;
    walletBalance: number;
    walletTotalRecharged: number;
    walletTotalUsed: number;
    walletTotalDiscountSaved: number;
    lastRechargeAt: string | null;
    planActivatedAt: string | null;
  };
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

    const user: any = await User.findById(userId).select(
      "email role permissions reseller"
    );

    if (!user) return null;

    const reseller = getPublicResellerSnapshot(user);

    return {
      id: user._id.toString(),
      email: String(user.email || "").trim(),
      role: (String(user.role || "user").trim() ||
        "user") as "user" | "co_admin" | "master_admin",
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
      reseller: {
        isReseller: Boolean(reseller.isReseller),
        status: normalizeResellerStatus(reseller.status),
        planCode: normalizePlanCode(reseller.planCode),
        planName: reseller.planName,
        walletBalance: reseller.walletBalance,
        walletTotalRecharged: reseller.walletTotalRecharged,
        walletTotalUsed: reseller.walletTotalUsed,
        walletTotalDiscountSaved: reseller.walletTotalDiscountSaved,
        lastRechargeAt: reseller.lastRechargeAt,
        planActivatedAt: reseller.planActivatedAt,
      },
    };
  } catch {
    return null;
  }
}

export function hasPermission(user: AuthUser, perm: string) {
  if (user.role === "master_admin") return true;
  return user.permissions.includes(perm);
}