// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import Script from "next/script";
import { Outfit } from "next/font/google";

import "./globals.css";
import { CartProvider } from "../context/CartContext";
import AnalyticsProvider from "../components/AnalyticsProvider";

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-outfit",
});

function safeStr(x: unknown) {
  return String(x ?? "").trim();
}

function normalizeBaseUrl(input?: string) {
  const raw = safeStr(input) || "https://istudentsportal.com";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, "");
}

const BASE_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://istudentsportal.com"
);

const METADATA_BASE = new URL(BASE_URL);
const GA_ID = safeStr(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1E40AF",
};

export const metadata: Metadata = {
  metadataBase: METADATA_BASE,
  applicationName: "IGNOU Students Portal",
  title: {
    default: "IGNOU Students Portal - Solved Assignments, Notes, PYQ & Study Material",
    template: "%s | IGNOU Students Portal",
  },
  description:
    "Get IGNOU solved assignments, handwritten assignments, guess papers, previous year question papers, notes, projects and study material with instant access and trusted support.",
  keywords: [
    "IGNOU",
    "IGNOU solved assignments",
    "IGNOU handwritten assignments",
    "IGNOU guess papers",
    "IGNOU previous year question papers",
    "IGNOU notes",
    "IGNOU projects",
    "IGNOU study material",
  ],
  alternates: {
    canonical: "/",
  },
  referrer: "origin-when-cross-origin",
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: BASE_URL,
    siteName: "IGNOU Students Portal",
    title: "IGNOU Students Portal - Solved Assignments, Notes, PYQ & Study Material",
    description:
      "Get IGNOU solved assignments, handwritten assignments, guess papers, previous year question papers, notes, projects and study material with instant access and trusted support.",
    locale: "en_IN",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "IGNOU Students Portal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "IGNOU Students Portal - Solved Assignments, Notes, PYQ & Study Material",
    description:
      "Solved assignments, handwritten notes, guess papers, previous year question papers, projects and study material for IGNOU students.",
    images: ["/og.jpg"],
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  category: "education",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={outfit.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        {GA_ID ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){window.dataLayer.push(arguments);}
                window.gtag = window.gtag || gtag;
                gtag('js', new Date());
                gtag('config', '${GA_ID}', {
                  send_page_view: false,
                  anonymize_ip: true
                });
              `}
            </Script>
          </>
        ) : null}

        <CartProvider>
          <Suspense fallback={null}>
            <AnalyticsProvider />
          </Suspense>
          {children}
        </CartProvider>
      </body>
    </html>
  );
}