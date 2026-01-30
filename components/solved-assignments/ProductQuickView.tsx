"use client";
import { X, CheckCircle, FileText, Calendar } from "lucide-react";
import Image from "next/image";

interface QuickViewProps {
  product: any;
  onClose: () => void;
}

export default function ProductQuickView({ product, onClose }: QuickViewProps) {
  if (!product) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto grid md:grid-cols-2 shadow-2xl relative">
        
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-red-50 hover:text-red-600 transition z-10">
            <X size={20} />
        </button>

        {/* LEFT: Image / Question Paper Preview */}
        <div className="bg-gray-100 p-8 flex items-center justify-center relative">
            <div className="relative w-[280px] aspect-[210/297] shadow-lg border border-gray-200 bg-white p-4">
                {/* Simulated Question Paper Preview */}
                <div className="w-full h-full border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-center p-4">
                    <FileText size={40} className="text-gray-300 mb-2"/>
                    <h4 className="font-bold text-gray-400 text-sm">PREVIEW MODE</h4>
                    <p className="text-[10px] text-gray-400 mt-2">
                        Questions Included:<br/>
                        Q1. Discuss the nature of...<br/>
                        Q2. Explain the concept...
                    </p>
                    <div className="mt-4 bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-1 rounded">
                        Verified for 2025-26
                    </div>
                </div>
            </div>
        </div>

        {/* RIGHT: Product Details */}
        <div className="p-8 flex flex-col">
            <div className="mb-1">
                <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded">INSTANT DOWNLOAD</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2 leading-snug">{product.title}</h2>
            
            <div className="flex items-center gap-4 mb-6">
                <span className="text-3xl font-bold text-blue-700">₹{product.price}</span>
                <span className="text-lg text-gray-400 line-through">₹{product.oldPrice}</span>
                <span className="text-sm text-green-600 font-bold">30% OFF</span>
            </div>

            {/* Verification Features */}
            <div className="space-y-3 mb-8 border-t border-b border-gray-100 py-6">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                    <CheckCircle size={18} className="text-green-500" /> 
                    <span>100% Correct Answers (Verified by Expert)</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                    <FileText size={18} className="text-blue-500" /> 
                    <span>Typed PDF (Searchable Text)</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Calendar size={18} className="text-orange-500" /> 
                    <span>Valid for Session: <span className="font-bold text-gray-800">June 2025 & Dec 2025</span></span>
                </div>
            </div>

            <div className="mt-auto space-y-3">
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-200 transition transform active:scale-95">
                    Buy Now & Download
                </button>
                <p className="text-center text-xs text-gray-400">Secure payment via UPI / Card</p>
            </div>
        </div>

      </div>
    </div>
  );
}