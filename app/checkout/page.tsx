"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import {
    ArrowLeft, ShieldCheck, MapPin, Phone, Mail, User,
    Lock, CheckCircle, ChevronRight, CreditCard, Headphones, BadgeCheck, Truck
} from "lucide-react";
import { useCart } from "../../context/CartContext";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";

declare global {
    interface Window {
        Razorpay: any;
    }
}

export default function CheckoutPage() {
    const router = useRouter();
    const { cart, cartTotal, clearCart } = useCart();

    const [isProcessing, setIsProcessing] = useState(false);
    const [isAgreed, setIsAgreed] = useState(false);

    // 🧠 Logic: Check if cart has any physical item (Hardcopy)
    const hasPhysicalItem = cart.some((item) =>
        item.category.toLowerCase().includes("hardcopy") ||
        item.category.toLowerCase().includes("handwritten") ||
        item.title.toLowerCase().includes("delivery")
    );

    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        phone: "",
        address: "",
        pincode: "",
        city: "",
        state: "Haryana"
    });

    const finalTotal = cartTotal;

    const handleInputChange = (e: any) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // --- RAZORPAY PAYMENT LOGIC ---
    const handleCompleteOrder = async () => {
        // 1. Basic Validation
        if (!formData.fullName || !formData.email || !formData.phone) {
            alert("Please fill in your Contact Details.");
            return;
        }

        // 2. Address Validation (Only if physical item exists)
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

        // 3. Load Script
        const res = await loadRazorpayScript();
        if (!res) {
            alert("Razorpay SDK failed to load. Are you online?");
            setIsProcessing(false);
            return;
        }

        // 4. Razorpay Options
        const options = {
            key: "rzp_test_YOUR_KEY_HERE", // 🔴 Replace with REAL KEY
            amount: finalTotal * 100,
            currency: "INR",
            name: "IGNOU Students Portal",
            description: hasPhysicalItem ? "Study Material & Delivery" : "Digital Study Material",
            image: "/logo.png",
            handler: function (response: any) {
                console.log("Payment ID: ", response.razorpay_payment_id);
                clearCart();
                router.push("/order-success");
            },
            prefill: {
                name: formData.fullName,
                email: formData.email,
                contact: formData.phone,
            },
            theme: {
                color: "#2563EB",
            },
        };

        const paymentObject = new window.Razorpay(options);
        paymentObject.open();
        setIsProcessing(false);
    };

    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    return (
        <main className="min-h-screen font-sans text-slate-800">
            <Navbar />

            {/* ================= RIBBON 1: GREY BREADCRUMB ================= */}
            <div className="bg-gray-100 border-b border-gray-200 py-3">
                <div className="max-w-[1200px] mx-auto px-4 text-xs md:text-sm text-gray-500 flex items-center gap-2">
                    <Link href="/" className="hover:text-blue-600">Home</Link>
                    <ChevronRight size={12} />
                    <Link href="/cart" className="hover:text-blue-600">Cart</Link>
                    <ChevronRight size={12} />
                    <span className="text-slate-800 font-bold">Checkout</span>
                </div>
            </div>

            {/* ================= RIBBON 2: WHITE STEPPER ================= */}
            <div className="bg-white border-b border-gray-100 py-6">
                <div className="max-w-[600px] mx-auto px-4">
                    <div className="flex items-center justify-between relative">
                        <div className="absolute left-0 top-1/2 w-full h-1 bg-gray-100 -z-10 -translate-y-1/2"></div>

                        <div className="flex flex-col items-center gap-2 bg-white px-2">
                            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-lg shadow-blue-200 ring-4 ring-blue-50">1</div>
                            <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">Details</span>
                        </div>

                        <div className="flex flex-col items-center gap-2 bg-white px-2">
                            <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-bold text-sm">2</div>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Payment</span>
                        </div>

                        <div className="flex flex-col items-center gap-2 bg-white px-2">
                            <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-bold text-sm">3</div>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Done</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ================= RIBBON 3: PINK MAIN CONTENT (FORM) ================= */}
            <div className="bg-[#FFF5F7] py-12">
                <div className="max-w-[1200px] mx-auto px-4">

                    {cart.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-3xl border border-pink-100 shadow-sm">
                            <h2 className="text-xl font-bold text-slate-500">Your cart is empty.</h2>
                            <Link href="/" className="text-blue-600 font-bold hover:underline mt-2 inline-block">Go Home</Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                            {/* LEFT COLUMN: FORMS */}
                            <div className="lg:col-span-8 space-y-6">

                                {/* 1. CONTACT DETAILS CARD */}
                                <div className="bg-white p-6 md:p-8 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300">
                                    <div className="flex items-center gap-3 mb-6 pb-2 border-b border-gray-100">
                                        <div className="bg-blue-50 p-2 rounded-full text-blue-600"><User size={20} /></div>
                                        <h2 className="text-xl font-bold text-slate-900">Contact Details</h2>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div className="space-y-1.5 md:col-span-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Full Name <span className="text-red-500">*</span></label>
                                            <input name="fullName" type="text" placeholder="Enter your name" className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-gray-300" onChange={handleInputChange} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Email Address <span className="text-red-500">*</span></label>
                                            <input name="email" type="email" placeholder="student@gmail.com" className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-gray-300" onChange={handleInputChange} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Phone Number <span className="text-red-500">*</span></label>
                                            <input name="phone" type="tel" placeholder="+91 99999 99999" className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-gray-300" onChange={handleInputChange} />
                                        </div>
                                    </div>
                                </div>

                                {/* 2. BILLING ADDRESS CARD (CONDITIONAL RENDER) */}
                                {hasPhysicalItem ? (
                                    <div className="bg-white p-6 md:p-8 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300 animate-in slide-in-from-top-2">
                                        <div className="flex items-center gap-3 mb-6 pb-2 border-b border-gray-100">
                                            <div className="bg-orange-50 p-2 rounded-full text-orange-600"><Truck size={20} /></div>
                                            <div>
                                                <h2 className="text-xl font-bold text-slate-900">Delivery Address</h2>
                                                <p className="text-xs text-slate-500">Required for shipping hardcopy items.</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div className="space-y-1.5 md:col-span-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Address (House No, Street) <span className="text-red-500">*</span></label>
                                                <input name="address" type="text" placeholder="123, Street Name, Area" className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-gray-300" onChange={handleInputChange} />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Pincode <span className="text-red-500">*</span></label>
                                                <input name="pincode" type="text" placeholder="110001" className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-gray-300" onChange={handleInputChange} />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">City <span className="text-red-500">*</span></label>
                                                <input name="city" type="text" placeholder="Delhi" className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-gray-300" onChange={handleInputChange} />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    // Hidden Message for PDF only
                                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3 items-center text-green-800 text-sm">
                                        <CheckCircle size={20} />
                                        <span>No physical address required. You are purchasing digital files (PDFs).</span>
                                    </div>
                                )}

                                {/* 3. PAYMENT METHOD CARD */}
                                <div className="bg-white p-6 md:p-8 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300">
                                    <div className="flex items-center gap-3 mb-6 pb-2 border-b border-gray-100">
                                        <div className="bg-purple-50 p-2 rounded-full text-purple-600"><CreditCard size={20} /></div>
                                        <h2 className="text-xl font-bold text-slate-900">Payment Method</h2>
                                    </div>

                                    <div className="p-4 border border-blue-200 bg-blue-50/50 rounded-xl flex items-center gap-4 cursor-pointer hover:bg-blue-50 transition">
                                        <div className="h-5 w-5 rounded-full border-[6px] border-blue-600 bg-white shadow-sm"></div>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-slate-900 text-sm">Razorpay Secure Payment</h3>
                                            <p className="text-xs text-slate-500">UPI (GPay/PhonePe), Wallet, Cards, NetBanking</p>
                                        </div>
                                        <div className="flex gap-1 opacity-70">
                                            {/* Razorpay logos mock */}
                                            <div className="h-6 w-10 bg-white rounded border border-gray-200 flex items-center justify-center text-[8px] font-bold text-slate-600">UPI</div>
                                            <div className="h-6 w-10 bg-white rounded border border-gray-200 flex items-center justify-center text-[8px] font-bold text-slate-600">RUPAY</div>
                                        </div>
                                    </div>
                                    <p className="mt-3 text-xs text-gray-400 flex items-center gap-1.5 ml-1">
                                        <Lock size={12} /> 100% Encrypted & Secure connection.
                                    </p>
                                </div>

                            </div>

                            {/* RIGHT COLUMN: SUMMARY (Sticky) */}
                            <div className="lg:col-span-4 lg:sticky lg:top-4 space-y-4">

                                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-lg shadow-gray-200/50">
                                    <h3 className="font-bold text-lg text-slate-900 mb-4 border-b border-gray-100 pb-4">Order Summary</h3>

                                    <div className="space-y-3 mb-6 max-h-[200px] overflow-y-auto custom-scrollbar">
                                        {cart.map(item => (
                                            <div key={item.id} className="flex justify-between text-xs text-slate-600">
                                                <span className="line-clamp-2 w-2/3 pr-2">{item.title}</span>
                                                <span className="font-bold">₹{item.price * item.quantity}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="border-t border-dashed border-gray-200 pt-4 space-y-2 text-sm">
                                        <div className="flex justify-between text-slate-600">
                                            <span>Subtotal</span>
                                            <span>₹{cartTotal}</span>
                                        </div>
                                        <div className="flex justify-between text-green-600 font-bold">
                                            <span>Delivery</span>
                                            <span>{hasPhysicalItem ? "₹0 (Free)" : "NA"}</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between text-2xl font-extrabold text-slate-900 border-t border-gray-200 pt-4 mt-4 mb-6">
                                        <span>Total</span>
                                        <span>₹{finalTotal}</span>
                                    </div>

                                    {/* Terms Checkbox (Updated with Working Link) */}
                                    <div className="flex gap-3 items-start mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <input
                                            type="checkbox"
                                            id="terms"
                                            checked={isAgreed}
                                            onChange={(e) => setIsAgreed(e.target.checked)}
                                            className="mt-0.5 w-4 h-4 accent-blue-600 cursor-pointer"
                                        />
                                        <label htmlFor="terms" className="text-xs text-slate-500 leading-tight cursor-pointer select-none">
                                            I agree to the{' '}
                                            <Link href="/terms" target="_blank" className="text-blue-600 font-bold hover:underline">
                                                Terms & Conditions
                                            </Link>
                                            {' '}and{' '}
                                            <Link href="/privacy" target="_blank" className="text-blue-600 font-bold hover:underline">
                                                Privacy Policy
                                            </Link>
                                            . I understand that digital products are non-refundable.
                                        </label>
                                    </div>
                                    <button
                                        onClick={handleCompleteOrder}
                                        disabled={isProcessing}
                                        className={`w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition shadow-lg ${isProcessing
                                                ? 'bg-blue-400 cursor-wait'
                                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 active:scale-95'
                                            }`}
                                    >
                                        {isProcessing ? "Processing..." : <><Lock size={18} /> Complete Order</>}
                                    </button>

                                    <div className="mt-4 text-center">
                                        <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Powered By</p>
                                        <div className="text-xl font-bold text-blue-900 opacity-80">Razorpay</div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ================= RIBBON 4: TRUST BADGES ================= */}
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