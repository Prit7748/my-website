"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

const NAV_START_EVENT = "isp:navigation-start";

function safeStr(x: unknown) {
  return String(x ?? "").trim();
}

function normalizeHref(href: string) {
  const raw = safeStr(href);
  if (!raw) return "/";
  if (/^https?:\/\//i.test(raw)) return raw;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function dispatchNavigationStart(href?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(NAV_START_EVENT, {
      detail: { href: safeStr(href) || undefined },
    })
  );
}

export default function Navbar() {
  const { cartCount } = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isOpen, setIsOpen] = useState(false);
  const [mobileSubMenu, setMobileSubMenu] = useState<string | null>(null);
  const [mobileNestedMenu, setMobileNestedMenu] = useState<string | null>(null);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<MeUser | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const [pressedHref, setPressedHref] = useState("");
  const pressedTimerRef = useRef<number | null>(null);

  const routeKey = useMemo(() => {
    const qs = searchParams?.toString() || "";
    return `${pathname || ""}${qs ? `?${qs}` : ""}`;
  }, [pathname, searchParams]);

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

  useEffect(() => {
    if (pressedTimerRef.current) {
      window.clearTimeout(pressedTimerRef.current);
      pressedTimerRef.current = null;
    }
    setPressedHref("");
  }, [routeKey]);

  useEffect(() => {
    return () => {
      if (pressedTimerRef.current) {
        window.clearTimeout(pressedTimerRef.current);
      }
    };
  }, []);

  const markPressed = (href: string) => {
    const normalized = normalizeHref(href);
    setPressedHref(normalized);

    if (pressedTimerRef.current) {
      window.clearTimeout(pressedTimerRef.current);
    }

    pressedTimerRef.current = window.setTimeout(() => {
      setPressedHref("");
    }, 1800);
  };

  const handleInternalNavigate = (
    href: string,
    options?: {
      closeMenu?: boolean;
      closeUserMenu?: boolean;
    }
  ) => {
    const normalized = normalizeHref(href);
    markPressed(normalized);

    if (options?.closeMenu) {
      setIsOpen(false);
      setMobileSubMenu(null);
      setMobileNestedMenu(null);
    }

    if (options?.closeUserMenu) {
      setIsUserMenuOpen(false);
    }
  };

  const toggleSubMenu = (name: string) => {
    setMobileSubMenu((prev) => (prev === name ? null : name));
    setMobileNestedMenu(null);
  };

  const toggleNestedMenu = (name: string) => {
    setMobileNestedMenu((prev) => (prev === name ? null : name));
  };

  const runSearch = (qRaw?: string) => {
    const q = (qRaw ?? searchValue).trim();
    if (!q) return;

    const href = `/products?search=${encodeURIComponent(q)}`;
    setIsSearchOpen(false);
    markPressed("/products");
    dispatchNavigationStart(href);
    router.push(href);
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
    markPressed("/");
    dispatchNavigationStart("/");
    router.push("/");
    router.refresh();
  };

  const isPressed = (href: string) => pressedHref === normalizeHref(href);

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/92 backdrop-blur-md shadow-[0_10px_30px_rgba(15,23,42,0.05)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-slate-200 before:to-transparent after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-blue-100 after:to-transparent">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50/70 via-white/80 to-white/95 pointer-events-none" />
        <div className="relative mx-auto max-w-[1600px] px-4">
          <div className="flex h-20 items-center">
            <Link
              href="/"
              aria-label="Home"
              onClick={() => handleInternalNavigate("/")}
              className={`flex flex-shrink-0 items-center gap-2 transition duration-150 active:scale-[0.985] ${
                isPressed("/") ? "scale-[0.992] opacity-85" : ""
              }`}
            >
              <Image
                src="/logo.png"
                alt="IGNOU Students Portal"
                width={170}
                height={48}
                priority
                className="h-10 w-auto object-contain md:h-12"
              />
            </Link>

            <div className="ml-auto hidden items-center gap-5 lg:flex xl:gap-8">
              {navLinks.map((link) => (
                <div key={link.name} className="group relative">
                  {link.subLinks ? (
                    <button
                      type="button"
                      className="flex items-center gap-1 py-6 text-[14px] font-semibold text-slate-700 transition hover:text-blue-700 xl:text-[15px]"
                      aria-haspopup="menu"
                    >
                      {link.name}
                      <ChevronDown size={14} />
                    </button>
                  ) : (
                    <Link
                      href={link.href || "/"}
                      onClick={() => handleInternalNavigate(link.href || "/")}
                      className={`flex items-center gap-1 py-6 text-[14px] font-semibold text-slate-700 transition hover:text-blue-700 active:scale-[0.985] xl:text-[15px] ${
                        isPressed(link.href || "/") ? "opacity-85" : ""
                      }`}
                    >
                      {link.name}
                    </Link>
                  )}

                  {link.subLinks && (
                    <div className="invisible absolute left-0 top-full z-50 w-72 translate-y-2 rounded-2xl border border-gray-100 bg-white opacity-0 shadow-2xl transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                      <div className="px-2 py-2">
                        {link.subLinks.map((sub) => (
                          <div key={sub.name} className="group/sub relative">
                            <div className="relative">
                              {sub.nestedLinks ? (
                                <button
                                  type="button"
                                  className="peer flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                                >
                                  {sub.name}
                                  <ChevronRight size={16} className="opacity-70" />
                                </button>
                              ) : (
                                <Link
                                  href={sub.href || "/"}
                                  onClick={() => handleInternalNavigate(sub.href || "/")}
                                  className={`flex items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 active:scale-[0.99] ${
                                    isPressed(sub.href || "/") ? "bg-blue-50 text-blue-700" : ""
                                  }`}
                                >
                                  {sub.name}
                                </Link>
                              )}
                            </div>

                            {sub.nestedLinks ? (
                              <span
                                className="absolute left-full top-0 h-full w-3"
                                aria-hidden="true"
                              />
                            ) : null}

                            {sub.nestedLinks && (
                              <div className="invisible absolute left-full top-0 z-50 ml-2 w-64 translate-x-2 overflow-hidden rounded-2xl border border-gray-100 bg-white opacity-0 shadow-2xl transition-all duration-200 group-hover/sub:visible group-hover/sub:translate-x-0 group-hover/sub:opacity-100">
                                <div className="px-2 py-2">
                                  {sub.nestedLinks.map((nested) => (
                                    <Link
                                      key={nested.name}
                                      href={nested.href}
                                      onClick={() => handleInternalNavigate(nested.href)}
                                      className={`block rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 active:scale-[0.99] ${
                                        isPressed(nested.href) ? "bg-blue-50 text-blue-700" : ""
                                      }`}
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

            <div className="ml-6 hidden items-center gap-3 lg:flex">
              <button
                onClick={() => {
                  setSearchValue("");
                  setIsSearchOpen(true);
                }}
                className="ring-attn inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 active:scale-95"
                aria-label="Search"
                type="button"
              >
                <Search size={20} />
              </button>

              {authLoading ? (
                <div className="inline-flex h-11 items-center gap-2 rounded-full border border-gray-200 bg-white px-5 font-bold text-slate-400 shadow-sm">
                  <User size={18} />
                  Loading...
                </div>
              ) : isLoggedIn ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsUserMenuOpen((v) => !v)}
                    className={`inline-flex h-11 items-center gap-2 rounded-full border px-5 font-bold shadow-sm transition active:scale-[0.985] ${
                      isActiveSeller
                        ? `${sellerTheme.capsuleClass} ${sellerTheme.glowClass}`
                        : "border-blue-100 bg-blue-50 text-blue-800 hover:border-blue-200 hover:bg-blue-100"
                    }`}
                  >
                    <User size={18} />
                    <span title={displayName}>{shortDisplayName}</span>
                    {isActiveSeller ? (
                      <span className="hidden rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-black xl:inline-flex">
                        {planName}
                      </span>
                    ) : null}
                    <ChevronDown size={16} />
                  </button>

                  {isUserMenuOpen && (
                    <div className="absolute right-0 top-full z-[70] mt-2 w-72 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
                      <div
                        className={`border-b px-4 py-4 ${
                          isActiveSeller
                            ? "border-violet-100 bg-gradient-to-r from-violet-50 via-white to-cyan-50"
                            : "border-blue-100 bg-blue-50"
                        }`}
                      >
                        <div className="text-sm font-extrabold text-slate-900">
                          {displayName}
                        </div>

                        {currentUser?.email ? (
                          <div className="mt-1 text-xs text-slate-500">
                            {currentUser.email}
                          </div>
                        ) : null}

                        {isActiveSeller ? (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                              <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                                Plan
                              </div>
                              <div className="mt-1 text-xs font-extrabold text-slate-900">
                                {planName}
                              </div>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                              <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
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
                          onClick={() =>
                            handleInternalNavigate("/dashboard", { closeUserMenu: true })
                          }
                          className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 active:scale-[0.99] ${
                            isPressed("/dashboard") ? "bg-blue-50 text-blue-700" : ""
                          }`}
                        >
                          <LayoutDashboard size={16} />
                          Dashboard
                        </Link>

                        <Link
                          href="/orders"
                          onClick={() =>
                            handleInternalNavigate("/orders", { closeUserMenu: true })
                          }
                          className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 active:scale-[0.99] ${
                            isPressed("/orders") ? "bg-blue-50 text-blue-700" : ""
                          }`}
                        >
                          <ShoppingCart size={16} />
                          My Orders
                        </Link>

                        <Link
                          href="/wallet"
                          onClick={() =>
                            handleInternalNavigate("/wallet", { closeUserMenu: true })
                          }
                          className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-violet-50 hover:text-violet-700 active:scale-[0.99] ${
                            isPressed("/wallet") ? "bg-violet-50 text-violet-700" : ""
                          }`}
                        >
                          <Wallet size={16} />
                          Wallet Balance
                        </Link>

                        <Link
                          href="/wallet"
                          onClick={() =>
                            handleInternalNavigate("/wallet", { closeUserMenu: true })
                          }
                          className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-amber-50 hover:text-amber-700 active:scale-[0.99] ${
                            isPressed("/wallet") ? "bg-amber-50 text-amber-700" : ""
                          }`}
                        >
                          <BadgePercent size={16} />
                          Subscription / Plans
                        </Link>

                        <button
                          type="button"
                          onClick={handleLogout}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 active:scale-[0.99]"
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
                  onClick={() => handleInternalNavigate("/login")}
                  className={`float-attn inline-flex h-11 items-center gap-2 rounded-full border border-gray-200 bg-white px-5 font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 active:scale-[0.985] ${
                    isPressed("/login") ? "opacity-85" : ""
                  }`}
                >
                  <User size={18} />
                  Login
                </Link>
              )}

              <Link
                href="/cart"
                onClick={() => handleInternalNavigate("/cart")}
                className={`relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 active:scale-95 ${
                  cartCount > 0 ? "cart-attn" : ""
                } ${isPressed("/cart") ? "opacity-85" : ""}`}
                aria-label="Cart"
              >
                <ShoppingCart size={20} />
                {cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[11px] font-extrabold text-white">
                    {cartCount}
                  </span>
                )}
              </Link>
            </div>

            <div className="ml-auto flex items-center gap-3 lg:hidden">
              <button
                onClick={() => {
                  setSearchValue("");
                  setIsSearchOpen(true);
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 active:scale-95"
                aria-label="Search"
                type="button"
              >
                <Search size={18} />
              </button>

              <Link
                href="/cart"
                onClick={() =>
                  handleInternalNavigate("/cart", {
                    closeMenu: false,
                  })
                }
                className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 active:scale-95 ${
                  isPressed("/cart") ? "opacity-85" : ""
                }`}
                aria-label="Cart"
              >
                <ShoppingCart size={18} />
                {cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-red-500 px-1 text-[10px] font-extrabold text-white">
                    {cartCount}
                  </span>
                )}
              </Link>

              <button
                onClick={() => setIsOpen((prev) => !prev)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 active:scale-95"
                aria-label="Menu"
                type="button"
              >
                {isOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {isOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute left-0 top-20 max-h-[82vh] w-full overflow-y-auto border-t border-gray-100 bg-white shadow-2xl">
              <div className="space-y-2 p-4">
                {navLinks.map((link) => (
                  <div
                    key={link.name}
                    className="overflow-hidden rounded-2xl border border-gray-100"
                  >
                    <div className="flex items-center justify-between bg-white">
                      {link.subLinks ? (
                        <button
                          type="button"
                          onClick={() => toggleSubMenu(link.name)}
                          className="flex w-full items-center justify-between px-4 py-4 text-left font-bold text-slate-800"
                        >
                          {link.name}
                          {mobileSubMenu === link.name ? (
                            <ChevronUp size={18} />
                          ) : (
                            <ChevronDown size={18} />
                          )}
                        </button>
                      ) : (
                        <Link
                          href={link.href || "/"}
                          onClick={() =>
                            handleInternalNavigate(link.href || "/", {
                              closeMenu: true,
                            })
                          }
                          className={`w-full px-4 py-4 font-bold text-slate-800 active:scale-[0.99] ${
                            isPressed(link.href || "/") ? "bg-blue-50 text-blue-700" : ""
                          }`}
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
                                  className="flex w-full items-center justify-between rounded-xl px-3 py-3 font-semibold text-slate-700 transition hover:bg-white"
                                >
                                  {sub.name}
                                  {mobileNestedMenu === sub.name ? (
                                    <ChevronUp size={16} />
                                  ) : (
                                    <ChevronDown size={16} />
                                  )}
                                </button>

                                {mobileNestedMenu === sub.name && (
                                  <div className="pb-2 pl-3">
                                    {sub.nestedLinks.map((nested) => (
                                      <Link
                                        key={nested.name}
                                        href={nested.href}
                                        onClick={() =>
                                          handleInternalNavigate(nested.href, {
                                            closeMenu: true,
                                          })
                                        }
                                        className={`block rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-blue-700 active:scale-[0.99] ${
                                          isPressed(nested.href)
                                            ? "bg-white text-blue-700"
                                            : ""
                                        }`}
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
                                onClick={() =>
                                  handleInternalNavigate(sub.href || "/", {
                                    closeMenu: true,
                                  })
                                }
                                className={`block rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white hover:text-blue-700 active:scale-[0.99] ${
                                  isPressed(sub.href || "/")
                                    ? "bg-white text-blue-700"
                                    : ""
                                }`}
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
                    <div className="flex h-11 items-center justify-center rounded-2xl border border-gray-200 bg-white font-bold text-slate-500 shadow-sm">
                      Loading...
                    </div>
                  </div>
                ) : isLoggedIn ? (
                  <div className="space-y-3 pt-2">
                    <div
                      className={`rounded-2xl border p-4 ${
                        isActiveSeller
                          ? "border-violet-200 bg-gradient-to-r from-violet-50 via-white to-cyan-50"
                          : "border-blue-100 bg-blue-50"
                      }`}
                    >
                      <div className="text-sm font-extrabold text-slate-900">
                        {displayName}
                      </div>

                      {currentUser?.email ? (
                        <div className="mt-1 text-xs text-slate-500">
                          {currentUser.email}
                        </div>
                      ) : null}

                      {isActiveSeller ? (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                              Plan
                            </div>
                            <div className="mt-1 text-xs font-extrabold text-slate-900">
                              {planName}
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
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
                        onClick={() =>
                          handleInternalNavigate("/dashboard", { closeMenu: true })
                        }
                        className={`flex h-11 items-center justify-center rounded-2xl border border-gray-200 bg-white font-bold text-slate-800 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 active:scale-[0.99] ${
                          isPressed("/dashboard") ? "bg-blue-50 text-blue-700" : ""
                        }`}
                      >
                        Dashboard
                      </Link>
                      <Link
                        href="/orders"
                        onClick={() =>
                          handleInternalNavigate("/orders", { closeMenu: true })
                        }
                        className={`flex h-11 items-center justify-center rounded-2xl bg-[#1E40AF] font-bold text-white shadow-sm transition hover:bg-blue-800 active:scale-[0.99] ${
                          isPressed("/orders") ? "opacity-85" : ""
                        }`}
                      >
                        Orders
                      </Link>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Link
                        href="/wallet"
                        onClick={() =>
                          handleInternalNavigate("/wallet", { closeMenu: true })
                        }
                        className={`flex h-11 items-center justify-center rounded-2xl border border-violet-200 bg-violet-50 font-bold text-violet-700 shadow-sm transition hover:bg-violet-100 active:scale-[0.99] ${
                          isPressed("/wallet") ? "opacity-85" : ""
                        }`}
                      >
                        Wallet
                      </Link>
                      <Link
                        href="/wallet"
                        onClick={() =>
                          handleInternalNavigate("/wallet", { closeMenu: true })
                        }
                        className={`flex h-11 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 font-bold text-amber-700 shadow-sm transition hover:bg-amber-100 active:scale-[0.99] ${
                          isPressed("/wallet") ? "opacity-85" : ""
                        }`}
                      >
                        Plans
                      </Link>
                    </div>

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex h-11 w-full items-center justify-center rounded-2xl border border-red-200 bg-red-50 font-bold text-red-600 shadow-sm transition hover:bg-red-100 active:scale-[0.99]"
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Link
                      href="/login"
                      onClick={() =>
                        handleInternalNavigate("/login", { closeMenu: true })
                      }
                      className={`flex h-11 items-center justify-center rounded-2xl border border-gray-200 bg-white font-bold text-slate-800 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 active:scale-[0.99] ${
                        isPressed("/login") ? "bg-blue-50 text-blue-700" : ""
                      }`}
                    >
                      Login
                    </Link>
                    <Link
                      href="/register"
                      onClick={() =>
                        handleInternalNavigate("/register", { closeMenu: true })
                      }
                      className={`flex h-11 items-center justify-center rounded-2xl bg-[#1E40AF] font-bold text-white shadow-sm transition hover:bg-blue-800 active:scale-[0.99] ${
                        isPressed("/register") ? "opacity-85" : ""
                      }`}
                    >
                      Register
                    </Link>
                  </div>
                )}

                <div className="sticky bottom-0 pt-3">
                  <Link
                    href="/cart"
                    onClick={() =>
                      handleInternalNavigate("/cart", { closeMenu: true })
                    }
                    className={`flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1E40AF] font-extrabold text-white shadow-lg transition hover:bg-blue-800 active:scale-[0.99] ${
                      isPressed("/cart") ? "opacity-85" : ""
                    }`}
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
            className="fixed inset-0 z-[60] hidden cursor-default lg:block"
            onClick={() => setIsUserMenuOpen(false)}
          />
        ) : null}
      </nav>

      {isSearchOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 px-4 pt-20 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-gray-100 p-4 md:p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
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
                className="h-10 flex-1 text-base text-slate-800 outline-none placeholder:text-gray-400 md:text-lg"
                autoFocus
              />

              <button
                onClick={() => runSearch()}
                className="hidden h-10 items-center justify-center rounded-2xl bg-[#1E40AF] px-6 font-extrabold text-white transition hover:bg-blue-800 active:scale-[0.98] sm:inline-flex"
                type="button"
              >
                Search
              </button>

              <button
                onClick={() => setIsSearchOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl text-gray-600 transition hover:bg-gray-100 active:scale-95"
                aria-label="Close search"
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-gray-50 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-400">
                  Popular Searches
                </h3>
                <button
                  onClick={() => setSearchValue("")}
                  className="text-xs font-bold text-blue-700 hover:underline"
                  type="button"
                >
                  Clear
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  "M.Com Assignment",
                  "History Notes",
                  "MBA Projects",
                  "Solved Papers 2025",
                ].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => runSearch(tag)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 active:scale-[0.98]"
                    type="button"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <p className="mt-4 text-xs text-gray-500">
                Tip: Enter course code like{" "}
                <span className="font-bold text-slate-700">MPA-036</span> or{" "}
                <span className="font-bold text-slate-700">BHIC-131</span>.
              </p>
            </div>
          </div>

          <div
            className="absolute inset-0 -z-10"
            onClick={() => setIsSearchOpen(false)}
          />
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