import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function isCronAuthorized(req: NextRequest) {
  const secret = safeStr(process.env.CRON_SECRET);
  if (!secret) return false;

  const auth = safeStr(req.headers.get("authorization"));
  return auth === `Bearer ${secret}`;
}

function getBaseUrl(req: NextRequest) {
  const configured =
    safeStr(process.env.APP_BASE_URL) ||
    safeStr(process.env.NEXT_PUBLIC_APP_URL) ||
    safeStr(process.env.NEXTAUTH_URL);

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  return safeStr(req.nextUrl.origin).replace(/\/+$/, "");
}

async function safeReadJson(res: Response) {
  const text = await res.text();
  if (!text) {
    return {
      text: "",
      json: null,
    };
  }

  try {
    return {
      text,
      json: JSON.parse(text),
    };
  } catch {
    return {
      text,
      json: null,
    };
  }
}

async function runAutoNotifications(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const baseUrl = getBaseUrl(req);
  if (!baseUrl) {
    return NextResponse.json(
      { ok: false, error: "Base URL not available" },
      { status: 500 }
    );
  }

  const cronSecret = safeStr(process.env.CRON_SECRET);
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET missing" },
      { status: 500 }
    );
  }

  const timeoutMs = Math.max(30_000, safeNum(process.env.NOTIFICATIONS_AUTO_RUN_TIMEOUT_MS, 290_000));
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort("Cron upstream timeout");
  }, timeoutMs);

  try {
    const res = await fetch(`${baseUrl}/api/admin/notifications/tasks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify({
        taskKey: "auto-run",
        actionKey: "run",
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const { text, json } = await safeReadJson(res);
    const data: any = json;

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            safeStr(data?.error) ||
            safeStr(text) ||
            "Notifications auto-run failed",
          upstreamStatus: res.status,
          baseUrl,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message:
          safeStr(data?.message) || "Notifications auto-run executed.",
        upstreamStatus: res.status,
        baseUrl,
        result: data,
      },
      { status: 200 }
    );
  } catch (error: any) {
    const reason = safeStr(error?.message || error || "Notifications auto-run request failed");
    const isAbort =
      safeStr(error?.name).toLowerCase() === "aborterror" ||
      reason.toLowerCase().includes("timeout") ||
      reason.toLowerCase().includes("abort");

    return NextResponse.json(
      {
        ok: false,
        error: isAbort
          ? `Notifications auto-run timed out after ${timeoutMs}ms`
          : reason || "Notifications auto-run request failed",
        baseUrl,
      },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: NextRequest) {
  return runAutoNotifications(req);
}

export async function POST(req: NextRequest) {
  return runAutoNotifications(req);
}