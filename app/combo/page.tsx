import type { Metadata } from "next";
import Link from "next/link";
import ComboPageClient from "./ComboPageClient";

const BASE_URL = "https://istudentsportal.com";
const CANONICAL_PATH = "/combo";
const CANONICAL_URL = `${BASE_URL}${CANONICAL_PATH}`;

type SearchParams = Record<string, string | string[] | undefined>;

const COMBO_CATEGORIES = [
  {
    title: "Solved Assignments Combo Packs",
    href: "/combo/solved-assignments",
    description:
      "Browse IGNOU solved assignment combo packs for different courses, sessions, and mediums.",
    label: "Assignments",
  },
  {
    title: "Question Papers Combo Packs",
    href: "/combo/question-papers",
    description:
      "Find IGNOU previous year question paper combo packs for exam preparation and quick revision.",
    label: "PYQ",
  },
  {
    title: "Guess Papers Combo Packs",
    href: "/combo/guess-papers",
    description:
      "Explore IGNOU guess paper combo packs for focused exam preparation and subject-wise study.",
    label: "Guess Papers",
  },
  {
    title: "Handwritten PDFs Combo Packs",
    href: "/combo/handwritten-pdfs",
    description:
      "Browse digital handwritten PDF combo packs for IGNOU study material and assignments.",
    label: "PDF",
  },
  {
    title: "Handwritten Hardcopy Combo Packs",
    href: "/combo/handwritten-hardcopy",
    description:
      "Explore handwritten hardcopy delivery combo packs with physical material delivery support.",
    label: "Hardcopy",
  },
  {
    title: "Ebooks and Notes Combo Packs",
    href: "/combo/ebooks-notes",
    description:
      "Find IGNOU ebooks and notes combo packs for organized digital study material access.",
    label: "Ebooks",
  },
];

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function hasUsefulSearchParams(searchParams?: SearchParams | null) {
  if (!searchParams) return false;

  return Object.entries(searchParams).some(([key, value]) => {
    const cleanKey = safeStr(key);
    if (!cleanKey) return false;

    if (Array.isArray(value)) {
      return value.some((item) => safeStr(item));
    }

    return Boolean(safeStr(value));
  });
}

async function resolveSearchParams(
  searchParams?: Promise<SearchParams> | SearchParams
) {
  if (searchParams && typeof (searchParams as any).then === "function") {
    return await searchParams;
  }

  return (searchParams || {}) as SearchParams;
}

function ComboSeoCategoryLinks() {
  return (
    <section className="bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black text-slate-900">
            Browse IGNOU Combo Categories
          </h2>
          <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-slate-600">
            Select a combo category to explore IGNOU solved assignments, previous year
            question papers, guess papers, handwritten PDFs, hardcopy bundles, ebooks,
            and notes combo packs.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {COMBO_CATEGORIES.map((category) => (
            <Link
              key={category.href}
              href={category.href}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg"
            >
              <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">
                {category.label}
              </div>

              <h3 className="mt-3 text-lg font-black leading-7 text-slate-900 group-hover:text-blue-700">
                {category.title}
              </h3>

              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                {category.description}
              </p>

              <div className="mt-4 text-sm font-black text-blue-700">
                View Combo Packs →
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}): Promise<Metadata> {
  const sp = await resolveSearchParams(searchParams);
  const hasFilters = hasUsefulSearchParams(sp);

  const title = "IGNOU Combo Packs";
  const description =
    "Browse IGNOU combo packs for solved assignments, PYQs, guess papers, handwritten PDFs, hardcopy delivery, ebooks and notes.";

  return {
    metadataBase: new URL(BASE_URL),
    title,
    description,
    alternates: {
      canonical: CANONICAL_URL,
    },
    robots: hasFilters
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
      url: CANONICAL_URL,
      siteName: "IGNOU Students Portal",
      title: `${title} | IGNOU Students Portal`,
      description,
      images: [
        {
          url: "/og.jpg",
          width: 1200,
          height: 630,
          alt: "IGNOU Combo Packs - IGNOU Students Portal",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | IGNOU Students Portal`,
      description,
      images: ["/og.jpg"],
    },
  };
}

export default function ComboPage() {
  return (
    <>
      <ComboPageClient />
      <ComboSeoCategoryLinks />
    </>
  );
}