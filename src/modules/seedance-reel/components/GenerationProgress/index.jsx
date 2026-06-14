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
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/utils/compress-image";
import { combineVideos, uploadCombinedVideo, concatWithAudio } from "@/lib/video-combiner";

/** Lightweight audio duration probe via browser <audio> element (reads header only). */
async function getAudioDuration(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(0);
    const audio = new Audio();
    audio.addEventListener("loadedmetadata", () => {
      const dur = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
      audio.src = "";
      resolve(dur);
    });
    audio.addEventListener("error", () => resolve(0));
    audio.crossOrigin = "anonymous";
    audio.preload = "metadata";
    audio.src = url;
  });
}

const STATUS = {
  IDLE: "idle",
  SPLITTING: "splitting",
  VOICE_PART1: "voice_part1",
  PROMPT_BUILDING: "prompt_building",
  SEEDANCE: "seedance",
  VOICE_PART2: "voice_part2",
  BROLL: "broll",
  COMBINING: "combining",
  DONE: "done",
  ERROR: "error",
};

const STAGE_LABELS = {
  [STATUS.IDLE]: "Starting…",
  [STATUS.SPLITTING]: "Splitting script into avatar + B-roll parts…",
  [STATUS.VOICE_PART1]: "Generating lip-sync reference audio (ElevenLabs)…",
  [STATUS.PROMPT_BUILDING]: "Building Seedance avatar video prompt…",
  [STATUS.SEEDANCE]: "Generating avatar video (Seedance 2.0)…",
  [STATUS.VOICE_PART2]: "Generating Part 2 voiceover (ElevenLabs)…",
  [STATUS.BROLL]: "Generating property B-roll clips…",
  [STATUS.COMBINING]: "Assembling final reel (FFmpeg)…",
  [STATUS.DONE]: "Done!",
  [STATUS.ERROR]: "Error",
};

const SEEDANCE_TIPS = [
  "Seedance 2.0 is analysing your identity images and rendering the avatar…",
  "Placing your presenter in the luxury entrance scene…",
  "Syncing lip movements to the dialogue phonetics…",
  "Applying natural handheld camera stabilisation…",
  "Rendering skin texture and ambient lighting…",
];

// Ordered pipeline stages for the progress rail
const ORDERED_STAGES = [
  STATUS.SPLITTING,
  STATUS.VOICE_PART1,
  STATUS.PROMPT_BUILDING,
  STATUS.SEEDANCE,
  STATUS.VOICE_PART2,
  STATUS.BROLL,
  STATUS.COMBINING,
];

