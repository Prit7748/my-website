// ✅ COMPLETE REPLACE: app/admin/site-settings/page.tsx
// - Testimonials tile ACTIVE (link enabled)
// - Offers / Coupons tile REMOVED (as requested)

"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Settings,
  Image as ImageIcon,
  Bell,
  Bot,
  HelpCircle,
  Share2,
  FileText,
  ShieldCheck,
  ScrollText,
  Star,
  Menu,
  UserCircle2,
  LayoutGrid,
} from "lucide-react";

export default function SiteSettingsPage() {
  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-2xl font-extrabold flex items-center gap-2">
                <Settings className="text-slate-700" />
                Site Settings
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Manage global content blocks (Hero, Notifications, ChatBot, FAQ, Social, Policies...)
              </div>
            </div>

            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
            >
              <ArrowLeft size={18} /> Back to Admin
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* ✅ Hero Slider */}
            <Link
              href="/admin/site-settings/hero-slider"
              className="rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white transition p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <ImageIcon className="text-slate-700" />
                <div>
                  <div className="font-extrabold">Hero Slider</div>
                  <div className="text-xs text-slate-600 mt-1">Desktop + Mobile, order, active</div>
                </div>
              </div>
            </Link>

            {/* ✅ Notifications */}
            <Link
              href="/admin/site-settings/notifications"
              className="rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white transition p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Bell className="text-slate-700" />
                <div>
                  <div className="font-extrabold">Notifications</div>
                  <div className="text-xs text-slate-600 mt-1">Manage ticker items + official links</div>
                </div>
              </div>
            </Link>

            {/* ✅ ChatBot */}
            <Link
              href="/admin/site-settings/chatbot"
              className="rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white transition p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Bot className="text-slate-700" />
                <div>
                  <div className="font-extrabold">ChatBot</div>
                  <div className="text-xs text-slate-600 mt-1">WhatsApp / Tawk / Crisp / Custom script</div>
                </div>
              </div>
            </Link>

            {/* ✅ FAQ */}
            <Link
              href="/admin/site-settings/faq"
              className="rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white transition p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="text-slate-700" />
                <div>
                  <div className="font-extrabold">FAQ</div>
                  <div className="text-xs text-slate-600 mt-1">Add / edit questions, active, sort order</div>
                </div>
              </div>
            </Link>

            {/* ✅ Social Links */}
            <Link
              href="/admin/site-settings/social-links"
              className="rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white transition p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Share2 className="text-slate-700" />
                <div>
                  <div className="font-extrabold">Social Links</div>
                  <div className="text-xs text-slate-600 mt-1">WhatsApp, Telegram, YouTube, Instagram, etc.</div>
                </div>
              </div>
            </Link>

            {/* ✅ Policy Pages */}
            <Link
              href="/admin/site-settings/pages"
              className="rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white transition p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <FileText className="text-slate-700" />
                <div>
                  <div className="font-extrabold">Policy Pages</div>
                  <div className="text-xs text-slate-600 mt-1">Privacy, Terms, Refund (text editor)</div>
                </div>
              </div>
            </Link>

            {/* ✅ Testimonials (ACTIVE) */}
            <Link
              href="/admin/site-settings/testimonials"
              className="rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white transition p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <LayoutGrid className="text-slate-700" />
                <div>
                  <div className="font-extrabold">Testimonials</div>
                  <div className="text-xs text-slate-600 mt-1">Add / edit reviews, active, sort</div>
                </div>
              </div>
            </Link>

            {/* ✅ Product Ratings (placeholder) */}
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                <Star size={18} /> Product Ratings
              </div>
              <div className="text-xs text-slate-400 mt-1">Coming soon</div>
            </div>

            {/* ✅ Menus (placeholder) */}
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                <Menu size={18} /> Menus
              </div>
              <div className="text-xs text-slate-400 mt-1">Header / Footer menu builder (later)</div>
            </div>

            {/* ✅ Profiles (placeholder) */}
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                <UserCircle2 size={18} /> Profiles
              </div>
              <div className="text-xs text-slate-400 mt-1">Team / authors / admin profiles (later)</div>
            </div>

            {/* Notes */}
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                <ShieldCheck size={18} /> Legal Note
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Live pages safe-mode me hain. Enable ke bina website text change nahi hoga.
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                <ScrollText size={18} /> Safe Mode
              </div>
              <div className="text-xs text-slate-400 mt-1">
                DB me content save hoga, lekin website text change nahi hoga jab tak aap enable na karo.
              </div>
            </div>
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Next: Product Ratings / Menus / Profiles later.
          </div>
        </div>
      </div>
    </main>
  );
}
