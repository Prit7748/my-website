// lib/productDisplay.ts

export type ProductDisplayInput = {
  subjectCode?: string;
  session?: string;
  session6?: string;
  language?: string;
  medium?: string;
  lang3?: string;
  sku?: string;
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

const MONTH_FULL: Record<string, string> = {
  JAN: "January",
  FEB: "February",
  MAR: "March",
  APR: "April",
  MAY: "May",
  JUN: "June",
  JUL: "July",
  AUG: "August",
  SEP: "September",
  OCT: "October",
  NOV: "November",
  DEC: "December",
};

function normalizeMonthToken(input: any) {
  const raw = safeStr(input).toUpperCase();

  if (!raw) return "";

  if (raw === "JAN" || raw === "JANUARY") return "JAN";
  if (raw === "FEB" || raw === "FEBRUARY") return "FEB";
  if (raw === "MAR" || raw === "MARCH") return "MAR";
  if (raw === "APR" || raw === "APRIL") return "APR";
  if (raw === "MAY") return "MAY";
  if (raw === "JUN" || raw === "JUNE") return "JUN";
  if (raw === "JUL" || raw === "JULY") return "JUL";
  if (raw === "AUG" || raw === "AUGUST") return "AUG";
  if (raw === "SEP" || raw === "SEPT" || raw === "SEPTEMBER") return "SEP";
  if (raw === "OCT" || raw === "OCTOBER") return "OCT";
  if (raw === "NOV" || raw === "NOVEMBER") return "NOV";
  if (raw === "DEC" || raw === "DECEMBER") return "DEC";

  return "";
}

function year2ToYear4(input: any) {
  const raw = safeStr(input);
  if (!raw) return "";
  if (/^\d{4}$/.test(raw)) return raw;
  if (/^\d{2}$/.test(raw)) return `20${raw}`;
  return "";
}

export function parseCompactSkuMeta(skuInput: any) {
  const sku = safeStr(skuInput).toUpperCase().replace(/\s+/g, "");

  if (!sku) return null;

  const m = sku.match(
    /^([A-Z0-9]+?)(HIN|ENG|URD)(JAN|JANUARY|FEB|FEBRUARY|MAR|MARCH|APR|APRIL|MAY|JUN|JUNE|JUL|JULY|AUG|AUGUST|SEP|SEPT|SEPTEMBER|OCT|OCTOBER|NOV|NOVEMBER|DEC|DECEMBER)(\d{2})([A-Z])$/i
  );

  if (!m) return null;

  const compactSubjectCode = safeStr(m[1]).toUpperCase();
  const lang3 = safeStr(m[2]).toUpperCase();
  const monthToken = normalizeMonthToken(m[3]);
  const year2 = safeStr(m[4]);
  const year4 = year2ToYear4(year2);
  const categorySuffix = safeStr(m[5]).toUpperCase();

  return {
    compactSubjectCode,
    lang3,
    monthToken,
    year2,
    year4,
    categorySuffix,
  };
}

export function formatDisplaySubjectCode(input: any, fallbackSku?: any) {
  let raw = safeStr(input);

  if (!raw && fallbackSku) {
    const parsed = parseCompactSkuMeta(fallbackSku);
    raw = safeStr(parsed?.compactSubjectCode);
  }

  raw = raw.toUpperCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!raw) return "";

  if (raw.includes(" ")) return raw;

  const m = raw.match(/^([A-Z]+)(\d+[A-Z0-9]*)$/);
  if (m) {
    return `${m[1]} ${m[2]}`;
  }

  return raw;
}

