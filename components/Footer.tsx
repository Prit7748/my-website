"use client";
import Link from "next/link";
import { Facebook, Instagram, Twitter, Youtube, MapPin, Mail, Phone, ChevronRight, Send } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 font-sans">
      
      {/* Top Section: Newsletter */}
      <div className="border-b border-slate-800 bg-slate-950/50">
        <div className="max-w-[1600px] mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
           <div className="text-center md:text-left">
              <h3 className="text-white text-lg font-bold">Join our IGNOU Community</h3>
              <p className="text-sm text-slate-400">Get exam tips, updates and special offers.</p>
           </div>
           <div className="flex w-full md:w-auto gap-2">
              <input type="email" placeholder="Enter your email" className="bg-slate-800 border border-slate-700 text-white px-4 py-2.5 rounded-lg outline-none focus:border-blue-500 w-full md:w-64" />
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold transition flex items-center gap-2">
                 Subscribe <Send size={16}/>
              </button>
           </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="max-w-[1600px] mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          
          {/* Column 1: About & Social */}
          <div className="space-y-6">
             <h2 className="text-2xl font-bold text-white flex items-center gap-2">
               <img src="/logo.png" alt="Logo" className="h-10 brightness-0 invert opacity-90"/> {/* White Logo */}
             </h2>
             <p className="text-sm leading-relaxed text-slate-400">
               Your one-stop destination for IGNOU solved assignments, handwritten notes, and project help. We ensure 90+ marks quality content created by toppers.
             </p>
             <div className="flex gap-4 pt-2">
                <a href="#" className="bg-slate-800 p-2.5 rounded-full hover:bg-blue-600 hover:text-white transition"><Facebook size={18}/></a>
                <a href="#" className="bg-slate-800 p-2.5 rounded-full hover:bg-pink-600 hover:text-white transition"><Instagram size={18}/></a>
                <a href="#" className="bg-slate-800 p-2.5 rounded-full hover:bg-sky-500 hover:text-white transition"><Twitter size={18}/></a>
                <a href="#" className="bg-slate-800 p-2.5 rounded-full hover:bg-red-600 hover:text-white transition"><Youtube size={18}/></a>
             </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
             <h3 className="text-white font-bold text-lg mb-6 relative inline-block">
                Quick Links
                <span className="absolute bottom-0 left-0 w-1/2 h-0.5 bg-blue-600 -mb-2"></span>
             </h3>
             <ul className="space-y-3 text-sm">
                <li><Link href="/" className="hover:text-blue-400 flex items-center gap-2 transition"><ChevronRight size={14}/> Home</Link></li>
                <li><Link href="/about" className="hover:text-blue-400 flex items-center gap-2 transition"><ChevronRight size={14}/> About Us</Link></li>
                <li><Link href="/blog" className="hover:text-blue-400 flex items-center gap-2 transition"><ChevronRight size={14}/> Blog / Updates</Link></li>
                <li><Link href="/contact" className="hover:text-blue-400 flex items-center gap-2 transition"><ChevronRight size={14}/> Contact Support</Link></li>
                <li><Link href="/solved-assignments" className="hover:text-blue-400 flex items-center gap-2 transition"><ChevronRight size={14}/> Buy Assignments</Link></li>
             </ul>
          </div>

          {/* Column 3: Policies */}
          <div>
             <h3 className="text-white font-bold text-lg mb-6 relative inline-block">
                Policy Info
                <span className="absolute bottom-0 left-0 w-1/2 h-0.5 bg-blue-600 -mb-2"></span>
             </h3>
             <ul className="space-y-3 text-sm">
                <li><Link href="/privacy" className="hover:text-blue-400 flex items-center gap-2 transition"><ChevronRight size={14}/> Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-blue-400 flex items-center gap-2 transition"><ChevronRight size={14}/> Terms & Conditions</Link></li>
                <li><Link href="/refund-policy" className="hover:text-blue-400 flex items-center gap-2 transition"><ChevronRight size={14}/> Refund Policy</Link></li>
                <li><Link href="/faq" className="hover:text-blue-400 flex items-center gap-2 transition"><ChevronRight size={14}/> Help & FAQs</Link></li>
             </ul>
          </div>

          {/* Column 4: Contact Info */}
          <div>
             <h3 className="text-white font-bold text-lg mb-6 relative inline-block">
                Get In Touch
                <span className="absolute bottom-0 left-0 w-1/2 h-0.5 bg-blue-600 -mb-2"></span>
             </h3>
             <ul className="space-y-4 text-sm">
                <li className="flex items-start gap-3">
                   <MapPin className="text-blue-500 mt-1 flex-shrink-0" size={18}/>
                   <span>123, Student Lane, Near IGNOU Main Office,<br/> New Delhi - 110068</span>
                </li>
                <li className="flex items-center gap-3">
                   <Phone className="text-blue-500 flex-shrink-0" size={18}/>
                   <span>+91 98765 43210</span>
                </li>
                <li className="flex items-center gap-3">
                   <Mail className="text-blue-500 flex-shrink-0" size={18}/>
                   <span>support@ignouportal.com</span>
                </li>
             </ul>
          </div>

        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-slate-800 bg-slate-950 py-6">
         <div className="max-w-[1600px] mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>&copy; {new Date().getFullYear()} IGNOU Students Portal. All Rights Reserved.</p>
            <div className="flex items-center gap-2">
               <span className="font-bold">We Accept:</span>
               <div className="flex gap-1 opacity-70 grayscale hover:grayscale-0 transition">
                  <div className="bg-white text-slate-900 px-2 py-1 rounded font-bold text-[10px]">UPI</div>
                  <div className="bg-white text-slate-900 px-2 py-1 rounded font-bold text-[10px]">VISA</div>
                  <div className="bg-white text-slate-900 px-2 py-1 rounded font-bold text-[10px]">RuPay</div>
               </div>
            </div>
         </div>
      </div>
    </footer>
  );
}