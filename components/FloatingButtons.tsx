"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUp, MessageCircle, X, ChevronLeft, Send } from "lucide-react";

type FlowNode = { text: string; options: { label: string; nextId: string }[] };
type FlowMap = Record<string, FlowNode>;

type ChatBotConfig = {
  isEnabled: boolean;
  provider: "whatsapp" | "tawk" | "crisp" | "custom";
  showOnMobile: boolean;
  showOnDesktop: boolean;
  position: "right" | "left";
  whatsappNumber: string;
  whatsappMessage: string;
  themeColor: string;
};

type SocialItem = {
  _id: string;
  name: string;
  url: string;
  icon?: string;
  isActive: boolean;
  sortOrder: number;
};

const NAV_START_EVENT = "isp:navigation-start";

const PRODUCT_DETAIL_CATEGORY_PREFIXES = new Set([
  "products",
  "solved-assignments",
  "question-papers",
  "guess-papers",
  "ebooks",
  "projects",
  "handwritten-pdfs",
  "handwritten-hardcopy",
]);

const DEFAULT_FLOW: FlowMap = {
  root: {
    text: "Hi! I am Navi 🤖. How can I help you today?",
    options: [
      { label: "IGNOU Assignments", nextId: "assignments" },
      { label: "Exam Updates", nextId: "exams" },
      { label: "Download Papers", nextId: "papers" },
      { label: "Contact Support", nextId: "contact" },
    ],
  },
  assignments: {
    text: "Please select your course type for Assignments:",
    options: [
      { label: "Master's Degree (MA/M.Com)", nextId: "masters" },
      { label: "Bachelor's Degree (BA/B.Com)", nextId: "bachelors" },
      { label: "Diploma / Certificate", nextId: "diploma" },
    ],
  },
  masters: {
    text: "Great! Which specific subject do you need?",
    options: [
      { label: "M.Com (Commerce)", nextId: "final_msg" },
      { label: "MA English (MEG)", nextId: "final_msg" },
      { label: "MA Hindi (MHD)", nextId: "final_msg" },
      { label: "MA History (MAH)", nextId: "final_msg" },
    ],
  },
  exams: {
    text: "What information do you need regarding Exams?",
    options: [
      { label: "Date Sheet Dec 2025", nextId: "final_msg" },
      { label: "Hall Ticket Download", nextId: "final_msg" },
      { label: "Result Updates", nextId: "final_msg" },
    ],
  },
  papers: {
    text: "Which papers do you want to download?",
    options: [
      { label: "Previous Year Question Papers (PYQ)", nextId: "open:/question-papers" },
      { label: "Guess Papers", nextId: "open:/guess-papers" },
      { label: "Back to Main Menu", nextId: "root" },
    ],
  },
  contact: {
    text: "You can contact us on WhatsApp for quick support.",
    options: [
      { label: "Open WhatsApp Chat", nextId: "whatsapp_action" },
      { label: "Open Contact Page", nextId: "open:/contact" },
      { label: "Back to Main Menu", nextId: "root" },
    ],
  },
  final_msg: {
    text: "Thank you! Please visit our 'Shop' section or WhatsApp us for this specific requirement. Should I connect you to WhatsApp?",
    options: [
      { label: "Yes, Open WhatsApp", nextId: "whatsapp_action" },
      { label: "Browse Products", nextId: "open:/products" },
      { label: "Go to Main Menu", nextId: "root" },
    ],
  },
};

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function cleanNumber(x: string) {
  return String(x || "").replace(/[^\d]/g, "");
}

function dispatchNavigationStart(href?: string) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(NAV_START_EVENT, {
      detail: {
        href: safeStr(href) || undefined,
      },
    })
  );
}

function isMobileProductDetailPath(pathname: string) {
  const cleanPath = safeStr(pathname).split("?")[0].split("#")[0];
  const segments = cleanPath.split("/").filter(Boolean);

  if (!segments.length) return false;

  if (segments[0] === "combo" && segments.length === 3) {
    return true;
  }

  if (segments.length !== 2) {
    return false;
  }

  return PRODUCT_DETAIL_CATEGORY_PREFIXES.has(segments[0]);
}

