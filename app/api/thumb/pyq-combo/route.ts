import { NextRequest } from "next/server";

export const runtime = "edge";

function safeStr(x: string | null | undefined, max = 300) {
  const s = String(x ?? "").trim();
  return s.length > max ? s.slice(0, max) : s;
}

function esc(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function arrayBufferToBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;

  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }

  return btoa(binary);
}

async function toDataUri(req: NextRequest, rawPathOrUrl: string) {
  const input = safeStr(rawPathOrUrl, 2000);
  if (!input) return "";

  try {
    const url =
      input.startsWith("http://") || input.startsWith("https://")
        ? new URL(input)
        : new URL(input.startsWith("/") ? input : `/${input}`, req.url);

    const r = await fetch(url.toString(), { cache: "force-cache" });
    if (!r.ok) return "";

    const type = r.headers.get("content-type") || "image/png";
    const buf = await r.arrayBuffer();
    const b64 = arrayBufferToBase64(buf);

    return `data:${type};base64,${b64}`;
  } catch {
    return "";
  }
}

function normalizeYears(x: string) {
  return x === "5" ? 5 : 3;
}

function formatSubjectCode(input: string) {
  const raw = safeStr(input, 80).toUpperCase().replace(/\s+/g, "");
  if (!raw) return "BCOS 186";

  const match = raw.match(/^([A-Z]+)(\d+[A-Z0-9]*)$/);
  if (!match) return raw;

  const prefix = safeStr(match[1]);
  const suffix = safeStr(match[2]);
  return `${prefix} ${suffix}`.trim();
}

function normalizeMedium(input: string) {
  const raw = safeStr(input, 80).replace(/\s+/g, " ").trim();
  if (!raw) return "English Medium";

  const clean = raw.toUpperCase().replace(/[^A-Z]/g, "");

  if (clean === "HIN" || clean === "HINDI") return "Hindi Medium";
  if (clean === "ENG" || clean === "ENGLISH") return "English Medium";
  if (clean === "URD" || clean === "URDU") return "Urdu Medium";
  if (clean === "PUN" || clean === "PUNJABI") return "Punjabi Medium";
  if (clean === "MAL" || clean === "MALAYALAM") return "Malayalam Medium";
  if (clean === "TEL" || clean === "TELUGU") return "Telugu Medium";
  if (clean === "TAM" || clean === "TAMIL") return "Tamil Medium";
  if (clean === "ARA" || clean === "ARABIC") return "Arabic Medium";
  if (clean === "FRE" || clean === "FRENCH") return "French Medium";
  if (clean === "JAP" || clean === "JAPANESE") return "Japanese Medium";
  if (clean === "GER" || clean === "GERMAN") return "German Medium";
  if (clean === "KOR" || clean === "KOREAN") return "Korean Medium";
  if (clean === "MAN" || clean === "MANDARIN") return "Mandarin Medium";
  if (clean === "PER" || clean === "PERSIAN") return "Persian Medium";
  if (clean === "RUS" || clean === "RUSSIAN") return "Russian Medium";
  if (clean === "SPA" || clean === "SPANISH") return "Spanish Medium";
  if (clean === "BEN" || clean === "BENGALI") return "Bengali Medium";
  if (clean === "SAN" || clean === "SANSKRIT") return "Sanskrit Medium";
  if (clean === "BAN" || clean === "BANGLA") return "Bangla Medium";
  if (clean === "ORI" || clean === "ORIYA") return "Oriya Medium";
  if (clean === "NEP" || clean === "NEPALI") return "Nepali Medium";
  if (clean === "MAR" || clean === "MARATHI") return "Marathi Medium";
  if (clean === "KAN" || clean === "KANNADA") return "Kannada Medium";
  if (clean === "KAS" || clean === "KASHMIRI") return "Kashmiri Medium";
  if (clean === "GUJ" || clean === "GUJARATI") return "Gujarati Medium";
  if (clean === "ASS" || clean === "ASSAMESE") return "Assamese Medium";

  const lowered = raw.toLowerCase();

  if (lowered === "english medium") return "English Medium";
  if (lowered === "hindi medium") return "Hindi Medium";
  if (lowered === "urdu medium") return "Urdu Medium";
  if (lowered === "punjabi medium") return "Punjabi Medium";
  if (lowered === "malayalam medium") return "Malayalam Medium";
  if (lowered === "telugu medium") return "Telugu Medium";
  if (lowered === "tamil medium") return "Tamil Medium";
  if (lowered === "arabic medium") return "Arabic Medium";
  if (lowered === "french medium") return "French Medium";
  if (lowered === "japanese medium") return "Japanese Medium";
  if (lowered === "german medium") return "German Medium";
  if (lowered === "korean medium") return "Korean Medium";
  if (lowered === "mandarin medium") return "Mandarin Medium";
  if (lowered === "persian medium") return "Persian Medium";
  if (lowered === "russian medium") return "Russian Medium";
  if (lowered === "spanish medium") return "Spanish Medium";
  if (lowered === "bengali medium") return "Bengali Medium";
  if (lowered === "sanskrit medium") return "Sanskrit Medium";
  if (lowered === "bangla medium") return "Bangla Medium";
  if (lowered === "oriya medium") return "Oriya Medium";
  if (lowered === "nepali medium") return "Nepali Medium";
  if (lowered === "marathi medium") return "Marathi Medium";
  if (lowered === "kannada medium") return "Kannada Medium";
  if (lowered === "kashmiri medium") return "Kashmiri Medium";
  if (lowered === "gujarati medium") return "Gujarati Medium";
  if (lowered === "assamese medium") return "Assamese Medium";

  return raw;
}

