import Link from "next/link";

type SeoPaginationLinksProps = {
  basePath: string;
  currentPage?: number;
  totalPages?: number;
  searchParams?: Record<string, string | string[] | number | null | undefined>;
  label?: string;
};

function safeNumber(value: unknown, fallback = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(1, Math.trunc(n)) : fallback;
}

function safeString(value: unknown) {
  return String(value ?? "").trim();
}

function appendParam(params: URLSearchParams, key: string, value: unknown) {
  if (value === undefined || value === null) return;

  if (Array.isArray(value)) {
    const cleaned = value.map((item) => safeString(item)).filter(Boolean);
    if (cleaned.length) params.set(key, cleaned.join(","));
    return;
  }

  const cleaned = safeString(value);
  if (!cleaned) return;

  params.set(key, cleaned);
}

function buildHref(
  basePath: string,
  page: number,
  searchParams?: SeoPaginationLinksProps["searchParams"]
) {
  const cleanBasePath = safeString(basePath) || "/";
  const params = new URLSearchParams();

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (key === "page") return;
      appendParam(params, key, value);
    });
  }

  if (page > 1) {
    params.set("page", String(page));
  } else {
    params.delete("page");
  }

  const query = params.toString();
  return query ? `${cleanBasePath}?${query}` : cleanBasePath;
}

function buildPageWindow(currentPage: number, totalPages: number) {
  const pages = new Set<number>();

  pages.add(1);
  pages.add(totalPages);

  for (let page = currentPage - 3; page <= currentPage + 3; page += 1) {
    if (page >= 1 && page <= totalPages) pages.add(page);
  }

  if (currentPage <= 4) {
    for (let page = 1; page <= Math.min(8, totalPages); page += 1) {
      pages.add(page);
    }
  }

  if (currentPage >= totalPages - 3) {
    for (let page = Math.max(1, totalPages - 7); page <= totalPages; page += 1) {
      pages.add(page);
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
}

export default function SeoPaginationLinks({
  basePath,
  currentPage = 1,
  totalPages = 1,
  searchParams,
  label = "Pagination",
}: SeoPaginationLinksProps) {
  const current = safeNumber(currentPage, 1);
  const total = safeNumber(totalPages, 1);

  if (total <= 1) return null;

  const visiblePages = buildPageWindow(current, total);
  const previousPage = current > 1 ? current - 1 : null;
  const nextPage = current < total ? current + 1 : null;

  return (
    <nav
      aria-label={label}
      className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="mb-3 text-sm font-extrabold text-slate-800">
        Browse more pages
      </div>

      <div className="flex flex-wrap gap-2">
        {previousPage ? (
          <Link
            href={buildHref(basePath, previousPage, searchParams)}
            rel="prev"
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          >
            Previous
          </Link>
        ) : null}

        {visiblePages.map((page) => (
          <Link
            key={page}
            href={buildHref(basePath, page, searchParams)}
            aria-current={page === current ? "page" : undefined}
            className={
              page === current
                ? "rounded-xl border border-blue-600 bg-blue-600 px-3 py-2 text-xs font-extrabold text-white"
                : "rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            }
          >
            {page}
          </Link>
        ))}

        {nextPage ? (
          <Link
            href={buildHref(basePath, nextPage, searchParams)}
            rel="next"
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          >
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}