async function fetchChatBotConfig(): Promise<ChatBotConfig | null> {
  try {
    const res = await fetch("/api/site-settings/chatbot", { cache: "no-store" });
    if (!res.ok) return null;

    const data = await res.json();
    return {
      isEnabled: !!data.isEnabled,
      provider: (data.provider || "whatsapp") as ChatBotConfig["provider"],
      showOnMobile: data.showOnMobile !== false,
      showOnDesktop: data.showOnDesktop !== false,
      position: (data.position === "left" ? "left" : "right") as "left" | "right",
      whatsappNumber: String(
        data.whatsappNumber || ""
      ),
      whatsappMessage: String(
        data.whatsappMessage || "Hi! I need help regarding IGNOU materials."
      ),
      themeColor: String(data.themeColor || "#3B82F6"),
    };
  } catch {
    return null;
  }
}

async function fetchChatFlow(): Promise<FlowMap | null> {
  try {
    const res = await fetch("/api/site-settings/chatbot-flow", {
      cache: "no-store",
    });
    if (!res.ok) return null;

    const data = await res.json();
    const nodes = data?.nodes;
    if (!nodes || typeof nodes !== "object") return null;

    return nodes as FlowMap;
  } catch {
    return null;
  }
}

async function fetchSocialLinks(): Promise<SocialItem[]> {
  try {
    const res = await fetch("/api/site-settings/social-links", {
      cache: "no-store",
    });
    const data = await res.json();

    if (!data?.ok) return [];
    const items = Array.isArray(data.items) ? data.items : [];
    return items.filter((x: any) => x && x.isActive);
  } catch {
    return [];
  }
}

