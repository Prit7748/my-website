"use client";
import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export default function Pagination({
  page = 1,
  totalPages = 1,
}: {
  page?: number;
  totalPages?: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const current = Math.max(1, Number(page || 1));
  const total = Math.max(1, Number(totalPages || 1));

  const go = (p: number) => {
    const next = Math.min(total, Math.max(1, p));
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(next));
    router.replace(`/solved-assignments?${params.toString()}`);
  };

  const pages = useMemo(() => {
    // show: 1 ... (current-1 current current+1) ... last
    const set = new Set<number>();
    set.add(1);
    set.add(total);
    set.add(current);
    set.add(current - 1);
    set.add(current + 1);

    const arr = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);

    const out: (number | "...")[] = [];
    for (let i = 0; i < arr.length; i++) {
      const n = arr[i];
      const prev = arr[i - 1];
      if (i > 0 && n - prev > 1) out.push("...");
      out.push(n);
    }
    return out;
  }, [current, total]);

  if (total <= 1) return null;

  return (
    <div className="mt-12 flex justify-center items-center gap-1 md:gap-2 flex-wrap">
      <button
        onClick={() => go(current - 1)}
        disabled={current <= 1}
        className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center border rounded hover:bg-gray-50 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronLeft size={16} />
      </button>

      {pages.map((item, idx) =>
        item === "..." ? (
          <span key={`d-${idx}`} className="px-2 text-gray-400 font-bold">
            ...
          </span>
        ) : (
          <button
            key={item}
            onClick={() => go(item)}
            className={`w-8 h-8 md:w-9 md:h-9 rounded text-xs md:text-sm font-bold transition-colors ${
              item === current
                ? "bg-blue-600 text-white shadow-md"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {item}
          </button>
        )
      )}

      <button
        onClick={() => go(current + 1)}
        disabled={current >= total}
        className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center border rounded hover:bg-gray-50 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
