"use client";
import React, { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface SortBarProps {
  total?: number;
  page?: number;
  limit?: number;
}

export default function SortBar({
  total = 0,
  page = 1,
  limit = 24,
}: SortBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const sort = (searchParams.get("sort") || "latest").trim();

  const from = useMemo(() => {
    if (!total) return 0;
    return (page - 1) * limit + 1;
  }, [page, limit, total]);

  const to = useMemo(() => {
    if (!total) return 0;
    return Math.min(page * limit, total);
  }, [page, limit, total]);

  const setSort = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value && value !== "latest") {
      params.set("sort", value);
    } else {
      params.delete("sort");
    }

    params.delete("page"); // reset page when sorting changes

    router.replace(`/solved-assignments?${params.toString()}`);
  };

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center mb-8 bg-white p-4 rounded-lg shadow-sm border border-gray-100 gap-3">
      <p className="text-[14px] text-gray-600 font-medium">
        {total
          ? `Showing ${from} - ${to} of ${total} results`
          : "No results"}
      </p>

      <div className="flex items-center gap-3">
        <span className="text-[14px] text-gray-500 font-medium">
          Sort by:
        </span>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="border border-gray-300 rounded py-1.5 px-3 text-sm outline-none cursor-pointer hover:border-blue-500"
        >
          <option value="latest">Newest First</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
        </select>
      </div>
    </div>
  );
}
