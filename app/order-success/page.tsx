"use client";
import Link from "next/link";
import { CheckCircle, Download, Home, ArrowRight, FileText, Mail } from "lucide-react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";

export default function OrderSuccessPage() {
  // Mock Data (Real app me ye data database se aayega)
  const orderId = "ORD-" + Math.floor(100000 + Math.random() * 900000);
  
  return (
    <main className="min-h-screen bg-gray-50 font-sans text-slate-800">
      <Navbar />

      <div className="max-w-[800px] mx-auto px-4 py-16 md:py-24">
        
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden text-center relative">
           {/* Decorative Top Gradient */}
           <div className="h-3 bg-gradient-to-r from-green-400 to-emerald-600 w-full absolute top-0 left-0"></div>

           <div className="p-8 md:p-12">
              
              {/* Success Icon Animation */}
              <div className="mb-6 flex justify-center">
                 <div className="rounded-full bg-green-50 p-4 animate-in zoom-in duration-500">
                    <CheckCircle className="text-green-500 w-20 h-20 md:w-24 md:h-24 drop-shadow-sm" strokeWidth={1.5} />
                 </div>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Payment Successful! 🎉</h1>
              <p className="text-slate-500 text-lg mb-8 max-w-lg mx-auto">
                 Thank you for your purchase. Your order has been confirmed and your files are ready for download.
              </p>

              {/* Order Info Badge */}
              <div className="inline-block bg-gray-50 border border-gray-200 rounded-full px-6 py-2 mb-10">
                 <span className="text-gray-500 text-sm">Order ID: </span>
                 <span className="font-bold text-slate-800 font-mono">{orderId}</span>
              </div>

              {/* --- DOWNLOAD SECTION (Mock) --- */}
              <div className="bg-[#F8FAFC] border border-dashed border-gray-300 rounded-2xl p-6 mb-8 text-left">
                 <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Download size={20} className="text-blue-600"/> Your Downloads
                 </h3>
                 
                 <div className="space-y-3">
                    {/* Item 1 */}
                    <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-blue-300 transition group cursor-pointer">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-red-50 text-red-500 rounded-lg flex items-center justify-center">
                              <FileText size={20}/>
                           </div>
                           <div>
                              <p className="font-bold text-sm text-slate-800">MEG-01 British Poetry (Solved).pdf</p>
                              <p className="text-xs text-gray-400">Size: 2.4 MB</p>
                           </div>
                        </div>
                        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 group-hover:bg-blue-700 transition">
                           Download
                        </button>
                    </div>

                    {/* Item 2 */}
                    <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-blue-300 transition group cursor-pointer">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-red-50 text-red-500 rounded-lg flex items-center justify-center">
                              <FileText size={20}/>
                           </div>
                           <div>
                              <p className="font-bold text-sm text-slate-800">MHI-01 Ancient India (Notes).pdf</p>
                              <p className="text-xs text-gray-400">Size: 5.1 MB</p>
                           </div>
                        </div>
                        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 group-hover:bg-blue-700 transition">
                           Download
                        </button>
                    </div>
                 </div>
              </div>

              {/* Email Notification Note */}
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-8 bg-blue-50/50 p-3 rounded-lg">
                 <Mail size={16} />
                 <span>We've also sent a confirmation email with download links.</span>
              </div>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                 <Link href="/" className="px-8 py-3.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition flex items-center justify-center gap-2 shadow-lg hover:shadow-xl">
                    <Home size={18} /> Back to Home
                 </Link>
                 <Link href="/solved-assignments" className="px-8 py-3.5 bg-white text-slate-700 border border-gray-200 rounded-xl font-bold hover:bg-gray-50 transition flex items-center justify-center gap-2">
                    Buy More <ArrowRight size={18} />
                 </Link>
              </div>

           </div>
        </div>

      </div>
      <Footer />
    </main>
  );
}