"use client";

import Link from "next/link";
import { ArrowLeft, FolderKanban, FileText } from "lucide-react";

export default function AdminBlogsHome() {
  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-2xl font-extrabold flex items-center gap-2">
                <FileText className="text-slate-700" />
                Blogs Management
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Manage blog categories and blog posts
              </div>
            </div>

            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
            >
              <ArrowLeft size={18} />
              Back to Admin
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Categories Tile */}
            <Link
              href="/admin/blogs/categories"
              className="rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white transition p-6 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <FolderKanban className="text-slate-700" />
                <div>
                  <div className="font-extrabold text-lg">
                    Blog Categories
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Add / edit / delete blog categories
                  </div>
                </div>
              </div>
            </Link>

            {/* Blogs Tile */}
            <Link
              href="/admin/blogs/manage"
              className="rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white transition p-6 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <FileText className="text-slate-700" />
                <div>
                  <div className="font-extrabold text-lg">
                    Manage Blogs
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Create / edit / publish blog posts
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
