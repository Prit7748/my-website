"use client";

import Link from "next/link";
import { ArrowLeft, Settings, Image as ImageIcon, HelpCircle, Share2, MessageSquareText, Star, Quote } from "lucide-react";

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
                Manage global content blocks (Hero, FAQ, Social, Testimonials...)
              </div>
            </div>

            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
            >
              <ArrowLeft size={18} /> Back to Admin
            </Link>
          </div>

          {/* ✅ Modules */}
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
                  <div className="text-xs text-slate-600 mt-1">
                    Desktop + Mobile slides, links, order
                  </div>
                </div>
              </div>
            </Link>

            {/* Placeholders (future) */}
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <HelpCircle className="text-slate-400" />
                <div>
                  <div className="font-extrabold text-slate-500">FAQ</div>
                  <div className="text-xs text-slate-400 mt-1">Coming soon</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <Share2 className="text-slate-400" />
                <div>
                  <div className="font-extrabold text-slate-500">Social Links</div>
                  <div className="text-xs text-slate-400 mt-1">Coming soon</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <MessageSquareText className="text-slate-400" />
                <div>
                  <div className="font-extrabold text-slate-500">ChatBot</div>
                  <div className="text-xs text-slate-400 mt-1">Coming soon</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <Quote className="text-slate-400" />
                <div>
                  <div className="font-extrabold text-slate-500">Testimonials</div>
                  <div className="text-xs text-slate-400 mt-1">Coming soon</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <Star className="text-slate-400" />
                <div>
                  <div className="font-extrabold text-slate-500">Product Ratings</div>
                  <div className="text-xs text-slate-400 mt-1">Coming soon</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Next step: Hero Slider Admin UI (add/edit/delete/toggle/order) build kar rahe hain.
          </div>
        </div>
      </div>
    </main>
  );
}
