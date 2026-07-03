import dbConnect from "@/lib/db";
import Redirection from "@/models/Redirection";

export type RedirectStatusCode = 301 | 302;

export type RedirectionRule = {
  toPath: string;
  statusCode: RedirectStatusCode;
};

const BLOCKED_FROM_PREFIXES = ["/admin", "/api", "/_next"];

const CACHE_TTL_MS = 60_000;

let cache: Map<string, RedirectionRule> | null = null;
let cacheLoadedAt = 0;

export function safeStr(x: unknown) {
  return String(x ?? "").trim();
}

export function normalizeFromPath(input: string): string {
  let path = safeStr(input);
  if (!path) return "";

  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      return "";
    }
  }

  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

  return path;
}

export function normalizeToPath(input: string): string {
  const raw = safeStr(input);
  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      return url.toString();
    } catch {
      return "";
    }
  }

  return raw.startsWith("/") ? raw : `/${raw}`;
}

export function parseStatusCode(input: unknown): RedirectStatusCode | null {
  const n = Number(input);
  if (n === 301 || n === 302) return n;
  return null;
}

export function isBlockedFromPath(path: string): boolean {
  const normalized = normalizeFromPath(path);
  if (!normalized) return true;
  return BLOCKED_FROM_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

export function buildRedirectDestination(
  toPath: string,
  origin: string,
  search: string
): URL {
  const target = normalizeToPath(toPath);
  const dest =
    /^https?:\/\//i.test(target)
      ? new URL(target)
      : new URL(target, origin);

  if (search) {
    const qs = search.startsWith("?") ? search.slice(1) : search;
    const params = new URLSearchParams(qs);
    params.forEach((value, key) => dest.searchParams.set(key, value));
  }

  return dest;
}

export function invalidateRedirectionCache() {
  cache = null;
  cacheLoadedAt = 0;
}

async function loadCache() {
  await dbConnect();

  const rows = await Redirection.find({ isActive: true })
    .select("fromPath toPath statusCode")
    .lean();

  const map = new Map<string, RedirectionRule>();

  for (const row of rows || []) {
    const fromPath = normalizeFromPath(String((row as any).fromPath || ""));
    if (!fromPath) continue;

    const statusCode = parseStatusCode((row as any).statusCode) || 301;
    map.set(fromPath, {
      toPath: safeStr((row as any).toPath),
      statusCode,
    });
  }

  cache = map;
  cacheLoadedAt = Date.now();
}

export async function getRedirectionRule(
  pathname: string
): Promise<RedirectionRule | null> {
  const key = normalizeFromPath(pathname);
  if (!key) return null;

  if (!cache || Date.now() - cacheLoadedAt > CACHE_TTL_MS) {
    await loadCache();
  }

  return cache?.get(key) ?? null;
}

export function serializeRedirection(doc: any) {
  return {
    _id: String(doc._id),
    fromPath: safeStr(doc.fromPath),
    toPath: safeStr(doc.toPath),
    statusCode: parseStatusCode(doc.statusCode) || 301,
    isActive: !!doc.isActive,
    note: safeStr(doc.note),
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

export async function validateRedirectionInput(input: {
  fromPath?: string;
  toPath?: string;
  statusCode?: unknown;
  excludeId?: string;
}) {
  const fromPath = normalizeFromPath(safeStr(input.fromPath));
  const toPath = normalizeToPath(safeStr(input.toPath));
  const statusCode = parseStatusCode(input.statusCode) || 301;

  if (!fromPath) {
    return { ok: false as const, error: "Previous URL path is required" };
  }

  if (!toPath) {
    return { ok: false as const, error: "New URL is required" };
  }

  if (isBlockedFromPath(fromPath)) {
    return {
      ok: false as const,
      error: "Previous URL cannot target /admin, /api, or /_next routes",
    };
  }

  const fromComparable = fromPath;
  const toComparable = /^https?:\/\//i.test(toPath)
    ? normalizeFromPath(toPath)
    : normalizeFromPath(toPath);

  if (fromComparable === toComparable) {
    return {
      ok: false as const,
      error: "Previous URL and new URL cannot be the same",
    };
  }

  await dbConnect();

  const duplicateQuery: Record<string, unknown> = { fromPath };
  if (input.excludeId) duplicateQuery._id = { $ne: input.excludeId };

  const duplicate = await Redirection.findOne(duplicateQuery).select("_id").lean();
  if (duplicate) {
    return {
      ok: false as const,
      error: "A redirection for this previous URL already exists",
    };
  }

  const loop = await Redirection.findOne({
    fromPath: toComparable,
    isActive: true,
    ...(input.excludeId ? { _id: { $ne: input.excludeId } } : {}),
  })
    .select("_id")
    .lean();

  if (loop && !/^https?:\/\//i.test(toPath)) {
    return {
      ok: false as const,
      error: "This would create a redirect loop with another active rule",
    };
  }

  return {
    ok: true as const,
    data: { fromPath, toPath, statusCode },
  };
}
