// PROJECT_ROOT/middleware.ts
import { NextRequest, NextResponse } from "next/server";

// ✅ Edge-safe base64url decode (no jsonwebtoken in middleware)
function decodeJwtPayload(token?: string) {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getRoleFromToken(token?: string) {
  const payload = decodeJwtPayload(token);
  return String(payload?.role || "").toLowerCase();
}

export function middleware(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const pathname = req.nextUrl.pathname;

  // ✅ Protect only pages (not APIs). APIs already protected in route handlers.
  const protectedRoutes = ["/dashboard", "/orders", "/library", "/admin"];
  const isProtected = protectedRoutes.some((p) => pathname.startsWith(p));

  // ✅ If not logged-in → redirect to /login
  if (isProtected && !token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname); // ✅ best UX
    return NextResponse.redirect(url);
  }

  // ✅ Logged-in user ko /login pe aane se roko
  if (pathname === "/login" && token) {
    const role = getRoleFromToken(token);
    const url = req.nextUrl.clone();
    url.pathname = role === "master_admin" || role === "co_admin" ? "/admin" : "/dashboard";
    return NextResponse.redirect(url);
  }

  // ✅ /admin only for co_admin or master_admin
  if (pathname.startsWith("/admin")) {
    const role = getRoleFromToken(token);
    if (role !== "co_admin" && role !== "master_admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/orders/:path*", "/library/:path*", "/admin/:path*", "/login"],
};
