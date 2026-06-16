"use client";

import { motion } from "framer-motion";
import { useState, useRef } from "react";
import {
  Wand2,
  FileText,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  RefreshCcw,
  Sparkles,
  Globe2,
  Mic,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LANGUAGES } from "@/utils/constants";

const MIN_SCRIPT_WORDS = 20;
const MAX_SCRIPT_WORDS = 300;

const ELEVENLABS_VOICES = [
  { id: "dVTC43Yewy5fAIcmsISI", label: "Anvi (Female)" },
  { id: "K2Byg54sHB1oHegvENtI", label: "Kanika (Female)" },
  { id: "XB0fDUnXU5powFXDhCwa", label: "Charlotte (Female)" },
  { id: "pMsXgVXv3BLzUgSXRplE", label: "Serena (Female)" },
  { id: "DdD5pVl1QDeeI6MMtYbk", label: "Abhay (Male)" },
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George (Male)" },
  { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel (Male)" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam (Male)" },
];

/**
 * StepScript — Step 1 for the Seedance Reel pipeline.
 *
 * Simplified from veo-long-ad/StepScript:
 * - Keeps: manual paste + AI Q&A form, language selector, voice selector + preview
 * - Removed: tone selector, LLM model selector, beat planning / chunk visualization
 * - Output: { script, voiceId, language } passed directly to GenerationProgress
 */
