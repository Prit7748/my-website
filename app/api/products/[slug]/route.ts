import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import GlobalToggle from "@/models/GlobalToggle";
import { resolveOnDemandTimingForProduct } from "@/lib/onDemandTiming";
import {
  buildAssignmentMasterThumbUrl,
  buildHardcopyMasterThumbUrl,
  buildQuestionPaperMasterThumbUrl,
  isHandwrittenHardcopyProduct,
  isQuestionPaperProduct,
  isSolvedAssignmentProduct,
} from "@/lib/thumbUrls";

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

function fileNameOf(urlOrPath: string) {
  const clean = safeStr(urlOrPath).split("?")[0];
  const parts = clean.split("/");
  return (parts[parts.length - 1] || "").toLowerCase();
}

function normalizeImagesToUrls(images: any) {
  const arr = Array.isArray(images) ? images : [];
  if (!arr.length) {
    return { urls: [] as string[], thumbUrl: "", quickUrl: "" };
  }

  const allStrings = arr.every((x: any) => typeof x === "string");
  if (allStrings) {
    const urls = Array.from(
      new Set(
        arr
          .map((s: string) => safeStr(s))
          .filter(Boolean)
      )
    ).sort((a, b) => fileNameOf(a).localeCompare(fileNameOf(b), undefined, { numeric: true }));

    return {
      urls,
      thumbUrl: urls[0] || "",
      quickUrl: urls[1] || urls[0] || "",
    };
  }

  const strings: string[] = arr
    .filter((x: any) => typeof x === "string")
    .map((s: string) => safeStr(s))
    .filter(Boolean);

  const objects = arr
    .filter((x: any) => x && typeof x === "object" && typeof x.url === "string" && x.url.trim())
    .sort((a: any, b: any) => {
      const ak = safeStr(a.sortKey || a.filename || fileNameOf(a.url)).toLowerCase();
      const bk = safeStr(b.sortKey || b.filename || fileNameOf(b.url)).toLowerCase();
      return ak.localeCompare(bk, undefined, { numeric: true });
    })
    .map((x: any) => safeStr(x.url))
    .filter(Boolean);

  const urls = Array.from(new Set([...strings, ...objects])).sort((a, b) =>
    fileNameOf(a).localeCompare(b, undefined, { numeric: true })
  );

  return {
    urls,
    thumbUrl: urls[0] || "",
    quickUrl: urls[1] || urls[0] || "",
  };
}

function buildMasterThumbnailFallback(product: any) {
  if (isSolvedAssignmentProduct(product)) {
    return buildAssignmentMasterThumbUrl(product);
  }

  if (isHandwrittenHardcopyProduct(product)) {
    return buildHardcopyMasterThumbUrl(product);
  }

  if (isQuestionPaperProduct(product)) {
    return buildQuestionPaperMasterThumbUrl(product);
  }

  return "";
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

    const filter: any = {
      slug,
      $and: [
        { $or: [{ isActive: true }, { isActive: { $exists: false } }] },
        { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] },
      ],
    };

    const p: any = await Product.findOne(filter)
      .select({
        _id: 1,
        title: 1,
        slug: 1,
        sku: 1,
        category: 1,

        subjectCode: 1,
        subjectTitleHi: 1,
        subjectTitleEn: 1,
        courseCodes: 1,
        courseTitles: 1,

        session: 1,
        language: 1,

        price: 1,
        oldPrice: 1,

        shortDesc: 1,
        descriptionHtml: 1,
        pages: 1,

        availability: 1,
        deliverWithinMinutes: 1,
        onDemandNote: 1,
        importantNote: 1,

        isDigital: 1,
        pdfUrl: 1,
        pdfKey: 1,

        images: 1,
        thumbnailUrl: 1,
        quickUrl: 1,

        createdAt: 1,
        updatedAt: 1,
      })
      .lean();

    if (!p) {
      return NextResponse.json({ error: "Not found", slug }, { status: 404 });
    }

    const onDemandSalesEnabled = await getOnDemandSalesEnabled();
    const rawAvailability = safeStr(p.availability || "");
    const effectiveAvailability = resolveAvailability(rawAvailability, onDemandSalesEnabled);

    const resolvedTiming = await resolveOnDemandTimingForProduct({
      category: p.category,
      courseCodes: Array.isArray(p.courseCodes) ? p.courseCodes : [],
      deliverWithinMinutes: p.deliverWithinMinutes,
      onDemandNote: p.onDemandNote,
    });

    const { urls, thumbUrl, quickUrl } = normalizeImagesToUrls(p.images);
    const masterThumbFallback = buildMasterThumbnailFallback({
      _id: p._id ? String(p._id) : "",
      id: p._id ? String(p._id) : "",
      slug: safeStr(p.slug),
      title: safeStr(p.title),
      category: safeStr(p.category),
      subjectCode: safeStr(p.subjectCode),
      subjectTitleHi: safeStr(p.subjectTitleHi),
      subjectTitleEn: safeStr(p.subjectTitleEn),
      courseCodes: Array.isArray(p.courseCodes) ? p.courseCodes : [],
      session: safeStr(p.session),
      updatedAt: p.updatedAt || "",
      language: safeStr(p.language),
      images: urls,
    });

    const finalThumb = safeStr(p.thumbnailUrl) || thumbUrl || masterThumbFallback;
    const finalQuick = safeStr(p.quickUrl) || quickUrl || finalThumb;

    return NextResponse.json(
      {
        product: {
          _id: String(p._id),
          title: safeStr(p.title),
          slug: safeStr(p.slug),
          sku: safeStr(p.sku),
          category: safeStr(p.category),

          subjectCode: safeStr(p.subjectCode),
          subjectTitleHi: safeStr(p.subjectTitleHi),
          subjectTitleEn: safeStr(p.subjectTitleEn),
          courseCodes: Array.isArray(p.courseCodes) ? p.courseCodes : [],
          courseTitles: Array.isArray(p.courseTitles) ? p.courseTitles : [],

          session: safeStr(p.session),
          language: safeStr(p.language),

          price: Number(p.price || 0),
          oldPrice: p.oldPrice !== undefined && p.oldPrice !== null ? Number(p.oldPrice) : null,

          shortDesc: safeStr(p.shortDesc),
          descriptionHtml: safeStr(p.descriptionHtml),

          pages: Number(p.pages || 0),

          availability: rawAvailability,
          effectiveAvailability,
          canPurchase: effectiveAvailability !== "want_to_buy",
          onDemandSalesEnabled,

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

          importantNote: safeStr(p.importantNote),

          isDigital: !!p.isDigital,
          pdfUrl: safeStr(p.pdfUrl),
          pdfKey: safeStr(p.pdfKey),

          images: urls,
          thumbUrl: finalThumb,
          quickUrl: finalQuick,
          thumbnailUrl: finalThumb,

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