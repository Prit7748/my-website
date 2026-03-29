// ✅ FILE: app/api/admin/subjects/route.ts (COMPLETE REPLACE)
import { NextRequest, NextResponse } from "next/server";
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
function escRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  await dbConnect();

  const url = new URL(req.url);
  const q = safeText(url.searchParams.get("q"));
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const limit = Math.min(100, Math.max(10, Number(url.searchParams.get("limit") || 25)));
  const skip = (page - 1) * limit;

  const query: any = {};
  if (q) {
    const rx = new RegExp(escRegex(q), "i");
    query.$or = [
      { code: rx },
      { titleEn: rx },
      { titleHi: rx },
      { otherLangName: rx },
      { titleOther: rx },
    ];
  }

  const total = await Subject.countDocuments(query);
  const items = await Subject.find(query)
    .sort({ code: 1 })
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
  const code = normCode(body?.code);

  const titleEn = safeText(body?.titleEn);
  const titleHi = safeText(body?.titleHi);
  const otherLangName = safeText(body?.otherLangName);
  const titleOther = safeText(body?.titleOther);

  if (!code) return NextResponse.json({ error: "Subject code is required" }, { status: 400 });

  const exists = await Subject.findOne({ code }).lean();
  if (exists) return NextResponse.json({ error: "Subject code already exists" }, { status: 409 });

  const doc = await Subject.create({
    code,
    titleEn,
    titleHi,
    otherLangName,
    titleOther,
    isActive: true,
  });

  return NextResponse.json({ message: "Subject created", subject: doc }, { status: 201 });
}
