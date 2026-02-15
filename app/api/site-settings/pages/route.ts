import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import PolicyPage from "@/models/PolicyPage";
import { requireAdmin } from "@/lib/adminAuth";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

const DEFAULTS: Record<
  string,
  { title: string; subtitle: string; contentHtml: string }
> = {
  privacy: {
    title: "Privacy Policy",
    subtitle: "Your privacy is important to us.",
    contentHtml: `
      <div class="space-y-6 text-slate-700 leading-relaxed">
        <section>
          <h2 class="text-xl font-bold text-slate-900 mb-2">1. Information We Collect</h2>
          <p>We collect basic information required to process your order, such as:</p>
          <ul class="list-disc ml-5 mt-2 space-y-1">
            <li><strong>Name:</strong> To identify the student.</li>
            <li><strong>Email Address:</strong> To send the PDF files and order receipts.</li>
            <li><strong>Phone Number:</strong> To contact you via WhatsApp for support or delivery updates.</li>
            <li><strong>Address:</strong> Only if you order physical items (Hardcopy).</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-bold text-slate-900 mb-2">2. Payment Security</h2>
          <p>We use <strong>Razorpay</strong> as our payment gateway. We <strong>do not</strong> store your credit card, debit card, or UPI PIN details on our servers. All transactions are processed securely by Razorpay.</p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-slate-900 mb-2">3. Data Sharing</h2>
          <p>We do not sell, trade, or rent your personal identification information to others. Your data is used solely for order fulfillment and internal support.</p>
        </section>
      </div>
    `.trim(),
  },

  terms: {
    title: "Terms and Conditions",
    subtitle: "Last Updated: January 2026",
    contentHtml: `
      <div class="space-y-6 text-slate-700 leading-relaxed">
        <section>
          <h2 class="text-xl font-bold text-slate-900 mb-2">1. Introduction</h2>
          <p>Welcome to <strong>IGNOU Students Portal</strong>. By purchasing from our website, you agree to the following terms. We provide educational resources like Solved Assignments, Notes, and Guess Papers to help students.</p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-slate-900 mb-2">2. Digital Products & Refunds</h2>
          <p>Since most of our products are <strong>Digital Files (PDFs)</strong> which are downloadable instantly, <strong>we strictly do not offer refunds</strong> once the file has been downloaded or emailed. Please check the subject code and medium (Hindi/English) carefully before buying.</p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-slate-900 mb-2">3. Hardcopy Delivery</h2>
          <p>For Handwritten Hardcopy orders, delivery usually takes <strong>7-10 working days</strong> via Speed Post. Delays due to courier services are beyond our control, though we will assist in tracking.</p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-slate-900 mb-2">4. Usage Rights</h2>
          <p>The study material provided is for <strong>personal reference and educational use only</strong>. Reselling, distributing, or publishing our PDF files on other websites/groups is strictly prohibited and legal action may be taken.</p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-slate-900 mb-2">5. Contact Us</h2>
          <p>If you have any issues with your order, please contact us via WhatsApp or Email mentioned on the Contact page.</p>
        </section>
      </div>
    `.trim(),
  },

  "refund-policy": {
    title: "Refund & Cancellation Policy",
    subtitle: "Last Updated: January 2026",
    contentHtml: `
      <div class="space-y-8 text-slate-700 leading-relaxed">
        <section class="bg-blue-50 p-6 rounded-xl border border-blue-100">
          <h2 class="text-xl font-bold text-blue-900 mb-3">1. Digital Products (PDFs)</h2>
          <p class="mb-3">Since our primary products are digital files (Solved Assignments, Notes, Guess Papers) that are downloadable instantly after payment, <strong>we strictly do not offer refunds</strong> once the file has been downloaded or emailed to you.</p>
          <p class="font-bold text-blue-800 text-sm">Exceptions for Refund:</p>
          <ul class="list-disc ml-5 mt-2 space-y-1 text-sm">
            <li>If you received the wrong subject code (e.g., ordered MHD-01 but got MHD-02).</li>
            <li>If the file is corrupt or blank.</li>
            <li>If the medium (English/Hindi) is different from what you ordered.</li>
          </ul>
          <p class="mt-3 text-sm text-slate-600">In such cases, please contact us within 24 hours via WhatsApp or Email, and we will send the correct file immediately or issue a full refund.</p>
        </section>

        <section class="bg-orange-50 p-6 rounded-xl border border-orange-100">
          <h2 class="text-xl font-bold text-orange-900 mb-3">2. Physical Products (Hardcopies)</h2>
          <p class="mb-3">For handwritten assignments or notes delivered via courier:</p>
          <ul class="list-disc ml-5 mt-2 space-y-1 text-sm">
            <li><strong>Cancellation:</strong> You can cancel your order within 24 hours of placing it, provided it has not been shipped yet. Once shipped, orders cannot be cancelled.</li>
            <li><strong>Return/Replacement:</strong> We do not accept returns. However, if you receive a damaged product or missing pages, we will send a replacement free of cost. Please record an unboxing video as proof.</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-bold text-slate-900 mb-3">3. Refund Processing Time</h2>
          <p>If your refund request is approved, the amount will be processed within <strong>5-7 working days</strong> and credited back to your original payment method (Bank Account, UPI, or Card) via Razorpay.</p>
        </section>

        <section class="pt-6 border-t border-gray-100">
          <h2 class="text-xl font-bold text-slate-900 mb-3">4. Contact Us</h2>
          <p>If you have any questions about our Refunds Policy, please contact us:</p>
          <ul class="list-none mt-2 space-y-1 font-medium text-blue-600">
            <li>• WhatsApp: 7496865680</li>
            <li>• Email: support@ignouportal.com</li>
          </ul>
        </section>
      </div>
    `.trim(),
  },
};

async function ensureDefaults() {
  const keys = Object.keys(DEFAULTS);
  for (const key of keys) {
    const d = DEFAULTS[key];
    await PolicyPage.updateOne(
      { key },
      {
        $setOnInsert: {
          key,
          title: d.title,
          subtitle: d.subtitle,
          contentHtml: d.contentHtml,
          isEnabled: false, // ✅ start disabled
        },
      },
      { upsert: true }
    );
  }
}

// ✅ GET list (admin)
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(); // ✅ IMPORTANT: no args (fixes “Expected 0 arguments…”)
    await dbConnect();
    await ensureDefaults();

    const rows = await PolicyPage.find({})
      .sort({ key: 1 })
      .lean();

    return NextResponse.json(rows || []);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

// ✅ POST create (optional) - mostly not needed because we auto-seed defaults,
// but keeping for future custom pages
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const key = safeStr(body?.key);
    if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

    const title = safeStr(body?.title) || key;
    const subtitle = safeStr(body?.subtitle || "");
    const contentHtml = String(body?.contentHtml || "");
    const isEnabled = !!body?.isEnabled;

    const saved = await PolicyPage.findOneAndUpdate(
      { key },
      { key, title, subtitle, contentHtml, isEnabled },
      { upsert: true, new: true }
    ).lean();

    return NextResponse.json(saved);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
