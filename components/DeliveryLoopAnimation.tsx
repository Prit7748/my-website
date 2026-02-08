"use client";

import { Pencil, Package, Truck, BadgeCheck } from "lucide-react";

export default function DeliveryLoopAnimation() {
  return (
    <div className="relative w-full h-full min-h-[280px] rounded-2xl overflow-hidden border border-gray-200 bg-white">
      <style jsx>{`
        @keyframes sceneFade {
          0%, 22% { opacity: 1; transform: translateY(0); }
          27%, 100% { opacity: 0; transform: translateY(8px); }
        }
        @keyframes progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        .scene { position: absolute; inset: 0; display: grid; place-items: center; padding: 18px; opacity: 0; }
        .s1 { animation: sceneFade 8s infinite; opacity: 1; }
        .s2 { animation: sceneFade 8s infinite; animation-delay: 2s; }
        .s3 { animation: sceneFade 8s infinite; animation-delay: 4s; }
        .s4 { animation: sceneFade 8s infinite; animation-delay: 6s; }

        .paper {
          width: 220px; height: 280px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          border: 1px solid rgba(15,23,42,0.12);
          border-radius: 18px;
          box-shadow: 0 20px 50px rgba(2,6,23,0.10);
          position: relative;
          overflow: hidden;
        }
        .lines {
          position: absolute; inset: 14px 14px 14px 14px;
          background:
            linear-gradient(#e2e8f0 1px, transparent 1px) 0 18px / 100% 18px;
          opacity: 0.7;
        }
        @keyframes scribble {
          0% { width: 0%; opacity: 0.7; }
          20% { width: 80%; opacity: 1; }
          100% { width: 80%; opacity: 1; }
        }
        .ink {
          position: absolute; left: 26px; top: 58px;
          height: 10px; width: 0%;
          background: linear-gradient(90deg, rgba(30,64,175,0.0) 0%, rgba(30,64,175,0.95) 18%, rgba(30,64,175,0.95) 100%);
          border-radius: 999px;
          animation: scribble 8s infinite;
        }
        .ink2 { top: 84px; animation-delay: 0.25s; }
        .ink3 { top: 110px; animation-delay: 0.5s; }
        .ink4 { top: 136px; animation-delay: 0.75s; }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .float { animation: bounce 2.6s ease-in-out infinite; }

        .bgGlow {
          position: absolute; inset: -40%;
          background: radial-gradient(circle at 30% 30%, rgba(59,130,246,0.18), transparent 55%),
                      radial-gradient(circle at 70% 70%, rgba(168,85,247,0.18), transparent 55%),
                      radial-gradient(circle at 30% 80%, rgba(34,211,238,0.14), transparent 55%);
          filter: blur(10px);
        }
      `}</style>

      <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-[#f7f9ff]" />
      <div className="bgGlow" />

      {/* top label */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
        <div className="px-3 py-1 rounded-full border border-blue-200 bg-blue-50 text-[11px] font-extrabold text-blue-700">
          5–10 sec Delivery Preview
        </div>
        <div className="hidden sm:block text-[11px] font-bold text-slate-600">
          Writing → Packing → Delivery → Happy Student
        </div>
      </div>

      {/* progress */}
      <div className="absolute bottom-3 left-3 right-3">
        <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
          <div className="h-full bg-slate-900" style={{ animation: "progress 8s linear infinite" }} />
        </div>
      </div>

      {/* Scene 1 */}
      <div className="scene s1">
        <div className="text-center">
          <div className="mx-auto paper float">
            <div className="lines" />
            <div className="ink" />
            <div className="ink ink2" />
            <div className="ink ink3" />
            <div className="ink ink4" />
          </div>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/90 border border-gray-200 shadow-sm">
            <Pencil size={18} className="text-blue-700" />
            <div className="text-sm font-extrabold text-slate-900">We write neatly on pages</div>
          </div>
          <div className="mt-1 text-xs font-semibold text-slate-600">Readable formatting for submission</div>
        </div>
      </div>

      {/* Scene 2 */}
      <div className="scene s2">
        <div className="text-center">
          <div className="mx-auto w-[240px] h-[240px] rounded-3xl bg-white/90 border border-gray-200 shadow-lg grid place-items-center float">
            <div className="relative">
              <Package size={74} className="text-indigo-700" />
              <div className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-green-600 text-white grid place-items-center shadow-md">
                <BadgeCheck size={18} />
              </div>
            </div>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/90 border border-gray-200 shadow-sm">
            <Package size={18} className="text-indigo-700" />
            <div className="text-sm font-extrabold text-slate-900">Safe packing in envelope</div>
          </div>
          <div className="mt-1 text-xs font-semibold text-slate-600">Pages remain protected</div>
        </div>
      </div>

      {/* Scene 3 */}
      <div className="scene s3">
        <div className="text-center">
          <div className="mx-auto w-[260px] h-[220px] rounded-3xl bg-white/90 border border-gray-200 shadow-lg grid place-items-center float">
            <div className="flex items-center gap-3">
              <Truck size={80} className="text-slate-900" />
              <div className="text-left">
                <div className="text-sm font-extrabold text-slate-900">Dispatch Fast</div>
                <div className="text-xs font-semibold text-slate-600">All India delivery</div>
                <div className="mt-2 h-2 w-40 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full bg-blue-600" style={{ animation: "progress 8s linear infinite" }} />
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/90 border border-gray-200 shadow-sm">
            <Truck size={18} className="text-slate-900" />
            <div className="text-sm font-extrabold text-slate-900">Delivered across India</div>
          </div>
          <div className="mt-1 text-xs font-semibold text-slate-600">Shortest possible time*</div>
        </div>
      </div>

      {/* Scene 4 */}
      <div className="scene s4">
        <div className="text-center">
          <div className="mx-auto w-[280px] rounded-3xl bg-white/90 border border-gray-200 shadow-lg p-6 float">
            <div className="text-2xl font-extrabold text-slate-900">😊</div>
            <div className="mt-2 text-sm font-extrabold text-slate-900">Customer receives & is happy</div>
            <div className="mt-1 text-xs font-semibold text-slate-600">
              Better submission experience
            </div>
            <div className="mt-4 rounded-2xl bg-green-50 border border-green-200 px-4 py-3">
              <div className="text-xs font-extrabold text-green-800">Quality + Presentation</div>
              <div className="text-[11px] font-semibold text-green-700">Helps in better grades*</div>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 font-semibold">
            *Results vary. Follow your university guidelines.
          </div>
        </div>
      </div>
    </div>
  );
}
