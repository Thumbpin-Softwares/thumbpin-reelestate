"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/utils/compress-image";
import { clampBrollClips } from "@/lib/remotion/duration";

/** Probe audio duration via browser <audio> element (header only, no full download). */
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
  COMBINING: "combining",
  DONE:      "done",
  ERROR:     "error",
};

const STAGE_LABELS = {
  [STATUS.IDLE]:      "Starting…",
  [STATUS.SPLITTING]: "Splitting script into 3 parts…",
  [STATUS.VOICES]:    "Generating voiceovers for all 3 parts…",
  [STATUS.SEEDANCE]:  "Generating 3 videos in parallel (Seedance 2.0)…",
  [STATUS.COMBINING]: "Preparing Remotion composition…",
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

const JOB_STATUS_TO_LOCAL = {
  running:    STATUS.SPLITTING,
  splitting:  STATUS.SPLITTING,
  voices:     STATUS.VOICES,
  seedance:   STATUS.SEEDANCE,
  combining:  STATUS.COMBINING,
};

function formatElapsed(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * GenerationProgress drives the same Seedance 3-part pipeline for any route
 * that wants its own independent API/job-tracking — pass apiBasePath/editPath
 * (and the sessionStorage keys) to point it at that route's own endpoints
 * instead of the seedance-reel defaults.
 */
export function GenerationProgress({
  generationParams,
  apiBasePath = "/api/seedance-reel",
  source = "seedance-reel",
  editPath = "/app/edit",
  jobIdKey = "seedance_job_id",
  compositionKey = "video_composition",
  resumeKey = "seedance_resume",
}) {
  const router = useRouter();
  const {
    script       = "",
    voiceId      = "21m00Tcm4TlvDq8ikWAM",
    language     = "english",
    tone         = "luxury",
    voiceSettings = null,
    locationImages = [],
    avatarUrls   = [],
  } = generationParams || {};

  const [status, setStatus]               = useState(STATUS.IDLE);
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

  const [combineProgress, setCombineProgress] = useState("");

  // Seedance waiting UX
  const [seedanceStart, setSeedanceStart]     = useState(null);
  const [seedanceElapsed, setSeedanceElapsed] = useState(0);
  const [tipIndex, setTipIndex]               = useState(0);
  const [fakeBonus, setFakeBonus]             = useState(0);

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

    let existingJobId = null;
    try { existingJobId = sessionStorage.getItem(jobIdKey); } catch (_) {}

    if (existingJobId) {
      resumeJob(existingJobId);
    } else {
      startPipeline();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Re-attach to an already-running (or finished) job instead of re-POSTing,
   * which would double-bill credits and double-fire the fal/Seedance calls. */
  const resumeJob = async (jobId) => {
    setStatus(STATUS.SPLITTING);

    const poll = async () => {
      try {
        const res = await fetch(`${apiBasePath}/jobs/${jobId}`);
        if (res.status === 404) {
          // Job record gone (cleared/expired) — nothing to resume from.
          try { sessionStorage.removeItem(jobIdKey); } catch (_) {}
          startPipeline();
          return;
        }
        if (!res.ok) throw new Error(`Resume failed: ${res.status}`);

        const { job } = await res.json();
        if (job.part1) setPart1(job.part1);
        if (job.part2) setPart2(job.part2);
        if (job.part3Cta) setPart3Cta(job.part3Cta);
        if (job.part1AudioUrl) setPart1AudioUrl(job.part1AudioUrl);
        if (job.part2AudioUrl) setPart2AudioUrl(job.part2AudioUrl);
        if (job.avatarVideoUrl) setAvatarVideoUrl(job.avatarVideoUrl);
        if (job.walkthroughVideoUrl) setWalkthroughVideoUrl(job.walkthroughVideoUrl);
        if (job.ctaVideoUrl) setCtaVideoUrl(job.ctaVideoUrl);

        if (job.status === "done") {
          try { sessionStorage.removeItem(jobIdKey); } catch (_) {}
          await prepareComposition(job.avatarVideoUrl, job.walkthroughVideoUrl, job.ctaVideoUrl, job.part2AudioUrl);
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
        console.error("[GenerationProgress] Resume poll failed:", err);
        setTimeout(poll, 5000);
      }
    };

    poll();
  };

  const startPipeline = async () => {
    setStatus(STATUS.IDLE);
    setError(null);
    setPart1(""); setPart2(""); setPart3Cta("");
    setPart1AudioUrl(null); setPart2AudioUrl(null);
    setAvatarVideoUrl(null); setWalkthroughVideoUrl(null); setCtaVideoUrl(null);
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
      if (voiceSettings) formData.append("voiceSettings", JSON.stringify(voiceSettings));

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
      console.error("[GenerationProgress] Error:", err);
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
        toast.success("Intro avatar video ready!");
        break;

      case "walkthrough_done":
        setWalkthroughVideoUrl(event.walkthroughVideoUrl);
        toast.success("Property walkthrough ready!");
        break;

      case "seedance_cta_done":
        setCtaVideoUrl(event.ctaVideoUrl);
        toast.success("CTA avatar video ready!");
        break;

      case "seedance_error":
        toast.warning(event.message, { duration: 8000 });
        break;

      case "uploading":
        break;

      case "video_ready":
        prepareComposition(
          event.avatarVideoUrl,
          event.walkthroughVideoUrl,
          event.ctaVideoUrl,
          event.part2AudioUrl
        );
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

  /**
   * After all 3 Seedance videos are ready, probe their durations and
   * build the Remotion composition props for immediate preview.
   *
   * brollClips shape: Array<{ url, videoDuration, segmentDuration }>
   *   segmentDuration = how long to display the clip (= Part 2 audio duration for 1 clip)
   *   playbackRate is computed inside the composition: min(1, videoDuration / segmentDuration)
   *   so a 12s clip filling a 25s segment plays at 0.48× speed (luxury slow-motion)
   */
  const prepareComposition = async (avUrl, wtUrl, ctaUrl, p2Audio) => {
    if (![avUrl, wtUrl, ctaUrl].some(Boolean)) {
      setStatus(STATUS.ERROR);
      setError("No videos were generated. Check server logs.");
      return;
    }

    setStatus(STATUS.COMBINING);
    setCombineProgress("Probing video durations for Remotion composition…");

    try {
      const [avatarDur, walkthroughVideoDur, ctaDur, part2AudioDur] = await Promise.all([
        getVideoDuration(avUrl),
        getVideoDuration(wtUrl),
        getVideoDuration(ctaUrl),
        getAudioDuration(p2Audio),
      ]);

      const avatarDuration = avatarDur > 0 ? avatarDur : 15;
      const ctaDuration    = ctaDur > 0 ? ctaDur : 10;

      // segmentDuration = full Part 2 audio length — the clip will be slowed to fill it
      const videoDuration   = walkthroughVideoDur > 0 ? walkthroughVideoDur : 12;
      const segmentDuration = part2AudioDur > 0 ? part2AudioDur : videoDuration;

      const rawBrollClips = wtUrl
        ? [{ url: wtUrl, videoDuration, segmentDuration }]
        : [];

      // Keep the merged reel at 60s max — the Part 2 voiceover length is the
      // only elastic part, so it's the one that gets compressed if needed.
      const brollClips = clampBrollClips({ avatarDuration, brollClips: rawBrollClips, ctaDuration });

      const props = {
        source,
        avatarVideoUrl: avUrl  || "",
        brollClips,
        ctaVideoUrl:    ctaUrl || "",
        part2AudioUrl:  p2Audio || "",
        avatarDuration,
        ctaDuration,
        ctaText: part3Cta || "",
      };

      sessionStorage.setItem(compositionKey, JSON.stringify(props));
      try { sessionStorage.removeItem(jobIdKey); } catch (_) {}
      try { sessionStorage.removeItem(resumeKey); } catch (_) {}
      setStatus(STATUS.DONE);
      toast.success("🎬 Reel ready! Opening editor…");
      router.push(editPath);
    } catch (err) {
      console.error("[GenerationProgress] prepareComposition failed:", err);
      setStatus(STATUS.ERROR);
      setError(`Composition prep failed: ${err.message}`);
    }
  };

  const isGenerating = ![STATUS.DONE, STATUS.ERROR, STATUS.IDLE].includes(status);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold font-heading tracking-tight">
          {status === STATUS.DONE
            ? "Opening Editor…"
            : status === STATUS.COMBINING
            ? "Building Remotion Composition…"
            : "Generating Seedance Reel"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {status === STATUS.DONE
            ? "Taking you to the edit page"
            : status === STATUS.COMBINING
            ? combineProgress || "Probing durations and preparing Remotion Player…"
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

      {/* Done — navigating to editor automatically */}
      {status === STATUS.DONE && (
        <div className="flex flex-col items-center gap-3 py-6">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Redirecting to editor…</p>
        </div>
      )}
    </div>
  );
}
