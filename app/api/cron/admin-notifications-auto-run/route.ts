import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeStr(x: any) {
  return String(x ?? "").trim();
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

  try {
    const res = await fetch(`${baseUrl}/api/admin/notifications/tasks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        taskKey: "auto-run",
        actionKey: "run",
      }),
      cache: "no-store",
    });

    const text = await res.text();

    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            safeStr(data?.error) ||
            safeStr(text) ||
            "Notifications auto-run failed",
          upstreamStatus: res.status,
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
        result: data,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          safeStr(error?.message) || "Notifications auto-run request failed",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return runAutoNotifications(req);
}

export async function POST(req: NextRequest) {
  return runAutoNotifications(req);
}