"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Filter, Check } from "lucide-react";

import TopBar from "@/components/TopBar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingButtons from "@/components/FloatingButtons";

// Reuse wahi same components! (No new components needed)
import FilterSidebar from "@/components/solved-assignments/FilterSidebar";
import SortBar from "@/components/solved-assignments/SortBar";
import ProductGrid from "@/components/solved-assignments/ProductGrid";
import Pagination from "@/components/solved-assignments/Pagination";

export default function ProjectsPage() {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  // CHANGE 1: Default Selection "Project and Synopsis" kar diya
  const [selectedCat, setSelectedCat] = useState<string[]>(["eBooks/Notes"]);

  const handleToggleCategory = (cat: string) => {
    if (selectedCat.includes(cat)) setSelectedCat(selectedCat.filter(c => c !== cat));
    else setSelectedCat([...selectedCat, cat]);
  };

  const breadcrumbText = selectedCat.length > 0 
      ? selectedCat.length === 1 ? selectedCat[0] : "Multiple Filters"
      : "All Products";

  useEffect(() => {
    if (isFilterOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";
  }, [isFilterOpen]);

  return (
    <main className="min-h-screen font-sans bg-white text-slate-800">
      <TopBar />
      <Navbar />

      <div className="h-[45px] bg-gray-50 border-b border-gray-200 flex items-center">
         <div className="max-w-[1600px] mx-auto px-4 w-full text-[14px] text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis">
            <Link href="/" className="hover:text-blue-600">Home</Link> / 
            {/* CHANGE 2: Link update kiya */}
            <Link href="/projects" className="hover:text-blue-600 mx-1">Projects</Link> / 
            <span className="text-gray-900 font-medium ml-1 text-blue-700">{breadcrumbText}</span>
         </div>
      </div>

      <section className="bg-white py-10 border-b border-gray-100">
         <div className="max-w-[1600px] mx-auto px-4">
             {/* CHANGE 3: Heading & Description update ki */}
             <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">IGNOU Projects & Synopsis</h1>
             <p className="text-gray-600 text-base md:text-lg leading-relaxed max-w-4xl">
                Get 100% approval guaranteed Project Reports and Synopsis for MBA, MA, BCA, MCA and other courses.
             </p>
         </div>
      </section>

      {/* --- BAKI SAB KUCH SAME RAHEGA (Copy Paste from Solved Page) --- */}
      <section className="bg-[#fff5f6] py-10 md:py-12">
         <div className="max-w-[1600px] mx-auto px-4">
            <div className="flex flex-col lg:flex-row gap-8 items-start relative">
               
               <div className="hidden lg:block w-[360px] flex-shrink-0 self-start z-30">
                  <FilterSidebar 
                      className="border border-gray-200 rounded-xl shadow-sm" 
                      selectedCat={selectedCat} 
                      onToggleCategory={handleToggleCategory} 
                  />
               </div>

               {isFilterOpen && (
                 <div className="lg:hidden fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsFilterOpen(false)}></div>
               )}
               <div className={`lg:hidden fixed top-0 left-0 z-[1000] h-full w-[85%] max-w-[360px] bg-white shadow-2xl transition-transform duration-300 ease-out ${isFilterOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                   <FilterSidebar 
                      closeFilter={() => setIsFilterOpen(false)} 
                      selectedCat={selectedCat} 
                      onToggleCategory={handleToggleCategory}
                   />
               </div>

               <div className="flex-1 w-full min-w-0">
                  <div className="lg:hidden mb-6 sticky top-20 z-20">
                    <button 
                        onClick={() => setIsFilterOpen(true)}
                        className="w-full bg-white border border-blue-200 text-blue-700 font-bold py-4 px-5 rounded-xl shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-blue-50 text-base"
                    >
                        <Filter size={20} /> Filter & Sort Products
                    </button>
                  </div>

                  <SortBar />
                  <ProductGrid selectedCat={selectedCat} />
                  <Pagination />
               </div>

            </div>
         </div>
      </section>

      <section className="bg-white py-16 border-t border-gray-100">
         <div className="max-w-[1600px] mx-auto px-4">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Why Choose Us?</h2>
            <div className="grid md:grid-cols-2 gap-8 text-gray-600 text-base leading-relaxed">
               <ul className="space-y-3">
                  <li className="flex gap-3"><Check size={20} className="text-green-500 mt-1"/> 100% Approval Guarantee</li>
                  <li className="flex gap-3"><Check size={20} className="text-green-500 mt-1"/> Customized as per Guide</li>
               </ul>
            </div>
         </div>
      </section>

      <div className="h-[40px] bg-[#fff5f6] border-t border-gray-100"></div>
      <Footer />
      <FloatingButtons />
    </main>
  );
}