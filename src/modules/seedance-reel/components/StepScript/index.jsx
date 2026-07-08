"use client";

import { motion } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import {
  Wand2,
  FileText,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  RefreshCcw,
  Globe2,
  Mic,
  Play,
  Square,
  Upload,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LANGUAGES } from "@/utils/constants";
import { ELEVENLABS_VOICES, ELEVENLABS_VOICE_SETTINGS } from "@/lib/elevenlabs-config";
import { PROPERTY_TYPE_GROUPS, getPropertyType, DEFAULT_PROPERTY_TYPE } from "@/lib/property-types";

const MIN_SCRIPT_WORDS = 20;
const MAX_SCRIPT_WORDS = 300;

export const SCRIPT_DRAFT_KEY = "seedance_script_draft";

function loadScriptDraft() {
  try {
    const raw = sessionStorage.getItem(SCRIPT_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

const ChevronDown = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
    <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * StepScript — Step 1 for the Seedance Reel pipeline.
 *
 * Simplified from veo-long-ad/StepScript:
 * - Keeps: manual paste + AI Q&A form, language selector, voice selector + preview
 * - Removed: tone selector, LLM model selector, beat planning / chunk visualization
 * - Output: { script, voiceId, language } passed directly to GenerationProgress
 */
export function StepScript({ onBack, onGenerate }) {
  // Read once on mount so a page refresh mid-edit doesn't lose the script,
  // voice choice, or AI-form answers (Step 0/1 elsewhere stay mounted, so
  // this draft is only needed to survive an actual reload).
  const [draft] = useState(loadScriptDraft);

  const [mode, setMode] = useState(draft?.mode || "manual");
  const [language, setLanguage] = useState(draft?.language || "english");
  const [elevenLabsVoice, setElevenLabsVoice] = useState(draft?.elevenLabsVoice || ELEVENLABS_VOICES[0].id);
  const [voiceSettings, setVoiceSettings] = useState(() => ({
    ...(ELEVENLABS_VOICE_SETTINGS[draft?.elevenLabsVoice] || ELEVENLABS_VOICE_SETTINGS[ELEVENLABS_VOICES[0].id]),
    ...(draft?.voiceSettings || {}),
  }));
  const [previewingVoice, setPreviewingVoice] = useState(false);
  const previewAudioRef = useRef(null);
  const previewAbortRef = useRef(null);

  const stopPreviewVoice = () => {
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      URL.revokeObjectURL(previewAudioRef.current.src);
    }
    setPreviewingVoice(false);
  };

  const handleVoiceChange = (voiceId) => {
    stopPreviewVoice();
    setElevenLabsVoice(voiceId);
    setVoiceSettings({ ...(ELEVENLABS_VOICE_SETTINGS[voiceId] || ELEVENLABS_VOICE_SETTINGS[ELEVENLABS_VOICES[0].id]) });
  };

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

  const [manualScript, setManualScript] = useState(draft?.manualScript || "");

  const [qaAnswers, setQaAnswers] = useState(() => ({
    propertyName: "",
    location: "",
    propertyType: DEFAULT_PROPERTY_TYPE,
    size: "",
    price: "",
    usps: "",
    cta: "Book a site visit today!",
    ...(draft?.qaAnswers || {}),
  }));
  const tone = "luxury";
  const [showAiForm, setShowAiForm] = useState(draft?.showAiForm ?? true);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [aiGeneratedScript, setAiGeneratedScript] = useState(draft?.aiGeneratedScript || "");
  const [scriptWordCount, setScriptWordCount] = useState(draft?.scriptWordCount || 0);
  const [scriptEstDuration, setScriptEstDuration] = useState(draft?.scriptEstDuration || 0);

  const activeScript = mode === "manual" ? manualScript : aiGeneratedScript;
  const wordCount = activeScript.trim().split(/\s+/).filter(Boolean).length;
  const isScriptReady = wordCount >= MIN_SCRIPT_WORDS && wordCount <= MAX_SCRIPT_WORDS;

  // Resolved property-type config drives the Size/Price field wording and the
  // { type, transaction } sent to the script writer.
  const selectedType = getPropertyType(qaAnswers.propertyType) || getPropertyType(DEFAULT_PROPERTY_TYPE);

  // Persist the in-progress draft so a page refresh doesn't lose it.
  useEffect(() => {
    try {
      sessionStorage.setItem(SCRIPT_DRAFT_KEY, JSON.stringify({
        mode, language, elevenLabsVoice, voiceSettings,
        manualScript, qaAnswers, showAiForm, aiGeneratedScript,
        scriptWordCount, scriptEstDuration,
      }));
    } catch (_) {}
  }, [mode, language, elevenLabsVoice, voiceSettings, manualScript, qaAnswers, showAiForm, aiGeneratedScript, scriptWordCount, scriptEstDuration]);

  const handlePreviewVoice = async () => {
    if (previewingVoice) return;
    setPreviewingVoice(true);
    const controller = new AbortController();
    previewAbortRef.current = controller;
    try {
      const voice = ELEVENLABS_VOICES.find((v) => v.id === elevenLabsVoice);
      const res = await fetch("/api/veo-long-ad/preview-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          voiceId: elevenLabsVoice,
          voiceLabel: voice?.label?.split(" (")[0],
          language,
          voiceSettings,
          text: activeScript.trim() || undefined,
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
          type: selectedType.label,
          transaction: selectedType.transaction,
          size: qaAnswers.size,
          price: qaAnswers.price,
          usps: qaAnswers.usps.split("\n").map((s) => s.trim()).filter(Boolean),
          cta: qaAnswers.cta,
          language,
          tone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Script generation failed");
      setAiGeneratedScript(data.script || "");
      setScriptWordCount(data.wordCount || 0);
      setScriptEstDuration(data.estimatedDuration || 0);
      setShowAiForm(false);
      toast.success(`Script ready — ${data.wordCount} words · ~${data.estimatedDuration}s`);
    } catch (err) {
      toast.error("Script generation failed", { description: err.message });
    } finally {
      setGeneratingScript(false);
    }
  };

  const handleGenerate = () => {
    if (!isScriptReady) return;
    onGenerate({ script: activeScript.trim(), voiceId: elevenLabsVoice, language, tone, voiceSettings, customVoiceFile });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Script (left) + Language/Voice/Tone (right) ─────────────────────── */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          {/* Mode toggle */}
          <div className="flex justify-center">
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
              <textarea
                value={manualScript}
                onChange={(e) => setManualScript(e.target.value)}
                placeholder={`Paste your full property script here…\n\nThe pipeline will automatically split it:\n• Part 1 (~15s) → Avatar presenter speaks to camera\n• Part 2 (rest) → B-roll footage with voiceover`}
                rows={14}
                className="w-full text-sm border border-border/60 rounded-3xl bg-background px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#c7f038] leading-relaxed placeholder:text-muted-foreground/50"
              />
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
              {showAiForm && (
                <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Property Details
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "propertyName", label: "Property Name *", placeholder: "e.g. M3M Opus" },
                      { key: "location", label: "Location *", placeholder: "e.g. Sector 67, Gurugram" },
                      { key: "propertyType", label: "Property Type", select: true },
                      { key: "size", label: selectedType.sizeLabel, placeholder: selectedType.sizePlaceholder },
                      { key: "price", label: selectedType.priceLabel, placeholder: selectedType.pricePlaceholder },
                      { key: "cta", label: "Call-to-Action", placeholder: "e.g. Book a site visit today!" },
                    ].map((f) => (
                      <div key={f.key} className="space-y-1.5">
                        <label className="text-xs font-medium">{f.label}</label>
                        {f.select ? (
                          <div className="relative">
                            <select
                              value={qaAnswers.propertyType}
                              onChange={(e) => setQaAnswers((prev) => ({ ...prev, propertyType: e.target.value }))}
                              className="w-full appearance-none text-sm border border-border/60 rounded-xl bg-background px-3 py-2 pr-9 focus:outline-none focus:ring-2 focus:ring-primary/30"
                            >
                              {PROPERTY_TYPE_GROUPS.map((g) => (
                                <optgroup key={g.label} label={g.label}>
                                  {g.types.map((t) => (
                                    <option key={t.id} value={t.id}>{t.label}</option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              <ChevronDown />
                            </div>
                          </div>
                        ) : (
                          <input
                            value={qaAnswers[f.key]}
                            onChange={(e) => setQaAnswers((prev) => ({ ...prev, [f.key]: e.target.value }))}
                            placeholder={f.placeholder}
                            className="w-full text-sm border border-border/60 rounded-xl bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        )}
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
              )}

              {aiGeneratedScript && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Script generated — {scriptWordCount} words · ~{scriptEstDuration}s
                    </div>
                    <div className="flex items-center gap-3">
                      {!showAiForm && (
                        <button
                          onClick={() => setShowAiForm(true)}
                          className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          Edit Details
                        </button>
                      )}
                      <button
                        onClick={handleGenerateAiScript}
                        disabled={generatingScript}
                        className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        <RefreshCcw className="w-3 h-3" />
                        Regenerate
                      </button>
                    </div>
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
        </div>

        {/* ── Language / Voice / Tone ─────────────────────────────────────── */}
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
                  onChange={(e) => handleVoiceChange(e.target.value)}
                  className="w-full appearance-none text-sm rounded-xl border border-neutral-200 bg-white px-3 py-2 pr-10 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#c7f038]/40 focus:border-[#c7f038]"
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
                onClick={previewingVoice ? stopPreviewVoice : handlePreviewVoice}
                className="w-full flex items-center justify-center gap-2 text-xs font-medium rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 py-2 text-neutral-700 transition-colors"
              >
                {previewingVoice
                  ? <><Square className="w-3.5 h-3.5" /> Stop</>
                  : <><Play className="w-3.5 h-3.5" /> {activeScript.trim() ? "Preview with My Script" : "Preview Voice"}</>
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

      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          onClick={onBack}
          className="bg-neutral-900 text-[#c7f038] hover:opacity-90 disabled:opacity-50 hover:bg-neutral-900 shadow-lg gap-2 px-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
        <Button
          onClick={handleGenerate}
          disabled={!isScriptReady}
          className="bg-neutral-900 text-[#c7f038] hover:opacity-90 disabled:opacity-50 hover:bg-neutral-900 shadow-lg gap-2 px-6"
        >
          Continue to Finalize
          <ChevronLeft className="w-4 h-4 rotate-180" />
        </Button>
      </div>
    </div>
  );
}

