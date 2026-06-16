"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Video from "../../components/video-carousal";

const texts = ["Real Estate Ads", "Realistic Videos", "Idea to Video"];

export default function Hero({ videos = [] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % texts.length);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <main className="relative bg-[#f5efe8] pt-24 md:pt-32 overflow-hidden">
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(to right, #d4d4d4 1px, transparent 1px),
            linear-gradient(to bottom, #d4d4d4 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 flex flex-col items-center px-4 sm:px-6">
        {/* Rotating Badge */}
        <div className="overflow-hidden py-6 sm:py-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={texts[current]}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="text-xs sm:text-sm bg-neutral-200 px-4 sm:px-6 py-1 border border-neutral-300 rounded-full text-black"
            >
              {texts[current]}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Heading */}
        <h1 className="max-w-5xl text-center tracking-wide font-bold leading-tight text-4xl sm:text-5xl lg:text-6xl">
          Create{" "}
          <span className="bg-[#c7f038] italic px-2 py-1 rounded text-black">
            Winning
          </span>{" "}
          Ads in Minutes.
        </h1>

        {/* Description */}
        <p className="max-w-xl text-center text-sm sm:text-base text-neutral-700 mt-4">
          In 15 minutes, we{"\'"}ll turn your real estate idea into social media ads,
          clone a competitor creative, and show you what{"\'"}s winning in your niche.
        </p>

        {/* CTA */}
        <div className="pt-6 flex flex-col sm:flex-row gap-3 sm:gap-4 items-center justify-center">
          <Link href="/auth/signup">
            <span className="inline-flex items-center justify-center text-black bg-[#c7f038] px-6 py-4 hover:opacity-90 rounded-lg shadow-sm font-bold">
              Get Started Now
            </span>
          </Link>

          <span className="text-xs text-neutral-500 text-center">
            No credit card · Free to start
          </span>
        </div>

        {/* Videos */}
        <div className="w-full mt-10">
          <Video initialVideos={videos} />
        </div>
      </div>
    </main>
  );
}