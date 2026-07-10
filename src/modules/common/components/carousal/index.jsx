"use client";
import { FaGoogle, FaStar, FaStarHalfAlt } from "react-icons/fa";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import Image from "next/image";

const ITEMS = ["/usage/carousal/1.svg", "/usage/carousal/2.svg", "/usage/carousal/3.png", "/usage/carousal/4.png", "/usage/carousal/5.jpg", "/usage/carousal/6.png"];

export default function Carousal() {
  const trackRef = useRef(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const tween = gsap.to(track, {
      xPercent: -50,
      duration: 12,
      ease: "none",
      repeat: -1,
    });

    return () => tween.kill();
  }, []);

  const repeated = [...ITEMS, ...ITEMS];

  return (
    <main className="flex items-center gap-10 overflow-hidden p-8">
      <div className="shrink-0 max-w-xs">
        <div className="flex gap-4 items-center justify-center bg-neutral-100 p-2 rounded-lg">
            <FaGoogle />
            <div className="flex">
                <FaStar className="text-neutral-500" />
                <FaStar className="text-neutral-500"/>
                <FaStar className="text-neutral-500"/>
                <FaStar className="text-neutral-500"/>
                <FaStarHalfAlt className="text-neutral-500"/>
            </div>
            <h1 className="font-semibold text-sm">4.6</h1>
            <span className="text-neutral-600 border-l text-sm pl-2 border-l-neutral-600">2100+ reviews</span>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <div ref={trackRef} className="flex w-max gap-4">
          {repeated.map((item, i) => (
            <div key={`${item}-${i}`} className="flex h-20 w-32 items-center justify-center p-4">
              <Image
                src={item}
                alt="real estate"
                width={96}
                height={48}
                className="h-auto w-auto max-h-10 object-contain grayscale opacity-70 transition-all duration-300 hover:grayscale-0 hover:opacity-100"
              />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}