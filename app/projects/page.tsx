import type { Metadata } from "next";
import { Suspense } from "react";
import ProjectsClient from "./ProjectsClient";
import SeoPaginationLinks from "@/components/seo/SeoPaginationLinks";

import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import GlobalToggle from "@/models/GlobalToggle";
import { attachResolvedOnDemandTimingToProducts } from "@/lib/onDemandTiming";

const BASE_URL = "https://istudentsportal.com";
const PAGE_PATH = "/projects";
const PAGE_URL = `${BASE_URL}${PAGE_PATH}`;
const CATEGORY_VALUE = "projects";

export const runtime = "nodejs";

type PageProps = {
  searchParams?: Promise<{
    category?: string;
    course?: string;
    session?: string;
    language?: string;
    search?: string;
    page?: string;
  }>;
};

type Meta = {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
};

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function safeNum(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseList(value?: string | null) {
  if (!value) return [];

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const clean = safeStr(value);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    output.push(clean);
  }

  return output;
}

function escapeRegex(value: string) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fileNameOf(urlOrPath: string) {
  const clean = safeStr(urlOrPath).split("?")[0];
  const parts = clean.split("/");
  return safeStr(parts[parts.length - 1]).toLowerCase();
}

function normalizeImagesToUrls(images: unknown) {
  const arr = Array.isArray(images) ? images : [];

  if (!arr.length) {
    return {
      urls: [] as string[],
      thumbUrl: "",
      quickUrl: "",
    };
  }

  const allStrings = arr.every((item) => typeof item === "string");

  if (allStrings) {
    const urls = Array.from(new Set(arr.map((item) => safeStr(item)).filter(Boolean))).sort(
      (a, b) => fileNameOf(a).localeCompare(fileNameOf(b), undefined, { numeric: true })
    );

    return {
      urls,
      thumbUrl: urls[0] || "",
      quickUrl: urls[1] || urls[0] || "",
    };
  }

  const stringUrls: string[] = arr
    .filter((item): item is string => typeof item === "string")
    .map((item) => safeStr(item))
    .filter(Boolean);

  const objectUrls = arr
    .filter(
      (item): item is { url: string; sortKey?: string; filename?: string } =>
        !!item &&
        typeof item === "object" &&
        "url" in item &&
        typeof (item as any).url === "string"
    )
    .filter((item) => safeStr(item.url))
    .sort((a, b) => {
      const aKey = safeStr(a.sortKey || a.filename || fileNameOf(a.url)).toLowerCase();
      const bKey = safeStr(b.sortKey || b.filename || fileNameOf(b.url)).toLowerCase();
      return aKey.localeCompare(bKey, undefined, { numeric: true });
    })
    .map((item) => safeStr(item.url))
    .filter(Boolean);

  const urls = Array.from(new Set([...stringUrls, ...objectUrls])).sort((a, b) =>
    fileNameOf(a).localeCompare(fileNameOf(b), undefined, { numeric: true })
  );

  return {
    urls,
    thumbUrl: urls[0] || "",
    quickUrl: urls[1] || urls[0] || "",
  };
}

