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
    const approxChar = 0.76;
    const need = t.length * baseSize * approxChar;
    if (need <= maxWidthPx) return baseSize;
    const ratio = maxWidthPx / need;
    const sized = Math.floor(baseSize * ratio);
    return Math.max(minSize, Math.min(baseSize, sized));
}

function normalizeSession(x: string) {
    return x.replace(/\s+/g, " ").trim();
}

function normalizeMedium(x: string) {
    const s = x.replace(/\s+/g, " ").trim();
    if (!s) return "English Medium";
    if (s.toLowerCase() === "hindi") return "Hindi Medium";
    if (s.toLowerCase() === "english") return "English Medium";
    return s;
}

async function toDataUriFromPublic(req: NextRequest, path: string) {
    try {
        const url = new URL(path, req.url);
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

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);

    const codeRaw = safeStr(searchParams.get("code"), 30) || "BSKE 150";
    const sessionRaw = safeStr(searchParams.get("session"), 24) || "2025-26";
    const mediumRaw = safeStr(searchParams.get("medium"), 24) || "Hindi Medium";

    const subjectCode = esc(codeRaw.replace(/\s+/g, " ").trim().toUpperCase());
    const session = esc(normalizeSession(sessionRaw));
    const medium = esc(normalizeMedium(mediumRaw));
    const site = "www.istudentsportal.com";

    const W = 768;
    const H = 1024;

    const codeFont = fitFontSizeByLen(subjectCode, 610, 102, 52);
    const mediumFont = fitFontSizeByLen(medium, 470, 44, 26);

    const [stampDataUri, pensDataUri] = await Promise.all([
        toDataUriFromPublic(req, "/images/thumbs/hardcopy-stamp.png"),
        toDataUriFromPublic(req, "/images/thumbs/hardcopy-writing-pens.png"),
    ]);

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="goldBand" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#dbc68d"/>
      <stop offset="50%" stop-color="#d5b578"/>
      <stop offset="100%" stop-color="#cfb06f"/>
    </linearGradient>

    <filter id="textShadow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#000000" flood-opacity="0.20"/>
    </filter>

    <filter id="softShadow" x="-20%" y="-20%" width="160%" height="160%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.22"/>
    </filter>

    <filter id="pillShadow" x="-20%" y="-20%" width="160%" height="180%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.28"/>
    </filter>

    <pattern id="ruled" width="768" height="32" patternUnits="userSpaceOnUse">
      <rect width="768" height="32" fill="#f7f7f4"/>
      <line x1="0" y1="31" x2="768" y2="31" stroke="#bcc5d3" stroke-width="2"/>
    </pattern>

    <pattern id="bandLines" width="768" height="28" patternUnits="userSpaceOnUse">
      <rect width="768" height="28" fill="transparent"/>
      <line x1="0" y1="27" x2="768" y2="27" stroke="#b69457" stroke-width="1.3" opacity="0.55"/>
    </pattern>

    <style>
      .fontBlack { font-family: "Arial Black", Arial, sans-serif; font-weight: 900; }
      .fontBold { font-family: Arial, Helvetica, sans-serif; font-weight: 700; }
      .fontItalic { font-family: "Trebuchet MS", Arial, sans-serif; font-style: italic; font-weight: 700; }
      .navy { fill: #0b2a6b; }
      .gold { fill: #b88900; }
      .red { fill: #e11414; }
      .white { fill: #ffffff; }
      .blue2 { fill: #2d73ba; }
      .black { fill: #000000; }
    </style>
  </defs>

  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#ruled)"/>

  <text x="${W / 2}" y="74" text-anchor="middle" class="gold fontBlack" font-size="52" letter-spacing="1.5">
    HANDWRITTEN
  </text>
  <text x="${W / 2}" y="138" text-anchor="middle" class="gold fontBlack" font-size="52" letter-spacing="1.5">
    ASSIGNMENT
  </text>

  <text x="${W / 2}" y="230" text-anchor="middle" class="navy fontBlack" font-size="96" letter-spacing="1.8">
    HARDCOPY
  </text>

  <text x="${W / 2}" y="284" text-anchor="middle" class="red fontItalic" font-size="28">
    #1 Customized &amp; Ready to Deliver
  </text>

  <rect x="0" y="350" width="${W}" height="210" fill="url(#goldBand)"/>
  <rect x="0" y="350" width="${W}" height="210" fill="url(#bandLines)"/>
  <rect x="0" y="350" width="${W}" height="7" fill="#f4df9a" opacity="0.9"/>
  <rect x="0" y="553" width="${W}" height="7" fill="#c29d5b" opacity="0.9"/>

  <text x="${W / 2}" y="455" text-anchor="middle" class="white fontBlack" font-size="${codeFont}" filter="url(#textShadow)">
    ${subjectCode}
  </text>

  <text x="${W / 2}" y="530" text-anchor="middle" class="blue2 fontBlack" font-size="58" filter="url(#textShadow)">
    ${session}
  </text>

  <text x="${W / 2}" y="604" text-anchor="middle" class="black fontBold" font-size="23">
    • Fully Prepared • Neatly Handwritten • Quickly Delivered!
  </text>

  ${stampDataUri
            ? `
  <image
    href="${stampDataUri}"
    x="32"
    y="634"
    width="240"
    height="240"
    preserveAspectRatio="xMidYMid meet"
    opacity="0.98"
    transform="rotate(-12 152 754)"
    filter="url(#softShadow)"
  />`
            : ""
        }

 ${pensDataUri
            ? `
  <image
    href="${pensDataUri}"
    x="372"
    y="594"
    width="460"
    height="344"
    preserveAspectRatio="xMidYMid meet"
    opacity="1"
    filter="url(#softShadow)"
  />`
            : ""
        }

  <rect x="0" y="938" width="${W}" height="86" fill="#000000"/>

  <rect x="95" y="906" rx="38" ry="38" width="578" height="64" fill="#f3f000" stroke="#000000" stroke-width="3" filter="url(#pillShadow)"/>
  <text x="${W / 2}" y="938" text-anchor="middle" dominant-baseline="middle" class="black fontBlack" font-size="${mediumFont}">
    ${medium}
  </text>

  <text x="${W / 2}" y="992" text-anchor="middle" dominant-baseline="middle" class="white fontBold" font-size="24">
    ${site}
  </text>
</svg>`;

    return new Response(svg, {
        headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400",
        },
    });
}