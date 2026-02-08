import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { CartProvider } from "../context/CartContext";

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-outfit",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1E40AF",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://ignoustudentsportal.com"),
  title: {
    default: "IGNOU Students Portal - Solved Assignments & Notes",
    template: "%s | IGNOU Students Portal",
  },
  description:
    "Get IGNOU Solved Assignments, Handwritten Assignments, Guess Papers, and Previous Year Questions. Best quality study material with instant download.",
  keywords: ["IGNOU", "Solved Assignments", "Handwritten", "Guess Paper", "IGNOU Help Books"],
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    url: "https://ignoustudentsportal.com",
    siteName: "IGNOU Students Portal",
    title: "IGNOU Students Portal - Solved Assignments & Notes",
    description:
      "Get IGNOU Solved Assignments, Handwritten Assignments, Guess Papers, and Previous Year Questions. Instant download & premium quality.",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "IGNOU Students Portal" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "IGNOU Students Portal - Solved Assignments & Notes",
    description:
      "Solved assignments, handwritten notes, guess papers & previous year questions with instant download.",
    images: ["/og.jpg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={outfit.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
