"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Boxes,
  IndianRupee,
  Languages,
  CalendarClock,
  Tag,
  Truck,
  FileText,
  Layers3,
  BookOpen,
  Hash,
} from "lucide-react";
import {
  formatLanguageLabel,
  formatPyqUiText,
  formatSessionLabel,
  formatSubjectCodesLabel,
} from "@/lib/pyqUiFormat";

export type ComboBundleItem = {
  title: string;
  subtitle?: string;
  thumbnailUrl?: string;
  slug?: string;
  courseCodes?: string[];
};

export type ComboBundleCardData = {
  id?: string;
  slug?: string;
  categorySlug?: string;
  title: string;
  description: string;
  badge: string;
  itemsLabel: string;
  priceLabel?: string;
  saveLabel?: string;
  mediumLabel?: string;
  sessionLabel?: string;
  subjectCodesLabel?: string;
  courseCodesLabel?: string;
  variant?: "default" | "pyq" | "hardcopy";
  accentClass?: string;
  thumbnailUrl?: string;
  items?: ComboBundleItem[];
};

function toneForVariant(variant: "default" | "pyq" | "hardcopy" = "default") {
  if (variant === "pyq") {
    return {
      badgeClass: "bg-emerald-600 text-white",
      icon: <FileText size={12} />,
      typeLabel: "PYQ Combo",
    };
  }

  if (variant === "hardcopy") {
    return {
      badgeClass: "bg-orange-600 text-white",
      icon: <Truck size={12} />,
      typeLabel: "Hardcopy Combo",
    };
  }

  return {
    badgeClass: "bg-blue-600 text-white",
    icon: <Layers3 size={12} />,
    typeLabel: "Combo Pack",
  };
}

function safeText(x: any) {
  return String(x ?? "").trim();
}

function getVisualItems(items?: ComboBundleItem[], max = 6) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      title: safeText(item?.title),
      thumbnailUrl: safeText(item?.thumbnailUrl),
    }))
    .filter((item) => item.title || item.thumbnailUrl)
    .slice(0, max);
}

