"use client";

import { useEffect, useRef, useState } from "react";
import {
  PenTool,
  CheckCircle2,
  Truck,
  Star,
  MapPin,
  ShieldCheck,
  PackageCheck,
  Smile,
} from "lucide-react";

export default function DeliveryLoopAnimation() {
  const STEP_COUNT = 4;
  const STEP_DURATION = 4000;
  const FADE_DURATION = 320;

  const [activeStep, setActiveStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setIsVisible(false);

      fadeTimeoutRef.current = setTimeout(() => {
        setActiveStep((prev) => (prev + 1) % STEP_COUNT);
        setIsVisible(true);
      }, FADE_DURATION);
    }, STEP_DURATION);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
  }, []);

  const steps = [
    {
      id: "STEP 1",
      title: "Handwritten Preparation",
      desc: "Your assignment pages are neatly handwritten in a clean, readable format for a polished final presentation.",
    },
    {
      id: "STEP 2",
      title: "Secure Packing",
      desc: "The prepared pages are arranged carefully, packed safely, and sealed properly before dispatch.",
    },
    {
      id: "STEP 3",
      title: "Fast Delivery",
      desc: "Your handwritten product is dispatched securely with delivery support so it reaches you safely.",
    },
    {
      id: "STEP 4",
      title: "Happy Delivery Experience",
      desc: "The package arrives successfully and customers feel confident, satisfied, and ready to submit.",
    },
  ];

  const step = steps[activeStep];

  return (
    <div className="relative w-full min-h-[460px] overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <style jsx>{`
        @keyframes fillBar {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }

        @keyframes floatSoft {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-6px);
          }
        }

        @keyframes penMove {
          0%,
          100% {
            transform: translate(0px, 0px) rotate(-18deg);
          }
          50% {
            transform: translate(16px, -8px) rotate(-24deg);
          }
        }

        @keyframes lineGrow {
          0% {
            width: 0%;
            opacity: 0.4;
          }
          100% {
            width: 100%;
            opacity: 1;
          }
        }

        @keyframes pageLift {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-3px);
          }
        }

        @keyframes packetDrop {
          0% {
            transform: translateY(-18px) scale(0.9);
            opacity: 0;
          }
          100% {
            transform: translateY(0px) scale(1);
            opacity: 1;
          }
        }

        @keyframes sealPop {
          0% {
            transform: scale(0.2);
            opacity: 0;
          }
          75% {
            transform: scale(1.08);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes routeDash {
          0% {
            stroke-dashoffset: 120;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }

        @keyframes truckRide {
          0%,
          100% {
            transform: translateX(-6px);
          }
          50% {
            transform: translateX(8px);
          }
        }

        @keyframes speedLine {
          0% {
            transform: translateX(0);
            opacity: 1;
          }
          100% {
            transform: translateX(-34px);
            opacity: 0;
          }
        }

        @keyframes starPop {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          80% {
            transform: scale(1.18);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes cardRise {
          0% {
            transform: translateY(14px);
            opacity: 0;
          }
          100% {
            transform: translateY(0px);
            opacity: 1;
          }
        }

        @keyframes pulseRing {
          0% {
            transform: scale(0.92);
            opacity: 0.45;
          }
          100% {
            transform: scale(1.15);
            opacity: 0;
          }
        }

        @keyframes fadeDots {
          0%,
          100% {
            opacity: 0.18;
          }
          50% {
            opacity: 0.3;
          }
        }

        .progress-active {
          animation: fillBar ${STEP_DURATION}ms linear forwards;
        }

        .bg-dots {
          background-image: radial-gradient(#cbd5e1 1.8px, transparent 1.8px);
          background-size: 24px 24px;
          animation: fadeDots 4s ease-in-out infinite;
        }

        .float-soft {
          animation: floatSoft 3s ease-in-out infinite;
        }

        .pen-move {
          animation: penMove 1.8s ease-in-out infinite;
        }

        .line-grow-1 {
          animation: lineGrow 1s ease forwards;
        }

        .line-grow-2 {
          animation: lineGrow 1s ease forwards 0.35s;
        }

        .line-grow-3 {
          animation: lineGrow 1s ease forwards 0.7s;
        }

        .page-lift {
          animation: pageLift 2.2s ease-in-out infinite;
        }

        .packet-drop {
          animation: packetDrop 0.55s ease forwards;
        }

        .seal-pop {
          animation: sealPop 0.55s cubic-bezier(0.175, 0.885, 0.32, 1.275)
            forwards 0.25s;
          opacity: 0;
        }

        .truck-ride {
          animation: truckRide 2s ease-in-out infinite;
        }

        .speed-line {
          animation: speedLine 0.75s linear infinite;
        }

        .star-pop {
          animation: starPop 0.45s
            cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          opacity: 0;
          transform: scale(0);
        }

        .review-rise {
          animation: cardRise 0.55s ease forwards;
        }

        .pulse-ring {
          animation: pulseRing 1.3s ease-out infinite;
        }

        .route-path {
          stroke-dasharray: 120;
          stroke-dashoffset: 120;
          animation: routeDash 1.8s linear forwards;
        }
      `}</style>

      <div className="absolute inset-0 bg-dots opacity-25" />

      <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-blue-100/60 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-cyan-100/60 blur-3xl" />

      <div className="relative z-20 px-4 pt-4">
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200/80"
            >
              <div
                className={`h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 ${
                  index === activeStep
                    ? "progress-active"
                    : index < activeStep
                    ? "w-full"
                    : "w-0"
                }`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 flex min-h-[460px] flex-col px-6 pb-6 pt-6">
        <div
          key={activeStep}
          className={`flex h-full flex-1 flex-col transition-all ease-out ${
            isVisible
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-2 opacity-0"
          }`}
          style={{ transitionDuration: `${FADE_DURATION}ms` }}
        >
          <div className="mb-6 min-h-[92px] pr-2">
            <div className="mb-2 inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-extrabold tracking-[0.18em] text-blue-700">
              {step.id}
            </div>
            <h2 className="text-[24px] font-extrabold leading-tight text-slate-900">
              {step.title}
            </h2>
            <p className="mt-2 max-w-[420px] text-[14px] leading-6 text-slate-600">
              {step.desc}
            </p>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <div className="relative flex h-[255px] w-full max-w-[320px] items-center justify-center overflow-hidden rounded-[30px] border border-white/70 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.10)] backdrop-blur-sm">
              {activeStep === 0 && (
                <div className="relative h-full w-full overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-blue-50 to-transparent" />
                  <div className="absolute left-8 top-7 h-[180px] w-[140px] rounded-2xl border border-slate-200 bg-white shadow-[0_10px_25px_rgba(15,23,42,0.08)] page-lift">
                    <div className="px-4 pt-5">
                      <div className="mb-4 flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                        <div className="h-2 w-16 rounded-full bg-slate-200" />
                      </div>

                      <div className="space-y-3">
                        <div className="h-2.5 w-[78%] rounded-full bg-slate-100 overflow-hidden">
                          <div className="line-grow-1 h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" />
                        </div>
                        <div className="h-2.5 w-[100%] rounded-full bg-slate-100 overflow-hidden">
                          <div className="line-grow-2 h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" />
                        </div>
                        <div className="h-2.5 w-[88%] rounded-full bg-slate-100 overflow-hidden">
                          <div className="line-grow-3 h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" />
                        </div>
                        <div className="h-2.5 w-[62%] rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="line-grow-3 h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500"
                            style={{ animationDelay: "1s" }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="absolute left-[150px] top-[42px] rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-700 shadow-sm">
                    Clean Handwriting
                  </div>

                  <div className="absolute right-8 top-[82px] pen-move text-blue-700 drop-shadow-lg">
                    <PenTool size={34} strokeWidth={2.2} />
                  </div>

                  <div className="absolute bottom-7 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-1.5 text-[11px] font-bold text-white shadow-lg">
                    Neat • Readable • Professional
                  </div>
                </div>
              )}

              {activeStep === 1 && (
                <div className="relative h-full w-full">
                  <div className="absolute left-1/2 top-[46px] h-[120px] w-[150px] -translate-x-1/2 rounded-[22px] border-2 border-amber-200 bg-gradient-to-b from-amber-50 to-yellow-100 shadow-[0_14px_30px_rgba(180,120,0,0.12)] packet-drop">
                    <div className="absolute inset-x-0 top-0 h-[42px] rounded-t-[20px] border-b border-amber-200 bg-white/45" />
                    <div className="absolute left-1/2 top-[18px] h-[2px] w-[60px] -translate-x-1/2 rounded-full bg-amber-300" />
                    <div className="absolute left-1/2 top-[60px] h-[36px] w-[90px] -translate-x-1/2 rounded-xl border border-amber-300 bg-white/65" />
                  </div>

                  <div className="absolute left-[52px] top-[72px] h-[86px] w-[62px] rotate-[-10deg] rounded-xl border border-slate-200 bg-white shadow-sm" />
                  <div className="absolute left-[70px] top-[64px] h-[92px] w-[68px] rotate-[-4deg] rounded-xl border border-slate-200 bg-white shadow-sm" />
                  <div className="absolute left-[90px] top-[58px] h-[100px] w-[74px] rounded-xl border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.08)]" />

                  <div className="absolute bottom-[58px] left-1/2 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-700 shadow">
                    Pages arranged safely
                  </div>

                  <div className="absolute right-[62px] top-[138px] z-20 seal-pop">
                    <div className="relative">
                      <div className="pulse-ring absolute inset-0 rounded-full bg-red-400/40" />
                      <div className="relative rounded-full border-[4px] border-white bg-red-500 p-3 text-white shadow-[0_10px_24px_rgba(239,68,68,0.35)]">
                        <ShieldCheck size={24} />
                      </div>
                    </div>
                  </div>

                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1.5 text-[11px] font-extrabold text-white shadow-md">
                    Packed • Sealed • Protected
                  </div>
                </div>
              )}

              {activeStep === 2 && (
                <div className="relative h-full w-full overflow-hidden bg-[linear-gradient(180deg,#eff6ff_0%,#ffffff_100%)]">
                  <div className="absolute inset-0">
                    <svg
                      viewBox="0 0 320 255"
                      className="h-full w-full"
                      fill="none"
                    >
                      <path
                        d="M38 184 C90 150, 126 172, 168 132 C201 100, 238 104, 286 68"
                        stroke="#93c5fd"
                        strokeWidth="4"
                        strokeLinecap="round"
                        className="route-path"
                      />
                    </svg>
                  </div>

                  <div className="absolute right-7 top-12 flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-[11px] font-bold text-blue-700 shadow-sm">
                    <MapPin size={13} />
                    Destination
                  </div>

                  <div className="absolute left-10 top-[168px] flex gap-3 opacity-50">
                    <div className="speed-line h-1 w-10 rounded-full bg-slate-300" />
                    <div
                      className="speed-line h-1 w-6 rounded-full bg-slate-300"
                      style={{ animationDelay: "0.15s" }}
                    />
                    <div
                      className="speed-line h-1 w-12 rounded-full bg-slate-300"
                      style={{ animationDelay: "0.25s" }}
                    />
                  </div>

                  <div className="absolute left-1/2 top-[132px] z-20 -translate-x-1/2 truck-ride">
                    <div className="flex items-center gap-3 rounded-[22px] border border-blue-100 bg-white px-4 py-3 shadow-[0_14px_30px_rgba(37,99,235,0.10)]">
                      <div className="rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 p-2.5 text-white shadow-md">
                        <Truck size={28} />
                      </div>
                      <div>
                        <div className="text-[14px] font-extrabold text-slate-900">
                          Out for Delivery
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                          <PackageCheck size={12} />
                          Secure dispatch in progress
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="absolute left-6 bottom-7 rounded-full bg-slate-900 px-4 py-1.5 text-[11px] font-bold text-white shadow-lg">
                    Safe Delivery Support
                  </div>
                </div>
              )}

              {activeStep === 3 && (
                <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_top,#e0f2fe_0%,#ffffff_50%,#f0fdf4_100%)]">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="review-rise relative rounded-[26px] border border-white bg-white/95 px-6 py-5 shadow-[0_18px_40px_rgba(15,23,42,0.10)] backdrop-blur-sm">
                      <div className="mb-3 flex justify-center gap-1.5">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <Star
                            key={i}
                            size={20}
                            className="star-pop fill-amber-400 text-amber-400"
                            style={{ animationDelay: `${i * 0.12}s` }}
                          />
                        ))}
                      </div>

                      <div className="mb-2 flex justify-center">
                        <div className="rounded-full bg-green-100 p-3 text-green-600">
                          <Smile size={24} />
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="text-[18px] font-extrabold text-slate-900">
                          Successfully Delivered
                        </div>
                        <div className="mt-1 text-[12px] font-medium text-slate-500">
                          Happy customer experience with clean presentation
                        </div>
                      </div>

                      <div className="mt-4 flex justify-center">
                        <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-2 text-[12px] font-extrabold text-white shadow-lg">
                          <CheckCircle2 size={15} />
                          Ready to Submit
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="float-soft absolute left-7 top-10 rounded-full border border-green-200 bg-white px-3 py-1.5 text-[11px] font-bold text-green-700 shadow-sm">
                    Happy Reviews
                  </div>
                  <div className="float-soft absolute right-8 bottom-10 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-[11px] font-bold text-blue-700 shadow-sm">
                    Trusted Delivery
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}