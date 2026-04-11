import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import Script from "next/script";
import { Outfit } from "next/font/google";

import "./globals.css";
import { CartProvider } from "../context/CartContext";
import AnalyticsProvider from "../components/AnalyticsProvider";
import NavigationProgress from "../components/NavigationProgress";

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-outfit",
});

const GA_ID = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "").trim();

function safeStr(x: unknown) {
  return String(x ?? "").trim();
}

function normalizeBaseUrl(input?: string) {
  const raw = safeStr(input) || "https://istudentsportal.com";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const normalized = withProtocol.replace(/\/+$/, "");

  try {
    const url = new URL(normalized);

    if (
      url.hostname === "www.istudentsportal.com" ||
      url.hostname === "istudentsportal.com"
    ) {
      return "https://istudentsportal.com";
    }

    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return normalized;
    }

    return normalized;
  } catch {
    return "https://istudentsportal.com";
  }
}

const BASE_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL
);

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1E40AF",
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  applicationName: "IGNOU Students Portal",
  title: {
    default: "IGNOU Students Portal - Solved Assignments & Notes",
    template: "%s | IGNOU Students Portal",
  },
  description:
    "Get IGNOU solved assignments, handwritten assignments, guess papers, question papers, projects, and notes with fast access and premium quality.",
  keywords: [
    "IGNOU",
    "IGNOU solved assignments",
    "IGNOU handwritten assignments",
    "IGNOU guess papers",
    "IGNOU question papers",
    "IGNOU notes",
    "IGNOU projects",
    "IGNOU study material",
  ],
  alternates: {
    canonical: "/",
  },
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
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    type: "website",
    url: BASE_URL,
    siteName: "IGNOU Students Portal",
    title: "IGNOU Students Portal - Solved Assignments & Notes",
    description:
      "Get IGNOU solved assignments, handwritten assignments, guess papers, question papers, projects, and notes with fast access and premium quality.",
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
    title: "IGNOU Students Portal - Solved Assignments & Notes",
    description:
      "Solved assignments, handwritten notes, guess papers, question papers, projects and study material for IGNOU students.",
    images: ["/og.jpg"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

          <Suspense fallback={null}>
            <NavigationProgress />
          </Suspense>

          {children}
        </CartProvider>
      </body>
    </html>
  );
}