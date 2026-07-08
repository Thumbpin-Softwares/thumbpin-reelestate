"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { compressImage } from "@/utils/compress-image";
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
  RENDERING: "rendering",
  DONE:      "done",
  ERROR:     "error",
};

// Short line shown inside the loader — this is the only "state" the UI exposes.
const STAGE_TEXT = {
  [STATUS.IDLE]:      "Starting…",
  [STATUS.SPLITTING]: "Writing your script…",
  [STATUS.VOICES]:    "Generating voice…",
  [STATUS.SEEDANCE]:  "Generating video…",
  [STATUS.COMBINING]: "Merging everything…",
  [STATUS.RENDERING]: "Rendering your reel…",
  [STATUS.DONE]:      "All done!",
};

const JOB_STATUS_TO_LOCAL = {
  running:    STATUS.SPLITTING,
  splitting:  STATUS.SPLITTING,
  voices:     STATUS.VOICES,
  seedance:   STATUS.SEEDANCE,
  combining:  STATUS.COMBINING,
};

// UI-only fixture for `?mockStage=`, so the screen can be styled without
// spending Seedance/ElevenLabs credits or waiting on a real render.
const MOCK_DATA = {
  part1: "Welcome to this stunning luxury villa, perfectly nestled in the hills.",
  part2: "As you step inside, natural light floods the open-concept living space, leading out to a private infinity pool overlooking the valley. Ready to make this yours? Book a private tour today.",
  part1AudioUrl: "/mock/part1-audio.mp3",
  part2AudioUrl: "/mock/part2-audio.mp3",
  part1VideoUrl: "/mock/part1-video.mp4",
  part2VideoUrl: "/mock/part2-video.mp4",
  finalVideoUrl: "/mock/final-reel.mp4",
};

const MOCK_STAGE_ORDER = [
  STATUS.SPLITTING,
  STATUS.VOICES,
  STATUS.SEEDANCE,
  STATUS.COMBINING,
  STATUS.RENDERING,
  STATUS.DONE,
  STATUS.ERROR,
];

/**
 * GenerationProgress for the "Car Exit" Seedance Reel pipeline — 2-part
 * master-template architecture (same shape as action-reel/comedy-reel: two
 * ~15s hard-cut Seedance clips, each with its own baked dialogue audio),
 * rendered via the shared "ActionReel" Remotion composition.
 *
 * home-tour used to share this exact component when this pipeline was still
 * 3-part (avatar intro + broll walkthrough + CTA) — it now has its own fork
 * at modules/home-tour/components/GenerationProgress, since its backend
 * routes still speak that 3-part shape.
 */
