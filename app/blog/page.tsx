"use client";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import TopBar from "../../components/TopBar";
import Link from "next/link";
import { Calendar, Clock, ChevronRight, Tag, TrendingUp, BookOpen, Bell, Zap } from "lucide-react";

export default function BlogPage() {
  // --- DUMMY DATA ---
  const featuredPost = {
    id: 1,
    title: "IGNOU TEE June 2026: Complete Exam Strategy & Study Plan by Toppers",
    excerpt: "Stop worrying and start preparing. Here is the exact 60-day roadmap used by IGNOU gold medalists to score 90+ marks in Term End Exams without stress.",
    date: "Jan 30, 2026",
    readTime: "8 min read",
    category: "Exam Strategy",
    image: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=1000&auto=format&fit=crop" // Placeholder Image
  };

  const categories = [
    { name: "All Posts", icon: Zap, active: true },
    { name: "Exam Tips & Tricks", icon: TrendingUp, active: false },
    { name: "IGNOU News & Updates", icon: Bell, active: false },
    { name: "Study Guides & Notes", icon: BookOpen, active: false },
  ];

  const blogPosts = [
    { 
      id: 2, title: "How to Download IGNOU Hall Ticket June 2026? (Step-by-Step)", 
      excerpt: "The official link is active now. Follow these simple steps to download your admit card correctly and check for errors.",
      date: "Jan 28, 2026", category: "News", readTime: "3 min read",
      bg: "bg-blue-50", text: "text-blue-600"
    },
    { 
      id: 3, title: "Assignment vs. Project vs. Dissertation: What's the Difference?", 
      excerpt: "Confused between these three? Understand the evaluation criteria, submission deadlines, and weightage for each.",
      date: "Jan 25, 2026", category: "Guide", readTime: "5 min read",
      bg: "bg-purple-50", text: "text-purple-600"
    },
    { 
      id: 4, title: "Top 5 Mistakes Students Make in IGNOU Assignment Writing", 
      excerpt: "Are you losing marks unnecessarily? Avoid these common pitfalls to ensure your tutor gives you full marks.",
      date: "Jan 20, 2026", category: "Exam Tips", readTime: "6 min read",
      bg: "bg-pink-50", text: "text-pink-600"
    },
    { 
      id: 5, title: "Is IGNOU Degree Valid for Govt Jobs & UPSC? (Myth busted)", 
      excerpt: "A detailed analysis regarding the validity and recognition of IGNOU degrees across India and abroad.",
      date: "Jan 15, 2026", category: "Guide", readTime: "4 min read",
      bg: "bg-purple-50", text: "text-purple-600"
    },
    { 
      id: 6, title: "IGNOU Re-Registration July 2026: Last Date & Process", 
      excerpt: "Don't miss your next semester. Check the complete procedure to re-register online before the portal closes.",
      date: "Jan 10, 2026", category: "News", readTime: "3 min read",
      bg: "bg-blue-50", text: "text-blue-600"
    },
  ];

  return (
    <main className="min-h-screen bg-gray-50 font-sans text-slate-800">
      <TopBar />
      <Navbar />

      {/* ================= RIBBON 1: HERO / FEATURED POST (Dark Blue Gradient) ================= */}
      <section className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 py-16 text-white">
         <div className="max-w-[1200px] mx-auto px-4">
            <div className="flex flex-col md:flex-row gap-8 items-center rounded-2xl overflow-hidden bg-white/10 backdrop-blur-sm border border-white/10 p-1 md:p-2">
               
               {/* Image Side */}
               <div className="w-full md:w-1/2 h-64 md:h-auto relative rounded-xl overflow-hidden">
                  <img src={featuredPost.image} alt="Featured Blog Post" className="w-full h-full object-cover hover:scale-105 transition duration-500"/>
                  <div className="absolute top-4 left-4 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-lg">
                    <Zap size={14} /> Featured
                  </div>
               </div>
               
               {/* Content Side */}
               <div className="w-full md:w-1/2 p-4 md:p-8 flex flex-col justify-center">
                  <div className="flex items-center gap-4 text-blue-200 text-sm mb-4">
                     <span className="flex items-center gap-1"><Calendar size={14}/> {featuredPost.date}</span>
                     <span className="flex items-center gap-1"><Clock size={14}/> {featuredPost.readTime}</span>
                  </div>
                  <h1 className="text-2xl md:text-4xl font-bold mb-4 leading-tight hover:text-blue-300 transition cursor-pointer">
                     {featuredPost.title}
                  </h1>
                  <p className="text-blue-100 text-lg mb-6 line-clamp-3">
                     {featuredPost.excerpt}
                  </p>
                  <div>
                     <Link href="#" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full font-bold transition inline-flex items-center gap-2">
                        Read Full Article <ChevronRight size={18}/>
                     </Link>
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* ================= RIBBON 2: CATEGORY FILTER (Clean White) ================= */}
      <section className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
         <div className="max-w-[1200px] mx-auto px-4 py-4 overflow-x-auto no-scrollbar flex gap-3">
            {categories.map((cat, idx) => (
               <button key={idx} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition ${cat.active ? 'bg-slate-900 text-white shadow-md' : 'bg-gray-100 text-slate-600 hover:bg-gray-200'}`}>
                  <cat.icon size={16}/> {cat.name}
               </button>
            ))}
         </div>
      </section>

      {/* ================= RIBBON 3: LATEST POSTS GRID (Light Gray) ================= */}
      <section className="py-16">
         <div className="max-w-[1200px] mx-auto px-4">
            <div className="flex items-center justify-between mb-10">
               <h2 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2">
                  Latest Articles <span className="hidden md:inline-block h-1 w-20 bg-blue-600 rounded-full ml-2"></span>
               </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
               {blogPosts.map((post) => (
                  <article key={post.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition duration-300 group flex flex-col h-full">
                     {/* Card Header (Placeholder Image & Category) */}
                     <div className={`h-48 ${post.bg} relative flex items-center justify-center overflow-hidden`}>
                        {/* Replace this div with an actual <img> tag in future */}
                        <div className={`opacity-30 ${post.text}`}>
                           <Tag size={48} />
                        </div>
                        
                        <span className={`absolute top-4 left-4 bg-white ${post.text} text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm`}>
                           {post.category}
                        </span>
                     </div>

                     {/* Card Body */}
                     <div className="p-6 flex flex-col flex-1">
                        <div className="flex items-center gap-3 text-gray-400 text-xs mb-3">
                           <span className="flex items-center gap-1"><Calendar size={12}/> {post.date}</span>
                           <span className="flex items-center gap-1"><Clock size={12}/> {post.readTime}</span>
                        </div>
                        
                        <h3 className="text-xl font-bold text-slate-900 mb-3 leading-snug group-hover:text-blue-600 transition line-clamp-2">
                           <a href="#">{post.title}</a>
                        </h3>
                        
                        <p className="text-sm text-slate-500 mb-6 line-clamp-3 flex-1 leading-relaxed">
                           {post.excerpt}
                        </p>
                        
                        <div className="mt-auto pt-4 border-t border-gray-100">
                           <Link href="#" className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition group/link">
                              Read More <ChevronRight size={16} className="group-hover/link:translate-x-1 transition"/>
                           </Link>
                        </div>
                     </div>
                  </article>
               ))}
            </div>

            {/* Load More Button */}
            <div className="text-center mt-12">
               <button className="bg-white border-2 border-slate-900 text-slate-900 px-8 py-3 rounded-full font-bold hover:bg-slate-900 hover:text-white transition">
                  Load More Articles
               </button>
            </div>
         </div>
      </section>

      {/* ================= RIBBON 4: NEWSLETTER CTA (Blue Gradient) ================= */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-700 py-16 text-center text-white relative overflow-hidden">
         <div className="absolute inset-0 bg-[url('/pattern.png')] opacity-10"></div>
         <div className="max-w-xl mx-auto px-4 relative z-10">
            <Bell size={40} className="mx-auto mb-4 text-blue-200"/>
            <h2 className="text-3xl font-bold mb-4">Never Miss an IGNOU Update</h2>
            <p className="text-blue-100 mb-8">
               Get the latest exam news, free study tips, and exclusive offers delivered straight to your inbox.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto p-1 bg-white/10 rounded-xl backdrop-blur-md">
               <input type="email" placeholder="Enter your email address" className="flex-1 bg-white/90 text-slate-800 px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-slate-400" />
               <button className="bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-lg font-bold transition whitespace-nowrap">
                  Subscribe Now
               </button>
            </div>
            <p className="text-xs text-blue-200 mt-4">No spam, ever. Unsubscribe anytime.</p>
         </div>
      </section>

      <Footer />
    </main>
  );
}