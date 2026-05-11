// D:\my-website\middleware.ts
import { NextRequest, NextResponse } from "next/server";

const NEW_SITE_ORIGIN = "https://istudentsportal.com";

const OLD_HOSTS = new Set([
  "ignoustudentsportal.com",
  "www.ignoustudentsportal.com",
]);

const NEW_WWW_HOSTS = new Set(["www.istudentsportal.com"]);

// ✅ Edge-safe base64url decode (no jsonwebtoken in middleware)
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

function normalizePathname(pathname: string) {
  const clean = String(pathname || "/").trim();
  if (!clean || clean === "") return "/";
  return clean.startsWith("/") ? clean : `/${clean}`;
}

function getOldDomainTargetPath(pathname: string) {
  const path = normalizePathname(pathname);
  const lowerPath = path.toLowerCase();

  // ✅ Homepage old domain -> homepage new domain
  if (lowerPath === "/") return "/";

  // ✅ Old product URLs usually existed like /product/old-slug
  // Since old products are mostly expired, we redirect them to relevant category pages.
  if (lowerPath.startsWith("/product/") || lowerPath.startsWith("/products/")) {
    if (
      lowerPath.includes("guess") ||
      lowerPath.includes("guess-paper") ||
      lowerPath.includes("important-question")
    ) {
      return "/guess-papers";
    }

    if (
      lowerPath.includes("assignment") ||
      lowerPath.includes("assignments") ||
      lowerPath.includes("solved-assignment")
    ) {
      return "/solved-assignments";
    }

    if (
      lowerPath.includes("pyq") ||
      lowerPath.includes("question-paper") ||
      lowerPath.includes("question-papers") ||
      lowerPath.includes("previous-year") ||
      lowerPath.includes("previous-year-paper")
    ) {
      return "/question-papers";
    }

    if (
      lowerPath.includes("hardcopy") ||
      lowerPath.includes("handwritten-hardcopy")
    ) {
      return "/handwritten-hardcopy";
    }

    if (
      lowerPath.includes("handwritten-pdf") ||
      lowerPath.includes("handwritten-pdfs")
    ) {
      return "/handwritten-pdfs";
    }

    if (
      lowerPath.includes("ebook") ||
      lowerPath.includes("ebooks") ||
      lowerPath.includes("notes")
    ) {
      return "/ebooks";
    }

    if (
      lowerPath.includes("project") ||
      lowerPath.includes("projects") ||
      lowerPath.includes("synopsis")
    ) {
      return "/projects";
    }

    return "/products";
  }

  // ✅ If old domain already has a useful public category/page path, preserve it.
  const publicPrefixesToPreserve = [
    "/solved-assignments",
    "/question-papers",
    "/guess-papers",
    "/handwritten-hardcopy",
    "/handwritten-pdfs",
    "/ebooks",
    "/projects",
    "/combo",
    "/courses",
    "/blog",
    "/about",
    "/contact",
    "/faq",
    "/privacy",
    "/terms",
    "/refund-policy",
    "/products",
  ];

  const shouldPreserve = publicPrefixesToPreserve.some(
    (prefix) => lowerPath === prefix || lowerPath.startsWith(`${prefix}/`)
  );

  if (shouldPreserve) return path;

  // ✅ Admin/user/private/unknown old paths should not remain active on old domain.
  return "/";
}

function permanentRedirectToNewSite(req: NextRequest, targetPath: string) {
  const url = new URL(NEW_SITE_ORIGIN);
  url.pathname = normalizePathname(targetPath);

  // ✅ Do not carry old query params for product/category redirects.
  // This keeps the migration clean and avoids old tracking/filter URLs becoming indexed.
  url.search = "";

  return NextResponse.redirect(url, 301);
}

export function proxy(req: NextRequest) {
  const host = cleanHost(req.headers.get("host"));
  const pathname = req.nextUrl.pathname;

  // ✅ 1) OLD DOMAIN -> NEW DOMAIN permanent SEO redirect
  if (OLD_HOSTS.has(host)) {
    const targetPath = getOldDomainTargetPath(pathname);
    return permanentRedirectToNewSite(req, targetPath);
  }

  // ✅ 2) NEW www domain -> NEW non-www canonical domain
  if (NEW_WWW_HOSTS.has(host)) {
    const url = new URL(NEW_SITE_ORIGIN);
    url.pathname = pathname;
    url.search = req.nextUrl.search;
    return NextResponse.redirect(url, 301);
  }

  const token = req.cookies.get("token")?.value;

  // ✅ Protect only pages (not APIs). APIs already protected in route handlers.
  const protectedRoutes = ["/dashboard", "/orders", "/library", "/admin"];
  const isProtected = protectedRoutes.some((p) => pathname.startsWith(p));

  // ✅ If not logged-in → redirect to /login
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
      ✅ Run middleware on normal pages and old-domain URLs.
      ✅ Skip _next assets, favicon, images, and common static files.
      ✅ API routes are skipped because API auth is handled in route handlers.
    */
    "/((?!api|_next/static|_next/image|favicon.ico|icon.png|logo.png|og.jpg|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|mp4|pdf)$).*)",
  ],
};