"use client";
import { Instagram, Youtube } from "lucide-react";
import Link from "next/link";

export default function TopBar() {
  return (
    <div className="bg-[#FFF0F5] text-[16px] md:text-[14px] border-b border-pink-100 font-sans">
      <div className="max-w-[1600px] mx-auto px-5 py-2 flex flex-col md:flex-row justify-between items-center gap-2">
        
        {/* Left Side: Delivery & Phone */}
        <div className="flex items-center gap-2 md:gap-6 text-slate-600 font-medium tracking-wide">
          <span>Same Day Delivery in Delhi</span>
          <a href="tel:7496865680" className="text-blue-600 font-bold hover:underline">7496865680</a>
        </div>

        {/* Right Side: Links & Icons */}
        <div className="flex items-center gap-4">
          
          {/* Links Section */}
          <div className="flex gap-3 text-slate-500 font-medium">
            {/* 👇 LINKS UPDATED HERE */}
            <Link href="/about" className="hover:text-[#E1306C] transition">About</Link>
            <Link href="/faq" className="hover:text-[#E1306C] transition">FAQ</Link>
            <Link href="/blog" className="hover:text-[#E1306C] transition">Blog</Link>
          </div>

          {/* Social Icons */}
          <div className="flex gap-2">
            <a href="#" className="bg-[#E1306C] text-white p-1 rounded-full hover:opacity-80 transition shadow-sm">
                <Instagram size={20} />
            </a>
            <a href="#" className="bg-[#FF0000] text-white p-1 rounded-full hover:opacity-80 transition shadow-sm">
                <Youtube size={20} />
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}