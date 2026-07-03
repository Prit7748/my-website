import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Redirection from "@/models/Redirection";
import { requireAdmin } from "@/lib/adminAuth";
import {
  invalidateRedirectionCache,
  safeStr,
  serializeRedirection,
  validateRedirectionInput,
} from "@/lib/redirections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    await dbConnect();

    const url = new URL(req.url);
    const search = safeStr(url.searchParams.get("search"));
    const only = safeStr(url.searchParams.get("only"));

    const q: Record<string, unknown> = {};
    if (only === "active") q.isActive = true;
    if (only === "inactive") q.isActive = false;

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(escaped, "i");
      q.$or = [{ fromPath: re }, { toPath: re }, { note: re }];
    }

    const rows = await Redirection.find(q)
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(500)
      .lean();

    return NextResponse.json(
      {
        redirections: (rows || []).map(serializeRedirection),
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: "Server error", message: e?.message || "" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const validation = await validateRedirectionInput({
      fromPath: safeStr(body?.fromPath),
      toPath: safeStr(body?.toPath),
      statusCode: body?.statusCode,
    });

    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const isActive =
      body?.isActive === undefined ? true : Boolean(body?.isActive);
    const note = safeStr(body?.note);

    const doc = await Redirection.create({
      ...validation.data,
      isActive,
      note,
    });

    invalidateRedirectionCache();

    return NextResponse.json(
      { redirection: serializeRedirection(doc) },
      { status: 201 }
    );
  } catch (e: any) {
    if (String(e?.message || "").toLowerCase().includes("duplicate")) {
      return NextResponse.json(
        { error: "A redirection for this previous URL already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Server error", message: e?.message || "" },
      { status: 500 }
    );
  }
}
