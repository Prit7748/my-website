"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  RefreshCcw,
  Inbox,
  Mail,
  Phone,
  Pencil,
  ExternalLink,
  Package,
  CalendarClock,
} from "lucide-react";

type EnquiryItem = {
  _id: string;
  userId?: string;
  userEmail: string;
  phone: string;
  message: string;
  status: "new" | "contacted" | "closed" | string;
  productId: string;
  productSlug: string;
  productTitle: string;
  category: string;
  price: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ProductInfo = {
  _id: string;
  sku?: string;
  title: string;
  slug: string;
  category: string;
  price: number;
  deletedAt?: string | null;
  isActive?: boolean;
};

type ApiResponse = {
  ok: boolean;
  product: ProductInfo | null;
  enquiries: EnquiryItem[];
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPending?: number;
    uniqueCustomers?: number;
  };
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function money(n: number) {
  try {
    return new Intl.NumberFormat("en-IN").format(Number(n || 0));
  } catch {
    return String(n);
  }
}

function formatDateTime(x?: string | null) {
  if (!x) return "-";
  try {
    return new Date(x).toLocaleString("en-IN", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(x);
  }
}

function statusUi(status: string) {
  const s = safeStr(status).toLowerCase();
  if (s === "contacted") return "bg-cyan-50 text-cyan-700 border-cyan-200";
  if (s === "closed") return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function categoryToPublicPath(category: string, slug: string) {
  const c = safeStr(category).toLowerCase();

  if (c === "solved assignments") return `/solved-assignments/${slug}`;
  if (c === "handwritten pdfs") return `/handwritten-pdfs/${slug}`;
  if (c === "handwritten hardcopy (delivery)") return `/handwritten-hardcopy/${slug}`;
  if (c === "question papers (pyq)") return `/question-papers/${slug}`;
  if (c === "guess papers") return `/guess-papers/${slug}`;
  if (c === "ebooks/notes") return `/ebooks/${slug}`;
  if (c === "projects & synopsis") return `/projects/${slug}`;
  if (c === "combo") return `/combo/${slug}`;

  return `/products/${slug}`;
}

export default function AdminWantToBuyDetailPage() {
  const params = useParams<{ productId: string }>();
  const productId = safeStr(params?.productId);

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [items, setItems] = useState<EnquiryItem[]>([]);
  const [status, setStatus] = useState("");

  const [meta, setMeta] = useState({
    total: 0,
    totalPending: 0,
    uniqueCustomers: 0,
  });

  async function load() {
    if (!productId) return;

    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (status) qs.set("status", status);

      const res = await fetch(`/api/admin/want-to-buy/${productId}?${qs.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });

      const data: ApiResponse = await res.json();
      if (!res.ok) {
        alert((data as any)?.error || "Failed to load enquiries");
        setItems([]);
        setProduct(null);
        return;
      }

      setProduct(data?.product || null);
      setItems(Array.isArray(data?.enquiries) ? data.enquiries : []);
      setMeta({
        total: Number(data?.meta?.total || 0),
        totalPending: Number(data?.meta?.totalPending || 0),
        uniqueCustomers: Number(data?.meta?.uniqueCustomers || 0),
      });
    } catch {
      alert("Failed to load enquiries");
      setItems([]);
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, status]);

  const productTitle = useMemo(() => {
    return product?.title || items?.[0]?.productTitle || "Product Enquiries";
  }, [product, items]);

  const publicHref = useMemo(() => {
    if (!product?.slug) return "#";
    return categoryToPublicPath(product?.category || "", product.slug);
  }, [product]);

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="rounded-3xl bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 md:px-6 py-5 border-b border-gray-200 bg-white">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center">
                    <Inbox size={20} />
                  </div>
                  <div>
                    <h1 className="text-xl md:text-2xl font-extrabold">View Enquiries</h1>
                    <p className="text-sm text-slate-600 mt-1 break-all">{productTitle}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm min-w-[150px]">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 font-bold">
                    Total Enquiries
                  </div>
                  <div className="mt-1 text-xl font-extrabold text-slate-900">{meta.total}</div>
                </div>

                <div className="rounded-2xl border border-cyan-200 bg-cyan-500 text-white px-4 py-3 shadow-sm min-w-[150px]">
                  <div className="text-[11px] uppercase tracking-wide text-cyan-100 font-bold">
                    Unique Customers
                  </div>
                  <div className="mt-1 text-xl font-extrabold">{meta.uniqueCustomers}</div>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-400 text-slate-900 px-4 py-3 shadow-sm min-w-[150px]">
                  <div className="text-[11px] uppercase tracking-wide text-amber-900 font-bold">
                    Pending
                  </div>
                  <div className="mt-1 text-xl font-extrabold">{meta.totalPending}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 md:px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <div className="lg:col-span-8 rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                    <Package size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-extrabold text-slate-900 text-lg leading-snug">
                      {product?.title || "Product not found"}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      Category: {product?.category || "-"} • Price: ₹{money(Number(product?.price || 0))}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 break-all">
                      Unique Product ID: {safeStr(product?.sku) || "-"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 break-all">
                      Mongo Product ID: {productId}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 break-all">
                      Slug: {product?.slug || items?.[0]?.productSlug || "-"}
                    </div>

                    {!product ? (
                      <div className="mt-2 inline-flex rounded-lg bg-rose-50 text-rose-700 border border-rose-200 px-2 py-1 text-[11px] font-bold">
                        Product not found in DB
                      </div>
                    ) : product.deletedAt ? (
                      <div className="mt-2 inline-flex rounded-lg bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 text-[11px] font-bold">
                        Product is currently in Trash
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 flex items-center justify-start lg:justify-end gap-2 flex-wrap">
                <Link
                  href="/admin/want-to-buy"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
                >
                  <ArrowLeft size={18} />
                  Back
                </Link>

                <button
                  onClick={load}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
                >
                  <RefreshCcw size={18} />
                  Refresh
                </button>

                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="h-11 rounded-xl border border-gray-200 bg-white px-3 font-semibold outline-none focus:border-blue-500"
                >
                  <option value="">All Status</option>
                  <option value="new">Pending</option>
                  <option value="contacted">Contacted</option>
                  <option value="closed">Closed</option>
                </select>

                <Link
                  href={`/admin/products/new?id=${encodeURIComponent(productId)}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition font-bold shadow-sm"
                >
                  <Pencil size={18} />
                  Edit Product
                </Link>

                {product?.slug ? (
                  <Link
                    href={publicHref}
                    target="_blank"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
                  >
                    <ExternalLink size={18} />
                    Open
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          <div className="px-5 md:px-6 py-5">
            {loading ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-slate-600 font-semibold">
                Loading enquiries...
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-slate-500">
                  <Inbox size={24} />
                </div>
                <div className="mt-4 text-lg font-extrabold text-slate-900">No enquiries found</div>
                <div className="mt-1 text-sm text-slate-600 font-semibold">
                  Is product ke liye abhi koi matching enquiry nahi mili.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item, idx) => (
                  <div
                    key={item._id}
                    className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-lg bg-slate-900 text-white text-xs font-extrabold px-2">
                            {idx + 1}
                          </span>

                          <span
                            className={`inline-flex rounded-lg border px-2 py-1 text-xs font-extrabold ${statusUi(
                              item.status
                            )}`}
                          >
                            {safeStr(item.status || "new").toUpperCase()}
                          </span>

                          <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-semibold">
                            <CalendarClock size={14} />
                            {formatDateTime(item.createdAt)}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                            <div className="text-[11px] uppercase tracking-wide text-slate-500 font-bold">
                              Email
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-sm font-extrabold text-slate-900 break-all">
                              <Mail size={16} className="text-blue-700 shrink-0" />
                              {item.userEmail || "-"}
                            </div>
                          </div>

                          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                            <div className="text-[11px] uppercase tracking-wide text-slate-500 font-bold">
                              Phone
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-sm font-extrabold text-slate-900 break-all">
                              <Phone size={16} className="text-emerald-700 shrink-0" />
                              {item.phone || "-"}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3">
                          <div className="text-[11px] uppercase tracking-wide text-slate-500 font-bold">
                            Message
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-700 whitespace-pre-wrap break-words">
                            {item.message || "-"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-5 md:px-6 pb-6 text-xs text-slate-500">
            Next step: product available hote hi auto resolve + email notification workflow.
          </div>
        </div>
      </div>
    </main>
  );
}