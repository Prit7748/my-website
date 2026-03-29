// lib/pyqUiFormat.ts

function safeStr(x: any) {
  return String(x ?? "").trim();
}

const LANG3_LABELS: Record<string, string> = {
  HIN: "Hindi",
  ENG: "English",
  URD: "Urdu",
  PUN: "Punjabi",
  MAL: "Malayalam",
  TEL: "Telugu",
  TAM: "Tamil",
  ARA: "Arabic",
  FRE: "French",
  JAP: "Japanese",
  GER: "German",
  KOR: "Korean",
  MAN: "Mandarin",
  PER: "Persian",
  RUS: "Russian",
  SPA: "Spanish",
  BEN: "Bengali",
  SAN: "Sanskrit",
  BAN: "Bangla",
  ORI: "Oriya",
  NEP: "Nepali",
  MAR: "Marathi",
  KAN: "Kannada",
  KAS: "Kashmiri",
  GUJ: "Gujarati",
  ASS: "Assamese",
};

const MONTH_LABELS: Record<string, string> = {
  JAN: "January",
  JANUARY: "January",
  FEB: "February",
  FEBRUARY: "February",
  MAR: "March",
  MARCH: "March",
  APR: "April",
  APRIL: "April",
  MAY: "May",
  JUN: "June",
  JUNE: "June",
  JUL: "July",
  JULY: "July",
  AUG: "August",
  AUGUST: "August",
  SEP: "September",
  SEPT: "September",
  SEPTEMBER: "September",
  OCT: "October",
  OCTOBER: "October",
  NOV: "November",
  NOVEMBER: "November",
  DEC: "December",
  DECEMBER: "December",
};

function normalizeYear(yearPart: string) {
  const raw = safeStr(yearPart);
  if (!raw) return "";
  if (/^\d{4}$/.test(raw)) return raw;
  if (/^\d{2}$/.test(raw)) return `20${raw}`;
  return raw;
}

export function formatLanguageLabel(input: any) {
  const raw = safeStr(input);
  if (!raw) return "";

  const code = raw.toUpperCase().replace(/[^A-Z]/g, "");
  if (LANG3_LABELS[code]) return LANG3_LABELS[code];

  return raw;
}

export function formatSubjectCode(input: any) {
  const raw = safeStr(input);
  if (!raw) return "";

  const clean = raw.toUpperCase().replace(/\s+/g, "");
  const m = clean.match(/^([A-Z]{2,})(\d+[A-Z]*)$/);

  if (!m) return raw;
  return `${m[1]} ${m[2]}`;
}

export function formatSubjectCodesLabel(input: any) {
  const raw = safeStr(input);
  if (!raw) return "";

  return raw
    .split(/[,|]/)
    .map((part) => formatSubjectCode(part))
    .filter(Boolean)
    .join(", ");
}

export function formatSessionToken(input: any) {
  const raw = safeStr(input).toUpperCase().replace(/\s+/g, "");
  if (!raw) return "";

  const monthYear = raw.match(
    /^(JAN|JANUARY|FEB|FEBRUARY|MAR|MARCH|APR|APRIL|MAY|JUN|JUNE|JUL|JULY|AUG|AUGUST|SEP|SEPT|SEPTEMBER|OCT|OCTOBER|NOV|NOVEMBER|DEC|DECEMBER)(\d{2}|\d{4})$/
  );

  if (monthYear) {
    const month = MONTH_LABELS[monthYear[1]] || monthYear[1];
    const year = normalizeYear(monthYear[2]);
    return `${month} ${year}`.trim();
  }

  if (/^\d{6}$/.test(raw)) {
    const year = raw.slice(0, 4);
    const monthNum = raw.slice(4, 6);
    const monthByNum: Record<string, string> = {
      "01": "January",
      "02": "February",
      "03": "March",
      "04": "April",
      "05": "May",
      "06": "June",
      "07": "July",
      "08": "August",
      "09": "September",
      "10": "October",
      "11": "November",
      "12": "December",
    };

    if (monthByNum[monthNum]) return `${monthByNum[monthNum]} ${year}`;
  }

  return safeStr(input);
}

export function formatSessionLabel(input: any) {
  const raw = safeStr(input);
  if (!raw) return "";

  return raw.replace(
    /\b(JAN|JANUARY|FEB|FEBRUARY|MAR|MARCH|APR|APRIL|MAY|JUN|JUNE|JUL|JULY|AUG|AUGUST|SEP|SEPT|SEPTEMBER|OCT|OCTOBER|NOV|NOVEMBER|DEC|DECEMBER)\s*-?\s*(\d{2}|\d{4})\b/gi,
    (_, mon: string, yr: string) => {
      const month = MONTH_LABELS[safeStr(mon).toUpperCase()] || safeStr(mon);
      const year = normalizeYear(yr);
      return `${month} ${year}`.trim();
    }
  );
}

export function formatPyqUiText(input: any) {
  let text = safeStr(input);
  if (!text) return "";

  text = formatSessionLabel(text);

  text = text.replace(
    /\b(HIN|ENG|URD|PUN|MAL|TEL|TAM|ARA|FRE|JAP|GER|KOR|MAN|PER|RUS|SPA|BEN|SAN|BAN|ORI|NEP|MAR|KAN|KAS|GUJ|ASS)\b/g,
    (m) => LANG3_LABELS[m] || m
  );

  text = text.replace(/\b([A-Z]{2,})(\d+[A-Z]*)\b/g, (full, letters, digits) => {
    const upperFull = safeStr(full).toUpperCase();

    if (LANG3_LABELS[upperFull]) return LANG3_LABELS[upperFull];
    if (MONTH_LABELS[letters]) return full;

    return `${letters} ${digits}`;
  });

  return text.replace(/\s+/g, " ").trim();
}