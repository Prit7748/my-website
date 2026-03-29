"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import TopBar from "../../components/TopBar";
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Shield, Phone } from "lucide-react";

declare global {
  interface Window {
    google?: any;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectTarget = useMemo(() => {
    const raw = String(searchParams.get("redirect") || "").trim();
    if (!raw) return "/dashboard";
    if (!raw.startsWith("/")) return "/dashboard";
    if (raw.startsWith("//")) return "/dashboard";
    return raw;
  }, [searchParams]);

  const [view, setView] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    adminKey: "",
  });

  const handleInputChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  function safeStr(x: any) {
    return String(x ?? "").trim();
  }

  function normPhone(x: any) {
    return safeStr(x).replace(/[^\d+]/g, "");
  }

  function isAdminRole(role: string) {
    const r = (role || "").toLowerCase();
    return r === "master_admin" || r === "co_admin" || r === "admin";
  }

  function getPostLoginPath(role: string) {
    if (isAdminRole(role)) return "/admin";
    return redirectTarget || "/dashboard";
  }

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const existing = document.getElementById("google-gsi") as HTMLScriptElement | null;
    if (existing) {
      setGoogleReady(true);
      return;
    }

    const s = document.createElement("script");
    s.id = "google-gsi";
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => setGoogleReady(true);
    document.body.appendChild(s);
  }, []);

  async function doGoogleLogin(credential: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ credential }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert((data?.error || "Google login failed") + (data?.details ? "\n\nDETAILS: " + data.details : ""));
        return;
      }

      const role = String(data?.user?.role || "");
      alert("Welcome " + (data?.user?.name || "User") + "! 🎉");

      router.push(getPostLoginPath(role));
      router.refresh();
    } catch {
      alert("Google login error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const handleGoogleClick = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      alert("NEXT_PUBLIC_GOOGLE_CLIENT_ID missing in .env.local");
      return;
    }

    if (!googleReady || !window.google?.accounts?.id) {
      alert("Google login is not ready yet. Please retry.");
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (resp: any) => {
        const cred = String(resp?.credential || "");
        if (!cred) {
          alert("Google credential missing. Try again.");
          return;
        }
        doGoogleLogin(cred);
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    window.google.accounts.id.prompt(() => {});
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (view === "signup") {
        const phone = normPhone(formData.phone);
        if (!phone) {
          alert("Mobile number is required");
          return;
        }

        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            phone,
            password: formData.password,
          }),
          credentials: "include",
        });

        const data = await res.json();

        if (res.ok) {
          alert("your account is created! Login Now");
          setView("login");
          setFormData((p) => ({ ...p, password: "" }));
        } else {
          alert(
            (data?.error || data?.message || "Something Wrong") +
              (data?.details ? "\n\nDETAILS: " + data.details : "")
          );
        }
      } else {
        const payload: any = {
          email: formData.email,
          password: formData.password,
        };

        if (isAdminLogin) {
          payload.adminKey = formData.adminKey;
        }

        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include",
        });

        const data = await res.json();

        if (res.ok) {
          const role = String(data?.user?.role || "");
          alert("Welcome " + (data?.user?.name || "User") + "! 🎉");

          router.push(getPostLoginPath(role));
          router.refresh();
        } else {
          alert(
            (data?.error || data?.message || "Login Failed") +
              (data?.details ? "\n\nDETAILS: " + data.details : "")
          );
        }
      }
    } catch (err) {
      console.error(err);
      alert("Connection Error! PLease check your internet");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 font-sans text-slate-800">
      <TopBar />
      <Navbar />

      <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-pink-50">
        <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>

        <div className="bg-white w-full max-w-[450px] rounded-3xl shadow-2xl shadow-blue-900/10 border border-white relative z-10 overflow-hidden">
          <div className="bg-slate-900 p-8 text-center text-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-blue-600 opacity-20 bg-[url('/pattern.png')]"></div>
            <div className="relative z-10">
              <h1 className="text-2xl font-bold mb-1">
                {view === "login" ? "Welcome Back!" : "Join Our Community"}
              </h1>
              <p className="text-blue-200 text-sm">
                {view === "login"
                  ? "Access your study material & orders."
                  : "Start your journey to 90+ marks."}
              </p>
            </div>
          </div>

          <div className="p-8">
            <button
              type="button"
              onClick={handleGoogleClick}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 text-slate-700 font-bold py-3 rounded-xl hover:bg-gray-50 transition mb-6 shadow-sm disabled:opacity-60"
              title="Login with Google (existing account)"
            >
              <img
                src="https://www.svgrepo.com/show/475656/google-color.svg"
                className="w-5 h-5"
                alt="Google"
              />
              Continue with Google
            </button>

            <div className="relative flex py-2 items-center mb-6">
              <div className="flex-grow border-t border-gray-100"></div>
              <span className="flex-shrink-0 mx-4 text-gray-300 text-xs font-bold uppercase">
                Or with Email
              </span>
              <div className="flex-grow border-t border-gray-100"></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {view === "signup" && (
                <div className="space-y-1 animate-in slide-in-from-left-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-3.5 text-gray-400" size={18} />
                    <input
                      name="name"
                      type="text"
                      required
                      placeholder="John Doe"
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition font-medium"
                      onChange={handleInputChange}
                      value={formData.name}
                    />
                  </div>
                </div>
              )}

              {view === "signup" && (
                <div className="space-y-1 animate-in slide-in-from-left-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-3.5 text-gray-400" size={18} />
                    <input
                      name="phone"
                      type="tel"
                      required
                      placeholder="10-digit mobile number"
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition font-medium"
                      onChange={handleInputChange}
                      value={formData.phone}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 ml-1">
                    Phone number is compulsory (for orders & support).
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 text-gray-400" size={18} />
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="student@example.com"
                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition font-medium"
                    onChange={handleInputChange}
                    value={formData.email}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Password
                  </label>
                  {view === "login" && (
                    <Link
                      href="/forgot-password"
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      Forgot?
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 text-gray-400" size={18} />
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    className="w-full pl-11 pr-11 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition font-medium"
                    onChange={handleInputChange}
                    value={formData.password}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-3.5 text-gray-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {view === "login" && (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isAdminLogin}
                      onChange={(e) => {
                        setIsAdminLogin(e.target.checked);
                        setFormData((p) => ({ ...p, adminKey: "" }));
                      }}
                      className="h-4 w-4"
                    />
                    <span className="font-bold text-slate-700 flex items-center gap-2">
                      <Shield size={18} /> I am Admin
                    </span>
                  </label>

                  {isAdminLogin && (
                    <div className="mt-3 space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                        Admin Key
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-3.5 text-gray-400" size={18} />
                        <input
                          name="adminKey"
                          type="password"
                          required
                          placeholder="Enter Admin Key"
                          className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition font-medium"
                          onChange={handleInputChange}
                          value={formData.adminKey}
                        />
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Co-Admin login ke liye Admin Key required hai.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <button
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 transition active:scale-95 flex items-center justify-center gap-2 mt-4 disabled:opacity-60"
              >
                {loading ? (
                  "Processing..."
                ) : (
                  <>
                    {view === "login" ? "Sign In" : "Create Account"}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="bg-gray-50 p-6 text-center border-t border-gray-100">
            <p className="text-sm text-slate-500 font-medium">
              {view === "login" ? "Don't have an account?" : "Already have an account?"}
              <button
                onClick={() => {
                  const nextView = view === "login" ? "signup" : "login";
                  setView(nextView);
                  setFormData({ name: "", email: "", phone: "", password: "", adminKey: "" });
                  setIsAdminLogin(false);
                  setShowPassword(false);
                }}
                className="text-blue-600 font-bold ml-1 hover:underline transition"
              >
                {view === "login" ? "Sign Up Free" : "Login Here"}
              </button>
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}