function formatElapsed(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function GenerationProgress({ generationParams, onReset }) {
  const {
    script = "",
    voiceId = "21m00Tcm4TlvDq8ikWAM",
    language = "english",
    locationImages = [],
    avatarUrls = [],
  } = generationParams || {};

  const [status, setStatus] = useState(STATUS.IDLE);
  const [message, setMessage] = useState("Starting Seedance Reel pipeline…");
  const [error, setError] = useState(null);

  // Script split state
  const [part1, setPart1] = useState("");
  const [part2, setPart2] = useState("");

  // Asset URLs from SSE
  const [part1AudioUrl, setPart1AudioUrl] = useState(null);
  const [part2AudioUrl, setPart2AudioUrl] = useState(null);
  const [avatarVideoUrl, setAvatarVideoUrl] = useState(null);
  const [seedancePrompt, setSeedancePrompt] = useState("");
  const [brollClips, setBrollClips] = useState([]);
  const [brollDone, setBrollDone] = useState([]);

  // Final output
  const [videoUrl, setVideoUrl] = useState(null);
  const [combineProgress, setCombineProgress] = useState("");
  const [totalDuration, setTotalDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Seedance waiting UX
  const [seedanceStart, setSeedanceStart] = useState(null);
  const [seedanceElapsed, setSeedanceElapsed] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  // Fake progress fill during long stages (slow increment, reset on stage change)
  const [fakeBonus, setFakeBonus] = useState(0);

  const videoRef = useRef(null);
  const hasStarted = useRef(false);

  // ── Elapsed timer for SEEDANCE stage ──────────────────────────────────────
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
    const t = setInterval(() => {
      setSeedanceElapsed(Math.floor((Date.now() - seedanceStart) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [seedanceStart]);

  // ── Rotating tips during SEEDANCE ─────────────────────────────────────────
  useEffect(() => {
    if (status !== STATUS.SEEDANCE) { setTipIndex(0); return; }
    const t = setInterval(() => setTipIndex(i => (i + 1) % SEEDANCE_TIPS.length), 4000);
    return () => clearInterval(t);
  }, [status]);

  // ── Fake progress fill during SEEDANCE / BROLL ────────────────────────────
  useEffect(() => {
    if (status !== STATUS.SEEDANCE && status !== STATUS.BROLL) {
      setFakeBonus(0);
      return;
    }
    // +0.04% per second ≈ 12% over 5 minutes
    const t = setInterval(() => setFakeBonus(p => Math.min(14, p + 0.04)), 1000);
    return () => clearInterval(t);
  }, [status]);

  const stageProgress = ORDERED_STAGES.indexOf(status);
  const rawPercent = status === STATUS.DONE
    ? 100
    : status === STATUS.ERROR
    ? 0
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
    setPart1("");
    setPart2("");
    setPart1AudioUrl(null);
    setPart2AudioUrl(null);
    setAvatarVideoUrl(null);
    setBrollClips([]);
    setBrollDone([]);
    setVideoUrl(null);
    setFakeBonus(0);

    try {
      const formData = new FormData();
      formData.append("script", script);
      formData.append("voiceId", voiceId);
      formData.append("language", language);

      avatarUrls.slice(0, 3).forEach((url, i) => {
        formData.append(`avatarUrl_${i}`, url);
      });

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

      const res = await fetch("/api/seedance-reel/generate-pipeline", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error: ${res.status}`);
      }
      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const eventBlock of events) {
          for (const line of eventBlock.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              handleEvent(event);
            } catch (_) {}
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
        setStatus(STATUS.SPLITTING);
        break;

      case "script_adapting":
        setStatus(STATUS.SPLITTING);
        break;

      case "script_split":
        setPart1(event.part1 || "");
        setPart2(event.part2 || "");
        setStatus(STATUS.SPLITTING);
        break;

      case "voice_generating":
        setStatus(event.part === 2 ? STATUS.VOICE_PART2 : STATUS.VOICE_PART1);
        break;

      case "voice_part1_ready":
        setPart1AudioUrl(event.audioUrl);
        setStatus(STATUS.PROMPT_BUILDING);
        break;

      case "voice_warning":
        toast.warning(event.message, { duration: 6000 });
        break;

      case "seedance_prompt_generating":
        setStatus(STATUS.PROMPT_BUILDING);
        break;

      case "seedance_prompt_ready":
        setSeedancePrompt(event.prompt || "");
        setStatus(STATUS.SEEDANCE);
        break;

      case "seedance_generating":
        setStatus(STATUS.SEEDANCE);
        break;

      case "seedance_done":
        setAvatarVideoUrl(event.avatarVideoUrl);
        toast.success("Avatar video ready!");
        break;

      case "seedance_error":
        toast.warning(event.message, { duration: 8000 });
        break;

      case "voice_part2_ready":
        setPart2AudioUrl(event.audioUrl);
        setStatus(STATUS.BROLL);
        break;

      case "broll_generating":
        setStatus(STATUS.BROLL);
        break;

      case "broll_done":
        setBrollClips((prev) => {
          const next = [...prev];
          next[event.index] = { url: event.clipUrl, isAnimated: event.isAnimated };
          return next;
        });
        setBrollDone((prev) => [...new Set([...prev, event.index])]);
        break;

      case "uploading":
        setMessage(event.message || "Saving…");
        break;

      case "video_ready":
        setTotalDuration(event.totalDuration || 0);
        // With generate_audio:true, Part 1 audio is baked into avatar video by Seedance.
        // Two-step combine: B-roll clips + Part 2 TTS → then concat with avatar video.
        triggerCombine(event.avatarVideoUrl, event.brollClips || [], event.part2AudioUrl);
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
   *   Step 1 — combineVideos(brollClips, { fullAudioUrl: part2TTS })
   *             → B-roll video with ElevenLabs Part 2 narration
   *   Step 2 — concatWithAudio([avatarVideoUrl (Seedance audio), brollBlobUrl])
   *             → preserves Seedance-generated voice for Part 1
   */
  const triggerCombine = async (avVideoUrl, brolls, p2AudioUrl) => {
    const resolvedAvatarUrl = avVideoUrl || avatarVideoUrl;
    const resolvedBrolls = (brolls || brollClips).filter(Boolean);
    const resolvedP2Audio = p2AudioUrl || part2AudioUrl;

    if (!resolvedAvatarUrl && resolvedBrolls.length === 0) {
      setStatus(STATUS.ERROR);
      setError("No clips were generated. Check server logs.");
      return;
    }

    setStatus(STATUS.COMBINING);
    setCombineProgress("Preparing assembly…");

    try {
      const brollUrls = resolvedBrolls.map(b => b.url);

      // ── Edge: no B-roll ────────────────────────────────────────────────────
      if (resolvedBrolls.length === 0 || !resolvedAvatarUrl) {
        if (resolvedAvatarUrl && resolvedBrolls.length === 0) {
          setVideoUrl(resolvedAvatarUrl);
          setStatus(STATUS.DONE);
          toast.success("🎬 Avatar video ready!");
          return;
        }
        if (!resolvedAvatarUrl) {
          // Only B-roll, no avatar — standard combine
          const { blobUrl, blob } = await combineVideos(brollUrls, {
            onProgress: (msg) => setCombineProgress(msg),
            fullAudioUrl: resolvedP2Audio,
          });
          try {
            const { url } = await uploadCombinedVideo(blob, `seedance-reel-${Date.now()}.mp4`);
            setVideoUrl(url);
          } catch { setVideoUrl(blobUrl); }
          setStatus(STATUS.DONE);
          toast.success("🎬 Reel assembled!");
          return;
        }
      }

      // ── Step 1: Combine B-roll clips with Part 2 TTS ──────────────────────
      // Measure Part 2 audio duration so each B-roll clip is looped/extended to fill it.
      // Without this, Hailuo clips (~5-8s each) would run out before the voiceover ends.
      setCombineProgress("Step 1/2 — Measuring voiceover duration…");
      let brollDurations;
      if (resolvedP2Audio) {
        const audioDur = await getAudioDuration(resolvedP2Audio);
        if (audioDur > 0 && brollUrls.length > 0) {
          const perClip = Math.ceil(audioDur / brollUrls.length) + 1; // +1s ensures video ≥ audio
          brollDurations = brollUrls.map(() => perClip);
          setCombineProgress(`Step 1/2 — ${brollUrls.length} clips × ${perClip}s to cover ${Math.round(audioDur)}s voiceover…`);
        }
      }

      setCombineProgress("Step 1/2 — Combining B-roll with voiceover…");
      const { blob: brollBlob } = await combineVideos(brollUrls, {
        onProgress: (msg) => setCombineProgress(`Step 1/2 — ${msg}`),
        fullAudioUrl: resolvedP2Audio,
        durations: brollDurations,
      });
      const brollBlobUrl = URL.createObjectURL(brollBlob);

      // ── Step 2: Concat avatar (Seedance audio) + B-roll (Part 2 audio) ───
      setCombineProgress("Step 2/2 — Joining avatar + B-roll…");
      const { blobUrl, blob } = await concatWithAudio(
        [resolvedAvatarUrl, brollBlobUrl],
        { onProgress: (msg) => setCombineProgress(`Step 2/2 — ${msg}`) }
      );

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
      const fallback = avVideoUrl || avatarVideoUrl || resolvedBrolls[0]?.url;
      if (fallback) {
        setVideoUrl(fallback);
        setStatus(STATUS.DONE);
        toast.warning("Auto-combine failed — showing avatar clip directly.");
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
            {/* Shimmer during active stages */}
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
            const isDone = idx < stageIdx;
            const isActive = idx === stageIdx;
            const icons = [FileText, Mic, Sparkles, Video, Mic, Video, Clapperboard];
            const StageIcon = icons[idx] || Sparkles;
            const names = ["Split", "Ref Audio", "Prompt", "Seedance", "Narration", "B-Roll", "Assemble"];

            return (
              <div key={stage} className="flex items-center shrink-0">
                {idx > 0 && (
                  <div className={`h-0.5 w-4 sm:w-6 transition-colors duration-700 ${isDone ? "bg-primary" : "bg-border/40"}`} />
                )}
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                    isDone
                      ? "border-primary bg-primary shadow-sm shadow-primary/30"
                      : isActive
                      ? "border-primary bg-primary/10"
                      : "border-border/40 bg-muted/20"
                  }`}>
                    {isDone ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    ) : isActive ? (
                      <Loader2 className="w-3 h-3 text-primary animate-spin" />
                    ) : (
                      <StageIcon className="w-3 h-3 text-muted-foreground/60" />
                    )}
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
      {(part1 || part2) && status !== STATUS.DONE && (
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-blue-200/60 bg-blue-50/40 dark:border-blue-700/20 dark:bg-blue-900/10 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                Part 1 — Avatar Talking
              </span>
            </div>
            <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">{part1}</p>
            {part1AudioUrl && (
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                Lip-sync reference audio ready
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/40 dark:border-emerald-700/20 dark:bg-emerald-900/10 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
                Part 2 — B-Roll Voiceover
              </span>
            </div>
            <p className="text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed line-clamp-4">{part2}</p>
            {part2AudioUrl && (
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                Voiceover generated
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Seedance 2.0 waiting card (shown only during SEEDANCE stage) ───── */}
      {status === STATUS.SEEDANCE && (
        <div className="rounded-2xl border border-violet-200/60 bg-violet-50/40 dark:border-violet-800/20 dark:bg-violet-900/10 p-5 space-y-4">
          {/* Header row */}
          <div className="flex items-start gap-3">
            <div className="relative mt-0.5 shrink-0">
              <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                <Zap className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              {/* Pulsing ring */}
              <div className="absolute inset-0 rounded-full border-2 border-violet-400/60 animate-ping" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-violet-800 dark:text-violet-200">
                Seedance 2.0 is rendering your avatar
              </p>
              <p className="text-xs text-violet-600/80 dark:text-violet-400/80 mt-0.5 flex items-center gap-1.5">
                <Clock className="w-3 h-3 shrink-0" />
                Running for {formatElapsed(seedanceElapsed)} · typical: 3–7 minutes
              </p>
            </div>
            {/* Live elapsed badge */}
            <div className="shrink-0 rounded-lg bg-violet-100 dark:bg-violet-900/50 border border-violet-200/60 dark:border-violet-700/30 px-2.5 py-1 text-center min-w-14">
              <p className="text-base font-bold font-mono text-violet-700 dark:text-violet-300 tabular-nums">
                {formatElapsed(seedanceElapsed)}
              </p>
              <p className="text-[9px] text-violet-500 dark:text-violet-500 uppercase tracking-wide">elapsed</p>
            </div>
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
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-violet-400 dark:bg-violet-500"
                style={{ animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite` }}
              />
            ))}
          </div>

          <p className="text-[10px] text-center text-violet-500 dark:text-violet-500/70">
            Do not close or refresh this tab — the generation will be lost.
          </p>
        </div>
      )}
      <style>{`
        @keyframes fadeInUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes bounce { 0%,80%,100%{ transform:scaleY(1); } 40%{ transform:scaleY(1.6); } }
      `}</style>

      {/* ── General status card (all other active stages) ──────────────────── */}
      {isGenerating && status !== STATUS.SEEDANCE && status !== STATUS.COMBINING && (
        <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 flex gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            {status === STATUS.VOICE_PART1 || status === STATUS.VOICE_PART2
              ? <Mic className="w-4 h-4 text-primary" />
              : status === STATUS.BROLL
              ? <Video className="w-4 h-4 text-primary" />
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

      {/* ── Seedance prompt preview ────────────────────────────────────────── */}
      {seedancePrompt && status !== STATUS.DONE && (
        <div className="rounded-xl border border-violet-200/60 bg-violet-50/40 dark:border-violet-700/20 dark:bg-violet-900/10 p-3">
          <p className="text-[10px] text-violet-600 dark:text-violet-400 font-semibold uppercase tracking-wide mb-1.5">
            Seedance Prompt
          </p>
          <p className="text-[11px] text-violet-800 dark:text-violet-200 leading-relaxed">
            {seedancePrompt}
          </p>
        </div>
      )}

      {/* ── B-roll status strip ────────────────────────────────────────────── */}
      {locationImages.length > 0 && status !== STATUS.DONE && (status === STATUS.BROLL || brollDone.length > 0) && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">B-Roll Clips</p>
          <div className="flex gap-2 flex-wrap">
            {locationImages.map((_, i) => {
              const done = brollDone.includes(i);
              const clip = brollClips[i];
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all ${
                    done ? "border-primary bg-primary/10" : "border-border/40 bg-muted/20 animate-pulse"
                  }`}>
                    {done
                      ? clip?.isAnimated
                        ? <Video className="w-4 h-4 text-primary" />
                        : <CheckCircle2 className="w-4 h-4 text-primary" />
                      : <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
                    }
                  </div>
                  <span className="text-[9px] text-muted-foreground">
                    {done ? (clip?.isAnimated ? "Animated" : "Static") : "…"}
                  </span>
                  {done && clip?.url && (
                    <a href={clip.url} target="_blank" rel="noopener noreferrer"
                      className="text-[9px] text-primary hover:underline">
                      view
                    </a>
                  )}
                </div>
              );
            })}
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
              onClick={() => {
                if (!videoRef.current) return;
                isPlaying ? videoRef.current.pause() : videoRef.current.play();
              }}
              className="absolute inset-0 flex items-center justify-center group"
            >
              <div className={`w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center transition-opacity ${
                isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100"
              }`}>
                {isPlaying
                  ? <Pause className="w-6 h-6 text-white" />
                  : <Play className="w-6 h-6 text-white ml-1" />
                }
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
              <p className="text-[10px] text-muted-foreground">Parts</p>
              <p className="text-xl font-bold text-primary">2</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">B-Roll Clips</p>
              <p className="text-xl font-bold text-primary">{brollClips.filter(Boolean).length}</p>
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
