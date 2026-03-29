import { NextRequest } from "next/server";

export const runtime = "nodejs";

function safeStr(x: string | null, max = 140) {
  const s = String(x ?? "").trim();
  return s.length > max ? s.slice(0, max) : s;
}
function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function arrayBufferToBase64(buf: ArrayBuffer) {
  return Buffer.from(buf).toString("base64");
}

function fitFontSizeByLen(text: string, maxWidthPx: number, baseSize: number, minSize: number) {
  const t = text.trim();
  if (!t) return baseSize;
  const approxChar = 0.78;
  const need = t.length * baseSize * approxChar;
  if (need <= maxWidthPx) return baseSize;
  const ratio = maxWidthPx / need;
  const sized = Math.floor(baseSize * ratio);
  return Math.max(minSize, Math.min(baseSize, sized));
}

function wrapText(text: string, maxCharsPerLine: number, maxLines: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (test.length <= maxCharsPerLine) cur = test;
    else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);

  if (!lines.length) {
    const t = text.trim();
    lines.push(t.slice(0, maxCharsPerLine));
    if (maxLines > 1 && t.length > maxCharsPerLine) lines.push(t.slice(maxCharsPerLine, maxCharsPerLine * 2));
  }
  return lines;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const sessionRaw = safeStr(searchParams.get("session"), 18) || "2025-2026";
  const codeRaw = safeStr(searchParams.get("code"), 22) || "BCHCT 131";
  const titleRaw =
    safeStr(searchParams.get("title"), 120) ||
    "IGNOU BCHCT 131 Solved Assignment 2026 | English (Copy)";
  const courseRaw = safeStr(searchParams.get("course"), 18) || "BSCG";
  const mediumRaw = safeStr(searchParams.get("medium"), 14) || "English";

  const session = esc(sessionRaw);
  const subjectCode = esc(codeRaw.replace(/\s+/g, " ").trim());
  const subjectTitle = esc(titleRaw.replace(/\s+/g, " ").trim());
  const courseCode = esc(courseRaw.replace(/\s+/g, " ").trim());
  const medium = esc(mediumRaw.replace(/\s+/g, " ").trim());

  const site = "WWW.ISTUDENTSPORTAL.COM";

  const W = 768;
  const H = 1024;

  let logoDataUri = "";
  try {
    const logoUrl = new URL("/logo.png", req.url);
    const r = await fetch(logoUrl.toString(), { cache: "force-cache" });
    if (r.ok) {
      const buf = await r.arrayBuffer();
      const b64 = arrayBufferToBase64(buf);
      logoDataUri = `data:image/png;base64,${b64}`;
    }
  } catch {
    logoDataUri = "";
  }

  const LOGO_X = 28;
  const LOGO_Y = 18;
  const LOGO_SIZE = 92;

  const LEFT_MARGIN = 120;

  const IGNOU_FONT = 122;
  const SOLVED_BASE = 54;
  const SESSION_FONT = 92;
  const CODE_BASE = 127;
  const MED_BASE = 61;

  const IGNOU_Y = 180;
  const SESSION_Y = 360;
  const SOLVED_Y = 255;

  const SOLVED_MIN = 32;
  const solvedMaxW = W - LEFT_MARGIN - 24;
  const solvedFont = fitFontSizeByLen("SOLVED ASSIGNMENT", solvedMaxW, SOLVED_BASE, SOLVED_MIN);

  const BAND_TOP_Y = 430;
  const BAND_TOP_H = 24;
  const BAND_MID_Y = BAND_TOP_Y + BAND_TOP_H;
  const BAND_MID_H = 122;
  const BAND_BOT_Y = BAND_MID_Y + BAND_MID_H;
  const BAND_BOT_H = 24;
  const BAND_TOTAL_H = BAND_TOP_H + BAND_MID_H + BAND_BOT_H;

  const CODE_MIN = 60;
  const CODE_MAX_W = W - 40;
  const codeFont = fitFontSizeByLen(subjectCode, CODE_MAX_W, CODE_BASE, CODE_MIN);
  const CODE_CENTER_Y = BAND_MID_Y + BAND_MID_H / 2;

  const TITLE_LEFT_MARGIN = 140;
  const TITLE_TOP_Y = BAND_TOP_Y + BAND_TOTAL_H + 60;
  const VALID_Y = 820;
  const TITLE_BOX_H = VALID_Y - TITLE_TOP_Y - 18;
  const TITLE_MAX_LINES = 3;

  let titleLines = wrapText(subjectTitle, 28, TITLE_MAX_LINES);
  if (titleLines.length === 3 && titleLines[2].length > 26) {
    titleLines = wrapText(subjectTitle, 24, TITLE_MAX_LINES);
  }

  const TITLE_BASE = 40;
  const TITLE_MIN = 24;
  const TITLE_MAX_W = W - TITLE_LEFT_MARGIN - 70;
  const longest = titleLines.reduce((m, s) => Math.max(m, s.length), 0);
  const titleFontByWidth = fitFontSizeByLen("X".repeat(longest), TITLE_MAX_W, TITLE_BASE, TITLE_MIN);

  let titleFont = titleFontByWidth;
  let lineH = Math.floor(titleFont * 1.3);
  while (titleLines.length * lineH > TITLE_BOX_H && titleFont > TITLE_MIN) {
    titleFont -= 1;
    lineH = Math.floor(titleFont * 1.3);
  }

  const BLACK_Y = 934;
  const BLACK_H = H - BLACK_Y;

  const PILL_H = 80;
  const PILL_W = 540;
  const PILL_X = (W - PILL_W) / 2;
  const PILL_Y = BLACK_Y - PILL_H / 2;

  const MED_MIN = 34;
  const medFont = fitFontSizeByLen(medium, PILL_W - 60, MED_BASE, MED_MIN);

  const WEBSITE_Y = BLACK_Y + 75;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <style>
      .navy{ fill:#0b2a6b; }
      .orange{ fill:#f28c28; }
      .black{ fill:#000000; }
      .muted{ fill:#1a1a1a; }
      .white{ fill:#ffffff; }
      .red{ fill:#e00000; }
      .gold{ fill:#7a5a00; }
      .fontBlack{ font-family: "Arial Black", Arial, sans-serif; font-weight: 900; }
      .fontB{ font-family: Georgia, "Times New Roman", serif; font-weight: 700; }
    </style>
  </defs>

  <rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>

  ${
    logoDataUri
      ? `<image x="${LOGO_X}" y="${LOGO_Y}" width="${LOGO_SIZE}" height="${LOGO_SIZE}" href="${logoDataUri}" />`
      : `<g transform="translate(${LOGO_X},${LOGO_Y})">
          <rect width="${LOGO_SIZE}" height="${LOGO_SIZE}" fill="none" stroke="#0b2a6b" stroke-width="3"/>
          <text x="${Math.floor(LOGO_SIZE / 2)}" y="${Math.floor(LOGO_SIZE / 2)}" text-anchor="middle" class="navy fontBlack" font-size="18">LOGO</text>
        </g>`
  }

  <text x="${LEFT_MARGIN}" y="${IGNOU_Y}" class="navy fontBlack" font-size="${IGNOU_FONT}" letter-spacing="2">IGNOU</text>
  <text x="${LEFT_MARGIN}" y="${SOLVED_Y}" class="orange fontBlack" font-size="${solvedFont}">SOLVED ASSIGNMENT</text>
  <text x="${LEFT_MARGIN}" y="${SESSION_Y}" class="black fontBlack" font-size="${SESSION_FONT}">${session}</text>

  <rect x="0" y="${BAND_TOP_Y}" width="${W}" height="${BAND_TOP_H}" fill="#b8d49a"/>
  <rect x="0" y="${BAND_MID_Y}" width="${W}" height="${BAND_MID_H}" fill="#37ad9b"/>
  <rect x="0" y="${BAND_BOT_Y}" width="${W}" height="${BAND_BOT_H}" fill="#0aa3df"/>

  <text x="${W / 2}" y="${CODE_CENTER_Y}" text-anchor="middle" dominant-baseline="central" class="white fontBlack" font-size="${codeFont}" letter-spacing="3">${subjectCode}</text>

  ${titleLines
    .map((line, idx) => {
      const y = TITLE_TOP_Y + idx * lineH;
      return `<text x="${TITLE_LEFT_MARGIN}" y="${y}" class="muted fontB" font-size="${titleFont}">${esc(line)}</text>`;
    })
    .join("\n  ")}

  <text x="${TITLE_LEFT_MARGIN}" y="${VALID_Y}" class="red fontBlack" font-size="34">VALID FOR:-</text>
  <text x="${TITLE_LEFT_MARGIN}" y="${VALID_Y + 54}" class="gold fontBlack" font-size="32">${courseCode}</text>

  <rect x="0" y="${BLACK_Y}" width="${W}" height="${BLACK_H}" fill="#000000"/>

  <rect x="${PILL_X}" y="${PILL_Y}" rx="40" ry="40" width="${PILL_W}" height="${PILL_H}" fill="#f4f000" stroke="#000000" stroke-width="4"/>
  <text x="${W / 2}" y="${PILL_Y + PILL_H / 2}" text-anchor="middle" dominant-baseline="central" class="black fontBlack" font-size="${medFont}">${medium}</text>

  <text x="${W / 2}" y="${WEBSITE_Y}" text-anchor="middle" dominant-baseline="central" class="white fontBlack" font-size="26" letter-spacing="1.2">${site}</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400",
    },
  });
}