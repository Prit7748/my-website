// ✅ FILE: app/api/admin/subjects/[id]/route.ts (COMPLETE REPLACE)
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Subject from "@/models/Subject";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

function safeText(x: any) {
  return String(x ?? "").trim();
}
function normCode(code: string) {
  return safeText(code).replace(/\s+/g, " ").toUpperCase();
}
function badReq(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  await dbConnect();

  const { id } = await ctx.params; // ✅ IMPORTANT (Next.js dynamic params are async)
  const _id = safeText(id);

  if (!_id) return badReq("Missing id");
  if (!mongoose.Types.ObjectId.isValid(_id)) return badReq("Invalid id");

  const body = await req.json();

  const patch: any = {};
  if ("code" in body) patch.code = normCode(body?.code);
  if ("titleEn" in body) patch.titleEn = safeText(body?.titleEn);
  if ("titleHi" in body) patch.titleHi = safeText(body?.titleHi);
  if ("otherLangName" in body) patch.otherLangName = safeText(body?.otherLangName);
  if ("titleOther" in body) patch.titleOther = safeText(body?.titleOther);
  if ("isActive" in body) patch.isActive = Boolean(body?.isActive);

  // prevent accidental empty unique code overwrite
  if ("code" in patch && !patch.code) return badReq("Subject code cannot be empty");

  if (patch.code) {
    const exists = await Subject.findOne({ code: patch.code, _id: { $ne: _id } }).lean();
    if (exists) return badReq("Subject code already exists", 409);
  }

  const updated = await Subject.findByIdAndUpdate(_id, patch, { new: true }).lean();
  if (!updated) return badReq("Not found", 404);

  return NextResponse.json({ message: "Updated", subject: updated }, { status: 200 });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  await dbConnect();

  const { id } = await ctx.params; // ✅ IMPORTANT
  const _id = safeText(id);

  if (!_id) return badReq("Missing id");
  if (!mongoose.Types.ObjectId.isValid(_id)) return badReq("Invalid id");

  const ok = await Subject.findByIdAndDelete(_id);
  if (!ok) return badReq("Not found", 404);

  return NextResponse.json({ message: "Deleted" }, { status: 200 });
}
