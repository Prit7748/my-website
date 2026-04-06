import { NextRequest, NextResponse } from "next/server";

function decodeJwtPayload(token?: string) {
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "="
    );

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

function isAdminRole(role: string) {
  return role === "master_admin" || role === "co_admin";
}

export function middleware(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const pathname = req.nextUrl.pathname;

  const protectedRoutes = ["/dashboard", "/orders", "/library", "/admin"];
  const isProtected = protectedRoutes.some((p) => pathname.startsWith(p));

  if (isProtected && !token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";

    const nextPath =
      pathname + (req.nextUrl.search ? req.nextUrl.search : "");

    url.searchParams.set("next", nextPath);
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && token) {
    const role = getRoleFromToken(token);
    const url = req.nextUrl.clone();
    url.pathname = isAdminRole(role) ? "/admin" : "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin")) {
    const role = getRoleFromToken(token);

    if (!isAdminRole(role)) {
      const url = req.nextUrl.clone();
      url.pathname = token ? "/dashboard" : "/login";
      url.search = "";

      if (!token) {
        url.searchParams.set(
          "next",
          pathname + (req.nextUrl.search ? req.nextUrl.search : "")
        );
      }

      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/orders/:path*",
    "/library/:path*",
    "/admin/:path*",
    "/login",
  ],
};