export function formatDisplayMedium(languageOrMedium?: any, lang3Input?: any, fallbackSku?: any) {
  const direct = safeStr(languageOrMedium);
  if (direct) {
    const upper = direct.toUpperCase();
    if (upper === "HIN" || upper === "HINDI") return "Hindi";
    if (upper === "ENG" || upper === "ENGLISH") return "English";
    if (upper === "URD" || upper === "URDU") return "Urdu";
    return direct;
  }

  let lang3 = safeStr(lang3Input).toUpperCase();

  if (!lang3 && fallbackSku) {
    const parsed = parseCompactSkuMeta(fallbackSku);
    lang3 = safeStr(parsed?.lang3).toUpperCase();
  }

  if (lang3 === "HIN") return "Hindi";
  if (lang3 === "ENG") return "English";
  if (lang3 === "URD") return "Urdu";
  if (lang3 === "PUN") return "Punjabi";
  if (lang3 === "MAL") return "Malyalam";
  if (lang3 === "TEL") return "Telugu";
  if (lang3 === "TAM") return "Tamil";
  if (lang3 === "ARA") return "Arabic";
  if (lang3 === "FRE") return "French";
  if (lang3 === "JAP") return "Japanese";
  if (lang3 === "GER") return "German";
  if (lang3 === "KOR") return "Korean";
  if (lang3 === "MAN") return "Mandarin";
  if (lang3 === "PER") return "Persian";
  if (lang3 === "RUS") return "Russian";
  if (lang3 === "SPA") return "Spanish";
  if (lang3 === "BEN") return "Bengali";
  if (lang3 === "SAN") return "Sanskrit";
  if (lang3 === "BAN") return "Bangla";
  if (lang3 === "ORI") return "Oriya";
  if (lang3 === "NEP") return "Nepali";
  if (lang3 === "MAR") return "Marathi";
  if (lang3 === "KAN") return "Kannada";
  if (lang3 === "KAS") return "Kashmiri";
  if (lang3 === "GUJ") return "Gujarati";
  if (lang3 === "ASS") return "Assamese";

  return lang3 || "";
}

export function formatDisplaySession(sessionInput?: any, session6Input?: any, fallbackSku?: any) {
  let raw = safeStr(sessionInput);

  if (!raw && fallbackSku) {
    const parsed = parseCompactSkuMeta(fallbackSku);
    if (parsed?.monthToken && parsed?.year4) {
      return `${MONTH_FULL[parsed.monthToken]} ${parsed.year4}`;
    }
  }

  if (!raw) {
    const session6 = safeStr(session6Input);
    if (/^\d{6}$/.test(session6)) {
      const yyyy = session6.slice(0, 4);
      const mm = session6.slice(4, 6);
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
      return monthByNum[mm] ? `${monthByNum[mm]} ${yyyy}` : session6;
    }
    return "";
  }

  const compact = raw.toUpperCase().replace(/\s+/g, "");

  const m1 = compact.match(
    /^(JAN|JANUARY|FEB|FEBRUARY|MAR|MARCH|APR|APRIL|MAY|JUN|JUNE|JUL|JULY|AUG|AUGUST|SEP|SEPT|SEPTEMBER|OCT|OCTOBER|NOV|NOVEMBER|DEC|DECEMBER)(\d{2,4})$/
  );
  if (m1) {
    const mon = normalizeMonthToken(m1[1]);
    const year = year2ToYear4(m1[2]);
    if (mon && year) return `${MONTH_FULL[mon]} ${year}`;
  }

  const m2 = raw.match(
    /^(JAN|JANUARY|FEB|FEBRUARY|MAR|MARCH|APR|APRIL|MAY|JUN|JUNE|JUL|JULY|AUG|AUGUST|SEP|SEPT|SEPTEMBER|OCT|OCTOBER|NOV|NOVEMBER|DEC|DECEMBER)[\s\-]+(\d{2,4})$/i
  );
  if (m2) {
    const mon = normalizeMonthToken(m2[1]);
    const year = year2ToYear4(m2[2]);
    if (mon && year) return `${MONTH_FULL[mon]} ${year}`;
  }

  if (/^\d{6}$/.test(compact)) {
    const yyyy = compact.slice(0, 4);
    const mm = compact.slice(4, 6);
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
    return monthByNum[mm] ? `${monthByNum[mm]} ${yyyy}` : raw;
  }

  return raw;
}

export function getReadableProductMeta(product: ProductDisplayInput) {
  return {
    subjectCode: formatDisplaySubjectCode(product?.subjectCode, product?.sku),
    medium: formatDisplayMedium(product?.language || product?.medium, product?.lang3, product?.sku),
    session: formatDisplaySession(product?.session, product?.session6, product?.sku),
  };
}