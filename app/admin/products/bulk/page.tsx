import Link from "next/link";
import {
  ArrowLeft,
  FileSpreadsheet,
  ImageIcon,
  ChevronRight,
  Lock,
  Sparkles,
} from "lucide-react";

const tiles = [
  {
    title: "Bulk Product Details Upload",
    desc: "Static template + CSV/Excel row-wise merge. Subject / Session / Course validation isi flow me hoga. Price aur availability dono auto-managed rahenge.",
    href: "/admin/products/bulk/details",
    icon: FileSpreadsheet,
  },
  {
    title: "Bulk Product Images Upload",
    desc: "ZIP upload karo. Har folder ka naam same product Unique ID (SKU) hona chahiye. Images automatically matching product me attach hongi.",
    href: "/admin/products/bulk/bulk-images",
    icon: ImageIcon,
  },
];

export default function AdminBulkProductsPage() {
  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold">Bulk Product Upload</h1>
              <p className="mt-1 text-sm text-slate-600">
                Large-scale product operations ko separate workflows me divide
                kiya gaya hai, taki system safe, scalable aur easy-to-manage
                rahe.
              </p>
            </div>

            <Link
              href="/admin/products"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 font-semibold shadow-sm transition hover:bg-gray-50"
            >
              <ArrowLeft size={18} />
              Back to Products
            </Link>
          </div>

          <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <div className="flex items-start gap-3">
              <Sparkles size={18} className="mt-0.5 shrink-0 text-violet-800" />
              <div>
                <div className="text-sm font-extrabold text-violet-900">
                  Bulk flow now runs on automation-first logic
                </div>
                <div className="mt-2 text-sm leading-6 text-violet-800">
                  <b>Pricing</b> ab Product Pricing rules se auto aayegi.
                  <br />
                  <b>Availability</b> ab solved PDF / official paper existence
                  se auto derive hogi.
                  <br />
                  Bulk details upload me in dono cheezon ka manual control hata
                  diya gaya hai.
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <Lock size={18} className="mt-0.5 shrink-0 text-blue-800" />
              <div>
                <div className="text-sm font-extrabold text-blue-900">
                  Handwritten Hardcopy (Delivery) manual bulk creation disabled
                </div>
                <div className="mt-2 text-sm leading-6 text-blue-800">
                  Ab hardcopy products bulk details upload se create nahi honge.
                  <br />
                  Eligible <b>Solved Assignments</b> products se ye
                  automatically generate honge.
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
            {tiles.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group rounded-3xl border border-gray-200 bg-gray-50 p-5 shadow-sm transition hover:border-slate-300 hover:bg-white"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                    <Icon size={22} />
                  </div>

                  <div className="mt-4 text-lg font-extrabold">{item.title}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {item.desc}
                  </p>

                  <div className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-slate-900">
                    Open
                    <ChevronRight
                      size={16}
                      className="transition group-hover:translate-x-1"
                    />
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-sm font-extrabold text-amber-900">
              Recommended workflow
            </div>
            <div className="mt-2 text-sm leading-6 text-amber-800">
              1. Pehle <b>Bulk Product Details Upload</b> se source products
              create karo.
              <br />
              2. Pricing automatically Product Pricing rules se resolve hogi.
              <br />
              3. Availability automatically official paper / solved PDF presence
              ke basis par set hogi.
              <br />
              4. Uske baad <b>Bulk Product Images Upload</b> se matching images
              attach karo.
              <br />
              5. Eligible <b>Solved Assignments</b> ke handwritten hardcopy
              delivery products automatically sync honge.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}