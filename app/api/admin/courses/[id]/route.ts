// ✅ FILE: app/api/admin/courses/[id]/route.ts (COMPLETE REPLACE)
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Course from "@/models/Course";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

function safeText(x: any) {
  return String(x ?? "").trim();
}
function normCode(code: string) {
  return safeText(code).replace(/\s+/g, " ").toUpperCase();
}

type ParamsMaybePromise = { params: Promise<{ id: string }> | { id: string } };

async function getId(ctx: ParamsMaybePromise) {
  const p: any = await (ctx as any).params;
  return safeText(p?.id);
}

export async function PUT(req: NextRequest, ctx: ParamsMaybePromise) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  await dbConnect();

  const id = await getId(ctx);
  const body = await req.json();

  const patch: any = {};
  if ("code" in body) patch.code = normCode(body?.code);
  if ("title" in body) patch.title = safeText(body?.title);
  if ("isActive" in body) patch.isActive = Boolean(body?.isActive);

  if (patch.code) {
    const exists = await Course.findOne({ code: patch.code, _id: { $ne: id } }).lean();
    if (exists) return NextResponse.json({ error: "Course code already exists" }, { status: 409 });
  }

  const updated = await Course.findByIdAndUpdate(id, patch, { new: true }).lean();
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ message: "Updated", course: updated }, { status: 200 });
}

export async function DELETE(req: NextRequest, ctx: ParamsMaybePromise) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  await dbConnect();

  const id = await getId(ctx);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const ok = await Course.findByIdAndDelete(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ message: "Deleted" }, { status: 200 });
}
