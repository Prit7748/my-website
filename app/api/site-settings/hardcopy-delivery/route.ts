import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
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

const DEFAULT_SETTINGS = {
  deliveryChargeEnabled: true,
  deliveryChargeThresholdAmount: 1000,
  deliveryChargeAmount: 100,
  deliveryChargeLabel: "Delivery Charge",
  freeDeliveryLabel: "Free Delivery",
};

export async function GET() {
  try {
    await dbConnect();

    const doc: any = await HardcopyTemplateConfig.findOne({
      key: HARDCOPY_TEMPLATE_CONFIG_KEY,
    })
      .select(
        "deliveryChargeEnabled deliveryChargeThresholdAmount deliveryChargeAmount deliveryChargeLabel freeDeliveryLabel updatedAt"
      )
      .lean()
      .catch(() => null);

    return NextResponse.json(
      {
        ok: true,
        settings: {
          deliveryChargeEnabled:
            typeof doc?.deliveryChargeEnabled === "boolean"
              ? doc.deliveryChargeEnabled
              : DEFAULT_SETTINGS.deliveryChargeEnabled,

          deliveryChargeThresholdAmount: Math.max(
            0,
            safeNum(
              doc?.deliveryChargeThresholdAmount,
              DEFAULT_SETTINGS.deliveryChargeThresholdAmount
            )
          ),

          deliveryChargeAmount: Math.max(
            0,
            safeNum(doc?.deliveryChargeAmount, DEFAULT_SETTINGS.deliveryChargeAmount)
          ),

          deliveryChargeLabel:
            safeStr(doc?.deliveryChargeLabel) || DEFAULT_SETTINGS.deliveryChargeLabel,

          freeDeliveryLabel:
            safeStr(doc?.freeDeliveryLabel) || DEFAULT_SETTINGS.freeDeliveryLabel,
        },
        defaults: DEFAULT_SETTINGS,
        updatedAt: doc?.updatedAt || null,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: safeStr(err?.message) || "Failed to load hardcopy delivery settings",
        settings: DEFAULT_SETTINGS,
        defaults: DEFAULT_SETTINGS,
      },
      { status: 500 }
    );
  }
}