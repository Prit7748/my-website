"use client";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import TopBar from "../../components/TopBar";
import { AlertCircle, CheckCircle, RefreshCcw } from "lucide-react";

export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50 font-sans text-slate-800">
      <TopBar />
      <Navbar />
      
      <div className="max-w-[1000px] mx-auto px-4 py-12">
        <div className="bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-gray-200">
            <h1 className="text-3xl font-bold text-slate-900 mb-6">Refund & Cancellation Policy</h1>
            <p className="text-slate-500 mb-8 text-sm bg-gray-100 inline-block px-3 py-1 rounded-full">Last Updated: January 2026</p>

            <div className="space-y-8 text-slate-700 leading-relaxed">
                
                {/* Section 1: Digital Products */}
                <section className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                    <h2 className="text-xl font-bold text-blue-900 mb-3 flex items-center gap-2">
                        <CheckCircle size={20}/> 1. Digital Products (PDFs)
                    </h2>
                    <p className="mb-3">
                        Since our primary products are digital files (Solved Assignments, Notes, Guess Papers) that are downloadable instantly after payment, <strong>we strictly do not offer refunds</strong> once the file has been downloaded or emailed to you.
                    </p>
                    <p className="font-bold text-blue-800 text-sm">Exceptions for Refund:</p>
                    <ul className="list-disc ml-5 mt-2 space-y-1 text-sm">
                        <li>If you received the wrong subject code (e.g., ordered MHD-01 but got MHD-02).</li>
                        <li>If the file is corrupt or blank.</li>
                        <li>If the medium (English/Hindi) is different from what you ordered.</li>
                    </ul>
                    <p className="mt-3 text-sm text-slate-600">
                        In such cases, please contact us within 24 hours via WhatsApp or Email, and we will send the correct file immediately or issue a full refund.
                    </p>
                </section>

                {/* Section 2: Physical Products */}
                <section className="bg-orange-50 p-6 rounded-xl border border-orange-100">
                    <h2 className="text-xl font-bold text-orange-900 mb-3 flex items-center gap-2">
                        <RefreshCcw size={20}/> 2. Physical Products (Hardcopies)
                    </h2>
                    <p className="mb-3">
                        For handwritten assignments or notes delivered via courier:
                    </p>
                    <ul className="list-disc ml-5 mt-2 space-y-1 text-sm">
                        <li><strong>Cancellation:</strong> You can cancel your order within 24 hours of placing it, provided it has not been shipped yet. Once shipped, orders cannot be cancelled.</li>
                        <li><strong>Return/Replacement:</strong> We do not accept returns. However, if you receive a damaged product or missing pages, we will send a replacement free of cost. Please record an unboxing video as proof.</li>
                    </ul>
                </section>

                {/* Section 3: Processing Time */}
                <section>
                    <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <AlertCircle size={20} className="text-slate-500"/> 3. Refund Processing Time
                    </h2>
                    <p>
                        If your refund request is approved, the amount will be processed within <strong>5-7 working days</strong> and credited back to your original payment method (Bank Account, UPI, or Card) via Razorpay.
                    </p>
                </section>

                {/* Section 4: Contact */}
                <section className="pt-6 border-t border-gray-100">
                    <h2 className="text-xl font-bold text-slate-900 mb-3">4. Contact Us</h2>
                    <p>If you have any questions about our Refunds Policy, please contact us:</p>
                    <ul className="list-none mt-2 space-y-1 font-medium text-blue-600">
                        <li>• WhatsApp: 7496865680</li>
                        <li>• Email: support@ignouportal.com</li>
                    </ul>
                </section>
            </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}