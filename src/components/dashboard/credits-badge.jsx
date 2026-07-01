"use client";
import { CreditCard } from "lucide-react";
import { useUser } from "@/hooks/use-user";

const METALLIC_BG = "linear-gradient(180deg, #2c2c30 0%, #17171a 45%, #050506 100%)";

export function CreditsBadge() {
  const { credits, loading } = useUser();

  if (loading) {
    return (
      <div
        className="flex items-center gap-2 px-3.5 py-2 rounded-full border border-white/10 animate-pulse"
        style={{ background: METALLIC_BG }}
      >
        <div className="w-4 h-4 bg-white/10 rounded-full" />
        <div className="w-16 h-3 bg-white/10 rounded" />
      </div>
    );
  }

  const isLow = credits <= 5;
  const isMedium = !isLow && credits <= 10;

  const tone = isLow
    ? { text: "text-red-400", border: "border-red-500/40", glow: "", pulse: "animate-pulse" }
    : isMedium
    ? { text: "text-amber-300", border: "border-amber-400/30", glow: "", pulse: "" }
    : { text: "text-[#c7f038]", border: "border-[#c7f038]/30", glow: "", pulse: "" };

  return (
    <div
      className={`relative flex items-center gap-2 px-3.5 py-2 rounded-full border overflow-hidden ${tone.border} ${tone.glow} ${tone.pulse}`}
      style={{ background: METALLIC_BG }}
    >
      {/* brushed-metal sheen */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-white/15 to-transparent" />
      <CreditCard
        className={`relative w-4 h-4 ${tone.text}`}
        style={{ filter: "drop-shadow(0 0 6px currentColor)" }}
      />
      <span
        className={`relative text-sm font-semibold tracking-wide ${tone.text}`}
        style={{ textShadow: "0 0 8px currentColor" }}
      >
        {credits} Credits
      </span>
    </div>
  );
}
