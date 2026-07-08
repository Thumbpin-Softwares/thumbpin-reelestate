"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

const DEFAULT_STAGE_TEXT = {
  idle:      "Starting…",
  splitting: "Writing your script…",
  voices:    "Generating voice…",
  video:     "Generating video…",
  combining: "Preparing your reel…",
  rendering: "Rendering your reel…",
};

/**
 * Drives the shared "splitting → voices → video → combining → [rendering] →
 * done" flow that every Seedance-based reel template follows (script split,
 * per-part voiceover, per-part video generation, then either a final render
 * or a hand-off to the /app/edit Remotion editor). Every template's own
 * GenerationProgress component only supplies what's actually different
 * between templates — its prompts/fields, part count, and finalize mode —
 * via `config`. The UI itself is <GenerationProgressShell {...state} />,
 * unchanged across templates.
 *
 * config:
 *   generationParams, onAbort  — passed straight through from the caller
 *   apiBasePath, source, jobIdKey, resumeKey, editPath, compositionKey
 *   finalizeMode: "render" | "redirect"
 *     "render"   — POST {apiBasePath}/render-remotion, show a download screen
 *     "redirect" — save composition to sessionStorage[compositionKey], push editPath
 *   buildFormData(generationParams, jobId) → FormData
 *   stageForEvent(event) → one of the DEFAULT_STAGE_TEXT keys, or null/undefined to leave stage unchanged
 *   toastForEvent(event) → { type: "success"|"warning"|"error", message, options? } or null
 *   isTerminalSuccess(event) → boolean, defaults to event.type === "video_ready"
 *   isTerminalError(event) → boolean, defaults to event.type === "error"
 *   buildComposition(eventOrJob) → async, returns composition props (throw to fail)
 *   jobStatusToStage: { [job.status]: stage } — for resume polling
 *   stageTextOverrides: { [stage]: text } — merged over DEFAULT_STAGE_TEXT
 */
