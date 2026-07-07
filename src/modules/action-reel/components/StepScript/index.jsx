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
  Square,
  Upload,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LANGUAGES } from "@/utils/constants";
import { ELEVENLABS_VOICES } from "@/lib/elevenlabs-config";
import { SARVAM_VOICES } from "@/lib/sarvam-config";
import { useUser } from "@/hooks/use-user";
import { canAffordAction } from "@/lib/credit-costs";

// Combined voice catalog across providers — the provider is an internal
// routing detail (see lib/voice-tts.js), never surfaced in this dropdown.
const ALL_VOICES = [...ELEVENLABS_VOICES, ...SARVAM_VOICES];

const PIPELINE_CREDIT_ACTION = "action_reel_video";

const MIN_SCRIPT_WORDS = 20;
const MAX_SCRIPT_WORDS = 300;

const TONE_OPTIONS = [
  { id: "luxury", label: "Luxury", description: "Ultra-premium, aspirational, exclusive" },
  { id: "professional", label: "Professional", description: "Confident, credible, trust-building" },
  { id: "energetic", label: "Energetic", description: "Fast-paced, exciting, hype energy" },
  { id: "casual", label: "Casual", description: "Friendly, conversational, relatable" },
  { id: "storytelling", label: "Storytelling", description: "Narrative-driven, emotional, lifestyle-focused" },
  { id: "urgent", label: "Urgent", description: "FOMO-heavy, limited inventory, act-now" },
  { id: "aspirational", label: "Aspirational", description: "Dream-home feeling, lifestyle upgrade" },
];

const ChevronDown = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
    <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * StepScript — Step 1 for the Action Reel pipeline.
 *
 * Layout matches seedance-reel/StepScript (script left, Language/Voice/
 * "Add Your Own" sidebar right), plus action-reel-specific additions kept
 * from the previous single-row layout:
 * - Tone selector (seedance-reel has none — tone is fixed "luxury" there)
 * - A pronunciation-preview button on the script textarea itself, distinct
 *   from the sidebar's per-voice sample preview — this one synthesizes the
 *   user's ACTUAL typed text so they can catch mispronunciations before submitting.
 *
 * "Add Your Own" (record/upload) mirrors seedance-reel's implementation:
 * captured locally for preview only — not yet wired into generation.
 */
