// app/combo/[category]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ComboCategoryClient from "./ComboCategoryClient";
import SeoPaginationLinks from "@/components/seo/SeoPaginationLinks";

import dbConnect from "@/lib/db";
import Combo from "@/models/Combo";

const BASE_URL = "https://istudentsportal.com";
const ITEMS_PER_PAGE = 20;

const CATEGORY_CONFIGS: Record<
  string,
  {
    title: string;
    description: string;
    indexable: boolean;
  }
> = {
  "solved-assignments": {
    title: "IGNOU Solved Assignments Combo Packs",
    description:
      "Browse IGNOU solved assignment combo packs with category-wise bundles, easier comparison, and faster access to study material.",
    indexable: true,
  },
  "question-papers": {
    title: "IGNOU PYQ Combo Packs",
    description:
      "Explore IGNOU previous year question paper combo packs for exam preparation, session-wise revision, and faster PYQ discovery.",
    indexable: true,
  },
  "guess-papers": {
    title: "IGNOU Guess Papers Combo Packs",
    description:
      "Browse IGNOU guess paper combo packs designed for focused exam preparation, revision support, and quick subject-wise selection.",
    indexable: true,
  },
  "ebooks-notes": {
    title: "IGNOU Ebooks and Notes Combo Packs",
    description:
      "Explore IGNOU ebooks and notes combo packs with digital study material bundles in one organized section.",
    indexable: true,
  },
  "handwritten-pdfs": {
    title: "IGNOU Handwritten PDF Combo Packs",
    description:
      "Browse IGNOU handwritten PDF combo packs for digital handwritten study material bundles and easy category-wise selection.",
    indexable: true,
  },
  "handwritten-hardcopy": {
    title: "IGNOU Handwritten Hardcopy Delivery Combo Packs",
    description:
      "Explore IGNOU handwritten hardcopy delivery combo packs with physical bundle options and delivery-focused browsing.",
    indexable: true,
  },
  "projects-synopsis": {
    title: "IGNOU Project and Synopsis Combo Packs",
    description:
      "IGNOU project and synopsis combo section. This category is currently unavailable.",
    indexable: false,
  },
};

type Params = {
  category?: string;
};

type SearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  params: Promise<Params> | Params;
  searchParams?: Promise<SearchParams> | SearchParams;
};

type SeoComboItem = {
  id: string;
  title: string;
  slug: string;
  description: string;
  priceLabel: string;
  saveLabel: string;
  mediumLabel: string;
  sessionLabel: string;
  itemsLabel: string;
  updatedAt?: Date;
  createdAt?: Date;
};

function safeText(value: unknown) {
  return String(value ?? "").trim();
}

function safeNumber(value: unknown, fallback = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function escapeRegex(value: string) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return safeText(value[0]);
  return safeText(value);
}

function pageFromSearchParams(searchParams?: SearchParams | null) {
  const pageValue = firstString(searchParams?.page);
  return Math.max(1, Math.trunc(safeNumber(pageValue, 1)));
}

async function resolveParams(params: Promise<Params> | Params) {
  if (params && typeof (params as any).then === "function") {
    return await params;
  }

  return params as Params;
}

async function resolveSearchParams(searchParams?: Promise<SearchParams> | SearchParams) {
  if (searchParams && typeof (searchParams as any).then === "function") {
    return await searchParams;
  }

  return (searchParams || {}) as SearchParams;
}

function hasUsefulSearchParams(searchParams?: SearchParams | null) {
  if (!searchParams) return false;

  return Object.entries(searchParams).some(([key, value]) => {
    const cleanKey = safeText(key);
    if (!cleanKey) return false;

    if (cleanKey === "page") {
      const pageValue = firstString(value);
      return Boolean(pageValue && pageValue !== "1");
    }

    if (Array.isArray(value)) {
      return value.some((item) => safeText(item));
    }

    return !!safeText(value);
  });
}

function getCategoryConfig(category: string) {
  return CATEGORY_CONFIGS[category] || null;
}

function comboBaseFilter(category: string) {
  return {
    categorySlug: category,
    isActive: true,
    status: "active",
    slug: { $exists: true, $ne: "" },
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  };
}

function searchFilter(search: string) {
  const q = safeText(search);

  if (q.length < 2) return {};

  const regex = new RegExp(escapeRegex(q), "i");

  return {
    $and: [
      {
        $or: [
          { title: regex },
          { shortTitle: regex },
          { description: regex },
          { shortDescription: regex },
          { subjectCode: regex },
          { medium: regex },
          { mediumLabel: regex },
          { sessionLabel: regex },
          { sessionRangeLabel: regex },
          { courseCodes: regex },
          { metaTitle: regex },
          { metaDescription: regex },
          { generationKey: regex },
          { generationGroupKey: regex },
        ],
      },
    ],
  };
}

function formatPriceLabel(combo: any) {
  const explicit = safeText(combo?.priceLabel);
  if (explicit) return explicit;

  const price = Number(combo?.offerPrice || 0);
  if (price > 0) return `₹${price}`;

  return "";
}

function formatSaveLabel(combo: any) {
  const explicit = safeText(combo?.saveLabel);
  if (explicit) return explicit;

  const percent = Number(combo?.savePercent || 0);
  if (percent > 0) return `Save ${percent}%`;

  const amount = Number(combo?.saveAmount || 0);
  if (amount > 0) return `Save ₹${amount}`;

  return "";
}

