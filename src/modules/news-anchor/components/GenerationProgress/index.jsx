"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { compressImage } from "@/utils/compress-image";
import { clampBrollClips } from "@/lib/remotion/duration";
import { GenerationProgressShell } from "@/modules/common/components/generation-progress-shell";

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

// Short line shown inside the loader — this is the only "state" the UI exposes.
const STAGE_TEXT = {
  [STATUS.IDLE]:      "Starting…",
  [STATUS.SPLITTING]: "Writing your script…",
  [STATUS.VOICES]:    "Generating voice…",
  [STATUS.SEEDANCE]:  "Generating video…",
  [STATUS.COMBINING]: "Preparing editor…",
  [STATUS.DONE]:      "Opening editor…",
};

const JOB_STATUS_TO_LOCAL = {
  running:    STATUS.SPLITTING,
  splitting:  STATUS.SPLITTING,
  voices:     STATUS.VOICES,
  seedance:   STATUS.SEEDANCE,
  combining:  STATUS.COMBINING,
};

/**
 * GenerationProgress drives the Seedance 3-part pipeline (avatar intro +
 * broll walkthrough + CTA) for any route that wants its own independent
 * API/job-tracking — pass apiBasePath/editPath (and the sessionStorage keys)
 * to point it at that route's own endpoints instead of the news-anchor
 * defaults.
 */
export function GenerationProgress({
  generationParams,
  onAbort,
  apiBasePath = "/api/news-anchor",
  source = "news-anchor",
  editPath = "/app/edit",
  jobIdKey = "news_anchor_job_id",
  compositionKey = "video_composition",
  resumeKey = "news_anchor_resume",
}) {
  const router = useRouter();
  const {
    script       = "",
    voiceId      = "21m00Tcm4TlvDq8ikWAM",
    language     = "english",
    tone         = "luxury",
    voiceSettings = null,
    quality      = "auto",
    locationImages = [],
    avatarUrls   = [],
  } = generationParams || {};

  const [status, setStatus]               = useState(STATUS.IDLE);
  const [error, setError]                 = useState(null);

  const [part3Cta, setPart3Cta] = useState("");
  const [part2AudioUrl, setPart2AudioUrl] = useState(null);
  const [avatarVideoUrl, setAvatarVideoUrl]       = useState(null);
  const [walkthroughVideoUrl, setWalkthroughVideoUrl] = useState(null);
  const [ctaVideoUrl, setCtaVideoUrl]             = useState(null);

  const hasStarted = useRef(false);
  const aborted = useRef(false);
  const abortController = useRef(null);

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
      if (aborted.current) return;
      try {
        const res = await fetch(`${apiBasePath}/jobs/${jobId}`);
        if (aborted.current) return;
        if (res.status === 404) {
          try { sessionStorage.removeItem(jobIdKey); } catch (_) {}
          startPipeline();
          return;
        }
        if (!res.ok) throw new Error(`Resume failed: ${res.status}`);

        const { job } = await res.json();
        if (job.part3Cta) setPart3Cta(job.part3Cta);
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
        if (!aborted.current) setTimeout(poll, 3000);
      } catch (err) {
        console.error("[NewsAnchor] Resume poll failed:", err);
        if (!aborted.current) setTimeout(poll, 5000);
      }
    };

    poll();
  };

  const startPipeline = async () => {
    setStatus(STATUS.IDLE);
    setError(null);
    setPart3Cta("");
    setPart2AudioUrl(null);
    setAvatarVideoUrl(null); setWalkthroughVideoUrl(null); setCtaVideoUrl(null);

    const jobId = crypto.randomUUID();
    try { sessionStorage.setItem(jobIdKey, jobId); } catch (_) {}

    const controller = new AbortController();
    abortController.current = controller;

    try {
      const formData = new FormData();
      formData.append("jobId", jobId);
      formData.append("script", script);
      formData.append("voiceId", voiceId);
      formData.append("language", language);
      formData.append("tone", tone);
      formData.append("quality", quality);
      if (voiceSettings) formData.append("voiceSettings", JSON.stringify(voiceSettings));

      avatarUrls.slice(0, 3).forEach((url, i) => formData.append(`avatarUrl_${i}`, url));

      await Promise.all(
        locationImages.slice(0, 10).map(async (img, i) => {
          if (!img.file) return;
          try {
            const compressed = await compressImage(img.file);
            formData.append(`locationImage_${i}`, compressed);
          } catch (_) {
            formData.append(`locationImage_${i}`, img.file);
          }
        })
      );

      const res = await fetch(`${apiBasePath}/generate-pipeline`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error: ${res.status}`);
      }
      if (!res.body) throw new Error("No response stream");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      while (true) {
        if (aborted.current) break;
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
      if (err.name === "AbortError" || aborted.current) return;
      console.error("[NewsAnchor] Error:", err);
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
        setPart3Cta(event.part3_cta || "");
        setStatus(STATUS.SPLITTING);
        break;

      case "voice_generating":
        setStatus(STATUS.VOICES);
        break;

      case "voice_all_ready":
        setPart2AudioUrl(event.part2AudioUrl || null);
        setStatus(STATUS.SEEDANCE);
        break;

      case "seedance_prompt_ready":
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
      console.error("[NewsAnchor] prepareComposition failed:", err);
      setStatus(STATUS.ERROR);
      setError(`Composition prep failed: ${err.message}`);
    }
  };

  /** Detach from the running job and hand control back to the caller — the
   * server-side pipeline may still finish in the background, but this tab
   * stops waiting on it and the user gets their filled-in form back. */
  const abortGeneration = () => {
    aborted.current = true;
    try { abortController.current?.abort(); } catch (_) {}
    try { sessionStorage.removeItem(jobIdKey); } catch (_) {}
    try { sessionStorage.removeItem(resumeKey); } catch (_) {}
    onAbort?.();
  };

  const handleRetry = () => {
    hasStarted.current = false;
    startPipeline();
  };

  return (
    <GenerationProgressShell
      phase={status === STATUS.ERROR ? "error" : "loading"}
      stageText={STAGE_TEXT[status]}
      error={error}
      onRetry={handleRetry}
      onAbort={abortGeneration}
    />
  );
}
