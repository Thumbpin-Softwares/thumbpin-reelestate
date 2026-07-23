"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { GenerationProgressShell } from "@/modules/common/components/generation-progress-shell";

const JOB_ID_KEY = "model-tour-job-id";

// Residential-only generation screen — n8n's model-tour workflow renders the
// video from the (possibly user-edited) script JSON produced by the finalize
// step, so unlike the generic pipeline's splitting/voices/combining stages,
// this is just generating -> done/error. Same resume-on-refresh contract as
// every other pipeline: a jobId in sessionStorage + GET /jobs/:jobId to reattach.
export function ModelTourGeneration({ script, onAbort, onBackToForm }) {
  const [phase, setPhase] = useState("loading"); // loading | error | done
  const [error, setError] = useState(null);
  const [resultUrl, setResultUrl] = useState(null);
  const hasStarted = useRef(false);
  const aborted = useRef(false);
  const abortControllerRef = useRef(null);

  const resumeJob = async (jobId) => {
    const poll = async () => {
      if (aborted.current) return;
      try {
        const res = await fetch(`/api/model-tour/jobs/${jobId}`);
        if (aborted.current) return;
        if (res.status === 404) {
          try {
            sessionStorage.removeItem(JOB_ID_KEY);
          } catch (_) {}
          startGeneration();
          return;
        }
        if (!res.ok) throw new Error(`Resume failed: ${res.status}`);

        const { job } = await res.json();
        if (job.status === "done") {
          try {
            sessionStorage.removeItem(JOB_ID_KEY);
          } catch (_) {}
          setResultUrl(job.resultUrl);
          setPhase("done");
          return;
        }
        if (job.status === "error") {
          try {
            sessionStorage.removeItem(JOB_ID_KEY);
          } catch (_) {}
          setPhase("error");
          setError(job.error || "Generation failed");
          return;
        }
        if (!aborted.current) setTimeout(poll, 3000);
      } catch (err) {
        console.error("[ModelTour] Resume poll failed:", err);
        if (!aborted.current) setTimeout(poll, 5000);
      }
    };
    poll();
  };

  const startGeneration = async () => {
    setPhase("loading");
    setError(null);

    const jobId = crypto.randomUUID();
    try {
      sessionStorage.setItem(JOB_ID_KEY, jobId);
    } catch (_) {}

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let reachedTerminal = false;

    try {
      const res = await fetch("/api/model-tour/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, script }),
        signal: controller.signal,
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
        if (aborted.current) break;
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const block of events) {
          for (const line of block.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "done") {
                reachedTerminal = true;
                try {
                  sessionStorage.removeItem(JOB_ID_KEY);
                } catch (_) {}
                setResultUrl(event.resultUrl);
                setPhase("done");
                toast.success("Home tour video ready!");
              } else if (event.type === "error") {
                reachedTerminal = true;
                try {
                  sessionStorage.removeItem(JOB_ID_KEY);
                } catch (_) {}
                setPhase("error");
                setError(event.message || "Generation failed");
              }
            } catch (_) {}
          }
        }
      }

      if (!aborted.current && !reachedTerminal) {
        const message = "Lost connection to the server mid-generation. Refresh this page — it'll try to resume the job in progress.";
        setPhase("error");
        setError(message);
        toast.error("Connection lost", { description: message });
      }
    } catch (err) {
      if (err.name === "AbortError" || aborted.current) return;
      console.error("[ModelTour] Generation error:", err);
      try {
        sessionStorage.removeItem(JOB_ID_KEY);
      } catch (_) {}
      setPhase("error");
      setError(err.message || "Generation failed");
      toast.error("Generation failed", { description: err.message });
    }
  };

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    let existingJobId = null;
    try {
      existingJobId = sessionStorage.getItem(JOB_ID_KEY);
    } catch (_) {}

    if (existingJobId) resumeJob(existingJobId);
    else startGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAbort = () => {
    aborted.current = true;
    try {
      abortControllerRef.current?.abort();
    } catch (_) {}
    try {
      sessionStorage.removeItem(JOB_ID_KEY);
    } catch (_) {}
    onAbort?.();
  };

  const handleDownload = () => {
    if (!resultUrl) return;
    window.location.href = `/api/download?url=${encodeURIComponent(resultUrl)}&name=${encodeURIComponent("home-tour.mp4")}`;
  };

  return (
    <GenerationProgressShell
      phase={phase}
      stageText="Generating your home tour video…"
      error={error}
      onRetry={startGeneration}
      onAbort={handleAbort}
      onDownload={handleDownload}
      onOpenEditor={onBackToForm}
      doneText="Your home tour video is ready!"
      openEditorText="Back to form"
      footerText="Don't close this tab — refreshing is safe, we'll pick up right where we left off."
    />
  );
}
