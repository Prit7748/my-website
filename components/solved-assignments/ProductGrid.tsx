"use client";
import React, { useState } from "react";
import Image from "next/image";
// 1. Link Import kiya
import Link from "next/link"; 
import { Star, ShoppingCart, Eye, Layers } from "lucide-react"; 
import ProductQuickView from "./ProductQuickView";

interface ProductGridProps {
  selectedCat: string[];
}

export default function ProductGrid({ selectedCat }: ProductGridProps) {
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // MOCK DATA
  const allProducts = [
    { id: 1, image: "/images/cover1.jpg", title: "IGNOU PHE 16 Solved Assignment 2026-27 (Hindi)", price: 35, oldPrice: 50, category: "Solved Assignments" },
    { id: 2, image: "", title: "IGNOU History Hardcopy Notes", price: 150, oldPrice: 200, category: "Hardcopy Delivery" },
    { id: 3, image: "", title: "IGNOU English Handwritten PDF", price: 60, oldPrice: 80, category: "Handwritten PDFs" },
    { id: 4, image: "", title: "IGNOU MBA Project Synopsis", price: 500, oldPrice: 800, category: "Project and Synopsis" },
    
    // NEW COMBO PRODUCT
    { id: 13, image: "", title: "MEG-01 All PYQ (2020-2025) Super Combo", price: 99, oldPrice: 150, category: "Combos" },

    { id: 6, image: "", title: "IGNOU Political Science eBook", price: 45, oldPrice: 60, category: "eBooks/Notes" },
    // ... baki purane products
  ];

  const displayProducts = selectedCat.length === 0 
      ? allProducts 
      : allProducts.filter(product => selectedCat.includes(product.category));

  if (displayProducts.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center py-10 w-full min-h-[300px]">
              <div className="text-center mb-10">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Oops! No products found.</h3>
                  <p className="text-gray-500">Try changing the filters.</p>
              </div>
          </div>
      );
  }

  return (
    <>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
        {displayProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-xl overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-gray-100 group w-full flex flex-col relative">
            
            {/* IMAGE SECTION */}
            <div className="aspect-[210/297] bg-gray-100 relative overflow-hidden border-b border-gray-50 group-hover:opacity-95 transition-opacity">
                
                {/* 2. Link Added around Image Logic */}
                <Link href={`/product/${product.id}`} className="block w-full h-full">
                    {product.image ? (
                        <Image src={product.image} alt={product.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 bg-gray-50 text-center p-2 relative">
                            {product.category === "Combos" && (
                                <div className="absolute inset-0 flex items-center justify-center opacity-10 text-purple-600">
                                    <Layers size={80} />
                                </div>
                            )}
                            <span className="text-lg font-bold opacity-30 uppercase">{product.category.split(' ')[0]}</span>
                        </div>
                    )}
                </Link>
                
                {/* Quick View Button (Stop Propagation lagaya taki Link click na ho) */}
                <button 
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedProduct(product);
                    }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/90 text-slate-800 px-4 py-2 rounded-full font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 hover:bg-blue-600 hover:text-white z-10"
                >
                    <Eye size={16} /> <span className="text-xs">Quick View</span>
                </button>

                {/* Badge */}
                {product.category === "Combos" ? (
                    <span className="absolute top-2 left-2 bg-purple-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">BUNDLE SAVE</span>
                ) : (
                    <span className="absolute top-2 left-2 bg-green-600 text-white text-[11px] font-bold px-2 py-1 rounded shadow-sm">NEW</span>
                )}
            </div>

            {/* DETAILS SECTION */}
            <div className="p-4 md:p-5 flex flex-col flex-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{product.category}</p>
                
                {/* 3. Link Added around Title */}
                <h3 className="text-[13px] md:text-[16px] font-bold text-gray-800 leading-snug line-clamp-2 mb-2 h-[38px] md:h-[48px] group-hover:text-blue-600 transition-colors">
                    <Link href={`/product/${product.id}`}>
                        {product.title}
                    </Link>
                </h3>
                
                <div className="flex gap-0.5 mb-3">
                    {[...Array(5)].map((_, i) => (<Star key={i} size={12} fill="#facc15" stroke="none" />))}
                </div>

                <div className="mt-auto">
                    <div className="flex items-baseline gap-2 mb-3">
                        <span className="text-lg md:text-xl font-bold text-blue-700">₹{product.price}</span>
                        <span className="text-xs md:text-sm text-gray-400 line-through">₹{product.oldPrice}</span>
                    </div>
                    
                    <button className="w-full bg-[#1e40af] text-white py-2.5 rounded-lg text-[12px] md:text-[14px] font-bold flex items-center justify-center gap-2 hover:bg-[#1e3a8a] transition shadow-md active:scale-95">
                        <ShoppingCart size={16} /> <span className="hidden md:inline">Add to Cart</span> <span className="md:hidden">Add</span>
                    </button>
                </div>
            </div>
            </div>
        ))}
        </div>

        {selectedProduct && (
            <ProductQuickView product={selectedProduct} onClose={() => setSelectedProduct(null)} />
        )}
    </>
  );
}