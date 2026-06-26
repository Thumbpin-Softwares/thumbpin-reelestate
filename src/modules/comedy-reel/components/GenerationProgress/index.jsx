"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Clapperboard,
  RotateCcw,
  Mic,
  Video,
  User,
  Sparkles,
  FileText,
  Zap,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/utils/compress-image";

/** Probe video duration via browser <video> element (header only, no full download). */
async function getVideoDuration(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(0);
    const video = document.createElement("video");
    video.addEventListener("loadedmetadata", () => {
      const dur = isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
      video.src = "";
      resolve(dur);
    });
    video.addEventListener("error", () => resolve(0));
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.src = url;
  });
}

const STATUS = {
  IDLE:      "idle",
  SPLITTING: "splitting",
  VOICES:    "voices",
  SEEDANCE:  "seedance",
  RENDERING: "rendering",
  DONE:      "done",
  ERROR:     "error",
};

const STAGE_LABELS = {
  [STATUS.IDLE]:      "Starting…",
  [STATUS.SPLITTING]: "Splitting script into 2 parts…",
  [STATUS.VOICES]:    "Generating voiceovers for both parts…",
  [STATUS.SEEDANCE]:  "Generating 2 videos in parallel (Seedance 2.0)…",
  [STATUS.RENDERING]: "Rendering final reel via Remotion…",
  [STATUS.DONE]:      "Done!",
  [STATUS.ERROR]:     "Error",
};

const SEEDANCE_TIPS = [
  "Seedance 2.0 is rendering both comedic scenes simultaneously…",
  "Choreographing the hook — the door peek, the whisper, the big reveal…",
  "Building the highlights + CTA sequence from your property photos…",
  "Syncing lip movements to dialogue phonetics across both clips…",
  "Applying natural handheld camera movement and warm interior lighting…",
  "Rendering hyper-realistic skin texture and comedic timing…",
];

const ORDERED_STAGES = [
  STATUS.SPLITTING,
  STATUS.VOICES,
  STATUS.SEEDANCE,
  STATUS.RENDERING,
];

const JOB_STATUS_TO_LOCAL = {
  running:    STATUS.SPLITTING,
  splitting:  STATUS.SPLITTING,
  voices:     STATUS.VOICES,
  seedance:   STATUS.SEEDANCE,
};

function formatElapsed(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * GenerationProgress for the Comedy Reel pipeline — forked from
 * action-reel's GenerationProgress (same 2-video-slot shape, same
 * render-remotion + inline preview/download flow, no /app/edit handoff).
 */
