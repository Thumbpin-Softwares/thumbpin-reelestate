"use client";

import { useState } from "react";
import { Check, ChevronLeft, Eye, Loader2, Sparkles, X } from "lucide-react";
import { CAPTION_PRESETS } from "@/lib/remotion/caption-presets";
import { computeCaptionCreditCost } from "@/lib/credit-costs";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

// Preset preview clips are hosted on Cloudflare R2 — falls back to a plain
// label tile if a given preset's mp4 hasn't been uploaded yet.
function presetVideoUrl(preset) {
  return `https://content.thumbpin.in/captions/${preset.id}.mp4`;
}

// Static grid thumbnails sit at this timestamp instead of frame 0 — most
// presets open on the same plain background before captions kick in, so 0s
// looks identical across every tile.
const THUMBNAIL_FRAME_TIME = 2.5;

const LANGUAGES = [
  { code: "", label: "Auto-detect" },
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "en-IN", label: "English (India)" },
  { code: "es-ES", label: "Spanish (Spain)" },
  { code: "es-MX", label: "Spanish (Mexico)" },
  { code: "fr-FR", label: "French" },
  { code: "de-DE", label: "German" },
  { code: "it-IT", label: "Italian" },
  { code: "pt-BR", label: "Portuguese (Brazil)" },
  { code: "pt-PT", label: "Portuguese (Portugal)" },
  { code: "hi-IN", label: "Hindi", scriptRisk: true },
  { code: "ar-SA", label: "Arabic" },
  { code: "ru-RU", label: "Russian" },
  { code: "ja-JP", label: "Japanese", scriptRisk: true },
  { code: "ko-KR", label: "Korean", scriptRisk: true },
  { code: "zh-CN", label: "Chinese (Simplified)", scriptRisk: true },
  { code: "nl-NL", label: "Dutch" },
  { code: "tr-TR", label: "Turkish" },
  { code: "pl-PL", label: "Polish" },
  { code: "id-ID", label: "Indonesian" },
  { code: "vi-VN", label: "Vietnamese" },
  { code: "th-TH", label: "Thai", scriptRisk: true },
  { code: "sv-SE", label: "Swedish" },
];

// Target languages for VEED's translation_language param — used as a workaround
// when a source script (e.g. Devanagari, Thai) isn't supported for styled rendering.
const TRANSLATE_TO = [
  { code: "en-US", label: "English" },
  { code: "es-ES", label: "Spanish" },
  { code: "fr-FR", label: "French" },
  { code: "de-DE", label: "German" },
  { code: "pt-BR", label: "Portuguese (Brazil)" },
  { code: "pt-PT", label: "Portuguese (Portugal)" },
  { code: "it-IT", label: "Italian" },
  { code: "ar-SA", label: "Arabic" },
  { code: "ru-RU", label: "Russian" },
  { code: "nl-NL", label: "Dutch" },
  { code: "tr-TR", label: "Turkish" },
  { code: "pl-PL", label: "Polish" },
  { code: "id-ID", label: "Indonesian" },
  { code: "vi-VN", label: "Vietnamese" },
  { code: "sv-SE", label: "Swedish" },
];

const POSITIONS = [
  { value: "top",    label: "Top" },
  { value: "center", label: "Middle" },
  { value: "bottom", label: "Bottom" },
];

