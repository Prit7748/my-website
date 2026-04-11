"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

declare global {
  interface Window {
    __ispNavigationProgressCleanup?: () => void;
  }
}

type ProgressPhase = "idle" | "running" | "finishing";

const START_EVENT = "isp:navigation-start";
const DONE_EVENT = "isp:navigation-done";

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function isModifiedClick(event: MouseEvent) {
  return !!(
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  );
}

function isSkippableProtocol(href: string) {
  const lower = href.toLowerCase();
  return (
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:") ||
    lower.startsWith("javascript:") ||
    lower.startsWith("sms:")
  );
}

function normalizeComparableUrl(input: string) {
  if (typeof window === "undefined") return input;

  try {
    const url = new URL(input, window.location.origin);
    return `${url.pathname}${url.search}`;
  } catch {
    return input;
  }
}

function getCurrentComparableUrl() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}

export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const routeKey = useMemo(() => {
    const query = searchParams?.toString() || "";
    return `${pathname || ""}${query ? `?${query}` : ""}`;
  }, [pathname, searchParams]);

  const [phase, setPhase] = useState<ProgressPhase>("idle");
  const [progress, setProgress] = useState(0);

  const progressTimerRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  const isActiveRef = useRef(false);
  const pendingTargetRef = useRef("");

  const clearTimers = () => {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    if (finishTimerRef.current) {
      window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
  };

  const finishProgress = () => {
    if (!isActiveRef.current && phase === "idle") return;

    clearTimers();
    isActiveRef.current = false;
    pendingTargetRef.current = "";

    setPhase("finishing");
    setProgress(100);

    finishTimerRef.current = window.setTimeout(() => {
      setPhase("idle");
      setProgress(0);
    }, 240);
  };

  const startProgress = (href?: string) => {
    const target = safeStr(href);
    const current = getCurrentComparableUrl();
    const next = target ? normalizeComparableUrl(target) : "";

    if (next && next === current) {
      return;
    }

    clearTimers();

    isActiveRef.current = true;
    pendingTargetRef.current = next;
    setPhase("running");
    setProgress((prev) => (prev > 0 && prev < 85 ? prev : 10));

    progressTimerRef.current = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        if (prev < 28) return prev + 12;
        if (prev < 55) return prev + 7;
        if (prev < 75) return prev + 3;
        return prev + 1;
      });
    }, 140);
  };

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

  useEffect(() => {
    if (!isActiveRef.current) return;

    const current = normalizeComparableUrl(routeKey || "/");
    const pending = safeStr(pendingTargetRef.current);

    if (!pending || current === pending || current !== getCurrentComparableUrl()) {
      finishProgress();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  useEffect(() => {
    const onStart = (event: Event) => {
      const custom = event as CustomEvent<{ href?: string }>;
      startProgress(custom?.detail?.href);
    };

    const onDone = () => {
      finishProgress();
    };

    const onDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || isModifiedClick(event)) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;

      if (!anchor) return;

      const rawHref = safeStr(anchor.getAttribute("href"));
      if (!rawHref) return;
      if (isSkippableProtocol(rawHref)) return;
      if (anchor.hasAttribute("download")) return;

      const targetAttr = safeStr(anchor.getAttribute("target"));
      if (targetAttr && targetAttr !== "_self") return;

      let url: URL;
      try {
        url = new URL(rawHref, window.location.origin);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;

      const currentPath = `${window.location.pathname}${window.location.search}`;
      const nextPath = `${url.pathname}${url.search}`;

      if (nextPath === currentPath) return;

      startProgress(nextPath);
    };

    window.addEventListener(START_EVENT, onStart as EventListener);
    window.addEventListener(DONE_EVENT, onDone);
    document.addEventListener("click", onDocumentClick, true);

    window.__ispNavigationProgressCleanup = () => {
      window.removeEventListener(START_EVENT, onStart as EventListener);
      window.removeEventListener(DONE_EVENT, onDone);
      document.removeEventListener("click", onDocumentClick, true);
    };

    return () => {
      window.removeEventListener(START_EVENT, onStart as EventListener);
      window.removeEventListener(DONE_EVENT, onDone);
      document.removeEventListener("click", onDocumentClick, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = phase !== "idle";

  return (
    <>
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[3px] transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="absolute inset-0 bg-transparent" />
        <div
          className={`h-full rounded-r-full bg-gradient-to-r from-cyan-400 via-blue-600 to-indigo-600 shadow-[0_0_10px_rgba(37,99,235,0.45)] transition-[width,opacity] duration-200 ${
            phase === "finishing" ? "opacity-95" : "opacity-100"
          }`}
          style={{
            width: `${Math.max(0, Math.min(100, progress))}%`,
          }}
        />
      </div>

      <style jsx>{`
        @media (prefers-reduced-motion: reduce) {
          div {
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </>
  );
}