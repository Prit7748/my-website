"use client";
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Navigation, Pagination, EffectFade } from 'swiper/modules';
import Image from "next/image";
import Link from "next/link"; 

// CSS Imports
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/effect-fade';

export default function HeroSlider() {
  
  // ---------------------------------------------------------
  // 1. DESKTOP SLIDES DATA (Landscape Images/Videos)
  // ---------------------------------------------------------
  const desktopSlides = [
    { 
      id: 'd1', 
      type: 'image', 
      src: '/slider1.png',   // Desktop wali image (1920x600 px approx)
      link: '/shop/solved-assignments' 
    },
    { 
      id: 'd2', 
      type: 'video', 
      src: '/intro.mp4',     // Desktop wala video
      link: '#' 
    },
  ];

  // ---------------------------------------------------------
  // 2. MOBILE SLIDES DATA (Portrait/Square Images)
  // ---------------------------------------------------------
  const mobileSlides = [
    { 
      id: 'm1', 
      type: 'image', 
      src: '/mobile-banner1.jpg', // Mobile wali image (713x620 px approx)
      link: '/shop/handwritten' 
    },
    { 
      id: 'm2', 
      type: 'video', 
      src: '/mobile-intro.mp4',   // Mobile wala video (Vertical)
      link: '#' 
    },
  ];

  // Common Slider Settings reuse karne ke liye function
  const SliderComponent = ({ data, heightClass }: { data: any[], heightClass: string }) => (
    <Swiper
        modules={[Autoplay, Navigation, Pagination, EffectFade]}
        effect={'fade'}
        fadeEffect={{ crossFade: true }}
        speed={1000}
        spaceBetween={0}
        slidesPerView={1}
        navigation
        pagination={{ clickable: true }}
        autoplay={{ delay: 6000, disableOnInteraction: false }}
        loop={true}
        className={`w-full ${heightClass}`} 
      >
        {data.map((slide) => (
          <SwiperSlide key={slide.id}>
            <Link 
              href={slide.link || "#"} 
              className={`relative w-full h-full block ${slide.link ? 'cursor-pointer' : ''}`}
            >
              {slide.type === 'image' ? (
                <Image 
                  src={slide.src} 
                  alt={`Slide ${slide.id}`}
                  fill 
                  className="object-cover"
                  priority
                />
              ) : (
                <video 
                  className="w-full h-full object-cover"
                  autoPlay loop muted playsInline
                >
                  <source src={slide.src} type="video/mp4" />
                </video>
              )}
            </Link>
          </SwiperSlide>
        ))}
    </Swiper>
  );

  return (
    <div className="w-full relative group">
      
      {/* ============================================================
          1. DESKTOP SLIDER (Visible on md: and above)
          - Height: md:h-[500px] lg:h-[600px]
          - hidden on mobile
      ============================================================ */}
      <div className="hidden md:block">
        <SliderComponent 
            data={desktopSlides} 
            heightClass="h-[500px] lg:h-[600px]" 
        />
      </div>

      {/* ============================================================
          2. MOBILE SLIDER (Visible only on small screens)
          - Aspect Ratio: [713/620]
          - md:hidden (Desktop par gayab)
      ============================================================ */}
      <div className="block md:hidden">
        <SliderComponent 
            data={mobileSlides} 
            heightClass="aspect-[713/620]" 
        />
      </div>

    </div>
  );
}