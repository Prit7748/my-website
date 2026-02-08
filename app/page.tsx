"use client";

import TopBar from "@/components/TopBar";
import Navbar from "@/components/Navbar";
import HeroSlider from "@/components/HeroSlider";
import Footer from "@/components/Footer";
import FloatingButtons from "@/components/FloatingButtons";
import HomeTestimonials from "@/components/HomeTestimonials";

import Link from "next/link";
import Image from "next/image";
import {
  Download,
  Star,
  ShieldCheck,
  Truck,
  Search,
  FileText,
  ScrollText,
  Printer,
  BookOpen,
  Phone,
  CheckCircle,
  Calendar,
  Sparkles,
  BadgePercent,
  Layers,
  ChevronRight,
  ArrowRight,
  PenTool,
  FileSignature,
  History,
  Zap,
  BookOpenText,
  Briefcase,
  CheckCircle2,
} from "lucide-react";

// ✅ Updated Type for Icon based Categories
type HomeCategory = {
  title: string;
  subtitle: string;
  href: string;
  icon: any; // Lucide Icon Component
  colorClass: string; // Text color
  iconBgClass: string; // Icon wrapper background color
  cardBg: string; // ✅ New: Permanent Card Background
  borderColor: string; // Border color matching the theme
  badge?: string;
};

