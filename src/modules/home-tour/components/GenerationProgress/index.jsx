"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  part2: "As you step inside, natural light floods the open-concept living space, leading out to a private infinity pool overlooking the valley.",
  part3Cta: "Ready to make this yours? Book a private tour today.",
  part1AudioUrl: "/mock/part1-audio.mp3",
  part2AudioUrl: "/mock/part2-audio.mp3",
  avatarVideoUrl: "/mock/avatar-video.mp4",
  walkthroughVideoUrl: "/mock/walkthrough-video.mp4",
  ctaVideoUrl: "/mock/cta-video.mp4",
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
 * GenerationProgress drives the same Seedance 3-part pipeline for any route
 * that wants its own independent API/job-tracking — pass apiBasePath/editPath
 * (and the sessionStorage keys) to point it at that route's own endpoints
 * instead of the seedance-reel defaults.
 *
 * Forked verbatim from seedance-reel/components/GenerationProgress when that
 * pipeline moved to the 2-part action-reel-style architecture — home-tour's
 * own generate-pipeline/render-remotion routes are still the original 3-part
 * (avatar intro + broll walkthrough + CTA) shape, so it needs its own copy of
 * this component rather than sharing one that assumes 2 parts.
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

  const [renderPercent, setRenderPercent] = useState(0);
  const [finalVideoUrl, setFinalVideoUrl] = useState(null);

  const hasStarted = useRef(false);
  const aborted = useRef(false);
  const abortController = useRef(null);
  const lastRenderProps = useRef(null);

  /** Populate the screen with fixture data for the requested stage — no network calls. */
  const runMockPreview = (stage) => {
    setPart1(MOCK_DATA.part1);
    setPart2(MOCK_DATA.part2);
    setPart3Cta(MOCK_DATA.part3Cta);

    const idx = MOCK_STAGE_ORDER.indexOf(stage);

    if (idx >= MOCK_STAGE_ORDER.indexOf(STATUS.VOICES)) {
      setPart1AudioUrl(MOCK_DATA.part1AudioUrl);
      setPart2AudioUrl(MOCK_DATA.part2AudioUrl);
    }
    if (idx >= MOCK_STAGE_ORDER.indexOf(STATUS.SEEDANCE)) {
      setAvatarVideoUrl(MOCK_DATA.avatarVideoUrl);
      setWalkthroughVideoUrl(MOCK_DATA.walkthroughVideoUrl);
      setCtaVideoUrl(MOCK_DATA.ctaVideoUrl);
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
    setPart1(""); setPart2(""); setPart3Cta("");
    setPart1AudioUrl(null); setPart2AudioUrl(null);
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

      // Still saved so "Open in editor" (or a future edit) can pick up right
      // where the 3 raw clips left off, even though we no longer auto-redirect.
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

  /** Render the 3 clips into one downloadable mp4 via the project's Remotion render endpoint. */
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
   * (the 3 raw clips already exist) instead of re-running the whole pipeline. */
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
