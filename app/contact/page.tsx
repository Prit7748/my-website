"use client";
import { useState } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import TopBar from "../../components/TopBar"; // 👈 Added TopBar Import
import { Mail, MapPin, Phone, Send, MessageCircle, Clock, CheckCircle } from "lucide-react";

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = (e: any) => {
    e.preventDefault();
    // API call logic here
    setIsSent(true);
    setTimeout(() => setIsSent(false), 3000);
  };

  return (
    <main className="min-h-screen bg-gray-50 font-sans text-slate-800">
      {/* 👇 TopBar Added Here */}
      <TopBar />
      <Navbar />

      {/* Header Banner */}
      <div className="bg-blue-900 py-16 text-center text-white relative overflow-hidden">
        {/* Pattern Overlay */}
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        <div className="relative z-10">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Contact Us</h1>
            <p className="text-blue-100">Have questions? We're here to help 24/7.</p>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 py-12 -mt-10 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Contact Info Cards */}
          <div className="space-y-4">
             {/* WhatsApp Card */}
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-green-100 flex items-start gap-4 hover:shadow-md transition">
                <div className="bg-green-100 p-3 rounded-full text-green-600">
                   <MessageCircle size={24} />
                </div>
                <div>
                   <h3 className="font-bold text-slate-900">WhatsApp Support</h3>
                   <p className="text-sm text-slate-500 mb-3">Fastest reply within 10 mins.</p>
                   <a 
                     href="https://wa.me/917496865680" 
                     target="_blank"
                     className="text-sm font-bold text-green-600 hover:underline flex items-center gap-1"
                   >
                     Chat Now <Send size={12}/>
                   </a>
                </div>
             </div>

             {/* Email Card */}
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start gap-4 hover:shadow-md transition">
                <div className="bg-blue-50 p-3 rounded-full text-blue-600">
                   <Mail size={24} />
                </div>
                <div>
                   <h3 className="font-bold text-slate-900">Email Us</h3>
                   <p className="text-sm text-slate-500 mb-3">For order issues & PDFs.</p>
                   <a href="mailto:support@ignouportal.com" className="text-sm font-bold text-blue-600 hover:underline">
                     support@ignouportal.com
                   </a>
                </div>
             </div>

             {/* Office Address */}
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start gap-4 hover:shadow-md transition">
                <div className="bg-orange-50 p-3 rounded-full text-orange-600">
                   <MapPin size={24} />
                </div>
                <div>
                   <h3 className="font-bold text-slate-900">Head Office</h3>
                   <p className="text-sm text-slate-500">
                     Hansi, Haryana<br/> India
                   </p>
                </div>
             </div>
          </div>

          {/* Right Column: Inquiry Form */}
          <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-lg border border-gray-100">
             <h2 className="text-2xl font-bold text-slate-900 mb-6">Send a Message</h2>
             
             {isSent ? (
               <div className="bg-green-50 text-green-700 p-6 rounded-xl flex flex-col items-center justify-center gap-2 h-64 text-center">
                  <CheckCircle size={48} className="mb-2"/>
                  <h3 className="text-xl font-bold">Message Sent!</h3>
                  <p>Thank you for contacting us. We will get back to you shortly.</p>
               </div>
             ) : (
               <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Your Name</label>
                        <input required type="text" placeholder="John Doe" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition"/>
                     </div>
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Phone / WhatsApp</label>
                        <input required type="tel" placeholder="+91 99999..." className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition"/>
                     </div>
                  </div>

                  <div className="space-y-2">
                     <label className="text-xs font-bold text-slate-500 uppercase">Email Address</label>
                     <input required type="email" placeholder="student@example.com" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition"/>
                  </div>

                  <div className="space-y-2">
                     <label className="text-xs font-bold text-slate-500 uppercase">Your Message</label>
                     <textarea required rows={4} placeholder="Type your query regarding assignments or notes..." className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition resize-none"></textarea>
                  </div>

                  <button className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold hover:bg-black transition w-full md:w-auto flex items-center justify-center gap-2 shadow-lg hover:shadow-xl">
                     Send Message <Send size={18}/>
                  </button>
               </form>
             )}
          </div>

        </div>
      </div>

      <Footer />
    </main>
  );
}