function DynamicThumbCollage({ data }: { data: ComboBundleCardData }) {
  const visualItems = getVisualItems(data.items, 6);
  const isPyq = data.variant === "pyq";

  if (safeText(data.thumbnailUrl) && (isPyq || visualItems.length === 0)) {
    return (
      <div className="relative h-[460px] sm:h-[420px] xl:h-[500px] w-full overflow-hidden rounded-[22px] bg-white">
        <Image
          src={safeText(data.thumbnailUrl)}
          alt={data.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
          className="object-cover scale-110 blur-2xl opacity-20"
          priority={false}
        />

        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/5 to-white/20" />

        <div className="absolute inset-0 p-2 sm:p-3">
          <div className="relative h-full w-full overflow-hidden rounded-[18px]">
            <Image
              src={safeText(data.thumbnailUrl)}
              alt={data.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
              className="object-cover object-center"
              priority={false}
            />
          </div>
        </div>
      </div>
    );
  }

  const gridCols =
    visualItems.length <= 1
      ? "grid-cols-1"
      : visualItems.length === 2
      ? "grid-cols-2"
      : "grid-cols-2";
  const cardHeight = "h-[460px] sm:h-[420px] xl:h-[500px]";

  return (
    <div
      className={`relative ${cardHeight} w-full overflow-hidden rounded-[22px] bg-white`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50 to-slate-100" />
      <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.08)_1px,transparent_0)] bg-[length:18px_18px]" />

      <div className="relative h-full w-full p-2 sm:p-3">
        <div
          className={`grid h-full w-full ${gridCols} gap-2 rounded-[18px]`}
          style={{
            gridTemplateRows:
              visualItems.length <= 2
                ? "1fr"
                : visualItems.length <= 4
                ? "1fr 1fr"
                : "1fr 1fr 1fr",
          }}
        >
          {visualItems.map((item, idx) => (
            <div
              key={`${item.title || "item"}-${idx}`}
              className="relative overflow-hidden rounded-[16px] border border-white/80 bg-white shadow-sm"
            >
              {safeText(item.thumbnailUrl) ? (
                <Image
                  src={safeText(item.thumbnailUrl)}
                  alt={item.title || `Combo item ${idx + 1}`}
                  fill
                  sizes="(max-width: 640px) 50vw, 20vw"
                  className="object-cover object-center"
                  priority={false}
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200" />
              )}

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/75 via-slate-950/25 to-transparent p-2">
                <div className="line-clamp-2 text-[10px] leading-4 font-extrabold text-white drop-shadow">
                  {item.title || `Included Item ${idx + 1}`}
                </div>
              </div>
            </div>
          ))}

          {visualItems.length === 0 ? (
            <div className="col-span-full row-span-full rounded-[16px] border border-slate-200 bg-gradient-to-br from-slate-100 via-white to-slate-100" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MiniMeta({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
      <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wide text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 truncate text-[12px] font-extrabold text-slate-900">
        {value}
      </div>
    </div>
  );
}

function WideInfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
      <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wide text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-[12px] leading-5 font-extrabold text-slate-900 break-words">
        {value}
      </div>
    </div>
  );
}

export default function ComboBundleCard({
  data,
}: {
  data?: ComboBundleCardData;
}) {
  if (!data) return null;

  const variant = data.variant || "default";
  const tone = toneForVariant(variant);
  const isPyq = variant === "pyq";

  const displayData: ComboBundleCardData = isPyq
    ? {
        ...data,
        title: formatPyqUiText(data.title),
        description: formatPyqUiText(data.description),
        mediumLabel: formatLanguageLabel(data.mediumLabel),
        sessionLabel: formatSessionLabel(data.sessionLabel),
        subjectCodesLabel: formatSubjectCodesLabel(data.subjectCodesLabel),
        items: (Array.isArray(data.items) ? data.items : []).map((item) => ({
          ...item,
          title: formatPyqUiText(item?.title),
          subtitle: formatPyqUiText(item?.subtitle),
        })),
      }
    : data;

  const cardInner = (
    <div className="group flex h-full flex-col overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div
        className={`relative overflow-hidden border-b border-gray-100 ${
          displayData.accentClass ||
          "bg-gradient-to-br from-blue-100 via-indigo-50 to-cyan-50"
        }`}
      >
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.88)_1px,transparent_0)] bg-[length:18px_18px]" />

        <div className="relative px-3 pt-3 pb-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 text-white px-2.5 py-1 text-[10px] font-extrabold shadow">
              {tone.icon}
              {tone.typeLabel}
            </span>

            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold shadow ${tone.badgeClass}`}
            >
              {displayData.badge}
            </span>
          </div>

          <DynamicThumbCollage data={displayData} />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="text-[15px] leading-5 font-extrabold text-slate-900 transition group-hover:text-blue-700 line-clamp-2">
          {displayData.title}
        </h3>

        {displayData.description ? (
          <p className="mt-2 text-[11px] leading-5 font-semibold text-slate-600 line-clamp-2">
            {displayData.description}
          </p>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wide text-emerald-700">
              <IndianRupee size={10} />
              Price
            </div>
            <div className="mt-1 text-[18px] font-extrabold text-slate-900">
              {displayData.priceLabel || "Coming Soon"}
            </div>
          </div>

          <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5">
            <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wide text-orange-700">
              <Tag size={10} />
              Savings
            </div>
            <div className="mt-1 text-[18px] font-extrabold text-slate-900">
              {displayData.saveLabel || "Bundle Offer"}
            </div>
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <MiniMeta
            label="Medium"
            value={displayData.mediumLabel || "Available Medium"}
            icon={<Languages size={10} />}
          />
          <MiniMeta
            label="Session"
            value={displayData.sessionLabel || "Latest Available"}
            icon={<CalendarClock size={10} />}
          />
        </div>

        {safeText(displayData.subjectCodesLabel) ? (
          <div className="mt-2.5">
            <WideInfoRow
              label="Subject Codes"
              value={safeText(displayData.subjectCodesLabel)}
              icon={<Hash size={10} />}
            />
          </div>
        ) : null}

        {safeText(displayData.courseCodesLabel) ? (
          <div className="mt-2.5">
            <WideInfoRow
              label="Course Codes"
              value={safeText(displayData.courseCodesLabel)}
              icon={<BookOpen size={10} />}
            />
          </div>
        ) : null}
      </div>
    </div>
  );

  if (displayData.slug && displayData.categorySlug) {
    return (
      <Link
        href={`/combo/${encodeURIComponent(
          displayData.categorySlug
        )}/${encodeURIComponent(displayData.slug)}`}
        className="block h-full"
      >
        {cardInner}
      </Link>
    );
  }

  return cardInner;
}