function normalizeQuery(query: string) {
  return safeStr(query)
    .toLowerCase()
    .replace(/[_:]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(query: string) {
  const normalized = normalizeQuery(query);

  if (!normalized) return [];

  return normalized
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function buildFlexibleCodeRegexFromQuery(query: string) {
  const normalized = normalizeQuery(query).replace(/\s+/g, "");
  const match = normalized.match(/^([a-z]{2,10})0*([0-9]{1,6})$/i);

  if (!match) return null;

  const prefix = match[1];
  const numberPart = match[2];

  return new RegExp(`${escapeRegex(prefix)}[\\s\\-]*0*${escapeRegex(numberPart)}`, "i");
}

function scoreProductForQuery(product: any, query: string) {
  const normalizedQuery = normalizeQuery(query).replace(/\s+/g, "");
  const title = normalizeQuery(product?.title || "");
  const subjectCode = normalizeQuery(product?.subjectCode || "");
  const slug = normalizeQuery(product?.slug || "");
  const category = normalizeQuery(product?.category || "");

  let score = 0;

  if (subjectCode && normalizedQuery && subjectCode.replace(/\s+/g, "") === normalizedQuery) {
    score += 160;
  }

  if (slug && normalizedQuery && slug.replace(/\s+/g, "") === normalizedQuery) {
    score += 110;
  }

  if (subjectCode && normalizedQuery && subjectCode.replace(/\s+/g, "").includes(normalizedQuery)) {
    score += 95;
  }

  if (title && normalizedQuery && title.replace(/\s+/g, "").includes(normalizedQuery)) {
    score += 55;
  }

  if (slug && normalizedQuery && slug.replace(/\s+/g, "").includes(normalizedQuery)) {
    score += 35;
  }

  if (category && normalizedQuery && category.includes(normalizedQuery)) {
    score += 12;
  }

  const tokens = tokenize(query);

  for (const token of tokens) {
    if (token.length < 2) continue;
    if (subjectCode.includes(token)) score += 20;
    if (title.includes(token)) score += 12;
    if (slug.includes(token)) score += 8;
    if (category.includes(token)) score += 4;
  }

  return score;
}

function normalizeSearchForClientQuery(raw: string) {
  const input = safeStr(raw).toUpperCase();
  const cleaned = input.replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const compact = cleaned.replace(/\s+/g, "");

  const match = compact.match(/([A-Z]{2,6})(\d{2,4})/);

  if (!match) return cleaned;

  const letters = match[1];
  const digits = match[2];
  const digitsWithoutLeadingZero = String(Number(digits));
  const paddedThreeDigits = digitsWithoutLeadingZero.padStart(3, "0");

  const variants = Array.from(
    new Set([
      `${letters}${digits}`,
      `${letters}${digitsWithoutLeadingZero}`,
      `${letters}-${digits}`,
      `${letters}-${digitsWithoutLeadingZero}`,
      `${letters} ${digits}`,
      `${letters} ${digitsWithoutLeadingZero}`,
      `${letters}${paddedThreeDigits}`,
      `${letters}-${paddedThreeDigits}`,
      `${letters} ${paddedThreeDigits}`,
    ])
  );

  const extra = variants.slice(0, 6).join(" ");

  return extra ? `${cleaned} ${extra}` : cleaned;
}

function normAvail(value?: string) {
  return safeStr(value).toLowerCase();
}

async function getOnDemandSalesEnabled() {
  try {
    const doc: any =
      (await GlobalToggle.findOne({ key: "on_demand_sales" }).lean()) ||
      (await GlobalToggle.findOne({ key: "coming_soon_sales" }).lean());

    if (!doc) return true;

    return Boolean(doc.enabled);
  } catch {
    return true;
  }
}

function resolveAvailability(rawAvailability: string, onDemandSalesEnabled: boolean) {
  const availability = normAvail(rawAvailability);

  if (
    availability === "out_of_stock" ||
    availability === "outofstock" ||
    availability === "out-of-stock"
  ) {
    return "want_to_buy";
  }

  if (
    availability === "want_to_buy" ||
    availability === "wanttobuy" ||
    availability === "want-to-buy"
  ) {
    return "want_to_buy";
  }

  if (
    availability === "coming_soon" ||
    availability === "comingsoon" ||
    availability === "coming-soon"
  ) {
    return onDemandSalesEnabled ? "on_demand" : "want_to_buy";
  }

  if (
    availability === "on_demand" ||
    availability === "ondemand" ||
    availability === "on-demand"
  ) {
    return onDemandSalesEnabled ? "on_demand" : "want_to_buy";
  }

  if (
    availability === "available" ||
    availability === "in_stock" ||
    availability === "instock" ||
    availability === ""
  ) {
    return "available";
  }

  return "available";
}

function buildProjectsQueryKey(input: {
  course?: string;
  session?: string;
  language?: string;
  search?: string;
  page?: number;
}) {
  const selectedCourse = uniqueStrings(parseList(input.course).map((item) => item.toUpperCase()));
  const selectedSession = uniqueStrings(parseList(input.session));
  const selectedLanguage = uniqueStrings(parseList(input.language));
  const page = Math.max(1, safeNum(input.page, 1));

  const params = new URLSearchParams();

  params.set("page", String(page));
  params.set("limit", "12");
  params.set("includeFacets", "0");
  params.set("sort", "latest");
  params.set("category", CATEGORY_VALUE);

  if (selectedCourse.length) params.set("course", selectedCourse.join(","));
  if (selectedSession.length) params.set("session", selectedSession.join(","));
  if (selectedLanguage.length) params.set("language", selectedLanguage.join(","));

  const normalizedSearch = normalizeSearchForClientQuery(safeStr(input.search));

  if (normalizedSearch) {
    params.set("search", normalizedSearch);
  }

  return params.toString();
}

async function getInitialProjectsData(input: {
  course?: string;
  session?: string;
  language?: string;
  search?: string;
  page?: number;
}) {
  const courses = uniqueStrings(parseList(input.course).map((item) => item.toUpperCase()));
  const sessions = uniqueStrings(parseList(input.session));
  const languages = uniqueStrings(parseList(input.language));

  const searchRaw = safeStr(input.search);
  const page = Math.max(1, Math.trunc(safeNum(input.page, 1)));
  const limit = 12;
  const skip = (page - 1) * limit;
  const search = searchRaw.length >= 2 ? searchRaw : "";
  const hasSearch = Boolean(search);

  const sortObj: any = { createdAt: -1, _id: -1 };

  const filter: any = {
    isActive: true,
    category: CATEGORY_VALUE,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  };

  if (courses.length) filter.courseCodes = { $in: courses };
  if (sessions.length) filter.session = { $in: sessions };
  if (languages.length) filter.language = { $in: languages };

  try {
    await dbConnect();

    const onDemandSalesEnabled = await getOnDemandSalesEnabled();

    const projection: any = {
      title: 1,
      slug: 1,
      category: 1,

      subjectCode: 1,
      subjectTitle: 1,
      subjectTitleHi: 1,
      subjectTitleEn: 1,
      courseCodes: 1,
      courseTitles: 1,

      session: 1,
      language: 1,

      price: 1,
      oldPrice: 1,
      shortDesc: 1,
      isDigital: 1,
      pdfUrl: 1,
      isActive: 1,

      images: 1,
      thumbnailUrl: 1,
      quickUrl: 1,

      availability: 1,
      deliverWithinMinutes: 1,
      onDemandNote: 1,

      createdAt: 1,
      updatedAt: 1,
    };

    let rawProducts: any[] = [];
    let total = 0;

    if (hasSearch) {
      const textFilter = { ...filter, $text: { $search: search } };
      const textProjection = { ...projection, score: { $meta: "textScore" } };
      const textSortObj: any = {
        score: { $meta: "textScore" },
        createdAt: -1,
        _id: -1,
      };

      try {
        [rawProducts, total] = await Promise.all([
          Product.find(textFilter)
            .select(textProjection)
            .sort(textSortObj)
            .skip(skip)
            .limit(limit)
            .lean(),
          Product.countDocuments(textFilter),
        ]);
      } catch (error: any) {
        const message = String(error?.message || "").toLowerCase();
        const textIndexMissing =
          message.includes("text index required") ||
          message.includes("no text index") ||
          message.includes("failed to use text index");

        if (!textIndexMissing) throw error;

        const tokens = tokenize(search)
          .filter((token) => token.length >= 2)
          .slice(0, 6);

        const tokenRegexes = tokens.map((token) => new RegExp(escapeRegex(token), "i"));
        const codeRegex = buildFlexibleCodeRegexFromQuery(search);

        const fieldsToSearch = [
          "title",
          "slug",
          "subjectCode",
          "subjectTitle",
          "subjectTitleHi",
          "subjectTitleEn",
          "courseCodes",
          "courseTitles",
          "category",
          "session",
          "language",
        ];

        const regexFilter: any = { ...filter };
        const andParts: any[] = [];

        if (codeRegex) {
          andParts.push({
            $or: [{ subjectCode: codeRegex }, { title: codeRegex }, { slug: codeRegex }],
          });
        }

        for (const regex of tokenRegexes) {
          andParts.push({
            $or: fieldsToSearch.map((field) => ({ [field]: regex })),
          });
        }

        if (andParts.length) {
          regexFilter.$and = andParts;
        } else {
          const regex = new RegExp(escapeRegex(search), "i");
          regexFilter.$or = [{ subjectCode: regex }, { title: regex }, { slug: regex }];
        }

        [rawProducts, total] = await Promise.all([
          Product.find(regexFilter)
            .select(projection)
            .sort(sortObj)
            .skip(skip)
            .limit(limit)
            .lean(),
          Product.countDocuments(regexFilter),
        ]);

        rawProducts.sort((a, b) => scoreProductForQuery(b, search) - scoreProductForQuery(a, search));
      }
    } else {
      [rawProducts, total] = await Promise.all([
        Product.find(filter)
          .select(projection)
          .sort(sortObj)
          .skip(skip)
          .limit(limit)
          .lean(),
        Product.countDocuments(filter),
      ]);
    }

    const normalizedProducts = (rawProducts || []).map((product: any) => {
      const { urls, thumbUrl, quickUrl } = normalizeImagesToUrls(product.images);

      const finalThumb = safeStr(product.thumbnailUrl) || thumbUrl;
      const finalQuick = safeStr(product.quickUrl) || quickUrl;

      const rawAvailability = safeStr(product.availability || "");
      const effectiveAvailability = resolveAvailability(rawAvailability, onDemandSalesEnabled);

      return {
        _id: String(product._id),
        title: safeStr(product.title),
        slug: safeStr(product.slug),
        category: safeStr(product.category),

        subjectCode: safeStr(product.subjectCode),
        subjectTitleHi: safeStr(product.subjectTitleHi),
        subjectTitleEn: safeStr(product.subjectTitleEn),
        subjectTitle:
          (safeStr(product.language).toLowerCase().startsWith("hin")
            ? product.subjectTitleHi
            : product.subjectTitleEn) ||
          product.subjectTitle ||
          product.subjectTitleEn ||
          product.subjectTitleHi ||
          "",

        courseCodes: Array.isArray(product.courseCodes) ? [...product.courseCodes] : [],
        courseTitles: Array.isArray(product.courseTitles) ? [...product.courseTitles] : [],

        session: safeStr(product.session),
        language: safeStr(product.language),

        price: Number(product.price || 0),
        oldPrice: product.oldPrice ? Number(product.oldPrice) : null,
        shortDesc: safeStr(product.shortDesc),
        isDigital: Boolean(product.isDigital),
        pdfUrl: safeStr(product.pdfUrl),
        isActive: Boolean(product.isActive),

        availability: effectiveAvailability,
        rawAvailability,
        canPurchase: effectiveAvailability !== "want_to_buy",

        rawDeliverWithinMinutes: Math.max(1, safeNum(product.deliverWithinMinutes, 20)),
        rawOnDemandNote: safeStr(product.onDemandNote),

        images: [...urls],
        thumbUrl: finalThumb,
        quickUrl: finalQuick,
        thumbnailUrl: finalThumb,
      };
    });

    const resolvedProducts = await attachResolvedOnDemandTimingToProducts(normalizedProducts);

    const products = resolvedProducts.map((product: any) => ({
      _id: safeStr(product._id),
      title: safeStr(product.title),
      slug: safeStr(product.slug),
      category: safeStr(product.category),

      subjectCode: safeStr(product.subjectCode),
      subjectTitleHi: safeStr(product.subjectTitleHi),
      subjectTitleEn: safeStr(product.subjectTitleEn),
      subjectTitle: safeStr(product.subjectTitle),

      courseCodes: Array.isArray(product.courseCodes)
        ? [...product.courseCodes].map((item: any) => safeStr(item))
        : [],
      courseTitles: Array.isArray(product.courseTitles)
        ? [...product.courseTitles].map((item: any) => safeStr(item))
        : [],

      session: safeStr(product.session),
      language: safeStr(product.language),

      price: Number(product.price || 0),
      oldPrice: product.oldPrice ? Number(product.oldPrice) : null,
      shortDesc: safeStr(product.shortDesc),
      isDigital: Boolean(product.isDigital),
      pdfUrl: safeStr(product.pdfUrl),
      isActive: Boolean(product.isActive),

      availability: safeStr(product.availability),
      rawAvailability: safeStr(product.rawAvailability),
      canPurchase: Boolean(product.canPurchase),

      deliverWithinMinutes: Math.max(1, safeNum(product.deliverWithinMinutesResolved, 20)),
      onDemandNote: safeStr(product.onDemandNoteResolved),

      rawDeliverWithinMinutes: Math.max(1, safeNum(product.rawDeliverWithinMinutes, 20)),
      rawOnDemandNote: safeStr(product.rawOnDemandNote),

      onDemandTimingSource: safeStr(product.onDemandTimingSource),
      onDemandMatchedCourseCode: safeStr(product.onDemandMatchedCourseCode),
      onDemandMatchedRuleId: safeStr(product.onDemandMatchedRuleId),
      onDemandMatchedRuleType: safeStr(product.onDemandMatchedRuleType),

      images: Array.isArray(product.images)
        ? [...product.images].map((item: any) => safeStr(item))
        : [],
      thumbUrl: safeStr(product.thumbUrl),
      quickUrl: safeStr(product.quickUrl),
      thumbnailUrl: safeStr(product.thumbnailUrl),
    }));

    const meta: Meta = {
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      limit,
    };

    return { products, meta };
  } catch {
    return {
      products: [],
      meta: {
        total: 0,
        page,
        totalPages: 1,
        limit,
      },
    };
  }
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = (await searchParams) || {};

  const category = safeStr(sp.category);
  const course = safeStr(sp.course);
  const session = safeStr(sp.session);
  const language = safeStr(sp.language);
  const search = safeStr(sp.search);
  const page = safeStr(sp.page);

  const hasNonCanonicalParams = Boolean(
    category || course || session || language || search || (page && page !== "1")
  );

  const baseTitle = "Projects";
  const parts = [course, session, language].filter(Boolean);
  const dynamicTitle = parts.length
    ? `${baseTitle} - ${parts.join(" - ")}`
    : "IGNOU Projects and Synopsis";

  const description = hasNonCanonicalParams
    ? `Browse IGNOU project and synopsis material${course ? ` for ${course}` : ""}${
        session ? ` (${session})` : ""
      }${language ? ` in ${language}` : ""}${search ? ` matching "${search}"` : ""}.`
    : "Browse IGNOU project reports and synopsis materials by title, subject code, course, session, and medium. Find project-related study material quickly.";

  return {
    metadataBase: new URL(BASE_URL),
    title: dynamicTitle,
    description,
    alternates: {
      canonical: PAGE_URL,
    },
    robots: hasNonCanonicalParams
      ? {
          index: false,
          follow: true,
          googleBot: {
            index: false,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
    openGraph: {
      type: "website",
      url: PAGE_URL,
      siteName: "IGNOU Students Portal",
      title: `${dynamicTitle} | IGNOU Students Portal`,
      description,
      images: [
        {
          url: "/og.jpg",
          width: 1200,
          height: 630,
          alt: "IGNOU Projects - IGNOU Students Portal",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${dynamicTitle} | IGNOU Students Portal`,
      description,
      images: ["/og.jpg"],
    },
  };
}

export default async function Page({ searchParams }: PageProps) {
  const sp = (await searchParams) || {};

  const initialCourseParam = typeof sp.course === "string" ? sp.course : "";
  const initialSessionParam = typeof sp.session === "string" ? sp.session : "";
  const initialLanguageParam = typeof sp.language === "string" ? sp.language : "";
  const initialSearchParam = typeof sp.search === "string" ? sp.search : "";
  const initialPageParam = typeof sp.page === "string" ? sp.page : "1";

  const pageNum = Math.max(1, Number(initialPageParam || "1") || 1);

  const { products, meta } = await getInitialProjectsData({
    course: initialCourseParam,
    session: initialSessionParam,
    language: initialLanguageParam,
    search: initialSearchParam,
    page: pageNum,
  });

  const initialQueryKey = buildProjectsQueryKey({
    course: initialCourseParam,
    session: initialSessionParam,
    language: initialLanguageParam,
    search: initialSearchParam,
    page: pageNum,
  });

  return (
    <>
      <Suspense fallback={<div className="p-6">Loading...</div>}>
        <ProjectsClient
          initialCourseParam={initialCourseParam}
          initialSessionParam={initialSessionParam}
          initialLanguageParam={initialLanguageParam}
          initialSearchParam={initialSearchParam}
          initialPageParam={String(pageNum)}
          initialProducts={products}
          initialMeta={meta}
          initialQueryKey={initialQueryKey}
        />
      </Suspense>

      <section className="bg-white px-4 pb-10">
        <div className="mx-auto max-w-[1600px]">
          <SeoPaginationLinks
            basePath={PAGE_PATH}
            currentPage={meta.page}
            totalPages={meta.totalPages}
            searchParams={{
              course: initialCourseParam,
              session: initialSessionParam,
              language: initialLanguageParam,
              search: initialSearchParam,
            }}
            label="Projects pagination"
          />
        </div>
      </section>
    </>
  );
}