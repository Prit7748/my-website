import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, hasPermission } from "@/lib/auth";
import {
  getYoutubeTemplateConfig,
  saveYoutubeTemplateConfig,
  sanitizeYoutubeTemplatePayload,
} from "@/lib/youtubeContent";
import { YOUTUBE_TOKEN_LABELS } from "@/lib/youtubeTokens";
import {
  DEFAULT_YOUTUBE_TEMPLATE_CONFIG,
  YOUTUBE_TEMPLATE_CONFIG_KEY,
} from "@/models/YoutubeTemplateConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function getUserId(user: any) {
  return safeStr(user?._id || user?.id || user?.userId || user?.email || "");
}

function canReadYoutube(user: any) {
  return Boolean(
    user &&
      (hasPermission(user, "products:read") || hasPermission(user, "products:write"))
  );
}

function canWriteYoutube(user: any) {
  return Boolean(user && hasPermission(user, "products:write"));
}

export async function GET() {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!canReadYoutube(user)) {
    return NextResponse.json(
      { error: "Forbidden (products permission missing)" },
      { status: 403 }
    );
  }

  try {
    const config = await getYoutubeTemplateConfig();

    return NextResponse.json(
      {
        ok: true,
        key: YOUTUBE_TEMPLATE_CONFIG_KEY,
        item: config,
        defaults: DEFAULT_YOUTUBE_TEMPLATE_CONFIG,
        tokens: YOUTUBE_TOKEN_LABELS,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        error: e?.message || "Failed to load YouTube template settings",
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!canWriteYoutube(user)) {
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

  try {
    const sanitized = sanitizeYoutubeTemplatePayload(body);
    const saved = await saveYoutubeTemplateConfig(sanitized, getUserId(user));

    return NextResponse.json(
      {
        ok: true,
        message: "YouTube template settings saved successfully.",
        key: YOUTUBE_TEMPLATE_CONFIG_KEY,
        item: saved,
        defaults: DEFAULT_YOUTUBE_TEMPLATE_CONFIG,
        tokens: YOUTUBE_TOKEN_LABELS,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        error: e?.message || "Failed to save YouTube template settings",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!canWriteYoutube(user)) {
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

  try {
    const mode = safeStr(body?.mode).toLowerCase();

    if (mode === "reset") {
      const saved = await saveYoutubeTemplateConfig(
        DEFAULT_YOUTUBE_TEMPLATE_CONFIG,
        getUserId(user)
      );

      return NextResponse.json(
        {
          ok: true,
          message: "YouTube template settings reset to default successfully.",
          key: YOUTUBE_TEMPLATE_CONFIG_KEY,
          item: saved,
          defaults: DEFAULT_YOUTUBE_TEMPLATE_CONFIG,
          tokens: YOUTUBE_TOKEN_LABELS,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: "Unsupported PATCH mode" },
      { status: 400 }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        error: e?.message || "Failed to update YouTube template settings",
      },
      { status: 500 }
    );
  }
}