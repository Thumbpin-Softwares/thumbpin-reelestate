"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Video from "../../components/video-carousal";

const texts = ["Real Estate Ads", "Realistic Videos", "Idea to Video"];

export default function Hero() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % texts.length);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <main className="relative bg-[#f5efe8] pt-32 flex flex-col gap-2 items-center justify-center overflow-hidden">
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
      <div className="py-2 z-10 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={texts[current]}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="text-sm bg-neutral-200 px-6 py-1 border border-neutral-300 rounded-full text-black"
          >
            {texts[current]}
          </motion.div>
        </AnimatePresence>
      </div>

      <h1 className="text-[42px] z-10 w-4xl text-center tracking-wide font-bold">
        Create{" "}
        <span className="bg-[#c7f038] px-2 py-1 rounded text-black">
          Winning
        </span>{" "}
        Ads in Minutes.
      </h1>

      <p className="w-xl z-10 text-md text-center">
        In 15 minutes, we{"\'"}ll turn your product URL into live ads, clone a
        competitor creative, and show you what{"\'"}s winning in your niche.
      </p>

      <div className="pt-6 z-10 flex gap-2 items-center justify-center">
        <Link href="/auth/signup">
          <span className="text-black bg-[#c7f038] text-md px-6 py-4 hover:opacity-90 cursor-pointer rounded-lg shadow-sm font-bold">
            Get Started Now
          </span>
        </Link>

        <span className="text-xs z-10 text-neutral-400">
          No credit card · Free to start
        </span>
      </div>

      <div className="z-10">
        <Video />
      </div>
    </main>
  );
}
