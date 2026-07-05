"use client";

import { useEffect, useMemo, useState } from "react";
import { Player } from "@remotion/player";
import {
  ChevronLeft,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Music,
  Download,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BrollComposition, calcBrollDurationInFrames } from "@/lib/remotion/BrollComposition";
import { BROLL_PRESETS } from "@/lib/remotion/broll-presets";

const FPS = 30;

/** Probe video duration via a hidden <video> element — used only to size the
 * live preview correctly; the server probes it again authoritatively via
 * getVideoMetadata() before rendering. */
function probeVideoDuration(url) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.addEventListener("loadedmetadata", () => {
      resolve(isFinite(video.duration) && video.duration > 0 ? video.duration : 0);
    });
    video.addEventListener("error", () => resolve(0));
    video.preload = "metadata";
    video.src = url;
  });
}

export function StepBroll({ mediaItems, onBack, onReset }) {
  const [presetId, setPresetId] = useState(BROLL_PRESETS[0].id);
  const [previewItems, setPreviewItems] = useState(mediaItems.map((m) => ({ ...m })));
  const [musicFile, setMusicFile] = useState(null);
  const [musicPreviewUrl, setMusicPreviewUrl] = useState(null);

  const [status, setStatus] = useState("idle"); // idle | uploading | rendering | done | error
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState(null);
  const [resultUrl, setResultUrl] = useState(null);

  // Probe durations for any video clips so the preview's total length matches
  // what the server will actually render.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const resolved = await Promise.all(
        mediaItems.map(async (item) => {
          if (item.type !== "video") return { ...item };
          const durationSeconds = await probeVideoDuration(item.url);
          return { ...item, durationSeconds: durationSeconds || 4 };
        }),
      );
      if (!cancelled) setPreviewItems(resolved);
    })();
    return () => { cancelled = true; };
  }, [mediaItems]);

  const durationInFrames = useMemo(
    () => calcBrollDurationInFrames({ mediaItems: previewItems, presetId, fps: FPS }),
    [previewItems, presetId],
  );

  const handleMusicChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (musicPreviewUrl) URL.revokeObjectURL(musicPreviewUrl);
    setMusicFile(file);
    setMusicPreviewUrl(URL.createObjectURL(file));
  };

  const clearMusic = () => {
    if (musicPreviewUrl) URL.revokeObjectURL(musicPreviewUrl);
    setMusicFile(null);
    setMusicPreviewUrl(null);
  };

  const isBusy = status === "uploading" || status === "rendering";

  const handleGenerate = async () => {
    setStatus("uploading");
    setProgress(0);
    setError(null);
    setResultUrl(null);
    setStatusMessage("Uploading media…");

    try {
      const formData = new FormData();
      formData.append("presetId", presetId);
      formData.append("count", String(mediaItems.length));
      mediaItems.forEach((item, i) => {
        formData.append(`media_${i}`, item.file);
        formData.append(`mediaType_${i}`, item.type);
      });
      if (musicFile) formData.append("music", musicFile);

      const res = await fetch("/api/news-anchor/broll/generate", { method: "POST", body: formData });
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
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event;
          try { event = JSON.parse(line.slice(6)); } catch (_) { continue; }

          if (event.type === "status") {
            setStatusMessage(event.message);
            if (event.message?.toLowerCase().includes("render")) setStatus("rendering");
          }
          if (event.type === "upload_progress") {
            setStatusMessage(`Uploading media… (${event.uploaded}/${event.total})`);
          }
          if (event.type === "progress") {
            setStatus("rendering");
            setProgress(event.progress);
          }
          if (event.type === "done") {
            setStatus("done");
            setProgress(100);
            setResultUrl(event.url);
            toast.success("B-roll ready!");
          }
          if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }
    } catch (err) {
      console.error("[StepBroll] Generate failed:", err);
      setStatus("error");
      setError(err.message || "Generation failed");
      toast.error("B-roll generation failed", { description: err.message });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold font-heading tracking-tight">Generate B-Roll</h2>
        <p className="text-sm text-muted-foreground">
          Pick a style, preview it live, then render your montage — no AI, just your media.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* ── Preview ────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div
            className="rounded-2xl overflow-hidden border border-border/50 bg-black shadow-xl mx-auto"
            style={{ aspectRatio: "9/16", maxHeight: 480 }}
          >
            {previewItems.length > 0 && (
              <Player
                component={BrollComposition}
                inputProps={{ mediaItems: previewItems, presetId, musicUrl: musicPreviewUrl || "" }}
                durationInFrames={durationInFrames}
                compositionWidth={1080}
                compositionHeight={1920}
                fps={FPS}
                style={{ width: "100%", height: "100%" }}
                controls
                loop
              />
            )}
          </div>

          <div className="rounded-xl border border-border/50 bg-card/40 p-3 space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5" />
              Background music (optional)
            </label>
            {musicFile ? (
              <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2">
                <audio src={musicPreviewUrl} controls className="h-8 flex-1" />
                <button type="button" onClick={clearMusic} className="text-neutral-400 hover:text-red-500 shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 text-xs font-medium rounded-lg border border-dashed border-neutral-300 bg-neutral-50 hover:bg-neutral-100 py-2.5 text-neutral-600 cursor-pointer transition-colors">
                <Music className="w-3.5 h-3.5" />
                Upload a track
                <input type="file" accept="audio/*" className="hidden" onChange={handleMusicChange} />
              </label>
            )}
          </div>
        </div>

        {/* ── Style presets ──────────────────────────────────────────────── */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Style</h3>
          <div className="grid grid-cols-2 gap-2">
            {BROLL_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={isBusy}
                onClick={() => setPresetId(preset.id)}
                className={`rounded-2xl border-2 p-3 text-left transition-all disabled:opacity-50 ${
                  presetId === preset.id
                    ? "border-[#c7f038] bg-[#c7f038]/10"
                    : "border-border/40 hover:border-[#c7f038]/60"
                }`}
              >
                <p className="text-sm font-semibold">{preset.label}</p>
                <p className="text-[11px] text-neutral-500 leading-relaxed mt-0.5">{preset.description}</p>
              </button>
            ))}
          </div>

          {/* ── Progress / result ─────────────────────────────────────────── */}
          {isBusy && (
            <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {statusMessage || "Working…"}
                </span>
                {status === "rendering" && <span className="font-semibold text-primary">{progress}%</span>}
              </div>
              {status === "rendering" && (
                <div className="h-2 rounded-full bg-neutral-200 overflow-hidden">
                  <div
                    className="h-full bg-[#c7f038] rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {status === "error" && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-destructive">Generation failed</p>
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
          )}

          {status === "done" && resultUrl && (
            <div className="rounded-2xl border border-emerald-300/60 bg-emerald-50/60 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                B-roll ready!
              </div>
              <a href={resultUrl} download="news-anchor-broll.mp4">
                <Button className="w-full bg-neutral-900 text-[#c7f038] hover:opacity-90 hover:bg-neutral-900 gap-2">
                  <Download className="w-4 h-4" />
                  Download MP4
                </Button>
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack} disabled={isBusy} className="gap-2 text-muted-foreground">
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
        {status === "done" ? (
          <Button onClick={onReset} variant="outline" className="gap-2">
            Start Over
          </Button>
        ) : (
          <Button
            onClick={handleGenerate}
            disabled={isBusy || mediaItems.length === 0}
            className="bg-neutral-900 text-[#c7f038] hover:opacity-90 hover:bg-neutral-900 shadow-lg gap-2 px-6"
          >
            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate
          </Button>
        )}
      </div>
    </div>
  );
}
