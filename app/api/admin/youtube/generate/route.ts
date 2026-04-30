import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import dbConnect from "@/lib/db";
import { getAuthUser, hasPermission } from "@/lib/auth";
import Product from "@/models/Product";
import {
  buildYoutubeGeneratedPayload,
  getYoutubeContentKindFromCategory,
} from "@/lib/youtubeContent";
import {
  DEFAULT_YOUTUBE_SITE_BASE_URL,
  DEFAULT_YOUTUBE_SITE_NAME,
} from "@/lib/youtubeTokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSku(input: any) {
  return safeStr(input).toUpperCase().replace(/\s+/g, "");
}

function normalizeSiteBaseUrl(input?: string) {
  const raw =
    safeStr(input) ||
    safeStr(process.env.NEXT_PUBLIC_SITE_URL) ||
    DEFAULT_YOUTUBE_SITE_BASE_URL;

  return raw.replace(/\/+$/, "") || DEFAULT_YOUTUBE_SITE_BASE_URL;
}

function getSearchPayloadFromReq(req: NextRequest, body?: any) {
  const url = new URL(req.url);

  return {
    productId:
      safeStr(body?.productId) ||
      safeStr(body?.id) ||
      safeStr(url.searchParams.get("productId")) ||
      safeStr(url.searchParams.get("id")),
    sku:
      safeStr(body?.sku) ||
      safeStr(body?.uniqueId) ||
      safeStr(url.searchParams.get("sku")) ||
      safeStr(url.searchParams.get("uniqueId")),
    slug:
      safeStr(body?.slug) ||
      safeStr(url.searchParams.get("slug")),
    siteName:
      safeStr(body?.siteName) ||
      safeStr(url.searchParams.get("siteName")) ||
      DEFAULT_YOUTUBE_SITE_NAME,
    siteBaseUrl: normalizeSiteBaseUrl(
      safeStr(body?.siteBaseUrl) || safeStr(url.searchParams.get("siteBaseUrl"))
    ),
  };
}

async function findYoutubeProduct(params: {
  productId?: string;
  sku?: string;
  slug?: string;
}) {
  const productId = safeStr(params.productId);
  const sku = safeStr(params.sku);
  const slug = safeStr(params.slug);

  const selectFields = [
    "_id",
    "title",
    "sku",
    "slug",
    "category",
    "subjectCode",
    "subjectTitleHi",
    "subjectTitleEn",
    "subjectTitleOther",
    "courseCodes",
    "courseTitles",
    "session",
    "session6",
    "language",
    "lang3",
    "isActive",
    "availability",
    "createdAt",
    "updatedAt",
    "lastModifiedAt",
    "deletedAt",
  ].join(" ");

  if (productId) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new Error("Invalid product id.");
    }

    return Product.findOne({
      _id: productId,
      deletedAt: null,
    })
      .select(selectFields)
      .lean();
  }

  if (sku) {
    const rawSku = safeStr(sku).toUpperCase();
    const compactSku = normalizeSku(sku);

    return Product.findOne({
      deletedAt: null,
      $or: [
        { sku: rawSku },
        { sku: new RegExp(`^${escapeRegex(rawSku)}$`, "i") },
        { sku: new RegExp(`^${escapeRegex(compactSku)}$`, "i") },
      ],
    })
      .select(selectFields)
      .lean();
  }

  if (slug) {
    return Product.findOne({
      deletedAt: null,
      slug: new RegExp(`^${escapeRegex(slug)}$`, "i"),
    })
      .select(selectFields)
      .lean();
  }

  throw new Error("Product id, SKU, or slug required.");
}

async function generateForRequest(req: NextRequest, body?: any) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!hasPermission(user, "products:read") && !hasPermission(user, "products:write")) {
    return NextResponse.json(
      { error: "Forbidden (products permission missing)" },
      { status: 403 }
    );
  }

  const payload = getSearchPayloadFromReq(req, body);

  await dbConnect();

  const product: any = await findYoutubeProduct({
    productId: payload.productId,
    sku: payload.sku,
    slug: payload.slug,
  });

  if (!product) {
    return NextResponse.json(
      { error: "Product not found." },
      { status: 404 }
    );
  }

  const kind = getYoutubeContentKindFromCategory(product?.category);

  if (!kind) {
    return NextResponse.json(
      {
        error:
          "Only Solved Assignments and Question Papers (PYQ) products are supported for YouTube content.",
        product: {
          id: safeStr(product?._id),
          sku: safeStr(product?.sku),
          title: safeStr(product?.title),
          category: safeStr(product?.category),
        },
      },
      { status: 400 }
    );
  }

  try {
    const generated = await buildYoutubeGeneratedPayload({
      product,
      siteName: payload.siteName,
      siteBaseUrl: payload.siteBaseUrl,
    });

    return NextResponse.json(
      {
        ok: true,
        item: generated,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        error: e?.message || "Failed to generate YouTube content.",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return generateForRequest(req);
}

export async function POST(req: NextRequest) {
  let body: any = {};

  try {
    body = await req.json();
  } catch {
    body = {};
  }

  return generateForRequest(req, body);
}