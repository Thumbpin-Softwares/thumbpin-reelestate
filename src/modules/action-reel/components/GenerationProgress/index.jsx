"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { compressImage } from "@/utils/compress-image";
import { COMPOSITION_STORAGE_KEY, EDIT_PATH } from "@/lib/editable-sources";
import { GenerationProgressShell } from "@/modules/common/components/generation-progress-shell";

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
};

/**
 * GenerationProgress for the Action Reel pipeline.
 *
 * Once both Seedance clips are ready, hands off to the shared /app/edit
 * Remotion editor (same as seedance-reel) instead of rendering inline —
 * ActionReelComposition supports overlays/music/cuts/trim there, and the
 * final MP4 only gets rendered when the user hits Export in the editor.
 */
export function GenerationProgress({
  generationParams,
  onAbort,
  apiBasePath = "/api/action-reel",
  source = "action-reel",
  jobIdKey = "action_reel_job_id",
  resumeKey = "action_reel_resume",
}) {
  const router = useRouter();
  const {
    script       = "",
    voiceId      = "21m00Tcm4TlvDq8ikWAM",
    language     = "english",
    tone         = "luxury",
    locationImages = [],
    avatarUrls   = [],
    customVoiceFile = null,
  } = generationParams || {};

  const [status, setStatus] = useState(STATUS.IDLE);
  const [error, setError]   = useState(null);

  const [part1VideoUrl, setPart1VideoUrl] = useState(null);
  const [part2VideoUrl, setPart2VideoUrl] = useState(null);

  const hasStarted = useRef(false);
  const aborted = useRef(false);
  const abortController = useRef(null);
  // Set once the stream reaches a real terminal event ("video_ready" or
  // "error") — lets startPipeline tell a clean finish apart from the
  // connection just dropping mid-generation (proxy/function timeout etc.).
  const reachedTerminalEvent = useRef(false);

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
        if (job.part1VideoUrl) setPart1VideoUrl(job.part1VideoUrl);
        if (job.part2VideoUrl) setPart2VideoUrl(job.part2VideoUrl);

        if (job.status === "done") {
          try { sessionStorage.removeItem(jobIdKey); } catch (_) {}
          await prepareComposition(job.part1VideoUrl, job.part2VideoUrl);
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
        console.error("[ActionReel] Resume poll failed:", err);
        if (!aborted.current) setTimeout(poll, 5000);
      }
    };

    poll();
  };

  const startPipeline = async () => {
    setStatus(STATUS.IDLE);
    setError(null);
    setPart1VideoUrl(null); setPart2VideoUrl(null);

    const jobId = crypto.randomUUID();
    try { sessionStorage.setItem(jobIdKey, jobId); } catch (_) {}
    reachedTerminalEvent.current = false;

    const controller = new AbortController();
    abortController.current = controller;

    try {
      const formData = new FormData();
      formData.append("jobId", jobId);
      formData.append("script", script);
      formData.append("voiceId", voiceId);
      formData.append("language", language);
      formData.append("tone", tone);
      if (customVoiceFile) formData.append("customVoiceFile", customVoiceFile);

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

      // Stream closed without ever reaching "video_ready" or "error" — the
      // connection dropped (e.g. a serverless function timeout) mid-generation
      // rather than the pipeline finishing cleanly. Deliberately skip clearing
      // jobIdKey (unlike the catch block below) — a refresh will try to resume
      // this job, since it may still be running server-side.
      if (!aborted.current && !reachedTerminalEvent.current) {
        const message =
          "Lost connection to the server mid-generation. Refresh this page — it'll try to resume the job in progress.";
        console.error("[ActionReel] Stream ended without a terminal event");
        setStatus(STATUS.ERROR);
        setError(message);
        toast.error("Connection lost", { description: message });
      }
    } catch (err) {
      if (err.name === "AbortError" || aborted.current) return;
      console.error("[ActionReel] Error:", err);
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

      case "voice_generating":
        setStatus(STATUS.VOICES);
        break;

      case "voice_all_ready":
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
        reachedTerminalEvent.current = true;
        prepareComposition(event.part1VideoUrl, event.part2VideoUrl);
        break;

      case "error":
        reachedTerminalEvent.current = true;
        try { sessionStorage.removeItem(jobIdKey); } catch (_) {}
        setStatus(STATUS.ERROR);
        setError(event.message || "Pipeline failed");
        toast.error("Pipeline error", { description: event.message });
        break;

      case "fatal_error":
        // Both Seedance generations failed — go back to the Script step so
        // the user can adjust their images/script and retry, rather than
        // showing a dead-end error screen.
        reachedTerminalEvent.current = true;
        try { sessionStorage.removeItem(jobIdKey); } catch (_) {}
        toast.error("Video generation failed", {
          description: event.message || "Both clips failed — please check your images and try again.",
          duration: 8000,
        });
        aborted.current = true;
        try { abortController.current?.abort(); } catch (_) {}
        onAbort?.();
        break;

      default:
        break;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Both Seedance clips already carry baked, lip-synced audio. Probe their
   * durations, build the ActionReel composition props, and hand off to the
   * shared /app/edit Remotion editor — same pattern as seedance-reel. */
  const prepareComposition = async (p1Url, p2Url) => {
    if (!p1Url && !p2Url) {
      setStatus(STATUS.ERROR);
      setError("No videos were generated. Check server logs.");
      return;
    }

    setStatus(STATUS.COMBINING);

    try {
      const [part1Duration, part2Duration] = await Promise.all([
        getVideoDuration(p1Url),
        getVideoDuration(p2Url),
      ]);

      const props = {
        source,
        part1VideoUrl: p1Url || "",
        part2VideoUrl: p2Url || "",
        part1Duration: part1Duration > 0 ? part1Duration : 15,
        part2Duration: part2Duration > 0 ? part2Duration : 15,
      };

      sessionStorage.setItem(COMPOSITION_STORAGE_KEY, JSON.stringify(props));
      try { sessionStorage.removeItem(jobIdKey); } catch (_) {}
      try { sessionStorage.removeItem(resumeKey); } catch (_) {}
      setStatus(STATUS.DONE);
      toast.success("🎬 Reel ready! Opening editor…");
      router.push(EDIT_PATH);
    } catch (err) {
      console.error("[ActionReel] prepareComposition failed:", err);
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
    if (part1VideoUrl && part2VideoUrl) {
      setError(null);
      prepareComposition(part1VideoUrl, part2VideoUrl);
      return;
    }
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
