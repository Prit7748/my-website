import { NextRequest } from "next/server";
import path from "path";
import { promises as fs } from "fs";

import dbConnect from "@/lib/db";
import PyqThumbnailConfig, {
  PYQ_THUMBNAIL_CONFIG_KEY,
} from "@/models/PyqThumbnailConfig";

export const runtime = "nodejs";

const DEFAULT_TEMPLATE_PATH = "/images/thumbs/pyq-master-template.png";

function safeStr(x: unknown, max = 300) {
  const s = String(x ?? "").trim();
  return s.length > max ? s.slice(0, max) : s;
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

function arrayBufferToBase64(buf: ArrayBuffer) {
  return Buffer.from(buf).toString("base64");
}

function bufferToBase64(buf: Buffer) {
  return buf.toString("base64");
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
  const raw = safeStr(publicPath, 3000);
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
  const raw = safeStr(url, 3000);
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
  const input = safeStr(rawPathOrUrl, 3000);
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

async function resolveConfiguredTemplateUrl() {
  try {
    await dbConnect();

    const doc: any = await PyqThumbnailConfig.findOne({
      key: PYQ_THUMBNAIL_CONFIG_KEY,
    })
      .select("isEnabled templateImageUrl updatedAt")
      .lean();

    const enabled = safeBool(doc?.isEnabled, true);
    const templateImageUrl = safeStr(doc?.templateImageUrl, 3000);

    if (enabled && templateImageUrl) {
      return templateImageUrl;
    }

    return DEFAULT_TEMPLATE_PATH;
  } catch {
    return DEFAULT_TEMPLATE_PATH;
  }
}

function fitFontSizeByLen(
  text: string,
  maxWidthPx: number,
  baseSize: number,
  minSize: number,
  approxChar = 0.6
) {
  const t = text.trim();
  if (!t) return baseSize;

  const need = t.length * baseSize * approxChar;
  if (need <= maxWidthPx) return baseSize;

  const ratio = maxWidthPx / need;
  const sized = Math.floor(baseSize * ratio);

  return Math.max(minSize, Math.min(baseSize, sized));
}

function normalizeSpaces(input: string) {
  return safeStr(input).replace(/\s+/g, " ").trim();
}

function normalizeSubjectCodeDisplay(input: string) {
  const raw = normalizeSpaces(input).toUpperCase().replace(/[_]+/g, " ");
  if (!raw) return "BANC-102";

  const compact = raw.replace(/\s+/g, "").replace(/[^A-Z0-9-]/g, "");
  const m = compact.match(/^([A-Z]{2,})(\d+[A-Z0-9]*)$/);

  if (m) return `${m[1]}-${m[2]}`;
  if (compact.includes("-")) return compact;

  return raw.replace(/\s+/g, "-");
}

function normalizeMediumDisplay(input: string) {
  const raw = normalizeSpaces(input);
  if (!raw) return "ENGLISH";

  const upper = raw.toUpperCase();

  if (upper === "ENG" || upper === "ENGLISH" || upper === "ENGLISH MEDIUM") {
    return "ENGLISH";
  }
  if (upper === "HIN" || upper === "HINDI" || upper === "HINDI MEDIUM") {
    return "HINDI";
  }
  if (upper === "URD" || upper === "URDU" || upper === "URDU MEDIUM") {
    return "URDU";
  }
  if (upper === "SAN" || upper === "SANSKRIT" || upper === "SANSKRIT MEDIUM") {
    return "SANSKRIT";
  }

  return upper.replace(/\s+MEDIUM$/i, "").trim();
}

function normalizeSessionDisplay(input: string) {
  const raw = normalizeSpaces(input);
  if (!raw) return "JUNE, 2025";

  const upper = raw.toUpperCase();

  if (/^\d{4}-\d{4}$/.test(upper) || /^\d{4}-\d{2}$/.test(upper)) return upper;

  const compact = upper.replace(/\s+/g, "");
  const monthYear = compact.match(
    /^(JAN|JANUARY|FEB|FEBRUARY|MAR|MARCH|APR|APRIL|MAY|JUN|JUNE|JUL|JULY|AUG|AUGUST|SEP|SEPT|SEPTEMBER|OCT|OCTOBER|NOV|NOVEMBER|DEC|DECEMBER)[,\- ]?(\d{4})$/
  );

  if (monthYear) {
    const monthMap: Record<string, string> = {
      JAN: "JANUARY",
      JANUARY: "JANUARY",
      FEB: "FEBRUARY",
      FEBRUARY: "FEBRUARY",
      MAR: "MARCH",
      MARCH: "MARCH",
      APR: "APRIL",
      APRIL: "APRIL",
      MAY: "MAY",
      JUN: "JUNE",
      JUNE: "JUNE",
      JUL: "JULY",
      JULY: "JULY",
      AUG: "AUGUST",
      AUGUST: "AUGUST",
      SEP: "SEPTEMBER",
      SEPT: "SEPTEMBER",
      SEPTEMBER: "SEPTEMBER",
      OCT: "OCTOBER",
      OCTOBER: "OCTOBER",
      NOV: "NOVEMBER",
      NOVEMBER: "NOVEMBER",
      DEC: "DECEMBER",
      DECEMBER: "DECEMBER",
    };

    return `${monthMap[monthYear[1]] || monthYear[1]}, ${monthYear[2]}`;
  }

  return upper;
}

function normalizeTitleDisplay(input: string) {
  const raw = normalizeSpaces(input);
  if (!raw) return "INTRODUCTION TO SOCIAL AND CULTURAL ANTHROPOLOGY";
  return raw.toUpperCase();
}

function normalizeProgrammeDisplay(input: string) {
  const raw = normalizeSpaces(input);
  if (!raw) return "BSCG";
  return raw.toUpperCase();
}

function balancedWrap(text: string, maxLines: number, maxCharsPerLine: number) {
  const words = normalizeSpaces(text).split(" ").filter(Boolean);
  if (!words.length) return [""];

  let bestLines: string[] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  function scoreLines(lines: string[]) {
    const lengths = lines.map((x) => x.length);
    const maxLen = Math.max(...lengths);
    const minLen = Math.min(...lengths);
    const overLimit = lengths.reduce(
      (sum, len) => sum + Math.max(0, len - maxCharsPerLine),
      0
    );

    return (
      maxLen +
      overLimit * 3 +
      (maxLen - minLen) * 0.4 +
      Math.abs(maxLines - lines.length) * 2
    );
  }

  function dfs(startIndex: number, lines: string[]) {
    if (startIndex >= words.length) {
      const score = scoreLines(lines);
      if (score < bestScore) {
        bestScore = score;
        bestLines = [...lines];
      }
      return;
    }

    if (lines.length >= maxLines) return;

    for (let end = startIndex + 1; end <= words.length; end += 1) {
      const segment = words.slice(startIndex, end).join(" ");
      if (segment.length > maxCharsPerLine + 8 && end > startIndex + 1) break;
      dfs(end, [...lines, segment]);
    }
  }

  dfs(0, []);

  const out = bestLines || [words.join(" ")];
  return out.slice(0, maxLines);
}

function centeredLineYs(centerY: number, lineCount: number, lineGap: number) {
  if (lineCount <= 1) return [centerY];

  const start = centerY - ((lineCount - 1) * lineGap) / 2;
  return Array.from({ length: lineCount }, (_, i) => Math.round(start + i * lineGap));
}

function renderCenterAlignedLines(params: {
  lines: string[];
  x: number;
  centerY: number;
  fontSize: number;
  lineGap: number;
  className: string;
}) {
  const { lines, x, centerY, fontSize, lineGap, className } = params;
  const ys = centeredLineYs(centerY, lines.length, lineGap);

  return lines
    .map(
      (line, idx) =>
        `<text x="${x}" y="${ys[idx]}" text-anchor="middle" dominant-baseline="middle" class="${className}" font-size="${fontSize}">${esc(
          line
        )}</text>`
    )
    .join("\n  ");
}

function renderLeftAlignedLines(params: {
  lines: string[];
  x: number;
  centerY: number;
  fontSize: number;
  lineGap: number;
  className: string;
}) {
  const { lines, x, centerY, fontSize, lineGap, className } = params;
  const ys = centeredLineYs(centerY, lines.length, lineGap);

  return lines
    .map(
      (line, idx) =>
        `<text x="${x}" y="${ys[idx]}" text-anchor="start" dominant-baseline="middle" class="${className}" font-size="${fontSize}">${esc(
          line
        )}</text>`
    )
    .join("\n  ");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const codeRaw = safeStr(searchParams.get("code"), 80) || "BANC102";
  const titleRaw =
    safeStr(searchParams.get("title"), 220) ||
    "Introduction to Social and Cultural Anthropology";
  const programmeRaw =
    safeStr(searchParams.get("programme"), 180) ||
    safeStr(searchParams.get("course"), 180) ||
    "BSCG";
  const sessionRaw = safeStr(searchParams.get("session"), 80) || "June 2025";
  const mediumRaw = safeStr(searchParams.get("medium"), 80) || "English";

  const bgOverride =
    safeStr(searchParams.get("bg"), 3000) ||
    safeStr(searchParams.get("template"), 3000);

  const configuredTemplateUrl = bgOverride || (await resolveConfiguredTemplateUrl());

  const subjectCodePlain = normalizeSubjectCodeDisplay(codeRaw);
  const subjectTitlePlain = normalizeTitleDisplay(titleRaw);
  const programmePlain = normalizeProgrammeDisplay(programmeRaw);
  const sessionPlain = normalizeSessionDisplay(sessionRaw);
  const mediumPlain = normalizeMediumDisplay(mediumRaw);

  const paperCodePlain = subjectCodePlain;
  const paperNamePlain = subjectTitlePlain;

  let bgDataUri = await toDataUri(req, configuredTemplateUrl);

  if (!bgDataUri && configuredTemplateUrl !== DEFAULT_TEMPLATE_PATH) {
    bgDataUri = await toDataUri(req, DEFAULT_TEMPLATE_PATH);
  }

  const W = 1086;
  const H = 1448;

  const codeFont = fitFontSizeByLen(subjectCodePlain, 550, 100, 62, 0.6);

  const titleLines = balancedWrap(subjectTitlePlain, 2, 28);
  const longestTitleLine = titleLines.reduce((m, s) => Math.max(m, s.length), 0);
  const titleFont = fitFontSizeByLen(
    "X".repeat(longestTitleLine),
    545,
    31,
    23,
    0.58
  );

  const programmeLines = balancedWrap(programmePlain, 2, 22);
  const longestProgrammeLine = programmeLines.reduce(
    (m, s) => Math.max(m, s.length),
    0
  );
  const programmeFont = fitFontSizeByLen(
    "X".repeat(longestProgrammeLine),
    360,
    23,
    17,
    0.53
  );

  const paperNameLines = balancedWrap(paperNamePlain, 2, 22);
  const longestPaperNameLine = paperNameLines.reduce(
    (m, s) => Math.max(m, s.length),
    0
  );
  const paperNameFont = fitFontSizeByLen(
    "X".repeat(longestPaperNameLine),
    360,
    19,
    14,
    0.53
  );

  const titleCenterX = 362;
  const titleCenterY = titleLines.length >= 2 ? 692 : 700;
  const titleLineGap = titleFont + 8;

  const valueX = 318;

  // only table-right-column alignment tuned upward
  const rowCenters = {
    programme: 790,
    session: 860,
    paperCode: 929,
    paperName: 994,
    medium: 1057,
  };

  const programmeLineGap = programmeFont + 6;
  const paperNameLineGap = paperNameFont + 5;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <style>
      .codeFont {
        font-family: "Arial Black", Arial, Helvetica, sans-serif;
        font-weight: 900;
        fill: #0b2a6b;
        letter-spacing: 1px;
      }
      .titleFont {
        font-family: Arial, Helvetica, sans-serif;
        font-weight: 900;
        fill: #111111;
      }
      .rowFont {
        font-family: Arial, Helvetica, sans-serif;
        font-weight: 800;
        fill: #111111;
      }
    </style>
  </defs>

  ${
    bgDataUri
      ? `<image href="${bgDataUri}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none" />`
      : `<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff" />`
  }

  <text x="100" y="640" class="codeFont" font-size="${codeFont}">
    ${esc(subjectCodePlain)}
  </text>

  ${renderCenterAlignedLines({
    lines: titleLines,
    x: titleCenterX,
    centerY: titleCenterY,
    fontSize: titleFont,
    lineGap: titleLineGap,
    className: "titleFont",
  })}

  ${renderLeftAlignedLines({
    lines: programmeLines,
    x: valueX,
    centerY: rowCenters.programme,
    fontSize: programmeFont,
    lineGap: programmeLineGap,
    className: "rowFont",
  })}

  ${renderLeftAlignedLines({
    lines: [sessionPlain],
    x: valueX,
    centerY: rowCenters.session,
    fontSize: 25,
    lineGap: 0,
    className: "rowFont",
  })}

  ${renderLeftAlignedLines({
    lines: [paperCodePlain],
    x: valueX,
    centerY: rowCenters.paperCode,
    fontSize: 24,
    lineGap: 0,
    className: "rowFont",
  })}

  ${renderLeftAlignedLines({
    lines: paperNameLines,
    x: valueX,
    centerY: rowCenters.paperName,
    fontSize: paperNameFont,
    lineGap: paperNameLineGap,
    className: "rowFont",
  })}

  ${renderLeftAlignedLines({
    lines: [mediumPlain],
    x: valueX,
    centerY: rowCenters.medium,
    fontSize: 26,
    lineGap: 0,
    className: "rowFont",
  })}
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}