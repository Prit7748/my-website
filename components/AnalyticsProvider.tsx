"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "../context/CartContext";
import {
  buildCheckoutFingerprint,
  captureAttributionFromBrowser,
  trackBeginCheckoutFromCart,
  trackPageView,
} from "../lib/analytics";

const CHECKOUT_FINGERPRINT_KEY = "isp_begin_checkout_fingerprint_v1";

export default function AnalyticsProvider() {
  const pathname = usePathname();
  const { cart, cartReady } = useCart();

  useEffect(() => {
    if (typeof window === "undefined") return;

    captureAttributionFromBrowser();

    const search = window.location.search || "";
    const routeWithQuery = `${pathname || ""}${search}`;

    trackPageView({
      page_path: routeWithQuery,
      page_location: window.location.href,
      page_title: document.title || "IGNOU Students Portal",
    });
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!cartReady) return;
    if (pathname !== "/checkout") return;
    if (!Array.isArray(cart) || cart.length === 0) return;

    const fingerprint = buildCheckoutFingerprint(cart);
    const prev = sessionStorage.getItem(CHECKOUT_FINGERPRINT_KEY);
    if (prev === fingerprint) return;

    sessionStorage.setItem(CHECKOUT_FINGERPRINT_KEY, fingerprint);
    trackBeginCheckoutFromCart(cart);
  }, [pathname, cart, cartReady]);

  return null;
}