export function CaptionsPanel({ captionState, onGenerate, onReset, onDraftChange, reelDurationSeconds = 0 }) {
  const [view, setView] = useState("grid");
  const [selected, setSelected] = useState(null);
  const [language, setLanguage] = useState("");
  const [translateTo, setTranslateTo] = useState("en-US");
  const [position, setPosition] = useState("bottom");
  const [previewPreset, setPreviewPreset] = useState(null);

  const busy = captionState?.status === "rendering" || captionState?.status === "captioning";
  const appliedPreset = captionState?.status === "done" ? captionState.preset : null;

  const openPreset = (preset) => {
    setSelected(preset);
    setLanguage("");
    setTranslateTo("en-US");
    setPosition("bottom");
    setView("detail");
    onDraftChange?.({ presetLabel: preset.label, position: "bottom" });
  };

  const backToGrid = () => {
    setView("grid");
    onDraftChange?.(null);
  };

  const choosePosition = (value) => {
    setPosition(value);
    onDraftChange?.({ presetLabel: selected.label, position: value });
  };

  if (view === "detail" && selected) {
    const isAppliedHere = captionState?.status === "done" && captionState.preset === selected.id;
    const { credits: estimatedCredits } = computeCaptionCreditCost({
      durationSeconds: reelDurationSeconds,
      isDynamicPreset: selected.tier === "dynamic",
      hasTranslation: !!translateTo,
    });

    return (
      <div className="flex flex-col gap-3">
        <button
          onClick={backToGrid}
          disabled={busy}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          {selected.label}
        </button>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Text position</label>
          <div className="grid grid-cols-2 gap-2">
            {POSITIONS.map((p) => (
              <button
                key={p.value}
                disabled={busy}
                onClick={() => choosePosition(p.value)}
                className={`rounded-lg border py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                  position === p.value
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Source language</label>
          <select
            value={language}
            disabled={busy}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full rounded-lg border border-border/50 bg-white px-2 py-1.5 text-xs disabled:opacity-50"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Translate captions to</label>
          <select
            value={translateTo}
            disabled={busy}
            onChange={(e) => setTranslateTo(e.target.value)}
            className="w-full rounded-lg border border-border/50 bg-white px-2 py-1.5 text-xs disabled:opacity-50"
          >
            {TRANSLATE_TO.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => onGenerate(selected.id, language, translateTo, position)}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-linear-to-b from-black to-neutral-600 text-[#c7f038] py-2.5 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {captionState.message || "Working…"}
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              Add caption · {estimatedCredits} credit{estimatedCredits === 1 ? "" : "s"}
            </>
          )}
        </button>

        {busy && captionState.progress > 0 && (
          <div className="w-full h-1 rounded-full bg-neutral-200 overflow-hidden">
            <div
              className="h-full bg-[#c7f038] rounded-full transition-all duration-300"
              style={{ width: `${captionState.progress}%` }}
            />
          </div>
        )}

        {captionState?.status === "error" && (
          <p className="text-xs text-destructive">{captionState.error}</p>
        )}

        {isAppliedHere && (
          <div className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <Check className="w-3.5 h-3.5" />
              Added to timeline
            </span>
            <button onClick={onReset} className="text-xs text-muted-foreground hover:text-foreground">
              Remove
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Pick a caption style we will transcribe the reel and burn in styled captions.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {CAPTION_PRESETS.map((p) => (
          <div
            key={p.id}
            role="button"
            tabIndex={0}
            onClick={() => openPreset(p)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openPreset(p);
              }
            }}
            onMouseEnter={(e) => { e.currentTarget.querySelector("video")?.play().catch(() => {}); }}
            onMouseLeave={(e) => {
              const v = e.currentTarget.querySelector("video");
              if (v) { v.pause(); v.currentTime = THUMBNAIL_FRAME_TIME; }
            }}
            className={`group relative rounded-lg border p-1.5 text-[11px] font-medium text-center transition-colors cursor-pointer ${
              appliedPreset === p.id
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <div className="relative aspect-9/16 w-full rounded-md overflow-hidden bg-neutral-100 mb-1.5">
              <video
                src={presetVideoUrl(p)}
                className="w-full h-full object-cover"
                loop
                muted
                playsInline
                preload="metadata"
                onLoadedMetadata={(e) => { e.currentTarget.currentTime = THUMBNAIL_FRAME_TIME; }}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewPreset(p);
                }}
                className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Eye className="w-4 h-4 text-white" />
              </button>
              {p.tier === "dynamic" && (
                <span className="absolute top-1 right-1 text-[8px] font-semibold uppercase tracking-wide text-[#c7f038]">
                  HD
                </span>
              )}
            </div>

            {p.label}
            {appliedPreset === p.id && (
              <Check className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-emerald-500 text-white rounded-full p-0.5" />
            )}
          </div>
        ))}
      </div>

      <Dialog open={!!previewPreset} onOpenChange={(open) => !open && setPreviewPreset(null)}>
        <DialogContent
          showCloseButton={false}
          className="w-[240px] max-w-[240px] p-0 overflow-hidden gap-0"
        >
          {previewPreset && (
            <>
              <div className="relative w-full bg-black" style={{ aspectRatio: "9 / 16" }}>
                <video
                  src={presetVideoUrl(previewPreset)}
                  className="w-full h-full object-contain"
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
                <button
                  onClick={() => setPreviewPreset(null)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-3">
                <DialogTitle className="text-sm font-semibold">{previewPreset.label}</DialogTitle>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
