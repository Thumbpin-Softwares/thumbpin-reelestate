"use client";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState, useId } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";

export default function Collapsible({ question, answer }) {
  const [open, setOpen] = useState(false);
  const generatedId = useId();
  const idRef = useRef(generatedId);
  const iconRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (e.detail !== idRef.current) setOpen(false);
    };
    window.addEventListener("thumbpin-collapse", handler);
    return () => window.removeEventListener("thumbpin-collapse", handler);
  }, []);

  useEffect(() => {
    gsap.to(iconRef.current, {
      rotate: open ? 45 : 0,
      duration: 0.25,
      ease: "power2.out",
    });
  }, [open]);

  const toggle = () => {
    const next = !open;
    if (next) {
      window.dispatchEvent(new CustomEvent("thumbpin-collapse", { detail: idRef.current }));
    }
    setOpen(next);
  };

  return (
    <main className="bg-neutral-100 max-w-4xl ring-2 ring-neutral-200 drop-shadow-sm p-4 rounded-xl">
      <button type="button" onClick={toggle} className="w-full flex items-center justify-between text-left">
        <span className="text-xl font-semibold tracking-tight">{question}</span>
        <div ref={iconRef} className="p-2 bg-black rounded-full">
          <Plus size={16} color="white" />
        </div>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <div className="pt-4 text-neutral-600">{answer}</div>
      </motion.div>
    </main>
  );
}