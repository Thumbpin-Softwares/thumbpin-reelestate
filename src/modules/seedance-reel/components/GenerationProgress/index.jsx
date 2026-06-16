"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Clapperboard,
  Download,
  RotateCcw,
  ExternalLink,
  Play,
  Pause,
  Mic,
  Video,
  User,
  Sparkles,
  FileText,
  Zap,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/utils/compress-image";
import { combineVideos, uploadCombinedVideo, concatWithAudio } from "@/lib/video-combiner";

const STATUS = {
  IDLE:      "idle",
  SPLITTING: "splitting",
  VOICES:    "voices",
  SEEDANCE:  "seedance",
  COMBINING: "combining",
  DONE:      "done",
  ERROR:     "error",
};

const STAGE_LABELS = {
  [STATUS.IDLE]:      "Starting…",
  [STATUS.SPLITTING]: "Splitting script into 3 parts…",
  [STATUS.VOICES]:    "Generating voiceovers for all 3 parts…",
  [STATUS.SEEDANCE]:  "Generating 3 videos in parallel (Seedance 2.0)…",
  [STATUS.COMBINING]: "Assembling final reel (FFmpeg)…",
  [STATUS.DONE]:      "Done!",
  [STATUS.ERROR]:     "Error",
};

const SEEDANCE_TIPS = [
  "Seedance 2.0 is rendering your intro avatar, property walkthrough, and CTA simultaneously…",
  "Placing your presenter at the luxury property entrance…",
  "Building a seamless architectural walkthrough from your location photos…",
  "Crafting the CTA moment — charming, witty, unforgettable…",
  "Syncing lip movements to dialogue phonetics across all 3 clips…",
  "Applying natural handheld camera stabilisation and golden-hour lighting…",
  "Rendering hyper-realistic skin texture and interior lighting transitions…",
];

const ORDERED_STAGES = [
  STATUS.SPLITTING,
  STATUS.VOICES,
  STATUS.SEEDANCE,
  STATUS.COMBINING,
];

