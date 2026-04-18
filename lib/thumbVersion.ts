const THUMB_GLOBAL_VERSION = "thumb-2026-04-15-v2";

const THUMB_KIND_VERSION = {
  assignment: "a1",
  hardcopy: "h1",
  pyq: "q2",
  pyqCombo: "p2",
} as const;

function safeText(x: any) {
  return String(x ?? "").trim();
}

function stableHash(input: string) {
  let hash = 2166136261;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function normalizeSeedPart(x: any) {
  if (Array.isArray(x)) {
    return x.map((item) => safeText(item)).filter(Boolean).join(",");
  }
  return safeText(x);
}

export function buildThumbVersionToken(
  kind: keyof typeof THUMB_KIND_VERSION,
  parts: any[]
) {
  const normalized = (Array.isArray(parts) ? parts : [])
    .map((x) => normalizeSeedPart(x))
    .filter(Boolean)
    .join("|");

  const hash = stableHash(`${kind}|${normalized}`);
  return `${THUMB_GLOBAL_VERSION}-${THUMB_KIND_VERSION[kind]}-${hash}`;
}

export function getThumbGlobalVersion() {
  return THUMB_GLOBAL_VERSION;
}