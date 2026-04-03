import { NextRequest, NextResponse } from "next/server";
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
      res: NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 }),
    };
  }

  if (!hasPermission(user, "products:write")) {
    return {
      ok: false as const,
      res: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, user };
}

export async function POST(_req: NextRequest) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  return NextResponse.json(
    {
      ok: false,
      error:
        "Legacy official papers upload route disabled hai. Ab official papers upload sirf job-based ZIP flow se hoga.",
      message:
        "Please use /admin/official-papers page and start upload through the new ZIP batch job system.",
      recommendedRoute: "/api/admin/official-papers/jobs",
      migrationMode: "job-based-only",
    },
    { status: 410 }
  );
}