"use client";
import { motion } from "framer-motion";
import { useState, useRef } from "react";
import {
  Wand2,
  FileText,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  Layers,
  RefreshCcw,
  Info,
  Sparkles,
  Globe2,
  Video,
  User,
  Mic,
  Play,
  Bot,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LANGUAGES, TONES } from "@/utils/constants";
import { compressImage } from "@/utils/compress-image";

const MIN_SCRIPT_WORDS = 20;
const MAX_SCRIPT_WORDS = 500;

// ElevenLabs voices — swap any id for a voice from your ElevenLabs account
// stability / similarity / style are tuned in the API route (ELEVENLABS_VOICE_SETTINGS)
const ELEVENLABS_VOICES = [
  { id: "dVTC43Yewy5fAIcmsISI", label: "Anvi (Female)"    },
  { id: "K2Byg54sHB1oHegvENtI", label: "Kanika (Female)"     },
  { id: "XB0fDUnXU5powFXDhCwa", label: "Charlotte (Female)" },
  { id: "pMsXgVXv3BLzUgSXRplE", label: "Serena (Female)"    },
  { id: "DdD5pVl1QDeeI6MMtYbk", label: "Abhay (Male)"        },
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George (Male)"      },
  { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel (Male)"      },
  { id: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam (Male)"        },
];

const LLM_MODELS = [
  { id: "anthropic/claude-3-5-haiku",       label: "Claude 3.5 Haiku"   },
  { id: "anthropic/claude-sonnet-4-5",      label: "Claude Sonnet 4.5"  },
  { id: "anthropic/claude-opus-4",          label: "Claude Opus 4"      },
  { id: "google/gemini-2.5-flash",          label: "Gemini 2.5 Flash"   },
  { id: "google/gemini-2.5-pro",            label: "Gemini 2.5 Pro"     },
  { id: "openai/gpt-4o-mini",              label: "GPT-4o Mini"         },
  { id: "openai/gpt-4o",                  label: "GPT-4o"               },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B"    },
];

/**
 * StepScript — Step 2 for the Long-Form Veo Ad pipeline.
 *
 * Mode A: Manual — user pastes a full script
 * Mode B: AI Q&A  — 5-question form → Gemini generates script
 *
 * After script is ready, user clicks "Chunk & Preview" which calls
 * /api/veo-long-ad/chunk-script and shows the resulting chunks.
 */
export function StepScript({
  locationImages,
  avatarImages,
  onBack,
  onGenerate,
}) {
  const [mode, setMode] = useState("manual"); // "manual" | "ai"
  const [language, setLanguage] = useState("english");
  const [tone, setTone] = useState("luxury");
  const [elevenLabsVoice, setElevenLabsVoice] = useState(ELEVENLABS_VOICES[0].id);
  const [llmModel, setLlmModel] = useState("anthropic/claude-3-5-haiku");
  const [previewingVoice, setPreviewingVoice] = useState(false);
  const previewAudioRef = useRef(null);

  // ── Manual mode state ────────────────────────────────────────────────────
  const [manualScript, setManualScript] = useState("");

  // ── AI Q&A mode state ────────────────────────────────────────────────────
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

  // ── Beat plan state ──────────────────────────────────────────────────────
  const [beats, setBeats] = useState([]);
  const [chunks, setChunks] = useState([]); // legacy compat
  const [masterVoicePrompt, setMasterVoicePrompt] = useState("");
  const [presenterDescription, setPresenterDescription] = useState("");
  const [chunking, setChunking] = useState(false);
  const [expandedChunk, setExpandedChunk] = useState(null);
  const chunksRef = useRef(null);

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeScript = mode === "manual" ? manualScript : aiGeneratedScript;
  const words = activeScript.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const isScriptReady = wordCount >= MIN_SCRIPT_WORDS;

  const handlePreviewVoice = async () => {
    if (previewingVoice) return;
    setPreviewingVoice(true);
    try {
      const voice = ELEVENLABS_VOICES.find((v) => v.id === elevenLabsVoice);
      const res = await fetch("/api/veo-long-ad/preview-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId: elevenLabsVoice, voiceLabel: voice?.label?.split(" (")[0], language }),
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

  const handleQaChange = (key, value) => {
    setQaAnswers((prev) => ({ ...prev, [key]: value }));
  };

  // ── AI Script Generation ──────────────────────────────────────────────────
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
          usps: qaAnswers.usps
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
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
      setChunks([]); // Reset chunks on new script
      toast.success(
        `Script generated! ~${data.estimatedDuration}s spoken ad (${data.wordCount} words)`,
      );
    } catch (err) {
      toast.error("Script generation failed", { description: err.message });
    } finally {
      setGeneratingScript(false);
    }
  };

  // ── Chunk & Preview ───────────────────────────────────────────────────────
  const handleChunkAndPreview = async () => {
    if (!isScriptReady) return;
    setChunking(true);
    setChunks([]);
    try {
      const formData = new FormData();
      formData.append("script", activeScript);
      formData.append("language", language);
      formData.append("model", llmModel);

      await Promise.all(
        locationImages.slice(0, 5).map(async (img, i) => {
          if (!img.file) return;
          const compressed = await compressImage(img.file);
          formData.append(`locationImage_${i}`, compressed);
        }),
      );
      await Promise.all(
        avatarImages.slice(0, 3).map(async (av, i) => {
          if (!av.file) return;
          const compressed = await compressImage(av.file);
          formData.append(`avatarImage_${i}`, compressed);
        }),
      );

      const res = await fetch("/api/veo-long-ad/chunk-script", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chunking failed");

      setBeats(data.beats || []);
      setChunks(data.chunks || []);
      setMasterVoicePrompt(data.masterVoicePrompt || data.voiceProfile || "");
      setPresenterDescription(data.presenterDescription || "");

      const avatarCount = (data.beats || []).filter((b) => b.visual_type === "avatar").length;
      const propCount = (data.beats || []).filter((b) => b.visual_type === "property").length;
      toast.success(
        `Beat plan ready — ${data.totalChunks} beats (~${data.totalEstimatedDuration}s) · ${propCount} property · ${avatarCount} avatar`,
      );

      // Scroll to chunks
      setTimeout(
        () => chunksRef.current?.scrollIntoView({ behavior: "smooth" }),
        100,
      );
    } catch (err) {
      toast.error("Script chunking failed", { description: err.message });
    } finally {
      setChunking(false);
    }
  };

  // ── Generate video ────────────────────────────────────────────────────────
  const handleGenerate = () => {
    if (chunks.length === 0) {
      return toast.error("Please plan the beats first.");
    }
    onGenerate({ beats, chunks, masterVoicePrompt, voiceProfile: masterVoicePrompt, presenterDescription, language, elevenLabsVoice });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold font-heading tracking-tight">
          Script
        </h2>
        <p className="text-sm text-muted-foreground">
          Paste your property script or let AI write one for you.
        </p>
      </div>

      <div className="flex items-center justify-between">
        {/* Language, Voice & Tone row */}
        <div className="grid grid-cols-4 w-2xl gap-3">
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
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-500 flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5" />
              Voice
            </label>
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <select
                  value={elevenLabsVoice}
                  onChange={(e) => { setElevenLabsVoice(e.target.value); setPreviewingVoice(false); }}
                  className="w-full appearance-none text-sm rounded-xl border border-neutral-200 bg-white px-3 py-2 pr-10 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#c7f038]/40 focus:border-[#c7f038]"
                >
                  {ELEVENLABS_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                    <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
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
                {TONES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>

              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M6 8l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-500 flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5" />
              AI Model
            </label>
            <div className="relative">
              <select
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                className="w-full appearance-none text-sm rounded-xl border border-neutral-200 bg-white px-3 py-2 pr-10 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#c7f038]/40 focus:border-[#c7f038]"
              >
                {LLM_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="relative inline-flex rounded-full bg-neutral-100 p-1">
          {mode === "manual" && (
            <motion.div
              layoutId="active-pill"
              className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-white shadow-sm"
            />
          )}

          {mode === "ai" && (
            <motion.div
              layoutId="active-pill"
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

      {/* ── Manual Mode ───────────────────────────────────────────────────── */}
      {mode === "manual" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              Property Script
            </label>
            <span
              className={`text-xs font-medium ${
                wordCount > MAX_SCRIPT_WORDS
                  ? "text-destructive"
                  : wordCount >= MIN_SCRIPT_WORDS
                    ? "text-emerald-500"
                    : "text-neutral-500"
              }`}
            >
              {wordCount} / {MAX_SCRIPT_WORDS} words
            </span>
          </div>
          <textarea
            value={manualScript}
            onChange={(e) => {
              setManualScript(e.target.value);
              setChunks([]);
            }}
            placeholder={`Paste your full property script here…\n\nExample:\n"When Gurgaon talks about ultra-exclusive living, M3M Opus sets a new benchmark…\n\nServing as the final, exclusive phase within the already established M3M Merlin township, this standalone tower delivers low-density, Singaporean-style boutique luxury…"`}
            rows={12}
            className="w-full text-sm border border-border/60 rounded-3xl bg-background px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#c7f038] leading-relaxed placeholder:text-muted-foreground/50"
          />
          {wordCount > MAX_SCRIPT_WORDS && (
            <p className="text-[11px] text-destructive">
              Script is too long. Maximum {MAX_SCRIPT_WORDS} words (~10 chunks).
              Please trim it down.
            </p>
          )}
        </div>
      )}

      {/* ── AI Mode ───────────────────────────────────────────────────────── */}
      {mode === "ai" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Property Details
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Property Name *</label>
                <input
                  value={qaAnswers.propertyName}
                  onChange={(e) =>
                    handleQaChange("propertyName", e.target.value)
                  }
                  placeholder="e.g. M3M Opus"
                  className="w-full text-sm border border-border/60 rounded-xl bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Location *</label>
                <input
                  value={qaAnswers.location}
                  onChange={(e) => handleQaChange("location", e.target.value)}
                  placeholder="e.g. Sector 67, Gurugram"
                  className="w-full text-sm border border-border/60 rounded-xl bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Type</label>
                <input
                  value={qaAnswers.type}
                  onChange={(e) => handleQaChange("type", e.target.value)}
                  placeholder="e.g. 3 BHK Luxury Apartment"
                  className="w-full text-sm border border-border/60 rounded-xl bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Size</label>
                <input
                  value={qaAnswers.size}
                  onChange={(e) => handleQaChange("size", e.target.value)}
                  placeholder="e.g. 2400–3200 sq ft"
                  className="w-full text-sm border border-border/60 rounded-xl bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Price</label>
                <input
                  value={qaAnswers.price}
                  onChange={(e) => handleQaChange("price", e.target.value)}
                  placeholder="e.g. ₹7 Cr onwards"
                  className="w-full text-sm border border-border/60 rounded-xl bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Call-to-Action</label>
                <input
                  value={qaAnswers.cta}
                  onChange={(e) => handleQaChange("cta", e.target.value)}
                  placeholder="e.g. Book a site visit today!"
                  className="w-full text-sm border border-border/60 rounded-xl bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">
                Key USPs / Features{" "}
                <span className="text-muted-foreground">(one per line)</span>
              </label>
              <textarea
                value={qaAnswers.usps}
                onChange={(e) => handleQaChange("usps", e.target.value)}
                placeholder={
                  "270-degree views of Aravalli Hills\nSingaporean-style boutique luxury\n100+ world-class amenities\nGolf Course Extension Road connectivity"
                }
                rows={4}
                className="w-full text-sm border border-border/60 rounded-2xl bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
              />
            </div>

            <Button
              onClick={handleGenerateAiScript}
              disabled={
                !qaAnswers.propertyName ||
                !qaAnswers.location ||
                generatingScript
              }
              className="w-full gradient-bg text-white hover:opacity-90 disabled:opacity-40 gap-2"
            >
              {generatingScript ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Writing script with AI…
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Generate Script with AI
                </>
              )}
            </Button>
          </div>

          {/* AI Generated Script Preview */}
          {aiGeneratedScript && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Script generated — {scriptWordCount} words · ~
                  {scriptEstDuration}s
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
                onChange={(e) => {
                  setAiGeneratedScript(e.target.value);
                  setChunks([]);
                }}
                rows={10}
                className="w-full text-sm border border-border/60 rounded-2xl bg-background px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 leading-relaxed"
              />
              <p className="text-[11px] text-muted-foreground">
                You can edit the script above before chunking.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Chunk & Preview CTA ────────────────────────────────────────────── */}
      {isScriptReady && wordCount <= MAX_SCRIPT_WORDS && (
        <Button
          onClick={handleChunkAndPreview}
          disabled={chunking}
          variant="outline"
          className="w-full gap-2 border-primary/40 text-primary hover:bg-primary/5"
        >
          {chunking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              AI is chunking your script + writing Veo prompts…
            </>
          ) : (
            <>
              <Layers className="w-4 h-4" />
              {chunks.length > 0
                ? "Re-chunk Script & Preview"
                : "Chunk Script & Preview Veo Prompts"}
            </>
          )}
        </Button>
      )}

      {/* ── Chunk preview ─────────────────────────────────────────────────── */}
      {chunks.length > 0 && (
        <div ref={chunksRef} className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border/50" />
            <p className="text-xs font-medium text-muted-foreground">
              {chunks.length} chunks — ~
              {chunks.reduce((s, c) => s + (c.estimatedSeconds || 8), 0)}s video
            </p>
            <div className="flex-1 h-px bg-border/50" />
          </div>

          <div className="rounded-2xl border border-border/50 bg-muted/10 p-1 space-y-1">
            {chunks.map((chunk, idx) => {
              const isAvatar = chunk.visualType === "avatar";
              const beatType = chunk.beatType || "PROPERTY_VISUAL";
              const beatColors = {
                HOOK: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                AVATAR_SEGMENT: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                PROPERTY_VISUAL: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
                FEATURE_BURST: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
                CTA: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
              };
              const colorClass = beatColors[beatType] || beatColors.PROPERTY_VISUAL;

              return (
                <div key={idx} className="rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedChunk(expandedChunk === idx ? null : idx)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                      {isAvatar
                        ? <User className="w-3 h-3" />
                        : <Video className="w-3 h-3" />
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${colorClass}`}>
                          {beatType.replace("_", " ")}
                        </span>
                        {chunk.overlayText && (
                          <span className="text-[9px] text-muted-foreground truncate max-w-30">
                            "{chunk.overlayText}"
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium truncate text-foreground">
                        {chunk.text.slice(0, 65)}{chunk.text.length > 65 ? "…" : ""}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        ~{chunk.estimatedSeconds}s · {isAvatar ? "Veo presenter" : "Veo property clip"}
                      </p>
                    </div>

                    {expandedChunk === idx
                      ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    }
                  </button>

                  {expandedChunk === idx && (
                    <div className="px-3 pb-3 space-y-2">
                      {chunk.narration && (
                        <div className="rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/40 p-2.5">
                          <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium uppercase tracking-wide mb-1">
                            Voiceover (ElevenLabs)
                          </p>
                          <p className="text-xs text-foreground leading-relaxed">"{chunk.narration}"</p>
                        </div>
                      )}
                      {chunk.veoPrompt && (
                        <div className="rounded-lg bg-violet-50/50 dark:bg-violet-900/10 border border-violet-200/40 p-2.5">
                          <p className="text-[10px] text-violet-600 dark:text-violet-400 font-medium uppercase tracking-wide mb-1">
                            Veo Shot Prompt
                          </p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            {chunk.veoPrompt.slice(0, 300)}{chunk.veoPrompt.length > 300 ? "…" : ""}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pipeline info */}
          {(() => {
            const avatarBeats = chunks.filter((c) => c.visualType === "avatar");
            const propBeats = chunks.filter((c) => c.visualType !== "avatar");
            const totalSecs = chunks.reduce((s, c) => s + (c.estimatedSeconds || 4), 0);
            return (
              <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/40 dark:border-emerald-700/20 dark:bg-emerald-900/10 p-3 flex gap-2">
                <Info className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 leading-relaxed">
                  Hybrid pipeline: <strong>{propBeats.length} property clip{propBeats.length !== 1 ? "s" : ""}</strong> + <strong>{avatarBeats.length} presenter clip{avatarBeats.length !== 1 ? "s" : ""}</strong> via Veo 3.1.
                  {" "}ElevenLabs TTS voiceover mixed in. All beats generate <strong>in parallel</strong>. Final reel ~<strong>{totalSecs}s</strong>.
                  Estimated time: ~{Math.max(3, chunks.length * 2.5)} minutes.
                </p>
              </div>
            );
          })()}
        </div>
      )}

      {/* Nav buttons */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          onClick={onBack}
          className="gap-2 text-muted-foreground"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>

        <Button
          onClick={handleGenerate}
          disabled={chunks.length === 0}
          className="gradient-bg text-white hover:opacity-90 disabled:opacity-40 shadow-lg gap-2 px-6"
        >
          <Sparkles className="w-4 h-4" />
          Generate Long-Form Ad
        </Button>
      </div>
    </div>
  );
}
