"use client";

import { Check } from "lucide-react";
import { motion } from "framer-motion";

const languages = [
  "Hindi",
  "English",
  "Hinglish",
  "Tamil",
  "Many More",
];

const container = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.25,
    },
  },
};

const item = {
  hidden: {
    opacity: 0,
    x: 80,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
    },
  },
};

export default function LanguagesAnimation() {
  return (
    <motion.div
  variants={container}
  initial="hidden"
  animate="visible"
  className="max-w-xl flex flex-col gap-2 py-6"
>
      {languages.map((language) => (
        <motion.div
          key={language}
          variants={item}
          className="flex items-center justify-start gap-2 bg-white px-6 py-2"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#c7f038]">
            <Check size={12} strokeWidth={3} />
          </div>

          <span className="text-xs font-medium">
            {language}
          </span>
        </motion.div>
      ))}
    </motion.div>
  );
}