"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "../context/CartContext";

const CHECKOUT_FINGERPRINT_KEY = "isp_begin_checkout_fingerprint_v1";

export default function AnalyticsProvider() {
  const pathname = usePathname();
  const { cart, cartReady } = useCart();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (typeof window === "undefined") return;

      try {
        const analytics = await import("../lib/analytics");
        if (cancelled) return;

        analytics.captureAttributionFromBrowser?.();

        const search = window.location.search || "";
        const routeWithQuery = `${pathname || ""}${search}`;

        analytics.trackPageView?.({
          page_path: routeWithQuery,
          page_location: window.location.href,
          page_title: document.title || "IGNOU Students Portal",
        });
      } catch {
        // fail silently so analytics never breaks rendering/build
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (typeof window === "undefined") return;
      if (!cartReady) return;
      if (pathname !== "/checkout") return;
      if (!Array.isArray(cart) || cart.length === 0) return;

      try {
        const analytics = await import("../lib/analytics");
        if (cancelled) return;

        const fingerprint = analytics.buildCheckoutFingerprint?.(cart);
        if (!fingerprint) return;

        const prev = sessionStorage.getItem(CHECKOUT_FINGERPRINT_KEY);
        if (prev === fingerprint) return;

        sessionStorage.setItem(CHECKOUT_FINGERPRINT_KEY, fingerprint);
        analytics.trackBeginCheckoutFromCart?.(cart);
      } catch {
        // fail silently so analytics never breaks rendering/build
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [pathname, cart, cartReady]);

  return null;
}