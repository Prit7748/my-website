import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import { getAuthUser, hasPermission } from "@/lib/auth";
import { autoResolveWantToBuyForProduct } from "@/lib/wantToBuyAutoResolve";
import { findVaultPdfBySku, safeStr as safeVaultStr } from "@/lib/pdfVault";
import { syncGeneratedCombosForProductChange } from "@/lib/comboAutoSync";
import { syncGeneratedHardcopyForProductChange } from "@/lib/hardcopyAutoSync";
import { resolveRequiredProductPricing } from "@/lib/productPricing";
import { syncProductAvailabilityBySku } from "@/lib/productAvailability";
import {
  normalizeProductCategory,
  deriveIsDigitalFromCategory,
  PHYSICAL_CATEGORY,
} from "@/lib/productCatalog";

const AUTO_HARDCOPY_EDIT_BLOCK_MESSAGE =
  "Ye auto-generated Handwritten Hardcopy product hai. Isko manual edit/delete/duplicate nahi kiya ja sakta. Source Solved Assignment ko update karo.";
const MANUAL_HARDCOPY_DUPLICATE_BLOCK_MESSAGE =
  "Handwritten Hardcopy (Delivery) manual duplicate disabled hai. Ye category automation se manage hogi.";
const VAULT_MANAGED_PDF_MESSAGE =
  "Direct PDF upload disabled hai. Product PDF sirf PDF Vault se SKU filename ke basis par link hogi.";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function safeBool(x: any, def = false) {
  if (typeof x === "boolean") return x;
  if (typeof x === "string") {
    const v = x.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(v)) return true;
    if (["false", "0", "no", "off"].includes(v)) return false;
  }
  return def;
}

function safeArr(x: any) {
  if (Array.isArray(x)) return x.map((v) => safeStr(v)).filter(Boolean);
  if (typeof x === "string") return x.split(",").map((v) => v.trim()).filter(Boolean);
  return [];
}

