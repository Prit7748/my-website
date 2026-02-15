import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ChatBotConfig from "@/models/ChatBotConfig";
import { requireAdmin } from "@/lib/adminAuth";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeBoolDefault(x: any, def: boolean) {
  if (x === undefined || x === null || x === "") return def;
  return x === true || x === "true" || x === 1 || x === "1";
}

// ✅ PUBLIC GET (front-end can read)
export async function GET() {
  await dbConnect();

  const doc = await ChatBotConfig.findOne({ key: "main" }).lean();
  const cfg: any = doc || { key: "main", isEnabled: false, provider: "whatsapp" };

  return NextResponse.json(
    {
      key: "main",
      isEnabled: !!cfg.isEnabled,
      provider: cfg.provider || "whatsapp",
      showOnMobile: cfg.showOnMobile !== false, // default true
      showOnDesktop: cfg.showOnDesktop !== false, // default true
      position: cfg.position === "left" ? "left" : "right",
      whatsappNumber: cfg.whatsappNumber || "",
      whatsappMessage: cfg.whatsappMessage || "Hi! I need help regarding IGNOU materials.",
      tawkPropertyId: cfg.tawkPropertyId || "",
      tawkWidgetId: cfg.tawkWidgetId || "",
      crispWebsiteId: cfg.crispWebsiteId || "",
      customScript: cfg.customScript || "",
      themeColor: cfg.themeColor || "#3B82F6",
      lastModifiedAt: cfg.lastModifiedAt || cfg.updatedAt || null,
    },
    { status: 200 }
  );
}

// ✅ ADMIN PUT (save settings)
export async function PUT(req: NextRequest) {
  // ✅ FIX: requireAdmin() expects 0 args
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();

  const body = await req.json().catch(() => ({}));

  const providerRaw = safeStr(body.provider);
  const provider = ["whatsapp", "tawk", "crisp", "custom"].includes(providerRaw)
    ? providerRaw
    : "whatsapp";

  const payload = {
    isEnabled: safeBoolDefault(body.isEnabled, false),

    provider,

    // ✅ defaults TRUE if not sent
    showOnMobile: safeBoolDefault(body.showOnMobile, true),
    showOnDesktop: safeBoolDefault(body.showOnDesktop, true),

    position: safeStr(body.position) === "left" ? "left" : "right",

    whatsappNumber: safeStr(body.whatsappNumber),
    whatsappMessage:
      safeStr(body.whatsappMessage) || "Hi! I need help regarding IGNOU materials.",

    tawkPropertyId: safeStr(body.tawkPropertyId),
    tawkWidgetId: safeStr(body.tawkWidgetId),

    crispWebsiteId: safeStr(body.crispWebsiteId),

    customScript: String(body.customScript || ""),

    themeColor: safeStr(body.themeColor) || "#3B82F6",

    lastModifiedAt: new Date(),
  };

  const doc = await ChatBotConfig.findOneAndUpdate(
    { key: "main" },
    { $set: payload, $setOnInsert: { key: "main" } },
    { upsert: true, new: true }
  ).lean();

  return NextResponse.json({ ok: true, config: doc }, { status: 200 });
}