async function getSeoCombos(input: {
  category: string;
  search: string;
  page: number;
}) {
  const category = safeText(input.category);
  const search = safeText(input.search);
  const page = Math.max(1, Math.trunc(safeNumber(input.page, 1)));
  const skip = (page - 1) * ITEMS_PER_PAGE;

  const config = getCategoryConfig(category);

  if (!config || !config.indexable) {
    return {
      combos: [] as SeoComboItem[],
      total: 0,
      page,
      totalPages: 1,
    };
  }

  await dbConnect();

  const filter = {
    ...comboBaseFilter(category),
    ...searchFilter(search),
  };

  const [rawCombos, total] = await Promise.all([
    Combo.find(filter)
      .select(
        "title shortTitle slug description shortDescription priceLabel saveLabel offerPrice savePercent saveAmount mediumLabel medium sessionLabel sessionRangeLabel itemsLabel updatedAt createdAt"
      )
      .sort({ sortOrder: 1, createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(ITEMS_PER_PAGE)
      .lean(),
    Combo.countDocuments(filter),
  ]);

  const combos: SeoComboItem[] = (rawCombos || [])
    .map((combo: any) => {
      const title = safeText(combo?.title || combo?.shortTitle);
      const slug = safeText(combo?.slug);

      if (!title || !slug) return null;

      return {
        id: String(combo?._id || slug),
        title,
        slug,
        description: safeText(combo?.description || combo?.shortDescription),
        priceLabel: formatPriceLabel(combo),
        saveLabel: formatSaveLabel(combo),
        mediumLabel: safeText(combo?.mediumLabel || combo?.medium),
        sessionLabel: safeText(combo?.sessionLabel || combo?.sessionRangeLabel),
        itemsLabel: safeText(combo?.itemsLabel || "Combo Pack"),
        updatedAt: combo?.updatedAt,
        createdAt: combo?.createdAt,
      };
    })
    .filter(Boolean) as SeoComboItem[];

  return {
    combos,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)),
  };
}

function SeoComboDirectory({
  category,
  configTitle,
  search,
  combos,
  page,
  totalPages,
}: {
  category: string;
  configTitle: string;
  search: string;
  combos: SeoComboItem[];
  page: number;
  totalPages: number;
}) {
  if (!combos.length && totalPages <= 1) return null;

  const basePath = `/combo/${category}`;

  return (
    <section className="bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-slate-900">
            Browse {configTitle}
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
            These crawlable combo links help students and search engines discover
            individual combo pack pages directly.
          </p>
        </div>

        {combos.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {combos.map((combo) => (
              <Link
                key={combo.id}
                href={`${basePath}/${combo.slug}`}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg"
              >
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">
                  {combo.itemsLabel || "Combo Pack"}
                </div>

                <h3 className="mt-2 line-clamp-2 text-base font-black leading-6 text-slate-900">
                  {combo.title}
                </h3>

                {combo.description ? (
                  <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-slate-600">
                    {combo.description}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-extrabold">
                  {combo.priceLabel ? (
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                      {combo.priceLabel}
                    </span>
                  ) : null}

                  {combo.saveLabel ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                      {combo.saveLabel}
                    </span>
                  ) : null}

                  {combo.mediumLabel ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                      {combo.mediumLabel}
                    </span>
                  ) : null}

                  {combo.sessionLabel ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                      {combo.sessionLabel}
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        ) : null}

        <SeoPaginationLinks
          basePath={basePath}
          currentPage={page}
          totalPages={totalPages}
          searchParams={{
            search,
          }}
          label={`${configTitle} pagination`}
        />
      </div>
    </section>
  );
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const p = await resolveParams(params);
  const sp = await resolveSearchParams(searchParams);

  const category = safeText(p?.category);
  const config = getCategoryConfig(category);

  if (!config) {
    return {
      title: "Combo Category Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const canonicalPath = `/combo/${category}`;
  const canonicalUrl = `${BASE_URL}${canonicalPath}`;
  const hasFilters = hasUsefulSearchParams(sp);
  const shouldIndex = config.indexable && !hasFilters;

  return {
    metadataBase: new URL(BASE_URL),
    title: `${config.title} | IGNOU Students Portal`,
    description: config.description,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: shouldIndex
      ? {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        }
      : {
          index: false,
          follow: true,
          googleBot: {
            index: false,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
    openGraph: {
      type: "website",
      url: canonicalUrl,
      siteName: "IGNOU Students Portal",
      title: config.title,
      description: config.description,
      images: [
        {
          url: "/og.jpg",
          width: 1200,
          height: 630,
          alt: config.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: config.title,
      description: config.description,
      images: ["/og.jpg"],
    },
  };
}

export default async function Page({ params, searchParams }: PageProps) {
  const p = await resolveParams(params);
  const sp = await resolveSearchParams(searchParams);

  const category = safeText(p?.category);
  const config = getCategoryConfig(category);

  if (!config) {
    notFound();
  }

  const search = firstString(sp?.search);
  const page = pageFromSearchParams(sp);

  const seoData = await getSeoCombos({
    category,
    search,
    page,
  });

  return (
    <>
      <ComboCategoryClient
        categorySlug={category}
        initialSearchParam={search}
      />

      <SeoComboDirectory
        category={category}
        configTitle={config.title}
        search={search}
        combos={seoData.combos}
        page={seoData.page}
        totalPages={seoData.totalPages}
      />
    </>
  );
}