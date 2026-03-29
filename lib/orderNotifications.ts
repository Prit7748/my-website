import nodemailer from "nodemailer";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import User from "@/models/User";
import Product from "@/models/Product";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function money(n: number) {
  try {
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(n || 0));
  } catch {
    return String(n || 0);
  }
}

const SITE_NAME = safeStr(process.env.NEXT_PUBLIC_SITE_NAME || "Website");
const APP_BASE_URL = safeStr(
  process.env.APP_BASE_URL || "http://localhost:3000"
).replace(/\/+$/, "");

const SMTP_HOST = safeStr(process.env.SMTP_HOST);
const SMTP_PORT = safeNum(process.env.SMTP_PORT, 587);
const SMTP_USER = safeStr(process.env.SMTP_USER);
const SMTP_PASS = safeStr(process.env.SMTP_PASS);
const SMTP_FROM_NAME = safeStr(process.env.SMTP_FROM_NAME || SITE_NAME);
const SMTP_FROM_EMAIL = safeStr(process.env.SMTP_FROM_EMAIL || SMTP_USER);

const PUSHOVER_APP_TOKEN = safeStr(process.env.PUSHOVER_APP_TOKEN);
const PUSHOVER_USER_KEY = safeStr(process.env.PUSHOVER_USER_KEY);

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM_EMAIL) {
    throw new Error("SMTP env missing");
  }

  cachedTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  return cachedTransporter;
}

export async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const to = safeStr(args.to);
  if (!to) return { ok: false, reason: "Missing recipient" };

  const transporter = getTransporter();

  const info = await transporter.sendMail({
    from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
    to,
    subject: safeStr(args.subject),
    html: safeStr(args.html),
    text: safeStr(args.text),
  });

  return { ok: true, messageId: info.messageId };
}

export async function sendPushover(args: {
  title: string;
  message: string;
  url?: string;
  url_title?: string;
  priority?: number;
}) {
  if (!PUSHOVER_APP_TOKEN || !PUSHOVER_USER_KEY) {
    return { ok: false, reason: "Pushover env missing" };
  }

  const body = new URLSearchParams();
  body.set("token", PUSHOVER_APP_TOKEN);
  body.set("user", PUSHOVER_USER_KEY);
  body.set("title", safeStr(args.title).slice(0, 250));
  body.set("message", safeStr(args.message).slice(0, 1024));
  body.set(
    "priority",
    String(Number.isFinite(Number(args.priority)) ? Number(args.priority) : 0)
  );

  if (safeStr(args.url)) body.set("url", safeStr(args.url));
  if (safeStr(args.url_title)) body.set("url_title", safeStr(args.url_title));

  const res = await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      reason: safeStr((data as any)?.errors?.join(", ") || "Pushover failed"),
    };
  }

  return { ok: true };
}

function buildDashboardUrl() {
  return `${APP_BASE_URL}/dashboard`;
}

function buildOrdersUrl() {
  return `${APP_BASE_URL}/orders`;
}

function buildAdminOrdersUrl() {
  return `${APP_BASE_URL}/admin/orders`;
}

function buildSupportUrl() {
  return `${APP_BASE_URL}/contact`;
}

function normalizeAvailability(input: any) {
  const v = safeStr(input).toLowerCase();

  if (v === "available" || v === "in_stock" || v === "instock") return "available";

  if (
    v === "on_demand" ||
    v === "ondemand" ||
    v === "on-demand" ||
    v === "coming_soon" ||
    v === "comingsoon" ||
    v === "coming-soon"
  ) {
    return "on_demand";
  }

  if (
    v === "want_to_buy" ||
    v === "wanttobuy" ||
    v === "want-to-buy" ||
    v === "out_of_stock" ||
    v === "outofstock" ||
    v === "out-of-stock"
  ) {
    return "want_to_buy";
  }

  return "available";
}

function isPhysicalOrderItem(item: any) {
  const category = safeStr(item?.category).toLowerCase();
  const comboCategorySlug = safeStr(item?.comboCategorySlug).toLowerCase();
  const title = safeStr(item?.title).toLowerCase();

  return (
    category.includes("handwritten hardcopy") ||
    category.includes("hardcopy") ||
    comboCategorySlug.includes("handwritten-hardcopy") ||
    title.includes("hardcopy") ||
    title.includes("delivery")
  );
}

function getPhysicalOrderItems(order: any) {
  return Array.isArray(order?.items)
    ? order.items.filter((item: any) => isPhysicalOrderItem(item))
    : [];
}

