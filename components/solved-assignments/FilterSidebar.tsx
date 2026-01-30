"use client";
import { useState } from "react";
import { X, Search } from "lucide-react";

interface FilterSidebarProps {
  className?: string;
  closeFilter?: () => void;
  selectedCat: string[];
  onToggleCategory: (cat: string) => void;
}

export default function FilterSidebar({ className = "", closeFilter, selectedCat, onToggleCategory }: FilterSidebarProps) {
  const [courseSearch, setCourseSearch] = useState("");

  const categories = [
    "Solved Assignments",
    "Handwritten PDFs",
    "Hardcopy Delivery",
    "Project & Synopsis",
    "Question Papers (PYQs)",
    "eBooks/Notes",
    "Guess Paper",
    "Combo"
  ];

  // --- SORTING LOGIC (Selected Item Always Top) ---
  const sortedCategories = [...categories].sort((a, b) => {
    const isASelected = selectedCat.includes(a);
    const isBSelected = selectedCat.includes(b);
    return isASelected === isBSelected ? 0 : isASelected ? -1 : 1;
  });

  const allCourses = ["BAG", "BSC", "BLIS", "BCOM", "B.Ed", "BCA", "MAH", "MCOM", "MEG", "BBA", "BSW", "MPS", "MSO", "MARD"];
  const filteredCourses = allCourses.filter(c => c.toLowerCase().includes(courseSearch.toLowerCase()));
  const sessions = ["NEW EDITION", "JUNE 2025", "JUNE 2024", "JUNE 2023", "JUNE 2022"];

  return (
    <aside className={`bg-white flex flex-col h-full ${className}`}>
      <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 h-full">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
            <h3 className="font-bold text-[20px] text-gray-900">Filters</h3>
            {closeFilter && (
                <button onClick={closeFilter} className="p-2 bg-gray-100 rounded-full hover:bg-red-50 text-gray-500 hover:text-red-600 transition">
                    <X size={20} />
                </button>
            )}
        </div>

        {/* 1. Search Keyword */}
        <div className="mb-6">
          <label className="text-[13px] font-bold text-gray-600 block mb-2 uppercase tracking-wide">Search Keyword</label>
          <div className="relative">
             <input type="text" placeholder="Search..." className="w-full text-sm border border-gray-200 rounded px-3 py-2.5 pl-9 outline-none focus:border-blue-500 transition"/>
             <Search size={18} className="absolute left-3 top-3 text-gray-400"/>
          </div>
        </div>

        {/* 2. Category (FORCE SCROLL WITH INLINE STYLE) */}
        <div className="mb-6">
          <label className="text-[13px] font-bold text-gray-600 block mb-2 uppercase tracking-wide">Category</label>
          
          {/* 👇 यहाँ मैंने Direct Style लगाया है, यह 100% काम करेगा */}
          <div 
            className="space-y-1 pr-1 border border-gray-50 rounded p-1"
            style={{ maxHeight: '220px', overflowY: 'auto' }}
          >
             {sortedCategories.map((cat, i) => (
                <label key={i} className={`flex items-center gap-3 cursor-pointer group select-none p-2 rounded-lg transition-all duration-200 border ${selectedCat.includes(cat) ? 'bg-blue-50 border-blue-100 sticky top-0 z-10 shadow-sm' : 'border-transparent hover:bg-gray-50'}`}>
                   <div className="relative flex items-center">
                      <input 
                        type="checkbox" 
                        checked={selectedCat.includes(cat)} 
                        onChange={() => onToggleCategory(cat)} 
                        className="peer w-5 h-5 border-gray-300 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                   </div>
                   <span className={`text-[14px] font-medium transition leading-snug ${selectedCat.includes(cat) ? 'text-blue-700 font-bold' : 'text-gray-700 group-hover:text-blue-700'}`}>
                      {cat}
                   </span>
                </label>
             ))}
          </div>
        </div>

        {/* 3. Course */}
        <div className="mb-6">
          <label className="text-[13px] font-bold text-gray-600 block mb-2 uppercase tracking-wide">Course</label>
          <div className="relative mb-2">
             <input type="text" placeholder="Find course..." value={courseSearch} onChange={(e) => setCourseSearch(e.target.value)} className="w-full text-xs border border-gray-300 rounded px-2 py-2 outline-none focus:border-blue-500"/>
          </div>
          {/* Direct Style Here too */}
          <div className="space-y-1 pr-1 border border-gray-50 rounded p-1" style={{ maxHeight: '160px', overflowY: 'auto' }}>
             {filteredCourses.length > 0 ? (
                 filteredCourses.map((c, i) => (
                    <label key={i} className="flex items-center gap-2 cursor-pointer hover:bg-white p-2 rounded transition border border-transparent hover:border-gray-100 shadow-sm hover:shadow-sm">
                        <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600"/> 
                        <span className="text-[13px] text-gray-700 font-medium">{c}</span>
                    </label>
                 ))
             ) : (<p className="text-xs text-gray-400 p-2 text-center">No course found</p>)}
          </div>
        </div>

        {/* 4. Session */}
        <div className="mb-6">
          <label className="text-[13px] font-bold text-gray-600 block mb-2 uppercase tracking-wide">Session</label>
          {/* Direct Style Here too */}
          <div className="space-y-1 pr-1" style={{ maxHeight: '120px', overflowY: 'auto' }}>
             {sessions.map((s, i) => (
                <label key={i} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded transition">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600"/> 
                    <span className="text-[13px] text-gray-700">{s}</span>
                </label>
             ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-auto pt-4 border-t border-gray-100 flex gap-3">
           <button className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-bold shadow hover:bg-blue-700 transition active:scale-95">Apply</button>
           <button className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl text-sm font-bold hover:bg-gray-200 transition">Reset</button>
        </div>

      </div>
    </aside>
  );
}