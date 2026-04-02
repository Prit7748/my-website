import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Course from "@/models/Course";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeText(x: any) {
  return String(x ?? "").trim();
}

function normCode(code: any) {
  return safeText(code).replace(/\s+/g, " ").toUpperCase();
}

function toInt(raw: string | null, def: number, min: number, max: number) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    await dbConnect();

    const sp = req.nextUrl.searchParams;
    const q = safeText(sp.get("q"));
    const limit = toInt(sp.get("limit"), 50, 1, 200);
    const requestedPage = toInt(sp.get("page"), 1, 1, 100000);

    const filter: any = {};
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ code: rx }, { title: rx }];
    }

    const total = await Course.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(requestedPage, totalPages);
    const skip = (page - 1) * limit;

    const docs = await Course.find(filter)
      .sort({ code: 1, _id: 1 })
      .skip(skip)
      .limit(limit)
      .select("_id code title")
      .lean();

    const items = (docs || []).map((doc: any) => ({
      _id: String(doc._id),
      code: safeText(doc.code),
      title: safeText(doc.title),
    }));

    return NextResponse.json(
      {
        items,
        pagination: {
          total,
          page,
          totalPages,
          limit,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Admin courses GET error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load courses" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    await dbConnect();

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const code = normCode(body?.code);
    const title = safeText(body?.title);

    if (!code) {
      return NextResponse.json({ error: "Course code is required" }, { status: 400 });
    }

    const exists = await Course.findOne({ code }).select("_id").lean();
    if (exists) {
      return NextResponse.json({ error: "Course code already exists" }, { status: 409 });
    }

    const created = await Course.create({
      code,
      title,
      isActive: body?.isActive === undefined ? true : Boolean(body.isActive),
    });

    return NextResponse.json(
      {
        message: "Created",
        course: {
          _id: String(created._id),
          code: safeText(created.code),
          title: safeText(created.title),
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Admin courses POST error:", error);
    return NextResponse.json(
      { error: error?.message || "Create failed" },
      { status: 500 }
    );
  }
}