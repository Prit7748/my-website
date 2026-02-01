import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

function getRoleFromToken(token: string | undefined) {
  if (!token) return null;
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const decoded: any = jwt.verify(token, secret);
    return (decoded?.role || "").toString();
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const pathname = req.nextUrl.pathname;

  // login required routes
  const protectedRoutes = ["/dashboard", "/orders", "/library", "/admin"];
  const isProtected = protectedRoutes.some((p) => pathname.startsWith(p));

  if (isProtected && !token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // logged-in user ko /login pe aane se roko (optional)
  if (pathname === "/login" && token) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // /admin only for co_admin or master_admin
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
