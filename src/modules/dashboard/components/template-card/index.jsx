"use client";

import { useRef } from "react";
import { Home, Building2, Star, Rocket, Lock, Zap, Eye } from "lucide-react";

const PLACEHOLDER_ICONS = {
  "Interior Shots":                Home,
  "Exterior & Facade":             Building2,
  "Luxury Amenities":              Star,
  "New Launch Promo":              Rocket,
  "Action-Packed Property Reveal": Zap,
  "Nosy Padosi Comedy Reel":       Eye,
};

const TAG_STYLES = {
  Popular: "bg-[#c7f038] text-black",
  New:     "bg-violet-500 text-white",
  Soon:    "bg-neutral-200 text-neutral-500",
};

export default function TemplateCard({ template, onClick }) {
  const videoRef = useRef(null);
  const PlaceholderIcon = PLACEHOLDER_ICONS[template.title] || Home;

  const isComingSoon = !!template.comingSoon;

  const handleClick = () => {
    if (isComingSoon) return;
    onClick?.();
  };

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => videoRef.current?.play()}
      onMouseLeave={() => {
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      }}
      disabled={isComingSoon}
      className={`group flex flex-col rounded-2xl border overflow-hidden bg-white text-left transition-all duration-300 ${
        isComingSoon
          ? "border-neutral-100 opacity-60 cursor-not-allowed"
          : "border-neutral-200 hover:border-neutral-400 hover:shadow-xl cursor-pointer"
      }`}
    >
      {/* MEDIA */}
      <div className="relative w-full" style={{ aspectRatio: "9/16" }}>
        {template.video ? (
          <video
            ref={videoRef}
            src={template.video}
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300 bg-neutral-900"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-linear-to-br from-neutral-100 to-neutral-200 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center">
              <PlaceholderIcon className="w-6 h-6 text-neutral-400" />
            </div>
            {template.description && (
              <p className="text-[10px] text-neutral-400 text-center px-3 leading-relaxed">
                {template.description}
              </p>
            )}
            {isComingSoon && (
              <div className="absolute inset-0 flex items-end justify-center pb-4">
                <div className="flex items-center gap-1 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <Lock className="w-3 h-3 text-neutral-400" />
                  <span className="text-[10px] font-semibold text-neutral-500">Coming Soon</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Play button for video templates */}
        {template.video && (
          <div className="absolute inset-0 flex items-center justify-center group-hover:opacity-0 transition-opacity duration-200">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}

        {/* TAG badge */}
        {template.tag && (
          <div className="absolute top-2 right-2">
            <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${TAG_STYLES[template.tag] || "bg-neutral-200 text-neutral-500"}`}>
              {template.tag}
            </span>
          </div>
        )}

        {/* TITLE over video */}
        {template.video && (
          <div className="absolute bottom-2 left-2 right-2">
            <h4 className="text-white text-xs font-semibold leading-snug whitespace-normal bg-black/40 backdrop-blur-md px-2 py-1 rounded-md">
              {template.title}
            </h4>
          </div>
        )}
      </div>

      {/* TITLE below for non-video placeholders */}
      {!template.video && (
        <div className="px-3 py-2 border-t border-neutral-100">
          <h4 className="text-xs font-semibold text-neutral-700 leading-snug">{template.title}</h4>
        </div>
      )}
    </button>
  );
}
