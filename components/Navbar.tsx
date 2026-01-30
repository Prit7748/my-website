"use client";
import { useState } from "react";
import Link from "next/link";
import { Menu, X, ShoppingCart, Search, ChevronDown, ChevronUp, ChevronRight } from "lucide-react";

// 👇 1. Import Cart Hook
import { useCart } from "../context/CartContext";

// =======================================================
// INTERFACES (Types for TypeScript)
// =======================================================
interface NavLink {
  name: string;
  href: string;
  hasDropdown?: boolean;
  subLinks?: SubLink[];
}

interface SubLink {
  name: string;
  href: string;
  hasNestedDropdown?: boolean;
  nestedLinks?: { name: string; href: string }[];
}

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  
  // Level 1 Dropdown State (Mobile)
  const [mobileSubMenu, setMobileSubMenu] = useState<string | null>(null);
  
  // Level 2 Dropdown State (Mobile - Nested)
  const [mobileNestedMenu, setMobileNestedMenu] = useState<string | null>(null);

  // Search Popup State
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // 👇 2. Get Cart Count from Context
  const { cartCount } = useCart();

  // =======================================================
  // DATA: Main Links with Nested Structure
  // =======================================================
  const navLinks: NavLink[] = [
    { name: "Home", href: "/" },
    { 
      name: "IGNOU Assignments", 
      href: "/assignments", 
      hasDropdown: true, 
      subLinks: [
        { name: "Solved Assignments", href: "/solved-assignments" },
        { 
          name: "Handwritten Assignments", 
          href: "/handwritten-assignments",
          hasNestedDropdown: true, 
          nestedLinks: [
             { name: "Hardcopy Delivery", href: "/handwritten-hardcopy" },
             { name: "Handwritten PDFs", href: "/handwritten-pdfs" }
          ]
        },
        { name: "Project & Synopsis", href: "/projects" }
      ]
    },
    { name: "Question Papers (PYQs)", href: "/question-papers" },
    { name: "eBooks/Notes", href: "/ebooks" },
    { name: "Guess Paper", href: "/guess-papers" },
    { name: "Combo", href: "/combo" },
    { name: "Contact", href: "/contact" },
  ];

  // Mobile Menu Toggles
  const toggleSubMenu = (name: string) => {
    setMobileSubMenu(mobileSubMenu === name ? null : name);
    setMobileNestedMenu(null); 
  };

  const toggleNestedMenu = (name: string) => {
    setMobileNestedMenu(mobileNestedMenu === name ? null : name);
  };

  return (
    <>
    <nav className="bg-white sticky top-0 z-50 shadow-sm font-sans">
      <div className="max-w-[1600px] mx-auto px-4">
        
        <div className="flex items-center h-20">
          
          {/* LOGO */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <img src="/logo.png" alt="IGNOU Logo" className="h-10 md:h-12 w-auto object-contain" />
          </Link>

          {/* =======================================================
              DESKTOP MENU 
          ======================================================= */}
          <div className="hidden lg:flex items-center gap-5 xl:gap-8 ml-auto">
            {navLinks.map((link) => (
              <div key={link.name} className="relative group">
                <Link 
                  href={link.href} 
                  className="text-slate-700 text-[14px] xl:text-[15px] font-medium hover:text-blue-600 transition flex items-center gap-1 py-6"
                >
                  {link.name}
                  {link.hasDropdown && <ChevronDown size={14} />}
                </Link>

                {/* Level 1 Dropdown */}
                {link.hasDropdown && (
                  <div className="absolute top-full left-0 w-64 bg-white shadow-xl border-t-2 border-blue-600 rounded-b-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform group-hover:translate-y-0 translate-y-2 z-50">
                    {link.subLinks?.map((sub) => (
                      <div key={sub.name} className="relative group/nested">
                          <Link 
                            href={sub.href}
                            className="flex justify-between items-center px-4 py-3 text-sm text-slate-600 hover:bg-blue-50 hover:text-blue-600 border-b border-gray-50 last:border-none"
                          >
                            {sub.name}
                            {sub.hasNestedDropdown && <ChevronRight size={14} />}
                          </Link>

                          {/* Level 2 Nested Dropdown */}
                          {sub.hasNestedDropdown && (
                             <div className="absolute left-full top-0 w-60 bg-white shadow-xl border-t-2 border-blue-600 rounded-b-lg rounded-r-lg opacity-0 invisible group-hover/nested:opacity-100 group-hover/nested:visible transition-all duration-300 transform translate-x-2 group-hover/nested:translate-x-0 z-50">
                                {sub.nestedLinks?.map((nested) => (
                                    <Link 
                                        key={nested.name}
                                        href={nested.href}
                                        className="block px-4 py-3 text-sm text-slate-600 hover:bg-blue-50 hover:text-blue-600 border-b border-gray-50 last:border-none"
                                    >
                                        {nested.name}
                                    </Link>
                                ))}
                             </div>
                          )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* RIGHT SIDE ICONS */}
          <div className="hidden lg:flex items-center gap-3 ml-6">
              <button 
                onClick={() => setIsSearchOpen(true)}
                className="p-2.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-full hover:bg-blue-600 hover:text-white hover:shadow-[0_0_15px_rgba(37,99,235,0.5)] hover:scale-110 transition-all duration-300"
              >
                 <Search size={20} />
              </button>
              
              {/* 👇 UPDATED LOGIN BUTTON WITH LINK */}
              <Link 
                href="/login" 
                className="flex items-center gap-2 px-6 py-2 border border-blue-100 text-blue-600 rounded-full font-bold hover:bg-blue-50 transition text-sm"
              >
                 Login
              </Link>
              
              {/* DESKTOP CART ICON */}
              <Link href="/cart" className="relative p-2.5 bg-blue-50 rounded-full text-blue-600 cursor-pointer hover:bg-blue-600 hover:text-white hover:scale-110 transition-all duration-300 shadow-sm animate-pulse hover:animate-none">
                 <ShoppingCart size={20} />
                 {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold border-2 border-white">
                      {cartCount}
                    </span>
                 )}
              </Link>
          </div>

          {/* MOBILE HAMBURGER BUTTON */}
          <div className="flex items-center gap-3 lg:hidden ml-auto">
              <button onClick={() => setIsSearchOpen(true)} className="p-2.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-full hover:bg-blue-600 hover:text-white transition-all">
                 <Search size={20} />
              </button>
              
              {/* MOBILE CART ICON */}
              <Link href="/cart" className="relative p-2.5 bg-blue-50 rounded-full text-blue-600 animate-pulse">
                 <ShoppingCart size={20} />
                 {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold border border-white">
                      {cartCount}
                    </span>
                 )}
              </Link>

              <button onClick={() => setIsOpen(!isOpen)} className="text-slate-700 p-1">
                 {isOpen ? <X size={28} /> : <Menu size={28} />}
              </button>
          </div>
        </div>
      </div>

      {/* =======================================================
          MOBILE MENU 
      ======================================================= */}
      {isOpen && (
        <div className="lg:hidden absolute top-20 left-0 w-full bg-white shadow-2xl border-t border-gray-100 max-h-[75vh] overflow-y-auto z-40">
            <div className="flex flex-col p-4 space-y-1">
                {navLinks.map((link) => (
                    <div key={link.name}>
                        {/* Level 1 Item */}
                        <div className="flex justify-between items-center border-b border-gray-50 last:border-none">
                            <Link 
                                href={link.href}
                                onClick={() => !link.hasDropdown && setIsOpen(false)}
                                className="py-3 px-2 text-slate-700 font-medium hover:text-blue-600 w-full"
                            >
                                {link.name}
                            </Link>
                            {link.hasDropdown && (
                                <button 
                                    onClick={() => toggleSubMenu(link.name)}
                                    className="p-3 text-gray-500 hover:text-blue-600 bg-gray-50 rounded-md"
                                >
                                    {mobileSubMenu === link.name ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                </button>
                            )}
                        </div>

                        {/* Level 2 Sub Menu */}
                        {link.hasDropdown && mobileSubMenu === link.name && (
                            <div className="bg-blue-50/50 pl-4 pr-2 py-2 rounded-lg mt-1 space-y-1">
                                {link.subLinks?.map((sub) => (
                                    <div key={sub.name}>
                                        {sub.hasNestedDropdown ? (
                                            <div>
                                                <div className="flex justify-between items-center">
                                                    <Link 
                                                        href={sub.href}
                                                        onClick={() => setIsOpen(false)}
                                                        className="block py-2 px-2 text-sm text-slate-600 font-medium hover:text-blue-600 flex-1"
                                                    >
                                                        • {sub.name}
                                                    </Link>
                                                    <button 
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            toggleNestedMenu(sub.name);
                                                        }}
                                                        className="p-2 text-gray-500 hover:text-blue-600"
                                                    >
                                                        {mobileNestedMenu === sub.name ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                                                    </button>
                                                </div>

                                                {/* Level 3 Nested Items */}
                                                {mobileNestedMenu === sub.name && (
                                                    <div className="pl-6 border-l-2 border-blue-200 ml-2 mb-2">
                                                        {sub.nestedLinks?.map((nested) => (
                                                            <Link 
                                                                key={nested.name}
                                                                href={nested.href}
                                                                onClick={() => setIsOpen(false)}
                                                                className="block py-2 text-xs text-slate-500 hover:text-blue-600 font-medium"
                                                            >
                                                                - {nested.name}
                                                            </Link>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <Link 
                                                href={sub.href}
                                                onClick={() => setIsOpen(false)}
                                                className="block py-2 px-2 text-sm text-slate-600 font-medium hover:text-blue-600"
                                            >
                                                • {sub.name}
                                            </Link>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                <div className="border-t border-gray-100 mt-2 pt-2">
                    <Link href="/login" onClick={() => setIsOpen(false)} className="block py-3 px-2 text-slate-600 font-medium hover:text-blue-600">Login</Link>
                    <Link href="/login" onClick={() => setIsOpen(false)} className="block py-3 px-2 text-slate-600 font-medium hover:text-blue-600">Register</Link>
                </div>
            </div>
            
            <div className="p-4 mt-auto border-t border-gray-100 bg-gray-50 sticky bottom-0">
                <Link href="/cart" onClick={() => setIsOpen(false)} className="w-full bg-[#1E40AF] text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-blue-700 transition">
                    <ShoppingCart size={20} />
                    Cart ({cartCount})
                </Link>
            </div>
        </div>
      )}
    </nav>

    {/* SEARCH POPUP */}
    {isSearchOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-20 px-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-gray-100 flex items-center gap-3">
               <Search className="text-gray-400" size={24} />
               <input type="text" placeholder="Search..." className="flex-1 text-lg outline-none text-slate-700 placeholder:text-gray-400 h-10" autoFocus />
               <button onClick={() => setIsSearchOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition"><X size={24} /></button>
            </div>
            <div className="p-6 bg-gray-50">
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Popular Searches</h3>
               <div className="flex flex-wrap gap-2">
                  {['M.Com Assignment', 'History Notes', 'MBA Project', 'Solved Papers 2025'].map((tag) => (
                    <button key={tag} className="px-3 py-1 bg-white border border-gray-200 rounded-md text-sm text-slate-600 hover:border-blue-500 hover:text-blue-600 transition">{tag}</button>
                  ))}
               </div>
            </div>
          </div>
          <div className="absolute inset-0 -z-10" onClick={() => setIsSearchOpen(false)}></div>
        </div>
    )}
    </>
  );
}