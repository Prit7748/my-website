"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import TopBar from "../../components/TopBar";
import {
  LogOut,
  UserCircle2,
  ShieldCheck,
  Mail,
  IdCard,
  CalendarDays,
  ArrowRight,
  ShoppingBag,
  BookOpen,
  FileText,
  LifeBuoy,
  LayoutDashboard,
  FolderOpen,
  Receipt,
  X,
  Grid3X3,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";

type User = {
  _id?: string;
  id?: string;
  name?: string;
  email: string;
  role: string;
  createdAt?: string;
};

type Category = {
  title: string;
  desc: string;
  href: string;
  icon: any;
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyLogout, setBusyLogout] = useState(false);

  // UI modals
  const [moreOpen, setMoreOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);

  // password form
  const [pwdLoading, setPwdLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [pwdForm, setPwdForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        setUser(data.user);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function logout() {
    setBusyLogout(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      router.push("/login");
      router.refresh();
    } finally {
      setBusyLogout(false);
    }
  }

  // ✅ Add all categories here (jitni chahe)
  const categories: Category[] = useMemo(
    () => [
      {
        title: "Solved Assignments",
        desc: "Direct access to solved PDFs.",
        href: "/solved-assignments",
        icon: FileText,
      },
      {
        title: "Ebooks",
        desc: "Your ebooks & downloads.",
        href: "/ebooks",
        icon: BookOpen,
      },
      {
        title: "Handwritten PDFs",
        desc: "Notes & handwritten solutions.",
        href: "/handwritten-pdfs",
        icon: FolderOpen,
      },
      {
        title: "Question Papers",
        desc: "Previous year papers.",
        href: "/question-papers",
        icon: ShoppingBag,
      },

      // ✅ Examples: aapki extra categories (rename as per your site)
      {
        title: "Guess Papers",
        desc: "Important guess papers.",
        href: "/guess-papers",
        icon: FileText,
      },
      {
        title: "Combo",
        desc: "Bundle products & packs.",
        href: "/combo",
        icon: Grid3X3,
      },
      {
        title: "Handwritten Hardcopy",
        desc: "Physical handwritten copies.",
        href: "/handwritten-hardcopy",
        icon: FolderOpen,
      },
      {
        title: "Projects",
        desc: "Project reports & files.",
        href: "/projects",
        icon: FolderOpen,
      },
    ],
    []
  );

  const primaryCards = categories.slice(0, 4);
  const extraCards = categories.slice(4);

  const displayId = user?._id || user?.id || "-";
  const displayName = user?.name || "Student";
  const joined = user?.createdAt ? new Date(user.createdAt).toLocaleString() : "—";
  const role = (user?.role || "user").toLowerCase();

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();

    if (!pwdForm.currentPassword || !pwdForm.newPassword || !pwdForm.confirmPassword) {
      alert("Please fill all fields.");
      return;
    }
    if (pwdForm.newPassword.length < 6) {
      alert("New password must be at least 6 characters.");
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      alert("New password and confirm password do not match.");
      return;
    }

    setPwdLoading(true);
    try {
      // ✅ API next step me banayenge: /api/auth/change-password
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword: pwdForm.currentPassword,
          newPassword: pwdForm.newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || "Password change failed");
        return;
      }

      alert("Password changed successfully ✅");
      setPwdForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPwdOpen(false);
    } catch (err) {
      alert("Server error. Try again.");
    } finally {
      setPwdLoading(false);
    }
  }

  function CategoryCard({
    c,
    small,
  }: {
    c: Category;
    small?: boolean;
  }) {
    const Icon = c.icon;
    return (
      <Link
        href={c.href}
        className={`group rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white transition p-4 shadow-sm ${
          small ? "p-4" : ""
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="h-10 w-10 rounded-2xl bg-white border border-gray-200 flex items-center justify-center">
            <Icon className="text-slate-700" size={20} />
          </div>
          <ArrowRight className="opacity-50 group-hover:opacity-100 transition" size={18} />
        </div>
        <div className="mt-3 font-extrabold">{c.title}</div>
        <div className="text-xs text-slate-600 mt-1">{c.desc}</div>
      </Link>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <TopBar />
      <Navbar />

      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute top-10 right-0 h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 pt-10 pb-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                <LayoutDashboard className="text-slate-700" />
              </div>
              <div>
                <div className="text-2xl md:text-3xl font-extrabold tracking-tight">
                  Dashboard
                </div>
                <div className="mt-1 text-slate-600">
                  Manage your account, orders, and study content.
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <ArrowRight className="rotate-180" size={18} />
                Back to Home
              </Link>

              <button
                onClick={logout}
                disabled={busyLogout}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 transition font-bold text-white shadow-sm"
              >
                <LogOut size={18} />
                {busyLogout ? "Logging out..." : "Logout"}
              </button>
            </div>
          </div>

          {/* Summary strip */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
              <div className="text-xs uppercase font-bold text-slate-500">Account</div>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center">
                  <UserCircle2 className="text-slate-700" />
                </div>
                <div className="min-w-0">
                  <div className="font-extrabold truncate">
                    {loading ? "Loading..." : displayName}
                  </div>
                  <div className="text-sm text-slate-600 truncate">
                    {loading ? "—" : user?.email}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
              <div className="text-xs uppercase font-bold text-slate-500">Role</div>
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-bold">
                <ShieldCheck size={16} />
                {loading ? "—" : role.toUpperCase()}
              </div>
              <div className="mt-2 text-sm text-slate-600">
                {role === "admin" ? "You have admin access." : "Standard student access."}
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
              <div className="text-xs uppercase font-bold text-slate-500">Joined</div>
              <div className="mt-3 flex items-center gap-2 font-bold">
                <CalendarDays size={18} className="text-slate-500" />
                <span className="text-slate-900">{loading ? "Loading..." : joined}</span>
              </div>
              <div className="mt-2 text-sm text-slate-600">
                Keep your profile updated for smooth support.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className="max-w-6xl mx-auto px-4 pb-12">

        {/* ✅ Your Orders (same design) + More */}
        <div className="mt-2 rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-lg font-extrabold flex items-center gap-2">
                <Receipt className="text-slate-700" size={20} />
                Your Orders
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Click a section to access your purchased PDFs / content quickly.
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* ✅ More button if extra categories exist */}
              {extraCards.length > 0 ? (
                <button
                  onClick={() => setMoreOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
                >
                  <Grid3X3 size={18} />
                  More
                </button>
              ) : null}

              <Link
                href="/orders"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-semibold shadow-sm"
              >
                View Orders
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-4">
            {primaryCards.map((c) => (
              <CategoryCard key={c.href} c={c} />
            ))}
          </div>

          <div className="mt-5 rounded-2xl bg-gray-50 border border-gray-200 p-4">
            <div className="text-xs font-bold uppercase text-slate-500">Note</div>
            <div className="mt-1 text-sm text-slate-700">
              Next step me hum MongoDB se aapke real orders/purchased products nikaal kar yahin show karenge (order-wise).
            </div>
          </div>
        </div>

        {/* Profile + Support */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile */}
          <div className="lg:col-span-2 rounded-3xl bg-white border border-gray-200 overflow-hidden shadow-sm">
            <div className="p-7 md:p-8">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-lg md:text-xl font-extrabold">Profile Details</div>
                  <div className="text-sm text-slate-600 mt-1">
                    Update your profile settings.
                  </div>
                </div>

                {/* ✅ Change password button */}
                <button
                  onClick={() => setPwdOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-bold shadow-sm"
                >
                  <KeyRound size={18} />
                  Change Password
                </button>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl bg-gray-50 border border-gray-200 p-5">
                  <div className="flex items-center gap-2 text-xs uppercase font-bold text-slate-500">
                    <Mail size={16} />
                    Email
                  </div>
                  <div className="mt-2 font-semibold break-all">
                    {loading ? "Loading..." : user?.email || "-"}
                  </div>
                </div>

                <div className="rounded-2xl bg-gray-50 border border-gray-200 p-5">
                  <div className="flex items-center gap-2 text-xs uppercase font-bold text-slate-500">
                    <IdCard size={16} />
                    User ID
                  </div>
                  <div className="mt-2 font-semibold break-all">
                    {loading ? "Loading..." : displayId}
                  </div>
                </div>

                <div className="rounded-2xl bg-gray-50 border border-gray-200 p-5 md:col-span-2">
                  <div className="flex items-center gap-2 text-xs uppercase font-bold text-slate-500">
                    <UserCircle2 size={16} />
                    Name
                  </div>
                  <div className="mt-2 font-semibold">
                    {loading ? "Loading..." : displayName}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Support */}
          <div className="rounded-3xl bg-white border border-gray-200 overflow-hidden shadow-sm">
            <div className="p-7">
              <div className="text-lg font-extrabold">Support</div>
              <div className="text-sm text-slate-600 mt-1">Need help? We’re here.</div>

              <div className="mt-5 space-y-3">
                <Link
                  href="/contact"
                  className="group block rounded-2xl bg-gray-50 border border-gray-200 p-4 hover:bg-white transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <LifeBuoy className="text-slate-700" size={20} />
                      <div>
                        <div className="font-bold">Contact Support</div>
                        <div className="text-xs text-slate-600 mt-1">Questions? Message us.</div>
                      </div>
                    </div>
                    <ArrowRight size={18} className="opacity-50 group-hover:opacity-100 transition" />
                  </div>
                </Link>

                <Link
                  href="/refund-policy"
                  className="group block rounded-2xl bg-gray-50 border border-gray-200 p-4 hover:bg-white transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="text-slate-700" size={20} />
                      <div>
                        <div className="font-bold">Refund Policy</div>
                        <div className="text-xs text-slate-600 mt-1">Read refund rules.</div>
                      </div>
                    </div>
                    <ArrowRight size={18} className="opacity-50 group-hover:opacity-100 transition" />
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ More Categories Modal */}
      {moreOpen ? (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMoreOpen(false)}
          />
          <div className="relative w-full max-w-4xl rounded-3xl bg-white border border-gray-200 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <div className="text-lg font-extrabold">More Categories</div>
                <div className="text-sm text-slate-600">Choose a section to open.</div>
              </div>
              <button
                onClick={() => setMoreOpen(false)}
                className="h-10 w-10 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white flex items-center justify-center"
              >
                <X />
              </button>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {extraCards.map((c) => (
                  <CategoryCard key={c.href} c={c} small />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ✅ Change Password Modal (UI ready) */}
      {pwdOpen ? (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !pwdLoading && setPwdOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-3xl bg-white border border-gray-200 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <div className="text-lg font-extrabold">Change Password</div>
                <div className="text-sm text-slate-600">
                  Use a strong password (min 6 characters).
                </div>
              </div>
              <button
                onClick={() => !pwdLoading && setPwdOpen(false)}
                className="h-10 w-10 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white flex items-center justify-center"
              >
                <X />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                  Current Password
                </label>
                <input
                  type={showPwd ? "text" : "password"}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-blue-500 transition font-medium"
                  value={pwdForm.currentPassword}
                  onChange={(e) =>
                    setPwdForm((p) => ({ ...p, currentPassword: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                  New Password
                </label>
                <input
                  type={showPwd ? "text" : "password"}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-blue-500 transition font-medium"
                  value={pwdForm.newPassword}
                  onChange={(e) =>
                    setPwdForm((p) => ({ ...p, newPassword: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                  Confirm New Password
                </label>
                <input
                  type={showPwd ? "text" : "password"}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-blue-500 transition font-medium"
                  value={pwdForm.confirmPassword}
                  onChange={(e) =>
                    setPwdForm((p) => ({ ...p, confirmPassword: e.target.value }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold"
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  {showPwd ? "Hide" : "Show"}
                </button>

                <button
                  disabled={pwdLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-bold disabled:opacity-60"
                >
                  <KeyRound size={18} />
                  {pwdLoading ? "Updating..." : "Update Password"}
                </button>
              </div>

              <div className="text-xs text-slate-500">
                Note: Abhi yeh UI ready hai. Next step me hum backend route{" "}
                <b>/api/auth/change-password</b> bana kar password update karwa denge.
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <Footer />
    </main>
  );
}
