import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Session from "@/models/Session";
import Product from "@/models/Product";
import {
  normalizeProductCategory,
  categoryLabelToSessionSlugCandidates,
} from "@/lib/productCatalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function parseList(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function uniqueStrings(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    const k = safeStr(v);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function escapeRegex(str: string) {
  return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function slugify(input: string) {
  return safeStr(input)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function sortAlphaNumeric(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function sortSessions(a: { sortOrder: number; name: string }, b: { sortOrder: number; name: string }) {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return sortAlphaNumeric(b.name, a.name);
}

async function getProductSessionsForCategories(categories: string[]) {
  const filter: any = {
    isActive: true,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  };

  if (categories.length) {
    filter.category = { $in: categories };
  }

  const raw = await Product.distinct("session", filter);

  return uniqueStrings(
    (raw || [])
      .map((x: any) => safeStr(x))
      .filter(Boolean)
  ).sort((a, b) => sortAlphaNumeric(b, a));
}

export async function GET(request: Request) {
  await dbConnect();

  const url = new URL(request.url);
  const q = safeStr(url.searchParams.get("search") || url.searchParams.get("q"));
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit") || 300)));

  const rawCategories = uniqueStrings(parseList(url.searchParams.get("category")));
  const categories = rawCategories
    .map((x) => normalizeProductCategory(x))
    .filter(Boolean);

  const categoryCandidates = uniqueStrings(
    categories.flatMap((cat) => categoryLabelToSessionSlugCandidates(cat))
  );

  const sessionFilter: any = {
    isActive: true,
  };

  if (categoryCandidates.length) {
    sessionFilter.categories = { $in: categoryCandidates };
  }

  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    sessionFilter.$or = [{ name: rx }, { slug: rx }, { categories: rx }];
  }

  const masterDocs: any[] = await Session.find(sessionFilter)
    .select("name slug categories sortOrder")
    .sort({ sortOrder: 1, name: 1, _id: 1 })
    .lean();

  const masterItems = (masterDocs || [])
    .map((doc: any) => ({
      name: safeStr(doc?.name),
      slug: safeStr(doc?.slug) || slugify(safeStr(doc?.name)),
      categories: Array.isArray(doc?.categories)
        ? doc.categories.map((x: any) => safeStr(x)).filter(Boolean)
        : [],
      sortOrder: Number(doc?.sortOrder || 0),
      source: "master",
    }))
    .filter((item) => item.name);

  const productSessions = await getProductSessionsForCategories(categories);

  const seenNames = new Set(masterItems.map((item) => item.name));
  const fallbackItems = productSessions
    .filter((name) => !seenNames.has(name))
    .map((name) => ({
      name,
      slug: slugify(name),
      categories,
      sortOrder: 999999,
      source: "product_fallback",
    }));

  let items = [...masterItems, ...fallbackItems];

  if (q) {
    const qLower = q.toLowerCase();
    items = items.filter((item) => {
      const hay = `${item.name} ${item.slug} ${item.categories.join(" ")}`.toLowerCase();
      return hay.includes(qLower);
    });
  }

  items.sort(sortSessions);

  const sliced = items.slice(0, limit);

  return NextResponse.json(
    {
      sessions: sliced,
      meta: {
        total: sliced.length,
      },
      applied: {
        category: categories,
        search: q || "",
        limit,
      },
    },
    { status: 200 }
  );
}