// ✅ 2) COMPLETE REPLACE: app/checkout/page.tsx
"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ShieldCheck,
  User,
  Lock,
  CheckCircle,
  ChevronRight,
  CreditCard,
  Headphones,
  BadgeCheck,
  Truck,
} from "lucide-react";
import { useCart } from "../../context/CartContext";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

function safeStr(x: any) {
  return String(x ?? "").trim();
}
function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ✅ robust orderId picker (unknown backend key name safe)
function pickRazorpayOrderId(d: any) {
  const cands = [
    d?.razorpayOrderId,
    d?.orderId,
    d?.id,
    d?.order?.id,
    d?.razorpay?.orderId,
    d?.razorpay?.id,
    d?.data?.razorpayOrderId,
    d?.data?.orderId,
    d?.data?.id,
    d?.data?.order?.id,
    d?.payload?.razorpayOrderId,
    d?.payload?.orderId,
    d?.payload?.id,
  ];
  for (const v of cands) {
    const s = safeStr(v);
    if (s) return s;
  }
  return "";
}

// ✅ robust keyId picker (unknown backend key name safe)
function pickKeyId(d: any) {
  const cands = [
    d?.keyId,
    d?.key,
    d?.key_id,
    d?.razorpayKey,
    d?.razorpayKeyId,
    d?.publicKey,
    d?.data?.keyId,
    d?.data?.key,
    d?.data?.key_id,
  ];
  for (const v of cands) {
    const s = safeStr(v);
    if (s) return s;
  }
  return "";
}