export function GenerationProgress({
  generationParams,
  onAbort,
  apiBasePath = "/api/seedance-reel",
  source = "seedance-reel",
  editPath = "/app/edit",
  jobIdKey = "seedance_job_id",
  compositionKey = "video_composition",
  resumeKey = "seedance_resume",
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // `?mockStage=seedance` (or splitting/voices/combining/done/error) drives this
  // screen with fixture data instead of calling the real pipeline — for styling
  // this UI without spending Seedance/ElevenLabs credits.
  const mockStage = searchParams.get("mockStage");
  const {
    script       = "",
    voiceId      = "21m00Tcm4TlvDq8ikWAM",
    language     = "english",
    tone         = "luxury",
    voiceSettings = null,
    quality      = "auto",
    locationImages = [],
    avatarUrls   = [],
    customVoiceFile = null,
  } = generationParams || {};

  const [status, setStatus]               = useState(STATUS.IDLE);
  const [error, setError]                 = useState(null);

  // Script split state
  const [part1, setPart1]       = useState("");
  const [part2, setPart2]       = useState("");

  // Asset URLs from SSE
  const [part1AudioUrl, setPart1AudioUrl] = useState(null);
  const [part2AudioUrl, setPart2AudioUrl] = useState(null);
  const [part1VideoUrl, setPart1VideoUrl] = useState(null);
  const [part2VideoUrl, setPart2VideoUrl] = useState(null);

  const [renderPercent, setRenderPercent] = useState(0);
  const [finalVideoUrl, setFinalVideoUrl] = useState(null);

  const hasStarted = useRef(false);
  const aborted = useRef(false);
  const abortController = useRef(null);
  const lastRenderProps = useRef(null);
  // Set once the stream reaches a real terminal event ("video_ready" or
  // "error") — lets startPipeline tell a clean finish apart from the
  // connection just dropping mid-generation (proxy/function timeout etc.).
  const reachedTerminalEvent = useRef(false);

  /** Populate the screen with fixture data for the requested stage — no network calls. */
  const runMockPreview = (stage) => {
    setPart1(MOCK_DATA.part1);
    setPart2(MOCK_DATA.part2);

    const idx = MOCK_STAGE_ORDER.indexOf(stage);

    if (idx >= MOCK_STAGE_ORDER.indexOf(STATUS.VOICES)) {
      setPart1AudioUrl(MOCK_DATA.part1AudioUrl);
      setPart2AudioUrl(MOCK_DATA.part2AudioUrl);
    }
    if (idx >= MOCK_STAGE_ORDER.indexOf(STATUS.SEEDANCE)) {
      setPart1VideoUrl(MOCK_DATA.part1VideoUrl);
      setPart2VideoUrl(MOCK_DATA.part2VideoUrl);
    }
    if (idx >= MOCK_STAGE_ORDER.indexOf(STATUS.DONE)) {
      setFinalVideoUrl(MOCK_DATA.finalVideoUrl);
    }
    if (stage === STATUS.RENDERING) {
      setRenderPercent(42);
    }

    if (stage === STATUS.ERROR) {
      setStatus(STATUS.ERROR);
      setError("Mock error — preview only, nothing was actually generated.");
      return;
    }

    setStatus(idx === -1 ? STATUS.SPLITTING : stage);
  };

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    if (mockStage) {
      runMockPreview(mockStage);
      return;
    }

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
          // Job record gone (cleared/expired) — nothing to resume from.
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
        console.error("[GenerationProgress] Resume poll failed:", err);
        if (!aborted.current) setTimeout(poll, 5000);
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
      formData.append("quality", quality);
      if (voiceSettings) formData.append("voiceSettings", JSON.stringify(voiceSettings));
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
      // rather than the pipeline finishing cleanly.
      if (!aborted.current && !reachedTerminalEvent.current) {
        console.error("[GenerationProgress] Stream ended without a terminal event");
        setStatus(STATUS.ERROR);
        setError("Lost connection to the server mid-generation. Refresh this page — it'll try to resume the job in progress.");
      }
    } catch (err) {
      if (err.name === "AbortError" || aborted.current) return;
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
        toast.success("Part 1 (car exit intro) video ready!");
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
        // the user can adjust their images/script and retry.
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
   * durations and build the ActionReel composition props for rendering. */
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

      // Still saved so "Open in editor" (or a future edit) can pick up right
      // where the 2 raw clips left off, even though we no longer auto-redirect.
      sessionStorage.setItem(compositionKey, JSON.stringify(props));
      try { sessionStorage.removeItem(jobIdKey); } catch (_) {}
      try { sessionStorage.removeItem(resumeKey); } catch (_) {}

      await renderFinalVideo(props);
    } catch (err) {
      console.error("[GenerationProgress] prepareComposition failed:", err);
      setStatus(STATUS.ERROR);
      setError(`Composition prep failed: ${err.message}`);
    }
  };

  /** Render the 2 clips into one downloadable mp4 via the project's Remotion render endpoint. */
  const renderFinalVideo = async (props) => {
    lastRenderProps.current = props;
    setStatus(STATUS.RENDERING);
    setRenderPercent(0);

    try {
      const res = await fetch(`${apiBasePath}/render-remotion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(props),
      });
      if (!res.ok || !res.body) throw new Error(`Render failed: ${res.status}`);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";
      let doneUrl   = null;
      let renderErr = null;

      while (true) {
        if (aborted.current) return;
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const eventBlock of events) {
          for (const line of eventBlock.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const evt = JSON.parse(line.slice(6));
              if (evt.type === "progress") setRenderPercent(evt.progress || 0);
              if (evt.type === "done") doneUrl = evt.url;
              if (evt.type === "error") renderErr = evt.error;
            } catch (_) {}
          }
        }
      }

      if (renderErr || !doneUrl) throw new Error(renderErr || "Render finished with no output");

      setFinalVideoUrl(doneUrl);
      setStatus(STATUS.DONE);
      toast.success("🎬 Your reel is ready!");
    } catch (err) {
      if (aborted.current) return;
      console.error("[GenerationProgress] renderFinalVideo failed:", err);
      setStatus(STATUS.ERROR);
      setError(err.message || "Final render failed");
    }
  };

  /** Detach from the running job and hand control back to the caller — the
   * server-side render may still finish in the background, but this tab stops
   * waiting on it and the user gets their filled-in form back. */
  const abortGeneration = () => {
    aborted.current = true;
    try { abortController.current?.abort(); } catch (_) {}
    try { sessionStorage.removeItem(jobIdKey); } catch (_) {}
    try { sessionStorage.removeItem(resumeKey); } catch (_) {}
    onAbort?.();
  };

  /** If the failure happened during the final render, retry just that step
   * (the 2 raw clips already exist) instead of re-running the whole pipeline. */
  const handleRetry = () => {
    if (lastRenderProps.current) {
      renderFinalVideo(lastRenderProps.current);
      return;
    }
    hasStarted.current = false;
    startPipeline();
  };

  const handleDownload = () => {
    if (!finalVideoUrl) return;
    const proxyUrl = `/api/download?url=${encodeURIComponent(finalVideoUrl)}&name=${encodeURIComponent(`${source}-reel.mp4`)}`;
    window.location.href = proxyUrl;
  };

  return (
    <GenerationProgressShell
      phase={status === STATUS.ERROR ? "error" : status === STATUS.DONE ? "done" : "loading"}
      stageText={STAGE_TEXT[status]}
      renderPercent={status === STATUS.RENDERING ? renderPercent : 0}
      error={error}
      onRetry={handleRetry}
      onAbort={abortGeneration}
      onDownload={handleDownload}
      onOpenEditor={() => router.push(editPath)}
    />
  );
}