export function StepScript({ onBack, onGenerate }) {
  const [mode, setMode] = useState("manual");
  const [language, setLanguage] = useState("english");
  const [elevenLabsVoice, setElevenLabsVoice] = useState(ELEVENLABS_VOICES[0].id);
  const [previewingVoice, setPreviewingVoice] = useState(false);
  const previewAudioRef = useRef(null);

  const [manualScript, setManualScript] = useState("");

  const [qaAnswers, setQaAnswers] = useState({
    propertyName: "",
    location: "",
    type: "",
    size: "",
    price: "",
    usps: "",
    cta: "Book a site visit today!",
  });
  const [generatingScript, setGeneratingScript] = useState(false);
  const [aiGeneratedScript, setAiGeneratedScript] = useState("");
  const [scriptWordCount, setScriptWordCount] = useState(0);
  const [scriptEstDuration, setScriptEstDuration] = useState(0);

  const activeScript = mode === "manual" ? manualScript : aiGeneratedScript;
  const wordCount = activeScript.trim().split(/\s+/).filter(Boolean).length;
  const isScriptReady = wordCount >= MIN_SCRIPT_WORDS && wordCount <= MAX_SCRIPT_WORDS;

  const handlePreviewVoice = async () => {
    if (previewingVoice) return;
    setPreviewingVoice(true);
    try {
      const voice = ELEVENLABS_VOICES.find((v) => v.id === elevenLabsVoice);
      const res = await fetch("/api/veo-long-ad/preview-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceId: elevenLabsVoice,
          voiceLabel: voice?.label?.split(" (")[0],
          language,
        }),
      });
      if (!res.ok) throw new Error("Preview failed");
      const blob = await res.blob();
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
      toast.error("Could not preview voice", { description: err.message });
      setPreviewingVoice(false);
    }
  };

  const handleGenerateAiScript = async () => {
    if (!qaAnswers.propertyName || !qaAnswers.location) {
      return toast.error("Property name and location are required.");
    }
    setGeneratingScript(true);
    try {
      const res = await fetch("/api/veo-long-ad/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyName: qaAnswers.propertyName,
          location: qaAnswers.location,
          type: qaAnswers.type,
          size: qaAnswers.size,
          price: qaAnswers.price,
          usps: qaAnswers.usps.split("\n").map((s) => s.trim()).filter(Boolean),
          cta: qaAnswers.cta,
          language,
          tone: "luxury",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Script generation failed");
      setAiGeneratedScript(data.script || "");
      setScriptWordCount(data.wordCount || 0);
      setScriptEstDuration(data.estimatedDuration || 0);
      toast.success(`Script ready — ${data.wordCount} words · ~${data.estimatedDuration}s`);
    } catch (err) {
      toast.error("Script generation failed", { description: err.message });
    } finally {
      setGeneratingScript(false);
    }
  };

  const handleGenerate = () => {
    if (!isScriptReady) return;
    onGenerate({ script: activeScript.trim(), voiceId: elevenLabsVoice, language });
  };

  const ChevronDown = () => (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold font-heading tracking-tight">Script</h2>
        <p className="text-sm text-muted-foreground">
          Paste your property script or let AI write one. The pipeline will split it automatically.
        </p>
      </div>

      {/* Language, Voice row + mode toggle */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-3 flex-wrap">
          {/* Language */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-500 flex items-center gap-1.5">
              <Globe2 className="w-3.5 h-3.5" />
              Language
            </label>
            <div className="relative">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-40 appearance-none text-sm rounded-xl border border-neutral-200 bg-white px-3 py-2 pr-10 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#c7f038]/40 focus:border-[#c7f038]"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
                <ChevronDown />
              </div>
            </div>
          </div>

          {/* Voice */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-500 flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5" />
              Voice
            </label>
            <div className="flex gap-1.5">
              <div className="relative">
                <select
                  value={elevenLabsVoice}
                  onChange={(e) => { setElevenLabsVoice(e.target.value); setPreviewingVoice(false); }}
                  className="w-44 appearance-none text-sm rounded-xl border border-neutral-200 bg-white px-3 py-2 pr-10 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#c7f038]/40 focus:border-[#c7f038]"
                >
                  {ELEVENLABS_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
                  <ChevronDown />
                </div>
              </div>
              <button
                type="button"
                onClick={handlePreviewVoice}
                disabled={previewingVoice}
                title="Preview this voice"
                className="shrink-0 flex items-center justify-center w-9 h-9 rounded-xl border border-neutral-200 bg-white shadow-sm text-neutral-500 hover:text-[#c7f038] hover:border-[#c7f038] disabled:opacity-50 transition-colors"
              >
                {previewingVoice
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Play className="w-3.5 h-3.5 ml-0.5" />
                }
              </button>
            </div>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="relative inline-flex rounded-full bg-neutral-100 p-1">
          {mode === "manual" && (
            <motion.div
              layoutId="sreel-active-pill"
              className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-white shadow-sm"
            />
          )}
          {mode === "ai" && (
            <motion.div
              layoutId="sreel-active-pill"
              className="absolute inset-y-1 right-1 w-[calc(50%-4px)] rounded-full bg-[#c7f038] shadow-sm"
            />
          )}
          <button
            onClick={() => setMode("manual")}
            className="relative z-10 flex items-center gap-2 px-5 py-2 text-sm font-medium"
          >
            <FileText className="h-4 w-4" />
            Paste Script
          </button>
          <button
            onClick={() => setMode("ai")}
            className="relative z-10 flex items-center gap-2 px-5 py-2 text-sm font-medium"
          >
            <Wand2 className="h-4 w-4" />
            AI Write Script
          </button>
        </div>
      </div>

      {/* ── Manual Mode ─────────────────────────────────────────────────────── */}
      {mode === "manual" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Property Script</label>
            <span className={`text-xs font-medium ${
              wordCount > MAX_SCRIPT_WORDS
                ? "text-destructive"
                : wordCount >= MIN_SCRIPT_WORDS
                ? "text-emerald-500"
                : "text-neutral-500"
            }`}>
              {wordCount} / {MAX_SCRIPT_WORDS} words
            </span>
          </div>
          <textarea
            value={manualScript}
            onChange={(e) => setManualScript(e.target.value)}
            placeholder={`Paste your full property script here…\n\nThe pipeline will automatically split it:\n• Part 1 (~15s) → Avatar presenter speaks to camera\n• Part 2 (rest) → B-roll footage with voiceover`}
            rows={12}
            className="w-full text-sm border border-border/60 rounded-3xl bg-background px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#c7f038] leading-relaxed placeholder:text-muted-foreground/50"
          />
          {wordCount > MAX_SCRIPT_WORDS && (
            <p className="text-[11px] text-destructive">
              Script is too long. Maximum {MAX_SCRIPT_WORDS} words. Please trim it down.
            </p>
          )}
        </div>
      )}

      {/* ── AI Mode ─────────────────────────────────────────────────────────── */}
      {mode === "ai" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Property Details
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "propertyName", label: "Property Name *", placeholder: "e.g. M3M Opus" },
                { key: "location", label: "Location *", placeholder: "e.g. Sector 67, Gurugram" },
                { key: "type", label: "Type", placeholder: "e.g. 3 BHK Luxury Apartment" },
                { key: "size", label: "Size", placeholder: "e.g. 2400–3200 sq ft" },
                { key: "price", label: "Price", placeholder: "e.g. ₹7 Cr onwards" },
                { key: "cta", label: "Call-to-Action", placeholder: "e.g. Book a site visit today!" },
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-xs font-medium">{label}</label>
                  <input
                    value={qaAnswers[key]}
                    onChange={(e) => setQaAnswers((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full text-sm border border-border/60 rounded-xl bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">
                Key USPs / Features <span className="text-muted-foreground">(one per line)</span>
              </label>
              <textarea
                value={qaAnswers.usps}
                onChange={(e) => setQaAnswers((prev) => ({ ...prev, usps: e.target.value }))}
                placeholder={"270-degree views of Aravalli Hills\nSingaporean-style boutique luxury\n100+ world-class amenities\nGolf Course Extension Road connectivity"}
                rows={4}
                className="w-full text-sm border border-border/60 rounded-2xl bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
              />
            </div>
            <Button
              onClick={handleGenerateAiScript}
              disabled={!qaAnswers.propertyName || !qaAnswers.location || generatingScript}
              className="w-full gradient-bg text-white hover:opacity-90 disabled:opacity-40 gap-2"
            >
              {generatingScript ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Writing script with AI…</>
              ) : (
                <><Wand2 className="w-4 h-4" /> Generate Script with AI</>
              )}
            </Button>
          </div>

          {aiGeneratedScript && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Script generated — {scriptWordCount} words · ~{scriptEstDuration}s
                </div>
                <button
                  onClick={handleGenerateAiScript}
                  disabled={generatingScript}
                  className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <RefreshCcw className="w-3 h-3" />
                  Regenerate
                </button>
              </div>
              <textarea
                value={aiGeneratedScript}
                onChange={(e) => setAiGeneratedScript(e.target.value)}
                rows={10}
                className="w-full text-sm border border-border/60 rounded-2xl bg-background px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 leading-relaxed"
              />
              <p className="text-[11px] text-muted-foreground">
                You can edit the script above before generating.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Pipeline info */}
      {isScriptReady && (
        <div className="rounded-xl border border-[#c7f038]/30 bg-[#c7f038]/5 p-3 flex gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#c7f038] shrink-0 mt-0.5" />
          <p className="text-[11px] text-neutral-700 leading-relaxed">
            <strong>Seedance Reel pipeline:</strong> The script will be automatically split — the first ~15 seconds become the avatar talking section (generated by Seedance 2.0 with your identity images), and the rest plays as ElevenLabs voiceover behind property B-roll clips.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack} className="gap-2 text-muted-foreground">
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
        <Button
          onClick={handleGenerate}
          disabled={!isScriptReady}
          className="gradient-bg text-white hover:opacity-90 disabled:opacity-40 shadow-lg gap-2 px-6"
        >
          <Sparkles className="w-4 h-4" />
          Generate Seedance Reel
        </Button>
      </div>
    </div>
  );
}

