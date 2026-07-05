"use client";

import { useRef, useState } from "react";
import {
  ChevronLeft,
  Sparkles,
  Image as ImageIcon,
  User2,
  FileText,
  Globe2,
  Mic,
  Play,
  Square,
  Gauge,
  Pencil,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LANGUAGES } from "@/utils/constants";
import { ELEVENLABS_VOICES } from "@/lib/elevenlabs-config";

/**
 * StepFinalize — Step 2 for the News Anchor pipeline.
 *
 * Cloned from seedance-reel/StepFinalize: a review screen between Script and
 * the actual generation. Shows everything collected in Step 0 (photos + avatar
 * shots) and Step 1 (script + voice), lets the user hear the chosen script in
 * the chosen voice, then kicks off generation only once they confirm.
 */
const QUALITY_OPTIONS = [
  { id: "auto", label: "Auto", description: "Balanced speed & quality" },
  { id: "720p", label: "720p", description: "Faster generation" },
  { id: "1080p", label: "1080p", description: "Sharpest, takes longer" },
];

export function StepFinalize({
  locationImages,
  selectedAvatars,
  scriptParams,
  script,
  onScriptChange,
  quality,
  onQualityChange,
  onBack,
  onGenerate,
}) {
  const { voiceId, language, tone, voiceSettings } = scriptParams || {};
  const [previewingVoice, setPreviewingVoice] = useState(false);
  const [isEditingScript, setIsEditingScript] = useState(false);
  const previewAudioRef = useRef(null);
  const previewAbortRef = useRef(null);

  const voice = ELEVENLABS_VOICES.find((v) => v.id === voiceId);
  const voiceLabel = voice?.label?.split(" (")[0] || voiceId;
  const languageLabel = LANGUAGES.find((l) => l.id === language)?.label || language;
  const avatarName = selectedAvatars?.[0]?.name;

  const stopPreviewVoice = () => {
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      URL.revokeObjectURL(previewAudioRef.current.src);
    }
    setPreviewingVoice(false);
  };

  const handlePreviewVoice = async () => {
    if (previewingVoice) return;
    setPreviewingVoice(true);
    const controller = new AbortController();
    previewAbortRef.current = controller;
    try {
      const res = await fetch("/api/veo-long-ad/preview-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          voiceId,
          voiceLabel,
          language,
          voiceSettings,
          text: script,
        }),
      });
      if (!res.ok) throw new Error("Preview failed");
      const blob = await res.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        URL.revokeObjectURL(previewAudioRef.current.src);
      }
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      audio.onended = () => setPreviewingVoice(false);
      audio.onerror = () => setPreviewingVoice(false);
      await audio.play();
    } catch (err) {
      if (err.name === "AbortError") return;
      toast.error("Could not preview script", { description: err.message });
      setPreviewingVoice(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold font-heading tracking-tight">Finalize Your Reel</h2>
        <p className="text-sm text-muted-foreground">
          Review everything below, then hit Generate.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* ── Property Photos ───────────────────────────────────────────── */}
        <div className="space-y-3 rounded-2xl border border-border/50 bg-card/40 p-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-[#c7f038]" />
            </div>
            <h3 className="text-sm font-semibold">Property Photos</h3>
            <span className="ml-auto text-xs font-medium text-neutral-500">
              {locationImages.length} photo{locationImages.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {locationImages.map((img, idx) => (
              <div key={idx} className="aspect-square rounded-xl overflow-hidden border border-border/30">
                <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>

        {/* ── Presenter / Avatar (all shots) ────────────────────────────── */}
        <div className="space-y-3 rounded-2xl border border-border/50 bg-card/40 p-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center">
              <User2 className="w-4 h-4 text-[#c7f038]" />
            </div>
            <h3 className="text-sm font-semibold">Presenter</h3>
            {avatarName && (
              <span className="ml-auto text-xs font-medium text-neutral-500 truncate max-w-[55%]">
                {avatarName}
              </span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {selectedAvatars.slice(0, 4).map((av, idx) => (
              <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-border/30">
                <img src={av.url} alt={`Shot ${idx + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Script + Voice ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/50 bg-card/40 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center">
            <FileText className="w-4 h-4 text-[#c7f038]" />
          </div>
          <h3 className="text-sm font-semibold">Script</h3>
          <button
            type="button"
            onClick={() => setIsEditingScript((prev) => !prev)}
            className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            {isEditingScript ? (
              <><Check className="w-3.5 h-3.5" /> Done</>
            ) : (
              <><Pencil className="w-3.5 h-3.5" /> Edit Dialogues</>
            )}
          </button>
        </div>

        {isEditingScript ? (
          <textarea
            value={script}
            onChange={(e) => onScriptChange(e.target.value)}
            rows={8}
            className="w-full text-sm leading-relaxed text-neutral-700 bg-white rounded-2xl border border-[#c7f038] p-4 resize-none focus:outline-none focus:ring-2 focus:ring-[#c7f038]/40"
          />
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-neutral-700 bg-white rounded-2xl border border-border/40 p-4 max-h-56 overflow-y-auto">
            {script}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500">
          <span className="flex items-center gap-1.5">
            <Globe2 className="w-3.5 h-3.5" /> {languageLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5" /> {voiceLabel}
          </span>
          {tone && (
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> {tone}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={previewingVoice ? stopPreviewVoice : handlePreviewVoice}
          className="w-full sm:w-auto flex items-center justify-center gap-2 text-xs font-medium rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 py-2 px-4 text-neutral-700 transition-colors"
        >
          {previewingVoice ? (
            <><Square className="w-3.5 h-3.5" /> Stop</>
          ) : (
            <><Play className="w-3.5 h-3.5" /> Hear Script in {voiceLabel} Voice</>
          )}
        </button>
      </div>

      {/* ── Video Quality ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/50 bg-card/40 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center">
            <Gauge className="w-4 h-4 text-[#c7f038]" />
          </div>
          <h3 className="text-sm font-semibold">Video Quality</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {QUALITY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onQualityChange(opt.id)}
              className={`rounded-xl border-2 p-3 text-left transition-all ${
                quality === opt.id
                  ? "border-[#c7f038] bg-[#c7f038]/10"
                  : "border-border/40 hover:border-[#c7f038]/60"
              }`}
            >
              <p className="text-sm font-semibold">{opt.label}</p>
              <p className="text-[11px] text-neutral-500">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack} className="gap-2 text-muted-foreground">
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
        <Button
          onClick={onGenerate}
          className="bg-neutral-900 text-[#c7f038] hover:opacity-90 hover:bg-neutral-900 shadow-lg gap-2 px-6"
        >
          <Sparkles className="w-4 h-4" />
          Generate
        </Button>
      </div>
    </div>
  );
}
