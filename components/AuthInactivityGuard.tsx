"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

type MeUser = {
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
};

const ADMIN_IDLE_MS = 20 * 60 * 1000;

function safeStr(x: any) {
  return String(x ?? "").trim().toLowerCase();
}

function isPrivilegedRole(role: string) {
  const r = safeStr(role);
  return r === "admin" || r === "co_admin" || r === "master_admin";
}

export default function AuthInactivityGuard() {
  const router = useRouter();
  const pathname = usePathname();

  const enabledRef = useRef(false);
  const pausedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResetRef = useRef(0);

  useEffect(() => {
    let mounted = true;

    const clearExistingTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const logoutNow = async () => {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
        });
      } catch {}

      clearExistingTimer();
      enabledRef.current = false;
      pausedRef.current = false;
      router.replace("/login?reason=session-expired");
      router.refresh();
    };

    const resetTimer = () => {
      if (!enabledRef.current) return;
      if (pausedRef.current) return;

      const now = Date.now();
      if (now - lastResetRef.current < 1000) return;
      lastResetRef.current = now;

      clearExistingTimer();
      timerRef.current = setTimeout(() => {
        logoutNow();
      }, ADMIN_IDLE_MS);
    };

    const activityHandler = () => {
      resetTimer();
    };

    const visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        resetTimer();
      }
    };

    const longTaskStartHandler = () => {
      if (!enabledRef.current) return;
      pausedRef.current = true;
      clearExistingTimer();
    };

    const longTaskEndHandler = () => {
      if (!enabledRef.current) return;
      pausedRef.current = false;
      resetTimer();
    };

    async function init() {
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!mounted || !res.ok) {
          enabledRef.current = false;
          pausedRef.current = false;
          clearExistingTimer();
          return;
        }

        const data = await res.json();
        const user: MeUser = data?.user || {};
        const role = safeStr(user?.role);

        if (!isPrivilegedRole(role)) {
          enabledRef.current = false;
          pausedRef.current = false;
          clearExistingTimer();
          return;
        }

        enabledRef.current = true;
        pausedRef.current = false;
        resetTimer();

        window.addEventListener("mousemove", activityHandler);
        window.addEventListener("mousedown", activityHandler);
        window.addEventListener("keydown", activityHandler);
        window.addEventListener("scroll", activityHandler, true);
        window.addEventListener("touchstart", activityHandler, true);
        window.addEventListener("click", activityHandler, true);
        window.addEventListener("focus", activityHandler);
        document.addEventListener("visibilitychange", visibilityHandler);

        window.addEventListener("admin-long-task-start", longTaskStartHandler as EventListener);
        window.addEventListener("admin-long-task-end", longTaskEndHandler as EventListener);
      } catch {
        enabledRef.current = false;
        pausedRef.current = false;
        clearExistingTimer();
      }
    }

    init();

    return () => {
      mounted = false;
      clearExistingTimer();

      window.removeEventListener("mousemove", activityHandler);
      window.removeEventListener("mousedown", activityHandler);
      window.removeEventListener("keydown", activityHandler);
      window.removeEventListener("scroll", activityHandler, true);
      window.removeEventListener("touchstart", activityHandler, true);
      window.removeEventListener("click", activityHandler, true);
      window.removeEventListener("focus", activityHandler);
      document.removeEventListener("visibilitychange", visibilityHandler);

      window.removeEventListener("admin-long-task-start", longTaskStartHandler as EventListener);
      window.removeEventListener("admin-long-task-end", longTaskEndHandler as EventListener);
    };
  }, [router, pathname]);

  return null;
}