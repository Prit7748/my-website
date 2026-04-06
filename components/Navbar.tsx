"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Menu,
  X,
  ShoppingCart,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  User,
  LogOut,
  LayoutDashboard,
  Wallet,
  BadgePercent,
} from "lucide-react";
import { useCart } from "../context/CartContext";
import { getResellerPlanTheme } from "@/lib/reseller";

type NestedLink = { name: string; href: string };
type SubLink = { name: string; href?: string; nestedLinks?: NestedLink[] };
type NavLink = { name: string; href?: string; subLinks?: SubLink[] };

type MeUser = {
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  reseller?: {
    isReseller?: boolean;
    status?: string;
    planCode?: "" | "basic" | "standard" | "premium";
    planName?: string;
    walletBalance?: number;
  };
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

export default function Navbar() {
  const { cartCount } = useCart();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [mobileSubMenu, setMobileSubMenu] = useState<string | null>(null);
  const [mobileNestedMenu, setMobileNestedMenu] = useState<string | null>(null);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<MeUser | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const navLinks: NavLink[] = useMemo(
    () => [
      { name: "Home", href: "/" },
      {
        name: "IGNOU Assignments",
        subLinks: [
          { name: "Solved Assignments", href: "/solved-assignments" },
          {
            name: "Handwritten Assignments",
            nestedLinks: [
              { name: "Hardcopy Delivery", href: "/handwritten-hardcopy" },
              { name: "Handwritten PDFs", href: "/handwritten-pdfs" },
            ],
          },
          { name: "Projects & Synopsis", href: "/projects" },
        ],
      },
      { name: "Question Papers (PYQs)", href: "/question-papers" },
      { name: "eBooks/Notes", href: "/ebooks" },
      { name: "Guess Paper", href: "/guess-papers" },
      { name: "Combo", href: "/combo" },
      { name: "Contact", href: "/contact" },
    ],
    []
  );

  useEffect(() => {
    const shouldLock = isOpen || isSearchOpen;
    document.body.style.overflow = shouldLock ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, isSearchOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setIsSearchOpen(false);
        setIsUserMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadCurrentUser() {
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!alive) return;

        if (!res.ok) {
          setCurrentUser(null);
          return;
        }

        const data = await res.json();
        setCurrentUser(data?.user || null);
      } catch {
        if (!alive) return;
        setCurrentUser(null);
      } finally {
        if (alive) setAuthLoading(false);
      }
    }

    loadCurrentUser();

    return () => {
      alive = false;
    };
  }, []);

  const toggleSubMenu = (name: string) => {
    setMobileSubMenu(mobileSubMenu === name ? null : name);
    setMobileNestedMenu(null);
  };

  const toggleNestedMenu = (name: string) => {
    setMobileNestedMenu(mobileNestedMenu === name ? null : name);
  };

  const runSearch = (qRaw?: string) => {
    const q = (qRaw ?? searchValue).trim();
    if (!q) return;
    setIsSearchOpen(false);
    router.push(`/products?search=${encodeURIComponent(q)}`);
  };

  const displayName = useMemo(() => {
    const name = safeStr(currentUser?.name);
    if (name) return name;
    const email = safeStr(currentUser?.email);
    if (email) return email.split("@")[0];
    return "My Account";
  }, [currentUser]);

  const shortDisplayName = useMemo(() => {
    const name = displayName.trim();
    if (name.length <= 16) return name;
    return `${name.slice(0, 16)}...`;
  }, [displayName]);

  const reseller = currentUser?.reseller || {};
  const isActiveSeller =
    Boolean(reseller?.isReseller) &&
    safeStr(reseller?.status).toLowerCase() === "active" &&
    !!safeStr(reseller?.planCode);

  const sellerTheme = getResellerPlanTheme(reseller?.planCode);
  const planName = safeStr(reseller?.planName || sellerTheme.label);
  const walletBalance = Number(reseller?.walletBalance || 0);

  const isLoggedIn = !!currentUser;

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {}

    setCurrentUser(null);
    setIsUserMenuOpen(false);
    setIsOpen(false);
    router.push("/");
    router.refresh();
  };

  return (
    <>
      <nav className="bg-white sticky top-0 z-50 border-b border-gray-100">
        <div className="max-w-[1600px] mx-auto px-4">
          <div className="flex items-center h-20">
            <Link href="/" className="flex items-center gap-2 flex-shrink-0" aria-label="Home">
              <Image
                src="/logo.png"
                alt="IGNOU Students Portal"
                width={170}
                height={48}
                priority
                className="h-10 md:h-12 w-auto object-contain"
              />
            </Link>

            <div className="hidden lg:flex items-center gap-5 xl:gap-8 ml-auto">
              {navLinks.map((link) => (
                <div key={link.name} className="relative group">
                  {link.subLinks ? (
                    <button
                      type="button"
                      className="text-slate-700 text-[14px] xl:text-[15px] font-semibold hover:text-blue-700 transition flex items-center gap-1 py-6"
                      aria-haspopup="menu"
                    >
                      {link.name}
                      <ChevronDown size={14} />
                    </button>
                  ) : (
                    <Link
                      href={link.href || "/"}
                      className="text-slate-700 text-[14px] xl:text-[15px] font-semibold hover:text-blue-700 transition flex items-center gap-1 py-6"
                    >
                      {link.name}
                    </Link>
                  )}

                  {link.subLinks && (
                    <div className="absolute top-full left-0 w-72 bg-white shadow-2xl border border-gray-100 rounded-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 translate-y-2 group-hover:translate-y-0 z-50">
                      <div className="px-2 py-2">
                        {link.subLinks.map((sub) => (
                          <div key={sub.name} className="relative group/sub">
                            <div className="relative">
                              {sub.nestedLinks ? (
                                <button
                                  type="button"
                                  className="peer w-full flex justify-between items-center px-3 py-3 text-sm font-semibold text-slate-700 rounded-xl hover:bg-blue-50 hover:text-blue-700 transition"
                                >
                                  {sub.name}
                                  <ChevronRight size={16} className="opacity-70" />
                                </button>
                              ) : (
                                <Link
                                  href={sub.href || "/"}
                                  className="flex justify-between items-center px-3 py-3 text-sm font-semibold text-slate-700 rounded-xl hover:bg-blue-50 hover:text-blue-700 transition"
                                >
                                  {sub.name}
                                </Link>
                              )}
                            </div>

                            {sub.nestedLinks && (
                              <span className="absolute top-0 left-full w-3 h-full" aria-hidden="true" />
                            )}

                            {sub.nestedLinks && (
                              <div className="absolute left-full top-0 ml-2 w-64 bg-white shadow-2xl border border-gray-100 rounded-2xl opacity-0 invisible group-hover/sub:opacity-100 group-hover/sub:visible transition-all duration-200 translate-x-2 group-hover/sub:translate-x-0 z-50 overflow-hidden">
                                <div className="px-2 py-2">
                                  {sub.nestedLinks.map((nested) => (
                                    <Link
                                      key={nested.name}
                                      href={nested.href}
                                      className="block px-3 py-3 text-sm font-semibold text-slate-700 rounded-xl hover:bg-blue-50 hover:text-blue-700 transition"
                                    >
                                      {nested.name}
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="hidden lg:flex items-center gap-3 ml-6">
              <button
                onClick={() => {
                  setSearchValue("");
                  setIsSearchOpen(true);
                }}
                className="inline-flex items-center justify-center h-11 w-11 rounded-full border border-gray-200 bg-white text-slate-700 hover:text-blue-700 hover:border-blue-200 hover:bg-blue-50 transition shadow-sm ring-attn"
                aria-label="Search"
              >
                <Search size={20} />
              </button>

              {authLoading ? (
                <div className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-gray-200 bg-white text-slate-400 font-bold shadow-sm">
                  <User size={18} />
                  Loading...
                </div>
              ) : isLoggedIn ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsUserMenuOpen((v) => !v)}
                    className={`inline-flex items-center gap-2 h-11 px-5 rounded-full border font-bold transition shadow-sm ${
                      isActiveSeller
                        ? `${sellerTheme.capsuleClass} ${sellerTheme.glowClass}`
                        : "border-blue-100 bg-blue-50 text-blue-800 hover:border-blue-200 hover:bg-blue-100"
                    }`}
                  >
                    <User size={18} />
                    <span title={displayName}>{shortDisplayName}</span>
                    {isActiveSeller ? (
                      <span className="hidden xl:inline-flex items-center rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-black">
                        {planName}
                      </span>
                    ) : null}
                    <ChevronDown size={16} />
                  </button>

                  {isUserMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-100 rounded-2xl shadow-2xl z-[70] overflow-hidden">
                      <div
                        className={`px-4 py-4 border-b ${
                          isActiveSeller
                            ? "bg-gradient-to-r from-violet-50 via-white to-cyan-50 border-violet-100"
                            : "bg-blue-50 border-blue-100"
                        }`}
                      >
                        <div className="text-sm font-extrabold text-slate-900">{displayName}</div>
                        {currentUser?.email ? (
                          <div className="text-xs text-slate-500 mt-1">{currentUser.email}</div>
                        ) : null}

                        {isActiveSeller ? (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                              <div className="text-[10px] uppercase font-extrabold tracking-wide text-slate-500">
                                Plan
                              </div>
                              <div className="mt-1 text-xs font-extrabold text-slate-900">
                                {planName}
                              </div>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                              <div className="text-[10px] uppercase font-extrabold tracking-wide text-slate-500">
                                Wallet
                              </div>
                              <div className="mt-1 text-xs font-extrabold text-slate-900">
                                ₹{walletBalance}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="p-2">
                        <Link
                          href="/dashboard"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition"
                        >
                          <LayoutDashboard size={16} />
                          Dashboard
                        </Link>

                        <Link
                          href="/orders"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition"
                        >
                          <ShoppingCart size={16} />
                          My Orders
                        </Link>

                        <Link
                          href="/wallet"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-violet-50 hover:text-violet-700 transition"
                        >
                          <Wallet size={16} />
                          Wallet Balance
                        </Link>

                        <Link
                          href="/wallet"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition"
                        >
                          <BadgePercent size={16} />
                          Subscription / Plans
                        </Link>

                        <button
                          type="button"
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition"
                        >
                          <LogOut size={16} />
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-gray-200 bg-white text-slate-700 font-bold hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 transition shadow-sm float-attn"
                >
                  <User size={18} />
                  Login
                </Link>
              )}

              <Link
                href="/cart"
                className={`relative inline-flex items-center justify-center h-11 w-11 rounded-full border border-gray-200 bg-white text-slate-700 hover:text-blue-700 hover:border-blue-200 hover:bg-blue-50 transition shadow-sm ${
                  cartCount > 0 ? "cart-attn" : ""
                }`}
                aria-label="Cart"
              >
                <ShoppingCart size={20} />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[11px] min-w-5 h-5 px-1 flex items-center justify-center rounded-full font-extrabold border-2 border-white">
                    {cartCount}
                  </span>
                )}
              </Link>
            </div>

            <div className="flex items-center gap-3 lg:hidden ml-auto">
              <button
                onClick={() => {
                  setSearchValue("");
                  setIsSearchOpen(true);
                }}
                className="inline-flex items-center justify-center h-10 w-10 rounded-full border border-gray-200 bg-white text-slate-700 hover:text-blue-700 hover:border-blue-200 hover:bg-blue-50 transition shadow-sm"
                aria-label="Search"
              >
                <Search size={18} />
              </button>

              <Link
                href="/cart"
                className="relative inline-flex items-center justify-center h-10 w-10 rounded-full border border-gray-200 bg-white text-slate-700 hover:text-blue-700 hover:border-blue-200 hover:bg-blue-50 transition shadow-sm"
                aria-label="Cart"
              >
                <ShoppingCart size={18} />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] min-w-4 h-4 px-1 flex items-center justify-center rounded-full font-extrabold border border-white">
                    {cartCount}
                  </span>
                )}
              </Link>

              <button
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center justify-center h-10 w-10 rounded-full border border-gray-200 bg-white text-slate-700 hover:text-blue-700 hover:border-blue-200 hover:bg-blue-50 transition shadow-sm"
                aria-label="Menu"
              >
                {isOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {isOpen && (
          <div className="lg:hidden fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/30" onClick={() => setIsOpen(false)} />
            <div className="absolute top-20 left-0 w-full bg-white border-t border-gray-100 shadow-2xl max-h-[82vh] overflow-y-auto">
              <div className="p-4 space-y-2">
                {navLinks.map((link) => (
                  <div key={link.name} className="rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="flex items-center justify-between bg-white">
                      {link.subLinks ? (
                        <button
                          type="button"
                          onClick={() => toggleSubMenu(link.name)}
                          className="w-full text-left px-4 py-4 font-bold text-slate-800 flex items-center justify-between"
                        >
                          {link.name}
                          {mobileSubMenu === link.name ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      ) : (
                        <Link
                          href={link.href || "/"}
                          onClick={() => setIsOpen(false)}
                          className="w-full px-4 py-4 font-bold text-slate-800"
                        >
                          {link.name}
                        </Link>
                      )}
                    </div>

                    {link.subLinks && mobileSubMenu === link.name && (
                      <div className="bg-gray-50 p-2">
                        {link.subLinks.map((sub) => (
                          <div key={sub.name} className="px-2">
                            {sub.nestedLinks ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => toggleNestedMenu(sub.name)}
                                  className="w-full flex items-center justify-between px-3 py-3 rounded-xl font-semibold text-slate-700 hover:bg-white transition"
                                >
                                  {sub.name}
                                  {mobileNestedMenu === sub.name ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>

                                {mobileNestedMenu === sub.name && (
                                  <div className="pl-3 pb-2">
                                    {sub.nestedLinks.map((nested) => (
                                      <Link
                                        key={nested.name}
                                        href={nested.href}
                                        onClick={() => setIsOpen(false)}
                                        className="block px-3 py-3 rounded-xl text-sm font-semibold text-slate-600 hover:bg-white hover:text-blue-700 transition"
                                      >
                                        {nested.name}
                                      </Link>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : (
                              <Link
                                href={sub.href || "/"}
                                onClick={() => setIsOpen(false)}
                                className="block px-3 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-white hover:text-blue-700 transition"
                              >
                                {sub.name}
                              </Link>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {authLoading ? (
                  <div className="grid grid-cols-1 gap-3 pt-2">
                    <div className="h-11 rounded-2xl border border-gray-200 bg-white font-bold text-slate-500 flex items-center justify-center shadow-sm">
                      Loading...
                    </div>
                  </div>
                ) : isLoggedIn ? (
                  <div className="pt-2 space-y-3">
                    <div
                      className={`rounded-2xl p-4 border ${
                        isActiveSeller
                          ? "border-violet-200 bg-gradient-to-r from-violet-50 via-white to-cyan-50"
                          : "border-blue-100 bg-blue-50"
                      }`}
                    >
                      <div className="text-sm font-extrabold text-slate-900">{displayName}</div>
                      {currentUser?.email ? (
                        <div className="text-xs text-slate-500 mt-1">{currentUser.email}</div>
                      ) : null}

                      {isActiveSeller ? (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <div className="text-[10px] uppercase font-extrabold tracking-wide text-slate-500">
                              Plan
                            </div>
                            <div className="mt-1 text-xs font-extrabold text-slate-900">
                              {planName}
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <div className="text-[10px] uppercase font-extrabold tracking-wide text-slate-500">
                              Wallet
                            </div>
                            <div className="mt-1 text-xs font-extrabold text-slate-900">
                              ₹{walletBalance}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Link
                        href="/dashboard"
                        onClick={() => setIsOpen(false)}
                        className="h-11 rounded-2xl border border-gray-200 bg-white font-bold text-slate-800 flex items-center justify-center hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition shadow-sm"
                      >
                        Dashboard
                      </Link>
                      <Link
                        href="/orders"
                        onClick={() => setIsOpen(false)}
                        className="h-11 rounded-2xl bg-[#1E40AF] text-white font-bold flex items-center justify-center hover:bg-blue-800 transition shadow-sm"
                      >
                        Orders
                      </Link>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Link
                        href="/wallet"
                        onClick={() => setIsOpen(false)}
                        className="h-11 rounded-2xl border border-violet-200 bg-violet-50 text-violet-700 font-bold flex items-center justify-center hover:bg-violet-100 transition shadow-sm"
                      >
                        Wallet
                      </Link>
                      <Link
                        href="/wallet"
                        onClick={() => setIsOpen(false)}
                        className="h-11 rounded-2xl border border-amber-200 bg-amber-50 text-amber-700 font-bold flex items-center justify-center hover:bg-amber-100 transition shadow-sm"
                      >
                        Plans
                      </Link>
                    </div>

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full h-11 rounded-2xl border border-red-200 bg-red-50 text-red-600 font-bold flex items-center justify-center hover:bg-red-100 transition shadow-sm"
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Link
                      href="/login"
                      onClick={() => setIsOpen(false)}
                      className="h-11 rounded-2xl border border-gray-200 bg-white font-bold text-slate-800 flex items-center justify-center hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition shadow-sm"
                    >
                      Login
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setIsOpen(false)}
                      className="h-11 rounded-2xl bg-[#1E40AF] text-white font-bold flex items-center justify-center hover:bg-blue-800 transition shadow-sm"
                    >
                      Register
                    </Link>
                  </div>
                )}

                <div className="sticky bottom-0 pt-3">
                  <Link
                    href="/cart"
                    onClick={() => setIsOpen(false)}
                    className="w-full h-12 rounded-2xl bg-[#1E40AF] text-white font-extrabold flex items-center justify-center gap-2 shadow-lg hover:bg-blue-800 transition"
                  >
                    <ShoppingCart size={18} />
                    Cart ({cartCount})
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {isUserMenuOpen ? (
          <button
            type="button"
            aria-label="Close user menu backdrop"
            className="hidden lg:block fixed inset-0 z-[60] cursor-default"
            onClick={() => setIsUserMenuOpen(false)}
          />
        ) : null}
      </nav>

      {isSearchOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-20 px-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
            <div className="p-4 md:p-5 border-b border-gray-100 flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <Search size={18} />
              </div>

              <input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runSearch();
                }}
                type="text"
                placeholder="Search IGNOU assignments, notes, course codes..."
                className="flex-1 text-base md:text-lg outline-none text-slate-800 placeholder:text-gray-400 h-10"
                autoFocus
              />

              <button
                onClick={() => runSearch()}
                className="hidden sm:inline-flex items-center justify-center h-10 px-6 rounded-2xl bg-[#1E40AF] text-white font-extrabold hover:bg-blue-800 transition"
              >
                Search
              </button>

              <button
                onClick={() => setIsSearchOpen(false)}
                className="h-10 w-10 rounded-2xl hover:bg-gray-100 text-gray-600 transition flex items-center justify-center"
                aria-label="Close search"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Popular Searches</h3>
                <button onClick={() => setSearchValue("")} className="text-xs font-bold text-blue-700 hover:underline">
                  Clear
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {["M.Com Assignment", "History Notes", "MBA Projects", "Solved Papers 2025"].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => runSearch(tag)}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-slate-700 hover:border-blue-200 hover:text-blue-700 hover:bg-blue-50 transition"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <p className="text-xs text-gray-500 mt-4">
                Tip: Enter course code like <span className="font-bold text-slate-700">MPA-036</span> or{" "}
                <span className="font-bold text-slate-700">BHIC-131</span>.
              </p>
            </div>
          </div>

          <div className="absolute inset-0 -z-10" onClick={() => setIsSearchOpen(false)} />
        </div>
      )}

      <style jsx>{`
        .ring-attn {
          animation: ringPulse 2.8s infinite;
        }
        @keyframes ringPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.25);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(37, 99, 235, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(37, 99, 235, 0);
          }
        }

        .float-attn {
          animation: floatSoft 3.2s ease-in-out infinite;
        }
        @keyframes floatSoft {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-3px);
          }
        }

        .cart-attn {
          animation: cartNudge 2.2s ease-in-out infinite;
        }
        @keyframes cartNudge {
          0%,
          100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-3px);
          }
          55% {
            transform: translateY(0);
          }
          70% {
            transform: translateY(-2px);
          }
        }
      `}</style>
    </>
  );
} 