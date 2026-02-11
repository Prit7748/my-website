import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    await dbConnect();
    return NextResponse.json({ ok: true, message: "DB connected" }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
