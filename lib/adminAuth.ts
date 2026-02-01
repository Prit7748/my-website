import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export async function requireAdmin() {
  const cookieStore = await cookies(); // ✅ await
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return { ok: false as const, status: 401, error: "Not authenticated" };
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return { ok: false as const, status: 500, error: "JWT secret missing" };
  }

  try {
    const decoded: any = jwt.verify(token, secret);
    const role = String(decoded?.role || "").toLowerCase();

    if (role !== "master_admin" && role !== "co_admin") {
      return { ok: false as const, status: 403, error: "Admin access required" };
    }

    return { ok: true as const, decoded };
  } catch {
    return { ok: false as const, status: 401, error: "Invalid token" };
  }
}
