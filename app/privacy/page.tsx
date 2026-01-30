"use client";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-50 font-sans text-slate-800">
      <Navbar />
      
      <div className="max-w-[1000px] mx-auto px-4 py-12">
        <div className="bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-gray-200">
            <h1 className="text-3xl font-bold text-slate-900 mb-6">Privacy Policy</h1>
            <p className="text-slate-500 mb-8 text-sm">Your privacy is important to us.</p>

            <div className="space-y-6 text-slate-700 leading-relaxed">
                <section>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">1. Information We Collect</h2>
                    <p>We collect basic information required to process your order, such as:</p>
                    <ul className="list-disc ml-5 mt-2 space-y-1">
                        <li><strong>Name:</strong> To identify the student.</li>
                        <li><strong>Email Address:</strong> To send the PDF files and order receipts.</li>
                        <li><strong>Phone Number:</strong> To contact you via WhatsApp for support or delivery updates.</li>
                        <li><strong>Address:</strong> Only if you order physical items (Hardcopy).</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">2. Payment Security</h2>
                    <p>We use <strong>Razorpay</strong> as our payment gateway. We <strong>do not</strong> store your credit card, debit card, or UPI PIN details on our servers. All transactions are processed securely by Razorpay.</p>
                </section>

                <section>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">3. Data Sharing</h2>
                    <p>We do not sell, trade, or rent your personal identification information to others. Your data is used solely for order fulfillment and internal support.</p>
                </section>
            </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}