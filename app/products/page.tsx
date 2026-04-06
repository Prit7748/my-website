// app/products/page.tsx
import type { Metadata } from "next";
import ProductsClient from "./ProductsClient";

type SearchParamValue = string | string[] | undefined;

type RawSearchParams =
  | Promise<Record<string, SearchParamValue>>
  | Record<string, SearchParamValue>
  | undefined;

type ApiProductCard = {
  title: string;
  slug: string;
  category?: string;
  courseCodes?: string[];
  session?: string;
  language?: string;
  price: number;
  oldPrice?: number | null;
  images?: string[];
  thumbUrl?: string;
  quickUrl?: string;
  isDigital?: boolean;
};

type ApiProductsResponse = {
  products: ApiProductCard[];
  pagination?: { total?: number; page?: number; totalPages?: number; limit?: number };
  meta?: { total?: number; page?: number; totalPages?: number; limit?: number };
};

function safeStr(x: unknown) {
  return String(x ?? "").trim();
}

function firstValue(v: SearchParamValue) {
  return Array.isArray(v) ? safeStr(v[0]) : safeStr(v);
}

function parseCsvParam(v: string) {
  return safeStr(v)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function normalizeBaseUrl(input?: string) {
  const raw = safeStr(input) || "https://istudentsportal.com";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, "");
}

async function resolveSearchParams(searchParams: RawSearchParams) {
  if (searchParams && typeof (searchParams as Promise<any>).then === "function") {
    return ((await searchParams) || {}) as Record<string, SearchParamValue>;
  }
  return (searchParams || {}) as Record<string, SearchParamValue>;
}

function buildProductsApiQuery(input: {
  search?: string;
  category?: string;
  course?: string;
  session?: string;
  language?: string;
  sort?: string;
  page?: string;
}) {
  const params = new URLSearchParams();

  const search = safeStr(input.search);
  const category = safeStr(input.category);
  const course = safeStr(input.course);
  const session = safeStr(input.session);
  const language = safeStr(input.language);
  const sort = safeStr(input.sort) || "latest";
  const page = safeStr(input.page) || "1";

  if (search) params.set("search", search);
  if (category) params.set("category", category);
  if (course) params.set("course", course);
  if (session) params.set("session", session);
  if (language) params.set("language", language);

  params.set("sort", sort);
  params.set("page", page);
  params.set("limit", "12");
  params.set("includeFacets", "0");

  return params.toString();
}

async function fetchInitialProducts(
  queryString: string
): Promise<ApiProductsResponse | null> {
  try {
    const baseUrl = normalizeBaseUrl(
      process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://istudentsportal.com"
    );

    const res = await fetch(`${baseUrl}/api/products?${queryString}`, {
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data = (await res.json()) as ApiProductsResponse & { ok?: boolean };
    if (!data || !Array.isArray(data.products)) return null;

    return {
      products: data.products,
      pagination: data.pagination,
      meta: data.meta,
    };
  } catch {
    return null;
  }
}

function hasIndexableBaseState(input: {
  search: string;
  category: string;
  course: string;
  session: string;
  language: string;
  sort: string;
  page: string;
}) {
  const pageNum = Number(input.page || "1") || 1;
  return (
    !safeStr(input.search) &&
    !safeStr(input.category) &&
    !safeStr(input.course) &&
    !safeStr(input.session) &&
    !safeStr(input.language) &&
    (!safeStr(input.sort) || safeStr(input.sort) === "latest") &&
    pageNum <= 1
  );
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: RawSearchParams;
}): Promise<Metadata> {
  const sp = await resolveSearchParams(searchParams);

  const search = firstValue(sp.search);
  const category = firstValue(sp.category);
  const course = firstValue(sp.course);
  const session = firstValue(sp.session);
  const language = firstValue(sp.language);
  const sort = firstValue(sp.sort) || "latest";
  const page = firstValue(sp.page) || "1";

  const isBasePage = hasIndexableBaseState({
    search,
    category,
    course,
    session,
    language,
    sort,
    page,
  });

  const activeParts: string[] = [];
  if (search) activeParts.push(`Search: ${search}`);
  if (category) activeParts.push(`Category: ${parseCsvParam(category).join(", ")}`);
  if (course) activeParts.push(`Course: ${parseCsvParam(course).join(", ")}`);
  if (session) activeParts.push(`Session: ${parseCsvParam(session).join(", ")}`);
  if (language) activeParts.push(`Medium: ${parseCsvParam(language).join(", ")}`);

  const dynamicTitle = activeParts.length
    ? `${activeParts.join(" | ")}`
    : "All IGNOU Products";

  const description = isBasePage
    ? "Browse all IGNOU solved assignments, handwritten assignments, question papers, guess papers, projects, ebooks and study material in one place."
    : "Filtered IGNOU product results. Refine by course, session, medium, category or search term to find the exact study material.";

  return {
    title: dynamicTitle,
    description,
    alternates: {
      canonical: "/products",
    },
    robots: isBasePage
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams?: RawSearchParams;
}) {
  const sp = await resolveSearchParams(searchParams);

  const initialSearchParam = firstValue(sp.search);
  const initialCategoryParam = firstValue(sp.category);
  const initialCourseParam = firstValue(sp.course);
  const initialSessionParam = firstValue(sp.session);
  const initialLanguageParam = firstValue(sp.language);
  const initialSortParam = firstValue(sp.sort) || "latest";
  const initialPageParam = firstValue(sp.page) || "1";

  const queryString = buildProductsApiQuery({
    search: initialSearchParam,
    category: initialCategoryParam,
    course: initialCourseParam,
    session: initialSessionParam,
    language: initialLanguageParam,
    sort: initialSortParam,
    page: initialPageParam,
  });

  const initialResponse = await fetchInitialProducts(queryString);

  return (
    <ProductsClient
      initialSearchParam={initialSearchParam}
      initialCategoryParam={initialCategoryParam}
      initialCourseParam={initialCourseParam}
      initialSessionParam={initialSessionParam}
      initialLanguageParam={initialLanguageParam}
      initialSortParam={initialSortParam}
      initialPageParam={initialPageParam}
      initialResponse={initialResponse}
    />
  );
}