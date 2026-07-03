// D:\my-website\proxy.ts
import { NextRequest, NextResponse } from "next/server";
import {
  buildRedirectDestination,
  getRedirectionRule,
} from "@/lib/redirections";

const NEW_SITE_ORIGIN = "https://istudentsportal.com";

const NEW_WWW_HOSTS = new Set(["www.istudentsportal.com"]);

// ✅ Edge-safe base64url decode
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

function cleanHost(hostHeader: string | null) {
  return String(hostHeader || "")
    .toLowerCase()
    .split(":")[0]
    .trim();
}

export async function proxy(req: NextRequest) {
  const host = cleanHost(req.headers.get("host"));
  const pathname = req.nextUrl.pathname;

  // ✅ Keep only NEW www domain -> NEW non-www canonical domain redirect.
  // ✅ Do NOT redirect old domain ignoustudentsportal.com to istudentsportal.com anymore.
  if (NEW_WWW_HOSTS.has(host)) {
    const url = new URL(NEW_SITE_ORIGIN);
    url.pathname = pathname;
    url.search = req.nextUrl.search;
    return NextResponse.redirect(url, 301);
  }

  const redirectRule = await getRedirectionRule(pathname);
  if (redirectRule) {
    const destination = buildRedirectDestination(
      redirectRule.toPath,
      req.nextUrl.origin,
      req.nextUrl.search
    );
    return NextResponse.redirect(destination, redirectRule.statusCode);
  }

  const token = req.cookies.get("token")?.value;

  // ✅ Protect only pages, not APIs. APIs are protected in route handlers.
  const protectedRoutes = ["/dashboard", "/orders", "/library", "/admin"];
  const isProtected = protectedRoutes.some((p) => pathname.startsWith(p));

  // ✅ If not logged in → redirect to /login
  if (isProtected && !token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // ✅ Logged-in user ko /login pe aane se roko
  if (pathname === "/login" && token) {
    const role = getRoleFromToken(token);
    const url = req.nextUrl.clone();
    url.pathname =
      role === "master_admin" || role === "co_admin" ? "/admin" : "/dashboard";
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
  matcher: [
    /*
      ✅ Run proxy on normal pages.
      ✅ Skip API routes, Next assets, favicon, images, and common static files.
    */
    "/((?!api|_next/static|_next/image|favicon.ico|icon.png|logo.png|og.jpg|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|mp4|pdf)$).*)",
  ],
};