export function useGenerationPipeline(config) {
  const {
    generationParams,
    onAbort,
    apiBasePath,
    source,
    jobIdKey,
    resumeKey,
    compositionKey,
    editPath = "/app/edit",
    finalizeMode = "redirect",
    buildFormData,
    stageForEvent,
    toastForEvent,
    isTerminalSuccess = (event) => event.type === "video_ready",
    isTerminalError = (event) => event.type === "error",
    buildComposition,
    jobStatusToStage = {},
    stageTextOverrides = {},
  } = config;

  const router = useRouter();
  const searchParams = useSearchParams();
  // `?mockStage=splitting|voices|video|combining|rendering|done|error` drives
  // this screen with fixture state instead of calling the real pipeline — for
  // styling the shell without spending generation credits.
  const mockStage = searchParams.get("mockStage");

  const [stage, setStage] = useState("idle");
  const [error, setError] = useState(null);
  const [renderPercent, setRenderPercent] = useState(0);
  const [finalVideoUrl, setFinalVideoUrl] = useState(null);

  const hasStarted = useRef(false);
  const aborted = useRef(false);
  const abortController = useRef(null);
  const reachedTerminalEvent = useRef(false);
  const lastFinalizeInput = useRef(null);
  const lastCompositionProps = useRef(null);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    if (mockStage) {
      if (mockStage === "error") {
        setStage("error");
        setError("Mock error — preview only, nothing was actually generated.");
      } else if (mockStage === "done") {
        setFinalVideoUrl("/mock/final-reel.mp4");
        setStage("done");
      } else {
        if (mockStage === "rendering") setRenderPercent(42);
        setStage(mockStage);
      }
      return;
    }

    let existingJobId = null;
    try { existingJobId = sessionStorage.getItem(jobIdKey); } catch (_) {}

    if (existingJobId) resumeJob(existingJobId);
    else startPipeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Re-attach to an already-running (or finished) job instead of re-POSTing,
   * which would double-bill credits and double-fire the generation calls. */
  const resumeJob = async (jobId) => {
    setStage("splitting");

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

        if (job.status === "done") {
          try { sessionStorage.removeItem(jobIdKey); } catch (_) {}
          await finalize(job);
          return;
        }
        if (job.status === "error") {
          try { sessionStorage.removeItem(jobIdKey); } catch (_) {}
          setStage("error");
          setError(job.error || "Generation failed");
          return;
        }

        if (jobStatusToStage[job.status]) setStage(jobStatusToStage[job.status]);
        if (!aborted.current) setTimeout(poll, 3000);
      } catch (err) {
        console.error(`[${source}] Resume poll failed:`, err);
        if (!aborted.current) setTimeout(poll, 5000);
      }
    };

    poll();
  };

  const startPipeline = async () => {
    setStage("idle");
    setError(null);

    const jobId = crypto.randomUUID();
    try { sessionStorage.setItem(jobIdKey, jobId); } catch (_) {}
    reachedTerminalEvent.current = false;

    const controller = new AbortController();
    abortController.current = controller;

    try {
      const formData = await buildFormData(generationParams, jobId);

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

      // Stream closed without ever reaching a terminal event — the
      // connection dropped (e.g. a serverless function timeout) mid-generation
      // rather than the pipeline finishing cleanly. Deliberately skip clearing
      // jobIdKey — a refresh will try to resume this job, since it may still
      // be running server-side.
      if (!aborted.current && !reachedTerminalEvent.current) {
        const message =
          "Lost connection to the server mid-generation. Refresh this page — it'll try to resume the job in progress.";
        console.error(`[${source}] Stream ended without a terminal event`);
        setStage("error");
        setError(message);
        toast.error("Connection lost", { description: message });
      }
    } catch (err) {
      if (err.name === "AbortError" || aborted.current) return;
      console.error(`[${source}] Error:`, err);
      try { sessionStorage.removeItem(jobIdKey); } catch (_) {}
      setStage("error");
      setError(err.message || "Pipeline failed");
      toast.error("Generation failed", { description: err.message });
    }
  };

  const handleEvent = useCallback((event) => {
    if (isTerminalSuccess(event)) {
      reachedTerminalEvent.current = true;
      finalize(event);
      return;
    }
    if (isTerminalError(event)) {
      reachedTerminalEvent.current = true;
      try { sessionStorage.removeItem(jobIdKey); } catch (_) {}
      setStage("error");
      setError(event.message || "Pipeline failed");
      toast.error("Pipeline error", { description: event.message });
      return;
    }

    const mappedStage = stageForEvent?.(event);
    if (mappedStage) setStage(mappedStage);

    const t = toastForEvent?.(event);
    if (t) toast[t.type]?.(t.message, t.options);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Build the composition props from the terminal event (or a resumed job
   * snapshot — same field shape), then either render a final mp4 or hand off
   * to the shared /app/edit Remotion editor, per finalizeMode. */
  const finalize = async (eventOrJob) => {
    lastFinalizeInput.current = eventOrJob;
    setStage("combining");

    try {
      const props = await buildComposition(eventOrJob);
      lastCompositionProps.current = props;

      if (compositionKey) {
        try { sessionStorage.setItem(compositionKey, JSON.stringify(props)); } catch (_) {}
      }
      try { sessionStorage.removeItem(jobIdKey); } catch (_) {}
      try { sessionStorage.removeItem(resumeKey); } catch (_) {}

      if (finalizeMode === "render") {
        await renderFinalVideo(props);
      } else {
        setStage("done");
        toast.success("🎬 Reel ready! Opening editor…");
        router.push(editPath);
      }
    } catch (err) {
      console.error(`[${source}] finalize failed:`, err);
      setStage("error");
      setError(err.message || "Composition prep failed");
    }
  };

  /** Render the collected clips into one downloadable mp4 via the project's
   * Remotion render endpoint. */
  const renderFinalVideo = async (props) => {
    lastCompositionProps.current = props;
    setStage("rendering");
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
      setStage("done");
      toast.success("🎬 Your reel is ready!");
    } catch (err) {
      if (aborted.current) return;
      console.error(`[${source}] renderFinalVideo failed:`, err);
      setStage("error");
      setError(err.message || "Final render failed");
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

  /** Retry the cheapest step that can still succeed: just the render if the
   * composition was already built, just the finalize if the raw clips are
   * already generated, or the whole pipeline as a last resort. */
  const handleRetry = () => {
    if (finalizeMode === "render" && lastCompositionProps.current) {
      renderFinalVideo(lastCompositionProps.current);
      return;
    }
    if (lastFinalizeInput.current) {
      setError(null);
      finalize(lastFinalizeInput.current);
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

  const stageTextMap = { ...DEFAULT_STAGE_TEXT, ...stageTextOverrides };
  const isDoneWithDownload = stage === "done" && finalizeMode === "render";

  return {
    phase: stage === "error" ? "error" : isDoneWithDownload ? "done" : "loading",
    stageText: stage === "done" && !isDoneWithDownload ? "Opening editor…" : (stageTextMap[stage] || "Processing…"),
    renderPercent: stage === "rendering" ? renderPercent : 0,
    error,
    onRetry: handleRetry,
    onAbort: abortGeneration,
    onDownload: handleDownload,
    onOpenEditor: () => router.push(editPath),
  };
}
