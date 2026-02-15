"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Users,
  Package,
  ClipboardList,
  ArrowRight,
  FileText,
  Settings,
} from "lucide-react";

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        setRole((data?.user?.role || "").toString());
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const isMaster = role === "master_admin";

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-2xl font-extrabold flex items-center gap-2">
                <ShieldCheck className="text-slate-700" />
                Admin Panel
              </div>
              <div className="text-sm text-slate-600 mt-1">
                {loading
                  ? "Loading..."
                  : isMaster
                  ? "Master Admin Access"
                  : "Co-Admin Access"}
              </div>
            </div>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
            >
              Back to Dashboard <ArrowRight size={18} />
            </Link>
          </div>

          {/* ✅ 4-4 GRID LAYOUT (Row-1 + Row-2) */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Products */}
            <Link
              href="/admin/products"
              className="rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white transition p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Package className="text-slate-700" />
                <div>
                  <div className="font-extrabold">Products</div>
                  <div className="text-xs text-slate-600 mt-1">
                    Add / edit products
                  </div>
                </div>
              </div>
            </Link>

            {/* Orders */}
            <Link
              href="/admin/orders"
              className="rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white transition p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <ClipboardList className="text-slate-700" />
                <div>
                  <div className="font-extrabold">Orders</div>
                  <div className="text-xs text-slate-600 mt-1">
                    View payments & delivery
                  </div>
                </div>
              </div>
            </Link>

            {/* Blogs */}
            <Link
              href="/admin/blogs"
              className="rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white transition p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <FileText className="text-slate-700" />
                <div>
                  <div className="font-extrabold">Blogs</div>
                  <div className="text-xs text-slate-600 mt-1">
                    Manage blog categories & posts
                  </div>
                </div>
              </div>
            </Link>

            {/* Admin Management */}
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <Users className="text-slate-700" />
                <div className="min-w-0">
                  <div className="font-extrabold">Admin Management</div>
                  <div className="text-xs text-slate-600 mt-1">
                    {isMaster
                      ? "Create / delete Co-Admins (Master only)"
                      : "Only Master can manage admins"}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                {isMaster ? (
                  <Link
                    href="/admin/admins"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-bold shadow-sm"
                  >
                    Manage Admins <ArrowRight size={18} />
                  </Link>
                ) : (
                  <button
                    disabled
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-200 text-gray-500 font-bold cursor-not-allowed"
                  >
                    Master Only
                  </button>
                )}
              </div>
            </div>

            {/* ✅ Row 2 - Tile 1: Site Settings */}
            <Link
              href="/admin/site-settings"
              className="rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white transition p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Settings className="text-slate-700" />
                <div>
                  <div className="font-extrabold">Site Settings</div>
                  <div className="text-xs text-slate-600 mt-1">
                    Hero, FAQ, Social links, Testimonials
                  </div>
                </div>
              </div>
            </Link>

            {/* ✅ Row 2 placeholders (future tiles) */}
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-5">
              <div className="text-sm font-bold text-slate-500">Coming soon</div>
              <div className="text-xs text-slate-400 mt-1">
                Next modules will appear here
              </div>
            </div>
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-5">
              <div className="text-sm font-bold text-slate-500">Coming soon</div>
              <div className="text-xs text-slate-400 mt-1">
                Next modules will appear here
              </div>
            </div>
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-5">
              <div className="text-sm font-bold text-slate-500">Coming soon</div>
              <div className="text-xs text-slate-400 mt-1">
                Next modules will appear here
              </div>
            </div>
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Next step: Site Settings ke andar Hero Slider / FAQ / Social Links ka backend banayenge.
          </div>
        </div>
      </div>
    </main>
  );
}
