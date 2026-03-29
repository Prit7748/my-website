import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import OfferEntry from "@/models/OfferEntry";
import { requireAdmin } from "@/lib/adminAuth";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeDateInput(x: any) {
  const v = safeStr(x);
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

async function ensureAdminOrFail() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  return null;
}

function invalidIdResponse() {
  return NextResponse.json({ error: "Invalid offer id" }, { status: 400 });
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await ensureAdminOrFail();
    if (denied) return denied;

    await dbConnect();

    const { id } = await ctx.params;
    if (!mongoose.isValidObjectId(id)) return invalidIdResponse();

    const row = await OfferEntry.findById(id).lean();
    if (!row) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    return NextResponse.json(row);
  } catch (e: any) {
    return NextResponse.json({ error: safeStr(e?.message) || "Failed to load offer" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await ensureAdminOrFail();
    if (denied) return denied;

    await dbConnect();

    const { id } = await ctx.params;
    if (!mongoose.isValidObjectId(id)) return invalidIdResponse();

    const body = await req.json().catch(() => ({}));

    const patch: any = {
      updatedBy: "admin",
    };

    if (body?.title !== undefined) patch.title = safeStr(body.title);
    if (body?.shortText !== undefined) patch.shortText = safeStr(body.shortText);
    if (body?.badgeText !== undefined) patch.badgeText = safeStr(body.badgeText);
    if (body?.couponCode !== undefined) patch.couponCode = safeStr(body.couponCode).toUpperCase();
    if (body?.ctaText !== undefined) patch.ctaText = safeStr(body.ctaText);
    if (body?.ctaHref !== undefined) patch.ctaHref = safeStr(body.ctaHref);
    if (body?.coverImageUrl !== undefined) patch.coverImageUrl = safeStr(body.coverImageUrl);
    if (body?.bgVariant !== undefined) patch.bgVariant = safeStr(body.bgVariant).toLowerCase();
    if (body?.categoryTags !== undefined) patch.categoryTags = Array.isArray(body.categoryTags) ? body.categoryTags : [];
    if (body?.sortOrder !== undefined) patch.sortOrder = Math.trunc(safeNum(body.sortOrder, 0));
    if (body?.isFeatured !== undefined) patch.isFeatured = !!body.isFeatured;
    if (body?.isActive !== undefined) patch.isActive = !!body.isActive;
    if (body?.startsAt !== undefined) patch.startsAt = normalizeDateInput(body.startsAt);
    if (body?.endsAt !== undefined) patch.endsAt = normalizeDateInput(body.endsAt);

    const saved = await OfferEntry.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
    if (!saved) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    return NextResponse.json(saved);
  } catch (e: any) {
    return NextResponse.json({ error: safeStr(e?.message) || "Failed to update offer" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await ensureAdminOrFail();
    if (denied) return denied;

    await dbConnect();

    const { id } = await ctx.params;
    if (!mongoose.isValidObjectId(id)) return invalidIdResponse();

    const deleted = await OfferEntry.findByIdAndDelete(id).lean();
    if (!deleted) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: safeStr(e?.message) || "Failed to delete offer" }, { status: 500 });
  }
}

