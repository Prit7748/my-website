// app/api/admin/site-settings/coming-soon/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import GlobalToggle from "@/models/GlobalToggle";
import { getAuthUser, hasPermission } from "@/lib/auth";

export const runtime = "nodejs";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function getUserId(user: any) {
  return safeStr(user?._id || user?.id || user?.userId || user?.email || "");
}

const TOGGLE_KEY = "coming_soon_sales";

async function ensureDoc() {
  let doc: any = await GlobalToggle.findOne({ key: TOGGLE_KEY });
  if (!doc) {
    doc = await GlobalToggle.create({
      key: TOGGLE_KEY,
      enabled: true, // default ON
      note: "Global toggle for Coming Soon purchasability",
      updatedBy: "system",
    });
  }
  return doc;
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // read allowed to products:read or write
  if (!hasPermission(user, "products:read") && !hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();
  const doc: any = await ensureDoc();

  return NextResponse.json(
    {
      ok: true,
      config: {
        key: doc.key,
        enabled: Boolean(doc.enabled),
        note: safeStr(doc.note),
        updatedAt: doc.updatedAt,
        updatedBy: safeStr(doc.updatedBy),
      },
    },
    { status: 200 }
  );
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden (products:write missing)" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled (boolean) is required" }, { status: 400 });
  }

  await dbConnect();
  const userId = getUserId(user);

  const doc: any = await GlobalToggle.findOneAndUpdate(
    { key: TOGGLE_KEY },
    {
      $set: {
        enabled: Boolean(body.enabled),
        updatedBy: userId || "admin",
        note: "Global toggle for Coming Soon purchasability",
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return NextResponse.json(
    {
      ok: true,
      message: doc.enabled ? "Coming Soon sales enabled" : "Coming Soon sales disabled",
      config: {
        key: doc.key,
        enabled: Boolean(doc.enabled),
        note: safeStr(doc.note),
        updatedAt: doc.updatedAt,
        updatedBy: safeStr(doc.updatedBy),
      },
    },
    { status: 200 }
  );
}