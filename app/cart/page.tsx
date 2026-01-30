"use client";
import { useState } from "react";
import Link from "next/link";
import {
   Trash2, Plus, Minus, ArrowRight, ShoppingBag,
   ShieldCheck, ArrowLeft, Tag, CreditCard, CheckCircle, ShoppingCart
} from "lucide-react";
import { useCart } from "../../context/CartContext";
import TopBar from "../../components/TopBar";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";

export default function CartPage() {
   const { cart, removeFromCart, addToCart, cartTotal } = useCart();

   // --- PROMO CODE STATE ---
   const [coupon, setCoupon] = useState("");
   const [discount, setDiscount] = useState(0);
   const [couponMessage, setCouponMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

   // Quantity Handlers
   const increaseQty = (item: any) => addToCart({ ...item, quantity: 1 });
   const decreaseQty = (item: any) => {
      if (item.quantity > 1) addToCart({ ...item, quantity: -1 });
   };

   // --- COUPON LOGIC ---
   const handleApplyCoupon = () => {
      if (coupon.toUpperCase() === "IGNOU20") {
         const discValue = Math.round(cartTotal * 0.20);
         setDiscount(discValue);
         setCouponMessage({ type: 'success', text: 'Coupon "IGNOU20" Applied Successfully!' });
      } else {
         setDiscount(0);
         setCouponMessage({ type: 'error', text: 'Invalid Coupon Code' });
      }
   };

   const finalTotal = cartTotal - discount;

   // --- MOCK LATEST PRODUCTS (Cross-Sell Data) ---
   const latestProducts = [
      { id: "latest-1", title: "BEGAE-182 English Comm. Skills", price: 35, category: "Solved", image: "" },
      { id: "latest-2", title: "BHDLA-135 Hindi Bhasha", price: 35, category: "Solved", image: "" },
      { id: "latest-3", title: "BCOC-132 Business Org.", price: 35, category: "Solved", image: "" },
      { id: "latest-4", title: "BSOC-131 Sociology Intro", price: 35, category: "Solved", image: "" },
   ];

   return (
      <main className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800">
         <TopBar />
         <Navbar />

         <div className="max-w-[1200px] mx-auto px-4 py-8 md:py-12">

            {/* Page Title */}
            <div className="mb-8">
               <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-3">
                  <ShoppingBag className="text-blue-600" /> Your Shopping Cart
                  <span className="text-lg font-normal text-gray-500">({cart.length} Items)</span>
               </h1>
            </div>

            {/* --- EMPTY CART STATE --- */}
            {cart.length === 0 ? (
               <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-24 h-24 bg-blue-50 text-blue-300 rounded-full flex items-center justify-center mb-6">
                     <ShoppingBag size={48} />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">Your cart is empty</h2>
                  <p className="text-gray-500 mb-8 max-w-md">Looks like you haven't added any assignments or notes yet. Explore our collection to find what you need.</p>
                  <Link href="/solved-assignments" className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-blue-700 transition flex items-center gap-2 shadow-lg shadow-blue-200">
                     Start Shopping <ArrowRight size={18} />
                  </Link>
               </div>
            ) : (
               <div className="flex flex-col lg:flex-row gap-8 items-start mb-12">

                  {/* LEFT: CART ITEMS */}
                  <div className="flex-1 w-full space-y-4">
                     {cart.map((item) => (
                        <div key={item.id} className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm flex gap-4 sm:gap-6 items-start relative hover:shadow-md transition duration-300">
                           <div className="w-20 h-24 sm:w-24 sm:h-32 bg-gray-100 rounded-lg relative overflow-hidden flex-shrink-0 border border-gray-100">
                              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 bg-gray-50">
                                 <span className="text-xs font-bold text-center p-1">{item.courseCode || "PDF"}</span>
                              </div>
                           </div>
                           <div className="flex-1">
                              <div className="flex justify-between items-start mb-2">
                                 <div>
                                    <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full mb-1 uppercase tracking-wide">
                                       {item.category}
                                    </span>
                                    <h3 className="font-bold text-slate-900 text-sm sm:text-lg line-clamp-2 leading-snug">
                                       {item.title}
                                    </h3>
                                 </div>
                                 <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500 transition p-2 hover:bg-red-50 rounded-full">
                                    <Trash2 size={18} />
                                 </button>
                              </div>
                              <div className="flex flex-wrap items-end justify-between gap-4 mt-4">
                                 <div className="flex items-center border border-gray-200 rounded-lg h-10 bg-gray-50">
                                    <button onClick={() => decreaseQty(item)} className="px-3 hover:bg-gray-200 text-gray-500 h-full rounded-l-lg disabled:opacity-50" disabled={item.quantity <= 1}><Minus size={14} /></button>
                                    <span className="px-3 text-sm font-bold w-10 text-center bg-white h-full flex items-center justify-center border-x border-gray-200">{item.quantity}</span>
                                    <button onClick={() => increaseQty(item)} className="px-3 hover:bg-gray-200 text-gray-500 h-full rounded-r-lg"><Plus size={14} /></button>
                                 </div>
                                 <div className="text-right">
                                    <p className="font-bold text-xl text-slate-900">₹{item.price * item.quantity}</p>
                                    {item.quantity > 1 && <p className="text-xs text-gray-400">₹{item.price} each</p>}
                                 </div>
                              </div>
                           </div>
                        </div>
                     ))}
                     <div className="pt-4">
                        <Link href="/solved-assignments" className="inline-flex items-center gap-2 text-blue-600 font-bold hover:text-blue-800 transition">
                           <ArrowLeft size={18} /> Continue Shopping
                        </Link>
                     </div>
                  </div>

                  {/* RIGHT: SUMMARY */}
                  <div className="lg:w-[400px] flex-shrink-0 w-full">
                     <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sticky top-24">
                        <h3 className="font-bold text-xl text-slate-900 mb-6">Order Summary</h3>
                        <div className="space-y-3 mb-6 text-sm text-gray-600">
                           <div className="flex justify-between">
                              <span>Subtotal</span>
                              <span className="font-bold text-slate-900">₹{cartTotal}</span>
                           </div>
                           {discount > 0 && (
                              <div className="flex justify-between text-green-600 animate-in fade-in slide-in-from-top-1">
                                 <span>Discount (20%)</span>
                                 <span>- ₹{discount}</span>
                              </div>
                           )}
                           <div className="flex justify-between">
                              <span>Delivery Charges</span>
                              <span className="text-green-600 font-bold uppercase text-xs bg-green-50 px-2 py-0.5 rounded">Free</span>
                           </div>
                           <div className="border-t border-dashed border-gray-200 pt-4 mt-2 flex justify-between text-xl font-bold text-slate-900">
                              <span>Total Amount</span>
                              <span>₹{finalTotal}</span>
                           </div>
                           <p className="text-xs text-gray-400 text-right">(Inclusive of all taxes)</p>
                        </div>

                        {/* Promo Code */}
                        <div className="mb-6">
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Promo Code</label>
                           <div className="flex gap-2">
                              <div className="relative flex-1">
                                 <Tag size={16} className="absolute left-3 top-3.5 text-gray-400" />
                                 <input
                                    type="text" placeholder="Enter Code (Try IGNOU20)" value={coupon}
                                    onChange={(e) => setCoupon(e.target.value)}
                                    className="w-full pl-9 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                                 />
                              </div>
                              <button onClick={handleApplyCoupon} className="bg-slate-800 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-slate-900 transition">Apply</button>
                           </div>
                           {couponMessage && (
                              <div className={`mt-2 text-xs font-bold flex items-center gap-1.5 ${couponMessage.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                                 {couponMessage.type === 'success' ? <CheckCircle size={14} /> : <Tag size={14} />}
                                 {couponMessage.text}
                              </div>
                           )}
                        </div>

                        <Link href="/checkout" className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition shadow-lg shadow-blue-200 active:scale-95 flex items-center justify-center gap-2 mb-4">
                           Proceed to Checkout <ArrowRight size={20} />
                        </Link>

                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                           <div className="flex items-center gap-3 text-xs text-slate-600">
                              <ShieldCheck className="text-blue-600 flex-shrink-0" size={18} />
                              <span><strong>Secure Payment:</strong> We use encrypted SSL security.</span>
                           </div>
                           <div className="flex items-center gap-3 text-xs text-slate-600">
                              <CreditCard className="text-blue-600 flex-shrink-0" size={18} />
                              <span><strong>Accepts:</strong> UPI, Cards, NetBanking, Wallets.</span>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            )}
         </div>

         {/* ======================================================== */}
         {/* 🎀 NEW COLORFUL RIBBON: LATEST PRODUCTS (Cross-Sell) 🎀 */}
         {/* ======================================================== */}
         <section className="bg-gradient-to-r from-blue-700 via-indigo-600 to-violet-600 py-12 relative overflow-hidden">
            {/* Decorative Background Circles */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl"></div>

            <div className="max-w-[1400px] mx-auto px-4 relative z-10">
               <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                  <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                     ✨ Latest Arrivals <span className="text-sm font-normal bg-white/20 px-3 py-1 rounded-full border border-white/20">Fresh Content</span>
                  </h2>
                  <Link href="/solved-assignments" className="text-white text-sm font-bold border border-white/30 px-5 py-2.5 rounded-full hover:bg-white hover:text-blue-700 transition">
                     View All Products
                  </Link>
               </div>

               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {latestProducts.map((prod) => (
                     <div key={prod.id} className="bg-white p-3 rounded-xl hover:-translate-y-1 transition duration-300 shadow-lg group">
                        <div className="aspect-[3/4] bg-gray-100 rounded-lg mb-3 relative overflow-hidden border border-gray-100">
                           <div className="absolute inset-0 flex items-center justify-center text-gray-300 font-bold text-lg">IMG</div>
                           <span className="absolute top-2 left-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">NEW</span>
                        </div>
                        <h3 className="font-bold text-slate-800 text-xs md:text-sm line-clamp-2 mb-2 group-hover:text-blue-600 transition h-10">
                           {prod.title}
                        </h3>
                        <div className="flex items-center justify-between">
                           <span className="font-bold text-blue-700">₹{prod.price}</span>
                           <button
                              onClick={() => addToCart({ ...prod, quantity: 1, image: prod.image })}
                              className="bg-blue-50 text-blue-600 p-2 rounded-lg hover:bg-blue-600 hover:text-white transition"
                              title="Add to Cart"
                           >
                              <Plus size={16} />
                           </button>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         </section>

         <Footer />
      </main>
   );
}