import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAuthUser, hasPermission } from "@/lib/auth";
import { grantPdfVaultPageAccess, safeStr } from "@/lib/pdfVault";

export const runtime = "nodejs";

const PUZZLE_COOKIE = "pdf_vault_puzzle_token";
const PUZZLE_MAX_AGE_SEC = 10 * 60; // 10 min
const ACCESS_GRANT_MINUTES = 20;

type PuzzlePayload = {
  a: number;
  b: number;
  expectedAnswer: number;
  nonce: string;
  ts: number;
};

function signPayload(payload: PuzzlePayload) {
  const secret = process.env.JWT_SECRET || "pdf-vault-secret";
  const raw = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  return Buffer.from(JSON.stringify({ payload, sig })).toString("base64url");
}

function verifyPayload(token: string): PuzzlePayload | null {
  try {
    const secret = process.env.JWT_SECRET || "pdf-vault-secret";
    const decoded = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
    const payload = decoded?.payload as PuzzlePayload;
    const sig = String(decoded?.sig || "");

    if (!payload || !sig) return null;

    const raw = JSON.stringify(payload);
    const expectedSig = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    if (sig !== expectedSig) return null;

    const ageMs = Date.now() - Number(payload.ts || 0);
    if (ageMs < 0 || ageMs > PUZZLE_MAX_AGE_SEC * 1000) return null;

    return payload;
  } catch {
    return null;
  }
}

function randomInt(min: number, max: number) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const a = randomInt(2, 9);
  const b = randomInt(2, 9);

  // Secret twisted rule backend me hidden rahega.
  // User ko UI par sirf do numbers dikhेंगे.
  // Sahi answer = actual sum + 1
  const expectedAnswer = a + b + 1;

  const payload: PuzzlePayload = {
    a,
    b,
    expectedAnswer,
    nonce: crypto.randomBytes(12).toString("hex"),
    ts: Date.now(),
  };

  const token = signPayload(payload);

  const res = NextResponse.json(
    {
      ok: true,
      puzzle: {
        a,
        b,
      },
    },
    { status: 200 }
  );

  res.cookies.set(PUZZLE_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PUZZLE_MAX_AGE_SEC,
  });

  return res;
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!hasPermission(user, "products:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = req.cookies.get(PUZZLE_COOKIE)?.value || "";
  const payload = verifyPayload(token);

  if (!payload) {
    return NextResponse.json({ error: "Puzzle expired or invalid" }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const submitted = Number(safeStr(body?.answer));
  if (!Number.isFinite(submitted)) {
    return NextResponse.json({ error: "Valid numeric answer required" }, { status: 400 });
  }

  if (submitted !== payload.expectedAnswer) {
    return NextResponse.json({ error: "Wrong puzzle answer" }, { status: 403 });
  }

  await grantPdfVaultPageAccess(user.id, ACCESS_GRANT_MINUTES);

  const res = NextResponse.json(
    {
      ok: true,
      message: "Vault unlocked",
      accessGrantedMinutes: ACCESS_GRANT_MINUTES,
    },
    { status: 200 }
  );

  res.cookies.set(PUZZLE_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return res;
}