function fitFontSizeByLen(
  text: string,
  maxWidthPx: number,
  baseSize: number,
  minSize: number,
  approxChar = 0.68
) {
  const t = text.trim();
  if (!t) return baseSize;

  const need = t.length * baseSize * approxChar;
  if (need <= maxWidthPx) return baseSize;

  const ratio = maxWidthPx / need;
  const sized = Math.floor(baseSize * ratio);

  return Math.max(minSize, Math.min(baseSize, sized));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const years = normalizeYears(safeStr(searchParams.get("years"), 2));

  const subjectCodeRaw = safeStr(searchParams.get("code"), 80) || "BCOS186";
  const mediumRaw = safeStr(searchParams.get("medium"), 80) || "ENG";

  const subjectCode = esc(formatSubjectCode(subjectCodeRaw));
  const medium = esc(normalizeMedium(mediumRaw));

  const bgPath =
    years === 5
      ? "/images/thumbs/pyq-combo-bg5.png"
      : "/images/thumbs/pyq-combo-bg3.png";

  const bgDataUri = await toDataUri(req, bgPath);

  const W = 900;
  const H = 1300;

  const SUBJECT_CENTER_X = 450;
  const SUBJECT_CENTER_Y = 548;

  const MEDIUM_CENTER_X = 450;
  const MEDIUM_CENTER_Y = 650;

  const subjectFont = fitFontSizeByLen(subjectCode, 700, 128, 78, 0.67);
  const mediumFont = fitFontSizeByLen(medium, 520, 54, 30, 0.66);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="subjectShadow" x="-20%" y="-20%" width="160%" height="160%">
      <feDropShadow dx="0" dy="16" stdDeviation="13" flood-color="#000000" flood-opacity="0.23"/>
    </filter>

    <filter id="mediumShadow" x="-20%" y="-20%" width="160%" height="160%">
      <feDropShadow dx="0" dy="10" stdDeviation="9" flood-color="#5b6e38" flood-opacity="0.22"/>
    </filter>

    <style>
      .subjectFont {
        font-family: "Arial Black", Arial, Helvetica, sans-serif;
        font-weight: 900;
        letter-spacing: 1.5px;
      }
      .mediumFont {
        font-family: Arial, Helvetica, sans-serif;
        font-weight: 800;
        letter-spacing: 0.2px;
      }
    </style>
  </defs>

  ${
    bgDataUri
      ? `<image href="${bgDataUri}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`
      : `<rect x="0" y="0" width="${W}" height="${H}" fill="#f3f3f3"/>`
  }

  <text
    x="${SUBJECT_CENTER_X}"
    y="${SUBJECT_CENTER_Y}"
    text-anchor="middle"
    dominant-baseline="middle"
    class="subjectFont"
    font-size="${subjectFont}"
    fill="#ffffff"
    filter="url(#subjectShadow)"
  >
    ${subjectCode}
  </text>

  <text
    x="${MEDIUM_CENTER_X}"
    y="${MEDIUM_CENTER_Y}"
    text-anchor="middle"
    dominant-baseline="middle"
    class="mediumFont"
    font-size="${mediumFont}"
    fill="#2f73c6"
    filter="url(#mediumShadow)"
  >
    ${medium}
  </text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control":
        "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400",
    },
  });
}