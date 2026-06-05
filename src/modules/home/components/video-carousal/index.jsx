"use client";

import { useEffect, useRef, useState } from "react";

export default function Video() {
  const containerRef = useRef(null);
  const trackRef = useRef(null);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    fetch("/api/web-assets")
      .then((r) => r.json())
      .then((data) => setVideos((data.videos ?? []).map((v) => v.url)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const checkOverflow = () => {
      if (!containerRef.current || !trackRef.current) return;
      setShouldAnimate(
        trackRef.current.scrollWidth > containerRef.current.clientWidth
      );
    };

    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [videos]);

  if (videos.length === 0) return null;

  const renderVideos = () =>
    videos.map((src, index) => (
      <div
        key={`${src}-${index}`}
        className="flex-shrink-0 w-[220px] h-[360px] rounded-3xl overflow-hidden border border-neutral-800"
      >
        <video
          src={src}
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover"
        />
      </div>
    ));

  return (
    <section className="py-12">
      <div ref={containerRef} className="overflow-hidden max-w-7xl mx-auto">
        <div
          ref={trackRef}
          className={`flex gap-6 ${shouldAnimate ? "animate-marquee w-max" : ""}`}
        >
          {renderVideos()}
          {shouldAnimate && renderVideos()}
        </div>
      </div>
    </section>
  );
}
