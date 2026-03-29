// ✅ FILE: app/api/admin/sessions/route.ts (COMPLETE REPLACE)
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

function escRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  // Canonical mappings
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

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  await dbConnect();

  const url = new URL(req.url);
  const q = safeText(url.searchParams.get("q"));
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const limit = Math.min(200, Math.max(25, Number(url.searchParams.get("limit") || 50)));
  const skip = (page - 1) * limit;

  const query: any = {};
  if (q) {
    const normalizedQ = normalizeCategory(q);
    const rx = new RegExp(escRegex(q), "i");
    const rxNorm = normalizedQ ? new RegExp(escRegex(normalizedQ), "i") : null;

    query.$or = [
      { name: rx },
      { slug: rx },
      { categories: rx },
      ...(rxNorm ? [{ categories: rxNorm }] : []),
    ];
  }

  const total = await Session.countDocuments(query);
  const items = await Session.find(query)
    .sort({ sortOrder: 1, name: 1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return NextResponse.json(
    {
      items,
      pagination: {
        total,
        page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        limit,
      },
    },
    { status: 200 }
  );
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  await dbConnect();

  const body = await req.json();

  const name = safeText(body?.name);
  if (!name) {
    return NextResponse.json({ error: "Session name is required" }, { status: 400 });
  }

  const slug = safeText(body?.slug) || slugify(name);
  const categories = normalizeCategoryArray(body?.categories);
  const sortOrder = num(body?.sortOrder, 0);
  const isActive = Boolean(body?.isActive ?? true);

  const exists = await Session.findOne({ slug }).lean();
  if (exists) {
    return NextResponse.json({ error: "Session already exists (slug duplicate)" }, { status: 409 });
  }

  const doc = await Session.create({
    name,
    slug,
    categories,
    sortOrder,
    isActive,
  });

  return NextResponse.json({ message: "Session created", session: doc }, { status: 201 });
}
