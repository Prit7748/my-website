"use client";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import TopBar from "../../components/TopBar"; // 👈 Added TopBar Import
import { 
  Target, Users, BookOpen, Award, CheckCircle, 
  ArrowRight, Star, ShieldCheck, Clock 
} from "lucide-react";

export default function AboutPage() {
  return (
    <main className="min-h-screen font-sans text-slate-800">
      {/* 👇 Added TopBar here */}
      <TopBar />
      <Navbar />

      {/* ================= RIBBON 1: HERO SECTION (Royal Blue) ================= */}
      <section className="bg-gradient-to-r from-blue-900 to-indigo-800 py-20 text-white relative overflow-hidden">
         {/* Background Pattern */}
         <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
         
         <div className="max-w-[1200px] mx-auto px-4 text-center relative z-10">
            <span className="inline-block py-1 px-3 rounded-full bg-blue-700 border border-blue-500 text-xs font-bold tracking-wider mb-4 animate-in fade-in slide-in-from-bottom-3">
               EST. 2024 • TRUSTED BY THOUSANDS
            </span>
            <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">
               Your Partner in <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-cyan-200">Success</span>
            </h1>
            <p className="text-blue-100 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
               We bridge the gap between distance learning and academic excellence. 
               Get <strong>90+ Marks Guaranteed</strong> Solved Assignments, Notes & projects.
            </p>
         </div>
      </section>

      {/* ================= RIBBON 2: WHO WE ARE (Clean White) ================= */}
      <section className="bg-white py-16 md:py-24">
         <div className="max-w-[1200px] mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
               
               {/* Left: Text Content */}
               <div className="space-y-6">
                  <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
                     More Than Just a <span className="text-blue-600">Website</span>
                  </h2>
                  <div className="w-20 h-1.5 bg-blue-600 rounded-full"></div>
                  
                  <p className="text-slate-600 text-lg leading-relaxed">
                     <strong>IGNOU Students Portal</strong> wasn't built by businessmen; it was built by <strong>ex-IGNOU Toppers</strong>. We understand the struggle of finding accurate answers, managing tight deadlines, and the confusion of the vast syllabus.
                  </p>
                  <p className="text-slate-600 text-lg leading-relaxed">
                     Unlike others who use copy-paste content, our team of subject matter experts creates unique, error-free, and high-quality content tailored to help you score the highest grades in TEE (Term End Exams).
                  </p>
                  
                  <div className="flex gap-4 pt-4">
                     <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                        <CheckCircle className="text-green-500" size={20}/> 100% Verified
                     </div>
                     <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                        <CheckCircle className="text-green-500" size={20}/> Latest Syllabus
                     </div>
                  </div>
               </div>

               {/* Right: Image/Graphic Placeholder */}
               <div className="relative">
                  <div className="absolute -inset-4 bg-blue-100 rounded-full blur-3xl opacity-50"></div>
                  <div className="relative bg-gradient-to-br from-slate-50 to-blue-50 border border-blue-100 rounded-2xl p-8 shadow-xl">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-6 rounded-xl shadow-sm text-center">
                           <Users className="text-blue-600 mx-auto mb-2" size={32}/>
                           <h3 className="font-bold text-2xl">10k+</h3>
                           <p className="text-xs text-gray-500">Happy Students</p>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm text-center">
                           <BookOpen className="text-pink-600 mx-auto mb-2" size={32}/>
                           <h3 className="font-bold text-2xl">5000+</h3>
                           <p className="text-xs text-gray-500">Solved Papers</p>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm text-center col-span-2">
                           <Award className="text-yellow-500 mx-auto mb-2" size={32}/>
                           <h3 className="font-bold text-2xl">#1 Rated</h3>
                           <p className="text-xs text-gray-500">Study Material Provider</p>
                        </div>
                     </div>
                  </div>
               </div>

            </div>
         </div>
      </section>

      {/* ================= RIBBON 3: OUR MISSION (Soft Purple Gradient) ================= */}
      <section className="bg-gradient-to-r from-violet-50 to-fuchsia-50 py-20 border-y border-violet-100">
         <div className="max-w-[1000px] mx-auto px-4 text-center">
            <span className="text-violet-600 font-bold tracking-widest uppercase text-sm">Our Philosophy</span>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mt-2 mb-10">Driven by Purpose, Not Just Profit</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               {/* Mission Card */}
               <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition border border-violet-100 text-left relative overflow-hidden group">
                  <div className="absolute top-0 right-0 bg-violet-100 w-24 h-24 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition"></div>
                  <Target className="text-violet-600 mb-4" size={40}/>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">Our Mission</h3>
                  <p className="text-slate-600 leading-relaxed">
                     To empower every distance learner with affordable, high-quality, and accessible educational resources, ensuring that lack of guidance never becomes a barrier to a degree.
                  </p>
               </div>

               {/* Vision Card */}
               <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition border border-violet-100 text-left relative overflow-hidden group">
                  <div className="absolute top-0 right-0 bg-pink-100 w-24 h-24 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition"></div>
                  <Star className="text-pink-600 mb-4" size={40}/>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">Our Vision</h3>
                  <p className="text-slate-600 leading-relaxed">
                     To become India's most trusted digital companion for IGNOU students, providing everything from admission help to final degree projects guidance under one roof.
                  </p>
               </div>
            </div>
         </div>
      </section>

      {/* ================= RIBBON 4: WHY CHOOSE US (Mint/Teal) ================= */}
      <section className="bg-[#F0FDFA] py-20">
         <div className="max-w-[1200px] mx-auto px-4">
            <div className="text-center mb-12">
               <h2 className="text-3xl font-bold text-slate-900">Why Students Trust Us?</h2>
               <p className="text-slate-500 mt-2">We don't just sell PDFs; we sell peace of mind.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               {[
                  { icon: Star, color: "text-yellow-500", bg: "bg-yellow-50", title: "90+ Marks Quality", desc: "Answers written to impress evaluators." },
                  { icon: Clock, color: "text-blue-500", bg: "bg-blue-50", title: "Instant Download", desc: "No waiting. Get files immediately after payment." },
                  { icon: ShieldCheck, color: "text-green-500", bg: "bg-green-50", title: "100% Secure", desc: "Safe payments via Razorpay & Privacy protection." },
                  { icon: Users, color: "text-purple-500", bg: "bg-purple-50", title: "24/7 Support", desc: "Dedicated WhatsApp support for all your queries." },
               ].map((item, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-xl border border-teal-100 shadow-sm hover:-translate-y-1 transition duration-300">
                     <div className={`w-12 h-12 ${item.bg} ${item.color} rounded-lg flex items-center justify-center mb-4`}>
                        <item.icon size={24}/>
                     </div>
                     <h3 className="font-bold text-slate-900 mb-2">{item.title}</h3>
                     <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                  </div>
               ))}
            </div>
         </div>
      </section>

      {/* ================= RIBBON 5: CTA (Dark) ================= */}
      <section className="bg-slate-900 py-16 text-center text-white relative overflow-hidden">
         <div className="absolute inset-0 bg-[url('/pattern.png')] opacity-5"></div>
         <div className="max-w-2xl mx-auto px-4 relative z-10">
            <h2 className="text-3xl font-bold mb-4">Ready to boost your grades?</h2>
            <p className="text-slate-400 mb-8 text-lg">
               Join the community of smart learners. Download your assignments today and start writing.
            </p>
            <Link href="/solved-assignments" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full font-bold text-lg transition shadow-lg shadow-blue-900/50">
               Browse Study Material <ArrowRight size={20}/>
            </Link>
         </div>
      </section>

      <Footer />
    </main>
  );
}