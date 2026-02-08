"use client";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import TopBar from "../../components/TopBar"; // 👈 Import added
import { Plus } from "lucide-react";

export default function FAQPage() {
  const faqs = [
    { q: "How will I receive the PDF file?", a: "Once the payment is successful, you will see a Download button instantly. Also, a copy of the PDF will be sent to your registered email address." },
    { q: "Are these assignments valid for 2025-26?", a: "Yes, we update our content regularly. Please check the session mentioned in the product title before buying." },
    { q: "Can I get a refund if the file is wrong?", a: "If there is a mistake from our side (e.g., wrong medium or subject code), we will provide a replacement or refund. However, refunds are not available for mistaken purchases by the user." },
    { q: "How long does Hardcopy delivery take?", a: "Handwritten hardcopies are sent via Speed Post and usually take 7-10 working days to reach your address." },
    { q: "Do you provide projects synopsis?", a: "Yes, we provide approval-guaranteed projects synopsis and reports for MBA, MA, and other courses." },
  ];

  return (
    <main className="min-h-screen bg-gray-50 font-sans text-slate-800">
      {/* 👇 Added TopBar */}
      <TopBar />
      <Navbar />

      <div className="max-w-[800px] mx-auto px-4 py-16">
         <h1 className="text-3xl font-bold text-center text-slate-900 mb-2">Frequently Asked Questions</h1>
         <p className="text-center text-slate-500 mb-10">Have questions? We have answers.</p>

         <div className="space-y-4">
            {faqs.map((faq, i) => (
               <details key={i} className="group bg-white p-5 rounded-2xl border border-gray-200 shadow-sm [&_summary::-webkit-details-marker]:hidden cursor-pointer">
                  <summary className="flex items-center justify-between font-bold text-slate-900 list-none">
                     {faq.q}
                     <span className="bg-blue-50 text-blue-600 rounded-full p-1 transition group-open:rotate-45">
                        <Plus size={16}/>
                     </span>
                  </summary>
                  <p className="text-slate-600 mt-4 leading-relaxed text-sm animate-in slide-in-from-top-2">
                     {faq.a}
                  </p>
               </details>
            ))}
         </div>
      </div>

      <Footer />
    </main>
  );
}