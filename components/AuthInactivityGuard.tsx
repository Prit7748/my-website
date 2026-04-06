"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function AuthInactivityGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const startEvent = new CustomEvent("admin-long-task-start");
    const endEvent = new CustomEvent("admin-long-task-end");

    window.dispatchEvent(startEvent);

    return () => {
      window.dispatchEvent(endEvent);
    };
  }, [pathname]);

  return null;
}