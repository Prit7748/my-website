"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import { Star } from "lucide-react";

import "swiper/css";
import "swiper/css/pagination";

type Review = {
  _id?: string;
  id?: string | number;
  name: string;
  course: string;
  text: string;
  rating?: number;
  avatarUrl?: string;
};

function getId(r: Review, idx: number) {
  return String(r._id || r.id || idx);
}

function clampRating(x: any) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 5;
  return Math.min(5, Math.max(1, n));
}

export default function HomeTestimonials({ reviews = [] }: { reviews?: Review[] }) {
  if (!reviews.length) return null;

  return (
    <section className="py-16 bg-[#F9FAFB]">
      <div className="max-w-[1600px] mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-800">What Students Say</h2>
          <p className="text-slate-500 mt-2">Trusted by thousands of IGNOU students</p>
        </div>

        <Swiper
          modules={[Autoplay, Pagination]}
          spaceBetween={30}
          slidesPerView={1}
          breakpoints={{ 768: { slidesPerView: 2 }, 1024: { slidesPerView: 3 } }}
          autoplay={{ delay: 3000, disableOnInteraction: false }}
          loop={reviews.length > 3}
          pagination={{ clickable: true }}
          className="pb-12"
        >
          {reviews.map((review, idx) => {
            const rating = clampRating(review.rating);
            const initial = (review.name || "?").trim().charAt(0).toUpperCase() || "?";

            return (
              <SwiperSlide key={getId(review, idx)}>
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition h-full">
                  <div className="flex text-yellow-400 mb-4">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={18} fill={s <= rating ? "currentColor" : "none"} />
                    ))}
                  </div>

                  <p className="text-slate-600 mb-6 italic leading-relaxed text-sm md:text-base">
                    “{review.text}”
                  </p>

                  <div className="flex items-center gap-4">
                    {review.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={review.avatarUrl}
                        alt={review.name}
                        className="w-12 h-12 rounded-full object-cover border border-gray-200"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                        {initial}
                      </div>
                    )}

                    <div>
                      <h4 className="font-bold text-slate-800">{review.name}</h4>
                      <p className="text-xs text-slate-400">{review.course} Student</p>
                    </div>
                  </div>
                </div>
              </SwiperSlide>
            );
          })}
        </Swiper>
      </div>
    </section>
  );
}
