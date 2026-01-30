"use client";
import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination() {
  return (
    // Point 5: Custom Pagination Style (1-10 ... Last 3)
    <div className="mt-12 flex justify-center items-center gap-1 md:gap-2 flex-wrap">
      
      {/* Prev */}
      <button className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center border rounded hover:bg-gray-50 text-gray-600"><ChevronLeft size={16}/></button>
      
      {/* First 10 Pages */}
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
          <button 
            key={num} 
            className={`w-8 h-8 md:w-9 md:h-9 rounded text-xs md:text-sm font-bold transition-colors ${num === 1 ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            {num}
          </button>
      ))}

      {/* Dots */}
      <span className="px-1 text-gray-400 font-bold tracking-widest">...</span>

      {/* Last 3 Pages (Assuming total 100 for example) */}
      {[98, 99, 100].map((num) => (
          <button 
            key={num} 
            className="w-8 h-8 md:w-9 md:h-9 rounded text-xs md:text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {num}
          </button>
      ))}

      {/* Next */}
      <button className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center border rounded hover:bg-gray-50 text-gray-600"><ChevronRight size={16}/></button>
    </div>
  );
}