function uniqueStrings(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    const k = safeStr(v);
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function toSlug(input: string) {
  return safeStr(input)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeSku(input: string) {
  return safeStr(input).toUpperCase().replace(/\s+/g, "-");
}

function normalizeSkuLike(input: string) {
  return safeStr(input).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeSubjectCode(input: string) {
  return safeStr(input).toUpperCase().replace(/\s+/g, " ").trim();
}

function normalizeSession6(input: any) {
  const s = safeStr(input);
  if (!s) return "";

  if (/^\d{6}$/.test(s)) return s;

  const digits = s.replace(/\D/g, "");
  if (/^\d{6}$/.test(digits)) return digits;

  const years4 = s.match(/\d{4}/g) || [];
  if (years4.length >= 2) return `${years4[0]}${years4[1].slice(-2)}`;

  if (/^\d{4}$/.test(s)) return `${s}00`;

  const monthYear = s.match(
    /^(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+(\d{4})$/i
  );
  if (monthYear) {
    const mon = monthYear[1].toLowerCase();
    const year = monthYear[2];
    const mmMap: Record<string, string> = {
      jan: "01",
      january: "01",
      feb: "02",
      february: "02",
      mar: "03",
      march: "03",
      apr: "04",
      april: "04",
      may: "05",
      jun: "06",
      june: "06",
      jul: "07",
      july: "07",
      aug: "08",
      august: "08",
      sep: "09",
      sept: "09",
      september: "09",
      oct: "10",
      october: "10",
      nov: "11",
      november: "11",
      dec: "12",
      december: "12",
    };
    const mm = mmMap[mon];
    if (mm) return `${year}${mm}`;
  }

  const normalized = s.toLowerCase().replace(/\s+/g, " ").trim();
  if (normalized === "latest" || normalized === "new session") return "";

  if (digits.length >= 8) return `${digits.slice(0, 4)}${digits.slice(-2)}`;
  if (digits.length >= 6) return digits.slice(0, 6);

  return "";
}

function normalizeLang3(input: any) {
  const s = safeStr(input).toUpperCase().replace(/[^A-Z]/g, "");
  if (!s) return "";
  if (s.startsWith("HIN")) return "HIN";
  if (s.startsWith("ENG")) return "ENG";
  if (s.startsWith("SAN")) return "SAN";
  return (s.slice(0, 3) || "").padEnd(3, "X");
}

function normalizeAvailability(input: any) {
  const v = safeStr(input).toLowerCase();

  if (v === "available" || v === "in_stock" || v === "instock" || v === "") {
    return v ? "available" : "";
  }

  if (
    v === "on_demand" ||
    v === "ondemand" ||
    v === "on-demand" ||
    v === "coming_soon" ||
    v === "comingsoon" ||
    v === "coming-soon"
  ) {
    return "on_demand";
  }

  if (
    v === "want_to_buy" ||
    v === "wanttobuy" ||
    v === "want-to-buy" ||
    v === "out_of_stock" ||
    v === "outofstock" ||
    v === "out-of-stock"
  ) {
    return "want_to_buy";
  }

  return "";
}

function getAvailabilityAfterSync(syncResult: any) {
  if (!syncResult || typeof syncResult !== "object") return "";
  const x = syncResult as any;

  if (x.after && typeof x.after === "object") {
    return safeStr(x.after?.availability);
  }

  if (x.snapshot && typeof x.snapshot === "object") {
    return safeStr(x.snapshot?.availability);
  }

  return "";
}

function getUserId(user: any) {
  return safeStr(user?._id || user?.id || user?.userId || user?.email || "");
}

async function makeUniqueSlug(base: string) {
  const clean = toSlug(base) || "product";
  let slug = clean;
  let i = 1;
  while (await Product.findOne({ slug }).select("_id")) {
    i += 1;
    slug = `${clean}-${i}`;
  }
  return slug;
}

async function makeUniqueSku(base: string) {
  const clean = normalizeSku(base) || "SKU";
  let sku = clean;
  let i = 1;
  while (await Product.findOne({ sku }).select("_id")) {
    i += 1;
    sku = `${clean}-C${i}`;
  }
  return sku;
}

function validationError(message: string, field?: string) {
  return NextResponse.json(
    {
      error: message,
      field: field || "",
    },
    { status: 400 }
  );
}

async function getVaultAutofillForSku(sku: string) {
  const skuLike = normalizeSkuLike(sku);
  if (!skuLike) {
    return {
      pdfKey: "",
      pages: 0,
    };
  }

  const vaultFile: any = await findVaultPdfBySku(skuLike);

  return {
    pdfKey: safeVaultStr(vaultFile?.s3Key),
    pages: Math.max(0, Math.trunc(Number(vaultFile?.pageCount || 0))),
  };
}

async function runComboSync(args: { before?: any; after?: any }) {
  try {
    return await syncGeneratedCombosForProductChange(args);
  } catch (syncErr: any) {
    return {
      ok: false,
      error: safeStr(syncErr?.message || "Combo sync failed"),
    };
  }
}

async function runHardcopySync(args: { before?: any; after?: any }) {
  try {
    return await syncGeneratedHardcopyForProductChange(args);
  } catch (syncErr: any) {
    return {
      ok: false,
      error: safeStr(syncErr?.message || "Hardcopy sync failed"),
    };
  }
}

function isLockedAutoGeneratedHardcopy(product: any) {
  return Boolean(product?.isAutoGenerated) && normalizeProductCategory(product?.category) === PHYSICAL_CATEGORY;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!hasPermission(user, "products:read") && !hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden (products permission missing)" }, { status: 403 });
  }

  await dbConnect();
  const { id } = await ctx.params;

  let product: any = await Product.findById(id);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const vaultAutofill = await getVaultAutofillForSku(product.sku);

  let touched = false;

  if (!safeStr(product.pdfKey) && vaultAutofill.pdfKey) {
    product.pdfKey = vaultAutofill.pdfKey;
    touched = true;
  }

  if ((!Number(product.pages) || Number(product.pages) <= 0) && vaultAutofill.pages > 0) {
    product.pages = vaultAutofill.pages;
    touched = true;
  }

  const forcedIsDigital = deriveIsDigitalFromCategory(product.category);
  if (Boolean(product.isDigital) !== forcedIsDigital) {
    product.isDigital = forcedIsDigital;
    touched = true;
  }

  if (touched) {
    product.lastModifiedAt = new Date();
    await product.save();
  }

  await syncProductAvailabilityBySku(product.sku);
  product = await Product.findById(id);

  const editorProduct = {
    ...product.toObject(),
    availability: normalizeAvailability(product?.availability) || "want_to_buy",
    onDemandNote: safeStr(product?.onDemandNote || product?.comingSoonNote),
    isDigital: deriveIsDigitalFromCategory(product?.category),
    isLockedAutoGeneratedHardcopy: isLockedAutoGeneratedHardcopy(product),
  };

  return NextResponse.json(
    {
      product: editorProduct,
      vaultAutofill: {
        pdfLinked: Boolean(safeStr(product.pdfKey)),
        pagesFilled: Number(product.pages || 0),
      },
      availabilityAutomation: {
        mode: "derived-and-synced",
        finalAvailability: safeStr(product?.availability || ""),
      },
    },
    { status: 200 }
  );
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden (products:write missing)" }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  await dbConnect();
  const { id } = await ctx.params;

  const product: any = await Product.findById(id);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  if (isLockedAutoGeneratedHardcopy(product)) {
    return NextResponse.json({ error: AUTO_HARDCOPY_EDIT_BLOCK_MESSAGE }, { status: 400 });
  }

  const beforeProduct = product.toObject();
  const oldSku = safeStr(product.sku);

  if (body?.title !== undefined) product.title = safeStr(body.title);
  if (body?.category !== undefined) product.category = normalizeProductCategory(body.category);

  if (body?.subjectCode !== undefined) product.subjectCode = normalizeSubjectCode(body.subjectCode);
  if (body?.subjectTitleHi !== undefined) product.subjectTitleHi = safeStr(body.subjectTitleHi);
  if (body?.subjectTitleEn !== undefined) product.subjectTitleEn = safeStr(body.subjectTitleEn);
  if (body?.subjectTitleOther !== undefined) product.subjectTitleOther = safeStr(body.subjectTitleOther);

  if (body?.courseCodes !== undefined) {
    product.courseCodes = uniqueStrings(safeArr(body.courseCodes).map((x) => x.toUpperCase()));
  }
  if (body?.courseTitles !== undefined) {
    product.courseTitles = uniqueStrings(safeArr(body.courseTitles));
  }

  if (body?.session !== undefined) product.session = safeStr(body.session);

  if (body?.session6 !== undefined) {
    product.session6 = normalizeSession6(body.session6);
  } else if (body?.session !== undefined) {
    product.session6 = normalizeSession6(product.session);
  }

  if (body?.language !== undefined) product.language = safeStr(body.language);

  if (body?.lang3 !== undefined) {
    product.lang3 = normalizeLang3(body.lang3);
  } else if (body?.language !== undefined) {
    product.lang3 = normalizeLang3(product.language || "OTH");
  }

  if (body?.pages !== undefined) product.pages = safeNum(body.pages, 0);

  if (body?.availability !== undefined) {
    // availability manual control disabled
  }

  if (body?.importantNote !== undefined) product.importantNote = safeStr(body.importantNote);

  if (body?.deliverWithinMinutes !== undefined) {
    product.deliverWithinMinutes = Math.trunc(safeNum(body.deliverWithinMinutes, 20));
  }

  if (body?.onDemandNote !== undefined) {
    product.onDemandNote = safeStr(body.onDemandNote);
  } else if (body?.comingSoonNote !== undefined) {
    product.onDemandNote = safeStr(body.comingSoonNote);
  }

  if (body?.autoMakeAvailableOnUpload !== undefined) {
    product.autoMakeAvailableOnUpload = safeBool(body.autoMakeAvailableOnUpload, true);
  }

  if (body?.shortDesc !== undefined) product.shortDesc = safeStr(body.shortDesc);
  if (body?.descriptionHtml !== undefined) product.descriptionHtml = safeStr(body.descriptionHtml);

  if (body?.pdfKey !== undefined && safeStr(body?.pdfKey) !== safeStr(product.pdfKey)) {
    return NextResponse.json(
      { error: VAULT_MANAGED_PDF_MESSAGE, field: "pdfKey" },
      { status: 400 }
    );
  }

  if (body?.pdfUrl !== undefined) product.pdfUrl = safeStr(body.pdfUrl);

  if (body?.images !== undefined) {
    product.images = uniqueStrings(safeArr(body.images));
  }

  if (body?.images !== undefined) {
    const imgs = Array.isArray(product.images) ? product.images : [];
    if (body?.thumbnailUrl === undefined) product.thumbnailUrl = imgs[0] || "";
    if (body?.quickUrl === undefined) product.quickUrl = imgs[1] || imgs[0] || "";
  }

  if (body?.thumbnailUrl !== undefined) product.thumbnailUrl = safeStr(body.thumbnailUrl);
  if (body?.quickUrl !== undefined) product.quickUrl = safeStr(body.quickUrl);

  if (body?.metaTitle !== undefined) product.metaTitle = safeStr(body.metaTitle);
  if (body?.metaDescription !== undefined) product.metaDescription = safeStr(body.metaDescription);

  if (body?.isActive !== undefined) product.isActive = safeBool(body.isActive, false);

  if (body?.slug !== undefined) {
    const nextSlug = toSlug(safeStr(body.slug) || product.title);
    if (!nextSlug) return validationError("Slug required", "slug");

    const conflict = await Product.findOne({ slug: nextSlug, _id: { $ne: product._id } }).select("_id slug title");
    if (conflict) {
      return NextResponse.json(
        { error: "Slug already exists", field: "slug", conflictValue: nextSlug },
        { status: 409 }
      );
    }
    product.slug = nextSlug;
  }

  if (body?.sku !== undefined) {
    const nextSku = normalizeSku(body.sku);
    if (!nextSku) return validationError("SKU required", "sku");

    const conflict = await Product.findOne({ sku: nextSku, _id: { $ne: product._id } }).select("_id sku title");
    if (conflict) {
      return NextResponse.json(
        { error: "SKU already exists", field: "sku", conflictValue: nextSku },
        { status: 409 }
      );
    }
    product.sku = nextSku;
  }

  if (!safeStr(product.slug)) product.slug = toSlug(product.title || "product");
  if (!safeStr(product.sku)) product.sku = normalizeSku("SKU");

  product.courseCodes = uniqueStrings(safeArr(product.courseCodes).map((x) => x.toUpperCase()));
  product.courseTitles = uniqueStrings(safeArr(product.courseTitles));
  product.images = uniqueStrings(safeArr(product.images));

  const imgs = Array.isArray(product.images) ? product.images : [];
  if (!safeStr(product.thumbnailUrl) && imgs.length) product.thumbnailUrl = imgs[0];
  if (!safeStr(product.quickUrl) && imgs.length) product.quickUrl = imgs[1] || imgs[0];

  product.subjectCode = normalizeSubjectCode(product.subjectCode);
  product.session = safeStr(product.session);
  product.session6 = normalizeSession6(product.session6 || product.session);
  product.language = safeStr(product.language);
  product.lang3 = normalizeLang3(product.lang3 || product.language);

  product.pages = Math.max(0, Math.trunc(safeNum(product.pages, 0)));
  product.deliverWithinMinutes = Math.trunc(safeNum(product.deliverWithinMinutes, 20));

  const vaultAutofill = await getVaultAutofillForSku(product.sku);

  if (!safeStr(product.pdfKey) && vaultAutofill.pdfKey) {
    product.pdfKey = vaultAutofill.pdfKey;
  }

  if ((!Number(product.pages) || Number(product.pages) <= 0) && vaultAutofill.pages > 0) {
    product.pages = vaultAutofill.pages;
  }

  const pricingResolution = await resolveRequiredProductPricing({
    category: product.category,
    courseCodes: product.courseCodes,
    productId: String(product._id),
    productSku: product.sku,
  });

  if (!pricingResolution.ok || Number(pricingResolution.price) <= 0) {
    return validationError(
      "Pricing rule not found. Pehle Product Pricing page me category + course rule ya product override set karo.",
      "price"
    );
  }

  product.price = Math.max(0, safeNum(pricingResolution.price, 0));
  product.oldPrice = Math.max(0, safeNum(pricingResolution.oldPrice, 0));

  const pdfKeyNow = safeStr(product.pdfKey);
  product.availability = pdfKeyNow ? "available" : "want_to_buy";

  product.isDigital = deriveIsDigitalFromCategory(product.category);

  if (!safeStr(product.title)) return validationError("Title required hai.", "title");
  if (!safeStr(product.category)) return validationError("Category required hai.", "category");
  if (!safeStr(product.subjectCode)) return validationError("Subject Code required hai.", "subjectCode");

  if (!safeStr(product.session)) return validationError("Session required hai.", "session");
  const sessionRawNormalized = safeStr(product.session).toLowerCase().replace(/\s+/g, " ").trim();
  const isNamedSession = sessionRawNormalized === "latest" || sessionRawNormalized === "new session";

  if (!isNamedSession && !/^\d{6}$/.test(safeStr(product.session6))) {
    return validationError(
      "Session invalid hai. Examples: 2025-2026, 2026, July 2024, Latest",
      "session"
    );
  }

  if (!safeStr(product.language)) return validationError("Language required hai.", "language");
  if (!/^[A-Z]{3}$/.test(safeStr(product.lang3))) {
    return validationError("lang3 invalid hai. 3 uppercase letters required.", "lang3");
  }

  if (!Number.isFinite(Number(product.price)) || Number(product.price) <= 0) {
    return validationError("Valid price required hai.", "price");
  }

  if (Number(product.oldPrice) < 0) {
    return validationError("Old price negative nahi ho sakta.", "oldPrice");
  }

  if (Number(product.pages) < 0) {
    return validationError("Pages negative nahi ho sakte.", "pages");
  }

  if (
    !Number.isFinite(Number(product.deliverWithinMinutes)) ||
    Number(product.deliverWithinMinutes) < 1 ||
    Number(product.deliverWithinMinutes) > 1440
  ) {
    return NextResponse.json(
      { error: "deliverWithinMinutes must be between 1 and 1440", field: "deliverWithinMinutes" },
      { status: 400 }
    );
  }

  const [slugConflict, skuConflict] = await Promise.all([
    Product.findOne({ slug: product.slug, _id: { $ne: product._id } }).select("_id slug"),
    Product.findOne({ sku: product.sku, _id: { $ne: product._id } }).select("_id sku"),
  ]);

  if (slugConflict) {
    return NextResponse.json(
      { error: "Slug already exists", field: "slug", conflictValue: safeStr(product.slug) },
      { status: 409 }
    );
  }

  if (skuConflict) {
    return NextResponse.json(
      { error: "SKU already exists", field: "sku", conflictValue: safeStr(product.sku) },
      { status: 409 }
    );
  }

  product.lastModifiedAt = new Date();

  try {
    await product.save();

    if (oldSku && oldSku !== safeStr(product.sku)) {
      await syncProductAvailabilityBySku(oldSku);
    }

    const availabilitySync = await syncProductAvailabilityBySku(product.sku);
    const freshProduct: any = await Product.findById(product._id);
    const finalProduct = freshProduct || product;

    const resolveResult = await autoResolveWantToBuyForProduct({
      productId: finalProduct._id,
      availability: finalProduct.availability,
      pdfKey: finalProduct.pdfKey,
      isActive: finalProduct.isActive,
    });

    const comboSync = await runComboSync({
      before: beforeProduct,
      after: finalProduct.toObject ? finalProduct.toObject() : finalProduct,
    });

    const hardcopySync = await runHardcopySync({
      before: beforeProduct,
      after: finalProduct.toObject ? finalProduct.toObject() : finalProduct,
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Product updated ✅",
        product: finalProduct,
        pricingResolution,
        autoResolvedWantToBuy: resolveResult,
        comboSync,
        hardcopySync,
        vaultAutofill: {
          pdfLinked: Boolean(finalProduct.pdfKey),
          pagesFilled: Number(finalProduct.pages || 0),
        },
        availabilityAutomation: {
          mode: "derived-and-synced",
          finalAvailability:
            getAvailabilityAfterSync(availabilitySync) || safeStr(finalProduct.availability || ""),
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    if (e?.code === 11000) {
      const key = Object.keys(e?.keyPattern || e?.keyValue || {})[0] || "unknown";
      const val = e?.keyValue?.[key];
      return NextResponse.json(
        {
          error: `${String(key).toUpperCase()} already exists`,
          field: key,
          conflictValue: safeStr(val),
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: e?.message || "Failed to update product" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden (products:write missing)" }, { status: 403 });
  }

  await dbConnect();
  const { id } = await ctx.params;

  const product: any = await Product.findById(id);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  if (isLockedAutoGeneratedHardcopy(product)) {
    return NextResponse.json({ error: AUTO_HARDCOPY_EDIT_BLOCK_MESSAGE }, { status: 400 });
  }

  if (product.deletedAt) {
    return NextResponse.json({ ok: true, message: "Already in trash", productId: product._id }, { status: 200 });
  }

  const beforeProduct = product.toObject();

  product.deletedAt = new Date();
  product.deletedBy = getUserId(user);
  product.lastModifiedAt = new Date();
  await product.save();

  const afterProduct = product.toObject();

  const comboSync = await runComboSync({ before: beforeProduct, after: afterProduct });
  const hardcopySync = await runHardcopySync({ before: beforeProduct, after: afterProduct });

  return NextResponse.json(
    {
      ok: true,
      message: "Moved to trash",
      productId: product._id,
      comboSync,
      hardcopySync,
    },
    { status: 200 }
  );
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden (products:write missing)" }, { status: 403 });
  }

  const action = req.nextUrl.searchParams.get("action") || "";
  await dbConnect();
  const { id } = await ctx.params;

  if (action === "restore") {
    const product: any = await Product.findById(id);
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    if (isLockedAutoGeneratedHardcopy(product)) {
      return NextResponse.json({ error: AUTO_HARDCOPY_EDIT_BLOCK_MESSAGE }, { status: 400 });
    }

    product.deletedAt = null;
    product.deletedBy = "";
    product.lastModifiedAt = new Date();
    await product.save();

    await syncProductAvailabilityBySku(product.sku);

    const restoredDoc: any = await Product.findById(product._id);
    const restored = restoredDoc?.toObject ? restoredDoc.toObject() : product.toObject();

    const comboSync = await runComboSync({ after: restored });
    const hardcopySync = await runHardcopySync({ after: restored });

    return NextResponse.json(
      {
        ok: true,
        message: "Restored",
        productId: product._id,
        comboSync,
        hardcopySync,
      },
      { status: 200 }
    );
  }

  if (action === "purge") {
    const product: any = await Product.findById(id);
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    if (isLockedAutoGeneratedHardcopy(product)) {
      return NextResponse.json({ error: AUTO_HARDCOPY_EDIT_BLOCK_MESSAGE }, { status: 400 });
    }

    if (!product.deletedAt) {
      return NextResponse.json({ error: "Product is not in trash. Move to trash first." }, { status: 400 });
    }

    const beforeProduct = product.toObject();

    await Product.deleteOne({ _id: id });

    const comboSync = await runComboSync({ before: beforeProduct });
    const hardcopySync = await runHardcopySync({ before: beforeProduct });

    return NextResponse.json(
      {
        ok: true,
        message: "Permanently deleted",
        productId: id,
        comboSync,
        hardcopySync,
      },
      { status: 200 }
    );
  }

  if (action === "duplicate") {
    const src: any = await Product.findById(id);
    if (!src) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    if (isLockedAutoGeneratedHardcopy(src)) {
      return NextResponse.json({ error: AUTO_HARDCOPY_EDIT_BLOCK_MESSAGE }, { status: 400 });
    }

    if (normalizeProductCategory(src.category) === PHYSICAL_CATEGORY) {
      return NextResponse.json({ error: MANUAL_HARDCOPY_DUPLICATE_BLOCK_MESSAGE }, { status: 400 });
    }

    const newSlug = await makeUniqueSlug(`${safeStr(src.slug) || safeStr(src.title)}-copy`);
    const newSku = await makeUniqueSku(`${safeStr(src.sku) || "SKU"}-COPY`);
    const vaultAutofill = await getVaultAutofillForSku(newSku);

    const finalPdfKey = safeStr(vaultAutofill.pdfKey);
    const finalPages =
      Math.max(0, Math.trunc(Number(vaultAutofill.pages || 0))) ||
      Math.max(0, Math.trunc(safeNum(src.pages, 0)));

    const pricingResolution = await resolveRequiredProductPricing({
      category: safeStr(src.category),
      courseCodes: Array.isArray(src.courseCodes) ? src.courseCodes : [],
      productSku: newSku,
    });

    if (!pricingResolution.ok || Number(pricingResolution.price) <= 0) {
      return NextResponse.json(
        {
          error: "Duplicate product ke liye pricing rule required hai. Pehle Product Pricing page me relevant rule set karo.",
          field: "price",
        },
        { status: 400 }
      );
    }

    const duplicatedCategory = normalizeProductCategory(src.category);
    const duplicatedIsDigital = deriveIsDigitalFromCategory(duplicatedCategory);

    const created = await Product.create({
      title: `${safeStr(src.title)} (Copy)`,
      slug: newSlug,
      sku: newSku,

      category: duplicatedCategory,

      subjectCode: normalizeSubjectCode(src.subjectCode),
      subjectTitleHi: safeStr(src.subjectTitleHi),
      subjectTitleEn: safeStr(src.subjectTitleEn),
      subjectTitleOther: safeStr(src.subjectTitleOther),

      courseCodes: uniqueStrings(safeArr(src.courseCodes).map((x) => x.toUpperCase())),
      courseTitles: uniqueStrings(safeArr(src.courseTitles)),

      session: safeStr(src.session),
      session6: normalizeSession6(src.session6 || src.session),
      language: safeStr(src.language),
      lang3: normalizeLang3(src.lang3 || src.language),

      price: Math.max(0, safeNum(pricingResolution.price, 0)),
      oldPrice: Math.max(0, safeNum(pricingResolution.oldPrice, 0)),

      pages: finalPages,
      availability: finalPdfKey ? "available" : "want_to_buy",
      importantNote: safeStr(src.importantNote),

      deliverWithinMinutes: Math.trunc(safeNum(src.deliverWithinMinutes, 20)),
      onDemandNote: safeStr(src.onDemandNote || src.comingSoonNote),
      autoMakeAvailableOnUpload: Boolean(src.autoMakeAvailableOnUpload ?? true),

      shortDesc: safeStr(src.shortDesc),
      descriptionHtml: safeStr(src.descriptionHtml),

      isDigital: duplicatedIsDigital,
      pdfKey: finalPdfKey,
      pdfUrl: "",

      images: uniqueStrings(safeArr(src.images)),
      thumbnailUrl: safeStr(src.thumbnailUrl),
      quickUrl: safeStr(src.quickUrl),

      metaTitle: safeStr(src.metaTitle),
      metaDescription: safeStr(src.metaDescription),

      isAutoGenerated: false,
      autoGenerationType: "",
      autoGeneratedFromProductId: null,
      autoGeneratedFromSku: "",
      autoGeneratedFromCategory: "",
      autoGeneratedAt: null,

      isActive: false,
      lastModifiedAt: new Date(),

      deletedAt: null,
      deletedBy: "",
    });

    await syncProductAvailabilityBySku(newSku);
    const freshCreated: any = await Product.findById(created._id);
    const finalCreated = freshCreated || created;

    const comboSync = await runComboSync({ after: finalCreated.toObject ? finalCreated.toObject() : finalCreated });
    const hardcopySync = await runHardcopySync({ after: finalCreated.toObject ? finalCreated.toObject() : finalCreated });

    return NextResponse.json(
      {
        ok: true,
        message: "Product duplicated",
        product: finalCreated,
        pricingResolution,
        comboSync,
        hardcopySync,
        availabilityAutomation: {
          mode: "derived-and-synced",
          finalAvailability: safeStr(finalCreated?.availability || ""),
        },
      },
      { status: 201 }
    );
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}