export default function FloatingButtons() {
  const router = useRouter();
  const pathname = usePathname();

  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showScroll, setShowScroll] = useState(false);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState("root");
  const [history, setHistory] = useState<string[]>([]);

  const [cfg, setCfg] = useState<ChatBotConfig | null>(null);
  const [flow, setFlow] = useState<FlowMap>(DEFAULT_FLOW);
  const [socials, setSocials] = useState<SocialItem[]>([]);

  useEffect(() => {
    setMounted(true);

    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(!!mq.matches);

    update();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
    } else {
      mq.addListener(update);
    }

    return () => {
      if (typeof mq.removeEventListener === "function") {
        mq.removeEventListener("change", update);
      } else {
        mq.removeListener(update);
      }
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const checkScroll = () => setShowScroll(window.scrollY > 300);
    window.addEventListener("scroll", checkScroll);
    checkScroll();

    return () => window.removeEventListener("scroll", checkScroll);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;

    let alive = true;

    (async () => {
      const [c, f, s] = await Promise.all([
        fetchChatBotConfig(),
        fetchChatFlow(),
        fetchSocialLinks(),
      ]);

      if (!alive) return;

      setCfg(c);
      if (f && Object.keys(f).length) setFlow(f);
      setSocials(s);
    })();

    return () => {
      alive = false;
    };
  }, [mounted]);

  useEffect(() => {
    setIsChatOpen(false);
  }, [pathname]);

  const allowChatBot = useMemo(() => {
    if (!mounted) return false;
    if (!cfg) return true;
    if (!cfg.isEnabled) return false;
    if (isMobile && !cfg.showOnMobile) return false;
    if (!isMobile && !cfg.showOnDesktop) return false;
    return true;
  }, [cfg, isMobile, mounted]);

  const posRight = (cfg?.position || "right") === "right";

  const youtubeUrl = useMemo(() => {
    const it = socials.find((x) => {
      const n = String(x.name || "").toLowerCase();
      const ic = String(x.icon || "").toLowerCase();
      const u = String(x.url || "").toLowerCase();

      return (
        n.includes("youtube") ||
        ic.includes("youtube") ||
        u.includes("youtube.com") ||
        u.includes("youtu.be")
      );
    });

    return it?.url || "https://www.youtube.com/@IGNOU7748";
  }, [socials]);

  const whatsappUrl = useMemo(() => {
    const it = socials.find((x) => {
      const n = String(x.name || "").toLowerCase();
      const ic = String(x.icon || "").toLowerCase();
      const u = String(x.url || "").toLowerCase();

      return (
        n.includes("whatsapp") ||
        ic.includes("whatsapp") ||
        u.includes("wa.me")
      );
    });

    return it?.url || "";
  }, [socials]);

  const hideOnMobileProductDetail = useMemo(() => {
    return Boolean(isMobile && isMobileProductDetailPath(pathname || ""));
  }, [isMobile, pathname]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openWhatsApp = () => {
    if (whatsappUrl) {
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const num = cleanNumber(cfg?.whatsappNumber || "917496865680");
    const msg = encodeURIComponent(
      cfg?.whatsappMessage || "Hi! I need help regarding IGNOU materials."
    );
    const url = `https://wa.me/${num}?text=${msg}`;

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleOptionClick = (nextId: string) => {
    if (nextId === "whatsapp_action") {
      openWhatsApp();
      return;
    }

    if (String(nextId).startsWith("open:")) {
      const path = String(nextId).slice(5) || "/";

      setIsChatOpen(false);
      dispatchNavigationStart(path);
      router.push(path);
      return;
    }

    setHistory((h) => [...h, currentStep]);
    setCurrentStep(nextId);
  };

  const handleBack = () => {
    setHistory((h) => {
      if (!h.length) return h;

      const prev = h[h.length - 1];
      setCurrentStep(prev);
      return h.slice(0, -1);
    });
  };

  const resetChat = () => {
    setCurrentStep("root");
    setHistory([]);
  };

  const node = flow[currentStep] || flow.root || DEFAULT_FLOW.root;

  if (!mounted || hideOnMobileProductDetail) {
    return null;
  }

  return (
    <div className="z-[100] font-sans">
      <button
        onClick={scrollToTop}
        className={`fixed bottom-4 left-4 z-40 rounded-full bg-sky-500 p-2 text-white shadow-lg transition-all duration-300 hover:scale-110 hover:bg-sky-600 active:scale-90 md:bottom-6 md:left-6 md:p-3 ${
          showScroll ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
        }`}
        title="Go to Top"
        aria-label="Go to Top"
        type="button"
      >
        <ArrowUp className="h-6 w-6 md:h-7 md:w-7" strokeWidth={3} />
      </button>

      <div
        className={`fixed bottom-4 z-50 flex flex-col items-end gap-3 md:bottom-6 md:gap-4 ${
          posRight ? "right-4 md:right-6" : "left-4 md:left-6"
        }`}
      >
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF0000] text-white shadow-md transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-red-500/30 active:scale-90 md:h-14 md:w-14"
          title="Watch on YouTube"
          aria-label="Watch on YouTube"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="white"
            className="h-5 w-5 md:h-7 md:w-7"
          >
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.008 3.008 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        </a>

        <button
          onClick={openWhatsApp}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-white shadow-md transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-green-500/30 active:scale-90 md:h-14 md:w-14"
          title="Chat on WhatsApp"
          aria-label="Chat on WhatsApp"
          type="button"
        >
          <svg
            viewBox="0 0 24 24"
            fill="white"
            className="h-5 w-5 md:h-8 md:w-8"
          >
            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.592 2.654-.696c1.001.574 2.146.877 3.303.877 3.18 0 5.767-2.587 5.768-5.766.001-3.181-2.584-5.761-5.765-5.761zm6.927 5.766c-.001 3.82-3.107 6.925-6.927 6.925-1.129 0-2.235-.291-3.21-.842l-3.593.942.958-3.504c-.628-1.04-1.002-2.213-1.002-3.521-.001-3.819 3.106-6.925 6.927-6.925 3.82 0 6.926 3.106 6.927 6.925z" />
            <path d="M15.42 13.064c-.177-.089-1.047-.516-1.209-.576-.161-.059-.279-.089-.396.089-.118.178-.456.576-.559.694-.102.119-.205.133-.382.045-.178-.089-.751-.277-1.429-.882-.53-.473-.888-1.057-.992-1.235-.104-.177-.011-.273.078-.362.08-.08.178-.207.266-.31.089-.104.119-.178.178-.297.059-.118.029-.222-.015-.31-.044-.089-.396-.955-.542-1.309-.143-.343-.288-.296-.396-.301-.102-.005-.219-.005-.337-.005-.118 0-.31.044-.472.222-.162.178-.62.606-.62 1.478 0 .872.635 1.714.723 1.833.089.119 1.251 1.91 3.03 2.678 1.054.455 1.47.532 1.996.448.586-.093 1.047-.428 1.195-.841.148-.414.148-.769.104-.841-.044-.074-.162-.119-.339-.207z" />
          </svg>
        </button>

        {allowChatBot ? (
          <button
            onClick={() => setIsChatOpen((v) => !v)}
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white text-white shadow-lg ring-2 ring-blue-100 transition-all duration-300 hover:scale-110 hover:shadow-xl active:scale-90 md:h-16 md:w-16"
            style={{ backgroundColor: cfg?.themeColor || "#3B82F6" }}
            title="Ask Navi"
            aria-label="Ask Navi"
            type="button"
          >
            {isChatOpen ? (
              <X className="h-6 w-6 md:h-8 md:w-8" strokeWidth={2.5} />
            ) : (
              <span className="text-sm font-extrabold tracking-wide md:text-xl">
                Ask
              </span>
            )}
          </button>
        ) : null}
      </div>

      {allowChatBot && isChatOpen ? (
        <div
          className={`fixed z-[60] flex max-h-[60vh] w-[90vw] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl md:max-h-[500px] md:w-[350px] ${
            posRight ? "right-4 md:right-6" : "left-4 md:left-6"
          } bottom-20 md:bottom-28`}
        >
          <div
            className="flex items-center justify-between p-4 text-white shadow-md"
            style={{ backgroundColor: cfg?.themeColor || "#3B82F6" }}
          >
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-white/20 p-1.5">
                <MessageCircle size={20} fill="white" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Ask Navi</h3>
                <p className="flex items-center gap-1 text-[10px] text-white/80">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                  Online
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              {history.length > 0 ? (
                <button
                  onClick={handleBack}
                  className="rounded p-1 hover:bg-white/20"
                  title="Back"
                  aria-label="Back"
                  type="button"
                >
                  <ChevronLeft size={18} />
                </button>
              ) : null}

              <button
                onClick={() => setIsChatOpen(false)}
                className="rounded p-1 hover:bg-white/20"
                title="Close"
                aria-label="Close"
                type="button"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="min-h-[250px] flex-1 overflow-y-auto bg-gray-50 p-4 md:min-h-[300px]">
            <div className="mb-4 flex gap-3">
              <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                <MessageCircle
                  size={18}
                  className="text-blue-600"
                  fill="currentColor"
                />
              </div>

              <div className="rounded-2xl rounded-tl-none border border-gray-100 bg-white p-3 text-sm leading-relaxed text-slate-700 shadow-sm">
                {node?.text || "Hi!"}
              </div>
            </div>

            <div className="flex flex-col gap-2 pl-11">
              {(node?.options || []).map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleOptionClick(option.nextId)}
                  className="group flex items-center justify-between rounded-xl bg-blue-600 px-4 py-2.5 text-left text-xs text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95 active:bg-blue-800 md:text-sm"
                  type="button"
                >
                  {option.label}
                  <Send
                    size={12}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </button>
              ))}
            </div>

            {currentStep !== "root" ? (
              <div className="mt-6 text-center">
                <button
                  onClick={resetChat}
                  className="text-xs text-slate-400 underline hover:text-blue-600"
                  type="button"
                >
                  Start Over
                </button>
              </div>
            ) : null}
          </div>

          <div className="border-t border-gray-100 bg-white p-3 text-center text-[10px] text-slate-400">
            Powered by IGNOU Students Portal AI
          </div>
        </div>
      ) : null}
    </div>
  );
}