function buildShippingAddress(order: any) {
  const shipping =
    order?.shipping && typeof order.shipping === "object" ? order.shipping : {};

  const parts = [
    safeStr(shipping?.fullName),
    safeStr(shipping?.addressLine1 || shipping?.address),
    safeStr(shipping?.addressLine2),
    safeStr(shipping?.areaLocality || shipping?.area),
    safeStr(shipping?.landmark),
    safeStr(shipping?.city || shipping?.district),
    safeStr(shipping?.state),
    safeStr(shipping?.pincode),
    safeStr(shipping?.country || "India"),
  ].filter(Boolean);

  return parts.join(", ");
}

function getCustomerPhone(order: any, user: any) {
  const customer =
    order?.customer && typeof order.customer === "object" ? order.customer : {};
  const shipping =
    order?.shipping && typeof order.shipping === "object" ? order.shipping : {};

  return (
    safeStr(customer?.phone) ||
    safeStr(shipping?.phone) ||
    safeStr(user?.phone) ||
    ""
  );
}

export async function sendHardcopyPaidAdminPushover(orderId: string) {
  await dbConnect();

  const order: any = await Order.findById(orderId).lean();
  if (!order) return { ok: false, reason: "Order not found" };

  const physicalItems = getPhysicalOrderItems(order);
  if (!physicalItems.length) {
    return { ok: true, skipped: true, reason: "no_physical_items" };
  }

  const user: any = order?.userId ? await User.findById(order.userId).lean() : null;

  const customer =
    order?.customer && typeof order.customer === "object" ? order.customer : {};

  const customerName = safeStr(customer?.fullName || user?.name || "Customer");
  const customerEmail = safeStr(customer?.email || order?.userEmail || user?.email || "");
  const customerPhone = getCustomerPhone(order, user);
  const orderRef = safeStr(order?.orderRef || order?._id || "");
  const totalAmount = safeNum(order?.totalAmount || order?.payableAmount || 0, 0);

  const productLines = physicalItems
    .map((item: any) => {
      const qty = Math.max(1, safeNum(item?.quantity, 1));
      return `• ${safeStr(item?.title || "Hardcopy Item")} x${qty}`;
    })
    .join("\n");

  const addressLine = buildShippingAddress(order);

  const msg =
    `New Hardcopy Paid Order!\n\n` +
    `Order ID: ${orderRef}\n` +
    `Customer: ${customerName}\n` +
    `Email: ${customerEmail || "-"}\n` +
    `Phone: ${customerPhone || "-"}\n` +
    `Amount: ₹${money(totalAmount)}\n` +
    `Website: ${SITE_NAME}\n` +
    `Hardcopy Items: ${physicalItems.length}\n\n` +
    `Items:\n${productLines}\n\n` +
    `Shipping Address:\n${addressLine || "-"}`;

  return sendPushover({
    title: `Hardcopy Paid ${orderRef ? `#${orderRef}` : ""}`.trim(),
    message: msg,
    url: buildAdminOrdersUrl(),
    url_title: "Open Admin Orders",
    priority: 1,
  });
}

export async function sendOnDemandAdminPushover(orderId: string) {
  await dbConnect();

  const order: any = await Order.findById(orderId).lean();
  if (!order) return { ok: false, reason: "Order not found" };

  const user: any = await User.findById(order.userId).lean();

  const items = Array.isArray(order.items) ? order.items : [];
  const productIds = items.map((x: any) => x?.productId).filter(Boolean);

  const products: any[] = productIds.length
    ? await Product.find({ _id: { $in: productIds } })
        .select("title availability deliverWithinMinutes onDemandNote")
        .lean()
    : [];

  const byId = new Map<string, any>();
  for (const p of products) byId.set(String(p._id), p);

  const onDemandItems: Array<{
    title: string;
    minutes: number;
  }> = [];

  for (const item of items) {
    const p = byId.get(String(item?.productId || ""));
    const av = normalizeAvailability(p?.availability);
    if (av === "on_demand") {
      onDemandItems.push({
        title: safeStr(item?.title || p?.title || "Product"),
        minutes: Math.max(1, safeNum(p?.deliverWithinMinutes, 20)),
      });
    }
  }

  if (!onDemandItems.length) {
    return { ok: true, skipped: true };
  }

  const customerName = safeStr(user?.name || "Customer");
  const customerEmail = safeStr(user?.email || order?.userEmail || "");
  const customerPhone = safeStr(user?.phone || "");
  const orderRef = safeStr(order?.orderRef || order?._id || "");
  const totalProducts = items.length;
  const totalAmount = safeNum(order?.totalAmount, 0);

  const productLines = onDemandItems.map((item) => `• ${item.title}`).join("\n");

  const maxMinutes =
    onDemandItems.reduce((mx, item) => Math.max(mx, item.minutes), 0) || 20;

  const msg =
    `New order with On Demand products!\n\n` +
    `Order ID: ${orderRef}\n` +
    `Customer: ${customerName}\n` +
    `Email: ${customerEmail || "-"}\n` +
    `Phone: ${customerPhone || "-"}\n` +
    `Total: ₹${money(totalAmount)}\n` +
    `Website: ${SITE_NAME}\n` +
    `Total Products: ${totalProducts}\n\n` +
    `On Demand Products:\n${productLines}\n\n` +
    `Availability: ${maxMinutes} minutes`;

  return sendPushover({
    title: `On Demand Order ${orderRef ? `#${orderRef}` : ""}`.trim(),
    message: msg,
    url: buildAdminOrdersUrl(),
    url_title: "Open Admin Orders",
    priority: 1,
  });
}

