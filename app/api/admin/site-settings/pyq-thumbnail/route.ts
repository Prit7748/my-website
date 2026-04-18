import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { getAuthUser, hasPermission } from "@/lib/auth";
import PyqThumbnailConfig, {
  PYQ_THUMBNAIL_CONFIG_KEY,
} from "@/models/PyqThumbnailConfig";

function safeStr(x: any) {
  return String(x ?? "").trim();
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
  isEnabled: true,
  templateImageUrl: "/images/thumbs/pyq-master-template.png",
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

  let doc: any = await PyqThumbnailConfig.findOne({
    key: PYQ_THUMBNAIL_CONFIG_KEY,
  }).lean();

  if (!doc) {
    doc = {
      key: PYQ_THUMBNAIL_CONFIG_KEY,
      ...DEFAULTS,
      updatedBy: "",
      createdAt: null,
      updatedAt: null,
    };
  }

  return NextResponse.json({
    ok: true,
    item: {
      key: PYQ_THUMBNAIL_CONFIG_KEY,
      isEnabled: safeBool(doc?.isEnabled, DEFAULTS.isEnabled),
      templateImageUrl: safeStr(doc?.templateImageUrl || DEFAULTS.templateImageUrl),
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
    key: PYQ_THUMBNAIL_CONFIG_KEY,
    isEnabled: safeBool(body?.isEnabled, DEFAULTS.isEnabled),
    templateImageUrl: safeStr(body?.templateImageUrl || DEFAULTS.templateImageUrl),
    updatedBy: getUserId(user),
  };

  if (!payload.templateImageUrl) {
    return NextResponse.json(
      { error: "Template Image URL required" },
      { status: 400 }
    );
  }

  await dbConnect();

  const doc: any = await PyqThumbnailConfig.findOneAndUpdate(
    { key: PYQ_THUMBNAIL_CONFIG_KEY },
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return NextResponse.json({
    ok: true,
    message: "PYQ thumbnail settings saved successfully.",
    item: {
      key: PYQ_THUMBNAIL_CONFIG_KEY,
      isEnabled: safeBool(doc?.isEnabled, DEFAULTS.isEnabled),
      templateImageUrl: safeStr(doc?.templateImageUrl),
      updatedBy: safeStr(doc?.updatedBy),
      createdAt: doc?.createdAt || null,
      updatedAt: doc?.updatedAt || null,
    },
  });
}