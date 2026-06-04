"use client";

import { useState, useRef } from "react";
import {
  Wand2,
  FileText,
  ChevronRight,
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
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LANGUAGES, TONES } from "@/utils/constants";
import { compressImage } from "@/utils/compress-image";

const MAX_CHUNKS = 10;
const MIN_SCRIPT_WORDS = 20;
const MAX_SCRIPT_WORDS = 500;

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

  // ── Chunking state ───────────────────────────────────────────────────────
  const [chunks, setChunks] = useState([]);
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
      setChunks([]); // Reset chunks on new script
      toast.success(`Script generated! ~${data.estimatedDuration}s spoken ad (${data.wordCount} words)`);
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

      await Promise.all(
        locationImages.slice(0, 5).map(async (img, i) => {
          if (!img.file) return;
          const compressed = await compressImage(img.file);
          formData.append(`locationImage_${i}`, compressed);
        })
      );
      await Promise.all(
        avatarImages.slice(0, 3).map(async (av, i) => {
          if (!av.file) return;
          const compressed = await compressImage(av.file);
          formData.append(`avatarImage_${i}`, compressed);
        })
      );

      const res = await fetch("/api/veo-long-ad/chunk-script", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chunking failed");

      setChunks(data.chunks || []);
      setMasterVoicePrompt(data.masterVoicePrompt || "");
      setPresenterDescription(data.presenterDescription || "");
      toast.success(
        `Split into ${data.totalChunks} chunk${data.totalChunks !== 1 ? "s" : ""} — ~${data.totalEstimatedDuration}s video`
      );

      // Scroll to chunks
      setTimeout(() => chunksRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      toast.error("Script chunking failed", { description: err.message });
    } finally {
      setChunking(false);
    }
  };

  // ── Generate video ────────────────────────────────────────────────────────
  const handleGenerate = () => {
    if (chunks.length === 0) {
      return toast.error("Please chunk the script first.");
    }
    onGenerate({ chunks, masterVoicePrompt, presenterDescription, language });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold font-heading tracking-tight">Script</h2>
        <p className="text-sm text-muted-foreground">
          Paste your property script or let AI write one for you.
        </p>
      </div>

      {/* Language & Tone row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Globe2 className="w-3.5 h-3.5" /> Language
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full text-sm border border-border/60 rounded-xl bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Tone
          </label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="w-full text-sm border border-border/60 rounded-xl bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {TONES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-2xl border border-border/60 bg-muted/20 p-1 gap-1">
        <button
          onClick={() => setMode("manual")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all ${
            mode === "manual"
              ? "bg-background shadow text-foreground border border-border/40"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="w-4 h-4" />
          Paste Script
        </button>
        <button
          onClick={() => setMode("ai")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all ${
            mode === "ai"
              ? "bg-background shadow text-foreground border border-border/40"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Wand2 className="w-4 h-4" />
          AI Write Script
        </button>
      </div>

      {/* ── Manual Mode ───────────────────────────────────────────────────── */}
      {mode === "manual" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              Property Script
            </label>
            <span className={`text-[11px] font-medium ${
              wordCount > MAX_SCRIPT_WORDS ? "text-destructive" : wordCount >= MIN_SCRIPT_WORDS ? "text-emerald-500" : "text-muted-foreground"
            }`}>
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
            className="w-full text-sm border border-border/60 rounded-2xl bg-background px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 leading-relaxed placeholder:text-muted-foreground/50"
          />
          {wordCount > MAX_SCRIPT_WORDS && (
            <p className="text-[11px] text-destructive">
              Script is too long. Maximum {MAX_SCRIPT_WORDS} words (~10 chunks). Please trim it down.
            </p>
          )}
        </div>
      )}

      {/* ── AI Mode ───────────────────────────────────────────────────────── */}
      {mode === "ai" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Property Details</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Property Name *</label>
                <input
                  value={qaAnswers.propertyName}
                  onChange={(e) => handleQaChange("propertyName", e.target.value)}
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
              <label className="text-xs font-medium">Key USPs / Features <span className="text-muted-foreground">(one per line)</span></label>
              <textarea
                value={qaAnswers.usps}
                onChange={(e) => handleQaChange("usps", e.target.value)}
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
              {chunks.length > 0 ? "Re-chunk Script & Preview" : "Chunk Script & Preview Veo Prompts"}
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
              {chunks.length} chunks — ~{chunks.reduce((s, c) => s + (c.estimatedSeconds || 8), 0)}s video
            </p>
            <div className="flex-1 h-px bg-border/50" />
          </div>

          <div className="rounded-2xl border border-border/50 bg-muted/10 p-1 space-y-1">
            {chunks.map((chunk, idx) => (
              <div key={idx} className="rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedChunk(expandedChunk === idx ? null : idx)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
                >
                  {/* Progress circle */}
                  <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-primary">{idx + 1}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate text-foreground">
                      {chunk.text.slice(0, 70)}{chunk.text.length > 70 ? "…" : ""}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      ~{chunk.estimatedSeconds}s · {chunk.cameraDirection?.slice(0, 50) || "Cinematic exterior"}
                    </p>
                  </div>

                  {expandedChunk === idx
                    ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  }
                </button>

                {expandedChunk === idx && (
                  <div className="px-3 pb-3 space-y-2">
                    <div className="rounded-lg bg-muted/30 p-2.5">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Spoken Text</p>
                      <p className="text-xs text-foreground leading-relaxed">"{chunk.text}"</p>
                    </div>
                    {chunk.veoPrompt && (
                      <div className="rounded-lg bg-violet-50/50 dark:bg-violet-900/10 border border-violet-200/40 dark:border-violet-700/20 p-2.5">
                        <p className="text-[10px] text-violet-600 dark:text-violet-400 font-medium uppercase tracking-wide mb-1">
                          Veo Director Prompt
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-line">
                          {chunk.veoPrompt.slice(0, 400)}{chunk.veoPrompt.length > 400 ? "…" : ""}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/40 dark:border-emerald-700/20 dark:bg-emerald-900/10 p-3 flex gap-2">
            <Info className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 leading-relaxed">
              Veo will generate a <strong>{chunks[0]?.estimatedSeconds || 8}s base clip</strong> then extend
              it {chunks.length - 1} time{chunks.length - 1 !== 1 ? "s" : ""}, producing a
              final <strong>~{chunks.reduce((s, c) => s + (c.estimatedSeconds || 8), 0)}-second long-form ad</strong>.
              Each extension takes 2–3 minutes. Total estimated time: ~{Math.round(chunks.length * 2.5)} minutes.
            </p>
          </div>
        </div>
      )}

      {/* Nav buttons */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack} className="gap-2 text-muted-foreground">
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
