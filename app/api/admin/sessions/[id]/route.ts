// ✅ FILE: app/api/admin/sessions/[id]/route.ts (COMPLETE REPLACE)
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Session from "@/models/Session";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

function safeText(x: any) {
  return String(x ?? "").trim();
}

function num(x: any, d = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
}

function slugify(input: string) {
  return safeText(input)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeCategory(input: any) {
  const raw = safeText(input);
  if (!raw) return "";

  const s = raw
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[()]/g, " ")
    .replace(/[_/]+/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (
    s === "solved assignments" ||
    s === "solved assignment" ||
    s === "assignment" ||
    s === "assignments"
  ) {
    return "Solved Assignments";
  }

  if (
    s === "question papers" ||
    s === "question paper" ||
    s === "pyq" ||
    s === "previous year question papers"
  ) {
    return "Question Papers (PYQ)";
  }

  if (
    s === "handwritten pdfs" ||
    s === "handwritten pdf" ||
    s === "handwritten notes pdf" ||
    s === "handwritten notes pdfs"
  ) {
    return "Handwritten PDFs";
  }

  if (
    s === "ebooks" ||
    s === "ebook" ||
    s === "e books" ||
    s === "e book"
  ) {
    return "Ebooks";
  }

  if (
    s === "guess papers" ||
    s === "guess paper"
  ) {
    return "Guess Papers";
  }

  if (
    s === "projects" ||
    s === "project"
  ) {
    return "projects";
  }

  // ✅ Important fix for handwritten hardcopy category
  if (
    s === "handwritten hardcopy" ||
    s === "handwritten hardcopies" ||
    s === "handwritten hard copy" ||
    s === "handwritten hard copies" ||
    s === "handwritten hardcopy delivery" ||
    s === "handwritten hard copy delivery" ||
    s === "handwritten hardcopies delivery" ||
    s === "handwritten hard copies delivery" ||
    s === "hardcopy" ||
    s === "hardcopies" ||
    s === "hard copy" ||
    s === "hard copies"
  ) {
    return "Handwritten Hardcopy (Delivery)";
  }

  return raw;
}

function asStringArray(x: any) {
  if (Array.isArray(x)) return x.map((v) => safeText(v)).filter(Boolean);
  if (typeof x === "string") return x.split(",").map((v) => v.trim()).filter(Boolean);
  return [];
}

function normalizeCategoryArray(x: any) {
  const arr = asStringArray(x).map(normalizeCategory).filter(Boolean);
  return Array.from(new Set(arr));
}

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function getId(ctx: any) {
  const p = await ctx.params;
  return safeText(p?.id);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  await dbConnect();

  const id = await getId(ctx);
  const body = await req.json();

  const patch: any = {};

  if ("name" in body) patch.name = safeText(body?.name);
  if ("slug" in body) patch.slug = safeText(body?.slug);
  if ("categories" in body) patch.categories = normalizeCategoryArray(body?.categories);
  if ("sortOrder" in body) patch.sortOrder = num(body?.sortOrder, 0);
  if ("isActive" in body) patch.isActive = Boolean(body?.isActive);

  if ("slug" in patch && !patch.slug && patch.name) {
    patch.slug = slugify(patch.name);
  }

  if (patch.slug) {
    const exists = await Session.findOne({ slug: patch.slug, _id: { $ne: id } }).lean();
    if (exists) {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }
  }

  const updated = await Session.findByIdAndUpdate(id, patch, { new: true }).lean();
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Updated", session: updated }, { status: 200 });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  await dbConnect();

  const id = await getId(ctx);
  const ok = await Session.findByIdAndDelete(id);

  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Deleted" }, { status: 200 });
}
