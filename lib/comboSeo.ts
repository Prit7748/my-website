// lib/comboSeo.ts

export type ComboSeoContext = {
  subjectCode?: string;
  medium?: string;
  lang3?: string;
  categoryLabel?: string;
  comboType?: string;
  itemCount?: number;
  sessionRange?: string;
  courseCodes?: string[] | string;
  title?: string;
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function asJoinedCourseCodes(value: any) {
  if (Array.isArray(value)) {
    return value.map((x) => safeStr(x)).filter(Boolean).join(", ");
  }
  return safeStr(value);
}

function replaceToken(input: string, token: string, value: string) {
  return input.split(token).join(value);
}

export function applyPattern(template: string, context: ComboSeoContext = {}) {
  let out = safeStr(template);
  if (!out) return "";

  const replacements: Record<string, string> = {
    "{subjectCode}": safeStr(context.subjectCode),
    "{medium}": safeStr(context.medium),
    "{lang3}": safeStr(context.lang3),
    "{categoryLabel}": safeStr(context.categoryLabel),
    "{comboType}": safeStr(context.comboType),
    "{itemCount}": context.itemCount ? String(context.itemCount) : "",
    "{sessionRange}": safeStr(context.sessionRange),
    "{courseCodes}": asJoinedCourseCodes(context.courseCodes),
    "{title}": safeStr(context.title),
  };

  for (const [token, value] of Object.entries(replacements)) {
    out = replaceToken(out, token, value);
  }

  return out.replace(/\s+/g, " ").trim();
}

export type BuildSeoInput = {
  titlePattern?: string;
  shortTitlePattern?: string;
  metaTitlePattern?: string;
  metaDescriptionPattern?: string;
  badgePattern?: string;
  itemsLabelPattern?: string;
  sessionLabelPattern?: string;
};

export function buildComboSeoFromPatterns(
  patterns: BuildSeoInput,
  context: ComboSeoContext
) {
  return {
    title: applyPattern(patterns.titlePattern || "", context),
    shortTitle: applyPattern(patterns.shortTitlePattern || "", context),
    metaTitle: applyPattern(patterns.metaTitlePattern || "", context),
    metaDescription: applyPattern(patterns.metaDescriptionPattern || "", context),
    badge: applyPattern(patterns.badgePattern || "", context),
    itemsLabel: applyPattern(patterns.itemsLabelPattern || "", context),
    sessionLabel: applyPattern(patterns.sessionLabelPattern || "", context),
  };
}