export function GenerationProgress({
  generationParams,
  apiBasePath = "/api/comedy-reel",
  source = "comedy-reel",
  jobIdKey = "comedy_reel_job_id",
  resumeKey = "comedy_reel_resume",
  onReset,
}) {
  const {
    script       = "",
    voiceId      = "21m00Tcm4TlvDq8ikWAM",
    language     = "english",
    tone         = "luxury",
    locationImages = [],
    avatarUrls   = [],
  } = generationParams || {};

  const [status, setStatus] = useState(STATUS.IDLE);
  const [error, setError]   = useState(null);

  // Script split state
  const [part1, setPart1] = useState("");
  const [part2, setPart2] = useState("");

  // Asset URLs from SSE
  const [part1AudioUrl, setPart1AudioUrl] = useState(null);
  const [part2AudioUrl, setPart2AudioUrl] = useState(null);
  const [part1VideoUrl, setPart1VideoUrl] = useState(null);
  const [part2VideoUrl, setPart2VideoUrl] = useState(null);

  const [renderProgress, setRenderProgress] = useState("");
  const [finalVideoUrl, setFinalVideoUrl]   = useState(null);

  // Seedance waiting UX
  const [seedanceStart, setSeedanceStart]     = useState(null);
  const [seedanceElapsed, setSeedanceElapsed] = useState(0);
  const [tipIndex, setTipIndex]               = useState(0);
  const [fakeBonus, setFakeBonus]             = useState(0);

  const hasStarted = useRef(false);

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

  useEffect(() => {
    if (status !== STATUS.SEEDANCE) { setTipIndex(0); return; }
    const t = setInterval(() => setTipIndex(i => (i + 1) % SEEDANCE_TIPS.length), 4000);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => {
    if (status !== STATUS.SEEDANCE) { setFakeBonus(0); return; }
    const t = setInterval(() => setFakeBonus(p => Math.min(14, p + 0.04)), 1000);
    return () => clearInterval(t);
  }, [status]);

  const stageProgress  = ORDERED_STAGES.indexOf(status);
  const rawPercent     = status === STATUS.DONE ? 100 : status === STATUS.ERROR ? 0
    : Math.max(4, ((stageProgress + 1) / ORDERED_STAGES.length) * 90);
  const progressPercent = Math.round(Math.min(96, rawPercent + (status === STATUS.RENDERING ? 0 : fakeBonus)));

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    let existingJobId = null;
    try { existingJobId = sessionStorage.getItem(jobIdKey); } catch (_) {}

    if (existingJobId) {
      resumeJob(existingJobId);
    } else {
      startPipeline();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resumeJob = async (jobId) => {
    setStatus(STATUS.SPLITTING);

    const poll = async () => {
      try {
        const res = await fetch(`${apiBasePath}/jobs/${jobId}`);
        if (res.status === 404) {
          try { sessionStorage.removeItem(jobIdKey); } catch (_) {}
          startPipeline();
          return;
        }
        if (!res.ok) throw new Error(`Resume failed: ${res.status}`);

        const { job } = await res.json();
        if (job.part1) setPart1(job.part1);
        if (job.part2) setPart2(job.part2);
        if (job.part1AudioUrl) setPart1AudioUrl(job.part1AudioUrl);
        if (job.part2AudioUrl) setPart2AudioUrl(job.part2AudioUrl);
        if (job.part1VideoUrl) setPart1VideoUrl(job.part1VideoUrl);
        if (job.part2VideoUrl) setPart2VideoUrl(job.part2VideoUrl);

        if (job.status === "done") {
          try { sessionStorage.removeItem(jobIdKey); } catch (_) {}
          await renderFinal(job.part1VideoUrl, job.part2VideoUrl);
          return;
        }
        if (job.status === "error") {
          try { sessionStorage.removeItem(jobIdKey); } catch (_) {}
          setStatus(STATUS.ERROR);
          setError(job.error || "Generation failed");
          return;
        }

        if (JOB_STATUS_TO_LOCAL[job.status]) setStatus(JOB_STATUS_TO_LOCAL[job.status]);
        setTimeout(poll, 3000);
      } catch (err) {
        console.error("[ComedyReel] Resume poll failed:", err);
        setTimeout(poll, 5000);
      }
    };

    poll();
  };

  const startPipeline = async () => {
    setStatus(STATUS.IDLE);
    setError(null);
    setPart1(""); setPart2("");
    setPart1AudioUrl(null); setPart2AudioUrl(null);
    setPart1VideoUrl(null); setPart2VideoUrl(null);
    setFinalVideoUrl(null);
    setFakeBonus(0);

    const jobId = crypto.randomUUID();
    try { sessionStorage.setItem(jobIdKey, jobId); } catch (_) {}

    try {
      const formData = new FormData();
      formData.append("jobId", jobId);
      formData.append("script", script);
      formData.append("voiceId", voiceId);
      formData.append("language", language);
      formData.append("tone", tone);

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

      const res = await fetch(`${apiBasePath}/generate-pipeline`, { method: "POST", body: formData });
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
      console.error("[ComedyReel] Error:", err);
      try { sessionStorage.removeItem(jobIdKey); } catch (_) {}
      setStatus(STATUS.ERROR);
      setError(err.message || "Pipeline failed");
      toast.error("Generation failed", { description: err.message });
    }
  };

  const handleEvent = useCallback((event) => {
    switch (event.type) {
      case "script_splitting":
      case "script_adapting":
        setStatus(STATUS.SPLITTING);
        break;

      case "script_split":
        setPart1(event.part1 || "");
        setPart2(event.part2 || "");
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
      case "seedance_generating":
        setStatus(STATUS.SEEDANCE);
        break;

      case "part1_video_done":
        setPart1VideoUrl(event.part1VideoUrl);
        toast.success("Part 1 (hook) video ready!");
        break;

      case "part2_video_done":
        setPart2VideoUrl(event.part2VideoUrl);
        toast.success("Part 2 (highlights + CTA) video ready!");
        break;

      case "seedance_error":
        toast.warning(event.message, { duration: 8000 });
        break;

      case "uploading":
        break;

      case "video_ready":
        renderFinal(event.part1VideoUrl, event.part2VideoUrl);
        break;

      case "error":
        try { sessionStorage.removeItem(jobIdKey); } catch (_) {}
        setStatus(STATUS.ERROR);
        setError(event.message || "Pipeline failed");
        toast.error("Pipeline error", { description: event.message });
        break;

      default:
        break;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Both Seedance clips already carry baked, lip-synced audio — stitching
   * them is just a hard-cut Remotion render, no Player/editor step needed. */
  const renderFinal = async (p1Url, p2Url) => {
    if (!p1Url && !p2Url) {
      setStatus(STATUS.ERROR);
      setError("No videos were generated. Check server logs.");
      return;
    }

    setStatus(STATUS.RENDERING);
    setRenderProgress("Probing video durations…");

    try {
      const [part1Duration, part2Duration] = await Promise.all([
        getVideoDuration(p1Url),
        getVideoDuration(p2Url),
      ]);

      setRenderProgress("Stitching both clips together via Remotion…");

      const res = await fetch(`${apiBasePath}/render-remotion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          part1VideoUrl: p1Url || "",
          part2VideoUrl: p2Url || "",
          part1Duration: part1Duration > 0 ? part1Duration : 15,
          part2Duration: part2Duration > 0 ? part2Duration : 15,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Render failed");

      try { sessionStorage.removeItem(jobIdKey); } catch (_) {}
      try { sessionStorage.removeItem(resumeKey); } catch (_) {}
      setFinalVideoUrl(data.url);
      setStatus(STATUS.DONE);
      toast.success("🎬 Comedy Reel ready!");
    } catch (err) {
      console.error("[ComedyReel] renderFinal failed:", err);
      setStatus(STATUS.ERROR);
      setError(`Final render failed: ${err.message}`);
    }
  };

  const isGenerating = ![STATUS.DONE, STATUS.ERROR, STATUS.IDLE].includes(status);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold font-heading tracking-tight">
          {status === STATUS.DONE
            ? "Your Comedy Reel is Ready!"
            : status === STATUS.RENDERING
            ? "Rendering Final Reel…"
            : "Generating Comedy Reel"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {status === STATUS.DONE
            ? "Preview and download below"
            : status === STATUS.RENDERING
            ? renderProgress || "Stitching both clips together…"
            : STAGE_LABELS[status] || "Processing…"}
        </p>
      </div>

      {/* ── Progress bar ───────────────────────────────────────────────────── */}
      {status !== STATUS.DONE && status !== STATUS.ERROR && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium truncate max-w-[75%]">
              {status === STATUS.RENDERING ? renderProgress : STAGE_LABELS[status] || "Processing…"}
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
            const names    = ["Split", "Voiceovers", "2 Videos", "Render"];
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
      {(part1 || part2) && status !== STATUS.DONE && (
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-blue-200/60 bg-blue-50/40 dark:border-blue-700/20 dark:bg-blue-900/10 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <User className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">Part 1 — Hook</span>
            </div>
            <p className="text-[11px] text-blue-800 dark:text-blue-200 leading-relaxed">{part1}</p>
            {part1AudioUrl && (
              <div className="flex items-center gap-1 text-[10px] text-emerald-600">
                <CheckCircle2 className="w-3 h-3" /> Voice ready
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-orange-200/60 bg-orange-50/40 dark:border-orange-700/20 dark:bg-orange-900/10 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-orange-600 dark:text-orange-400" />
              <span className="text-[10px] font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wide">Part 2 — Highlights + CTA</span>
            </div>
            <p className="text-[11px] text-orange-800 dark:text-orange-200 leading-relaxed line-clamp-4">{part2}</p>
            {part2AudioUrl && (
              <div className="flex items-center gap-1 text-[10px] text-emerald-600">
                <CheckCircle2 className="w-3 h-3" /> Voice ready
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Seedance 2.0 waiting card ──────────────────────────────────────── */}
      {status === STATUS.SEEDANCE && (
        <div className="rounded-2xl border border-violet-200/60 bg-violet-50/40 dark:border-violet-800/20 dark:bg-violet-900/10 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="relative mt-0.5 shrink-0">
              <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                <Zap className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-violet-400/60 animate-ping" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-violet-800 dark:text-violet-200">
                Seedance 2.0 — 2 videos generating in parallel
              </p>
              <p className="text-xs text-violet-600/80 dark:text-violet-400/80 mt-0.5 flex items-center gap-1.5">
                <Clock className="w-3 h-3 shrink-0" />
                Running for {formatElapsed(seedanceElapsed)} · typical: 3–7 minutes
              </p>
            </div>
            <div className="shrink-0 rounded-lg bg-violet-100 dark:bg-violet-900/50 border border-violet-200/60 dark:border-violet-700/30 px-2.5 py-1 text-center min-w-14">
              <p className="text-base font-bold font-mono text-violet-700 dark:text-violet-300 tabular-nums">
                {formatElapsed(seedanceElapsed)}
              </p>
              <p className="text-[9px] text-violet-500 uppercase tracking-wide">elapsed</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Part 1 — Hook", url: part1VideoUrl },
              { label: "Part 2 — Highlights + CTA", url: part2VideoUrl },
            ].map(({ label, url }) => (
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

          <div className="rounded-xl bg-white/60 dark:bg-white/5 border border-violet-100 dark:border-violet-800/30 px-3 py-2.5 min-h-10">
            <p
              key={tipIndex}
              className="text-[11px] text-violet-700 dark:text-violet-300 leading-relaxed"
              style={{ animation: "fadeInUp 0.4s ease" }}
            >
              {SEEDANCE_TIPS[tipIndex]}
            </p>
          </div>

          <div className="flex items-center gap-1.5 justify-center">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 dark:bg-violet-500"
                style={{ animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite` }} />
            ))}
          </div>

          <p className="text-[10px] text-center text-violet-500 dark:text-violet-500/70">
            Do not close or refresh this tab — both generations will be lost.
          </p>
        </div>
      )}
      <style>{`
        @keyframes fadeInUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes bounce { 0%,80%,100%{ transform:scaleY(1); } 40%{ transform:scaleY(1.6); } }
      `}</style>

      {/* ── General status card (non-Seedance active stages) ──────────────── */}
      {isGenerating && status !== STATUS.SEEDANCE && status !== STATUS.RENDERING && (
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

      {/* ── Rendering status card ───────────────────────────────────────────── */}
      {status === STATUS.RENDERING && (
        <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 flex gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Clapperboard className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">{renderProgress || STAGE_LABELS[status]}</p>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              Hard-cutting both clips together — usually under a minute.
            </p>
          </div>
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {status === STATUS.ERROR && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">
              {part1VideoUrl && part2VideoUrl ? "Final render failed" : "Generation failed"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
            {part1VideoUrl && part2VideoUrl && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Both videos already generated — retrying just re-stitches them, no credits used.
              </p>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (part1VideoUrl && part2VideoUrl) {
                  setError(null);
                  renderFinal(part1VideoUrl, part2VideoUrl);
                } else {
                  hasStarted.current = false;
                  startPipeline();
                }
              }}
              className="mt-3 gap-2 text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* ── Done — inline preview + download (no /app/edit handoff) ────────── */}
      {status === STATUS.DONE && finalVideoUrl && (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-full max-w-72 rounded-2xl overflow-hidden border border-border/40 bg-black" style={{ aspectRatio: "9/16" }}>
            <video src={finalVideoUrl} controls playsInline className="w-full h-full object-contain" />
          </div>
          <div className="flex gap-3">
            <a href={finalVideoUrl} download={`${source}.mp4`}>
              <Button className="gap-2 bg-neutral-900 text-[#c7f038] hover:opacity-90 hover:bg-neutral-900">
                <Download className="w-4 h-4" />
                Download
              </Button>
            </a>
            {onReset && (
              <Button variant="outline" onClick={onReset} className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Create Another
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
