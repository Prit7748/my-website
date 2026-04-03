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
        { ok: false, error: "Forbidden" },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, user };
}

function disabledResponse(extra?: Record<string, any>) {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Legacy direct bulk-images route disabled hai. Ab sirf vault + job-based batch system allowed hai.",
      routeDisabled: true,
      useRoute: "/api/products/bulk-images/jobs",
      processRoute: "/api/products/bulk-images/jobs/process",
      message:
        "Please use the current Bulk Product Images page ka job-based flow.",
      ...(extra || {}),
    },
    { status: 410 }
  );
}

export async function GET() {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  return disabledResponse();
}

export async function POST(req: Request) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  try {
    const contentType = safeStr(req.headers.get("content-type")).toLowerCase();

    return disabledResponse({
      deprecatedContentType: contentType || "",
    });
  } catch {
    return disabledResponse();
  }
}