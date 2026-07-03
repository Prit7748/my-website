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

async function getId(ctx: { params: Promise<{ id: string }> }, req: NextRequest) {
  try {
    const p = await ctx.params;
    return safeStr(p?.id);
  } catch {
    const parts = new URL(req.url).pathname.split("/").filter(Boolean);
    return safeStr(parts[3]);
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    await dbConnect();

    const id = await getId(ctx, req);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const row = await Redirection.findById(id).lean();
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(
      { redirection: serializeRedirection(row) },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: "Server error", message: e?.message || "" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    await dbConnect();

    const id = await getId(ctx, req);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const existing = await Redirection.findById(id).lean();
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const update: Record<string, unknown> = {};

    if (body?.fromPath !== undefined || body?.toPath !== undefined || body?.statusCode !== undefined) {
      const validation = await validateRedirectionInput({
        fromPath:
          body?.fromPath !== undefined
            ? safeStr(body.fromPath)
            : safeStr((existing as any).fromPath),
        toPath:
          body?.toPath !== undefined
            ? safeStr(body.toPath)
            : safeStr((existing as any).toPath),
        statusCode:
          body?.statusCode !== undefined
            ? body.statusCode
            : (existing as any).statusCode,
        excludeId: id,
      });

      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      update.fromPath = validation.data.fromPath;
      update.toPath = validation.data.toPath;
      update.statusCode = validation.data.statusCode;
    }

    if (body?.isActive !== undefined) update.isActive = Boolean(body.isActive);
    if (body?.note !== undefined) update.note = safeStr(body.note);

    const row = await Redirection.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    invalidateRedirectionCache();

    return NextResponse.json(
      { redirection: serializeRedirection(row) },
      { status: 200 }
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

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    await dbConnect();

    const id = await getId(ctx, req);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const deleted = await Redirection.findByIdAndDelete(id).lean();
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

    invalidateRedirectionCache();

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Server error", message: e?.message || "" },
      { status: 500 }
    );
  }
}
