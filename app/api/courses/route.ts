import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Course from "@/models/Course";
import Product from "@/models/Product";
import { normalizeProductCategory } from "@/lib/productCatalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function normalizeCourse(code: any) {
  return safeStr(code).replace(/\s+/g, " ").toUpperCase();
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

function sortAlphaNumeric(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

async function getCategoryCourseCodeSet(categories: string[]) {
  if (!categories.length) return null;

  const filter: any = {
    isActive: true,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    category: { $in: categories },
  };

  const raw = await Product.distinct("courseCodes", filter);

  const codes = uniqueStrings(
    (raw || [])
      .flat()
      .map((x: any) => normalizeCourse(x))
      .filter(Boolean)
  );

  return new Set(codes);
}

async function getFallbackTitlesFromProducts(categories: string[], codes: string[]) {
  if (!codes.length) return new Map<string, string>();

  const filter: any = {
    isActive: true,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    courseCodes: { $in: codes },
  };

  if (categories.length) {
    filter.category = { $in: categories };
  }

  const docs: any[] = await Product.find(filter)
    .select("courseCodes courseTitles")
    .lean();

  const titleMap = new Map<string, string>();

  for (const doc of docs || []) {
    const productCodes = Array.isArray(doc?.courseCodes)
      ? doc.courseCodes.map((x: any) => normalizeCourse(x)).filter(Boolean)
      : [];

    const productTitles = Array.isArray(doc?.courseTitles)
      ? doc.courseTitles.map((x: any) => safeStr(x))
      : [];

    for (let i = 0; i < productCodes.length; i += 1) {
      const code = productCodes[i];
      const title = safeStr(productTitles[i] || productTitles[0] || "");
      if (!code || !titleMap.has(code) && title) {
        titleMap.set(code, title);
      }
    }
  }

  return titleMap;
}

export async function GET(request: Request) {
  await dbConnect();

  const url = new URL(request.url);
  const search = safeStr(url.searchParams.get("search")).toLowerCase();
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit") || 300)));

  const rawCategories = uniqueStrings(parseList(url.searchParams.get("category")));
  const categories = rawCategories
    .map((x) => normalizeProductCategory(x))
    .filter(Boolean);

  const categoryCourseSet = await getCategoryCourseCodeSet(categories);

  const courseFilter: any = {
    isActive: true,
  };

  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    courseFilter.$or = [{ code: rx }, { title: rx }];
  }

  let masterCourses: any[] = await Course.find(courseFilter)
    .select("code title")
    .lean();

  let courses = (masterCourses || [])
    .map((doc: any) => ({
      code: normalizeCourse(doc?.code),
      title: safeStr(doc?.title),
    }))
    .filter((row) => row.code);

  if (categoryCourseSet) {
    courses = courses.filter((row) => categoryCourseSet.has(row.code));
  }

  if (categoryCourseSet) {
    const existingCodes = new Set(courses.map((x) => x.code));
    const missingCodes = Array.from(categoryCourseSet).filter((code) => !existingCodes.has(code));

    if (missingCodes.length) {
      const fallbackTitleMap = await getFallbackTitlesFromProducts(categories, missingCodes);

      const missingRows = missingCodes.map((code) => ({
        code,
        title: fallbackTitleMap.get(code) || "",
      }));

      courses = [...courses, ...missingRows];
    }
  }

  if (search && categoryCourseSet) {
    const s = search.toLowerCase();
    courses = courses.filter((row) => {
      const hay = `${row.code} ${row.title}`.toLowerCase();
      return hay.includes(s);
    });
  }

  courses = uniqueStrings(courses.map((x) => x.code)).map((code) => {
    const found = courses.find((row) => row.code === code);
    return {
      code,
      title: found?.title || "",
    };
  });

  courses.sort((a, b) => sortAlphaNumeric(a.code, b.code));

  const sliced = courses.slice(0, limit);

  return NextResponse.json(
    {
      courses: sliced,
      meta: {
        total: sliced.length,
      },
      applied: {
        category: categories,
        search: search || "",
        limit,
      },
    },
    { status: 200 }
  );
}