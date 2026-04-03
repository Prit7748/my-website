import { NextResponse } from "next/server";
import { getAuthUser, hasPermission } from "@/lib/auth";

export const runtime = "nodejs";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

async function assertAdminWriteAccess() {
  const user = await getAuthUser();

  if (!user) {
    return {
      ok: false as const,
      res: NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      ),
    };
  }

  if (!hasPermission(user, "products:write")) {
    return {
      ok: false as const,
      res: NextResponse.json(
        { ok: false, error: "Forbidden (products:write missing)" },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, user };
}

function deprecatedRouteResponse() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Direct bulk details upload route disabled hai. Ab sirf job-based batch system allowed hai.",
      routeDisabled: true,
      reason:
        "Large uploads ko safe, resumable, batch-wise aur failure-report-enabled system par shift kar diya gaya hai.",
      useRoute: "/api/admin/products/bulk/details/jobs",
      processRoute: "/api/admin/products/bulk/details/jobs/process",
      message:
        "Please use the Bulk Product Details page ka current job-based flow.",
    },
    { status: 410 }
  );
}

export async function GET() {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  return deprecatedRouteResponse();
}

export async function POST(req: Request) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  try {
    const contentType = safeStr(req.headers.get("content-type")).toLowerCase();

    return NextResponse.json(
      {
        ok: false,
        error:
          "Direct bulk details upload route disabled hai. Ab sirf job-based batch system allowed hai.",
        routeDisabled: true,
        deprecatedContentType: contentType || "",
        useRoute: "/api/admin/products/bulk/details/jobs",
        processRoute: "/api/admin/products/bulk/details/jobs/process",
        message:
          "Old single-request upload intentionally blocked to prevent timeout, freeze, and partial unsafe processing.",
      },
      { status: 410 }
    );
  } catch {
    return deprecatedRouteResponse();
  }
}