import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { getAuthUser, hasPermission } from "@/lib/auth";
import HardcopyTemplateConfig, {
  HARDCOPY_TEMPLATE_CONFIG_KEY,
} from "@/models/HardcopyTemplateConfig";

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

  if (typeof x === "number") {
    if (x === 1) return true;
    if (x === 0) return false;
  }

  return def;
}

function getUserId(user: any) {
  return safeStr(user?._id || user?.id || user?.userId || user?.email || "");
}

const DEFAULTS = {
  titleTemplate: "IGNOU %1 Handwritten Hardcopy Assignment %5 (%6 Medium)",
  shortDescTemplate:
    "Buy IGNOU %1 handwritten hardcopy assignment for session %5 in %6 medium. This is a physical handwritten delivery product.",
  longDescTemplate:
    "This product is the handwritten hardcopy delivery version of the solved assignment for subject %1 (%2). It is mapped to course %3 (%4), prepared for session %5, and available in %6 medium. This is a physical handwritten product, not a downloadable PDF.",
  importantNoteTemplate:
    "This product is a handwritten physical hardcopy delivery version of the related solved assignment. PDF is not included with this product. Please verify subject code, medium, session, and course before placing the order.",
  metaTitleTemplate: "IGNOU %1 Handwritten Hardcopy Assignment %5 (%6 Medium)",
  metaDescriptionTemplate:
    "Order IGNOU %1 handwritten hardcopy assignment for session %5 in %6 medium. Physical delivery product based on the solved assignment source.",

  deliveryChargeEnabled: true,
  deliveryChargeThresholdAmount: 1000,
  deliveryChargeAmount: 100,
  deliveryChargeLabel: "Delivery Charge",
  freeDeliveryLabel: "Free Delivery",
};

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!hasPermission(user, "products:read") && !hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();

  let doc: any = await HardcopyTemplateConfig.findOne({
    key: HARDCOPY_TEMPLATE_CONFIG_KEY,
  }).lean();

  if (!doc) {
    doc = {
      key: HARDCOPY_TEMPLATE_CONFIG_KEY,
      ...DEFAULTS,
      updatedBy: "",
      createdAt: null,
      updatedAt: null,
    };
  }

  return NextResponse.json({
    ok: true,
    item: {
      key: HARDCOPY_TEMPLATE_CONFIG_KEY,
      titleTemplate: safeStr(doc?.titleTemplate || DEFAULTS.titleTemplate),
      shortDescTemplate: safeStr(doc?.shortDescTemplate || DEFAULTS.shortDescTemplate),
      longDescTemplate: safeStr(doc?.longDescTemplate || DEFAULTS.longDescTemplate),
      importantNoteTemplate: safeStr(
        doc?.importantNoteTemplate || DEFAULTS.importantNoteTemplate
      ),
      metaTitleTemplate: safeStr(doc?.metaTitleTemplate || DEFAULTS.metaTitleTemplate),
      metaDescriptionTemplate: safeStr(
        doc?.metaDescriptionTemplate || DEFAULTS.metaDescriptionTemplate
      ),

      deliveryChargeEnabled: safeBool(
        doc?.deliveryChargeEnabled,
        DEFAULTS.deliveryChargeEnabled
      ),
      deliveryChargeThresholdAmount: Math.max(
        0,
        safeNum(doc?.deliveryChargeThresholdAmount, DEFAULTS.deliveryChargeThresholdAmount)
      ),
      deliveryChargeAmount: Math.max(
        0,
        safeNum(doc?.deliveryChargeAmount, DEFAULTS.deliveryChargeAmount)
      ),
      deliveryChargeLabel: safeStr(
        doc?.deliveryChargeLabel || DEFAULTS.deliveryChargeLabel
      ),
      freeDeliveryLabel: safeStr(doc?.freeDeliveryLabel || DEFAULTS.freeDeliveryLabel),

      updatedBy: safeStr(doc?.updatedBy),
      createdAt: doc?.createdAt || null,
      updatedAt: doc?.updatedAt || null,
    },
    defaults: DEFAULTS,
  });
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!hasPermission(user, "products:write")) {
    return NextResponse.json(
      { error: "Forbidden (products:write missing)" },
      { status: 403 }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = {
    key: HARDCOPY_TEMPLATE_CONFIG_KEY,

    titleTemplate: safeStr(body?.titleTemplate || DEFAULTS.titleTemplate),
    shortDescTemplate: safeStr(
      body?.shortDescTemplate || DEFAULTS.shortDescTemplate
    ),
    longDescTemplate: safeStr(body?.longDescTemplate || DEFAULTS.longDescTemplate),
    importantNoteTemplate: safeStr(
      body?.importantNoteTemplate || DEFAULTS.importantNoteTemplate
    ),
    metaTitleTemplate: safeStr(body?.metaTitleTemplate || DEFAULTS.metaTitleTemplate),
    metaDescriptionTemplate: safeStr(
      body?.metaDescriptionTemplate || DEFAULTS.metaDescriptionTemplate
    ),

    deliveryChargeEnabled: safeBool(
      body?.deliveryChargeEnabled,
      DEFAULTS.deliveryChargeEnabled
    ),
    deliveryChargeThresholdAmount: Math.max(
      0,
      safeNum(body?.deliveryChargeThresholdAmount, DEFAULTS.deliveryChargeThresholdAmount)
    ),
    deliveryChargeAmount: Math.max(
      0,
      safeNum(body?.deliveryChargeAmount, DEFAULTS.deliveryChargeAmount)
    ),
    deliveryChargeLabel: safeStr(
      body?.deliveryChargeLabel || DEFAULTS.deliveryChargeLabel
    ),
    freeDeliveryLabel: safeStr(body?.freeDeliveryLabel || DEFAULTS.freeDeliveryLabel),

    updatedBy: getUserId(user),
  };

  if (!payload.titleTemplate) {
    return NextResponse.json({ error: "Title Template required" }, { status: 400 });
  }

  if (!payload.deliveryChargeLabel) {
    return NextResponse.json(
      { error: "Delivery Charge Label required" },
      { status: 400 }
    );
  }

  if (!payload.freeDeliveryLabel) {
    return NextResponse.json(
      { error: "Free Delivery Label required" },
      { status: 400 }
    );
  }

  await dbConnect();

  const doc: any = await HardcopyTemplateConfig.findOneAndUpdate(
    { key: HARDCOPY_TEMPLATE_CONFIG_KEY },
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return NextResponse.json({
    ok: true,
    message: "Hardcopy templates and delivery charge settings saved successfully.",
    item: {
      key: HARDCOPY_TEMPLATE_CONFIG_KEY,
      titleTemplate: safeStr(doc?.titleTemplate),
      shortDescTemplate: safeStr(doc?.shortDescTemplate),
      longDescTemplate: safeStr(doc?.longDescTemplate),
      importantNoteTemplate: safeStr(doc?.importantNoteTemplate),
      metaTitleTemplate: safeStr(doc?.metaTitleTemplate),
      metaDescriptionTemplate: safeStr(doc?.metaDescriptionTemplate),

      deliveryChargeEnabled: safeBool(
        doc?.deliveryChargeEnabled,
        DEFAULTS.deliveryChargeEnabled
      ),
      deliveryChargeThresholdAmount: Math.max(
        0,
        safeNum(doc?.deliveryChargeThresholdAmount, DEFAULTS.deliveryChargeThresholdAmount)
      ),
      deliveryChargeAmount: Math.max(
        0,
        safeNum(doc?.deliveryChargeAmount, DEFAULTS.deliveryChargeAmount)
      ),
      deliveryChargeLabel: safeStr(doc?.deliveryChargeLabel),
      freeDeliveryLabel: safeStr(doc?.freeDeliveryLabel),

      updatedBy: safeStr(doc?.updatedBy),
      createdAt: doc?.createdAt || null,
      updatedAt: doc?.updatedAt || null,
    },
  });
}