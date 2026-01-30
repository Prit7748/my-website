"use client";
import React from "react";

export default function SortBar() {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center mb-8 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
      <p className="text-[14px] text-gray-600 font-medium">Showing 1 - 12 of 3645 results</p>
      <div className="flex items-center gap-3">
        <span className="text-[14px] text-gray-500 font-medium">Sort by:</span>
        <select className="border border-gray-300 rounded py-1.5 px-3 text-sm outline-none cursor-pointer hover:border-blue-500">
            <option>Newest First</option>
            <option>Price: Low to High</option>
            <option>Price: High to Low</option>
        </select>
      </div>
    </div>
  );
}