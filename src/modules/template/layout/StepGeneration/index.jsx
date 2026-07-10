"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { GenerationProgressShell } from "@/modules/common/components/generation-progress-shell";

// Step 3 for every template's pipeline — takes the rendered image frames
// from Finalize (imageUrl + video_action + narration per frame) and runs
// them through the in-scene-presenter pipeline: animate (Veo), synthesize
// narration (ElevenLabs), lip-sync the two together, then merge every frame
// into one final vertical MP4, via /api/template/generate-videos/[slug].
// Reuses the same waiting/error/done shell every other pipeline's
// GenerationProgress renders through (GenerationProgressShell), so this
// screen matches luxury-car-exit / product-to-video / etc. instead of
// inventing a new one.
export function StepGeneration({ template, renderedFrames, onAbort, onDone }) {
  const [phase, setPhase] = useState("loading"); // "loading" | "error" | "done"
  const [error, setError] = useState(null);
  const [finalVideoUrl, setFinalVideoUrl] = useState(null);

  // hasStartedGeneration is set the INSTANT the mount-time effect below
  // decides to fire — synchronously, not via setState. This is the actual
  // fix for the cost leak: React state updates aren't synchronous, so if
  // this effect fires twice back-to-back (Strict Mode's dev-only
  // mount→unmount→mount, or any other accidental double-mount), a
  // state-only guard (e.g. checking `phase`) can read stale `false` on both
  // firings and let both through. A ref set before either async call starts
  // can't have that race — the second firing always sees `true`.
  const hasStartedGeneration = useRef(false);

  // Separate lock around the request itself (not just the auto-start),
  // so a manual Retry can never overlap with an already in-flight call.
  const inFlightRef = useRef(false);

  const runGeneration = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    setPhase("loading");
    setError(null);
    try {
      const res = await fetch(`/api/template/generate-videos/${template.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames: renderedFrames }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Video generation failed");
      setFinalVideoUrl(data.finalVideoUrl);
      setPhase("done");
      onDone?.(data);
    } catch (err) {
      setError(err.message);
      setPhase("error");
      toast.error("Video generation failed", { description: err.message });
    } finally {
      inFlightRef.current = false;
    }
  }, [template.slug, renderedFrames, onDone]);

  useEffect(() => {
    if (hasStartedGeneration.current) return; // blocks a Strict-Mode double-mount from ever calling fetch twice
    hasStartedGeneration.current = true;
    runGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GenerationProgressShell
      phase={phase}
      stageText="Animating your storyboard..."
      error={error}
      onRetry={runGeneration}
      onAbort={onAbort}
      onDownload={() => finalVideoUrl && window.open(finalVideoUrl, "_blank")}
      doneText="Your reel is ready!"
      downloadText="Download reel"
      footerText="Don't close this tab — this can take a couple minutes to animate, voice, and lip-sync every clip."
    />
  );
}
