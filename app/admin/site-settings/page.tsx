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
  Wallet,
  BadgePercent,
  LineChart,
  Gift,
  Users,
  PackageCheck,
  PenBox,
  Images,
  BookOpenCheck,
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
                Manage global content blocks, promo controls, offers page, seller banner, website-level dynamic sections, and seller account tools.
              </div>
            </div>

            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
            >
              <ArrowLeft size={18} /> Back to Admin
            </Link>
          </div>

          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="text-sm font-extrabold text-blue-900">
              Handwritten Hardcopy automation tools
            </div>
            <div className="text-sm text-blue-800 mt-2 leading-6">
              Hardcopy products ab automation se generate ho rahe hain.
              <br />
              Isi section me aap <b>Backfill</b> run kar sakte ho aur future me <b>universal title / description templates</b> manage kar paoge.
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
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

            <Link
              href="/admin/site-settings/pyq-thumbnail"
              className="rounded-2xl border border-indigo-200 bg-indigo-50 hover:bg-white transition p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <BookOpenCheck className="text-indigo-700" />
                <div>
                  <div className="font-extrabold text-indigo-900">PYQ Master Thumbnail</div>
                  <div className="text-xs text-indigo-700 mt-1">
                    Blank template image set karo for runtime PYQ thumbnail generation
                  </div>
                </div>
              </div>
            </Link>

            <Link
              href="/admin/site-settings/handwriting-samples"
              className="rounded-2xl border border-rose-200 bg-rose-50 hover:bg-white transition p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Images className="text-rose-700" />
                <div>
                  <div className="font-extrabold text-rose-900">Handwriting Samples</div>
                  <div className="text-xs text-rose-700 mt-1">
                    Upload, sort, active/hide sample images for hardcopy page
                  </div>
                </div>
              </div>
            </Link>

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

            <Link
              href="/admin/site-settings/reseller"
              className="rounded-2xl border border-violet-200 bg-violet-50 hover:bg-white transition p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Wallet className="text-violet-700" />
                <div>
                  <div className="font-extrabold text-violet-900">Reseller Control</div>
                  <div className="text-xs text-violet-700 mt-1">Plans, seller banner, category rules</div>
                </div>
              </div>
            </Link>

            <Link
              href="/admin/sellers"
              className="rounded-2xl border border-indigo-200 bg-indigo-50 hover:bg-white transition p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Users className="text-indigo-700" />
                <div>
                  <div className="font-extrabold text-indigo-900">Sellers Accounts</div>
                  <div className="text-xs text-indigo-700 mt-1">Active, inactive, paused, blocked seller records</div>
                </div>
              </div>
            </Link>

            <Link
              href="/admin/promo-codes"
              className="rounded-2xl border border-emerald-200 bg-emerald-50 hover:bg-white transition p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <BadgePercent className="text-emerald-700" />
                <div>
                  <div className="font-extrabold text-emerald-900">Promo Codes</div>
                  <div className="text-xs text-emerald-700 mt-1">Create, edit, limits, category rules</div>
                </div>
              </div>
            </Link>

            <Link
              href="/admin/promo-codes/usage"
              className="rounded-2xl border border-cyan-200 bg-cyan-50 hover:bg-white transition p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <LineChart className="text-cyan-700" />
                <div>
                  <div className="font-extrabold text-cyan-900">Promo Usage</div>
                  <div className="text-xs text-cyan-700 mt-1">See which customer used which code</div>
                </div>
              </div>
            </Link>

            <Link
              href="/admin/site-settings/offers"
              className="rounded-2xl border border-amber-200 bg-amber-50 hover:bg-white transition p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Gift className="text-amber-700" />
                <div>
                  <div className="font-extrabold text-amber-900">Offers Page</div>
                  <div className="text-xs text-amber-700 mt-1">Create special offers and public deal cards</div>
                </div>
              </div>
            </Link>

            <Link
              href="/admin/products/hardcopy-backfill"
              className="rounded-2xl border border-blue-200 bg-blue-50 hover:bg-white transition p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <PackageCheck className="text-blue-700" />
                <div>
                  <div className="font-extrabold text-blue-900">Hardcopy Backfill</div>
                  <div className="text-xs text-blue-700 mt-1">
                    Already uploaded solved assignments se missing hardcopy products generate / sync karo
                  </div>
                </div>
              </div>
            </Link>

            <Link
              href="/admin/site-settings/hardcopy-templates"
              className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 hover:bg-white transition p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <PenBox className="text-fuchsia-700" />
                <div>
                  <div className="font-extrabold text-fuchsia-900">Hardcopy Templates</div>
                  <div className="text-xs text-fuchsia-700 mt-1">
                    Universal title, short description, long description, note, meta title, meta description patterns
                  </div>
                </div>
              </div>
            </Link>

            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                <Star size={18} /> Product Ratings
              </div>
              <div className="text-xs text-slate-400 mt-1">Coming soon</div>
            </div>

            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                <Menu size={18} /> Menus
              </div>
              <div className="text-xs text-slate-400 mt-1">Header / Footer menu builder (later)</div>
            </div>

            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                <UserCircle2 size={18} /> Profiles
              </div>
              <div className="text-xs text-slate-400 mt-1">Team / authors / admin profiles (later)</div>
            </div>

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
            Next: Product Ratings, Menus, Profiles, Hardcopy Template Settings, Handwriting Samples Manager.
          </div>
        </div>
      </div>
    </main>
  );
}