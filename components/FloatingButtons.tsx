"use client";
import { useState, useEffect } from "react";
import { ArrowUp, MessageCircle, X, ChevronLeft, Send } from "lucide-react";

// ==============================================================================
// CHATBOT DATA
// ==============================================================================
const chatData: Record<string, { text: string; options: { label: string; nextId: string }[] }> = {
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
  final_msg: {
    text: "Thank you! Please visit our 'Shop' section or WhatsApp us for this specific requirement. Should I connect you to WhatsApp?",
    options: [
      { label: "Yes, Open WhatsApp", nextId: "whatsapp_action" },
      { label: "No, Go to Main Menu", nextId: "root" },
    ],
  },
};

export default function FloatingButtons() {
  const [showScroll, setShowScroll] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState("root");
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    const checkScroll = () => {
      if (window.scrollY > 300) setShowScroll(true);
      else setShowScroll(false);
    };
    window.addEventListener("scroll", checkScroll);
    return () => window.removeEventListener("scroll", checkScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleOptionClick = (nextId: string) => {
    if (nextId === "whatsapp_action") {
      window.open("https://wa.me/917496865680", "_blank");
      return;
    }
    setHistory([...history, currentStep]);
    setCurrentStep(nextId);
  };

  const handleBack = () => {
    if (history.length > 0) {
      const prevStep = history[history.length - 1];
      setCurrentStep(prevStep);
      setHistory(history.slice(0, -1));
    }
  };

  const resetChat = () => {
    setCurrentStep("root");
    setHistory([]);
  };

  return (
    <div className="z-[100] font-sans">

      {/* =========================================================
          1. SCROLL TO TOP (Left Side)
          - Added 'active:scale-90' for mobile touch feedback
      ========================================================= */}
      <button 
        onClick={scrollToTop}
        className={`fixed bottom-4 left-4 md:bottom-6 md:left-6 z-40 bg-sky-500 text-white p-2 md:p-3 rounded-full shadow-lg transition-all duration-300 transform hover:scale-110 active:scale-90 hover:bg-sky-600 ${showScroll ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}
        title="Go to Top"
      >
        <ArrowUp className="w-6 h-6 md:w-7 md:h-7" strokeWidth={3} />
      </button>


      {/* =========================================================
          2. RIGHT SIDE BUTTONS
          - Added 'active:scale-90' to all buttons
      ========================================================= */}
      <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 flex flex-col items-end gap-3 md:gap-4 z-50">
        
        {/* A. YouTube */}
        <a 
          href="https://youtube.com/@IgnouStudentsPortal"
          target="_blank" 
          rel="noopener noreferrer"
          className="bg-[#FF0000] w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center text-white shadow-md transition-all duration-300 hover:scale-110 active:scale-90 hover:shadow-xl hover:shadow-red-500/30"
          title="Watch on YouTube"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-5 h-5 md:w-7 md:h-7">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.008 3.008 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        </a>

        {/* B. WhatsApp */}
        <a 
          href="https://wa.me/917496865680" 
          target="_blank" 
          rel="noopener noreferrer"
          className="bg-[#25D366] w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center text-white shadow-md transition-all duration-300 hover:scale-110 active:scale-90 hover:shadow-xl hover:shadow-green-500/30"
          title="Chat on WhatsApp"
        >
          <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 md:w-8 md:h-8">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.592 2.654-.696c1.001.574 2.146.877 3.303.877 3.18 0 5.767-2.587 5.768-5.766.001-3.181-2.584-5.761-5.765-5.761zm6.927 5.766c-.001 3.82-3.107 6.925-6.927 6.925-1.129 0-2.235-.291-3.21-.842l-3.593.942.958-3.504c-.628-1.04-1.002-2.213-1.002-3.521-.001-3.819 3.106-6.925 6.927-6.925 3.82 0 6.926 3.106 6.927 6.925z"/>
                <path d="M15.42 13.064c-.177-.089-1.047-.516-1.209-.576-.161-.059-.279-.089-.396.089-.118.178-.456.576-.559.694-.102.119-.205.133-.382.045-.178-.089-.751-.277-1.429-.882-.53-.473-.888-1.057-.992-1.235-.104-.177-.011-.273.078-.362.08-.08.178-.207.266-.31.089-.104.119-.178.178-.297.059-.118.029-.222-.015-.31-.044-.089-.396-.955-.542-1.309-.143-.343-.288-.296-.396-.301-.102-.005-.219-.005-.337-.005-.118 0-.31.044-.472.222-.162.178-.62.606-.62 1.478 0 .872.635 1.714.723 1.833.089.119 1.251 1.91 3.03 2.678 1.054.455 1.47.532 1.996.448.586-.093 1.047-.428 1.195-.841.148-.414.148-.769.104-.841-.044-.074-.162-.119-.339-.207z"/>
          </svg>
        </a>

        {/* C. Ask Navi Chatbot */}
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="bg-[#3B82F6] w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 hover:scale-110 active:scale-90 hover:shadow-xl hover:shadow-blue-500/30 border-2 border-white ring-2 ring-blue-100 animate-bounce-slow"
          title="Ask Navi"
        >
           {isChatOpen ? (
             <X className="w-6 h-6 md:w-8 md:h-8" strokeWidth={2.5} />
           ) : (
             <span className="font-extrabold text-sm md:text-xl tracking-wide">Ask</span>
           )}
        </button>

      </div>

      {/* Chatbot Interface */}
      {isChatOpen && (
        <div className="fixed bottom-20 right-4 md:bottom-28 md:right-6 w-[90vw] md:w-[350px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[60] animate-in fade-in slide-in-from-bottom-10 duration-300 flex flex-col max-h-[60vh] md:max-h-[500px]">
          <div className="bg-[#3B82F6] p-4 text-white flex justify-between items-center shadow-md">
            <div className="flex items-center gap-2">
                <div className="bg-white/20 p-1.5 rounded-full">
                    <MessageCircle size={20} fill="white" />
                </div>
                <div>
                    <h3 className="font-bold text-sm">Ask Navi</h3>
                    <p className="text-[10px] text-blue-100 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span> Online
                    </p>
                </div>
            </div>
            <div className="flex gap-2">
                {history.length > 0 && (
                    <button onClick={handleBack} className="p-1 hover:bg-white/20 rounded" title="Back">
                        <ChevronLeft size={18} />
                    </button>
                )}
                <button onClick={() => setIsChatOpen(false)} className="p-1 hover:bg-white/20 rounded">
                    <X size={18} />
                </button>
            </div>
          </div>
          <div className="flex-1 bg-gray-50 p-4 overflow-y-auto min-h-[250px] md:min-h-[300px]">
            <div className="flex gap-3 mb-4">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <MessageCircle size={18} className="text-blue-600" fill="currentColor"/>
                </div>
                <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 text-sm text-slate-700 leading-relaxed">
                    {chatData[currentStep].text}
                </div>
            </div>
            <div className="flex flex-col gap-2 pl-11">
                {chatData[currentStep].options.map((option, index) => (
                    <button 
                        key={index}
                        onClick={() => handleOptionClick(option.nextId)}
                        className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs md:text-sm py-2.5 px-4 rounded-xl text-left transition-all shadow-sm active:scale-95 flex justify-between items-center group"
                    >
                        {option.label}
                        <Send size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                ))}
            </div>
            {currentStep !== "root" && (
                <div className="text-center mt-6">
                    <button onClick={resetChat} className="text-xs text-slate-400 hover:text-blue-600 underline">
                        Start Over
                    </button>
                </div>
            )}
          </div>
          <div className="bg-white p-3 border-t border-gray-100 text-center text-[10px] text-slate-400">
             Powered by IGNOU Students Portal AI
          </div>
        </div>
      )}

    </div>
  );
}