export default function Home() {
  // ✅ Categories (Permanent Soft Colors)
  const categories: HomeCategory[] = [
    {
      title: "Solved Assignments",
      subtitle: "Session-wise verified PDFs",
      href: "/solved-assignments",
      icon: CheckCircle2,
      colorClass: "text-blue-700",
      iconBgClass: "bg-white", // Icon sits on white to pop against the colored card
      cardBg: "bg-blue-50", // Permanent Soft Blue
      borderColor: "border-blue-100",
      badge: "Most Popular",
    },
    {
      title: "Handwritten Hardcopy",
      subtitle: "Neat writing + delivery",
      href: "/handwritten-hardcopy",
      icon: Truck,
      colorClass: "text-emerald-700",
      iconBgClass: "bg-white",
      cardBg: "bg-emerald-50", // Permanent Soft Emerald
      borderColor: "border-emerald-100",
      badge: "Delivery",
    },
    {
      title: "Handwritten PDFs",
      subtitle: "Handwritten in PDF format",
      href: "/handwritten-pdfs",
      icon: FileSignature,
      colorClass: "text-violet-700",
      iconBgClass: "bg-white",
      cardBg: "bg-violet-50", // Permanent Soft Violet
      borderColor: "border-violet-100",
      badge: "New",
    },
    {
      title: "Question Papers (PYQ)",
      subtitle: "Previous year papers",
      href: "/question-papers",
      icon: History,
      colorClass: "text-amber-700",
      iconBgClass: "bg-white",
      cardBg: "bg-amber-50", // Permanent Soft Amber
      borderColor: "border-amber-100",
      badge: "Exam Focus",
    },
    // These last 3 will automatically center due to flex-wrap justify-center
    {
      title: "Guess Papers",
      subtitle: "Most expected questions",
      href: "/guess-papers",
      icon: Zap,
      colorClass: "text-indigo-700",
      iconBgClass: "bg-white",
      cardBg: "bg-indigo-50", // Permanent Soft Indigo
      borderColor: "border-indigo-100",
      badge: "High Score",
    },
    {
      title: "eBooks/Notes",
      subtitle: "Quick revision material",
      href: "/ebooks",
      icon: BookOpenText,
      colorClass: "text-sky-700",
      iconBgClass: "bg-white",
      cardBg: "bg-sky-50", // Permanent Soft Sky
      borderColor: "border-sky-100",
      badge: "Notes",
    },
    {
      title: "Projects & Synopsis",
      subtitle: "Approval-ready formats",
      href: "/projects",
      icon: Briefcase,
      colorClass: "text-rose-700",
      iconBgClass: "bg-white",
      cardBg: "bg-rose-50", // Permanent Soft Rose
      borderColor: "border-rose-100",
      badge: "Guaranteed",
    },
  ];

  const benefits = [
    { title: "Verified Content", desc: "Gets Higher Marks in Less Time.", icon: ScrollText, bgColor: "bg-[#1E40AF]" },
    { title: "Faster Home Delivery", desc: "(Express Delivery)", icon: Truck, bgColor: "bg-[#EA580C]" },
    { title: "No Grammatical Errors", desc: "No Errors.", icon: Search, bgColor: "bg-[#16A34A]" },
    { title: "Genuine IGNOU Material", desc: "No Copied and Pasted.", icon: FileText, bgColor: "bg-[#4338CA]" },
    { title: "Great Organization", desc: "Crisp & Clear Printing.", icon: Printer, bgColor: "bg-[#EA580C]" },
  ];

  // ✅ Courses: click -> all products filtered by course (default)
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

  const reviews = [
    { id: 1, name: "Rahul Kumar", course: "M.Com", text: "Great experience! The assignments were accurate and helped me score really well." },
    { id: 2, name: "Priya Singh", course: "B.A. English", text: "Delivery was super fast. I received my handwritten notes within 2 days in Delhi." },
    { id: 3, name: "Amit Sharma", course: "MBA", text: "projects synopsis got approved in the first go. Highly recommended service." },
    { id: 4, name: "Sneha Gupta", course: "B.Ed", text: "Very polite customer support and genuine material. Will buy again." },
  ];

  const blogs = [
    {
      slug: "how-to-score-90-in-ignou-assignments",
      date: "Jan 27, 2026",
      title: "How to Score 90+ in IGNOU Assignments?",
      excerpt: "Detailed guide on writing, formatting, and submitting your assignments correctly to maximize your grades.",
    },
    {
      slug: "how-to-choose-right-session-material",
      date: "Jan 27, 2026",
      title: "How to Choose Session-wise IGNOU Material?",
      excerpt: "Learn how to select the correct course + session materials to avoid mismatch and save time.",
    },
    {
      slug: "pyq-strategy-ignou-exams",
      date: "Jan 27, 2026",
      title: "PYQ Strategy for IGNOU Exams (Smart Plan)",
      excerpt: "Use previous year papers + guess papers as a combined strategy to score better with less effort.",
    },
  ];

  return (
    <main className="min-h-screen bg-white">
      <style jsx global>{`
        @keyframes floaty {
          0% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(0, -10px, 0); }
          100% { transform: translate3d(0, 0, 0); }
        }
        @keyframes shimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .isp-grid {
          background-image: radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.07) 1px, transparent 0);
          background-size: 22px 22px;
        }
        .isp-floaty { animation: floaty 6s ease-in-out infinite; }
        .isp-shimmer { background-size: 200% 200%; animation: shimmer 10s ease-in-out infinite; }
      `}</style>

      <TopBar />
      <Navbar />

      <h1 className="sr-only">IGNOU Students Portal - Best Place for Solved Assignments and Study Material</h1>

      <HeroSlider />

      {/* ✅ COMBO SELL BANNER */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-[1600px] mx-auto px-4 py-10 md:py-14">
          <div className="relative overflow-hidden rounded-3xl border border-gray-200 shadow-xl bg-gradient-to-br from-[#0B1B4B] via-[#1E40AF] to-[#06B6D4]">
            <div className="absolute inset-0 opacity-25 isp-grid" />
            <div className="absolute -top-20 -left-24 h-[240px] w-[240px] rounded-full bg-white/20 blur-3xl isp-floaty" />
            <div className="absolute -bottom-24 -right-20 h-[280px] w-[280px] rounded-full bg-black/20 blur-3xl isp-floaty" />

            <div className="relative p-6 md:p-10 lg:p-12">
              <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">
                <div className="flex-1 min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/25 px-3 py-1 text-[11px] font-extrabold text-white">
                    <Sparkles size={14} /> NEW: Smart IGNOU Combos (Save More)
                  </div>

                  <h2 className="mt-3 text-2xl md:text-4xl font-extrabold text-white leading-tight">
                    Buy <span className="text-yellow-300">Combo Packs</span> & Save Extra{" "}
                    <span className="text-yellow-300">25% OFF</span>
                  </h2>

                  <p className="mt-3 text-sm md:text-base font-semibold text-white/90 leading-relaxed max-w-2xl">
                    Same category ke best-selling IGNOU products ko 1 pack me le lo. Preparation fast, confusion kam,
                    aur extra saving.
                  </p>

                  <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { icon: <BadgePercent size={16} className="text-yellow-300" />, t: "Extra 25% OFF" },
                      { icon: <Layers size={16} className="text-white" />, t: "3–4 Items Combo" },
                      { icon: <CheckCircle size={16} className="text-emerald-300" />, t: "Same Category Only" },
                      { icon: <Sparkles size={16} className="text-cyan-200" />, t: "Smart Picks" },
                    ].map((x) => (
                      <div key={x.t} className="rounded-2xl bg-white/10 border border-white/15 px-3 py-2 flex items-center gap-2">
                        {x.icon}
                        <div className="text-[11px] md:text-xs font-extrabold text-white">{x.t}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex flex-col sm:flex-row gap-3">
                    <Link
                      href="/combo"
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-white text-[#0B1B4B] font-extrabold shadow-lg hover:opacity-95 transition"
                    >
                      Explore Combo Deals <ChevronRight size={18} />
                    </Link>

                    <Link
                      href="/products?category=Combo"
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-white/10 border border-white/20 text-white font-extrabold hover:bg-white/15 transition"
                    >
                      Browse Combo in All Products
                    </Link>
                  </div>
                </div>

                <div className="w-full lg:w-[520px]">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { tag: "Solved Assignments Combo", sub: "Most popular picks", badge: "HOT" },
                      { tag: "PYQ Combo Pack", sub: "Session-wise focus", badge: "NEW" },
                      { tag: "Guess Papers Combo", sub: "Exam-ready set", badge: "BEST" },
                      { tag: "Ebooks + Notes Combo", sub: "Quick revision", badge: "SAVE" },
                    ].map((b) => (
                      <div key={b.tag} className="rounded-2xl bg-white/10 border border-white/15 p-4 shadow-sm relative overflow-hidden">
                        <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[10px] font-extrabold text-white/90 uppercase tracking-wider">{b.badge}</div>
                          <div className="text-[10px] font-extrabold text-yellow-300">-25% OFF</div>
                        </div>
                        <div className="mt-2 text-sm md:text-base font-extrabold text-white leading-snug">{b.tag}</div>
                        <div className="mt-1 text-[12px] font-semibold text-white/80">{b.sub}</div>

                        <div className="mt-3 flex items-center gap-2">
                          <div className="h-10 w-7 rounded bg-white/25 border border-white/20" />
                          <div className="h-10 w-7 rounded bg-white/20 border border-white/20" />
                          <div className="h-10 w-7 rounded bg-white/15 border border-white/20" />
                          <div className="ml-auto text-[11px] font-extrabold text-white/85">3–4 items</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 rounded-2xl bg-black/20 border border-white/15 p-4">
                    <div className="text-[12px] font-extrabold text-white">Why students love combos</div>
                    <div className="mt-1 text-[12px] text-white/80 font-semibold leading-relaxed">
                      Same category ke best products together → preparation fast, aur price me extra saving.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ✅ POLISH: Quick trust strip */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-[1600px] mx-auto px-4 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { t: "Verified & Updated", d: "Session-wise material", icon: CheckCircle },
              { t: "Secure Payment", d: "UPI / Card", icon: ShieldCheck },
              { t: "Fast Support", d: "WhatsApp help", icon: Search },
              { t: "Delivery Options", d: "Hardcopy available", icon: Truck },
            ].map((x) => (
              <div 
                key={x.t} 
                className="group rounded-2xl border border-gray-200 bg-white shadow-sm p-4 flex items-center gap-3 transition-all duration-300 hover:bg-blue-50 hover:border-blue-200 cursor-pointer"
              >
                <div className="h-11 w-11 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-colors">
                  <x.icon size={20} className="text-slate-700 group-hover:text-blue-600 transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-slate-900 leading-tight group-hover:text-blue-800 transition-colors">{x.t}</div>
                  <div className="text-[12px] font-semibold text-slate-500 group-hover:text-blue-600/80 transition-colors">{x.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ✅ INDUSTRIAL CATEGORY SECTION (PREMIUM & OFFICIAL LOOK) */}
      <section className="relative py-16 bg-[#F8FAFC] overflow-hidden">
        {/* Subtle Background Elements */}
        <div className="absolute inset-0 isp-grid opacity-30" />
        
        <div className="relative max-w-[1600px] mx-auto px-4">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 text-[11px] font-extrabold text-blue-700 shadow-sm">
                <Sparkles size={14} /> Official Study Material
              </div>
              <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
                Browse by Category
              </h2>
              <p className="mt-2 text-sm md:text-base font-medium text-slate-500 max-w-2xl">
                Select your required material type below.
              </p>
            </div>

            <div className="flex gap-3">
              <Link
                href="/products"
                className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-white border border-gray-200 font-bold text-slate-700 hover:bg-gray-50 hover:text-slate-900 transition shadow-sm text-sm"
              >
                View All Products <ArrowRight size={16} className="ml-2" />
              </Link>
            </div>
          </div>

          {/* ✅ Scalable Flex Layout for Center Alignment of Last Row */}
          <div className="flex flex-wrap justify-center gap-5">
            {categories.map((cat) => (
              <Link
                key={cat.title}
                href={cat.href}
                aria-label={cat.title}
                // ✅ Changed: cardBg is now PERMANENT (not hover). Added slightly brighter/visible BG colors.
                className={`group relative w-full sm:w-[calc(50%-10px)] lg:w-[calc(25%-15px)] ${cat.cardBg} ${cat.borderColor} border rounded-2xl px-5 py-6 min-h-[160px] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex items-start gap-4 overflow-hidden`}
              >
                {/* Badge if exists */}
                {cat.badge && (
                  <div className="absolute top-0 right-0 bg-gray-900 text-white text-[9px] font-bold px-2 py-1 rounded-bl-xl z-10 shadow-sm">
                    {cat.badge}
                  </div>
                )}

                {/* Official Icon Container (White bg to pop against color card) */}
                <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform duration-500 group-hover:scale-110 ${cat.iconBgClass}`}>
                  <cat.icon size={26} className={cat.colorClass} />
                </div>

                <div className="min-w-0 pt-1">
                  <h3 className="text-base font-bold text-slate-900 leading-tight">
                    {cat.title}
                  </h3>
                  <p className="mt-1 text-xs font-medium text-slate-600 line-clamp-2">
                    {cat.subtitle}
                  </p>
                  
                  {/* Link text */}
                  <div className={`mt-4 inline-flex items-center text-[11px] font-bold ${cat.colorClass} opacity-80 group-hover:opacity-100 transition-opacity`}>
                    Explore <ChevronRight size={14} className="ml-0.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* ✅ small SEO support line */}
          <div className="mt-10 text-center text-[12px] md:text-sm text-slate-400 font-medium">
            Tip: Select a category above → then use filters to find your exact course code.
          </div>
        </div>
      </section>

      {/* 3. Courses (course click -> /products?course=CODE) */}
      <section className="py-12 md:py-16 bg-white">
        <div className="max-w-[1600px] mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-800">Explore Our Courses</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
            {courses.map((course, i) => (
              <Link
                key={i}
                href={`/products?course=${encodeURIComponent(course.code)}`}
                className="bg-white border border-gray-100 p-3 md:p-4 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col items-center text-center h-full"
                aria-label={`Browse products for ${course.code}`}
              >
                <div className="w-full h-20 md:h-24 bg-slate-50 rounded-lg mb-3 flex items-center justify-center overflow-hidden relative">
                  <div className="absolute inset-0 flex items-center justify-center opacity-10">
                    <BookOpen size={50} />
                  </div>
                  <span className="font-black text-xl md:text-2xl text-slate-700 z-10">{course.code}</span>
                </div>
                <h3 className="font-bold text-slate-800 text-xs md:text-sm mb-1">{course.code}</h3>
                <p className="text-[10px] md:text-xs text-slate-500 line-clamp-2">{course.name}</p>
              </Link>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/courses"
              className="inline-flex items-center justify-center bg-slate-800 text-white px-8 py-3 rounded-full font-bold hover:bg-slate-700 transition shadow-lg hover:shadow-slate-300/50"
            >
              <Link href="/courses">View All Courses</Link>
            </Link>
          </div>
        </div>
      </section>

      {/* 4. Benefits */}
      <section className="py-12 md:py-16 bg-[#F0F7FF]">
        <div className="max-w-[1600px] mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-[#1E3A8A] mb-2 uppercase tracking-wide">
              BENEFITS OVER COMPETITORS
            </h2>
            <p className="text-slate-500 font-medium">Why choose us?</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
            {benefits.map((item, index) => (
              <div
                key={index}
                className="group bg-white border border-blue-100 p-4 md:p-6 rounded-2xl text-center hover:border-blue-600 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 cursor-pointer flex flex-col items-center h-full"
              >
                <div
                  className={`w-14 h-14 md:w-20 md:h-20 rounded-2xl flex items-center justify-center mb-3 md:mb-5 shadow-sm text-white ${item.bgColor} transform transition-transform duration-300 group-hover:scale-110`}
                >
                  <item.icon size={28} className="md:w-9 md:h-9" strokeWidth={2.5} />
                </div>
                <h3 className="font-bold text-slate-900 mb-1 leading-tight text-sm md:text-lg">{item.title}</h3>
                <p className="text-slate-500 text-xs md:text-sm px-1 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Latest Assignments */}
      <section className="py-16 bg-white">
        <div className="max-w-[1600px] mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-800 border-b-4 border-blue-600 inline-block pb-1">
              Latest Updated Assignments
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div
                key={item}
                className="group border border-gray-200 rounded-lg overflow-hidden hover:shadow-xl transition-all duration-300 bg-white hover:-translate-y-2"
              >
                <div className="h-[220px] md:h-[280px] bg-gray-100 relative flex items-center justify-center overflow-hidden">
                  <div className="w-[80%] h-[90%] bg-white shadow-md flex items-center justify-center border border-gray-200">
                    <span className="text-gray-300 font-bold rotate-45 text-xs md:text-base">COVER IMG</span>
                  </div>
                  <span className="absolute top-2 left-2 bg-green-600 text-white text-[10px] font-bold px-2 py-1 rounded">
                    NEW
                  </span>
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
            <Link
              href="/products"
              className="inline-flex items-center justify-center bg-transparent border-2 border-blue-600 text-blue-600 px-8 py-2 md:px-10 md:py-3 rounded-full font-bold hover:bg-blue-600 hover:text-white transition uppercase tracking-wide text-sm md:text-base"
            >
              View All Products
            </Link>
          </div>
        </div>
      </section>

      {/* 6. Testimonials */}
      <HomeTestimonials reviews={reviews} />

      {/* 7. Blog */}
      <section className="py-16 bg-white">
        <div className="max-w-[1600px] mx-auto px-4">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-2xl font-bold text-slate-800">Latest from our Blog</h2>
            <Link href="/blog" className="text-blue-600 font-medium hover:underline text-sm">
              Read All
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {blogs.map((b) => (
              <Link key={b.slug} href={`/blog/${b.slug}`} className="group cursor-pointer" aria-label={b.title}>
                <div className="h-56 bg-gray-200 rounded-xl mb-4 overflow-hidden relative">
                  <div className="absolute inset-0 bg-slate-300 group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="flex items-center gap-2 text-xs text-blue-600 font-bold mb-2 uppercase tracking-wider">
                  <Calendar size={12} /> <span>{b.date}</span>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-blue-600 transition">{b.title}</h3>
                <p className="text-slate-500 text-sm line-clamp-2">{b.excerpt}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 8. CTA Banner (unchanged) */}
      <section className="py-20 bg-[#F8FAFC]">
        <div className="max-w-[1200px] mx-auto px-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-16 text-center relative border border-gray-100 mt-8">
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-4 rounded-full shadow-lg border border-blue-50 z-10">
              <FileText className="text-blue-600" size={32} />
            </div>

            <div className="mt-6">
              <h2 className="text-2xl md:text-4xl font-extrabold text-[#1E3A8A] mb-4 leading-tight">
                ARE YOU LOOKING FOR <span className="text-blue-600">CUSTOMIZED projects REPORT / SYNOPSIS?</span>
              </h2>

              <p className="text-slate-600 text-lg mb-8 max-w-3xl mx-auto">
                Looking for the best IGNOU projects reports and synopsis? Worry no more! Get customized IGNOU projects Report with a{" "}
                <span className="bg-blue-100 text-blue-800 px-2 font-bold rounded">100% guarantee of approval</span>.
              </p>

              <div className="flex flex-col sm:flex-row justify-center gap-4 mb-10">
                <button className="flex items-center justify-center gap-2 bg-[#25D366] text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-[#20bd5a] hover:scale-105 hover:shadow-lg hover:shadow-green-200 transition-all duration-300">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.592 2.654-.696c1.001.574 2.146.877 3.303.877 3.18 0 5.767-2.587 5.768-5.766.001-3.181-2.584-5.761-5.765-5.761zm6.927 5.766c-.001 3.82-3.107 6.925-6.927 6.925-1.129 0-2.235-.291-3.21-.842l-3.593.942.958-3.504c-.628-1.04-1.002-2.213-1.002-3.521-.001-3.819 3.106-6.925 6.927-6.925 3.82 0 6.926 3.106 6.927 6.925z" />
                    <path d="M15.42 13.064c-.177-.089-1.047-.516-1.209-.576-.161-.059-.279-.089-.396.089-.118.178-.456.576-.559.694-.102.119-.205.133-.382.045-.178-.089-.751-.277-1.429-.882-.53-.473-.888-1.057-.992-1.235-.104-.177-.011-.273.078-.362.08-.08.178-.207.266-.31.089-.104.119-.178.178-.297.059-.118.029-.222-.015-.31-.044-.089-.396-.955-.542-1.309-.143-.343-.288-.296-.396-.301-.102-.005-.219-.005-.337-.005-.118 0-.31.044-.472.222-.162.178-.62.606-.62 1.478 0 .872.635 1.714.723 1.833.089.119 1.251 1.91 3.03 2.678 1.054.455 1.47.532 1.996.448.586-.093 1.047-.428 1.195-.841.148-.414.148-.769.104-.841-.044-.074-.162-.119-.339-.207z" />
                  </svg>
                  START WHATSAPP CHAT
                </button>

                <button className="flex items-center justify-center gap-2 bg-[#1E40AF] text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-[#1e3a8a] hover:scale-105 hover:shadow-lg hover:shadow-blue-200 transition-all duration-300">
                  <Phone size={24} />
                  CALL US NOW
                </button>
              </div>

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

      <Footer />
      <FloatingButtons />
    </main>
  );
}