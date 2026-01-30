import type { Metadata } from "next";
import { Outfit } from "next/font/google"; 
import "./globals.css";

// 👇 1. CartProvider ko import kiya (Path dhyan se dekhein: '../context/...')
import { CartProvider } from "../context/CartContext"; 

// Font ki settings
const outfit = Outfit({ 
  subsets: ["latin"],
  display: 'swap',
});

// SEO Settings
export const metadata: Metadata = {
  title: {
    default: "IGNOU Students Portal - Solved Assignments & Notes",
    template: "%s | IGNOU Students Portal"
  },
  description: "Get IGNOU Solved Assignments, Handwritten Assignments, Guess Papers, and Previous Year Questions. Best quality study material with instant download.",
  keywords: ["IGNOU", "Solved Assignments", "Handwritten", "Guess Paper", "IGNOU Help Books"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={outfit.className}>
        {/* 👇 2. Yahan puri app ko CartProvider se wrap kar diya */}
        <CartProvider>
           {children}
        </CartProvider>
      </body>
    </html>
  );
}