import { NextRequest } from "next/server";
import path from "path";
import { promises as fs } from "fs";

import { getYoutubeTemplateConfig } from "@/lib/youtubeContent";
import { replaceYoutubeTokens } from "@/lib/youtubeTokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ThumbField = {
  key: string;
  label: string;
  enabled: boolean;
  token: string;
  fallbackText: string;
  x: number;
  y: number;
  width: number;
  maxLines: number;
  fontSize: number;
  minFontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontFamily: string;
  fontWeight: number;
  color: string;
  align: "left" | "center" | "right";
  uppercase: boolean;
};

function safeStr(x: unknown, max = 3000) {
  const s = String(x ?? "").trim();
  return s.length > max ? s.slice(0, max) : s;
}

function safeNum(x: unknown, def: number) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function safeBool(x: unknown, def = false) {
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

function esc(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bufferToBase64(buf: Buffer) {
  return buf.toString("base64");
}

function arrayBufferToBase64(buf: ArrayBuffer) {
  return Buffer.from(buf).toString("base64");
}

function contentTypeFromPath(input: string) {
  const ext = path.extname(input || "").toLowerCase();

  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".avif") return "image/avif";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";

  return "image/png";
}

async function localPublicFileToDataUri(publicPath: string) {
  const raw = safeStr(publicPath);
  if (!raw || !raw.startsWith("/")) return "";

  try {
    const publicDir = path.join(process.cwd(), "public");
    const relativePath = raw.replace(/^\/+/, "").replace(/\\/g, "/");
    const absPath = path.resolve(publicDir, relativePath);

    if (!absPath.startsWith(publicDir)) return "";

    const file = await fs.readFile(absPath);
    const type = contentTypeFromPath(absPath);

    return `data:${type};base64,${bufferToBase64(file)}`;
  } catch {
    return "";
  }
}

async function remoteUrlToDataUri(url: string) {
  const raw = safeStr(url);
  if (!raw) return "";

  try {
    const r = await fetch(raw, { cache: "no-store" });
    if (!r.ok) return "";

    const type = r.headers.get("content-type") || contentTypeFromPath(raw);
    const buf = await r.arrayBuffer();

    return `data:${type};base64,${arrayBufferToBase64(buf)}`;
  } catch {
    return "";
  }
}

async function toDataUri(req: NextRequest, rawPathOrUrl: string) {
  const input = safeStr(rawPathOrUrl);
  if (!input) return "";

  if (input.startsWith("/")) {
    const local = await localPublicFileToDataUri(input);
    if (local) return local;

    try {
      const sameOriginUrl = new URL(input, req.url).toString();
      return await remoteUrlToDataUri(sameOriginUrl);
    } catch {
      return "";
    }
  }

  if (input.startsWith("http://") || input.startsWith("https://")) {
    return await remoteUrlToDataUri(input);
  }

  try {
    const sameOriginUrl = new URL(`/${input.replace(/^\/+/, "")}`, req.url).toString();
    return await remoteUrlToDataUri(sameOriginUrl);
  } catch {
    return "";
  }
}

function normalizeSpaces(input: unknown) {
  return safeStr(input, 5000).replace(/\s+/g, " ").trim();
}

function fitFontSizeByLen(
  text: string,
  maxWidthPx: number,
  baseSize: number,
  minSize: number,
  approxChar = 0.58
) {
  const t = normalizeSpaces(text);
  if (!t) return baseSize;

  const need = t.length * baseSize * approxChar;
  if (need <= maxWidthPx) return baseSize;

  const ratio = maxWidthPx / need;
  const sized = Math.floor(baseSize * ratio);

  return Math.max(minSize, Math.min(baseSize, sized));
}

function wrapText(text: string, fontSize: number, width: number, maxLines: number) {
  const clean = normalizeSpaces(text);
  if (!clean) return [""];

  const approxChar = 0.58;
  const maxCharsPerLine = Math.max(4, Math.floor(width / Math.max(1, fontSize * approxChar)));

  const words = clean.split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;

    if (test.length <= maxCharsPerLine) {
      current = test;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    current = word;

    if (lines.length >= maxLines - 1) {
      break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (!lines.length) {
    lines.push(clean.slice(0, maxCharsPerLine));
  }

  if (lines.length === maxLines) {
    const usedWords = lines.join(" ").split(" ").length;
    const remainingWords = words.slice(usedWords);

    if (remainingWords.length > 0) {
      const last = `${lines[maxLines - 1]} ${remainingWords.join(" ")}`.trim();
      lines[maxLines - 1] =
        last.length > maxCharsPerLine
          ? `${last.slice(0, Math.max(1, maxCharsPerLine - 1)).trim()}…`
          : last;
    }
  }

  return lines.slice(0, maxLines);
}

function normalizeAlign(input: unknown): "left" | "center" | "right" {
  const raw = safeStr(input).toLowerCase();
  if (raw === "left" || raw === "center" || raw === "right") return raw;
  return "center";
}

function normalizeField(input: any): ThumbField {
  return {
    key: safeStr(input?.key, 80) || "field",
    label: safeStr(input?.label, 120) || "Field",
    enabled: safeBool(input?.enabled, true),
    token: safeStr(input?.token, 120),
    fallbackText: safeStr(input?.fallbackText, 500),
    x: Math.max(0, Math.min(1280, safeNum(input?.x, 640))),
    y: Math.max(0, Math.min(720, safeNum(input?.y, 360))),
    width: Math.max(50, Math.min(1280, safeNum(input?.width, 900))),
    maxLines: Math.max(1, Math.min(5, Math.trunc(safeNum(input?.maxLines, 1)))),
    fontSize: Math.max(10, Math.min(180, Math.trunc(safeNum(input?.fontSize, 54)))),
    minFontSize: Math.max(8, Math.min(120, Math.trunc(safeNum(input?.minFontSize, 24)))),
    lineHeight: Math.max(0.8, Math.min(2, safeNum(input?.lineHeight, 1.18))),
    letterSpacing: Math.max(-5, Math.min(20, safeNum(input?.letterSpacing, 0))),
    fontFamily:
      safeStr(input?.fontFamily, 200) ||
      "Arial, Helvetica, sans-serif",
    fontWeight: Math.max(100, Math.min(900, Math.trunc(safeNum(input?.fontWeight, 900)))),
    color: safeStr(input?.color, 20) || "#111111",
    align: normalizeAlign(input?.align),
    uppercase: safeBool(input?.uppercase, false),
  };
}

function buildTokenMapFromSearchParams(searchParams: URLSearchParams) {
  const siteBaseUrl =
    safeStr(process.env.NEXT_PUBLIC_SITE_URL) ||
    "https://www.istudentsportal.com";

  return {
    "%1": normalizeSpaces(searchParams.get("code")) || "BCOS 186",
    "%2":
      normalizeSpaces(searchParams.get("title")) ||
      normalizeSpaces(searchParams.get("subjectTitle")) ||
      "Personal Selling and Salesmanship",
    "%3":
      normalizeSpaces(searchParams.get("course")) ||
      normalizeSpaces(searchParams.get("courseCodes")) ||
      "IGNOU",
    "%4": normalizeSpaces(searchParams.get("courseTitles")) || "",
    "%5": normalizeSpaces(searchParams.get("session")) || "June 2025",
    "%6": normalizeSpaces(searchParams.get("medium")) || "English",
    "%7": normalizeSpaces(searchParams.get("productLink")) || "",
    "%8": normalizeSpaces(searchParams.get("productTitle")) || "",
    "%9": normalizeSpaces(searchParams.get("category")) || "Question Papers (PYQ)",
    "%10": normalizeSpaces(searchParams.get("sku")).toUpperCase() || "",
    "%11": "IGNOU Students Portal",
    "%12": siteBaseUrl.replace(/\/+$/, ""),
  };
}

function resolveFieldText(field: ThumbField, tokenMap: Record<string, string>) {
  const token = safeStr(field.token, 300);
  const fallback = safeStr(field.fallbackText, 500);

  let text = "";

  if (token) {
    text = replaceYoutubeTokens(token, tokenMap);
  }

  if (!text || text === token) {
    text = fallback;
  }

  if (field.uppercase) {
    text = text.toUpperCase();
  }

  return normalizeSpaces(text);
}

function renderTextField(fieldInput: any, tokenMap: Record<string, string>) {
  const field = normalizeField(fieldInput);
  if (!field.enabled) return "";

  const text = resolveFieldText(field, tokenMap);
  if (!text) return "";

  let fontSize = field.fontSize;
  let lines = wrapText(text, fontSize, field.width, field.maxLines);

  let longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);
  fontSize = fitFontSizeByLen(
    "X".repeat(longestLine),
    field.width,
    fontSize,
    field.minFontSize
  );

  lines = wrapText(text, fontSize, field.width, field.maxLines);
  longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);
  fontSize = fitFontSizeByLen(
    "X".repeat(longestLine),
    field.width,
    fontSize,
    field.minFontSize
  );

  const lineGap = fontSize * field.lineHeight;
  const startY = field.y - ((lines.length - 1) * lineGap) / 2;

  const anchor =
    field.align === "left" ? "start" : field.align === "right" ? "end" : "middle";

  const style = [
    `font-family:${esc(field.fontFamily)}`,
    `font-weight:${field.fontWeight}`,
    `fill:${esc(field.color)}`,
  ].join(";");

  return lines
    .map((line, index) => {
      const y = Math.round(startY + index * lineGap);
      return `<text x="${field.x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle" font-size="${fontSize}" letter-spacing="${field.letterSpacing}" style="${style}">${esc(line)}</text>`;
    })
    .join("\n  ");
}

function fallbackBackgroundSvg() {
  return `
  <defs>
    <linearGradient id="fallbackBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="50%" stop-color="#0b2a6b"/>
      <stop offset="100%" stop-color="#dc2626"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.32"/>
    </filter>
  </defs>
  <rect x="0" y="0" width="1280" height="720" fill="url(#fallbackBg)"/>
  <rect x="42" y="42" width="1196" height="636" rx="34" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.22)" stroke-width="2"/>
  <rect x="68" y="72" width="255" height="56" rx="28" fill="#facc15" filter="url(#softShadow)"/>
  <text x="195" y="100" text-anchor="middle" dominant-baseline="middle" font-family="Arial Black, Arial, sans-serif" font-size="24" font-weight="900" fill="#111827">SOLVED PYQ</text>
  <text x="640" y="100" text-anchor="middle" dominant-baseline="middle" font-family="Arial Black, Arial, sans-serif" font-size="42" font-weight="900" fill="#ffffff">IGNOU STUDENTS PORTAL</text>
  <rect x="80" y="540" width="1120" height="96" rx="30" fill="rgba(0,0,0,0.40)" stroke="rgba(255,255,255,0.18)" stroke-width="2"/>
  `;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const tokenMap = buildTokenMapFromSearchParams(searchParams);

  let templateImageUrl = "";
  let fields: any[] = [];

  try {
    const config = await getYoutubeTemplateConfig();
    templateImageUrl = safeStr(config?.pyqThumbnail?.templateImageUrl);
    fields = Array.isArray(config?.pyqThumbnail?.fields)
      ? config.pyqThumbnail.fields
      : [];
  } catch {
    templateImageUrl = "";
    fields = [];
  }

  const bgDataUri = templateImageUrl ? await toDataUri(req, templateImageUrl) : "";

  const renderedFields = fields
    .map((field) => renderTextField(field, tokenMap))
    .filter(Boolean)
    .join("\n  ");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  ${
    bgDataUri
      ? `<image href="${bgDataUri}" x="0" y="0" width="1280" height="720" preserveAspectRatio="none" />`
      : fallbackBackgroundSvg()
  }

  ${renderedFields}
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}