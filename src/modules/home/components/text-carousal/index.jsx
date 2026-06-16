"use client";

import { Check } from "lucide-react";
import { useEffect, useRef } from "react";
import gsap from "gsap";

export default function TextCarousel({
  texts,
  direction = "left",
}) {
  const trackRef = useRef(null);

  useEffect(() => {
    const track = trackRef.current;

    if (!track) return;

    const totalWidth = track.scrollWidth / 2;

    let x = direction === "left" ? 0 : -totalWidth;

    const speed = 1; // pixels per frame

    gsap.ticker.add(tick);

    function tick() {
      x += direction === "left" ? -speed : speed;

      if (direction === "left" && x <= -totalWidth) {
        x = 0;
      }

      if (direction === "right" && x >= 0) {
        x = -totalWidth;
      }

      gsap.set(track, { x });
    }

    return () => {
      gsap.ticker.remove(tick);
    };
  }, [direction, texts]);

  return (
    <div className="w-full overflow-hidden">
      <div
        ref={trackRef}
        className="flex w-max items-center gap-4"
      >
        {[...texts, ...texts].map((text, index) => (
          <div
            key={index}
            className="flex items-center justify-center gap-2 bg-black rounded-full px-6 py-2 border border-neutral-800"
          >
            <Check stroke="#dbfd40" size={12} />
            <span className="whitespace-nowrap text-sm text-[#dbfd40] font-medium">
              {text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}