export function StepScript({ onBack, onGenerate }) {
  const { profile } = useUser();
  const affordability = canAffordAction({ profile, action: PIPELINE_CREDIT_ACTION });
  const [mode, setMode] = useState("manual");
  const [language, setLanguage] = useState("english");
  const [elevenLabsVoice, setElevenLabsVoice] = useState(ALL_VOICES[0].id);
  const [previewingVoice, setPreviewingVoice] = useState(false);
  const [previewingScript, setPreviewingScript] = useState(false);
  const previewAudioRef = useRef(null);
  const scriptPreviewAudioRef = useRef(null);

  // Custom voice (record or upload) — when present, this file is uploaded and
  // sent directly to Seedance as the reference audio for both parts, instead
  // of the prebuilt voice above (see GenerationProgress/generate-pipeline).
  const [customVoiceTab, setCustomVoiceTab] = useState("record");
  const [isRecording, setIsRecording] = useState(false);
  const [customVoiceUrl, setCustomVoiceUrl] = useState(null);
  const [customVoiceName, setCustomVoiceName] = useState(null);
  const [customVoiceFile, setCustomVoiceFile] = useState(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const fileInputRef = useRef(null);

  const clearCustomVoice = () => {
    if (customVoiceUrl) URL.revokeObjectURL(customVoiceUrl);
    setCustomVoiceUrl(null);
    setCustomVoiceName(null);
    setCustomVoiceFile(null);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        clearCustomVoice();
        setCustomVoiceUrl(URL.createObjectURL(blob));
        setCustomVoiceName("Recorded voice");
        setCustomVoiceFile(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      toast.error("Could not access microphone", { description: err.message });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleUploadVoice = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    clearCustomVoice();
    setCustomVoiceUrl(URL.createObjectURL(file));
    setCustomVoiceName(file.name);
    setCustomVoiceFile(file);
  };

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
  const [tone, setTone] = useState("luxury");
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
      const voice = ALL_VOICES.find((v) => v.id === elevenLabsVoice);
      const res = await fetch("/api/veo-long-ad/preview-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceId: elevenLabsVoice,
          voiceLabel: voice?.label?.split(" (")[0],
          language,
          action: "action_reel_video",
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || errBody.error || "Preview failed");
      }
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

  const handlePreviewScript = async () => {
    if (previewingScript) return;
    const text = activeScript.trim();
    if (!text) {
      toast.error("Write or paste a script first.");
      return;
    }
    setPreviewingScript(true);
    try {
      const res = await fetch("/api/action-reel/preview-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId: elevenLabsVoice, language }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || errBody.error || "Preview failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (scriptPreviewAudioRef.current) {
        scriptPreviewAudioRef.current.pause();
        URL.revokeObjectURL(scriptPreviewAudioRef.current.src);
      }
      const audio = new Audio(url);
      scriptPreviewAudioRef.current = audio;
      audio.onended = () => setPreviewingScript(false);
      audio.onerror = () => setPreviewingScript(false);
      await audio.play();
    } catch (err) {
      toast.error("Could not preview script", { description: err.message });
      setPreviewingScript(false);
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
          tone,
          action: "action_reel_video",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Script generation failed");
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
    onGenerate({ script: activeScript.trim(), voiceId: elevenLabsVoice, language, tone, customVoiceFile });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold font-heading tracking-tight">Script</h2>
        <p className="text-sm text-muted-foreground">
          Paste your property script or let AI write one. The pipeline will split it automatically.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex justify-center">
        <div className="relative inline-flex rounded-full bg-neutral-100 p-1">
          {mode === "manual" && (
            <motion.div
              layoutId="areel-active-pill"
              className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-white shadow-sm"
            />
          )}
          {mode === "ai" && (
            <motion.div
              layoutId="areel-active-pill"
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

      {/* ── Script (left) + Language/Voice/Tone (right) ─────────────────────── */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          {/* ── Manual Mode ───────────────────────────────────────────────── */}
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
              <div className="relative">
                <textarea
                  value={manualScript}
                  onChange={(e) => setManualScript(e.target.value)}
                  placeholder={`Paste your full property script here…\n\nThe pipeline will automatically split it:\n• Part 1 (~15s) → Hook, presenter speaks to camera\n• Part 2 (~15s) → Highlights + CTA, presenter speaks to camera`}
                  rows={14}
                  className="w-full text-sm border border-border/60 rounded-3xl bg-background px-4 py-3 pr-12 resize-none focus:outline-none focus:ring-2 focus:ring-[#c7f038] leading-relaxed placeholder:text-muted-foreground/50"
                />
                <button
                  type="button"
                  onClick={handlePreviewScript}
                  disabled={previewingScript || !activeScript.trim()}
                  title="Hear how this exact script will sound"
                  className="absolute top-3 right-3 flex items-center justify-center w-8 h-8 rounded-full bg-neutral-900 text-[#c7f038] shadow disabled:opacity-40 transition-opacity"
                >
                  {previewingScript
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Play className="w-3.5 h-3.5 ml-0.5" />
                  }
                </button>
              </div>
              {wordCount > MAX_SCRIPT_WORDS && (
                <p className="text-[11px] text-destructive">
                  Script is too long. Maximum {MAX_SCRIPT_WORDS} words. Please trim it down.
                </p>
              )}
            </div>
          )}

          {/* ── AI Mode ───────────────────────────────────────────────────── */}
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block w-full">
                      <Button
                        onClick={handleGenerateAiScript}
                        disabled={!qaAnswers.propertyName || !qaAnswers.location || generatingScript || !affordability.ok}
                        className="w-full gradient-bg text-white hover:opacity-90 disabled:opacity-40 gap-2"
                      >
                        {generatingScript ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Writing script with AI…</>
                        ) : (
                          <><Wand2 className="w-4 h-4" /> Generate Script with AI</>
                        )}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!affordability.ok && (
                    <TooltipContent>
                      Not enough credits — need {affordability.required}, you have {affordability.credits}.
                    </TooltipContent>
                  )}
                </Tooltip>
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
                  <div className="relative">
                    <textarea
                      value={aiGeneratedScript}
                      onChange={(e) => setAiGeneratedScript(e.target.value)}
                      rows={10}
                      className="w-full text-sm border border-border/60 rounded-2xl bg-background px-4 py-3 pr-12 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 leading-relaxed"
                    />
                    <button
                      type="button"
                      onClick={handlePreviewScript}
                      disabled={previewingScript || !activeScript.trim()}
                      title="Hear how this exact script will sound"
                      className="absolute top-3 right-3 flex items-center justify-center w-8 h-8 rounded-full bg-neutral-900 text-[#c7f038] shadow disabled:opacity-40 transition-opacity"
                    >
                      {previewingScript
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Play className="w-3.5 h-3.5 ml-0.5" />
                      }
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    You can edit the script above before generating.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Language / Voice / Tone / Add Your Own ──────────────────────── */}
        <div className="space-y-4 p-4 h-fit">
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
                className="w-full appearance-none text-sm rounded-xl border border-neutral-200 bg-white px-3 py-2 pr-10 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#c7f038]/40 focus:border-[#c7f038]"
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

          {/* Tone — applies to both AI-written and pasted scripts (affects delivery/punctuation, not the words) */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-500 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Tone
            </label>
            <div className="relative">
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full appearance-none text-sm rounded-xl border border-neutral-200 bg-white px-3 py-2 pr-10 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#c7f038]/40 focus:border-[#c7f038]"
              >
                {TONE_OPTIONS.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
                <ChevronDown />
              </div>
            </div>
          </div>

          {/* Voice */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-500 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5" />
                Choose Prebuilt Voice
              </label>
              <div className="relative">
                <select
                  value={elevenLabsVoice}
                  onChange={(e) => { setElevenLabsVoice(e.target.value); setPreviewingVoice(false); }}
                  className="w-full appearance-none text-sm rounded-xl border border-neutral-200 bg-white px-3 py-2 pr-10 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#c7f038]/40 focus:border-[#c7f038]"
                >
                  {ALL_VOICES.map((v) => (
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
                className="w-full flex items-center justify-center gap-2 text-xs font-medium rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 py-2 text-neutral-700 transition-colors disabled:opacity-50"
              >
                {previewingVoice
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Previewing…</>
                  : <><Play className="w-3.5 h-3.5" /> Preview Voice</>
                }
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-500">Add Your Own</label>
              <p className="text-[10px] text-neutral-400 -mt-1">
                If you record or upload a voice, it&apos;s used instead of the prebuilt voice above.
              </p>

              <div className="rounded-xl border border-neutral-200 bg-white p-3 space-y-3">
                <div className="relative inline-flex rounded-full bg-neutral-100 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setCustomVoiceTab("record")}
                    className={`relative z-10 px-3 py-1.5 rounded-full font-medium transition-colors ${
                      customVoiceTab === "record" ? "bg-white shadow-sm" : "text-neutral-500"
                    }`}
                  >
                    Record
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomVoiceTab("upload")}
                    className={`relative z-10 px-3 py-1.5 rounded-full font-medium transition-colors ${
                      customVoiceTab === "upload" ? "bg-white shadow-sm" : "text-neutral-500"
                    }`}
                  >
                    Upload
                  </button>
                </div>

                {customVoiceTab === "record" ? (
                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`w-full flex items-center justify-center gap-2 text-xs font-medium rounded-lg border py-2 transition-colors ${
                      isRecording
                        ? "border-red-200 bg-red-50 text-red-600 animate-pulse"
                        : "border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700"
                    }`}
                  >
                    {isRecording
                      ? <><Square className="w-3.5 h-3.5" /> Stop Recording</>
                      : <><Mic className="w-3.5 h-3.5" /> Record Your Voice</>
                    }
                  </button>
                ) : (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={handleUploadVoice}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 text-xs font-medium rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 py-2 text-neutral-700 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload a Recording
                    </button>
                  </>
                )}

                {customVoiceUrl && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-neutral-500 truncate">{customVoiceName}</p>
                    <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2">
                      <audio src={customVoiceUrl} controls className="h-8 flex-1" />
                      <button
                        type="button"
                        onClick={clearCustomVoice}
                        className="text-neutral-400 hover:text-red-500 shrink-0"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline info */}
      {isScriptReady && (
        <div className="rounded-xl border border-[#c7f038]/30 bg-[#c7f038]/5 p-3 flex gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#c7f038] shrink-0 mt-0.5" />
          <p className="text-[11px] text-neutral-700 leading-relaxed">
            <strong>Action Reel pipeline:</strong> The script will be split into 2 parts — Part 1 (hook) and Part 2 (highlights + CTA), each rendered as its own full ~15s high-energy scene with your dialogue baked in.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack} className="gap-2 text-muted-foreground">
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block">
              <Button
                onClick={handleGenerate}
                disabled={!isScriptReady || !affordability.ok}
                className="gradient-bg text-white hover:opacity-90 disabled:opacity-40 shadow-lg gap-2 px-6"
              >
                <Sparkles className="w-4 h-4" />
                Generate Action Reel
              </Button>
            </span>
          </TooltipTrigger>
          {!affordability.ok && (
            <TooltipContent>
              Not enough credits — need {affordability.required}, you have {affordability.credits}.
            </TooltipContent>
          )}
        </Tooltip>
      </div>
    </div>
  );
}
