"use client"; // Swiper use kar rahe hain isliye 'use client' jaruri hai

import TopBar from "@/components/TopBar";
import Navbar from "@/components/Navbar";
import HeroSlider from "@/components/HeroSlider";
import Footer from "@/components/Footer";
import FloatingButtons from "@/components/FloatingButtons";
import Image from "next/image";
import { 
  Download, Star, ShieldCheck, ArrowRight, 
  Truck, Search, FileText, ScrollText, Printer,
  BookOpen, Phone, CheckCircle, Calendar
} from "lucide-react"; 

// 1. SWIPER IMPORTS (Testimonials ke liye)
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

export default function Home() {
  const categories = [
    { title: "Solved Assignments", img: "/c1.png" },
    { title: "Handwritten Assignments", img: "/c2.png" },
    { title: "Guess Papers", img: "/c3.png" },
    { title: "IGNOU E-books", img: "/c4.png" },
    { title: "Previous Year Papers", img: "/c5.png" },
    { title: "Practical Files", img: "/c6.png" },
  ];

  const benefits = [
    { title: "Verified Content", desc: "Gets Higher Marks in Less Time.", icon: ScrollText, bgColor: "bg-[#1E40AF]" },
    { title: "Faster Home Delivery", desc: "(Express Delivery)", icon: Truck, bgColor: "bg-[#EA580C]" },
    { title: "No Grammatical Errors", desc: "No Errors.", icon: Search, bgColor: "bg-[#16A34A]" },
    { title: "Genuine IGNOU Material", desc: "No Copied and Pasted.", icon: FileText, bgColor: "bg-[#4338CA]" },
    { title: "Great Organization", desc: "Crisp & Clear Printing.", icon: Printer, bgColor: "bg-[#EA580C]" },
  ];

  const courses = [
    { code: "ACE", name: "Appreciation Course On Environment" },
    { code: "ACISE", name: "Advance Certificate in Information Security" },
    { code: "ACPDM", name: "Advanced Certificate in Power Distribution" },
    { code: "ACPSD", name: "Appreciation Course On Population" },
    { code: "APDF", name: "Awareness Programme On Dairy Farming" },
    { code: "B.Ed", name: "BACHELOR OF EDUCATION" },
    { code: "BAAHD", name: "Bachelor of Arts (Applied Hindi)" },
    { code: "BAASK", name: "Bachelor of Arts (General)" },
    { code: "BAECH", name: "Bachelor of Arts (Honours) Economics" },
    { code: "BAEGH", name: "Bachelor of Arts (English)" },
    { code: "BAFEC", name: "Bachelor of Arts (Economics)" },
    { code: "BAFEDU", name: "Bachelor of Arts (Education)" },
  ];

  // Testimonial Data
  const reviews = [
    { id: 1, name: "Rahul Kumar", course: "M.Com", text: "Great experience! The assignments were accurate and helped me score really well." },
    { id: 2, name: "Priya Singh", course: "B.A. English", text: "Delivery was super fast. I received my handwritten notes within 2 days in Delhi." },
    { id: 3, name: "Amit Sharma", course: "MBA", text: "Project synopsis got approved in the first go. Highly recommended service." },
    { id: 4, name: "Sneha Gupta", course: "B.Ed", text: "Very polite customer support and genuine material. Will buy again." },
  ];

  return (
    <main className="min-h-screen bg-white font-sans">
      <TopBar />
      <Navbar />
      
      <h1 className="sr-only">IGNOU Students Portal - Best Place for Solved Assignments and Study Material</h1>
      
      <HeroSlider />

      {/* 1. Three Features Section (FIX: Horizontal Scroll on Mobile) */}
      <section className="py-8 md:py-12 bg-white border-b border-gray-100">
        <div className="max-w-[1600px] mx-auto px-4">
            
            {/* MOBILE: flex + overflow-x-auto (Scrollable)
               DESKTOP: grid + grid-cols-3 (Fixed)
            */}
            <div className="flex md:grid md:grid-cols-3 gap-4 md:gap-6 overflow-x-auto md:overflow-visible pb-4 md:pb-0 snap-x">
               {[
                 { title: "Instant Download", color: "#00C853", icon: Download, desc: "Get your papers immediately after purchase." },
                 { title: "High Quality", color: "#FF9800", icon: Star, desc: "Well-researched and properly formatted solutions." },
                 { title: "Secure Payment", color: "#1565C0", icon: ShieldCheck, desc: "Safe and secure payment methods." }
               ].map((f, i) => (
                // min-w-[85vw] ka matlab mobile par ek card screen ka 85% lega taaki side wala thoda dikhe
                <div key={i} className="min-w-[85vw] md:min-w-0 bg-white p-6 rounded-2xl shadow-lg border border-gray-50 flex-shrink-0 snap-center relative overflow-hidden group">
                    <div className="absolute bottom-0 left-0 w-full h-1.5 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-center" style={{ backgroundColor: f.color }}></div>
                    <div className="flex flex-col items-center text-center">
                        <div className="w-14 h-14 text-white rounded-xl flex items-center justify-center mb-4 shadow-lg" style={{ backgroundColor: f.color }}>
                            <f.icon size={28} strokeWidth={2} fill={f.title === "High Quality" ? "white" : "none"} />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800 mb-2">{f.title}</h3>
                        <p className="text-slate-500 text-sm leading-relaxed px-2">{f.desc}</p>
                    </div>
                </div>
               ))}
            </div>
        </div>
      </section>

      {/* 2. Browse By Categories (Full Image Tile Style) */}
      <section className="py-16 bg-[#F9FAFB]">
        <div className="max-w-[1600px] mx-auto px-4">
            <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-blue-900 mb-3">IGNOU STUDENTS PORTAL</h2>
                <h3 className="text-lg md:text-xl font-semibold text-slate-600">Get All Material At One Place</h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                {categories.map((cat, i) => (
                    <div key={i} className="relative h-48 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer group hover:-translate-y-2 border border-gray-200">
                        
                        {/* 1. FULL BACKGROUND IMAGE 
                           - 'object-cover' se image pure box ko fill karegi bina khinche.
                           - Hover karne par image thodi zoom hogi (scale-110).
                        */}
                        <Image 
                            src={cat.img} 
                            alt={cat.title} 
                            fill 
                            className="object-cover transition-transform duration-500 group-hover:scale-110" 
                        />

                        {/* 2. GRADIENT OVERLAY (Protection Layer)
                           - Hum image ko fade nahi kar rahe.
                           - Bas niche (bottom) me thoda sa kala rang (gradient) laga rahe hain.
                           - Taaki White text saaf dikhe, bhale hi piche image kaisi bhi ho.
                        */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-90" />

                        {/* 3. CATEGORY NAME 
                           - Ab text image ke upar White color me aayega.
                           - 'bottom-0' se ye niche chipka rahega.
                        */}
                        <div className="absolute bottom-0 left-0 w-full p-4 flex items-end justify-center h-full z-10">
                            <h3 className="text-white font-bold text-lg text-center leading-tight drop-shadow-md group-hover:text-blue-200 transition-colors">
                                {cat.title}
                            </h3>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </section>
            
      {/* 3. Explore Our Courses */}
      <section className="py-12 md:py-16 bg-white">
        <div className="max-w-[1600px] mx-auto px-4">
            <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-slate-800">Explore Our Courses</h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
                {courses.map((course, i) => (
                    <div key={i} className="bg-white border border-gray-100 p-3 md:p-4 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col items-center text-center h-full">
                        <div className="w-full h-20 md:h-24 bg-slate-50 rounded-lg mb-3 flex items-center justify-center overflow-hidden relative">
                             <div className="absolute inset-0 flex items-center justify-center opacity-10">
                                <BookOpen size={50} />
                             </div>
                             <span className="font-black text-xl md:text-2xl text-slate-700 z-10">{course.code}</span>
                        </div>
                        <h3 className="font-bold text-slate-800 text-xs md:text-sm mb-1">{course.code}</h3>
                        <p className="text-[10px] md:text-xs text-slate-500 line-clamp-2">{course.name}</p>
                    </div>
                ))}
            </div>

            <div className="mt-10 text-center">
                <button className="bg-slate-800 text-white px-8 py-3 rounded-full font-bold hover:bg-slate-700 transition shadow-lg hover:shadow-slate-300/50">
                    View All Courses
                </button>
            </div>
        </div>
      </section>

      {/* 4. BENEFITS SECTION (FIX: 2 Columns on Mobile) */}
      <section className="py-12 md:py-16 bg-[#F0F7FF]">
        <div className="max-w-[1600px] mx-auto px-4">
            <div className="text-center mb-10">
                <h2 className="text-2xl md:text-3xl font-bold text-[#1E3A8A] mb-2 uppercase tracking-wide">
                    BENEFITS OVER COMPETITORS
                </h2>
                <p className="text-slate-500 font-medium">Why choose us?</p>
            </div>

            {/* FIX: grid-cols-2 (Mobile) instead of grid-cols-1 */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
                {benefits.map((item, index) => (
                    <div key={index} className="group bg-white border border-blue-100 p-4 md:p-6 rounded-2xl text-center hover:border-blue-600 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 cursor-pointer flex flex-col items-center h-full">
                        <div className={`w-14 h-14 md:w-20 md:h-20 rounded-2xl flex items-center justify-center mb-3 md:mb-5 shadow-sm text-white ${item.bgColor} transform transition-transform duration-300 group-hover:scale-110`}>
                            <item.icon size={28} className="md:w-9 md:h-9" strokeWidth={2.5} />
                        </div>
                        <h3 className="font-bold text-slate-900 mb-1 leading-tight text-sm md:text-lg">{item.title}</h3>
                        {/* Mobile par description hide kar sakte hain agar congested lage, abhi dikha rahe hain */}
                        <p className="text-slate-500 text-xs md:text-sm px-1 leading-relaxed">{item.desc}</p>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* 5. Latest Assignments (Portrait) */}
      <section className="py-16 bg-white">
        <div className="max-w-[1600px] mx-auto px-4">
            <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-slate-800 border-b-4 border-blue-600 inline-block pb-1">Latest Updated Assignments</h2>
            </div>

            {/* CHANGES HERE: lg:grid-cols-6 (Desktop) & md:grid-cols-3 (Tablet) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6">
                
                {/* CHANGE HERE: Array me ab 6 items hain */}
                {[1, 2, 3, 4, 5, 6].map((item) => (
                    <div key={item} className="group border border-gray-200 rounded-lg overflow-hidden hover:shadow-xl transition-all duration-300 bg-white hover:-translate-y-2">
                        <div className="h-[220px] md:h-[280px] bg-gray-100 relative flex items-center justify-center overflow-hidden">
                            <div className="w-[80%] h-[90%] bg-white shadow-md flex items-center justify-center border border-gray-200">
                                <span className="text-gray-300 font-bold rotate-45 text-xs md:text-base">COVER IMG</span>
                            </div>
                            <span className="absolute top-2 left-2 bg-green-600 text-white text-[10px] font-bold px-2 py-1 rounded">NEW</span>
                        </div>
                        <div className="p-3 md:p-4 text-center">
                            <h3 className="font-bold text-slate-700 mb-1 text-xs md:text-sm group-hover:text-blue-600 transition line-clamp-2">
                                M.Com First Year Solved Assignment 2025-26
                            </h3>
                            <div className="flex justify-center items-center gap-2 mt-2">
                                <span className="text-base md:text-lg font-bold text-slate-900">₹50</span>
                                <span className="text-[10px] md:text-xs text-gray-400 line-through">₹100</span>
                            </div>
                            <button className="w-full mt-3 bg-blue-50 text-blue-600 text-xs md:text-sm font-bold py-2 rounded hover:bg-blue-600 hover:text-white transition">
                                Add to Cart
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-12 text-center">
                <button className="bg-transparent border-2 border-blue-600 text-blue-600 px-8 py-2 md:px-10 md:py-3 rounded-full font-bold hover:bg-blue-600 hover:text-white transition uppercase tracking-wide text-sm md:text-base">
                    View All Products
                </button>
            </div>
        </div>
      </section>
      
      {/* 6. WHAT STUDENTS SAY (FIX: Automatic Slider) */}
      <section className="py-16 bg-[#F9FAFB]">
        <div className="max-w-[1600px] mx-auto px-4">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-slate-800">What Students Say</h2>
                <p className="text-slate-500 mt-2">Trusted by thousands of IGNOU students</p>
            </div>
            
            <Swiper
                modules={[Autoplay, Pagination]}
                spaceBetween={30}
                slidesPerView={1} // Mobile par 1 slide
                breakpoints={{
                    768: { slidesPerView: 2 }, // Tablet par 2
                    1024: { slidesPerView: 3 } // PC par 3
                }}
                autoplay={{ delay: 3000, disableOnInteraction: false }} // 3 Second Auto Slide
                loop={true}
                pagination={{ clickable: true }}
                className="pb-12" // Pagination dots ke liye jagah
            >
                {reviews.map((review) => (
                    <SwiperSlide key={review.id}>
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition h-full">
                            <div className="flex text-yellow-400 mb-4">
                                {[1,2,3,4,5].map(s=><Star key={s} size={18} fill="currentColor"/>)}
                            </div>
                            <p className="text-slate-600 mb-6 italic leading-relaxed text-sm md:text-base">"{review.text}"</p>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                                    {review.name.charAt(0)}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800">{review.name}</h4>
                                    <p className="text-xs text-slate-400">{review.course} Student</p>
                                </div>
                            </div>
                        </div>
                    </SwiperSlide>
                ))}
            </Swiper>
        </div>
      </section>

      {/* 7. Recent Blog */}
      <section className="py-16 bg-white">
        <div className="max-w-[1600px] mx-auto px-4">
            <div className="flex justify-between items-center mb-10">
                <h2 className="text-2xl font-bold text-slate-800">Latest from our Blog</h2>
                <a href="#" className="text-blue-600 font-medium hover:underline text-sm">Read All</a>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="group cursor-pointer">
                        <div className="h-56 bg-gray-200 rounded-xl mb-4 overflow-hidden relative">
                             <div className="absolute inset-0 bg-slate-300 group-hover:scale-105 transition-transform duration-500"></div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-blue-600 font-bold mb-2 uppercase tracking-wider">
                            <Calendar size={12}/> <span>Jan 27, 2026</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-blue-600 transition">How to Score 90+ in IGNOU Assignments?</h3>
                        <p className="text-slate-500 text-sm line-clamp-2">Detailed guide on writing, formatting, and submitting your assignments correctly to maximize your grades.</p>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* 8. CTA Banner (FIX: Icon clipped issue & Official WhatsApp) */}
      <section className="py-20 bg-[#F8FAFC]">
        <div className="max-w-[1200px] mx-auto px-4">
             {/* FIX: Removed 'overflow-hidden' from main div 
                so top icon is not cut off.
             */}
             <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-16 text-center relative border border-gray-100 mt-8">
                
                {/* Decorative Icon Top (Now visible perfectly) */}
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-4 rounded-full shadow-lg border border-blue-50 z-10">
                    <FileText className="text-blue-600" size={32} />
                </div>

                <div className="mt-6">
                    <h2 className="text-2xl md:text-4xl font-extrabold text-[#1E3A8A] mb-4 leading-tight">
                        ARE YOU LOOKING FOR <span className="text-blue-600">CUSTOMIZED PROJECT REPORT / SYNOPSIS?</span>
                    </h2>
                    
                    <p className="text-slate-600 text-lg mb-8 max-w-3xl mx-auto">
                        Looking for the best IGNOU project reports and synopsis? Worry no more! Get customized IGNOU project Report with a <span className="bg-blue-100 text-blue-800 px-2 font-bold rounded">100% guarantee of approval</span>.
                    </p>

                    <div className="flex flex-col sm:flex-row justify-center gap-4 mb-10">
                        {/* FIX: Official WhatsApp Icon using SVG
                        */}
                        <button className="flex items-center justify-center gap-2 bg-[#25D366] text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-[#20bd5a] hover:scale-105 hover:shadow-lg hover:shadow-green-200 transition-all duration-300">
                            {/* Official SVG Path for WhatsApp */}
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.592 2.654-.696c1.001.574 2.146.877 3.303.877 3.18 0 5.767-2.587 5.768-5.766.001-3.181-2.584-5.761-5.765-5.761zm6.927 5.766c-.001 3.82-3.107 6.925-6.927 6.925-1.129 0-2.235-.291-3.21-.842l-3.593.942.958-3.504c-.628-1.04-1.002-2.213-1.002-3.521-.001-3.819 3.106-6.925 6.927-6.925 3.82 0 6.926 3.106 6.927 6.925z"/>
                                <path d="M15.42 13.064c-.177-.089-1.047-.516-1.209-.576-.161-.059-.279-.089-.396.089-.118.178-.456.576-.559.694-.102.119-.205.133-.382.045-.178-.089-.751-.277-1.429-.882-.53-.473-.888-1.057-.992-1.235-.104-.177-.011-.273.078-.362.08-.08.178-.207.266-.31.089-.104.119-.178.178-.297.059-.118.029-.222-.015-.31-.044-.089-.396-.955-.542-1.309-.143-.343-.288-.296-.396-.301-.102-.005-.219-.005-.337-.005-.118 0-.31.044-.472.222-.162.178-.62.606-.62 1.478 0 .872.635 1.714.723 1.833.089.119 1.251 1.91 3.03 2.678 1.054.455 1.47.532 1.996.448.586-.093 1.047-.428 1.195-.841.148-.414.148-.769.104-.841-.044-.074-.162-.119-.339-.207z"/>
                            </svg>
                            START WHATSAPP CHAT
                        </button>

                        {/* Call Button - Blue Hover Effect */}
                        <button className="flex items-center justify-center gap-2 bg-[#1E40AF] text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-[#1e3a8a] hover:scale-105 hover:shadow-lg hover:shadow-blue-200 transition-all duration-300">
                            <Phone size={24} />
                            CALL US NOW
                        </button>
                    </div>

                    {/* Trust Badges */}
                    <div className="flex flex-wrap justify-center gap-6 md:gap-12 text-slate-500 font-medium text-sm md:text-base">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="text-green-500" size={20} /> 100% Guarantee
                        </div>
                        <div className="flex items-center gap-2">
                            <Truck className="text-blue-600" size={20} /> Quick Delivery
                        </div>
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="text-orange-500" size={20} /> Secure & Safe
                        </div>
                    </div>

                </div>
             </div>
        </div>
      </section>

            {/* 8. CTA Banner Section */}
      <section className="py-20 bg-[#F8FAFC]">
         {/* ... */}
      </section>

      <Footer />

      {/* 👇 YE WALI LINE JODNI HAI (Footer ke niche) */}
      <FloatingButtons />

    </main>
  );
}