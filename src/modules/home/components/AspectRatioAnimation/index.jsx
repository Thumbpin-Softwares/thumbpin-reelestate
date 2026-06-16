"use client";

import { motion } from "framer-motion";

export default function AspectRatioAnimation() {
  return (
    <div className="flex py-4">
      <div className="relative w-35 aspect-9/16 rounded-3xl bg-neutral-100 border-2 border-neutral-800 overflow-hidden">
        <motion.div
          animate={{
            y: [0, -40, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute inset-3 flex flex-col gap-3"
        >
          <div className="h-24 rounded-xl bg-[#c7f038] shrink-0" />
          <div className="h-12 rounded-lg bg-neutral-400 shrink-0" />
          <div className="h-12 rounded-lg bg-neutral-400 shrink-0" />
          <div className="h-24 rounded-xl bg-neutral-400 shrink-0" />
          <div className="h-12 rounded-lg bg-neutral-400 shrink-0" />
        </motion.div>

        <div className="absolute top-3 right-3 bg-[#c7f038] text-black text-[10px] font-bold px-2 py-1 rounded-full z-10">
          9:16
        </div>
      </div>
    </div>
  );
}