export async function sendOnDemandReadyEmail(args: {
  orderId: string;
  userId: string;
  productId: string;
}) {
  await dbConnect();

  const user: any = await User.findById(args.userId).lean();
  if (!user) return { ok: false, reason: "User not found" };

  const order: any = await Order.findById(args.orderId).lean();
  if (!order) return { ok: false, reason: "Order not found" };

  const item = (Array.isArray(order.items) ? order.items : []).find(
    (x: any) => String(x?.productId || "") === String(args.productId || "")
  );

  if (!item) return { ok: false, reason: "Order item not found" };

  const customerName = safeStr(user?.name || "Student");
  const email = safeStr(user?.email || order?.userEmail || "");
  if (!email) return { ok: false, reason: "User email missing" };

  const title = safeStr(item?.title || "Your Product");
  const dashboardUrl = buildDashboardUrl();
  const supportUrl = buildSupportUrl();

  const subject = `Your product is ready to download | ${SITE_NAME}`;

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px;">
      <div style="max-width:700px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden;">
        <div style="background:linear-gradient(90deg,#2563eb,#1d4ed8);padding:22px 24px;">
          <div style="font-size:22px;font-weight:800;color:#ffffff;">${SITE_NAME}</div>
          <div style="font-size:13px;color:#dbeafe;margin-top:6px;">Great news — your requested material is now live</div>
        </div>

        <div style="padding:28px 24px;">
          <p style="margin:0 0 14px 0;font-size:16px;color:#0f172a;">Hello ${customerName},</p>

          <p style="margin:0 0 14px 0;font-size:15px;line-height:1.8;color:#334155;">
            We are happy to let you know that your requested product is now <b>ready for download</b>.
          </p>

          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:16px;padding:16px 18px;margin:18px 0;">
            <div style="font-size:13px;color:#475569;margin-bottom:6px;">Ready Product</div>
            <div style="font-size:17px;font-weight:800;color:#0f172a;line-height:1.6;">${title}</div>
          </div>

          <p style="margin:0 0 14px 0;font-size:15px;line-height:1.8;color:#475569;">
            You can download it now by clicking the button below. Your product is securely linked to your account dashboard.
          </p>

          <div style="margin:26px 0;">
            <a href="${dashboardUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:12px;font-size:14px;font-weight:800;">
              Download My Product
            </a>
          </div>

          <p style="margin:0 0 14px 0;font-size:14px;line-height:1.8;color:#475569;">
            We recommend visiting your dashboard regularly to check your downloads, order updates, and newly available materials.
          </p>

          <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:16px;padding:16px;margin-top:16px;">
            <div style="font-size:14px;font-weight:800;color:#0f172a;margin-bottom:8px;">Need help?</div>
            <div style="font-size:13px;line-height:1.8;color:#475569;">
              If you face any issue while downloading, our support team will be happy to help you quickly.
            </div>
            <div style="margin-top:12px;">
              <a href="${supportUrl}" style="color:#2563eb;text-decoration:none;font-weight:700;">Contact Support</a>
            </div>
          </div>

          <p style="margin:22px 0 0 0;font-size:14px;line-height:1.8;color:#334155;">
            Thank you for choosing <b>${SITE_NAME}</b>. We’re glad to support your study journey.
          </p>
        </div>

        <div style="padding:16px 24px;border-top:1px solid #e5e7eb;background:#f8fafc;font-size:12px;color:#64748b;">
          This is an automated notification from ${SITE_NAME}.
        </div>
      </div>
    </div>
  `;

  const text =
    `Hello ${customerName},\n\n` +
    `Great news! Your requested product is now ready for download.\n\n` +
    `Product:\n${title}\n\n` +
    `Download it from your dashboard:\n${dashboardUrl}\n\n` +
    `Please keep visiting ${SITE_NAME} for your downloads and updates.\n\n` +
    `If you need help, contact us here:\n${supportUrl}\n\n` +
    `Thank you for choosing ${SITE_NAME}.`;

  return sendEmail({
    to: email,
    subject,
    html,
    text,
  });
}