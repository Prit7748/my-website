"use client";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gray-50 font-sans text-slate-800">
      <Navbar />
      
      <div className="max-w-[1000px] mx-auto px-4 py-12">
        <div className="bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-gray-200">
            <h1 className="text-3xl font-bold text-slate-900 mb-6">Terms and Conditions</h1>
            <p className="text-slate-500 mb-8 text-sm">Last Updated: January 2026</p>

            <div className="space-y-6 text-slate-700 leading-relaxed">
                <section>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">1. Introduction</h2>
                    <p>Welcome to <strong>IGNOU Students Portal</strong>. By purchasing from our website, you agree to the following terms. We provide educational resources like Solved Assignments, Notes, and Guess Papers to help students.</p>
                </section>

                <section>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">2. Digital Products & Refunds</h2>
                    <p>Since most of our products are <strong>Digital Files (PDFs)</strong> which are downloadable instantly, <strong>we strictly do not offer refunds</strong> once the file has been downloaded or emailed. Please check the subject code and medium (Hindi/English) carefully before buying.</p>
                </section>

                <section>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">3. Hardcopy Delivery</h2>
                    <p>For Handwritten Hardcopy orders, delivery usually takes <strong>7-10 working days</strong> via Speed Post. Delays due to courier services are beyond our control, though we will assist in tracking.</p>
                </section>

                <section>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">4. Usage Rights</h2>
                    <p>The study material provided is for <strong>personal reference and educational use only</strong>. Reselling, distributing, or publishing our PDF files on other websites/groups is strictly prohibited and legal action may be taken.</p>
                </section>

                <section>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">5. Contact Us</h2>
                    <p>If you have any issues with your order, please contact us via WhatsApp or Email mentioned on the Contact page.</p>
                </section>
            </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}