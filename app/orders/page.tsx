// ✅ FILE: app/orders/page.tsx  (COMPLETE REPLACE - updated to match your existing APIs + 202 coming_soon handled)
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, ShoppingBag, ArrowLeft, Loader2, Lock, FileText } from "lucide-react";
import TopBar from "../../components/TopBar";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";

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

type OrderItem = {
  productId: string; // Mongo ObjectId
  title?: string;
  category?: string;
  price?: number;
  quantity?: number;
  slug?: string;
};

type Order = {
  _id: string;
  status?: string; // paid/pending/failed etc
  total?: number;
  createdAt?: string;
  items?: OrderItem[];
};

export default function OrdersPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [err, setErr] = useState("");

  // ✅ Your tree shows BOTH: /api/orders/my AND /api/orders/mine
  // We'll try these in order (safe fallback).
  const LIST_APIS = ["/api/orders/my", "/api/orders/mine", "/api/orders"];
  const DOWNLOAD_API = "/api/products/download"; // expects ?productId=<ObjectId>

  async function fetchOrders() {
    for (const url of LIST_APIS) {
      try {
        const r = await fetch(url, { cache: "no-store", credentials: "include" });
        const d = await r.json().catch(() => ({}));

        if (!r.ok) {
          // If endpoint doesn't exist, try next
          if (r.status === 404) continue;
          // If unauthorized, stop (login required)
          if (r.status === 401 || r.status === 403) {
            setErr(d?.error || "Login required to view orders.");
            setOrders([]);
            return;
          }
          // Other errors: try next endpoint only if 404; otherwise stop.
          setErr(d?.error || "Orders load failed");
          setOrders([]);
          return;
        }

        const list = Array.isArray(d?.orders) ? d.orders : Array.isArray(d) ? d : [];
        setOrders(list);
        setErr("");
        return;
      } catch {
        // Try next endpoint
        continue;
      }
    }

    setErr("Orders API not found (my/mine/orders).");
    setOrders([]);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      await fetchOrders();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const download = async (productId: string) => {
    const u = `${DOWNLOAD_API}?productId=${encodeURIComponent(productId)}`;

    // ✅ If your download route returns 202 {status:"coming_soon"} (as you said),
    // we catch it here and show a clean message.
    try {
      const r = await fetch(u, { cache: "no-store", credentials: "include" });

      if (r.status === 202) {
        const d = await r.json().catch(() => ({}));
        alert(d?.message || "Download is coming soon for this product.");
        return;
      }

      // If server will stream/redirect the file, opening new tab is best.
      // (We already did a GET above, but this ensures correct download UX.)
      window.open(u, "_blank", "noopener,noreferrer");
    } catch {
      window.open(u, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <main className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800">
      <TopBar />
      <Navbar />

      <div className="max-w-[1200px] mx-auto px-4 py-8 md:py-12">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 flex items-center gap-3">
              <ShoppingBag className="text-blue-600" /> My Orders
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Paid orders ke items yahan show honge. Digital items ka download yahin se.
            </p>
          </div>

          <Link href="/products" className="inline-flex items-center gap-2 font-bold text-blue-600 hover:text-blue-800">
            <ArrowLeft size={18} /> Continue Shopping
          </Link>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex items-center gap-3 text-slate-700 font-bold">
            <Loader2 className="animate-spin" size={18} /> Loading orders...
          </div>
        ) : err ? (
          <div className="bg-red-50 rounded-2xl border border-red-200 p-6 shadow-sm text-red-700 font-bold">
            {err}
            <div className="mt-2 text-sm font-semibold text-red-700/80">
              Agar user logged-in nahi hai, pehle login karke aao.
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center shadow-sm">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 text-blue-600 mb-4">
              <Lock />
            </div>
            <div className="text-xl font-extrabold text-slate-900">No orders yet</div>
            <div className="text-sm text-slate-600 mt-2">Order complete karne ke baad yahan downloads milenge.</div>
            <Link
              href="/products"
              className="mt-6 inline-flex items-center justify-center px-6 py-3 rounded-xl bg-blue-600 text-white font-extrabold hover:bg-blue-700 transition"
            >
              Explore Products
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => (
              <div key={o._id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-slate-500 uppercase">Order</div>
                    <div className="font-extrabold text-slate-900 truncate">{o._id}</div>
                    <div className="text-xs text-slate-600 mt-1">
                      Status: <span className="font-extrabold">{safeStr(o.status) || "paid"}</span>
                      {o.createdAt ? <span> • {new Date(o.createdAt).toLocaleString()}</span> : null}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-extrabold text-slate-500 uppercase">Total</div>
                    <div className="text-xl font-extrabold text-slate-900">₹{money(Number(o.total || 0))}</div>
                  </div>
                </div>

                <div className="p-5">
                  <div className="text-sm font-extrabold text-slate-900 flex items-center gap-2 mb-3">
                    <FileText size={16} className="text-blue-600" /> Items
                  </div>

                  <div className="space-y-3">
                    {(Array.isArray(o.items) ? o.items : []).map((it, idx) => (
                      <div
                        key={(it.productId || "") + idx}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-blue-700 uppercase">
                            {safeStr(it.category) || "Product"}
                          </div>
                          <div className="font-extrabold text-slate-900 line-clamp-2">
                            {safeStr(it.title) || "Product"}
                          </div>
                          <div className="text-xs text-slate-600 mt-1">
                            Qty: {Number(it.quantity || 1)} • ₹{money(Number(it.price || 0))}
                          </div>
                        </div>

                        <button
                          onClick={() => download(String(it.productId || ""))}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-extrabold hover:bg-blue-700 transition"
                        >
                          <Download size={16} /> Download
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 text-[11px] text-slate-500 font-semibold">
                    Download button aapke backend download route se protected hai (paid check). Agar 202 coming_soon aata hai to message show hoga.
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