export default function CheckoutPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { cart, cartTotal, clearCart } = useCart();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);
  const [err, setErr] = useState("");

  // ✅ Cart page se coupon/discount (optional)
  const coupon = safeStr(sp.get("coupon") || "");
  const discount = useMemo(() => {
    if (!coupon) return 0;
    if (coupon.toUpperCase() !== "IGNOU20") return 0;
    return Math.round(cartTotal * 0.2);
  }, [coupon, cartTotal]);

  // 🧠 Logic: Check if cart has any physical item (Hardcopy)
  const hasPhysicalItem = useMemo(() => {
    return cart.some((item: any) => {
      const c = safeStr(item?.category).toLowerCase();
      const t = safeStr(item?.title).toLowerCase();
      return c.includes("hardcopy") || c.includes("handwritten") || t.includes("delivery");
    });
  }, [cart]);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    pincode: "",
    city: "",
    state: "Haryana",
  });

  const finalTotal = Math.max(0, cartTotal - discount);

  const handleInputChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // ✅ IMPORTANT: aapke screenshot ke according exact routes
  const CREATE_ORDER_API = "/api/payments/razorpay/create-order";
  const VERIFY_API = "/api/payments/razorpay/verify";

  const handleCompleteOrder = async () => {
    setErr("");

    // 0) cart empty
    if (!cart || cart.length === 0) {
      router.push("/cart");
      return;
    }

    // 1) Basic Validation
    if (!formData.fullName || !formData.email || !formData.phone) {
      alert("Please fill in your Contact Details.");
      return;
    }

    // 2) Address Validation (Only if physical item exists)
    if (hasPhysicalItem) {
      if (!formData.address || !formData.pincode || !formData.city) {
        alert("Please fill in your Delivery Address for shipping.");
        return;
      }
    }

    if (!isAgreed) {
      alert("Please accept the Terms & Conditions.");
      return;
    }

    setIsProcessing(true);

    try {
      // 3) Load Razorpay SDK
      const ok = await loadRazorpayScript();
      if (!ok) {
        setErr("Razorpay SDK failed to load. Internet/adblock check karo.");
        return;
      }

      // 4) Create Order (Server)
      // ⚠️ IMPORTANT:
      // cart item "id" must be Mongo ObjectId for paid/download logic.
      // If aapke cart me slug stored hai, to ProductDetailsClient me id = product._id set karna hoga.
      const payload = {
        coupon: coupon || "",
        customer: {
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
        },
        shipping: hasPhysicalItem
          ? {
              address: formData.address,
              pincode: formData.pincode,
              city: formData.city,
              state: formData.state,
            }
          : null,
        items: cart.map((it: any) => ({
          productId: String(it.id || ""), // ✅ Mongo ObjectId expected
          title: safeStr(it.title),
          category: safeStr(it.category),
          price: safeNum(it.price, 0),
          quantity: safeNum(it.quantity, 1),
        })),
        // optional totals (backend ignore bhi kare to ok)
        totals: {
          cartTotal: safeNum(cartTotal, 0),
          discount: safeNum(discount, 0),
          finalTotal: safeNum(finalTotal, 0),
        },
        hasPhysicalItem,
      };

      const r1 = await fetch(CREATE_ORDER_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const d1 = await r1.json().catch(() => ({}));
      if (!r1.ok) {
        setErr(d1?.error || "Create order failed");
        return;
      }

      // ✅ handle unknown backend response keys safely
      const keyId = pickKeyId(d1) || safeStr(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "");
      const razorpayOrderId = pickRazorpayOrderId(d1);
      const amount = safeNum(d1?.amount, Math.round(finalTotal * 100)); // paise
      const currency = safeStr(d1?.currency || "INR");

      // any internal reference returned by backend (optional)
      const orderRef = safeStr(d1?.orderRef || d1?.ref || d1?.order_id || d1?.dbOrderId || "");

      if (!keyId) {
        setErr("Razorpay Key missing: create-order response me keyId/key nahi aaya + NEXT_PUBLIC_RAZORPAY_KEY_ID bhi missing.");
        return;
      }
      if (!razorpayOrderId) {
        // helpful debug (without breaking)
        setErr(
          "Create-order response me Razorpay order id missing hai. Backend se key name check karo (razorpayOrderId/orderId/id/order.id)."
        );
        return;
      }

      // 5) Open Razorpay
      const options = {
        key: keyId,
        amount,
        currency,
        name: "IGNOU Students Portal",
        description: hasPhysicalItem ? "Study Material & Delivery" : "Digital Study Material",
        image: "/logo.png",
        order_id: razorpayOrderId,
        prefill: {
          name: formData.fullName,
          email: formData.email,
          contact: formData.phone,
        },
        theme: { color: "#2563EB" },
        handler: async (response: any) => {
          try {
            // 6) Verify Payment (Server)
            const vr = await fetch(VERIFY_API, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                razorpay_order_id: response?.razorpay_order_id,
                razorpay_payment_id: response?.razorpay_payment_id,
                razorpay_signature: response?.razorpay_signature,
                orderRef, // optional
              }),
            });

            const vd = await vr.json().catch(() => ({}));
            if (!vr.ok) {
              setErr(vd?.error || "Payment verify failed");
              return;
            }

            // ✅ success
            clearCart();
            router.push("/order-success");
            router.refresh();
          } catch {
            setErr("Verify request failed.");
          }
        },
        modal: {
          ondismiss: () => {},
        },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (e: any) {
      setErr(e?.message || "Checkout failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="min-h-screen font-sans text-slate-800">
      <Navbar />

      <div className="bg-gray-100 border-b border-gray-200 py-3">
        <div className="max-w-[1200px] mx-auto px-4 text-xs md:text-sm text-gray-500 flex items-center gap-2">
          <Link href="/" className="hover:text-blue-600">
            Home
          </Link>
          <ChevronRight size={12} />
          <Link href="/cart" className="hover:text-blue-600">
            Cart
          </Link>
          <ChevronRight size={12} />
          <span className="text-slate-800 font-bold">Checkout</span>
        </div>
      </div>

      <div className="bg-white border-b border-gray-100 py-6">
        <div className="max-w-[600px] mx-auto px-4">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 w-full h-1 bg-gray-100 -z-10 -translate-y-1/2"></div>

            <div className="flex flex-col items-center gap-2 bg-white px-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-lg shadow-blue-200 ring-4 ring-blue-50">
                1
              </div>
              <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">Details</span>
            </div>

            <div className="flex flex-col items-center gap-2 bg-white px-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-bold text-sm">
                2
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Payment</span>
            </div>

            <div className="flex flex-col items-center gap-2 bg-white px-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-bold text-sm">
                3
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Done</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#FFF5F7] py-12">
        <div className="max-w-[1200px] mx-auto px-4">
          {cart.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-pink-100 shadow-sm">
              <h2 className="text-xl font-bold text-slate-500">Your cart is empty.</h2>
              <Link href="/" className="text-blue-600 font-bold hover:underline mt-2 inline-block">
                Go Home
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-white p-6 md:p-8 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300">
                  <div className="flex items-center gap-3 mb-6 pb-2 border-b border-gray-100">
                    <div className="bg-blue-50 p-2 rounded-full text-blue-600">
                      <User size={20} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">Contact Details</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        name="fullName"
                        type="text"
                        placeholder="Enter your name"
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-gray-300"
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        name="email"
                        type="email"
                        placeholder="student@gmail.com"
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-gray-300"
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        name="phone"
                        type="tel"
                        placeholder="+91 99999 99999"
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-gray-300"
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </div>

                {hasPhysicalItem ? (
                  <div className="bg-white p-6 md:p-8 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300 animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-3 mb-6 pb-2 border-b border-gray-100">
                      <div className="bg-orange-50 p-2 rounded-full text-orange-600">
                        <Truck size={20} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">Delivery Address</h2>
                        <p className="text-xs text-slate-500">Required for shipping hardcopy items.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                          Address (House No, Street) <span className="text-red-500">*</span>
                        </label>
                        <input
                          name="address"
                          type="text"
                          placeholder="123, Street Name, Area"
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-gray-300"
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                          Pincode <span className="text-red-500">*</span>
                        </label>
                        <input
                          name="pincode"
                          type="text"
                          placeholder="110001"
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-gray-300"
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                          City <span className="text-red-500">*</span>
                        </label>
                        <input
                          name="city"
                          type="text"
                          placeholder="Delhi"
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-gray-300"
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3 items-center text-green-800 text-sm">
                    <CheckCircle size={20} />
                    <span>No physical address required. You are purchasing digital files (PDFs).</span>
                  </div>
                )}

                <div className="bg-white p-6 md:p-8 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300">
                  <div className="flex items-center gap-3 mb-6 pb-2 border-b border-gray-100">
                    <div className="bg-purple-50 p-2 rounded-full text-purple-600">
                      <CreditCard size={20} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">Payment Method</h2>
                  </div>

                  <div className="p-4 border border-blue-200 bg-blue-50/50 rounded-xl flex items-center gap-4 cursor-pointer hover:bg-blue-50 transition">
                    <div className="h-5 w-5 rounded-full border-[6px] border-blue-600 bg-white shadow-sm"></div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 text-sm">Razorpay Secure Payment</h3>
                      <p className="text-xs text-slate-500">UPI (GPay/PhonePe), Wallet, Cards, NetBanking</p>
                    </div>
                    <div className="flex gap-1 opacity-70">
                      <div className="h-6 w-10 bg-white rounded border border-gray-200 flex items-center justify-center text-[8px] font-bold text-slate-600">
                        UPI
                      </div>
                      <div className="h-6 w-10 bg-white rounded border border-gray-200 flex items-center justify-center text-[8px] font-bold text-slate-600">
                        RUPAY
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-gray-400 flex items-center gap-1.5 ml-1">
                    <Lock size={12} /> 100% Encrypted & Secure connection.
                  </p>

                  {err ? (
                    <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm font-bold text-red-700">
                      {err}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="lg:col-span-4 lg:sticky lg:top-4 space-y-4">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-lg shadow-gray-200/50">
                  <h3 className="font-bold text-lg text-slate-900 mb-4 border-b border-gray-100 pb-4">
                    Order Summary
                  </h3>

                  <div className="space-y-3 mb-6 max-h-[200px] overflow-y-auto custom-scrollbar">
                    {cart.map((item: any) => (
                      <div key={String(item.id)} className="flex justify-between text-xs text-slate-600">
                        <span className="line-clamp-2 w-2/3 pr-2">{item.title}</span>
                        <span className="font-bold">₹{safeNum(item.price, 0) * safeNum(item.quantity, 1)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-dashed border-gray-200 pt-4 space-y-2 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal</span>
                      <span>₹{cartTotal}</span>
                    </div>

                    {discount > 0 ? (
                      <div className="flex justify-between text-green-700 font-bold">
                        <span>Discount ({coupon.toUpperCase()})</span>
                        <span>-₹{discount}</span>
                      </div>
                    ) : null}

                    <div className="flex justify-between text-green-600 font-bold">
                      <span>Delivery</span>
                      <span>{hasPhysicalItem ? "₹0 (Free)" : "NA"}</span>
                    </div>
                  </div>

                  <div className="flex justify-between text-2xl font-extrabold text-slate-900 border-t border-gray-200 pt-4 mt-4 mb-6">
                    <span>Total</span>
                    <span>₹{finalTotal}</span>
                  </div>

                  <div className="flex gap-3 items-start mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <input
                      type="checkbox"
                      id="terms"
                      checked={isAgreed}
                      onChange={(e) => setIsAgreed(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-blue-600 cursor-pointer"
                    />
                    <label
                      htmlFor="terms"
                      className="text-xs text-slate-500 leading-tight cursor-pointer select-none"
                    >
                      I agree to the{" "}
                      <Link href="/terms" target="_blank" className="text-blue-600 font-bold hover:underline">
                        Terms & Conditions
                      </Link>{" "}
                      and{" "}
                      <Link
                        href="/privacy"
                        target="_blank"
                        className="text-blue-600 font-bold hover:underline"
                      >
                        Privacy Policy
                      </Link>
                      . I understand that digital products are non-refundable.
                    </label>
                  </div>

                  <button
                    onClick={handleCompleteOrder}
                    disabled={isProcessing}
                    className={`w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition shadow-lg ${
                      isProcessing
                        ? "bg-blue-400 cursor-wait"
                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 active:scale-95"
                    }`}
                  >
                    {isProcessing ? "Processing..." : (
                      <>
                        <Lock size={18} /> Complete Order
                      </>
                    )}
                  </button>

                  <div className="mt-4 text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Powered By</p>
                    <div className="text-xl font-bold text-blue-900 opacity-80">Razorpay</div>
                  </div>

                  <div className="mt-5 text-xs text-slate-600 flex items-center gap-2">
                    <ArrowLeft size={16} />
                    <Link href="/cart" className="font-bold text-blue-600 hover:underline">
                      Back to Cart
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#EFF6FF] border-t border-blue-100 py-10">
        <div className="max-w-[1000px] mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
                <BadgeCheck size={24} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">100% Verified Content</h4>
                <p className="text-xs text-slate-500 mt-1">Assignments prepared by IGNOU Toppers.</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">Secure Payment</h4>
                <p className="text-xs text-slate-500 mt-1">256-bit SSL Encryption via Razorpay.</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
                <Headphones size={24} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">Instant Support</h4>
                <p className="text-xs text-slate-500 mt-1">WhatsApp support available 24/7.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
