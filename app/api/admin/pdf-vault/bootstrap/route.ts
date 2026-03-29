import { NextResponse } from "next/server";
import { getAuthUser, hasPermission } from "@/lib/auth";
import { ensureRootFolder, hasPdfVaultPageAccess, PDF_VAULT_ROUTE_SEGMENT } from "@/lib/pdfVault";

export const runtime = "nodejs";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const root: any = await ensureRootFolder();
  const accessGranted = await hasPdfVaultPageAccess(user.id);

  return NextResponse.json(
    {
      ok: true,
      hiddenPath: `/admin/${PDF_VAULT_ROUTE_SEGMENT}`,
      accessGranted,
      root: {
        _id: String(root._id),
        name: String(root.name || ""),
        path: String(root.path || "root"),
        level: Number(root.level || 0),
      },
    },
    { status: 200 }
  );
}