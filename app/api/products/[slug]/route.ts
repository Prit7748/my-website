import { NextRequest, NextResponse } from "next/server";

import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import GlobalToggle from "@/models/GlobalToggle";
import { resolveOnDemandTimingForProduct } from "@/lib/onDemandTiming";

export const runtime = "nodejs";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function slugFromRequest(req: Request, params?: any) {
  const pSlug = params?.slug;
  if (typeof pSlug === "string" && pSlug.trim()) return decodeURIComponent(pSlug).trim();

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const raw = parts[2] || "";
  return decodeURIComponent(raw).trim();
}

function normAvail(v?: string) {
  return safeStr(v).toLowerCase();
}

function categorySlugFromProductCategory(category?: string) {
  const c = safeStr(category).toLowerCase();

  if (c === "solved assignments") return "solved-assignments";
  if (c === "handwritten pdfs") return "handwritten-pdfs";
  if (c.includes("handwritten") && (c.includes("hardcopy") || c.includes("delivery"))) {
    return "handwritten-hardcopy";
  }
  if (c.includes("question") && (c.includes("paper") || c.includes("pyq"))) return "question-papers";
  if (c.includes("guess")) return "guess-papers";
  if (c.includes("ebook") || c.includes("notes")) return "ebooks";
  if (c.includes("project") || c.includes("synopsis")) return "projects";
  if (c.includes("combo")) return "combo";

  return "products";
}

function normalizeImages(images: any, thumbnailUrl?: string, quickUrl?: string) {
  const raw = Array.isArray(images) ? images : [];
  const urls = raw
    .map((x: any) => {
      if (typeof x === "string") return safeStr(x);
      if (x && typeof x === "object" && typeof x.url === "string") return safeStr(x.url);
      return "";
    })
    .filter(Boolean);

  const unique = Array.from(new Set(urls));
  const thumb = safeStr(thumbnailUrl) || unique[0] || "";
  const quick = safeStr(quickUrl) || unique[1] || unique[0] || "";

  return {
    images: unique,
    thumbnailUrl: thumb,
    quickUrl: quick,
  };
}

async function getOnDemandSalesEnabled() {
  try {
    const doc: any =
      (await GlobalToggle.findOne({ key: "on_demand_sales" }).lean()) ||
      (await GlobalToggle.findOne({ key: "coming_soon_sales" }).lean());

    if (!doc) return true;
    return Boolean(doc.enabled);
  } catch {
    return true;
  }
}

function resolveAvailability(rawAvailability: string, onDemandSalesEnabled: boolean) {
  const a = normAvail(rawAvailability);

  if (a === "out_of_stock" || a === "outofstock" || a === "out-of-stock") return "want_to_buy";
  if (a === "want_to_buy" || a === "wanttobuy" || a === "want-to-buy") return "want_to_buy";

  if (a === "coming_soon" || a === "comingsoon" || a === "coming-soon") {
    return onDemandSalesEnabled ? "on_demand" : "want_to_buy";
  }

  if (a === "on_demand" || a === "ondemand" || a === "on-demand") {
    return onDemandSalesEnabled ? "on_demand" : "want_to_buy";
  }

  if (a === "available" || a === "in_stock" || a === "instock" || a === "") return "available";

  return "available";
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    await dbConnect();

    const resolvedParams = context?.params ? await context.params : undefined;
    const slug = safeStr(slugFromRequest(req, resolvedParams));

    if (!slug) {
      return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
    }

    const p: any = await Product.findOne({
      slug,
      $and: [
        { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] },
        { $or: [{ isActive: true }, { isActive: { $exists: false } }] },
      ],
    }).lean();

    if (!p) {
      return NextResponse.json({ error: "Not found", slug }, { status: 404 });
    }

    const normalizedImages = normalizeImages(p.images, p.thumbnailUrl, p.quickUrl);
    const onDemandSalesEnabled = await getOnDemandSalesEnabled();
    const rawAvailability = safeStr(p.availability || "");
    const resolvedAvail = resolveAvailability(rawAvailability, onDemandSalesEnabled);

    const resolvedTiming = await resolveOnDemandTimingForProduct({
      category: p.category,
      courseCodes: Array.isArray(p.courseCodes) ? p.courseCodes : [],
      deliverWithinMinutes: p.deliverWithinMinutes,
      onDemandNote: p.onDemandNote,
    });

    return NextResponse.json(
      {
        product: {
          _id: String(p._id),
          title: p.title || "",
          slug: p.slug || "",
          sku: p.sku || "",
          category: p.category || "",
          categorySlug: categorySlugFromProductCategory(p.category),
          href: `/${categorySlugFromProductCategory(p.category)}/${encodeURIComponent(p.slug || "")}`,

          subjectCode: p.subjectCode || "",
          subjectTitleHi: p.subjectTitleHi || "",
          subjectTitleEn: p.subjectTitleEn || "",
          courseCodes: Array.isArray(p.courseCodes) ? p.courseCodes : [],
          courseTitles: Array.isArray(p.courseTitles) ? p.courseTitles : [],

          session: p.session || "",
          language: p.language || "",

          price: Number(p.price || 0),
          oldPrice: p.oldPrice !== undefined && p.oldPrice !== null ? Number(p.oldPrice) : null,

          shortDesc: p.shortDesc || "",
          descriptionHtml: p.descriptionHtml || "",

          pages: Number(p.pages || 0),

          availability: rawAvailability || "",
          effectiveAvailability: resolvedAvail,
          onDemandSalesEnabled,
          canPurchase: resolvedAvail !== "want_to_buy",

          deliverWithinMinutes: Math.max(
            1,
            safeNum(resolvedTiming?.deliverWithinMinutes, p?.deliverWithinMinutes || 20)
          ),
          onDemandNote: safeStr(resolvedTiming?.onDemandNote || p?.onDemandNote),

          rawDeliverWithinMinutes: Math.max(1, safeNum(p?.deliverWithinMinutes, 20)),
          rawOnDemandNote: safeStr(p?.onDemandNote),

          onDemandTimingSource: safeStr(resolvedTiming?.source),
          onDemandMatchedCourseCode: safeStr(resolvedTiming?.matchedCourseCode),
          onDemandMatchedRuleId: safeStr(resolvedTiming?.matchedRuleId),
          onDemandMatchedRuleType: safeStr(resolvedTiming?.matchedRuleType),

          importantNote: p.importantNote || "",

          isDigital: !!p.isDigital,
          pdfUrl: p.pdfUrl || "",
          pdfKey: p.pdfKey || "",

          images: normalizedImages.images,
          thumbnailUrl: normalizedImages.thumbnailUrl,
          quickUrl: normalizedImages.quickUrl,

          createdAt: p.createdAt || null,
          updatedAt: p.updatedAt || null,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: "Server error", details: e?.message || "unknown" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}