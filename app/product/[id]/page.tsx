"use client";
import { useState, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  Star, ShoppingCart, CheckCircle, Truck, ShieldCheck, 
  ChevronRight, Minus, Plus, Share2, Download, FileText, 
  AlertCircle, Calendar, Globe, BookOpen, PenTool, X, FileSignature 
} from "lucide-react";

import TopBar from "../../../components/TopBar";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import FloatingButtons from "../../../components/FloatingButtons";

// 👇 1. Cart Hook Import kiya
import { useCart } from "../../../context/CartContext";

export default function ProductDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  // 👇 2. Cart Function nikala
  const { addToCart } = useCart();

  // --- SMART CATEGORY DETECTION ---
  let dynamicCategory = "Solved Assignment";
  let dynamicCategoryLink = "/solved-assignments"; 
  const idLower = id.toLowerCase();

  if (idLower.includes("ebook") || idLower === "6" || idLower.includes("related-6")) {
     dynamicCategory = "eBooks/Notes";
     dynamicCategoryLink = "/ebooks";
  } 
  else if (idLower.includes("guess") || idLower === "5" || idLower.includes("related-5")) {
     dynamicCategory = "Guess Paper";
     dynamicCategoryLink = "/guess-papers";
  } 
  else if (idLower.includes("project") || idLower === "4" || idLower.includes("related-4")) {
     dynamicCategory = "Project & Synopsis";
     dynamicCategoryLink = "/projects";
  } 
  else if (idLower.includes("hardcopy") || idLower === "2" || idLower.includes("related-2")) {
     dynamicCategory = "Hardcopy Delivery";
     dynamicCategoryLink = "/handwritten-hardcopy";
  } 
  else if (idLower.includes("pdf") || idLower === "3" || idLower.includes("related-3")) {
     dynamicCategory = "Handwritten PDF";
     dynamicCategoryLink = "/handwritten-pdfs";
  }

  // --- MOCK DATA ---
  const product = {
    id: id,
    title: `IGNOU ${id.toUpperCase().replace('RELATED-', 'CODE-')} (British Poetry) - ${dynamicCategory}`,
    price: dynamicCategory === "Project & Synopsis" ? 500 : 35,
    oldPrice: dynamicCategory === "Project & Synopsis" ? 1000 : 50,
    rating: 4.8,
    reviews: 124,
    sku: `MEG-01-${dynamicCategory.substring(0,3).toUpperCase()}-25`,
    shortDesc: `High-quality ${dynamicCategory} for MEG-01 British Poetry. Prepared by experts to guarantee best marks.`,
    
    details: {
      courseCode: "MEG-01",
      courseName: "British Poetry",
      category: dynamicCategory,
      language: "Hindi",
      session: "2025-2026",
      format: dynamicCategory.includes("Hardcopy") ? "Physical Delivery" : "PDF Download",
      pages: "18 Pages",
      publishDate: "15 Jan 2026",
    },

    images: [
      "/images/cover1.jpg",
      "/images/page1.jpg",
      "/images/page2.jpg",
    ],

    description: `
      <p>This is the premium <strong>${dynamicCategory}</strong> for <strong>MEG-01 (British Poetry)</strong> valid for the <strong>2025-2026 Session</strong>.</p>
      <br/>
      <h3><strong>Why Choose This?</strong></h3>
      <ul>
        <li>✅ <strong>100% Accurate:</strong> Verified by IGNOU professors.</li>
        <li>✅ <strong>Proper Formatting:</strong> Written according to IGNOU guidelines.</li>
        <li>✅ <strong>Latest Edition:</strong> Updated content for upcoming exams.</li>
      </ul>
    `,

    instructions: [
      "Check your Subject Code and Session carefully.",
      dynamicCategory.includes("Hardcopy") 
        ? "This item will be delivered to your home address via Speed Post."
        : "This is a digital product (PDF). Instant Download available.",
      "Support available on WhatsApp for any queries."
    ]
  };

  const [quantity, setQuantity] = useState(1);
  const [selectedImgIndex, setSelectedImgIndex] = useState(0);
  const [isHandwrittenOpen, setIsHandwrittenOpen] = useState(false);

  // 👇 3. Handle Add To Cart Function
  const handleAddToCart = () => {
    addToCart({
      id: product.id,
      title: product.title,
      price: product.price,
      image: product.images[0], // First image as thumbnail
      quantity: quantity,
      category: product.details.category,
      courseCode: product.details.courseCode
    });
    
    // Optional: User feedback
    alert("Item added to cart successfully!");
  };

  // --- REUSABLE BUY BUTTON COMPONENT ---
  const BuySection = ({ isMobile = false }) => (
    <div className={`flex gap-3 ${isMobile ? '' : 'w-full'}`}>
       <div className="flex items-center border-2 border-gray-200 rounded-xl bg-white h-12">
          <button onClick={()=>setQuantity(Math.max(1, quantity-1))} className="px-3 hover:bg-gray-100 text-gray-600 h-full rounded-l-xl"><Minus size={16}/></button>
          <span className="px-2 font-bold text-lg min-w-[2.5rem] text-center">{quantity}</span>
          <button onClick={()=>setQuantity(quantity+1)} className="px-3 hover:bg-gray-100 text-gray-600 h-full rounded-r-xl"><Plus size={16}/></button>
       </div>
       
       {/* 👇 4. Button par onClick lagaya */}
       <button 
          onClick={handleAddToCart}
          className="flex-1 bg-green-600 text-white h-12 rounded-xl font-bold text-lg hover:bg-green-700 transition shadow-md active:scale-95 flex items-center justify-center gap-2"
       >
          <ShoppingCart size={20} /> Buy Now
       </button>

       {!isMobile && (
         <button className="h-12 w-12 flex items-center justify-center border-2 border-gray-200 rounded-xl text-gray-500 hover:border-blue-500 hover:text-blue-600 transition bg-white">
            <Share2 size={20} />
         </button>
       )}
    </div>
  );

  return (
    <main className="min-h-screen bg-gray-50 font-sans text-slate-800">
      <TopBar />
      <Navbar />

      <div className="bg-white border-b border-gray-200 py-3 sticky top-[80px] z-20 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 text-xs md:text-sm text-gray-500 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
           <Link href="/" className="hover:text-blue-600">Home</Link> <ChevronRight size={12}/>
           <Link href={dynamicCategoryLink} className="hover:text-blue-600">{dynamicCategory}</Link> <ChevronRight size={12}/>
           <span className="text-gray-900 font-medium truncate">{product.title}</span>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 py-8">
         <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            
            {/* LEFT: IMAGE GALLERY */}
            <div className="lg:col-span-5 flex flex-col gap-4 lg:sticky lg:top-32">
               <div className="relative aspect-[210/297] bg-white rounded-xl overflow-hidden border border-gray-200 shadow-md group">
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 text-gray-300">
                      <span className="text-4xl font-bold">{product.details.courseCode}</span>
                      <p className="text-sm">Image {selectedImgIndex + 1}</p>
                  </div>
               </div>
               <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {product.images.map((img, i) => (
                    <button 
                      key={i} 
                      onClick={() => setSelectedImgIndex(i)}
                      className={`relative w-16 h-24 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${selectedImgIndex === i ? 'border-blue-600 ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <div className="absolute inset-0 bg-gray-100 flex items-center justify-center text-[10px] text-gray-400">View {i+1}</div>
                    </button>
                  ))}
               </div>
               <button className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-blue-300 bg-blue-50 text-blue-700 rounded-xl font-bold hover:bg-blue-100 transition text-sm">
                  <Download size={18} /> Download Question Paper
               </button>
            </div>

            {/* RIGHT: PRODUCT INFO */}
            <div className="lg:col-span-7 flex flex-col">
               <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full mb-3 uppercase tracking-wider w-fit">
                  {product.details.category}
               </span>
               <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-slate-900 mb-3 leading-snug">
                 {product.title}
               </h1>
               <div className="flex items-center gap-4 mb-5 pb-5 border-b border-gray-100">
                  <div className="flex items-end gap-2">
                     <span className="text-4xl font-bold text-green-700">₹{product.price}</span>
                     <span className="text-lg text-gray-400 line-through mb-1">₹{product.oldPrice}</span>
                  </div>
                  <div className="h-8 w-[1px] bg-gray-300 mx-2"></div>
                  <div className="flex flex-col">
                     <div className="flex text-yellow-500 text-xs">
                        {[...Array(5)].map((_,i) => <Star key={i} size={14} fill="currentColor" />)}
                     </div>
                     <span className="text-xs text-gray-500 font-medium">{product.reviews} Reviews</span>
                  </div>
               </div>

               {/* BUY BUTTONS */}
               <div className="hidden lg:block mb-6">
                  <BuySection />
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 text-xs text-gray-500 font-bold bg-gray-50 p-3 rounded-lg border border-gray-100">
                     <span className="flex items-center gap-1.5 text-purple-700"><Download size={16}/> Instant Download</span>
                     <span className="flex items-center gap-1.5 text-green-700"><Truck size={16}/> Email Delivery</span>
                     <span className="flex items-center gap-1.5 text-blue-700"><ShieldCheck size={16}/> 100% Secure Payment</span>
                  </div>
               </div>

               {/* UPSELL BUTTON (Only for Solved) */}
               {product.details.category === "Solved Assignment" && (
                 <div className="relative mb-6">
                    <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-purple-100 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><PenTool size={20}/></div>
                           <div>
                              <h4 className="font-bold text-purple-900 text-sm">Don't have time to write?</h4>
                              <p className="text-xs text-purple-600">Order Handwritten Assignment instead.</p>
                           </div>
                        </div>
                        <button onClick={() => setIsHandwrittenOpen(!isHandwrittenOpen)} className="whitespace-nowrap px-4 py-2 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 transition shadow-sm flex items-center gap-1">
                           Check Options <ChevronRight size={14}/>
                        </button>
                    </div>
                    {isHandwrittenOpen && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-purple-100 rounded-xl shadow-xl z-30 overflow-hidden animate-in fade-in slide-in-from-top-2">
                          <div className="flex justify-between items-center bg-purple-50 px-4 py-2 border-b border-purple-100">
                             <span className="text-xs font-bold text-purple-700 uppercase">Select Format</span>
                             <button onClick={() => setIsHandwrittenOpen(false)}><X size={14} className="text-purple-400 hover:text-purple-700"/></button>
                          </div>
                          <Link href={`/product/${id}-hardcopy`} className="flex items-center gap-3 p-3 hover:bg-gray-50 border-b border-gray-50">
                             <div className="p-2 bg-orange-100 text-orange-600 rounded-full"><Truck size={16} /></div>
                             <div><h4 className="font-bold text-slate-800 text-xs">Hardcopy Delivery</h4><p className="text-[10px] text-gray-500">Home Delivery</p></div>
                          </Link>
                          <Link href={`/product/${id}-pdf`} className="flex items-center gap-3 p-3 hover:bg-gray-50">
                             <div className="p-2 bg-blue-100 text-blue-600 rounded-full"><FileSignature size={16} /></div>
                             <div><h4 className="font-bold text-slate-800 text-xs">Handwritten PDF</h4><p className="text-[10px] text-gray-500">Scan Copy</p></div>
                          </Link>
                      </div>
                    )}
                 </div>
               )}

               <p className="text-gray-600 mb-6 leading-relaxed text-sm md:text-base">{product.shortDesc}</p>

               {/* SPECS TABLE */}
               <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6 shadow-sm">
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 font-bold text-slate-700 text-sm flex items-center gap-2">
                     <FileText size={16} /> Details
                  </div>
                  <div className="grid grid-cols-2 text-sm divide-x border-gray-100">
                     <div className="p-3 space-y-2">
                        <div className="flex flex-col"><span className="text-xs text-gray-400">Course Code</span> <span className="font-bold text-slate-800">{product.details.courseCode}</span></div>
                        <div className="flex flex-col"><span className="text-xs text-gray-400">Language</span> <span className="font-bold text-slate-800">{product.details.language}</span></div>
                        <div className="flex flex-col"><span className="text-xs text-gray-400">Format</span> <span className="font-bold text-green-600">{product.details.format}</span></div>
                     </div>
                     <div className="p-3 space-y-2">
                        <div className="flex flex-col"><span className="text-xs text-gray-400">Session</span> <span className="font-bold text-slate-800">{product.details.session}</span></div>
                        <div className="flex flex-col"><span className="text-xs text-gray-400">Pages</span> <span className="font-bold text-slate-800">{product.details.pages}</span></div>
                        <div className="flex flex-col"><span className="text-xs text-gray-400">Publish Date</span> <span className="font-bold text-slate-800">{product.details.publishDate}</span></div>
                     </div>
                  </div>
               </div>

               <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                  <h3 className="font-bold text-amber-800 text-xs uppercase tracking-wide mb-2 flex items-center gap-1">
                     <AlertCircle size={14}/> Important Note
                  </h3>
                  <ul className="list-disc list-inside text-xs text-amber-900 space-y-1">
                     {product.instructions.map((inst, i) => (
                        <li key={i}>{inst}</li>
                     ))}
                  </ul>
               </div>
            </div>
         </div>

         <div className="mt-12 bg-white rounded-2xl shadow-sm border border-gray-200 p-5 md:p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b pb-3"><FileText className="text-blue-600"/> Description</h2>
            <div className="prose prose-sm prose-blue max-w-none text-slate-600" dangerouslySetInnerHTML={{ __html: product.description }} />
         </div>

         <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-200 p-5 md:p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b pb-3"><Star className="text-yellow-500"/> Reviews ({product.reviews})</h2>
            <div className="bg-gray-50 rounded-xl p-6 text-center">
               <p className="text-gray-500 mb-3 text-sm">No reviews yet.</p>
               <button className="px-5 py-2 border border-slate-300 rounded-full font-bold hover:bg-white transition text-xs uppercase tracking-wide">Write a Review</button>
            </div>
         </div>
         
         <div className="mt-12">
             <h2 className="text-xl font-bold text-slate-900 mb-6">Related Products</h2>
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {[1,2,3,4,5,6].map((item) => (
                   <Link href={`/product/related-${item}`} key={item} className="bg-white p-3 rounded-xl border border-gray-200 hover:shadow-lg hover:-translate-y-1 transition cursor-pointer group">
                      <div className="aspect-[210/297] bg-gray-100 rounded-lg mb-3 relative overflow-hidden">
                         <div className="absolute inset-0 flex items-center justify-center text-gray-300 font-bold text-xl opacity-30">IMG</div>
                         <span className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">PDF</span>
                      </div>
                      <h3 className="font-bold text-xs md:text-sm text-slate-700 line-clamp-2 group-hover:text-blue-600 transition mb-1">MEG-0{item} Solved Assignment</h3>
                      <div className="font-bold text-blue-700 text-sm">₹35</div>
                   </Link>
                ))}
             </div>
         </div>
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-white p-3 border-t border-gray-200 lg:hidden z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
         <BuySection isMobile={true} />
      </div>

      <div className="h-20 lg:h-0"></div>
      <Footer />
      <FloatingButtons />
    </main>
  );
}