"use client";

import { motion } from "framer-motion";
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
 * StepScript — Step 2 for the Site View pipeline.
 *
 * Mode A: Manual — user pastes a full site-visit script
 * Mode B: AI Q&A  — site-specific form → Gemini generates script
 *
 * After script is ready, user clicks "Chunk & Preview" which calls
 * /api/site-view/chunk-script and shows the resulting chunks.
 */
export function StepScript({
  siteImages,
  avatarImages,
  onBack,
  onGenerate,
}) {
  const [mode, setMode] = useState("manual");
  const [language, setLanguage] = useState("english");
  const [tone, setTone] = useState("professional");

  const [manualScript, setManualScript] = useState("");

  const [qaAnswers, setQaAnswers] = useState({
    projectName: "",
    location: "",
    stage: "",
    plotSizes: "",
    price: "",
    highlights: "",
    cta: "Book your site visit today!",
  });
  const [generatingScript, setGeneratingScript] = useState(false);
  const [aiGeneratedScript, setAiGeneratedScript] = useState("");
  const [scriptWordCount, setScriptWordCount] = useState(0);
  const [scriptEstDuration, setScriptEstDuration] = useState(0);

  const [chunks, setChunks] = useState([]);
  const [masterVoicePrompt, setMasterVoicePrompt] = useState("");
  const [presenterDescription, setPresenterDescription] = useState("");
  const [chunking, setChunking] = useState(false);
  const [expandedChunk, setExpandedChunk] = useState(null);
  const chunksRef = useRef(null);

  const activeScript = mode === "manual" ? manualScript : aiGeneratedScript;
  const words = activeScript.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const isScriptReady = wordCount >= MIN_SCRIPT_WORDS;

  const handleQaChange = (key, value) => {
    setQaAnswers((prev) => ({ ...prev, [key]: value }));
  };

  // ── AI Script Generation ──────────────────────────────────────────────────
  const handleGenerateAiScript = async () => {
    if (!qaAnswers.projectName || !qaAnswers.location) {
      return toast.error("Project name and location are required.");
    }
    setGeneratingScript(true);
    try {
      const res = await fetch("/api/site-view/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: qaAnswers.projectName,
          location: qaAnswers.location,
          stage: qaAnswers.stage,
          plotSizes: qaAnswers.plotSizes,
          price: qaAnswers.price,
          highlights: qaAnswers.highlights
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
      setChunks([]);
      toast.success(`Script generated! ~${data.estimatedDuration}s site-tour video (${data.wordCount} words)`);
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
        siteImages.slice(0, 5).map(async (img, i) => {
          if (!img.file) return;
          const compressed = await compressImage(img.file);
          formData.append(`siteImage_${i}`, compressed);
        }),
      );
      await Promise.all(
        avatarImages.slice(0, 3).map(async (av, i) => {
          if (!av.file) return;
          const compressed = await compressImage(av.file);
          formData.append(`avatarImage_${i}`, compressed);
        }),
      );

      const res = await fetch("/api/site-view/chunk-script", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chunking failed");

      setChunks(data.chunks || []);
      setMasterVoicePrompt(data.masterVoicePrompt || "");
      setPresenterDescription(data.presenterDescription || "");
      toast.success(
        `Split into ${data.totalChunks} chunk${data.totalChunks !== 1 ? "s" : ""} — ~${data.totalEstimatedDuration}s video`,
      );

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
          Paste your site-visit script or let AI write one for you.
        </p>
      </div>

      <div className="flex items-center justify-between">
        {/* Language & Tone row */}
        <div className="grid grid-cols-2 w-sm gap-3">
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
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
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
                  <option key={t.id} value={t.id}>{t.label}</option>
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
              layoutId="sv-active-pill"
              className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-white shadow-sm"
            />
          )}
          {mode === "ai" && (
            <motion.div
              layoutId="sv-active-pill"
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
            <label className="text-xs font-medium text-muted-foreground">Site Visit Script</label>
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
            onChange={(e) => { setManualScript(e.target.value); setChunks([]); }}
            placeholder={`Paste your full site-visit script here…\n\nExample:\n"We are standing right at the entrance of what's going to be one of the most talked-about townships in this region…\n\nLook at that road. Already laid. Drainage done. Electricity poles up. This is not just a plot — this is a ready-to-build investment.\n\nForty-five minutes from the city centre. School within two kilometres. Plots starting at just forty lakhs."`}
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
              Project Details
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Project Name *</label>
                <input
                  value={qaAnswers.projectName}
                  onChange={(e) => handleQaChange("projectName", e.target.value)}
                  placeholder="e.g. Green Valley Township"
                  className="w-full text-sm border border-border/60 rounded-xl bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Location *</label>
                <input
                  value={qaAnswers.location}
                  onChange={(e) => handleQaChange("location", e.target.value)}
                  placeholder="e.g. Sector 89, Gurugram"
                  className="w-full text-sm border border-border/60 rounded-xl bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Development Stage</label>
                <input
                  value={qaAnswers.stage}
                  onChange={(e) => handleQaChange("stage", e.target.value)}
                  placeholder="e.g. Roads laid, utilities ready"
                  className="w-full text-sm border border-border/60 rounded-xl bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Plot Sizes</label>
                <input
                  value={qaAnswers.plotSizes}
                  onChange={(e) => handleQaChange("plotSizes", e.target.value)}
                  placeholder="e.g. 100–500 sq yards"
                  className="w-full text-sm border border-border/60 rounded-xl bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Price</label>
                <input
                  value={qaAnswers.price}
                  onChange={(e) => handleQaChange("price", e.target.value)}
                  placeholder="e.g. Starting ₹40 lakhs"
                  className="w-full text-sm border border-border/60 rounded-xl bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Call-to-Action</label>
                <input
                  value={qaAnswers.cta}
                  onChange={(e) => handleQaChange("cta", e.target.value)}
                  placeholder="e.g. Book your site visit today!"
                  className="w-full text-sm border border-border/60 rounded-xl bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">
                Key Highlights / Infrastructure{" "}
                <span className="text-muted-foreground">(one per line)</span>
              </label>
              <textarea
                value={qaAnswers.highlights}
                onChange={(e) => handleQaChange("highlights", e.target.value)}
                placeholder={"Wide paved roads already laid\n24/7 gated community security\nElectricity and water connections ready\n5 km from NH-48 expressway\nSchool and commercial hub within 2 km"}
                rows={4}
                className="w-full text-sm border border-border/60 rounded-2xl bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
              />
            </div>

            <Button
              onClick={handleGenerateAiScript}
              disabled={!qaAnswers.projectName || !qaAnswers.location || generatingScript}
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
                onChange={(e) => { setAiGeneratedScript(e.target.value); setChunks([]); }}
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

      {/* ── Chunk & Preview CTA ──────────────────────────────────────────────── */}
      {isScriptReady && wordCount <= MAX_SCRIPT_WORDS && (
        <Button
          onClick={handleChunkAndPreview}
          disabled={chunking}
          variant="outline"
          className="w-full gap-2 border-primary/40 text-primary hover:bg-primary/5"
        >
          {chunking ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> AI is chunking your script + writing Veo prompts…</>
          ) : (
            <><Layers className="w-4 h-4" />{chunks.length > 0 ? "Re-chunk Script & Preview" : "Chunk Script & Preview Veo Prompts"}</>
          )}
        </Button>
      )}

      {/* ── Chunk preview ────────────────────────────────────────────────────── */}
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
                  <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-primary">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate text-foreground">
                      {chunk.text.slice(0, 70)}{chunk.text.length > 70 ? "…" : ""}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      ~{chunk.estimatedSeconds}s · {chunk.cameraDirection?.slice(0, 50) || "On-site exterior"}
                    </p>
                  </div>
                  {expandedChunk === idx
                    ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                </button>

                {expandedChunk === idx && (
                  <div className="px-3 pb-3 space-y-2">
                    <div className="rounded-lg bg-muted/30 p-2.5">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">
                        Spoken Text
                      </p>
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
              Veo will generate a{" "}
              <strong>{chunks[0]?.estimatedSeconds || 8}s base clip</strong> then extend it{" "}
              {chunks.length - 1} time{chunks.length - 1 !== 1 ? "s" : ""}, producing a final{" "}
              <strong>~{chunks.reduce((s, c) => s + (c.estimatedSeconds || 8), 0)}-second site-visit video</strong>.
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
          Generate Site-Visit Video
        </Button>
      </div>
    </div>
  );
}