function formatElapsed(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function GenerationProgress({ generationParams, onReset }) {
  const {
    script       = "",
    voiceId      = "21m00Tcm4TlvDq8ikWAM",
    language     = "english",
    locationImages = [],
    avatarUrls   = [],
  } = generationParams || {};

  const [status, setStatus]               = useState(STATUS.IDLE);
  const [message, setMessage]             = useState("Starting Seedance Reel pipeline…");
  const [error, setError]                 = useState(null);

  // Script split state
  const [part1, setPart1]       = useState("");
  const [part2, setPart2]       = useState("");
  const [part3Cta, setPart3Cta] = useState("");

  // Asset URLs from SSE
  const [part1AudioUrl, setPart1AudioUrl]         = useState(null);
  const [part2AudioUrl, setPart2AudioUrl]         = useState(null);
  const [avatarVideoUrl, setAvatarVideoUrl]       = useState(null);
  const [walkthroughVideoUrl, setWalkthroughVideoUrl] = useState(null);
  const [ctaVideoUrl, setCtaVideoUrl]             = useState(null);

  // Seedance parallel progress: how many of 3 videos are ready
  const [seedanceDone, setSeedanceDone] = useState(0);

  // Final output
  const [videoUrl, setVideoUrl]           = useState(null);
  const [combineProgress, setCombineProgress] = useState("");
  const [totalDuration, setTotalDuration] = useState(0);
  const [isPlaying, setIsPlaying]         = useState(false);

  // Seedance waiting UX
  const [seedanceStart, setSeedanceStart]     = useState(null);
  const [seedanceElapsed, setSeedanceElapsed] = useState(0);
  const [tipIndex, setTipIndex]               = useState(0);
  const [fakeBonus, setFakeBonus]             = useState(0);

  const videoRef   = useRef(null);
  const hasStarted = useRef(false);

  // Elapsed timer for SEEDANCE stage
  useEffect(() => {
    if (status === STATUS.SEEDANCE) {
      if (!seedanceStart) setSeedanceStart(Date.now());
    } else {
      setSeedanceStart(null);
      setSeedanceElapsed(0);
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!seedanceStart) return;
    const t = setInterval(() => setSeedanceElapsed(Math.floor((Date.now() - seedanceStart) / 1000)), 1000);
    return () => clearInterval(t);
  }, [seedanceStart]);

  // Rotating tips during SEEDANCE
  useEffect(() => {
    if (status !== STATUS.SEEDANCE) { setTipIndex(0); return; }
    const t = setInterval(() => setTipIndex(i => (i + 1) % SEEDANCE_TIPS.length), 4000);
    return () => clearInterval(t);
  }, [status]);

  // Fake progress fill during long stages
  useEffect(() => {
    if (status !== STATUS.SEEDANCE) { setFakeBonus(0); return; }
    const t = setInterval(() => setFakeBonus(p => Math.min(14, p + 0.04)), 1000);
    return () => clearInterval(t);
  }, [status]);

  const stageProgress  = ORDERED_STAGES.indexOf(status);
  const rawPercent     = status === STATUS.DONE ? 100 : status === STATUS.ERROR ? 0
    : Math.max(4, ((stageProgress + 1) / ORDERED_STAGES.length) * 90);
  const progressPercent = Math.round(Math.min(96, rawPercent + (status === STATUS.COMBINING ? 0 : fakeBonus)));

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    startPipeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startPipeline = async () => {
    setStatus(STATUS.IDLE);
    setMessage("Starting pipeline…");
    setError(null);
    setPart1(""); setPart2(""); setPart3Cta("");
    setPart1AudioUrl(null); setPart2AudioUrl(null);
    setAvatarVideoUrl(null); setWalkthroughVideoUrl(null); setCtaVideoUrl(null);
    setSeedanceDone(0);
    setVideoUrl(null);
    setFakeBonus(0);

    try {
      const formData = new FormData();
      formData.append("script", script);
      formData.append("voiceId", voiceId);
      formData.append("language", language);

      avatarUrls.slice(0, 3).forEach((url, i) => formData.append(`avatarUrl_${i}`, url));

      await Promise.all(
        locationImages.slice(0, 4).map(async (img, i) => {
          if (!img.file) return;
          try {
            const compressed = await compressImage(img.file);
            formData.append(`locationImage_${i}`, compressed);
          } catch (_) {
            formData.append(`locationImage_${i}`, img.file);
          }
        })
      );

      const res = await fetch("/api/seedance-reel/generate-pipeline", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error: ${res.status}`);
      }
      if (!res.body) throw new Error("No response stream");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const eventBlock of events) {
          for (const line of eventBlock.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try { handleEvent(JSON.parse(line.slice(6))); } catch (_) {}
          }
        }
      }
    } catch (err) {
      console.error("[GenerationProgress] Error:", err);
      setStatus(STATUS.ERROR);
      setError(err.message || "Pipeline failed");
      toast.error("Generation failed", { description: err.message });
    }
  };

  const handleEvent = useCallback((event) => {
    if (event.message) setMessage(event.message);

    switch (event.type) {
      case "script_splitting":
      case "script_adapting":
        setStatus(STATUS.SPLITTING);
        break;

      case "script_split":
        setPart1(event.part1 || "");
        setPart2(event.part2 || "");
        setPart3Cta(event.part3_cta || "");
        setStatus(STATUS.SPLITTING);
        break;

      case "voice_generating":
        setStatus(STATUS.VOICES);
        break;

      case "voice_all_ready":
        setPart1AudioUrl(event.part1AudioUrl || null);
        setPart2AudioUrl(event.part2AudioUrl || null);
        setStatus(STATUS.SEEDANCE);
        break;

      case "seedance_prompt_ready":
        setStatus(STATUS.SEEDANCE);
        break;

      case "seedance_generating":
        setStatus(STATUS.SEEDANCE);
        break;

      case "seedance_done":
        setAvatarVideoUrl(event.avatarVideoUrl);
        setSeedanceDone(n => n + 1);
        toast.success("Intro avatar video ready!");
        break;

      case "walkthrough_done":
        setWalkthroughVideoUrl(event.walkthroughVideoUrl);
        setSeedanceDone(n => n + 1);
        toast.success("Property walkthrough ready!");
        break;

      case "seedance_cta_done":
        setCtaVideoUrl(event.ctaVideoUrl);
        setSeedanceDone(n => n + 1);
        toast.success("CTA avatar video ready!");
        break;

      case "seedance_error":
        toast.warning(event.message, { duration: 8000 });
        break;

      case "uploading":
        setMessage(event.message || "Saving…");
        break;

      case "video_ready":
        setTotalDuration(event.totalDuration || 0);
        triggerCombine(
          event.avatarVideoUrl,
          event.walkthroughVideoUrl,
          event.ctaVideoUrl,
          event.part2AudioUrl
        );
        break;

      case "error":
        setStatus(STATUS.ERROR);
        setError(event.message || "Pipeline failed");
        toast.error("Pipeline error", { description: event.message });
        break;

      default:
        break;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Two-step final assembly:
   *   Step 1 — combineVideos([walkthroughUrl], { fullAudioUrl: part2TTS })
   *             → walkthrough video with ElevenLabs Part 2 voiceover baked in
   *   Step 2 — concatWithAudio([avatarVideoUrl, walkthroughBlobUrl, ctaVideoUrl])
   *             → preserves Seedance-baked audio for intro + CTA
   */
  const triggerCombine = async (avUrl, wtUrl, ctaUrl, p2Audio) => {
    const clips = [avUrl, wtUrl, ctaUrl].filter(Boolean);
    if (clips.length === 0) {
      setStatus(STATUS.ERROR);
      setError("No videos were generated. Check server logs.");
      return;
    }

    setStatus(STATUS.COMBINING);
    setCombineProgress("Preparing assembly…");

    try {
      let walkthroughBlobUrl = wtUrl;

      // Step 1: Overlay Part 2 TTS onto the walkthrough (which has no baked audio)
      if (wtUrl && p2Audio) {
        setCombineProgress("Step 1/2 — Mixing voiceover into walkthrough…");
        const { blob: wtBlob } = await combineVideos([wtUrl], {
          onProgress: (msg) => setCombineProgress(`Step 1/2 — ${msg}`),
          fullAudioUrl: p2Audio,
        });
        walkthroughBlobUrl = URL.createObjectURL(wtBlob);
      }

      // Build the ordered concat list (only include available clips)
      const toConcat = [avUrl, walkthroughBlobUrl, ctaUrl].filter(Boolean);

      if (toConcat.length === 1) {
        // Only one segment — serve directly
        setVideoUrl(toConcat[0]);
        setStatus(STATUS.DONE);
        toast.success("🎬 Video ready!");
        return;
      }

      // Step 2: Concat all segments — concatWithAudio re-encodes to baseline for Apple devices
      setCombineProgress("Step 2/2 — Joining intro + walkthrough + CTA…");
      const { blobUrl, blob } = await concatWithAudio(toConcat, {
        onProgress: (msg) => setCombineProgress(`Step 2/2 — ${msg}`),
      });

      setCombineProgress("Saving final reel…");
      try {
        const { url } = await uploadCombinedVideo(blob, `seedance-reel-${Date.now()}.mp4`);
        setVideoUrl(url);
      } catch {
        setVideoUrl(blobUrl);
      }

      setStatus(STATUS.DONE);
      toast.success("🎬 Seedance Reel assembled! Ready to download.");
    } catch (err) {
      console.error("[GenerationProgress] Combine failed:", err);
      const fallback = avUrl || ctaUrl || wtUrl;
      if (fallback) {
        setVideoUrl(fallback);
        setStatus(STATUS.DONE);
        toast.warning("Auto-combine failed — showing best available clip.");
      } else {
        setStatus(STATUS.ERROR);
        setError(`Combine failed: ${err.message}`);
      }
    }
  };

  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `seedance-reel-${Date.now()}.mp4`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isGenerating = ![STATUS.DONE, STATUS.ERROR, STATUS.IDLE].includes(status);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold font-heading tracking-tight">
          {status === STATUS.DONE
            ? "Your Seedance Reel is Ready!"
            : status === STATUS.COMBINING
            ? "Assembling Reel…"
            : "Generating Seedance Reel"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {status === STATUS.DONE
            ? "Saved to your Asset Library"
            : status === STATUS.COMBINING
            ? combineProgress || "Combining clips with FFmpeg WASM…"
            : STAGE_LABELS[status] || "Processing…"}
        </p>
      </div>

      {/* ── Progress bar ───────────────────────────────────────────────────── */}
      {status !== STATUS.DONE && status !== STATUS.ERROR && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium truncate max-w-[75%]">
              {status === STATUS.COMBINING ? combineProgress : STAGE_LABELS[status] || "Processing…"}
            </span>
            <span className="font-semibold text-primary shrink-0">{progressPercent}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted/40 overflow-hidden relative">
            <div
              className="h-full rounded-full bg-linear-to-r from-primary to-violet-500 transition-all duration-1000 ease-out"
              style={{ width: `${Math.max(progressPercent, isGenerating ? 4 : 0)}%` }}
            />
            {isGenerating && (
              <div
                className="absolute inset-0 rounded-full opacity-40"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)",
                  animation: "shimmer 2s infinite linear",
                  backgroundSize: "200% 100%",
                }}
              />
            )}
          </div>
          <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
        </div>
      )}

      {/* ── Stage rail ─────────────────────────────────────────────────────── */}
      {isGenerating && (
        <div className="flex items-center overflow-x-auto pb-1 gap-0">
          {ORDERED_STAGES.map((stage, idx) => {
            const stageIdx = ORDERED_STAGES.indexOf(status);
            const isDone   = idx < stageIdx;
            const isActive = idx === stageIdx;
            const icons    = [FileText, Mic, Video, Clapperboard];
            const StageIcon = icons[idx] || Sparkles;
            const names    = ["Split", "Voiceovers", "3 Videos", "Assemble"];
            return (
              <div key={stage} className="flex items-center shrink-0">
                {idx > 0 && (
                  <div className={`h-0.5 w-4 sm:w-6 transition-colors duration-700 ${isDone ? "bg-primary" : "bg-border/40"}`} />
                )}
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                    isDone  ? "border-primary bg-primary shadow-sm shadow-primary/30"
                    : isActive ? "border-primary bg-primary/10"
                    : "border-border/40 bg-muted/20"
                  }`}>
                    {isDone   ? <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    : isActive ? <Loader2 className="w-3 h-3 text-primary animate-spin" />
                    : <StageIcon className="w-3 h-3 text-muted-foreground/60" />}
                  </div>
                  <span className={`text-[9px] font-medium ${isDone || isActive ? "text-primary" : "text-muted-foreground/50"}`}>
                    {names[idx]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Script split preview ───────────────────────────────────────────── */}
      {(part1 || part2 || part3Cta) && status !== STATUS.DONE && (
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-blue-200/60 bg-blue-50/40 dark:border-blue-700/20 dark:bg-blue-900/10 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <User className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">Part 1 — Intro</span>
            </div>
            <p className="text-[11px] text-blue-800 dark:text-blue-200 leading-relaxed">{part1}</p>
            {part1AudioUrl && (
              <div className="flex items-center gap-1 text-[10px] text-emerald-600">
                <CheckCircle2 className="w-3 h-3" /> Voice ready
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/40 dark:border-emerald-700/20 dark:bg-emerald-900/10 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">Part 2 — Walkthrough</span>
            </div>
            <p className="text-[11px] text-emerald-800 dark:text-emerald-200 leading-relaxed line-clamp-4">{part2}</p>
            {part2AudioUrl && (
              <div className="flex items-center gap-1 text-[10px] text-emerald-600">
                <CheckCircle2 className="w-3 h-3" /> Voice ready
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-orange-200/60 bg-orange-50/40 dark:border-orange-700/20 dark:bg-orange-900/10 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-orange-600 dark:text-orange-400" />
              <span className="text-[10px] font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wide">Part 3 — CTA</span>
            </div>
            <p className="text-[11px] text-orange-800 dark:text-orange-200 leading-relaxed">{part3Cta}</p>
          </div>
        </div>
      )}

      {/* ── Seedance 2.0 waiting card ──────────────────────────────────────── */}
      {status === STATUS.SEEDANCE && (
        <div className="rounded-2xl border border-violet-200/60 bg-violet-50/40 dark:border-violet-800/20 dark:bg-violet-900/10 p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="relative mt-0.5 shrink-0">
              <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                <Zap className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-violet-400/60 animate-ping" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-violet-800 dark:text-violet-200">
                Seedance 2.0 — 3 videos generating in parallel
              </p>
              <p className="text-xs text-violet-600/80 dark:text-violet-400/80 mt-0.5 flex items-center gap-1.5">
                <Clock className="w-3 h-3 shrink-0" />
                Running for {formatElapsed(seedanceElapsed)} · typical: 4–8 minutes
              </p>
            </div>
            <div className="shrink-0 rounded-lg bg-violet-100 dark:bg-violet-900/50 border border-violet-200/60 dark:border-violet-700/30 px-2.5 py-1 text-center min-w-14">
              <p className="text-base font-bold font-mono text-violet-700 dark:text-violet-300 tabular-nums">
                {formatElapsed(seedanceElapsed)}
              </p>
              <p className="text-[9px] text-violet-500 uppercase tracking-wide">elapsed</p>
            </div>
          </div>

          {/* Per-video progress */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Intro Avatar", url: avatarVideoUrl,      icon: User      },
              { label: "Walkthrough",  url: walkthroughVideoUrl, icon: Building2 },
              { label: "CTA Avatar",   url: ctaVideoUrl,         icon: Sparkles  },
            ].map(({ label, url, icon: Icon }) => (
              <div key={label} className={`rounded-xl border p-2.5 flex flex-col items-center gap-1.5 transition-all ${
                url
                  ? "border-emerald-300/60 bg-emerald-50/60 dark:border-emerald-700/30 dark:bg-emerald-900/20"
                  : "border-violet-200/40 bg-white/40 dark:border-violet-800/20 dark:bg-white/5"
              }`}>
                {url
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  : <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                }
                <span className={`text-[10px] font-medium text-center ${url ? "text-emerald-700 dark:text-emerald-300" : "text-violet-600 dark:text-violet-400"}`}>
                  {label}
                </span>
                {url && <span className="text-[9px] text-emerald-500">Done</span>}
              </div>
            ))}
          </div>

          {/* Animated tip */}
          <div className="rounded-xl bg-white/60 dark:bg-white/5 border border-violet-100 dark:border-violet-800/30 px-3 py-2.5 min-h-10">
            <p
              key={tipIndex}
              className="text-[11px] text-violet-700 dark:text-violet-300 leading-relaxed"
              style={{ animation: "fadeInUp 0.4s ease" }}
            >
              {SEEDANCE_TIPS[tipIndex]}
            </p>
          </div>

          {/* Animated dots */}
          <div className="flex items-center gap-1.5 justify-center">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 dark:bg-violet-500"
                style={{ animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite` }} />
            ))}
          </div>

          <p className="text-[10px] text-center text-violet-500 dark:text-violet-500/70">
            Do not close or refresh this tab — all 3 generations will be lost.
          </p>
        </div>
      )}
      <style>{`
        @keyframes fadeInUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes bounce { 0%,80%,100%{ transform:scaleY(1); } 40%{ transform:scaleY(1.6); } }
      `}</style>

      {/* ── General status card (non-Seedance active stages) ──────────────── */}
      {isGenerating && status !== STATUS.SEEDANCE && status !== STATUS.COMBINING && (
        <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 flex gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            {status === STATUS.VOICES
              ? <Mic className="w-4 h-4 text-primary" />
              : <Clapperboard className="w-4 h-4 text-primary" />
            }
          </div>
          <div>
            <p className="text-sm font-medium">{STAGE_LABELS[status]}</p>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              Keep this tab open while generation runs.
            </p>
          </div>
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {status === STATUS.ERROR && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">Generation failed</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { hasStarted.current = false; startPipeline(); }}
              className="mt-3 gap-2 text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* ── Final video ────────────────────────────────────────────────────── */}
      {status === STATUS.DONE && videoUrl && (
        <div className="space-y-4">
          <div className="relative rounded-3xl overflow-hidden border border-border/50 bg-black aspect-9/16 max-w-xs mx-auto shadow-2xl">
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain"
              loop
              playsInline
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            <button
              onClick={() => { if (!videoRef.current) return; isPlaying ? videoRef.current.pause() : videoRef.current.play(); }}
              className="absolute inset-0 flex items-center justify-center group"
            >
              <div className={`w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center transition-opacity ${isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100"}`}>
                {isPlaying ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white ml-1" />}
              </div>
            </button>
            {totalDuration > 0 && (
              <div className="absolute bottom-3 left-3 bg-black/60 rounded-lg px-2 py-1 text-[10px] text-white font-medium backdrop-blur-sm">
                ~{totalDuration}s
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-wrap justify-center">
            <Button onClick={handleDownload} className="gradient-bg text-white hover:opacity-90 shadow-lg gap-2 px-5">
              <Download className="w-4 h-4" />
              Download Video
            </Button>
            <Button variant="outline" onClick={() => window.open(videoUrl, "_blank")} className="gap-2 px-4">
              <ExternalLink className="w-4 h-4" />
              Open in Tab
            </Button>
          </div>

          <div className="text-center">
            <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              Saved to your Asset Library automatically
            </p>
          </div>

          <div className="rounded-2xl border border-border/50 bg-muted/10 p-4 grid grid-cols-3 divide-x divide-border/30 text-center">
            <div>
              <p className="text-[10px] text-muted-foreground">Structure</p>
              <p className="text-sm font-bold text-primary">3 Parts</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Est. Duration</p>
              <p className="text-xl font-bold text-primary">~37s</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Engine</p>
              <p className="text-sm font-bold text-primary">Seedance 2</p>
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <Button variant="ghost" onClick={onReset} className="gap-2 text-muted-foreground text-sm">
              <RotateCcw className="w-4 h-4" />
              Create Another Reel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
